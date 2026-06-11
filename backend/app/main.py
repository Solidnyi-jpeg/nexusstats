import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from app.core.config import settings
from app.core.redis import close_redis
from app.routes import auth, platforms, analytics, profile, debug, games
from app.integrations.steam.client import steam_client
from app.integrations.steam.store import close_store_client
from app.routes import oauth

# Налаштовуємо логер для головного файлу
logger = logging.getLogger(__name__)

# Правильно налаштований Lifespan (життєвий цикл застосунку)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- СТАРТ СЕРВЕРА ---
    logger.info("🚀 FastAPI сервер успішно запущено (без Firebase!).")
    
    yield  # Тут працює сам застосунок
    
    # --- ЗУПИНКА СЕРВЕРА ---
    logger.info("🛑 FastAPI зупиняється. Починаємо звільнення ресурсів...")
    
    # Коректно закриваємо всі відкриті з'єднання та HTTP-клієнти
    try:
        await steam_client.close()
        await close_store_client()
        await close_redis()
        logger.info("✅ Всі ресурси та з'єднання успішно звільнено.")
    except Exception as e:
        logger.error(f"⚠️ Помилка під час звільнення ресурсів: {e}")

# Ініціалізація FastAPI
app = FastAPI(
    title=settings.app_name, 
    version="1.0.0", 
    lifespan=lifespan
)

# Налаштування CORS (дозволяємо локальні адреси + адресу з конфігу)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    settings.frontend_url
]

# Фільтруємо дублікати, якщо локалка збігається з конфігом
origins = list(set(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Підключення всіх маршрутів
app.include_router(auth.router, prefix="/api/v1")
app.include_router(platforms.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(debug.router, prefix="/api/v1")
app.include_router(games.router, prefix="/api/v1")
app.include_router(oauth.router, prefix="/api/v1")