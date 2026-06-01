import asyncio
from sqlalchemy import text
from app.core.database import engine

async def main():
    print("Connecting to PostgreSQL to patch the table...")
    try:
        async with engine.begin() as conn:
            # Примусово додаємо колонку, якщо її немає, із дефолтним значенням
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR DEFAULT 'firebase_auth';"
            ))
            print("✓ Column 'hashed_password' successfully added to 'users' table!")
    except Exception as e:
        print(f"✗ Error partitioning database: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())