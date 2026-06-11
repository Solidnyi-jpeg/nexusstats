import logging
from typing import Union
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

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

async def close_store_client():
    """Закриває HTTP-клієнт при зупинці програми для уникнення витоку пам'яті."""
    await store_http_client.aclose()

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=1, max=5),
    retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
    reraise=True
)
async def _fetch_store_data(url: str, params: dict) -> httpx.Response:
    """Внутрішня функція з retry-логікою для запитів до Steam."""
    r = await store_http_client.get(url, params=params)
    r.raise_for_status()
    return r

async def get_game_details(app_id: Union[str, int]) -> dict:
    """Деталі гри зі Steam Store API."""
    app_id_str = str(app_id)
    cache_key = f"store:game:{app_id_str}"
    
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        r = await _fetch_store_data(
            f"{STEAM_STORE_API}/appdetails",
            params={"appids": app_id_str, "l": "english"}
        )
        data = r.json()
        game_data = data.get(app_id_str, {})
        
        if game_data.get("success"):
            result = game_data.get("data", {})
            await cache_set(cache_key, result, ttl=86400) # Кеш на 1 день
            return result
        else:
            logger.warning(f"Steam API returned success: False for app_id {app_id_str}")
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP помилка (код {e.response.status_code}) при запиті деталей гри {app_id_str}")
    except Exception as e:
        logger.error(f"Неочікувана помилка при запиті деталей гри {app_id_str}: {e}")
        
    return {}

async def get_game_news(app_id: Union[str, int], count: int = 5) -> list:
    """Останні новини гри зі Steam API."""
    app_id_str = str(app_id)
    cache_key = f"store:news:{app_id_str}"
    
    cached = await cache_get(cache_key)
    if cached:
        return cached

    try:
        r = await _fetch_store_data(
            f"{STEAM_API}/ISteamNews/GetNewsForApp/v2/",
            params={
                "appid": app_id_str,
                "count": count,
                "maxlength": 300,
                "format": "json",
            }
        )
        items = r.json().get("appnews", {}).get("newsitems", [])
        await cache_set(cache_key, items, ttl=3600) # Кеш на 1 годину
        return items
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP помилка (код {e.response.status_code}) при отриманні новин для {app_id_str}")
    except Exception as e:
        logger.error(f"Неочікувана помилка при отриманні новин {app_id_str}: {e}")
        
    return []