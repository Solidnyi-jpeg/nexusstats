import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.platform import PlatformConnection

logger = logging.getLogger(__name__)

async def connect_platform_account(
    db: AsyncSession, 
    user_id: int, 
    platform: str, 
    external_id: str, 
    display_name: str,
    avatar_url: Optional[str] = None
) -> PlatformConnection:
    """
    Зв'язує зовнішній акаунт платформи з користувачем системи.
    Оновлює ім'я та аватар, якщо підключення вже існує.
    """
    if not external_id or not display_name:
        raise ValueError("external_id та display_name не можуть бути порожніми")

    try:
        # Шукаємо підключення КОНКРЕТНО ЦЬОГО користувача до КОНКРЕТНО ЦЬОГО зовнішнього акаунта
        query = select(PlatformConnection).where(
            PlatformConnection.user_id == user_id,
            PlatformConnection.platform == platform,
            PlatformConnection.platform_user_id == external_id
        )
        result = await db.execute(query)
        connection = result.scalars().first()

        if connection:
            # Якщо акаунт вже прив'язаний, ми просто оновлюємо нікнейм або аватар, 
            # якщо вони змінилися на платформі (наприклад, у Steam)
            needs_update = False
            
            if connection.platform_username != display_name:
                connection.platform_username = display_name
                needs_update = True
                
            if avatar_url and connection.avatar_url != avatar_url:
                connection.avatar_url = avatar_url
                needs_update = True

            if needs_update:
                logger.info(f"Оновлено дані {platform} (ID: {external_id}) для користувача {user_id}")
            else:
                logger.debug(f"Дані {platform} (ID: {external_id}) актуальні для користувача {user_id}")
                
        else:
            # Створення нового підключення
            logger.info(f"Створення нового підключення {platform} (ID: {external_id}) для користувача {user_id}")
            
            # Перевіряємо, чи немає в нього вже іншого Steam-акаунта, робимо новий primary
            check_primary = select(PlatformConnection).where(
                PlatformConnection.user_id == user_id,
                PlatformConnection.platform == platform
            )
            has_existing = (await db.execute(check_primary)).scalars().first()
            
            connection = PlatformConnection(
                user_id=user_id,
                platform=platform,
                platform_user_id=external_id,
                platform_username=display_name,
                avatar_url=avatar_url,
                is_primary=not bool(has_existing) # Якщо це перший Steam, він primary
            )
            db.add(connection)
            
        await db.commit()
        await db.refresh(connection)
        return connection
        
    except IntegrityError as e:
        await db.rollback()
        logger.warning(f"Конфлікт при підключенні {platform}: {external_id} вже зайнятий іншим користувачем.")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Цей акаунт {platform.capitalize()} вже прив'язаний до іншого профілю NexusStats."
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Неочікувана помилка в connect_platform_account: {e}")
        raise e