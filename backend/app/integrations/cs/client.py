import httpx
import logging
from typing import Dict, Any
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)

class CounterStrikeClient:
    def __init__(self):
        self.url = "http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/"

    async def get_player_stats(self, steam_id64: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            try:
                params = {
                    "key": settings.steam_api_key,
                    "steamid": steam_id64,
                    "appid": 730
                }
                resp = await client.get(self.url, params=params)

                if resp.status_code in [400, 403]:
                    raise HTTPException(status_code=403, detail="Профіль Steam приховано або гру CS2 не знайдено на акаунті.")
                resp.raise_for_status()

                data = resp.json()
                raw_stats = data.get("playerstats", {}).get("stats", [])
                if not raw_stats:
                    raise HTTPException(status_code=404, detail="Статистика CS порожня.")

                sd = {s["name"]: s["value"] for s in raw_stats}

                # 1. Загальна статистика
                kills = sd.get("total_kills", 0)
                deaths = sd.get("total_deaths", 0)
                matches = sd.get("total_matches_played", 0)
                matches_won = sd.get("total_matches_won", 0)
                hs = sd.get("total_kills_headshot", 0)

                kd = round(kills / deaths, 2) if deaths > 0 else kills
                hs_percent = round((hs / kills) * 100, 1) if kills > 0 else 0
                winrate = round((matches_won / matches) * 100) if matches > 0 else 0

                map_names = ["de_dust2", "de_mirage", "de_inferno", "de_nuke", "de_overpass", "de_vertigo", "de_train", "de_ancient", "de_anubis"]
                maps = []
                for m in map_names:
                    r_played = sd.get(f"total_rounds_map_{m}", 0)
                    r_won = sd.get(f"total_wins_map_{m}", 0)
                    if r_played > 0:
                        clean_name = m.replace("de_", "").capitalize()
                        
                        # 🔥 ОНОВЛЕНА МАТЕМАТИКА: Ділимо на 10 (середнє значення для міксу режимів: Deathmatch, Wingman, Casual, Comp)
                        estimated_matches = max(1, round(r_played / 10))

                        maps.append({
                            "id": m.replace("de_", ""),
                            "name": clean_name,
                            "matches": estimated_matches,
                            "winrate": round((r_won / r_played) * 100)
                        })
                
                # Сортуємо по кількості зіграних матчів
                maps.sort(key=lambda x: x["matches"], reverse=True)

                # 3. Арсенал (Зброя)
                weapon_names = ["ak47", "m4a1", "awp", "deagle", "glock", "hkp2000", "usp_silencer", "mac10", "mp9", "ump45", "p90", "famas", "galilar", "ssg08"]
                weapon_display = {
                    "ak47": "AK-47", "m4a1": "M4A4 / M4A1-S", "awp": "AWP", "deagle": "Desert Eagle",
                    "glock": "Glock-18", "hkp2000": "P2000", "usp_silencer": "USP-S", "mac10": "MAC-10",
                    "mp9": "MP9", "ump45": "UMP-45", "p90": "P90", "famas": "FAMAS", "galilar": "Galil AR", "ssg08": "SSG 08"
                }
                
                weapons = []
                for w in weapon_names:
                    w_kills = sd.get(f"total_kills_{w}", 0)
                    w_shots = sd.get(f"total_shots_{w}", 0)
                    w_hits = sd.get(f"total_hits_{w}", 0)
                    if w_kills > 0:
                        weapons.append({
                            "id": w,
                            "name": weapon_display.get(w, w.upper()),
                            "kills": w_kills,
                            "shots": w_shots,
                            "hits": w_hits,
                            "accuracy": round((w_hits / w_shots) * 100) if w_shots > 0 else 0
                        })
                weapons.sort(key=lambda x: x["kills"], reverse=True)

                return {
                    "overall": {
                        "kills": kills, "deaths": deaths, "kd": kd,
                        "hs_percent": hs_percent, "matches": matches,
                        "winrate": winrate, "mvps": sd.get("total_mvps", 0)
                    },
                    "maps": maps[:6],
                    "weapons": weapons[:10]
                }
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Помилка CS API: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail="Внутрішня помилка обробки статистики CS.")

cs_client = CounterStrikeClient()