from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db
from app.models.user import User
from app.models.platform import PlatformConnection, PlayerGame, Bookmark
from app.services.analytics_service import get_overview
from app.integrations.steam.client import steam_client

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/{steam_id}/public")
async def public_profile(
    steam_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Публічний профіль гравця — завжди показує Steam дані."""

    # Отримуємо профіль зі Steam
    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")

    # Перевіряємо чи є в нашій БД
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

    # Якщо аналітики немає — завантажуємо ігри напряму зі Steam
    if not analytics or not analytics.get("top_games"):
        try:
            games_raw = await steam_client.get_owned_games(steam_id)
            top = sorted(games_raw, key=lambda x: x.get("playtime_forever", 0), reverse=True)[:10]
            steam_games = []
            for g in top:
                app_id = str(g.get("appid", ""))
                icon_hash = g.get("img_icon_url", "")
                steam_games.append({
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
            if not analytics:
                analytics = {"top_games": steam_games}
            elif not analytics.get("top_games"):
                analytics["top_games"] = steam_games
        except Exception:
            pass

    # Завжди отримуємо ігри зі Steam API напряму
    steam_games = []
    try:
        games_raw = await steam_client.get_owned_games(steam_id)
        top_games = sorted(games_raw, key=lambda x: x.get("playtime_forever", 0), reverse=True)[:10]
        for g in top_games:
            app_id = str(g.get("appid", ""))
            icon_hash = g.get("img_icon_url", "")
            steam_games.append({
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
    except Exception:
        pass

    total_games = 0
    total_hours = 0.0
    try:
        all_games = await steam_client.get_owned_games(steam_id)
        total_games = len(all_games)
        total_hours = round(sum(g.get("playtime_forever", 0) for g in all_games) / 60, 1)
    except Exception:
        pass

    return {
        "steam_id": steam_id,
        "personaname": profile.get("personaname"),
        "avatar": profile.get("avatarfull"),
        "profileurl": profile.get("profileurl"),
        "is_synced": user is not None,
        "total_games": total_games,
        "total_hours": total_hours,
        "analytics": analytics,
        "top_games": analytics["top_games"] if analytics else steam_games,
    }


@router.post("/bookmarks")
async def add_bookmark(
    platform: str,
    platform_user_id: str,
    display_name: str = "",
    avatar_url: str = "",
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.services.user_service import get_or_create
    user = await get_or_create(db, "test-uid-001", "test@nexusstats.com")

    result = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == user.id,
            Bookmark.platform == platform,
            Bookmark.platform_user_id == platform_user_id,
        )
    )
    if result.scalar_one_or_none():
        return {"message": "Already bookmarked"}

    bm = Bookmark(
        user_id=user.id,
        platform=platform,
        platform_user_id=platform_user_id,
        display_name=display_name,
        avatar_url=avatar_url,
    )
    db.add(bm)
    await db.commit()
    return {"message": "Bookmarked"}


@router.get("/bookmarks")
async def list_bookmarks(db: AsyncSession = Depends(get_db)) -> list[dict]:
    from app.services.user_service import get_or_create
    user = await get_or_create(db, "test-uid-001", "test@nexusstats.com")

    result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == user.id)
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
) -> dict:
    from app.services.user_service import get_or_create
    user = await get_or_create(db, "test-uid-001", "test@nexusstats.com")

    result = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == user.id,
            Bookmark.platform == platform,
            Bookmark.platform_user_id == platform_user_id,
        )
    )
    bm = result.scalar_one_or_none()
    if bm:
        await db.delete(bm)
        await db.commit()
    return {"message": "Removed"}

@router.get("/{steam_id}/preview")
async def preview_profile(
    steam_id: str,
) -> dict:
    """Швидкий перегляд профілю без синхронізації в БД."""
    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")

    # Отримуємо ігри напряму зі Steam
    steam_games = []
    total_games = 0
    total_hours = 0.0
    try:
        games_raw = await steam_client.get_owned_games(steam_id)
        total_games = len(games_raw)
        total_hours = round(sum(g.get("playtime_forever", 0) for g in games_raw) / 60, 1)
        top = sorted(games_raw, key=lambda x: x.get("playtime_forever", 0), reverse=True)[:10]
        for g in top:
            app_id = str(g.get("appid", ""))
            icon_hash = g.get("img_icon_url", "")
            steam_games.append({
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
    except Exception:
        pass

    return {
        "steam_id": steam_id,
        "personaname": profile.get("personaname"),
        "avatar": profile.get("avatarfull"),
        "profileurl": profile.get("profileurl"),
        "personastate": profile.get("personastate", 0),
        "is_synced": False,
        "total_games": total_games,
        "total_hours": total_hours,
        "top_games": steam_games,
        "analytics": None,
    }
