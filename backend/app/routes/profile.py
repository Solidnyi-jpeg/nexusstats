import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.platform import Bookmark, PlatformConnection, PlayerGame, PlayerAchievement
from app.services.analytics_service import get_overview
from app.integrations.steam.client import steam_client
from app.integrations.steam.sync import sync_steam_data_for_user
from app.core.database import async_session
from app.core.redis import cache_delete_pattern

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])

async def _safe_sync(user_id: int, steam_id: str):
    """Фонова задача для безпечної синхронізації без блокування HTTP-запиту."""
    async with async_session() as db:
        try:
            await sync_steam_data_for_user(db, user_id, steam_id)
            # ФІКС: Після завершення синхронізації обов'язково чистимо кеш!
            await cache_delete_pattern(f"user:{user_id}:*")
        except Exception as e:
            logger.error(f"Sync error for {steam_id}: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# ФІКС РОУТІНГІВ: Усі специфічні шляхи (bookmarks, connections) 
# ПОВИННІ бути вище, ніж параметричний роут `/{steam_id}`, 
# інакше FastAPI сприйме слово "bookmarks" як чийсь Steam ID.
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/connections/{platform}")
async def disconnect_platform(
    platform: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == current_user.id,
            PlatformConnection.platform == platform,
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Підключення не знайдено.")

    pg_ids = (await db.execute(
        select(PlayerGame.id).where(PlayerGame.connection_id == connection.id)
    )).scalars().all()

    if pg_ids:
        await db.execute(delete(PlayerAchievement).where(PlayerAchievement.player_game_id.in_(pg_ids)))
        await db.execute(delete(PlayerGame).where(PlayerGame.id.in_(pg_ids)))

    await db.delete(connection)
    await db.commit()
    
    # Скидаємо кеш
    await cache_delete_pattern(f"user:{current_user.id}:*")
    return {"status": "success", "message": "Платформу відключено."}

@router.post("/bookmarks")
async def add_bookmark(
    platform: str,
    platform_user_id: str,
    display_name: str = "",
    avatar_url: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    existing = (await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.platform == platform,
            Bookmark.platform_user_id == platform_user_id,
        )
    )).scalar_one_or_none()
    
    if existing:
        return {"message": "Already bookmarked"}

    db.add(Bookmark(
        user_id=current_user.id, 
        platform=platform,
        platform_user_id=platform_user_id,
        display_name=display_name, 
        avatar_url=avatar_url
    ))
    await db.commit()
    return {"message": "Bookmarked"}

@router.get("/bookmarks")
async def list_bookmarks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[dict]:
    bookmarks = (await db.execute(
        select(Bookmark).where(Bookmark.user_id == current_user.id)
    )).scalars().all()
    
    return [
        {
            "platform": b.platform, 
            "platform_user_id": b.platform_user_id,
            "display_name": b.display_name, 
            "avatar_url": b.avatar_url
        }
        for b in bookmarks
    ]

@router.delete("/bookmarks/{platform}/{platform_user_id}")
async def remove_bookmark(
    platform: str,
    platform_user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    bm = (await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.platform == platform,
            Bookmark.platform_user_id == platform_user_id,
        )
    )).scalar_one_or_none()
    if bm:
        await db.delete(bm)
        await db.commit()
    return {"message": "Removed"}

# ─────────────────────────────────────────────────────────────────────────────
# Параметричні роути (мають бути в самому низу)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{steam_id}/preview")
async def get_profile_preview(steam_id: str):
    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")
    return {
        "steam_id":     steam_id,
        "personaname":  profile.get("personaname"),
        "avatar":       profile.get("avatarfull"),
        "personastate": profile.get("personastate", 0),
        "profileurl":   profile.get("profileurl"),
    }

@router.post("/{steam_id}/sync")
async def sync_profile(
    steam_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Steam profile not found")

    if profile.get("communityvisibilitystate") != 3:
        return {"status": "private", "message": "Профіль або бібліотека ігор закриті."}

    user_res = await db.execute(
        select(User).join(PlatformConnection).where(
            PlatformConnection.platform == "steam",
            PlatformConnection.platform_user_id == steam_id,
        )
    )
    user = user_res.scalar_one_or_none()

    if not user:
        return {
            "status":  "not_registered",
            "message": "Цей гравець не зареєстрований у NexusStats. Синхронізація можлива лише для зареєстрованих.",
        }

    background_tasks.add_task(_safe_sync, user.id, steam_id)
    return {"status": "started", "message": "Синхронізацію запущено. Оновіть сторінку за хвилину."}

@router.get("/{steam_id}")
async def get_profile(steam_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")

    user_res = await db.execute(
        select(User).join(PlatformConnection).where(
            PlatformConnection.platform == "steam",
            PlatformConnection.platform_user_id == steam_id,
        )
    )
    user = user_res.scalar_one_or_none()

    analytics = None
    if user:
        try:
            analytics = await get_overview(db, user, platform="steam")
        except Exception:
            analytics = None

    try:
        games_raw = await steam_client.get_owned_games(steam_id)
    except Exception:
        games_raw = []

    top_games = []
    if analytics and analytics.get("top_games"):
        top_games = analytics["top_games"]
    elif games_raw:
        sorted_games = sorted(games_raw, key=lambda x: x.get("playtime_forever", 0), reverse=True)[:15]
        for g in sorted_games:
            app_id    = str(g.get("appid", ""))
            icon_hash = g.get("img_icon_url", "")
            top_games.append({
                "game_id":              None,
                "platform":             "steam",
                "platform_game_id":     app_id,
                "name":                 g.get("name", f"App {app_id}"),
                "img_icon_url":         f"https://media.steampowered.com/steamcommunity/public/images/apps/{app_id}/{icon_hash}.jpg"
                                        if icon_hash else None,
                "playtime_hours":       round(g.get("playtime_forever", 0) / 60, 1),
                "playtime_2weeks_hours": round(g.get("playtime_2weeks", 0) / 60, 1),
                "achievement_count":    0,
                "achievement_total":    0,
                "achievement_percent":  0,
            })

    return {
        "steam_id":      steam_id,
        "personaname":   profile.get("personaname"),
        "avatar":        profile.get("avatarfull"),
        "profileurl":    profile.get("profileurl"),
        "personastate":  profile.get("personastate", 0),
        "is_synced":     user is not None,
        "total_games":   len(games_raw),
        "total_hours":   round(sum(g.get("playtime_forever", 0) for g in games_raw) / 60, 1),
        "top_games":     top_games,
    }