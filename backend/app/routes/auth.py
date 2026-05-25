from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.services.user_service import get_or_create, update_preferences

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(
    firebase_token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Реєстрація через Firebase токен."""
    from app.core.firebase import verify_firebase_token
    try:
        payload = verify_firebase_token(firebase_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    user = await get_or_create(
        db=db,
        firebase_uid=payload["uid"],
        email=payload.get("email"),
    )
    return {
        "user_id": user.id,
        "email": user.email,
        "username": user.username,
        "preferred_language": user.preferred_language,
        "preferred_theme": user.preferred_theme,
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)) -> dict:
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "avatar_url": current_user.avatar_url,
        "preferred_language": current_user.preferred_language,
        "preferred_theme": current_user.preferred_theme,
    }


@router.patch("/settings")
async def update_settings(
    language: str | None = None,
    theme: str | None = None,
    username: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Оновлення налаштувань користувача."""
    user = await update_preferences(db, current_user, language, theme, username)
    return {
        "preferred_language": user.preferred_language,
        "preferred_theme": user.preferred_theme,
        "username": user.username,
    }
