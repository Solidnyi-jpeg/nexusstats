import logging
import asyncio
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
        
        # Конвертуємо булеві значення (Steam очікує 1 або 0)
        for k, v in params.items():
            if isinstance(v, bool):
                params[k] = 1 if v else 0
        
        response = await self.client.get(url, params=params)
        
        # Обробка 400 (немає досягнень) та 403 (приватний профіль)
        if response.status_code in [400, 403, 404]:
            logger.warning(f"Steam API повернув {response.status_code} для {url}")
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
            logger.error(f"Помилка отримання даних зі Steam API {url}: {e}")
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

    async def get_owned_games(self, steam_id: str) -> list:
        data = await self.get(
            f"{STEAM_API}/IPlayerService/GetOwnedGames/v1/",
            {
                "steamid": steam_id,
                "include_appinfo": True,            
                "include_played_free_games": True,  
                "include_free_sub": True,           
                "skip_unvetted_apps": False         
            },
            cache_key=f"steam:owned_games:{steam_id}",
            ttl=1800
        )
        return data.get("response", {}).get("games", [])

    async def get_achievements(self, steam_id: str, app_id: int) -> List[Dict[str, Any]]:
        try:
            # 1. Отримуємо статус розблокування гравця
            player_data = await self.get(
                f"{STEAM_API}/ISteamUserStats/GetPlayerAchievements/v1/",
                {"steamid": steam_id, "appid": app_id},
                cache_key=f"steam:player_ach:{steam_id}:{app_id}",
                ttl=3600,
            )
            
            # Якщо даних немає або API повернуло помилку - повертаємо []
            if not player_data or "playerstats" not in player_data:
                return []
            
            player_achievements = player_data.get("playerstats", {}).get("achievements")
            if not player_achievements:
                return []

            # 2. Отримуємо схему гри
            schema_data = await self.get(
                f"{STEAM_API}/ISteamUserStats/GetSchemaForGame/v2/",
                {"appid": app_id},
                cache_key=f"steam:schema:{app_id}",
                ttl=86400, 
            )
            schema_achievements = schema_data.get("game", {}).get("availableGameStats", {}).get("achievements", [])

            # 3. Отримуємо глобальний відсоток розблокувань
            global_data = await self.get(
                f"{STEAM_API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/",
                {"gameid": app_id},
                cache_key=f"steam:global_ach:{app_id}",
                ttl=43200, 
            )
            global_achievements = global_data.get("achievementpercentages", {}).get("achievements", [])

            schema_map = {a["name"]: a for a in schema_achievements}
            global_map = {a["name"]: a.get("percent", 0.0) for a in global_achievements}

            merged = []
            for pa in player_achievements:
                api_name = pa.get("apiname")
                if not api_name: continue
                
                schema_info = schema_map.get(api_name, {})
                merged.append({
                    "apiname": api_name,
                    "achieved": pa.get("achieved", 0),
                    "unlocktime": pa.get("unlocktime", 0),
                    "displayName": schema_info.get("displayName", api_name),
                    "description": schema_info.get("description", ""),
                    "icon": schema_info.get("icon", ""),
                    "icongray": schema_info.get("icongray", ""),
                    "percent": global_map.get(api_name, 0.0)
                })
                
            return merged

        except Exception as e:
            # Тиха обробка для ігор, де Steam API дає помилку (500/400)
            logger.debug(f"Пропущено отримання ачівок для гри {app_id}: {e}")
            return []

    async def get_player_summaries(self, steam_ids: List[str]) -> List[Dict[str, Any]]:
        if not steam_ids: return []
        chunk_size = 100
        all_players = []
        for i in range(0, len(steam_ids), chunk_size):
            chunk = steam_ids[i:i + chunk_size]
            data = await self.get(
                f"{STEAM_API}/ISteamUser/GetPlayerSummaries/v2/",
                {"steamids": ",".join(chunk)},
            )
            all_players.extend(data.get("response", {}).get("players", []))
        return all_players

    async def get_friends(self, steam_id: str) -> List[Dict[str, Any]]:
        data = await self.get(
            f"{STEAM_API}/ISteamUser/GetFriendList/v1/",
            {"steamid": steam_id, "relationship": "friend"},
            cache_key=f"steam:friends:{steam_id}",
            ttl=3600,
        )
        friends = data.get("friendslist", {}).get("friends", [])
        if not friends: return []
            
        ids = [f["steamid"] for f in friends]
        summaries = await self.get_player_summaries(ids)
        friend_since_map = {f["steamid"]: f.get("friend_since") for f in friends}
        
        return [{**p, "friend_since": friend_since_map.get(p["steamid"])} for p in summaries]

steam_client = SteamClient()