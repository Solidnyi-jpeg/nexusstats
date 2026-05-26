from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
import httpx

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

router = APIRouter(prefix="/debug", tags=["debug"])


async def _test_user(db: AsyncSession) -> User:
    return await get_or_create(db, "test-uid-001", "test@nexusstats.com")


async def _get_achievement_schema(app_id: str) -> dict:
    """Отримує схему досягнень гри зі Steam (іконки + назви)."""
    cache_key = f"ach_schema:{app_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(
                "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/",
                params={"key": settings.steam_api_key, "appid": app_id},
            )
            r.raise_for_status()
            data = r.json()
            achievements = data.get("game", {}).get("availableGameStats", {}).get("achievements", [])
            schema = {a["name"]: a for a in achievements}
            await cache_set(cache_key, schema, ttl=86400)
            return schema
        except Exception:
            return {}


async def _get_global_percentages(app_id: str) -> dict:
    """Отримує глобальні відсотки досягнень зі Steam."""
    cache_key = f"ach_global:{app_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(
                "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/",
                params={"gameid": app_id},
            )
            r.raise_for_status()
            data = r.json()
            achievements = data.get("achievementpercentages", {}).get("achievements", [])
            percentages = {a["name"]: round(a["percent"], 1) for a in achievements}
            await cache_set(cache_key, percentages, ttl=3600)
            return percentages
        except Exception:
            return {}


def _rarity_from_percent(p: float) -> str:
    if p <= 5:    return "Legendary"
    if p <= 10:   return "Epic"
    if p <= 25:   return "Rare"
    if p <= 50:   return "Uncommon"
    return "Common"


@router.post("/setup")
async def setup_test_user(
    steam_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _test_user(db)
    from app.services.platform_service import connect_steam
    conn = await connect_steam(db, user, steam_id)
    return {"user_id": user.id, "steam_connected": conn.platform_username}


@router.post("/sync")
async def sync_test_user(db: AsyncSession = Depends(get_db)) -> dict:
    user = await _test_user(db)
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == user.id,
            PlatformConnection.platform == "steam",
        ).limit(1)
    )
    conn = result.scalars().first()
    if not conn:
        return {"error": "Run /debug/setup first"}
    from app.services.platform_service import sync_steam
    return await sync_steam(db, conn)


@router.post("/clear")
async def clear_user_data(db: AsyncSession = Depends(get_db)) -> dict:
    await db.execute(text("DELETE FROM player_achievements"))
    await db.execute(text("DELETE FROM player_games"))
    await db.execute(text("DELETE FROM achievements"))
    await db.execute(text("DELETE FROM games"))
    await db.execute(text("DELETE FROM platform_connections"))
    await db.commit()
    return {"message": "Data cleared"}


@router.get("/overview")
async def test_overview(
    platform: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _test_user(db)
    return await get_overview(db, user, platform)


@router.get("/achievements")
async def test_achievements(
    limit: int = Query(default=500, le=1000),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Досягнення з реальними відсотками та іконками зі Steam."""
    user = await _test_user(db)

    result = await db.execute(
        select(
            PlayerAchievement,
            Achievement,
            Game.name.label("game_name"),
            Game.platform_game_id,
            Game.platform,
            Game.img_icon_url,
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

    # Групуємо по app_id для батч-запитів
    app_ids = list(set(row[3] for row in rows))  # platform_game_id

    # Завантажуємо схеми та відсотки для всіх ігор
    schemas = {}
    percentages = {}
    for app_id in app_ids[:20]:  # обмежуємо кількість запитів
        schemas[app_id] = await _get_achievement_schema(app_id)
        percentages[app_id] = await _get_global_percentages(app_id)

    achievements = []
    games_stats = {}

    for pa, ach, game_name, game_pid, platform, img_url in rows:
        schema_data = schemas.get(game_pid, {}).get(ach.api_name, {})
        global_percent = percentages.get(game_pid, {}).get(ach.api_name)

        # Іконка досягнення зі Steam схеми
        ach_icon = schema_data.get("icon") or schema_data.get("icongray")

        # Відсоток — реальний зі Steam або розрахований
        if global_percent is not None:
            rarity_percent = global_percent
        else:
            rarity_percent = 50.0  # default якщо немає даних

        rarity_label = _rarity_from_percent(rarity_percent)

        achievements.append({
            "id": ach.id,
            "api_name": ach.api_name,
            "display_name": schema_data.get("displayName") or ach.display_name or ach.api_name,
            "description": schema_data.get("description") or ach.description or "",
            "icon_url": ach_icon,
            "game_icon": img_url,
            "game_name": game_name,
            "platform": platform,
            "platform_game_id": game_pid,
            "achieved": pa.achieved,
            "unlock_time": pa.unlock_time,
            "rarity_percent": rarity_percent,
            "rarity_label": rarity_label,
            "has_real_percent": global_percent is not None,
        })

        # Статистика по іграх
        if game_name not in games_stats:
            games_stats[game_name] = {
                "game_name": game_name,
                "platform": platform,
                "platform_game_id": game_pid,
                "game_icon": img_url,
                "total": 0,
                "achieved": 0,
            }
        games_stats[game_name]["total"] += 1
        if pa.achieved:
            games_stats[game_name]["achieved"] += 1

    achieved = sorted([a for a in achievements if a["achieved"]], key=lambda x: x["rarity_percent"])
    locked = sorted([a for a in achievements if not a["achieved"]], key=lambda x: x["rarity_percent"])

    games_list = sorted(
        [
            {**v, "percent": round(v["achieved"] / v["total"] * 100, 1) if v["total"] > 0 else 0}
            for v in games_stats.values() if v["total"] > 0
        ],
        key=lambda x: -x["percent"]
    )

    return {
        "total": len(achievements),
        "achieved_count": len(achieved),
        "locked_count": len(locked),
        "completion_percent": round(len(achieved) / len(achievements) * 100, 1) if achievements else 0,
        "achievements": achieved + locked,
        "games_stats": games_list,
    }


@router.get("/stats")
async def db_stats(db: AsyncSession = Depends(get_db)) -> dict:
    tables = ["users", "platform_connections", "games",
              "player_games", "achievements", "player_achievements", "bookmarks"]
    stats = {}
    for t in tables:
        r = await db.execute(text(f"SELECT COUNT(*) FROM {t}"))
        stats[t] = r.scalar()
    return stats

@router.get("/connection")
async def get_connection(db: AsyncSession = Depends(get_db)) -> dict:
    """Повертає поточне Steam підключення тестового юзера."""
    from app.models.platform import PlatformConnection
    user = await _test_user(db)
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == user.id,
            PlatformConnection.platform == "steam",
        ).limit(1)
    )
    conn = result.scalars().first()
    if not conn:
        return {"steam_id": None, "username": None}
    return {
        "steam_id": conn.platform_user_id,
        "username": conn.platform_username,
        "avatar": conn.avatar_url,
    }
