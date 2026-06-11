# backend/app/routes/oauth.py
import httpx
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from jose import jwt

from app.core.config import settings
from app.core.dependencies import get_db 
from app.models.user import User 
from app.models.platform import PlatformConnection
from app.services.auth_service import create_access_token 

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/oauth", tags=["OAuth2 Integrations"])

# ВИПРАВЛЕНО: Ключі беруться з конфігу (з файлу .env), ніякого хардкоду!
GOOGLE_CLIENT_ID = settings.google_client_id
GOOGLE_CLIENT_SECRET = settings.google_client_secret
GOOGLE_REDIRECT_URI = f"{settings.api_url}/api/v1/oauth/google/callback"


@router.get("/google/login")
async def google_login(token: str = None):
    """
    Якщо token є — це прив'язка з налаштувань. 
    Якщо token=None — це нова реєстрація/логін зі сторінки Welcome.
    """
    # ВИПРАВЛЕНО: Змінено scope на стандартний для отримання профілю без Play Console
    scope = "openid profile email"
    state_value = token if token else "new_login"
    
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&access_type=offline" 
        f"&prompt=consent"      
        f"&state={state_value}" 
    )
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Визначаємо тип операції: Логін чи Прив'язка
        is_new_login = (state == "new_login")
        user_id = None
        
        if not is_new_login:
            try:
                payload = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
                user_id = int(payload.get("sub"))
            except Exception:
                logger.warning("Недійсний токен у state, переходимо в режим нового логіну")
                is_new_login = True

        # 2. Обмін code на токени Google
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
            
        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        
        expires_in = tokens.get("expires_in", 3599)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        # 3. ВИПРАВЛЕНО: Отримуємо дані профілю з універсального Google Userinfo API
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {access_token}"}
            userinfo_resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", headers=headers)
            userinfo_resp.raise_for_status()
            
        google_profile = userinfo_resp.json()
        
        # Мапимо дані у наш стандартний формат профілю
        platform_user_id = google_profile.get("sub") # Унікальний ID користувача в Google
        personaname = google_profile.get("name", "Google User")
        avatar_url = google_profile.get("picture")

        # 4. Шукаємо існуюче підключення в базі
        conn_stmt = select(PlatformConnection).where(
            PlatformConnection.platform == "google_play",
            PlatformConnection.platform_user_id == platform_user_id
        )
        conn_res = await db.execute(conn_stmt)
        connection = conn_res.scalars().first()

        user_to_login = None

        if connection:
            # Акаунт Google вже підключений -> оновлюємо дані сесії
            connection.access_token = access_token
            if refresh_token: 
                connection.refresh_token = refresh_token
            connection.expires_at = expires_at
            connection.platform_username = personaname
            connection.avatar_url = avatar_url
            
            user_to_login = await db.get(User, connection.user_id)
        else:
            # Акаунта Google немає в базі
            if is_new_login:
                # Створюємо повністю нового користувача
                unique_username = f"{personaname}_{platform_user_id[-4:]}"
                
                # Захист від конфліктів унікальних імен
                user_stmt = select(User).where(User.username == unique_username)
                if (await db.execute(user_stmt)).scalars().first():
                    unique_username = f"{unique_username}_gp"

                new_user = User(
                    username=unique_username,
                    preferred_language="uk", 
                    preferred_theme="dark"
                )
                db.add(new_user)
                await db.flush() 
                user_to_login = new_user
            else:
                # Прив'язуємо до існуючого залогіненого юзера
                user_to_login = await db.get(User, user_id)

            # Записуємо нове підключення
            connection = PlatformConnection(
                user_id=user_to_login.id,
                platform="google_play",
                platform_user_id=platform_user_id,
                platform_username=personaname,
                avatar_url=avatar_url,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
                is_primary=is_new_login 
            )
            db.add(connection)

        await db.commit()

        # 5. Повертаємо користувача на фронтенд
        if is_new_login:
            new_access_token = create_access_token(data={
                "sub": str(user_to_login.id), 
                "username": user_to_login.username
            })
            redirect_url = f"{settings.frontend_url}/auth/callback?token={new_access_token}&platform=google_play&sync=success"
            return RedirectResponse(url=redirect_url)
        else:
            return RedirectResponse(url=f"{settings.frontend_url}/settings?sync=google_success")

    except Exception as e:
        await db.rollback()
        logger.error(f"Помилка Google OAuth: {e}", exc_info=True)
        if state == "new_login":
            return RedirectResponse(url=f"{settings.frontend_url}/welcome?error=auth_failed")
        return RedirectResponse(url=f"{settings.frontend_url}/settings?sync=google_error")