import logging
from typing import Any, Dict, List, Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings
from app.core.redis import cache_get, cache_set

logger = logging.getLogger(__name__)
STEAM_API = "https://api.steampowered.com"

class SteamClient:
    def __init__(self):
        self.key = settings.steam_api_key
        # Додаємо User-Agent для запобігання блокуванням
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={"User-Agent": "NexusStats-Backend/1.0"}
        )

    async def close(self):
        await self.client.aclose()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=2, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
        reraise=True
    )
    async def _get(self, url: str, params: Dict[str, Any]) -> Any:
        params.update({"key": self.key, "format": "json"})
        
        response = await self.client.get(url, params=params)
        
        # Обробка 400 (немає досягнень) та 403 (приватний профіль) на рівні логіки
        if response.status_code in [400, 403, 404]:
            logger.warning(f"Steam API returned {response.status_code} for {url}")
            return None
            
        response.raise_for_status()
        return response.json()

    async def get(self, url: str, params: Dict[str, Any] = None, cache_key: str = None, ttl: int = 3600) -> Any:
        if cache_key:
            cached = await cache_get(cache_key)
            if cached:
                return cached

        try:
            result = await self._get(url, params or {})
            if cache_key and result:
                await cache_set(cache_key, result, ttl)
            return result or {}
        except Exception as e:
            logger.error(f"Error fetching data from Steam API {url}: {e}")
            return {}

    async def get_player_summary(self, steam_id: str) -> Dict[str, Any]:
        data = await self.get(
            f"{STEAM_API}/ISteamUser/GetPlayerSummaries/v2/",
            {"steamids": steam_id},
            cache_key=f"steam:summary:{steam_id}",
            ttl=1800,
        )
        players = data.get("response", {}).get("players", [])
        return players[0] if players else {}

    async def get_owned_games(self, steam_id: str) -> List[Dict[str, Any]]:
        data = await self.get(
            f"{STEAM_API}/IPlayerService/GetOwnedGames/v1/",
            {"steamid": steam_id, "include_appinfo": True, "include_played_free_games": True},
            cache_key=f"steam:games:{steam_id}",
            ttl=1800,
        )
        return data.get("response", {}).get("games", [])

    async def get_achievements(self, steam_id: str, app_id: int) -> List[Dict[str, Any]]:
        data = await self.get(
            f"{STEAM_API}/ISteamUserStats/GetPlayerAchievements/v1/",
            {"steamid": steam_id, "appid": app_id},
            cache_key=f"steam:ach:{steam_id}:{app_id}",
            ttl=3600,
        )
        return data.get("playerstats", {}).get("achievements", [])

    async def get_player_summaries(self, steam_ids: List[str]) -> List[Dict[str, Any]]:
        if not steam_ids: return []
        data = await self.get(
            f"{STEAM_API}/ISteamUser/GetPlayerSummaries/v2/",
            {"steamids": ",".join(steam_ids)},
        )
        return data.get("response", {}).get("players", [])

    async def get_friends(self, steam_id: str) -> List[Dict[str, Any]]:
        data = await self.get(
            f"{STEAM_API}/ISteamUser/GetFriendList/v1/",
            {"steamid": steam_id, "relationship": "friend"},
            cache_key=f"steam:friends:{steam_id}",
            ttl=3600,
        )
        friends = data.get("friendslist", {}).get("friends", [])
        if not friends:
            return []
            
        # Оптимізація: беремо перші 100, щоб не робити занадто довгий запит
        ids = [f["steamid"] for f in friends[:100]]
        summaries = await self.get_player_summaries(ids)
        
        # Мапінг дати дружби
        friend_since_map = {f["steamid"]: f.get("friend_since") for f in friends}
        
        return [
            {**p, "friend_since": friend_since_map.get(p["steamid"])}
            for p in summaries
        ]

steam_client = SteamClient()