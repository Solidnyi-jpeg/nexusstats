import httpx
import logging
from typing import Dict, Any
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# STRATZ GraphQL endpoint
# Безкоштовний токен отримати на: https://stratz.com/api
# Без токена ліміт ~100 req/год; з токеном (після логіну на STRATZ) — 2000/год.
# ──────────────────────────────────────────────────────────────────────────────
STRATZ_GQL_URL = "https://api.stratz.com/graphql"

# Мапа rank_tier → назва медалі (той самий формат що Dotabuff/OpenDota)
RANK_NAMES = {
    0:  "Uncalibrated",
    10: "Herald I",   11: "Herald II",   12: "Herald III",   13: "Herald IV",   14: "Herald V",
    20: "Guardian I", 21: "Guardian II", 22: "Guardian III", 23: "Guardian IV", 24: "Guardian V",
    30: "Crusader I", 31: "Crusader II", 32: "Crusader III", 33: "Crusader IV", 34: "Crusader V",
    40: "Archon I",   41: "Archon II",   42: "Archon III",   43: "Archon IV",   44: "Archon V",
    50: "Legend I",   51: "Legend II",   52: "Legend III",   53: "Legend IV",   54: "Legend V",
    60: "Ancient I",  61: "Ancient II",  62: "Ancient III",  63: "Ancient IV",  64: "Ancient V",
    70: "Divine I",   71: "Divine II",   72: "Divine III",   73: "Divine IV",   74: "Divine V",
    80: "Immortal",
}

# ──────────────────────────────────────────────────────────────────────────────
# GraphQL-запит — один єдиний виклик замість 4–5 REST-запитів до OpenDota
# ──────────────────────────────────────────────────────────────────────────────
PLAYER_QUERY = """
query PlayerStats($steamAccountId: Long!, $matchLimit: Int!) {
  player(steamAccountId: $steamAccountId) {
    steamAccount {
      name
      avatar
      profileUri
      isAnonymous
    }
    matchCount
    winCount
    rank

    # Статистика по кожному герою (всі зіграні)
    heroesPerformance {
      hero {
        id
        displayName
        shortName
      }
      matchCount
      winCount
      avgKills
      avgDeaths
      avgAssists
      avgGoldPerMinute
      avgExperiencePerMinute
      lastPlayedDateTime
    }

    # Останні N матчів з датою та деталями
    matches(request: { take: $matchLimit }) {
      id
      startDateTime
      durationSeconds
      didRadiantWin
      gameMode
      lobbyType
      players(steamAccountId: $steamAccountId) {
        isRadiant
        kills
        deaths
        assists
        goldPerMinute
        experiencePerMinute
        networth
        heroId
        hero {
          displayName
          shortName
        }
        award
      }
    }
  }
}
"""

# Назви ігрових режимів за їх числовим id (STRATZ повертає int)
GAME_MODE_NAMES: Dict[int, str] = {
    1:  "All Pick",
    2:  "Captains Mode",
    3:  "Random Draft",
    4:  "Single Draft",
    5:  "All Random",
    6:  "Intro",
    7:  "Diretide",
    8:  "Reverse CM",
    9:  "Greeviling",
    10: "Tutorial",
    11: "Mid Only",
    12: "Least Played",
    13: "Limited Heroes",
    14: "Compendium",
    15: "Custom",
    16: "Captains Draft",
    17: "Balanced Draft",
    18: "Ability Draft",
    19: "Event",
    20: "All Random DM",
    21: "1v1 Mid",
    22: "All Draft",   # Ranked All Pick
    23: "Turbo",
    24: "Mutation",
    25: "Coach",
}

LOBBY_NAMES: Dict[int, str] = {
    0: "Normal",
    1: "Practice",
    2: "Tournament",
    5: "Team Match",
    6: "Solo Queue",
    7: "Ranked",
    8: "Solo Mid",
    9: "Battle Cup",
}


def _rank_name(rank_tier: int | None) -> str:
    if rank_tier is None:
        return "Unknown"
    return RANK_NAMES.get(rank_tier, f"Rank {rank_tier}")


class StratzClient:
    """
    Клієнт до STRATZ GraphQL API.

    Один GraphQL-запит замінює 4–5 REST-запитів до OpenDota і повертає:
      - нік та аватар
      - загальна кількість матчів / перемог / поразок / winrate
      - медаль (rank_tier → назва)
      - статистику по кожному зіграному герою:
          назва героя, зіграно, перемог, winrate, KDA середнє, GPM, XPM,
          дата останньої гри з цим героєм
      - останні N матчів (за замовчуванням 20):
          id матчу, дата/час початку, тривалість, режим, фракція, результат,
          назва героя, K/D/A, GPM, XPM, нетворт
    """

    def __init__(self, api_token: str | None = None):
        """
        api_token — JWT-токен з https://stratz.com/api
        Без токена API працює, але ліміт менший (~100 req/год).
        """
        self.headers = {
            "Content-Type": "application/json",
            "User-Agent": "MyDotaApp/1.0",
        }
        if api_token:
            self.headers["Authorization"] = f"Bearer {api_token}"

    @staticmethod
    def _steam64_to_account_id(steam_id64: str) -> int:
        """SteamID64 → Dota2 account_id (той самий метод що був в OpenDotaClient)."""
        return int(steam_id64) - 76561197960265728

    async def get_player_stats(
        self,
        steam_id64: str,
        match_limit: int = 20,
    ) -> Dict[str, Any]:
        account_id = self._steam64_to_account_id(steam_id64)

        payload = {
            "query": PLAYER_QUERY,
            "variables": {
                "steamAccountId": account_id,
                "matchLimit": match_limit,
            },
        }

        timeout = httpx.Timeout(20.0, connect=5.0)
        async with httpx.AsyncClient(headers=self.headers, timeout=timeout) as client:
            try:
                resp = await client.post(STRATZ_GQL_URL, json=payload)
            except httpx.TimeoutException:
                raise HTTPException(
                    status_code=504,
                    detail="Сервери STRATZ не відповіли вчасно.",
                )
            except httpx.ConnectError:
                raise HTTPException(
                    status_code=504,
                    detail="Не вдалося підключитися до STRATZ.",
                )

            if resp.status_code in (500, 502, 503, 522):
                raise HTTPException(
                    status_code=503,
                    detail="Сервери STRATZ перевантажені.",
                )
            if resp.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Перевищено ліміт запитів до STRATZ. Спробуйте пізніше.",
                )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"STRATZ повернув статус {resp.status_code}.",
                )

            data = resp.json()

        # GraphQL може повернути errors навіть при HTTP 200
        if "errors" in data:
            msgs = [e.get("message", "") for e in data["errors"]]
            logger.error("STRATZ GraphQL errors: %s", msgs)
            if any("not found" in m.lower() or "does not exist" in m.lower() for m in msgs):
                raise HTTPException(status_code=404, detail="Профіль не знайдено.")
            raise HTTPException(status_code=502, detail=f"STRATZ API помилка: {msgs[0]}")

        player = (data.get("data") or {}).get("player")
        if not player:
            raise HTTPException(status_code=404, detail="Профіль не знайдено або закритий.")

        steam = player.get("steamAccount") or {}
        rank_tier = player.get("rank")
        total_matches = player.get("matchCount", 0)
        wins = player.get("winCount", 0)
        losses = total_matches - wins

        # ── Статистика по героях ─────────────────────────────────────────────
        heroes_raw = player.get("heroesPerformance") or []
        heroes = []
        for h in heroes_raw:
            hero_info = h.get("hero") or {}
            m = h.get("matchCount", 0)
            w = h.get("winCount", 0)
            heroes.append({
                "hero_id":          hero_info.get("id"),
                "hero_name":        hero_info.get("displayName", "Unknown"),
                "hero_short_name":  hero_info.get("shortName", ""),
                # URL зображення героя (Dotabuff-style через CDN STRATZ)
                "hero_img_url": (
                    f"https://cdn.stratz.com/images/dota2/heroes/"
                    f"{hero_info.get('shortName', '')}_horz.png"
                ),
                "match_count":      m,
                "win_count":        w,
                "loss_count":       m - w,
                # winrate у відсотках, округлений до 1 знаку після коми
                "winrate_pct":      round(w / m * 100, 1) if m > 0 else 0.0,
                "avg_kills":        round(h.get("avgKills") or 0, 2),
                "avg_deaths":       round(h.get("avgDeaths") or 0, 2),
                "avg_assists":      round(h.get("avgAssists") or 0, 2),
                "avg_gpm":          round(h.get("avgGoldPerMinute") or 0),
                "avg_xpm":          round(h.get("avgExperiencePerMinute") or 0),
                # Unix timestamp → залишаємо як є, фронт сам форматує
                "last_played_ts":   h.get("lastPlayedDateTime"),
            })
        # Сортуємо: спочатку найбільш зіграні
        heroes.sort(key=lambda x: x["match_count"], reverse=True)

        # ── Останні матчі ────────────────────────────────────────────────────
        matches_raw = player.get("matches") or []
        recent_matches = []
        for m in matches_raw:
            # Дані гравця всередині матчу (STRATZ фільтрує по steamAccountId)
            player_slot = (m.get("players") or [{}])[0]
            is_radiant = player_slot.get("isRadiant", True)
            radiant_won = m.get("didRadiantWin", False)
            won = (is_radiant and radiant_won) or (not is_radiant and not radiant_won)

            hero_info = player_slot.get("hero") or {}
            game_mode_id = m.get("gameMode") or 0
            lobby_type_id = m.get("lobbyType") or 0

            recent_matches.append({
                "match_id":         m.get("id"),
                # Unix timestamp початку матчу — зручно форматувати на фронті
                "start_datetime_ts": m.get("startDateTime"),
                "duration_seconds": m.get("durationSeconds", 0),
                "game_mode_id":     game_mode_id,
                "game_mode_name":   GAME_MODE_NAMES.get(game_mode_id, f"Mode {game_mode_id}"),
                "lobby_type_id":    lobby_type_id,
                "lobby_type_name":  LOBBY_NAMES.get(lobby_type_id, f"Lobby {lobby_type_id}"),
                "is_radiant":       is_radiant,
                "won":              won,
                "hero_id":          player_slot.get("heroId"),
                "hero_name":        hero_info.get("displayName", "Unknown"),
                "hero_short_name":  hero_info.get("shortName", ""),
                "hero_img_url": (
                    f"https://cdn.stratz.com/images/dota2/heroes/"
                    f"{hero_info.get('shortName', '')}_horz.png"
                ),
                "kills":            player_slot.get("kills", 0),
                "deaths":           player_slot.get("deaths", 0),
                "assists":          player_slot.get("assists", 0),
                "gpm":              player_slot.get("goldPerMinute", 0),
                "xpm":              player_slot.get("experiencePerMinute", 0),
                "networth":         player_slot.get("networth", 0),
                # MVP / Top Player award: 0=none, 1=MVP, 2=Top Core, 3=Top Support
                "award":            player_slot.get("award", 0),
            })

        return {
            # ── Загальна інформація ──────────────────────────────────────────
            "account_id":       account_id,
            "steam_name":       steam.get("name", ""),
            "avatar_url":       steam.get("avatar", ""),
            "profile_url":      steam.get("profileUri", ""),
            "is_anonymous":     steam.get("isAnonymous", False),
            # ── Ранг ─────────────────────────────────────────────────────────
            "rank_tier":        rank_tier,
            "rank_name":        _rank_name(rank_tier),
            # ── Загальна статистика ──────────────────────────────────────────
            "total_matches":    total_matches,
            "wins":             wins,
            "losses":           losses,
            "winrate_pct":      round(wins / total_matches * 100, 1) if total_matches > 0 else 0.0,
            # ── Герої (всі) ──────────────────────────────────────────────────
            "heroes":           heroes,
            # ── Останні матчі ────────────────────────────────────────────────
            "recent_matches":   recent_matches,
        }


# ──────────────────────────────────────────────────────────────────────────────
# Глобальний екземпляр (аналог opendota_client)
# Передайте STRATZ_API_TOKEN з env-змінної для вищого ліміту запитів.
# ──────────────────────────────────────────────────────────────────────────────
import os

stratz_client = StratzClient(api_token=os.getenv("STRATZ_API_TOKEN"))