import httpx
from app.core.config import settings
from app.core.redis import cache_get, cache_set

STEAM_STORE_API = "https://store.steampowered.com/api"
STEAM_API = "https://api.steampowered.com"


async def get_game_details(app_id: str) -> dict:
    """Деталі гри зі Steam Store API."""
    cache_key = f"store:game:{app_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.get(
                f"{STEAM_STORE_API}/appdetails",
                params={"appids": app_id, "l": "english"},
            )
            r.raise_for_status()
            data = r.json()
            game_data = data.get(str(app_id), {})
            if game_data.get("success"):
                result = game_data.get("data", {})
                await cache_set(cache_key, result, ttl=86400)
                return result
        except Exception:
            pass
    return {}


async def get_game_news(app_id: str, count: int = 5) -> list:
    """Останні новини гри."""
    cache_key = f"store:news:{app_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(
                f"{STEAM_API}/ISteamNews/GetNewsForApp/v2/",
                params={
                    "appid": app_id,
                    "count": count,
                    "maxlength": 300,
                    "format": "json",
                },
            )
            r.raise_for_status()
            items = r.json().get("appnews", {}).get("newsitems", [])
            await cache_set(cache_key, items, ttl=3600)
            return items
        except Exception:
            return []
