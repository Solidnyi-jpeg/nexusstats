from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes import auth, platforms, analytics, profile, debug, games
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Firebase
    try:
        from app.core.firebase import init_firebase
        init_firebase()
        print("Firebase initialized ✅")
    except Exception as e:
        print(f"WARNING: Firebase not initialized: {e}")

    # Alembic автоміграції в продакшні
    if settings.is_production:
        try:
            from alembic.config import Config
            from alembic import command
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, "head")
            print("Migrations applied ✅")
        except Exception as e:
            print(f"Migration warning: {e}")

    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    debug=settings.debug,
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(platforms.router)
app.include_router(analytics.router)
app.include_router(profile.router)
app.include_router(games.router)
app.include_router(debug.router)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "1.0.0",
        "environment": settings.environment,
    }
