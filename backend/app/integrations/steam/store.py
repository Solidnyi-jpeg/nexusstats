import logging
import httpx
from app.core.config import settings
from app.core.redis import cache_get, cache_set

logger = logging.getLogger(__name__)

STEAM_STORE_API = "https://store.steampowered.com/api"
STEAM_API = "https://api.steampowered.com"

# Ініціалізація клієнта з додаванням User-Agent
store_http_client = httpx.AsyncClient(
    timeout=15.0,
    headers={"User-Agent": "NexusStats-Backend/1.0"}
)

async def get_game_details(app_id: str) -> dict:
    """Деталі гри зі Steam Store API."""
    cache_key = f"store:game:{app_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        r = await store_http_client.get(
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
        else:
            logger.warning(f"Steam API returned success: False for app_id {app_id}")
            
    except httpx.HTTPError as e:
        logger.error(f"HTTP помилка при запиті деталей гри {app_id}: {e}")
    except Exception as e:
        logger.error(f"Неочікувана помилка при запиті деталей гри {app_id}: {e}")
        
    return {}


async def get_game_news(app_id: str, count: int = 5) -> list:
    """Останні новини гри зі Steam API."""
    cache_key = f"store:news:{app_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        r = await store_http_client.get(
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
    except httpx.HTTPError as e:
        logger.error(f"HTTP помилка при отриманні новин для {app_id}: {e}")
    except Exception as e:
        logger.error(f"Неочікувана помилка при отриманні новин {app_id}: {e}")
        
    return []