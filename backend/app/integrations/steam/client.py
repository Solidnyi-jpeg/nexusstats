import asyncio
import logging
from typing import Any
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings
from app.core.redis import cache_get, cache_set

logger = logging.getLogger(__name__)
STEAM_API = "https://api.steampowered.com"


class SteamClient:
    def __init__(self):
        self.key = settings.steam_api_key

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=2, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
    )
    async def _get(self, url: str, params: dict) -> Any:
        params["key"] = self.key
        params["format"] = "json"
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()

    async def get(self, url: str, params: dict = {}, cache_key: str = None, ttl: int = 3600) -> Any:
        if cache_key:
            cached = await cache_get(cache_key)
            if cached:
                return cached
        result = await self._get(url, params)
        if cache_key and result:
            await cache_set(cache_key, result, ttl)
        return result

    async def get_player_summary(self, steam_id: str) -> dict:
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
            {"steamid": steam_id, "include_appinfo": True, "include_played_free_games": True},
            cache_key=f"steam:games:{steam_id}",
            ttl=1800,
        )
        return data.get("response", {}).get("games", [])

    async def get_achievements(self, steam_id: str, app_id: int) -> list:
        try:
            data = await self.get(
                f"{STEAM_API}/ISteamUserStats/GetPlayerAchievements/v1/",
                {"steamid": steam_id, "appid": app_id},
                cache_key=f"steam:ach:{steam_id}:{app_id}",
                ttl=3600,
            )
            return data.get("playerstats", {}).get("achievements", [])
        except Exception:
            return []

    async def search_by_vanity(self, vanity: str) -> str | None:
        try:
            data = await self.get(
                f"{STEAM_API}/ISteamUser/ResolveVanityURL/v1/",
                {"vanityurl": vanity},
            )
            r = data.get("response", {})
            return r.get("steamid") if r.get("success") == 1 else None
        except Exception:
            return None

    async def get_friends(self, steam_id: str) -> list:
        try:
            data = await self.get(
                f"{STEAM_API}/ISteamUser/GetFriendList/v1/",
                {"steamid": steam_id, "relationship": "friend"},
                cache_key=f"steam:friends:{steam_id}",
                ttl=3600,
            )
            friends = data.get("friendslist", {}).get("friends", [])
            if not friends:
                return []
            ids = [f["steamid"] for f in friends[:100]]
            summaries = await self.get_player_summaries(ids)
            friend_since = {f["steamid"]: f.get("friend_since") for f in friends}
            return [
                {**p, "friend_since": friend_since.get(p["steamid"])}
                for p in summaries
            ]
        except Exception:
            return []

    async def get_player_summaries(self, steam_ids: list[str]) -> list:
        data = await self.get(
            f"{STEAM_API}/ISteamUser/GetPlayerSummaries/v2/",
            {"steamids": ",".join(steam_ids)},
        )
        return data.get("response", {}).get("players", [])


steam_client = SteamClient()
