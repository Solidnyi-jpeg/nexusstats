from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings
from app.models.base import Base  # Імпортуємо єдиний базовий клас

# Базові налаштування рушія
engine_kwargs = {
    "echo": settings.debug,
}

# Запобіжник: SQLite не підтримує pool_size та max_overflow.
# Додаємо ці налаштування тільки для PostgreSQL або MySQL.
if "sqlite" not in settings.database_url:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_async_engine(
    settings.database_url,
    **engine_kwargs
)

# Фабрика сесій (назва async_session збігається з імпортом у dependencies.py)
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)