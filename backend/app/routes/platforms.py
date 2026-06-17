import urllib.parse
import secrets
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError # <--- ДОДАНО ДЛЯ ЗАХИСТУ ВІД ДУБЛІВ
from pydantic import BaseModel

from app.core.config import settings
from app.core.dependencies import get_db, get_current_user
from app.core.database import async_session
from app.core.redis import cache_set, cache_get, cache_delete_pattern
from app.models.user import User
from app.models.platform import PlatformConnection, PlayerGame, PlayerAchievement
from app.services.platform_service import connect_platform_account
from app.integrations.steam.sync import sync_steam_data_for_user
from app.integrations.steam.client import steam_client

try:
    from app.integrations.wargaming.sync import sync_wargaming_data
    HAS_WG_SYNC = True
except ImportError:
    HAS_WG_SYNC = False

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/platforms", tags=["Platforms"])

STEAM_RETURN_URL = f"{settings.api_url}/api/v1/platforms/connect/steam/callback"
STEAM_API_OPENID = "https://steamcommunity.com/openid/login"
STEAM_API        = "https://api.steampowered.com"

async def safe_background_steam_sync(user_id: int, steam_id: str):
    async with async_session() as standalone_db:
        try:
            logger.info(f"Background sync started for user {user_id}")
            await sync_steam_data_for_user(standalone_db, user_id, steam_id)
            logger.info(f"Background sync finished for user {user_id}")
        except Exception as e:
            logger.error(f"Помилка фонової синхронізації: {str(e)}")

async def safe_background_wg_sync(user_id: int, account_id: str):
    if not HAS_WG_SYNC:
        return
    async with async_session() as standalone_db:
        try:
            await sync_wargaming_data(standalone_db, user_id, account_id)
        except Exception as e:
            logger.error(f"WG Sync Error: {str(e)}")

# ==========================================
# STEAM ROUTES
# ==========================================

@router.get("/connect/steam")
async def connect_steam_initiate(current_user: User = Depends(get_current_user)):
    session_token = secrets.token_urlsafe(32)
    await cache_set(f"steam_session:{session_token}", current_user.id, ttl=900)
    dynamic_return_url = f"{STEAM_RETURN_URL}?state={session_token}"
    params = {
        "openid.ns":         "http://specs.openid.net/auth/2.0",
        "openid.mode":       "checkid_setup",
        "openid.return_to":  dynamic_return_url,
        "openid.realm":      settings.api_url,
        "openid.identity":   "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }
    return {"url": f"{STEAM_API_OPENID}?{urllib.parse.urlencode(params)}"}


@router.get("/connect/steam/callback")
async def connect_steam_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    session_token = request.query_params.get("state")
    if not session_token:
        raise HTTPException(status_code=401, detail="Параметр state відсутній.")
    
    user_id = await cache_get(f"steam_session:{session_token}")
    if not user_id:
        raise HTTPException(status_code=401, detail="Недійсна або застаріла сесія.")

    params = dict(request.query_params)
    validation_params = {**params, "openid.mode": "check_authentication"}
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        steam_verify = await client.post(STEAM_API_OPENID, data=validation_params)
        
    if "is_valid:true" not in steam_verify.text:
        raise HTTPException(status_code=400, detail="Валідація Steam провалена.")

    claimed_id = params.get("openid.claimed_id", "")
    steam_id = claimed_id.split("/")[-1]
    if not steam_id or not steam_id.isdigit():
        raise HTTPException(status_code=400, detail="Некоректний Steam ID.")

    try:
        await connect_platform_account(db=db, user_id=int(user_id), platform="steam",
                                       external_id=steam_id, display_name="Steam Account")
        background_tasks.add_task(safe_background_steam_sync, int(user_id), steam_id)
    except Exception as e:
        logger.error(f"Помилка прив'язки Steam: {str(e)}")
        raise HTTPException(status_code=500, detail="Помилка збереження.")

    return RedirectResponse(url=f"{settings.frontend_url}/dashboard?sync=success")


@router.post("/disconnect/steam")
async def disconnect_steam(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == current_user.id,
            PlatformConnection.platform == "steam",
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Підключення Steam не знайдено.")

    pg_ids = (await db.execute(
        select(PlayerGame.id).where(PlayerGame.connection_id == connection.id)
    )).scalars().all()

    if pg_ids:
        await db.execute(delete(PlayerAchievement).where(PlayerAchievement.player_game_id.in_(pg_ids)))
        await db.execute(delete(PlayerGame).where(PlayerGame.id.in_(pg_ids)))

    await db.delete(connection)
    await db.commit()
    
    await cache_delete_pattern(f"user:{current_user.id}:*")
    
    return {"status": "success", "message": "Steam відключено."}


@router.get("/steam/search")
async def search_steam_player(
    query: str = Query(..., description="Steam ID64 або vanity URL / нікнейм"),
    current_user: User = Depends(get_current_user),
) -> dict:
    q = query.strip()
    steam_id = None

    if q.isdigit() and len(q) == 17:
        steam_id = q
    else:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{STEAM_API}/ISteamUser/ResolveVanityURL/v1/",
                    params={"key": settings.steam_api_key, "vanityurl": q, "format": "json"},
                )
                data = resp.json()
                if data.get("response", {}).get("success") == 1:
                    steam_id = data["response"]["steamid"]
        except Exception as e:
            logger.warning(f"ResolveVanityURL помилка: {e}")

    if not steam_id:
        return {"found": False, "error": "Гравця не знайдено. Перевірте Steam ID або нікнейм."}

    profile = await steam_client.get_player_summary(steam_id)
    if not profile:
        return {"found": False, "error": "Профіль Steam не знайдено або він приватний."}

    return {
        "found":          True,
        "steam_id":       steam_id,
        "personaname":    profile.get("personaname"),
        "avatarmedium":   profile.get("avatarmedium"),
        "profileurl":     profile.get("profileurl"),
        "personastate":   profile.get("personastate", 0),
    }


@router.get("/steam/friends/{steam_id}")
async def get_steam_friends(
    steam_id: str,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    friends = await steam_client.get_friends(steam_id)
    return friends


@router.post("/steam/force-sync")
async def force_sync_current_user(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    conn_res = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == current_user.id,
            PlatformConnection.platform == "steam",
        )
    )
    connection = conn_res.scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=404, detail="Steam не підключено.")

    steam_id = connection.platform_user_id
    background_tasks.add_task(safe_background_steam_sync, current_user.id, steam_id)
    return {"status": "started", "message": "Синхронізацію запущено у фоні. Оновіть сторінку за хвилину."}

# ==========================================
# WARGAMING ROUTES
# ==========================================

class WargamingConnectRequest(BaseModel):
    account_id: str
    nickname: str

@router.post("/connect/wargaming")
async def connect_wargaming(
    request: WargamingConnectRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    stmt = select(PlatformConnection).where(
        PlatformConnection.user_id == current_user.id,
        PlatformConnection.platform == "wargaming"
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()
    
    if existing:
        existing.platform_username = request.nickname
        await db.commit()
        if HAS_WG_SYNC:
            background_tasks.add_task(safe_background_wg_sync, current_user.id, request.account_id)
        return {"status": "success", "message": "World of Tanks вже підключено"}

    new_conn = PlatformConnection(
        user_id=current_user.id,
        platform="wargaming",
        platform_user_id=request.account_id,
        platform_username=request.nickname,
        is_primary=False
    )
    db.add(new_conn)
    
    # ФІКС: Захист від стану гонитви (Race Condition)
    try:
        await db.commit()
        if HAS_WG_SYNC:
            background_tasks.add_task(safe_background_wg_sync, current_user.id, request.account_id)
        logger.info(f"Користувач {current_user.username} підключив Wargaming: {request.nickname}")
    except IntegrityError:
        await db.rollback()
        logger.warning(f"Паралельний запит: Wargaming для {request.nickname} вже було створено.")
        
    return {"status": "success", "message": "World of Tanks успішно підключено"}

# ==========================================
# PLAYSTATION ROUTES
# ==========================================

class PSNConnectRequest(BaseModel):
    psn_id: str

@router.post("/connect/playstation")
async def connect_playstation(
    request: PSNConnectRequest, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    stmt = select(PlatformConnection).where(
        PlatformConnection.user_id == current_user.id,
        PlatformConnection.platform == "playstation"
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()
    
    if existing:
        return {"status": "success", "message": "PlayStation вже підключено"}

    new_conn = PlatformConnection(
        user_id=current_user.id,
        platform="playstation",
        platform_user_id=request.psn_id,
        platform_username=request.psn_id,
        is_primary=False
    )
    db.add(new_conn)
    
    # ФІКС: Захист від стану гонитви
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()

    return {"status": "success", "message": "PlayStation успішно підключено"}

# ==========================================
# УПРАВЛІННЯ ПІДКЛЮЧЕННЯМИ (GET & DELETE)
# ==========================================

@router.get("/connections")
async def get_user_connections(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    stmt = select(PlatformConnection).where(PlatformConnection.user_id == current_user.id)
    res = await db.execute(stmt)
    connections = res.scalars().all()
    
    return [
        {
            "platform": c.platform, 
            "platform_username": c.platform_username
        } 
        for c in connections
    ]

@router.delete("/connect/{platform_name}")
async def disconnect_platform(
    platform_name: str, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    stmt = select(PlatformConnection).where(
        PlatformConnection.user_id == current_user.id,
        PlatformConnection.platform == platform_name
    )
    res = await db.execute(stmt)
    connection = res.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(status_code=404, detail=f"Підключення {platform_name} не знайдено.")

    pg_ids = (await db.execute(
        select(PlayerGame.id).where(PlayerGame.connection_id == connection.id)
    )).scalars().all()

    if pg_ids:
        await db.execute(delete(PlayerAchievement).where(PlayerAchievement.player_game_id.in_(pg_ids)))
        await db.execute(delete(PlayerGame).where(PlayerGame.id.in_(pg_ids)))

    await db.delete(connection)
    await db.commit()
    
    await cache_delete_pattern(f"user:{current_user.id}:*")
    
    logger.info(f"Користувач {current_user.username} відключив платформу: {platform_name}")
    return {"status": "success", "message": f"Платформу {platform_name} відключено"}