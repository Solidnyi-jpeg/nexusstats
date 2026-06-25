import httpx
import asyncio
import logging
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Назви ігрових режимів Dota 2
GAME_MODE_NAMES: Dict[int, str] = {
    0:  "Unknown",
    1:  "All Pick",
    2:  "Captains Mode",
    3:  "Random Draft",
    4:  "Single Draft",
    5:  "All Random",
    7:  "Intro",
    8:  "Reverse Captains Mode",
    9:  "Greeviling",
    10: "Tutorial",
    11: "Mid Only",
    12: "Least Played",
    13: "New Player Pool",
    14: "Compendium Matchmaking",
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
    def __init__(self, steam_api_key: Optional[str] = None):
        self.base_url = "https://api.opendota.com/api"
        self.steam_api_url = "https://api.steampowered.com"
        self.steam_api_key = "BE45BD11F5449F47B481EE81F6025D71"  
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }
        # Таймаути: 20 сек на звичайні запити, 60 сек на пагінацію всіх матчів
        self.default_timeout = httpx.Timeout(20.0, connect=5.0)
        self.long_timeout = httpx.Timeout(60.0, connect=5.0)

    def _get_account_id(self, steam_id64: str) -> int:
        """Конвертує Steam ID64 у AccountID (32-bit)."""
        return int(steam_id64) - 76561197960265728

    async def _fetch_all_matches(
        self, client: httpx.AsyncClient, account_id: int
    ) -> List[Dict[str, Any]]:
        """
        Отримує ВСЮ історію матчів через пагінацію.

        OpenDota повертає максимум 100 матчів за запит.
        Ми робимо запити зі зміщенням (offset) поки не отримаємо
        порожню відповідь або менше 100 матчів (кінець списку).

        Параметри запиту:
          - limit=100       — максимум за один запит
          - offset=N        — зміщення для пагінації
          - project=...     — тільки потрібні поля (швидше і менше трафіку)
        """
        all_matches: List[Dict[str, Any]] = []
        offset = 0
        limit = 100
        max_iterations = 100  # захист: не більше 10 000 матчів за раз

        fields = (
            "match_id,hero_id,player_slot,radiant_win,"
            "kills,deaths,assists,duration,gold_per_min,xp_per_min,"
            "start_time,game_mode,lobby_type"
        )

        for _ in range(max_iterations):
            resp = await client.get(
                f"{self.base_url}/players/{account_id}/matches",
                params={
                    "limit": limit,
                    "offset": offset,
                    "project": fields,
                },
                timeout=self.long_timeout,
            )

            if resp.status_code != 200:
                logger.warning(
                    "Помилка пагінації матчів: статус %d, offset=%d",
                    resp.status_code, offset
                )
                break

            batch: List[Dict[str, Any]] = resp.json()
            if not batch:
                break  # більше матчів немає

            all_matches.extend(batch)

            if len(batch) < limit:
                break  # остання сторінка — менше ніж limit записів

            offset += limit
            # Невелика пауза щоб не перевантажувати API (rate limit ~60 req/min)
            await asyncio.sleep(0.2)

        return all_matches

    async def _fetch_steam_hours(
        self, client: httpx.AsyncClient, steam_id64: str
    ) -> Optional[int]:
        """
        Отримує кількість годин у Dota 2 зі Steam Web API.
        AppID Dota 2 = 570.
        Повертає None якщо профіль закритий або ключ відсутній.
        """
        if not self.steam_api_key:
            return None

        try:
            resp = await client.get(
                f"{self.steam_api_url}/IPlayerService/GetOwnedGames/v1/",
                params={
                    "key": self.steam_api_key,
                    "steamid": steam_id64,
                    "include_appinfo": 0,
                    "include_played_free_games": 1,
                    "appids_filter[0]": 570,  # Dota 2
                },
                timeout=self.default_timeout,
            )
            if resp.status_code != 200:
                return None

            games = resp.json().get("response", {}).get("games", [])
            if games:
                minutes = games[0].get("playtime_forever", 0)
                return round(minutes / 60, 1)  # конвертуємо у години
        except Exception as e:
            logger.warning("Steam API недоступний: %s", e)

        return None

    def _process_matches(
        self, raw_matches: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Обробляє список матчів і рахує всю необхідну статистику.
        Повертає dict з агрегованими даними.
        """
        if not raw_matches:
            return {
                "total": 0,
                "wins": 0,
                "losses": 0,
                "recent_20": [],
                "factions": {"radiant": {"games": 0, "win": 0}, "dire": {"games": 0, "win": 0}},
                "top_modes": [],
                "hero_stats": [],
            }

        wins = 0
        losses = 0
        radiant_games = radiant_wins = 0
        dire_games = dire_wins = 0
        mode_stats: Dict[int, Dict[str, int]] = {}
        hero_stats: Dict[int, Dict[str, int]] = {}

        processed: List[Dict[str, Any]] = []

        for m in raw_matches:
            is_radiant = m.get("player_slot", 0) < 128
            radiant_win = m.get("radiant_win", False)
            won = (is_radiant and radiant_win) or (not is_radiant and not radiant_win)

            # Win/Loss
            if won:
                wins += 1
            else:
                losses += 1

            # Фракції
            if is_radiant:
                radiant_games += 1
                if won:
                    radiant_wins += 1
            else:
                dire_games += 1
                if won:
                    dire_wins += 1

            # Режими гри
            mode_id = m.get("game_mode", 0)
            if mode_id not in mode_stats:
                mode_stats[mode_id] = {"games": 0, "win": 0}
            mode_stats[mode_id]["games"] += 1
            if won:
                mode_stats[mode_id]["win"] += 1

            # Статистика по героях
            hero_id = m.get("hero_id", 0)
            if hero_id:
                if hero_id not in hero_stats:
                    hero_stats[hero_id] = {"games": 0, "win": 0, "kills": 0, "deaths": 0, "assists": 0}
                hero_stats[hero_id]["games"] += 1
                hero_stats[hero_id]["kills"] += m.get("kills", 0)
                hero_stats[hero_id]["deaths"] += m.get("deaths", 0)
                hero_stats[hero_id]["assists"] += m.get("assists", 0)
                if won:
                    hero_stats[hero_id]["win"] += 1

            processed.append({
                "match_id":   m.get("match_id"),
                "hero_id":    m.get("hero_id"),
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

        # Топ-4 режими за кількістю ігор
        top_modes = sorted(
            [
                {
                    "id":    mode_id,
                    "name":  GAME_MODE_NAMES.get(int(mode_id), f"Mode {mode_id}"),
                    "games": stats["games"],
                    "win":   stats["win"],
                }
                for mode_id, stats in mode_stats.items()
            ],
            key=lambda x: x["games"],
            reverse=True,
        )[:4]

        # Топ-10 героїв за кількістю ігор
        top_heroes = sorted(
            [
                {
                    "hero_id":  hid,
                    "games":    s["games"],
                    "win":      s["win"],
                    "winrate":  round(s["win"] / s["games"] * 100, 1) if s["games"] else 0,
                    "avg_kda":  round(
                        (s["kills"] + s["assists"]) / max(s["deaths"], 1) / s["games"], 2
                    ) if s["games"] else 0,
                }
                for hid, s in hero_stats.items()
            ],
            key=lambda x: x["games"],
            reverse=True,
        )[:10]

        return {
            "total":   len(raw_matches),
            "wins":    wins,
            "losses":  losses,
            # Останні 20 для відображення у стрічці
            "recent_20": processed[:20],
            "factions": {
                "radiant": {"games": radiant_games, "win": radiant_wins},
                "dire":    {"games": dire_games,    "win": dire_wins},
            },
            "top_modes":  top_modes,
            "hero_stats": top_heroes,
        }

    async def get_player_stats(self, steam_id64: str) -> Dict[str, Any]:
        """
        Головний метод. Виконує всі запити паралельно де можливо,
        і повертає повну статистику гравця.
        """
        account_id = self._get_account_id(steam_id64)

        async with httpx.AsyncClient(
            headers=self.headers, timeout=self.default_timeout
        ) as client:
            try:
                # Тригеримо оновлення профілю (fire-and-forget)
                try:
                    await client.post(
                        f"{self.base_url}/players/{account_id}/refresh",
                        timeout=2.0,
                    )
                except Exception:
                    pass

                # ── Паралельні запити: профіль + steam_hours ──────────────────
                profile_task = client.get(f"{self.base_url}/players/{account_id}")
                steam_task = self._fetch_steam_hours(client, steam_id64)

                profile_resp, steam_hours = await asyncio.gather(
                    profile_task, steam_task
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

                # ── Повна історія матчів через пагінацію ──────────────────────
                raw_matches = await self._fetch_all_matches(client, account_id)
                match_stats = self._process_matches(raw_matches)

                # ── Додаткові дані: counts (режими/фракції з боку OpenDota) ───
                # Використовуємо як fallback якщо пагінація не принесла матчі
                # (закритий профіль або API-ліміт)
                if match_stats["total"] == 0:
                    counts_resp = await client.get(
                        f"{self.base_url}/players/{account_id}/counts"
                    )
                    if counts_resp.status_code == 200:
                        counts_data = counts_resp.json()
                        is_radiant = counts_data.get("is_radiant", {})
                        match_stats["factions"] = {
                            "radiant": is_radiant.get("1", {"games": 0, "win": 0}),
                            "dire":    is_radiant.get("0", {"games": 0, "win": 0}),
                        }
                        # wins/losses з wl endpoint як останній fallback
                        wl_resp = await client.get(
                            f"{self.base_url}/players/{account_id}/wl"
                        )
                        if wl_resp.status_code == 200:
                            wl = wl_resp.json()
                            match_stats["wins"] = wl.get("win", 0)
                            match_stats["losses"] = wl.get("lose", 0)
                            match_stats["total"] = (
                                wl.get("win", 0) + wl.get("lose", 0)
                            )

                return {
                    "account_id":       account_id,
                    "rank_tier":        profile_data.get("rank_tier"),
                    "leaderboard_rank": profile_data.get("leaderboard_rank"),
                    # Матчі — з пагінації (реальне число)
                    "wins":             match_stats["wins"],
                    "losses":           match_stats["losses"],
                    "total_matches":    match_stats["total"],
                    # Години — зі Steam API (якщо є ключ), інакше None
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