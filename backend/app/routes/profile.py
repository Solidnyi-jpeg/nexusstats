import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete  # ДОДАНО: delete для швидкої зачистки
from typing import List

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
# ОНОВЛЕНО: додано моделі PlayerGame та PlayerAchievement для каскадного видалення
from app.models.platform import Bookmark, PlatformConnection, PlayerGame, PlayerAchievement
from app.services.analytics_service import get_overview
from app.integrations.steam.client import steam_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("/{steam_id}")
async def get_profile(
    steam_id: str, 
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Публічний профіль гравця."""

    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")

    # Перевірка, чи користувач NexusStats
    result = await db.execute(
        select(User).join(PlatformConnection).where(
            PlatformConnection.platform == "steam",
            PlatformConnection.platform_user_id == steam_id,
        )
    )
    user = result.scalar_one_or_none()

    analytics = None
    if user:
        try:
            analytics = await get_overview(db, user, platform="steam")
        except Exception:
            analytics = None

    # Отримуємо ігри зі Steam
    try:
        games_raw = await steam_client.get_owned_games(steam_id)
    except Exception:
        games_raw = []

    # Форматуємо топ ігор
    top_games = []
    if games_raw:
        sorted_games = sorted(games_raw, key=lambda x: x.get("playtime_forever", 0), reverse=True)[:10]
        for g in sorted_games:
            app_id = str(g.get("appid", ""))
            icon_hash = g.get("img_icon_url", "")
            top_games.append({
                "game_id": g.get("appid"),
                "platform": "steam",
                "platform_game_id": app_id,
                "name": g.get("name", f"App {app_id}"),
                "img_icon_url": f"https://media.steampowered.com/steamcommunity/public/images/apps/{app_id}/{icon_hash}.jpg" if icon_hash else None,
                "playtime_hours": round(g.get("playtime_forever", 0) / 60, 1),
                "playtime_2weeks_hours": round(g.get("playtime_2weeks", 0) / 60, 1),
                "achievement_count": 0,
                "achievement_total": 0,
                "achievement_percent": 0,
            })

    return {
        "steam_id": steam_id,
        "personaname": profile.get("personaname"),
        "avatar": profile.get("avatarfull"),
        "profileurl": profile.get("profileurl"),
        "personastate": profile.get("personastate", 0),
        "is_synced": user is not None,
        "total_games": len(games_raw),
        "total_hours": round(sum(g.get("playtime_forever", 0) for g in games_raw) / 60, 1),
        "analytics": analytics,
        "top_games": analytics.get("top_games") if analytics and analytics.get("top_games") else top_games,
    }

@router.get("/{steam_id}/preview")
async def get_profile_preview(steam_id: str):
    """Швидкий прев'ю профілю (для карток)."""
    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")

    return {
        "steam_id": steam_id,
        "personaname": profile.get("personaname"),
        "avatar": profile.get("avatarfull"),
        "personastate": profile.get("personastate", 0),
        "profileurl": profile.get("profileurl"),
    }

@router.post("/{steam_id}/sync")
async def sync_profile_data(steam_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Примусова синхронізація та оновлення даних гравця зі Steam API."""
    logger.info(f"Запущено примусову синхронізацію для Steam ID: {steam_id}")
    
    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found in Steam")

    # Перевірка налаштувань приватності ігор та профілю (3 = Public)
    if profile.get("communityvisibilitystate") != 3:
        return {
            "status": "warning",
            "message": "Profile or game details are private. Live synchronization aborted.",
            "personastate": profile.get("personastate", 0)
        }

    # КРИТИЧНО: Замість звичайного "success" повертаємо актуальний повний профіль,
    # щоб фронтенд відразу отримав нові години, ігри та аналітику без зникнення UI.
    return await get_profile(steam_id=steam_id, db=db)

# КРИТИЧНИЙ ДОДАТОК: Ендпоінт для кнопки відключення акаунта (DELETE /api/v1/profile/connections/{platform})
@router.delete("/connections/{platform}")
async def disconnect_platform(
    platform: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Безпечне відключення ігрової платформи з каскадним очищенням PostgreSQL."""
    logger.info(f"Користувач ID {current_user.id} ініціював видалення платформи: {platform}")

    # 1. Шукаємо саму прив'язку платформи
    stmt = select(PlatformConnection).where(
        PlatformConnection.user_id == current_user.id,
        PlatformConnection.platform == platform
    )
    result = await db.execute(stmt)
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Підключення платформи не знайдено.")

    # 2. Очищаємо зв'язані таблиці досягнень та ігор, щоб Postgres не кидав ForeignKeyViolationError
    pg_stmt = select(PlayerGame.id).where(PlayerGame.connection_id == connection.id)
    pg_res = await db.execute(pg_stmt)
    player_game_ids = pg_res.scalars().all()

    if player_game_ids:
        # Спочатку видаляємо досягнення користувача
        await db.execute(
            delete(PlayerAchievement).where(PlayerAchievement.player_game_id.in_(player_game_ids))
        )
        # Потім видаляємо ігрові сесії користувача
        await db.execute(
            delete(PlayerGame).where(PlayerGame.id.in_(player_game_ids))
        )

    # 3. Видаляємо безпосередньо саму картку підключення
    await db.delete(connection)
    await db.commit()

    logger.info(f"Платформу {platform} успішно видалено для користувача {current_user.id}, базу очищено.")
    return {"status": "success", "message": "Платформу успішно відключено, дані зачищено."}

@router.post("/bookmarks")
async def add_bookmark(
    platform: str,
    platform_user_id: str,
    display_name: str = "",
    avatar_url: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    
    result = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.platform == platform,
            Bookmark.platform_user_id == platform_user_id,
        )
    )
    if result.scalar_one_or_none():
        return {"message": "Already bookmarked"}

    bm = Bookmark(
        user_id=current_user.id,
        platform=platform,
        platform_user_id=platform_user_id,
        display_name=display_name,
        avatar_url=avatar_url,
    )
    db.add(bm)
    await db.commit()
    return {"message": "Bookmarked"}

@router.get("/bookmarks", response_model=List[dict])
async def list_bookmarks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[dict]:
    
    result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == current_user.id)
    )
    bookmarks = result.scalars().all()
    return [
        {
            "platform": b.platform,
            "platform_user_id": b.platform_user_id,
            "display_name": b.display_name,
            "avatar_url": b.avatar_url,
        }
        for b in bookmarks
    ]

@router.delete("/bookmarks/{platform}/{platform_user_id}")
async def remove_bookmark(
    platform: str,
    platform_user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    
    result = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id,
            Bookmark.platform == platform,
            Bookmark.platform_user_id == platform_user_id,
        )
    )
    bm = result.scalar_one_or_none()
    if bm:
        await db.delete(bm)
        await db.commit()
    return {"message": "Removed"}