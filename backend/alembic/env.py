import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# 1. Імпортуємо твої налаштування та Base з моделями
from app.core.config import settings
from app.models.base import Base
# ОБОВ'ЯЗКОВО імпортуй усі моделі, щоб Alembic їх "побачив"
from app.models import user, platform

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 2. Вказуємо Alembic, де брати метадані
target_metadata = Base.metadata

# 3. Підтягуємо URL з твого .env (замінюємо postgresql:// на postgresql+asyncpg:// якщо треба)
config.set_main_option("sqlalchemy.url", settings.database_url)

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()