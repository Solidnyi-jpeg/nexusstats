from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.platform import PlatformConnection
from app.services.platform_service import (
    connect_steam, sync_steam, get_connections
)
from app.integrations.steam.client import steam_client

router = APIRouter(prefix="/platforms", tags=["platforms"])


@router.get("/connections")
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Список підключених платформ."""
    connections = await get_connections(db, current_user)
    return [
        {
            "id": c.id,
            "platform": c.platform,
            "platform_user_id": c.platform_user_id,
            "platform_username": c.platform_username,
            "avatar_url": c.avatar_url,
            "is_primary": c.is_primary,
            "is_public": c.is_public,
        }
        for c in connections
    ]


@router.post("/steam/connect")
async def steam_connect(
    steam_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Підключення Steam акаунту."""
    conn = await connect_steam(db, current_user, steam_id)
    return {
        "message": "Steam connected successfully",
        "platform_username": conn.platform_username,
        "avatar_url": conn.avatar_url,
    }


@router.post("/steam/sync")
async def steam_sync(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Синхронізація ігор та досягнень зі Steam."""
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == current_user.id,
            PlatformConnection.platform == "steam",
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(
            status_code=400,
            detail="Steam not connected. Use /platforms/steam/connect first."
        )
    return await sync_steam(db, conn)


@router.get("/steam/search")
async def steam_search(query: str) -> dict:
    """Пошук гравця по нікнейму або Steam ID."""
    if not query or not query.strip():
        return {"found": False, "error": "Empty query"}

    query = query.strip()
    steam_id = None

    # Якщо це числовий Steam ID
    if query.isdigit() and len(query) >= 15:
        steam_id = query
    else:
        # Пробуємо vanity URL
        steam_id = await steam_client.search_by_vanity(query)
        # Пробуємо також без пробілів і спецсимволів
        if not steam_id:
            clean = query.lower().replace(" ", "").replace("_", "")
            steam_id = await steam_client.search_by_vanity(clean)

    if not steam_id:
        return {"found": False, "error": "Player not found"}

    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        return {"found": False, "error": "Could not load profile"}

    return {
        "found": True,
        "steam_id": steam_id,
        "personaname": profile.get("personaname"),
        "avatar": profile.get("avatarfull"),
        "avatarmedium": profile.get("avatarmedium"),
        "profileurl": profile.get("profileurl"),
        "personastate": profile.get("personastate", 0),
    }


@router.get("/steam/friends/{steam_id}")
async def steam_friends(steam_id: str) -> list[dict]:
    """Список друзів гравця зі Steam."""
    friends = await steam_client.get_friends(steam_id)
    return [
        {
            "steam_id": f.get("steamid"),
            "personaname": f.get("personaname"),
            "avatar": f.get("avatarmedium"),
            "friend_since": f.get("friend_since"),
        }
        for f in friends[:50]
    ]
