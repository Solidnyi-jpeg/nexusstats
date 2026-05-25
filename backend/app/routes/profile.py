from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db, get_current_user
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
    """Публічний профіль гравця."""
    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Player not found")

    result = await db.execute(
        select(User).join(PlatformConnection).where(
            PlatformConnection.platform == "steam",
            PlatformConnection.platform_user_id == steam_id,
            PlatformConnection.is_public == True,
        )
    )
    user = result.scalar_one_or_none()

    analytics = None
    if user:
        analytics = await get_overview(db, user, platform="steam")

    return {
        "steam_id": steam_id,
        "personaname": profile.get("personaname"),
        "avatar": profile.get("avatarfull"),
        "profileurl": profile.get("profileurl"),
        "is_synced": user is not None,
        "analytics": analytics,
    }


@router.post("/bookmarks")
async def add_bookmark(
    platform: str,
    platform_user_id: str,
    display_name: str = "",
    avatar_url: str = "",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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


@router.get("/bookmarks")
async def list_bookmarks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
