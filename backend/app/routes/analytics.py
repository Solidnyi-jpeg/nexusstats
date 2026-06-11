from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.platform import PlatformConnection, Game, PlayerGame, PlayerAchievement, Achievement
from app.services.analytics_service import get_overview # Залишив тільки overview

router = APIRouter(prefix="/analytics", tags=["analytics"])

async def resolve_target_user(current_user: User, steam_id: str | None, db: AsyncSession) -> User:
    if not steam_id:
        return current_user
        
    res = await db.execute(
        select(User).join(PlatformConnection).where(
            PlatformConnection.platform == "steam",
            PlatformConnection.platform_user_id == steam_id,
        )
    )
    found = res.scalar_one_or_none()
    
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Користувача зі SteamID {steam_id} не знайдено в базі системи. Можливо, він ще не підключив свій акаунт."
        )
        
    return found

@router.get("/overview")
async def overview(
    platform: str | None = Query(default=None),
    steam_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    target = await resolve_target_user(current_user, steam_id, db)
    return await get_overview(db, target, platform)

# ФІКС 1: Переписано на OUTER JOIN, додано всі поля та збільшено ліміт
@router.get("/achievements/rare", response_model=List[dict])
async def rare_achievements(
    limit: int = Query(default=200, le=2000), # Збільшено ліміт, щоб фронтенд міг тягнути більше
    steam_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    target = await resolve_target_user(current_user, steam_id, db)
    
    conn_res = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == target.id,
            PlatformConnection.platform == "steam"
        )
    )
    conn = conn_res.scalar_one_or_none()
    if not conn:
        return []

    # Беремо ВСІ досягнення з ігор гравця, і робимо LEFT JOIN з його прогресом
    stmt = (
        select(Achievement, PlayerAchievement, Game)
        .join(Game, Achievement.game_id == Game.id)
        .join(PlayerGame, (PlayerGame.game_id == Game.id) & (PlayerGame.connection_id == conn.id))
        .outerjoin(
            PlayerAchievement,
            (PlayerAchievement.achievement_id == Achievement.id) &
            (PlayerAchievement.player_game_id == PlayerGame.id)
        )
        # ФІКС: Спочатку показуємо ТІ ЩО ВЖЕ ОТРИМАНІ, а в їх межах сортуємо за рідкістю!
        .order_by(
            PlayerAchievement.achieved.desc().nulls_last(),
            Achievement.rarity_percent.asc()
        )
        .limit(limit)
    )
    res = await db.execute(stmt)

    results = []
    for ach, p_ach, game in res.all():
        results.append({
            "id": ach.id,
            "api_name": ach.api_name,
            "display_name": ach.display_name,
            "description": ach.description,
            "icon_url": ach.icon_url,
            "icon_gray_url": ach.icon_gray_url,   # Додано сіру іконку
            "rarity_percent": ach.rarity_percent, # Додано відсоток рідкості (фікс 100%)
            "hidden": ach.hidden,
            "achieved": p_ach.achieved if p_ach else False, # Якщо немає запису - значить False
            "unlock_time": p_ach.unlock_time if p_ach else None,
            "game_name": game.name,
            "game_icon": game.img_icon_url,
            "platform": game.platform,
            "platform_game_id": game.platform_game_id
        })

    return results

# ФІКС 2: Такі ж зміни з OUTER JOIN для сторінки конкретної гри
@router.get("/games/{platform_game_id}/achievements")
async def game_achievements(
    platform_game_id: str,
    steam_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    target = await resolve_target_user(current_user, steam_id, db)
    
    conn_res = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == target.id,
            PlatformConnection.platform == "steam"
        )
    )
    conn = conn_res.scalar_one_or_none()
    if not conn:
        return []
        
    stmt = (
        select(Achievement, PlayerAchievement)
        .join(Game, Achievement.game_id == Game.id)
        .join(PlayerGame, (PlayerGame.game_id == Game.id) & (PlayerGame.connection_id == conn.id))
        .outerjoin(
            PlayerAchievement,
            (PlayerAchievement.achievement_id == Achievement.id) &
            (PlayerAchievement.player_game_id == PlayerGame.id)
        )
        .where(Game.platform_game_id == str(platform_game_id))
    )
    res = await db.execute(stmt)
    
    results = []
    for ach, p_ach in res.all():
        results.append({
            "api_name": ach.api_name,
            "display_name": ach.display_name,
            "description": ach.description,
            "icon_url": ach.icon_url,
            "icon_gray_url": ach.icon_gray_url,   # Додано сіру іконку
            "rarity_percent": ach.rarity_percent, # Додано відсоток
            "hidden": ach.hidden,
            "achieved": p_ach.achieved if p_ach else False,
            "unlock_time": p_ach.unlock_time if p_ach else None
        })
        
    return results