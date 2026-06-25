import httpx
import asyncio
import logging
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

from app.services.steam_client import steam_client  # використовуємо готовий клієнт

logger = logging.getLogger(__name__)

DOTA_APP_ID = 570

GAME_MODE_NAMES: Dict[int, str] = {
    0:  "Unknown",
    1:  "All Pick",
    2:  "Captains Mode",
    3:  "Random Draft",
    4:  "Single Draft",
    5:  "All Random",
    7:  "Intro",
    8:  "Reverse Captains Mode",
    11: "Mid Only",
    12: "Least Played",
    15: "Co-op vs Bots",
    16: "Captains Draft",
    18: "Ability Draft",
    20: "All Random Deathmatch",
    21: "1v1 Mid",
    22: "All Draft / Ranked",
    23: "Turbo",
    24: "Mutation",
}


class OpenDotaClient:
    def __init__(self):
        self.base_url = "https://api.opendota.com/api"
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }
        self.default_timeout = httpx.Timeout(20.0, connect=5.0)
        self.long_timeout = httpx.Timeout(60.0, connect=5.0)

    def _get_account_id(self, steam_id64: str) -> int:
        return int(steam_id64) - 76561197960265728

    async def _get_dota_hours(self, steam_id64: str) -> Optional[float]:
        """
        Бере кількість годин у Dota 2 через вже існуючий steam_client.get_owned_games().
        Ніяких нових HTTP клієнтів — використовуємо готову логіку з кешем і ретраями.
        """
        try:
            games = await steam_client.get_owned_games(steam_id64)
            for game in games:
                if game.get("appid") == DOTA_APP_ID:
                    minutes = game.get("playtime_forever", 0)
                    return round(minutes / 60, 1)
        except Exception as e:
            logger.warning("Не вдалось отримати години Dota зі Steam: %s", e)
        return None

    async def _fetch_all_matches(
        self, client: httpx.AsyncClient, account_id: int
    ) -> List[Dict[str, Any]]:
        """
        Пагінація по 100 матчів до кінця історії.
        'project' обмежує поля — швидше і менше навантаження на API.
        """
        all_matches: List[Dict[str, Any]] = []
        offset = 0
        limit = 100
        max_pages = 100  # захист: максимум 10 000 матчів

        fields = (
            "match_id,hero_id,player_slot,radiant_win,"
            "kills,deaths,assists,duration,gold_per_min,xp_per_min,"
            "start_time,game_mode,lobby_type"
        )

        for _ in range(max_pages):
            resp = await client.get(
                f"{self.base_url}/players/{account_id}/matches",
                params={"limit": limit, "offset": offset, "project": fields},
                timeout=self.long_timeout,
            )

            if resp.status_code != 200:
                logger.warning(
                    "Пагінація матчів: статус %d на offset=%d", resp.status_code, offset
                )
                break

            batch: List[Dict[str, Any]] = resp.json()
            if not batch:
                break

            all_matches.extend(batch)

            if len(batch) < limit:
                break  # остання сторінка

            offset += limit
            await asyncio.sleep(0.2)  # щоб не перевищити rate limit OpenDota

        return all_matches

    def _process_matches(self, raw_matches: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Рахує всю статистику локально з отриманих матчів."""
        if not raw_matches:
            return {
                "total": 0,
                "wins": 0,
                "losses": 0,
                "recent_20": [],
                "factions": {
                    "radiant": {"games": 0, "win": 0},
                    "dire":    {"games": 0, "win": 0},
                },
                "top_modes":  [],
                "hero_stats": [],
            }

        wins = losses = 0
        radiant_games = radiant_wins = 0
        dire_games = dire_wins = 0
        mode_stats: Dict[int, Dict[str, int]] = {}
        hero_stats: Dict[int, Dict[str, int]] = {}
        processed: List[Dict[str, Any]] = []

        for m in raw_matches:
            is_radiant = m.get("player_slot", 0) < 128
            radiant_win = m.get("radiant_win", False)
            won = (is_radiant and radiant_win) or (not is_radiant and not radiant_win)

            if won:
                wins += 1
            else:
                losses += 1

            if is_radiant:
                radiant_games += 1
                if won:
                    radiant_wins += 1
            else:
                dire_games += 1
                if won:
                    dire_wins += 1

            mode_id = m.get("game_mode", 0)
            if mode_id not in mode_stats:
                mode_stats[mode_id] = {"games": 0, "win": 0}
            mode_stats[mode_id]["games"] += 1
            if won:
                mode_stats[mode_id]["win"] += 1

            hero_id = m.get("hero_id", 0)
            if hero_id:
                if hero_id not in hero_stats:
                    hero_stats[hero_id] = {
                        "games": 0, "win": 0,
                        "kills": 0, "deaths": 0, "assists": 0,
                    }
                hero_stats[hero_id]["games"] += 1
                hero_stats[hero_id]["kills"]   += m.get("kills", 0)
                hero_stats[hero_id]["deaths"]  += m.get("deaths", 0)
                hero_stats[hero_id]["assists"] += m.get("assists", 0)
                if won:
                    hero_stats[hero_id]["win"] += 1

            processed.append({
                "match_id":   m.get("match_id"),
                "hero_id":    hero_id,
                "won":        won,
                "kills":      m.get("kills", 0),
                "deaths":     m.get("deaths", 0),
                "assists":    m.get("assists", 0),
                "duration":   m.get("duration", 0),
                "gpm":        m.get("gold_per_min", 0),
                "xpm":        m.get("xp_per_min", 0),
                "start_time": m.get("start_time", 0),
                "game_mode":  mode_id,
            })

        top_modes = sorted(
            [
                {
                    "id":    mid,
                    "name":  GAME_MODE_NAMES.get(int(mid), f"Mode {mid}"),
                    "games": s["games"],
                    "win":   s["win"],
                }
                for mid, s in mode_stats.items()
            ],
            key=lambda x: x["games"],
            reverse=True,
        )[:4]

        top_heroes = sorted(
            [
                {
                    "hero_id": hid,
                    "games":   s["games"],
                    "win":     s["win"],
                    "winrate": round(s["win"] / s["games"] * 100, 1),
                    "avg_kda": round(
                        (s["kills"] + s["assists"]) / max(s["deaths"], 1) / s["games"], 2
                    ),
                }
                for hid, s in hero_stats.items()
            ],
            key=lambda x: x["games"],
            reverse=True,
        )[:10]

        return {
            "total":     len(raw_matches),
            "wins":      wins,
            "losses":    losses,
            "recent_20": processed[:20],
            "factions": {
                "radiant": {"games": radiant_games, "win": radiant_wins},
                "dire":    {"games": dire_games,    "win": dire_wins},
            },
            "top_modes":  top_modes,
            "hero_stats": top_heroes,
        }

    async def get_player_stats(self, steam_id64: str) -> Dict[str, Any]:
        account_id = self._get_account_id(steam_id64)

        async with httpx.AsyncClient(
            headers=self.headers, timeout=self.default_timeout
        ) as client:
            try:
                # fire-and-forget refresh
                try:
                    await client.post(
                        f"{self.base_url}/players/{account_id}/refresh",
                        timeout=2.0,
                    )
                except Exception:
                    pass

                # Профіль OpenDota і години зі Steam — паралельно
                profile_resp, steam_hours = await asyncio.gather(
                    client.get(f"{self.base_url}/players/{account_id}"),
                    self._get_dota_hours(steam_id64),   # <- steam_client всередині
                )

                if profile_resp.status_code in (500, 502, 503, 504, 522):
                    raise HTTPException(
                        status_code=503, detail="Сервери OpenDota перевантажені."
                    )
                if profile_resp.status_code == 404:
                    raise HTTPException(
                        status_code=404, detail="Профіль не знайдено."
                    )

                profile_data = profile_resp.json()

                # Повна пагінація матчів
                raw_matches = await self._fetch_all_matches(client, account_id)
                match_stats = self._process_matches(raw_matches)

                # Fallback: якщо пагінація нічого не дала (закритий профіль)
                if match_stats["total"] == 0:
                    wl_resp = await client.get(
                        f"{self.base_url}/players/{account_id}/wl"
                    )
                    if wl_resp.status_code == 200:
                        wl = wl_resp.json()
                        match_stats["wins"]   = wl.get("win", 0)
                        match_stats["losses"] = wl.get("lose", 0)
                        match_stats["total"]  = wl.get("win", 0) + wl.get("lose", 0)

                return {
                    "account_id":       account_id,
                    "rank_tier":        profile_data.get("rank_tier"),
                    "leaderboard_rank": profile_data.get("leaderboard_rank"),
                    "wins":             match_stats["wins"],
                    "losses":           match_stats["losses"],
                    "total_matches":    match_stats["total"],
                    "steam_hours":      steam_hours,
                    "factions":         match_stats["factions"],
                    "top_modes":        match_stats["top_modes"],
                    "recent_matches":   match_stats["recent_20"],
                    "hero_stats":       match_stats["hero_stats"],
                }

            except HTTPException:
                raise
            except httpx.HTTPStatusError as e:
                logger.error("HTTP помилка: %s", e)
                raise HTTPException(status_code=502, detail="Помилка стороннього API.")
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                logger.error("Таймаут/з'єднання: %s", e)
                raise HTTPException(
                    status_code=504, detail="Сервери Dota 2 не відповіли вчасно."
                )


opendota_client = OpenDotaClient()