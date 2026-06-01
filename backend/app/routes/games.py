import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.platform import Game, PlayerGame, Achievement, PlayerAchievement, PlatformConnection
from app.integrations.steam.store import get_game_details, get_game_news

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/games", tags=["games"])

@router.get("/{platform}/{platform_game_id}")
async def game_detail(
    platform: str,
    platform_game_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    
    if not platform_game_id or platform_game_id == "undefined":
        raise HTTPException(status_code=400, detail="Invalid platform game ID")
    
    # 1. Знаходимо гру в БД
    game_result = await db.execute(
        select(Game).where(
            Game.platform == platform,
            Game.platform_game_id == platform_game_id,
        )
    )
    game = game_result.scalar_one_or_none()

    # 2. PlayerGame (статистика поточного юзера)
    player_game = None
    achievements = []
    
    if game:
        pg_result = await db.execute(
            select(PlayerGame)
            .where(
                PlayerGame.connection_id.in_(
                    select(PlatformConnection.id).where(PlatformConnection.user_id == current_user.id)
                ),
                PlayerGame.game_id == game.id,
            )
        )
        # КРИТИЧНИЙ ФІКС: Замість колишнього косячного scalar_one_or_none()
        # Безпечно беремо першу знайдену ігрову сесію, ігноруючи дублікати
        player_game = pg_result.scalars().first()

        if player_game:
            # Отримуємо досягнення для цієї конкретної PlayerGame
            ach_result = await db.execute(
                select(PlayerAchievement, Achievement)
                .join(Achievement, Achievement.id == PlayerAchievement.achievement_id)
                .where(PlayerAchievement.player_game_id == player_game.id)
                .order_by(PlayerAchievement.achieved.desc())
            )
            achievements = [
                {
                    "api_name": a.api_name,
                    "display_name": a.display_name,
                    "description": a.description,
                    "icon_url": a.icon_url,
                    "achieved": pa.achieved,
                    "unlock_time": pa.unlock_time.isoformat() if pa.unlock_time and hasattr(pa.unlock_time, "isoformat") else pa.unlock_time,
                }
                for pa, a in ach_result.all()
            ]

    # 3. Steam Store деталі (з логуванням помилок)
    store_data = {}
    news = []
    if platform == "steam":
        try:
            store_data = await get_game_details(platform_game_id)
            news = await get_game_news(platform_game_id)
        except Exception as e:
            logger.warning(f"Не вдалося отримати дані Steam Store для {platform_game_id}: {e}")

    return {
        "game": {
            "id": game.id if game else None,
            "platform": platform,
            "platform_game_id": platform_game_id,
            "name": game.name if game else store_data.get("name", "Unknown"),
            "img_icon_url": game.img_icon_url if game else store_data.get("header_image"),
        },
        "player_stats": {
            "playtime_hours": round(player_game.playtime_minutes / 60, 1) if player_game else 0,
            "playtime_2weeks_hours": round(player_game.playtime_2weeks_minutes / 60, 1) if player_game else 0,
            "achievement_count": player_game.achievement_count if player_game else 0,
            "achievement_total": player_game.achievement_total if player_game else 0,
        } if player_game else None,
        "store": {
            "description": store_data.get("short_description", ""),
            "header_image": store_data.get("header_image", ""),
            "developers": store_data.get("developers", []),
            "genres": [g.get("description") for g in store_data.get("genres", [])],
            "metacritic": store_data.get("metacritic", {}).get("score"),
            "screenshots": [s.get("path_thumbnail") for s in store_data.get("screenshots", [])[:6]],
        },
        "news": news,
        "achievements": achievements,
    }

@router.get("/list/all")
async def list_games(
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    # Оптимізований JOIN
    result = await db.execute(
        select(PlayerGame)
        .join(Game)
        .where(
            PlayerGame.connection_id.in_(
                select(PlatformConnection.id).where(PlatformConnection.user_id == current_user.id)
            )
        )
        .order_by(PlayerGame.playtime_minutes.desc())
    )
    player_games = result.scalars().all()

    # Захист списку від дублікатів ігор на рівні виводу
    seen_game_ids = set()
    unique_player_games = []
    for pg in player_games:
        if pg.game_id not in seen_game_ids:
            seen_game_ids.add(pg.game_id)
            unique_player_games.append(pg)

    return [
        {
            "game_id": pg.game.id,
            "platform": pg.game.platform,
            "platform_game_id": pg.game.platform_game_id,
            "name": pg.game.name,
            "img_icon_url": pg.game.img_icon_url,
            "playtime_hours": round(pg.playtime_minutes / 60, 1),
            "playtime_2weeks_hours": round(pg.playtime_2weeks_minutes / 60, 1),
            "achievement_count": pg.achievement_count,
            "achievement_total": pg.achievement_total,
            "achievement_percent": round(pg.achievement_count / pg.achievement_total * 100, 1) 
                                   if pg.achievement_total and pg.achievement_total > 0 else 0,
        }
        for pg in unique_player_games
    ]