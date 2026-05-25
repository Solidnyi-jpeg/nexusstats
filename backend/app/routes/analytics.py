from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.services.analytics_service import get_overview, get_achievements_by_rarity

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(
    platform: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Загальна аналітика по всіх або одній платформі."""
    return await get_overview(db, current_user, platform)


@router.get("/achievements/rare")
async def rare_achievements(
    limit: int = Query(default=50, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Рідкісні досягнення гравця."""
    return await get_achievements_by_rarity(db, current_user, limit)
