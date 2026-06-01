import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import async_session  # Імпортуємо безпосередньо
from app.models.user import User

logger = logging.getLogger(__name__)

# Налаштування безпеки
# Вказуємо правильний шлях до твого ендпоінту авторизації
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/firebase", auto_error=False)

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"

async def get_db():
    """Фабрика сесій бази даних."""
    async with async_session() as session:
        yield session
        await session.commit() # Опціонально: автоматичний commit після кожного запиту

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Отримує поточного користувача з JWT-токена."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Недійсна сесія користувача. Будь ласка, перезайдіть.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as e:
        logger.warning(f"Спроба входу з недійсним токеном: {e}")
        raise credentials_exception

    # Шукаємо користувача
    query = select(User).where(User.id == int(user_id))
    result = await db.execute(query)
    user = result.scalars().first()

    if user is None:
        logger.warning(f"Користувача з ID {user_id} не знайдено в БД.")
        raise credentials_exception
        
    return user