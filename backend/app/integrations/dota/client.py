import httpx
import logging
from typing import Dict, Any
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class OpenDotaClient:
    def __init__(self):
        self.base_url = "https://api.opendota.com/api"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    def _get_account_id(self, steam_id64: str) -> int:
        return int(steam_id64) - 76561197960265728

    async def get_player_stats(self, steam_id64: str) -> Dict[str, Any]:
        account_id = self._get_account_id(steam_id64)
        main_timeout = httpx.Timeout(15.0, connect=5.0)
        
        async with httpx.AsyncClient(headers=self.headers, timeout=main_timeout) as client:
            try:
                try:
                    await client.post(f"{self.base_url}/players/{account_id}/refresh", timeout=1.0)
                except Exception:
                    pass

                # 1. Профіль
                profile_resp = await client.get(f"{self.base_url}/players/{account_id}")
                if profile_resp.status_code in [522, 500, 502, 503, 504]:
                    raise HTTPException(status_code=503, detail="Сервери OpenDota перевантажені.")
                profile_data = profile_resp.json()

                # 2. Win/Loss
                wl_resp = await client.get(f"{self.base_url}/players/{account_id}/wl")
                wl_data = wl_resp.json()

                # 3. Останні 20 матчів
                matches_resp = await client.get(f"{self.base_url}/players/{account_id}/recentMatches")
                matches_data = matches_resp.json() if matches_resp.status_code == 200 else []

                # 4. 🔥 НОВЕ: Лічильники (Фракції, Режими)
                counts_resp = await client.get(f"{self.base_url}/players/{account_id}/counts")
                counts_data = counts_resp.json() if counts_resp.status_code == 200 else {}

                # Форматуємо статистику фракцій
                is_radiant = counts_data.get("is_radiant", {})
                radiant_stats = is_radiant.get("1", {"games": 0, "win": 0})
                dire_stats = is_radiant.get("0", {"games": 0, "win": 0})

                # Форматуємо режими гри (беремо топ-4 найпопулярніших)
                game_modes_raw = counts_data.get("game_mode", {})
                modes_list = [{"id": k, "games": v.get("games", 0), "win": v.get("win", 0)} for k, v in game_modes_raw.items()]
                modes_list.sort(key=lambda x: x["games"], reverse=True)
                top_modes = modes_list[:4]

                processed_matches = []
                for m in matches_data[:20]:
                    is_radiant_match = m.get("player_slot", 0) < 128
                    radiant_win = m.get("radiant_win", False)
                    won = (is_radiant_match and radiant_win) or (not is_radiant_match and not radiant_win)

                    processed_matches.append({
                        "match_id": m.get("match_id"),
                        "hero_id": m.get("hero_id"),
                        "won": won,
                        "kills": m.get("kills", 0),
                        "deaths": m.get("deaths", 0),
                        "assists": m.get("assists", 0),
                        "duration": m.get("duration", 0),
                        "gpm": m.get("gold_per_min", 0),
                        "xpm": m.get("xp_per_min", 0)
                    })

                return {
                    "account_id": account_id,
                    "rank_tier": profile_data.get("rank_tier"), 
                    "leaderboard_rank": profile_data.get("leaderboard_rank"),
                    "wins": wl_data.get("win", 0),
                    "losses": wl_data.get("lose", 0),
                    "total_matches": wl_data.get("win", 0) + wl_data.get("lose", 0),
                    "factions": {"radiant": radiant_stats, "dire": dire_stats},
                    "top_modes": top_modes,
                    "recent_matches": processed_matches
                }
                
            except httpx.HTTPStatusError as http_err:
                if http_err.response.status_code == 404:
                    raise HTTPException(status_code=404, detail="Профіль не знайдено.")
                raise HTTPException(status_code=502, detail="Помилка стороннього API.")
            except (httpx.TimeoutException, httpx.ConnectError):
                raise HTTPException(status_code=504, detail="Сервери Dota 2 не відповіли вчасно.")

opendota_client = OpenDotaClient()