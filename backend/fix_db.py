import asyncio
import logging
from sqlalchemy import text
from app.core.database import engine

# Налаштовуємо базовий логер для скрипта
logging.basicConfig(level=logging.INFO, format="%(levelname)-5.5s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

async def main():
    logger.info("Підключення до бази даних для оновлення таблиці 'users'...")
    try:
        async with engine.begin() as conn:
            # 1. Додаємо колонку hashed_password (якщо раптом її немає)
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(512);"
            ))
            
            # 2. Робимо пароль та email необов'язковими (NULL), бо Steam їх не надає
            await conn.execute(text(
                "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;"
            ))
            await conn.execute(text(
                "ALTER TABLE users ALTER COLUMN email DROP NOT NULL;"
            ))

            # 3. Повністю видаляємо залишки Firebase з бази
            await conn.execute(text(
                "ALTER TABLE users DROP COLUMN IF EXISTS firebase_uid CASCADE;"
            ))
            
            # Якщо раптом був унікальний індекс на firebase_uid, DROP CASCADE його прибере, 
            # але можна додати явне видалення індексу, якщо він завис:
            await conn.execute(text(
                "DROP INDEX IF EXISTS ix_users_firebase_uid;"
            ))

            logger.info("✓ Базу даних успішно оновлено: Firebase видалено, БД готова до Steam Auth!")
            
    except Exception as e:
        logger.error(f"✗ Помилка під час оновлення бази даних: {e}")
    finally:
        await engine.dispose()
        logger.info("З'єднання з БД закрито.")

if __name__ == "__main__":
    asyncio.run(main())