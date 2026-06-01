import urllib.parse
import secrets
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete # ДОДАНО: delete для очищення бази
import httpx

from app.core.config import settings
from app.core.dependencies import get_db, get_current_user
from app.core.database import async_session
from app.core.redis import cache_set, cache_get
from app.models.user import User
# ДОДАНО: імпорт моделей для каскадного видалення з PostgreSQL
from app.models.platform import PlatformConnection, PlayerGame, PlayerAchievement 
from app.services.platform_service import connect_platform_account
from app.integrations.steam.sync import sync_steam_data_for_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/platforms", tags=["Platforms"])

STEAM_RETURN_URL = f"{settings.api_url}/api/v1/platforms/connect/steam/callback"
STEAM_API_OPENID = "https://steamcommunity.com/openid/login"

# ФОНОВИЙ ТАСК: створює власну ізольовану сесію
async def safe_background_steam_sync(user_id: int, steam_id: str):
    async with async_session() as standalone_db:
        try:
            logger.info(f"Background sync started for user {user_id}")
            await sync_steam_data_for_user(standalone_db, user_id, steam_id)
            logger.info(f"Background sync finished for user {user_id}")
        except Exception as e:
            logger.error(f"Помилка фонової синхронізації Стіма: {str(e)}")


@router.get("/connect/steam")
async def connect_steam_initiate(
    current_user: User = Depends(get_current_user)
):
    session_token = secrets.token_urlsafe(32)
    await cache_set(f"steam_session:{session_token}", current_user.id, ttl=900)
    
    dynamic_return_url = f"{STEAM_RETURN_URL}?state={session_token}"
    
    params = {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.return_to": dynamic_return_url,
        "openid.realm": settings.api_url,
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
    }
    
    redirect_url = f"{STEAM_API_OPENID}?{urllib.parse.urlencode(params)}"
    return {"url": redirect_url}


@router.get("/connect/steam/callback")
async def connect_steam_callback(
    request: Request, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    session_token = request.query_params.get("state")
    if not session_token:
        raise HTTPException(status_code=401, detail="Параметр state відсутній.")
        
    user_id = await cache_get(f"steam_session:{session_token}")
    if not user_id:
        raise HTTPException(status_code=401, detail="Недійсна або застаріла сесія інтеграції.")
    
    params = dict(request.query_params)
    validation_params = params.copy()
    validation_params["openid.mode"] = "check_authentication"
    
    async with httpx.AsyncClient() as client:
        steam_verify = await client.post(STEAM_API_OPENID, data=validation_params)
        
    if "is_valid:true" not in steam_verify.text:
        raise HTTPException(status_code=400, detail="Валідація запиту в Steam провалена.")
    
    claimed_id = params.get("openid.claimed_id", "")
    steam_id = claimed_id.split('/')[-1]
    
    if not steam_id or not steam_id.isdigit():
        raise HTTPException(status_code=400, detail="Отримано некоректний Steam ID.")
    
    try:
        await connect_platform_account(
            db=db,
            user_id=int(user_id),
            platform="steam",
            external_id=steam_id,
            display_name="Steam Account"
        )
        
        background_tasks.add_task(safe_background_steam_sync, int(user_id), steam_id)
        
    except Exception as e:
        logger.error(f"Помилка БД при прив'язці Steam: {str(e)}")
        raise HTTPException(status_code=500, detail="Помилка збереження даних.")
        
    return RedirectResponse(url=f"{settings.frontend_url}/dashboard?sync=success")


# КРИТИЧНИЙ ФІКС: Ендпоінт, якого не вистачало для кнопки "Вимкнути"
@router.post("/disconnect/steam")
async def disconnect_steam(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Безпечне відключення Steam із повним очищенням заблокованих зв'язків Postgres."""
    logger.info(f"Запит на повне відключення Steam від користувача ID: {current_user.id}")

    # 1. Шукаємо зв'язок акаунта
    stmt = select(PlatformConnection).where(
        PlatformConnection.user_id == current_user.id,
        PlatformConnection.platform == "steam"
    )
    result = await db.execute(stmt)
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Підключення Steam не знайдено.")

    # 2. Витягуємо всі ігри цього підключення для чистки досягнень
    pg_stmt = select(PlayerGame.id).where(PlayerGame.connection_id == connection.id)
    pg_res = await db.execute(pg_stmt)
    player_game_ids = pg_res.scalars().all()

    if player_game_ids:
        # Спочатку видаляємо досягнення гравця (ForeignKey захист)
        await db.execute(
            delete(PlayerAchievement).where(PlayerAchievement.player_game_id.in_(player_game_ids))
        )
        # Потім видаляємо самі ігрові сесії гравця
        await db.execute(
            delete(PlayerGame).where(PlayerGame.id.in_(player_game_ids))
        )

    # 3. Видаляємо основний запис підключення платформи
    await db.delete(connection)
    await db.commit()

    logger.info(f"Steam успішно відключено, базу очищено для користувача {current_user.id}")
    return {"status": "success", "message": "Платформу успішно відключено."}