from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.platform import PlatformConnection
from app.services.analytics_service import get_overview, get_achievements_by_rarity

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/overview")
async def overview(
    platform: str | None = Query(default=None),
    steam_id: str | None = Query(default=None), # Додано для підтримки аналітики друзів
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Загальна аналітика по всіх або одній платформі (для себе або друга)."""
    target_user = current_user
    
    if steam_id:
        result = await db.execute(
            select(User).join(PlatformConnection).where(
                PlatformConnection.platform == "steam",
                PlatformConnection.platform_user_id == steam_id
            )
        )
        user_found = result.scalar_one_or_none()
        if user_found:
            target_user = user_found

    return await get_overview(db, target_user, platform)


@router.get("/achievements/rare", response_model=List[dict])
async def rare_achievements(
    limit: int = Query(default=50, le=100),
    steam_id: str | None = Query(default=None), # КРИТИЧНО: додано для відображення досягнень друзів!
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """Рідкісні досягнення гравця (твої або твого друга за його steam_id)."""
    target_user = current_user
    
    if steam_id:
        # Шукаємо користувача NexusStats, який прив'язав цей steam_id
        result = await db.execute(
            select(User).join(PlatformConnection).where(
                PlatformConnection.platform == "steam",
                PlatformConnection.platform_user_id == steam_id
            )
        )
        user_found = result.scalar_one_or_none()
        if not user_found:
            # Якщо друга немає в нашій системі, повертаємо порожній список без помилки 500
            return []
        target_user = user_found

    return await get_achievements_by_rarity(db, target_user, limit)

@router.get("/games/{game_id}/achievements", response_model=List[dict])
async def game_achievements(
    game_id: str,
    steam_id: str = Query(..., description="Steam ID гравця, чиї досягнення ми дивимось"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[dict]:
    """Отримання досягнень конкретної гри для профілю користувача або його друга."""
    return await get_game_achievements(db, steam_id, game_id)