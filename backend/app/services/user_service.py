from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User

async def get_or_create(
    db: AsyncSession,
    firebase_uid: str,
    email: Optional[str] = None,
) -> User:
    """Отримує користувача за firebase_uid або створює нового, якщо він відсутній."""
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()
    
    if user is None:
        user = User(firebase_uid=firebase_uid, email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    """Повертає користувача за його внутрішнім ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_preferences(
    db: AsyncSession,
    user: User,
    language: Optional[str] = None,
    theme: Optional[str] = None,
    username: Optional[str] = None,
) -> User:
    """Оновлює налаштування профілю користувача."""
    # Оптимізація: оновлюємо тільки якщо значення передано (не None)
    if language is not None:
        user.preferred_language = language
    if theme is not None:
        user.preferred_theme = theme
    if username is not None:
        user.username = username
        
    await db.commit()
    await db.refresh(user)
    return user