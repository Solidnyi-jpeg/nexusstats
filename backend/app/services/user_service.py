from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


async def get_or_create(
    db: AsyncSession,
    firebase_uid: str,
    email: str | None = None,
) -> User:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(firebase_uid=firebase_uid, email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_preferences(
    db: AsyncSession,
    user: User,
    language: str | None = None,
    theme: str | None = None,
    username: str | None = None,
) -> User:
    if language:
        user.preferred_language = language
    if theme:
        user.preferred_theme = theme
    if username:
        user.username = username
    await db.commit()
    await db.refresh(user)
    return user
