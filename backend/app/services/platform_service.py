import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.platform import PlatformConnection

logger = logging.getLogger(__name__)

async def connect_platform_account(
    db: AsyncSession, 
    user_id: int, 
    platform: str, 
    external_id: str, 
    display_name: str
) -> PlatformConnection:
    """
    Зв'язує зовнішній акаунт платформи з користувачем системи.
    Оновлює дані, якщо підключення вже існує.
    """
    if not external_id or not display_name:
        raise ValueError("external_id та display_name не можуть бути порожніми")

    # Перевіряємо наявність підключення
    query = select(PlatformConnection).where(
        PlatformConnection.user_id == user_id,
        PlatformConnection.platform == platform
    )
    result = await db.execute(query)
    connection = result.scalars().first()

    if connection:
        # Оновлення існуючого
        if connection.platform_user_id != external_id or connection.platform_username != display_name:
            logger.info(f"Updating {platform} connection for user {user_id}")
            connection.platform_user_id = external_id
            connection.platform_username = display_name
        else:
            logger.debug(f"Connection for {platform} already up-to-date for user {user_id}")
    else:
        # Створення нового
        logger.info(f"Creating new {platform} connection for user {user_id}")
        connection = PlatformConnection(
            user_id=user_id,
            platform=platform,
            platform_user_id=external_id,
            platform_username=display_name
        )
        db.add(connection)
        
    await db.commit()
    await db.refresh(connection)
    return connection