import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.dependencies import get_db
from app.models.user import User
from app.models.platform import PlatformConnection
from app.integrations.steam.client import steam_client
from app.services.auth_service import create_access_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/steam/login")
async def steam_login():
    """
    Генерує URL для авторизації через Steam OpenID та редиректить туди користувача.
    """
    return_url = f"{settings.api_url}/api/v1/auth/steam/callback"
    
    steam_openid_url = "https://steamcommunity.com/openid/login"
    params = {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.return_to": return_url,
        "openid.realm": settings.api_url,
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }
    
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return RedirectResponse(url=f"{steam_openid_url}?{query_string}")


@router.get("/steam/callback")
async def steam_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Сюди Steam повертає користувача. Перевіряємо підпис, створюємо/оновлюємо профіль.
    """
    params = dict(request.query_params)
    
    # 1. Перевіряємо, чи Steam підтверджує справжність цих даних
    params["openid.mode"] = "check_authentication"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post("https://steamcommunity.com/openid/login", data=params)
            
        if "is_valid:true" not in resp.text:
            logger.warning("Спроба підробки Steam OpenID або недійсний підпис.")
            raise HTTPException(status_code=401, detail="Недійсна авторизація Steam.")
            
    except httpx.RequestError as e:
        logger.error(f"Помилка зв'язку зі Steam OpenID: {e}")
        raise HTTPException(status_code=502, detail="Steam недоступний.")

    # 2. Витягуємо SteamID з URL
    claimed_id = params.get("openid.claimed_id", "")
    if not claimed_id.startswith("https://steamcommunity.com/openid/id/"):
        raise HTTPException(status_code=400, detail="Некоректний Steam ID.")
        
    steam_id = claimed_id.split("/")[-1]

    try:
        # 3. Отримуємо дані профілю Steam (ім'я, аватар)
        summary = await steam_client.get_player_summary(steam_id)
        steam_username = summary.get("personaname", f"SteamUser_{steam_id}")
        avatar_url = summary.get("avatarfull")

        # 4. Шукаємо або створюємо з'єднання та користувача в базі
        conn_stmt = select(PlatformConnection).where(
            PlatformConnection.platform == "steam",
            PlatformConnection.platform_user_id == steam_id
        )
        conn_res = await db.execute(conn_stmt)
        connection = conn_res.scalars().first()

        if connection:
            # Користувач вже існує разом із підключенням -> оновлюємо дані
            user = await db.get(User, connection.user_id)
            connection.platform_username = steam_username
            connection.avatar_url = avatar_url
            await db.commit()
            
        else:
            # Підключення не знайдено. Генеруємо очікуваний нікнейм
            unique_username = f"{steam_username}_{steam_id[-4:]}"
            
            # ФІКС БАГУ: Перевіряємо, чи немає в таблиці 'users' осиротілого запису з таким ніком
            user_stmt = select(User).where(User.username == unique_username)
            user_res = await db.execute(user_stmt)
            user = user_res.scalars().first()
            
            if not user:
                # Якщо користувача справді немає в базі — створюємо повністю нового
                logger.info(f"✨ Створення нового користувача: {unique_username}")
                user = User(
                    username=unique_username,
                    preferred_language="uk", 
                    preferred_theme="dark"
                )
                db.add(user)
                await db.flush() # Отримуємо генеруємий id для зв'язку
            else:
                # Якщо користувач знайшовся, ми не створюємо дублікат, а просто використовуємо його
                logger.info(f"🔄 Знайдено існуючий акаунт користувача {unique_username}. Відновлюємо зв'язок зі Steam.")

            # Створюємо нове підключення (або для нового, або для відновленого користувача)
            connection = PlatformConnection(
                user_id=user.id,
                platform="steam",
                platform_user_id=steam_id,
                platform_username=steam_username,
                avatar_url=avatar_url,
                is_primary=True
            )
            db.add(connection)
            await db.commit()

        # 5. Генеруємо внутрішній JWT токен
        access_token = create_access_token(data={
            "sub": str(user.id), 
            "username": user.username
        })

        # 6. Редирект назад на фронтенд із токеном
        redirect_url = f"{settings.frontend_url}/auth/callback?token={access_token}&steam_id={steam_id}&sync=success"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        await db.rollback()
        logger.error(f"Помилка при збереженні користувача: {str(e)}", exc_info=True)
        return RedirectResponse(url=f"{settings.frontend_url}/welcome?error=auth_failed")