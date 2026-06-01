from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 1. Додай імпорт сюди, на самий верх
from app.core.firebase import init_firebase
from app.core.config import settings
from app.routes import auth, platforms, analytics, profile, debug, games
from app.integrations.steam.client import steam_client
from app.integrations.steam.store import store_http_client

# 2. Правильно налаштований Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- СТАРТ СЕРВЕРА ---
    init_firebase()  # Firebase ініціалізується тут
    print("🚀 FastAPI та Firebase успішно запущені.")
    yield
    # --- ЗУПИНКА СЕРВЕРА ---
    # Тут закриваємо з'єднання
    await steam_client.close()
    await store_http_client.aclose()
    print("🛑 FastAPI зупинено, ресурси звільнено.")

# 3. Ініціалізація FastAPI
app = FastAPI(title="NexusStats API", version="1.0.0", lifespan=lifespan)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Маршрути
app.include_router(auth.router, prefix="/api/v1")
app.include_router(platforms.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(debug.router, prefix="/api/v1")
app.include_router(games.router, prefix="/api/v1")