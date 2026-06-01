from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
import httpx
import logging

from app.core.dependencies import get_db
from app.models.platform import (
    PlayerAchievement, Achievement, PlayerGame,
    PlatformConnection, Game
)
from app.models.user import User
from app.services.user_service import get_or_create
from app.services.analytics_service import get_overview
from app.core.config import settings
from app.core.redis import cache_get, cache_set

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/debug", tags=["debug"])

# --- Helper functions ---

async def _test_user(db: AsyncSession) -> User:
    return await get_or_create(db, "test-uid-001", "test@nexusstats.com")

async def _fetch_steam_data(url: str, params: dict, cache_key: str, ttl: int = 3600):
    cached = await cache_get(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
            await cache_set(cache_key, data, ttl=ttl)
            return data
        except Exception as e:
            logger.error(f"Steam API Error for {cache_key}: {e}")
            return None

async def _get_achievement_schema(app_id: str) -> dict:
    data = await _fetch_steam_data(
        "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/",
        {"key": settings.steam_api_key, "appid": app_id},
        f"ach_schema:{app_id}",
        ttl=86400
    )
    if not data: return {}
    achievements = data.get("game", {}).get("availableGameStats", {}).get("achievements", [])
    return {a["name"]: a for a in achievements}

async def _get_global_percentages(app_id: str) -> dict:
    data = await _fetch_steam_data(
        "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/",
        {"gameid": app_id},
        f"ach_global:{app_id}",
        ttl=3600
    )
    if not data: return {}
    achievements = data.get("achievementpercentages", {}).get("achievements", [])
    return {a["name"]: round(a["percent"], 1) for a in achievements}

def _rarity_from_percent(p: float) -> str:
    if p <= 5:    return "Legendary"
    if p <= 10:   return "Epic"
    if p <= 25:   return "Rare"
    if p <= 50:   return "Uncommon"
    return "Common"

# --- Routes ---

@router.post("/setup")
async def setup_test_user(steam_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    user = await _test_user(db)
    from app.services.platform_service import connect_platform_account
    conn = await connect_platform_account(db, user.id, "steam", steam_id, "Test User")
    return {"user_id": user.id, "steam_connected": conn.platform_username}

@router.post("/clear")
async def clear_user_data(db: AsyncSession = Depends(get_db)) -> dict:
    tables = ["player_achievements", "player_games", "achievements", "games", "platform_connections"]
    for t in tables:
        await db.execute(text(f"DELETE FROM {t}"))
    await db.commit()
    return {"message": "Data cleared"}

@router.get("/achievements")
async def test_achievements(
    limit: int = Query(default=500, le=1000),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _test_user(db)

    result = await db.execute(
        select(
            PlayerAchievement, Achievement, Game.name, Game.platform_game_id, Game.platform, Game.img_icon_url
        )
        .join(Achievement, Achievement.id == PlayerAchievement.achievement_id)
        .join(PlayerGame, PlayerGame.id == PlayerAchievement.player_game_id)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .join(Game, Game.id == Achievement.game_id)
        .where(PlatformConnection.user_id == user.id)
        .order_by(PlayerAchievement.achieved.desc())
        .limit(limit)
    )
    rows = result.all()

    app_ids = list(set(row[3] for row in rows))
    
    # Завантаження даних Steam батчами (обмеження 20 ігор для швидкості)
    schemas = {}
    percentages = {}
    for app_id in app_ids[:20]:
        schemas[app_id] = await _get_achievement_schema(app_id)
        percentages[app_id] = await _get_global_percentages(app_id)

    achievements = []
    for pa, ach, game_name, game_pid, platform, img_url in rows:
        schema_data = schemas.get(game_pid, {}).get(ach.api_name, {})
        global_percent = percentages.get(game_pid, {}).get(ach.api_name)
        
        rarity_percent = global_percent if global_percent is not None else 50.0

        achievements.append({
            "display_name": schema_data.get("displayName") or ach.display_name,
            "description": schema_data.get("description") or ach.description,
            "icon_url": schema_data.get("icon") or ach.icon_url,
            "game_name": game_name,
            "achieved": pa.achieved,
            "rarity_percent": rarity_percent,
            "rarity_label": _rarity_from_percent(rarity_percent),
        })

    achieved = sorted([a for a in achievements if a["achieved"]], key=lambda x: x["rarity_percent"])
    locked = sorted([a for a in achievements if not a["achieved"]], key=lambda x: x["rarity_percent"])

    return {
        "total": len(achievements),
        "achieved_count": len(achieved),
        "completion_percent": round(len(achieved) / len(achievements) * 100, 1) if achievements else 0,
        "achievements": achieved + locked,
    }