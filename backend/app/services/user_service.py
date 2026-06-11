import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.user import User

logger = logging.getLogger(__name__)

async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    """Отримує користувача за його унікальним ім'ям."""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()

async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    """Повертає користувача за його внутрішнім ID."""
    # Оптимізація: db.get() працює швидше для пошуку за Primary Key
    return await db.get(User, user_id)

async def create_user(
    db: AsyncSession,
    username: str,
    email: Optional[str] = None,
    language: str = "uk",
    theme: str = "dark"
) -> User:
    """Створює нового користувача."""
    try:
        user = User(
            username=username,
            email=email,
            preferred_language=language,
            preferred_theme=theme
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
    except IntegrityError:
        await db.rollback()
        logger.error(f"Помилка створення: Користувач з username '{username}' або email '{email}' вже існує.")
        raise ValueError("Користувач з такими даними вже існує.")

async def update_preferences(
    db: AsyncSession,
    user: User,
    language: Optional[str] = None,
    theme: Optional[str] = None,
    username: Optional[str] = None,
) -> User:
    """Оновлює налаштування профілю користувача."""
    # Оновлюємо тільки якщо значення передано
    if language is not None:
        user.preferred_language = language
    if theme is not None:
        user.preferred_theme = theme
        
    # Якщо юзернейм змінюється, перевіряємо, щоб не робити зайвих рухів
    if username is not None and user.username != username:
        user.username = username
        
    try:
        await db.commit()
        await db.refresh(user)
        return user
    except IntegrityError:
        await db.rollback()
        # Якщо хтось намагається змінити юзернейм на той, що вже є в базі
        logger.warning(f"Спроба змінити username на вже зайнятий: {username}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Цей нікнейм вже зайнятий іншим користувачем."
        )