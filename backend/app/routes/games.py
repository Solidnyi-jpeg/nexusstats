import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.platform import Game, PlayerGame, PlatformConnection
from app.integrations.steam.store import get_game_details, get_game_news
from app.services.analytics_service import get_game_achievements_for_user
from app.integrations.dota.client import opendota_client
from app.integrations.cs.client import cs_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/games", tags=["games"])


@router.get("/list/all")
async def list_games(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    # ФІКС: Додано joinedload(PlayerGame.game), щоб уникнути MissingGreenletError
    stmt = (
        select(PlayerGame)
        .options(joinedload(PlayerGame.game))
        .where(
            PlayerGame.connection_id.in_(
                select(PlatformConnection.id).where(PlatformConnection.user_id == current_user.id)
            )
        )
        .order_by(PlayerGame.playtime_minutes.desc())
    )
    res = await db.execute(stmt)
    
    seen, unique = set(), []
    for pg in res.scalars().all():
        if pg.game_id not in seen:
            seen.add(pg.game_id)
            unique.append(pg)

    return [
        {
            "game_id":            pg.game.id,
            "platform":           pg.game.platform,
            "platform_game_id":   pg.game.platform_game_id,
            "name":               pg.game.name,
            "img_icon_url":       pg.game.img_icon_url,
            "playtime_hours":     round(pg.playtime_minutes / 60, 1),
            "playtime_2weeks_hours": round(pg.playtime_2weeks_minutes / 60, 1),
            "achievement_count":  pg.achievement_count,
            "achievement_total":  pg.achievement_total,
            "achievement_percent": round(pg.achievement_count / pg.achievement_total * 100, 1)
                                   if pg.achievement_total else 0,
        }
        for pg in unique
    ]


@router.get("/dota2/stats")
async def get_dota_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    # 1. Знаходимо Steam ID користувача в базі
    stmt = select(PlatformConnection).where(
        PlatformConnection.user_id == current_user.id,
        PlatformConnection.platform == "steam"
    )
    result = await db.execute(stmt)
    steam_connection = result.scalars().first()

    if not steam_connection:
        raise HTTPException(status_code=400, detail="Steam акаунт не підключено")

    # 2. Робимо запит до OpenDota за кіберспортивною статистикою
    dota_stats = await opendota_client.get_player_stats(steam_connection.platform_user_id)
    
    if not dota_stats:
        raise HTTPException(status_code=404, detail="Статистику Dota 2 не знайдено або сервери перевантажені.")

    # 3. 🔥 ДОДАНО: Витягуємо реальні години гри зі Steam, які вже є у нашій БД
    pg_stmt = select(PlayerGame.playtime_minutes).join(Game).where(
        PlayerGame.connection_id == steam_connection.id,
        Game.platform_game_id == "570"  # 570 - це ID Доти в Steam
    )
    playtime_mins = (await db.execute(pg_stmt)).scalar_one_or_none()
    
    # Конвертуємо хвилини в години і додаємо у відповідь для фронтенду
    dota_stats["playtime_hours"] = round(playtime_mins / 60) if playtime_mins else 0

    return dota_stats

@router.get("/cs/stats")
async def get_cs_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    stmt = select(PlatformConnection).where(
        PlatformConnection.user_id == current_user.id,
        PlatformConnection.platform == "steam"
    )
    steam_connection = (await db.execute(stmt)).scalars().first()

    if not steam_connection:
        raise HTTPException(status_code=400, detail="Steam акаунт не підключено")

    stats = await cs_client.get_player_stats(steam_connection.platform_user_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Статистику CS не знайдено або профіль Steam приховано")
        
    return stats


@router.get("/{platform}/{platform_game_id}")
async def game_detail(
    platform: str,
    platform_game_id: str,
    viewer_steam_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:

    if not platform_game_id or platform_game_id == "undefined":
        raise HTTPException(status_code=400, detail="Invalid game ID")

    target_user = current_user
    
    if viewer_steam_id:
        stmt = select(User).join(PlatformConnection).where(
            PlatformConnection.platform == platform,
            PlatformConnection.platform_user_id == viewer_steam_id,
        )
        found = (await db.execute(stmt)).scalar_one_or_none()
        
        if found:
            target_user = found
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Профіль друга (SteamID {viewer_steam_id}) не знайдено або не синхронізовано."
            )

    game_stmt = select(Game).where(Game.platform == platform, Game.platform_game_id == platform_game_id)
    game = (await db.execute(game_stmt)).scalar_one_or_none()

    player_game = None
    if game:
        pg_stmt = (
            select(PlayerGame)
            .where(
                PlayerGame.connection_id.in_(
                    select(PlatformConnection.id).where(PlatformConnection.user_id == target_user.id)
                ),
                PlayerGame.game_id == game.id,
            )
        )
        player_game = (await db.execute(pg_stmt)).scalars().first()

    store_data, news = {}, []
    if platform == "steam":
        try:
            store_data = await get_game_details(platform_game_id) or {}
            news       = await get_game_news(platform_game_id) or []
        except Exception as e:
            logger.warning(f"Steam Store помилка для гри {platform_game_id}: {e}")

    achievements = []
    if game and player_game:
        achievements = await get_game_achievements_for_user(db, target_user, platform_game_id, platform)

    player_stats = None
    if player_game:
        total = player_game.achievement_total or 0
        count = player_game.achievement_count or 0
        player_stats = {
            "playtime_hours":        round(player_game.playtime_minutes / 60, 1),
            "playtime_2weeks_hours": round(player_game.playtime_2weeks_minutes / 60, 1),
            "achievement_count":     count,
            "achievement_total":     total,
            "completion_percent":    round(count / total * 100, 1) if total > 0 else 0,
        }

    return {
        "game": {
            "id":               game.id if game else None,
            "platform":         platform,
            "platform_game_id": platform_game_id,
            "name":             game.name if game else store_data.get("name", "Unknown"),
            "img_icon_url":     game.img_icon_url if game else store_data.get("header_image"),
        },
        "player_stats": player_stats,
        "store": {
            "description":  store_data.get("short_description", ""),
            "header_image": store_data.get("header_image", ""),
            "developers":   store_data.get("developers", []),
            "genres":       [g.get("description") for g in store_data.get("genres", [])] if store_data.get("genres") else [],
            "metacritic":   (store_data.get("metacritic") or {}).get("score"),
            "screenshots":  [s.get("path_thumbnail") for s in (store_data.get("screenshots") or [])[:6]],
        },
        "achievements": achievements,
        "news":         news,
    }