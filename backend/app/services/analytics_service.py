import logging
from collections import defaultdict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.platform import PlatformConnection, Game, PlayerGame, Achievement, PlayerAchievement
from app.models.user import User
from app.integrations.steam.client import steam_client

logger = logging.getLogger(__name__)

async def get_overview(db: AsyncSession, user: User, platform: str | None = None) -> dict:
    conns_res = await db.execute(
        select(PlatformConnection.platform).where(PlatformConnection.user_id == user.id)
    )
    active_platforms = conns_res.scalars().all()

    q = (
        select(PlayerGame)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .options(selectinload(PlayerGame.game))
        .where(PlatformConnection.user_id == user.id)
    )
    if platform:
        q = q.where(PlatformConnection.platform == platform)

    raw = (await db.execute(q)).scalars().all()

    seen, player_games = set(), []
    for pg in raw:
        if pg.game_id not in seen:
            seen.add(pg.game_id)
            player_games.append(pg)

    total_minutes  = sum(pg.playtime_minutes for pg in player_games)
    recent_minutes = sum(pg.playtime_2weeks_minutes for pg in player_games)
    total_ach      = sum(pg.achievement_count for pg in player_games)
    total_possible = sum(pg.achievement_total for pg in player_games)

    def fmt(pg):
        t = pg.achievement_total or 0
        return {
            "game_id":             pg.game.id,
            "platform_game_id":    pg.game.platform_game_id,
            "platform":            pg.game.platform,
            "name":                pg.game.name,
            "img_icon_url":        pg.game.img_icon_url,
            "playtime_hours":      round(pg.playtime_minutes / 60, 1),
            "playtime_2weeks_hours": round(pg.playtime_2weeks_minutes / 60, 1),
            "achievement_count":   pg.achievement_count,
            "achievement_total":   t,
            "achievement_percent": round(pg.achievement_count / t * 100, 1) if t > 0 else 0,
        }

    friends_list = []
    try:
        conn_res = await db.execute(
            select(PlatformConnection).where(
                PlatformConnection.user_id == user.id,
                PlatformConnection.platform == "steam"
            )
        )
        steam_conn = conn_res.scalars().first()
        if steam_conn and steam_conn.platform_user_id:
            friends_list = await steam_client.get_friends(steam_conn.platform_user_id)
    except Exception as e:
        logger.warning(f"Не вдалося отримати друзів: {e}")

    breakdown = defaultdict(lambda: {"games": 0, "hours": 0.0, "achievements": 0})
    for p in active_platforms:
        breakdown[p] = {"games": 0, "hours": 0.0, "achievements": 0}
        
    for pg in player_games:
        p = pg.game.platform
        breakdown[p]["games"]        += 1
        breakdown[p]["hours"]        += round(pg.playtime_minutes / 60, 1)
        breakdown[p]["achievements"] += pg.achievement_count

    top_games    = sorted(player_games, key=lambda x: x.playtime_minutes, reverse=True)[:15]
    recent_games = sorted([pg for pg in player_games if pg.playtime_2weeks_minutes > 0],
                          key=lambda x: x.playtime_2weeks_minutes, reverse=True)[:10]

    return {
        "connected_platforms":        active_platforms,
        "total_games":                len(player_games),
        "total_hours":                round(total_minutes / 60, 1),
        "recent_hours":               round(recent_minutes / 60, 1),
        "total_achievements":         total_ach,
        "total_possible_achievements": total_possible,
        "achievement_completion":     round(total_ach / total_possible * 100, 1) if total_possible > 0 else 0,
        "top_games":                  [fmt(pg) for pg in top_games],
        "recent_games":               [fmt(pg) for pg in recent_games],
        "friends":                    friends_list,
        "platforms_breakdown": [
            {"platform": k, "games": v["games"], "hours": v["hours"], "achievements": v["achievements"]}
            for k, v in sorted(breakdown.items(), key=lambda x: -x[1]["hours"])
        ],
    }

async def get_achievements_by_rarity(db: AsyncSession, user: User, limit: int = 100) -> list[dict]:
    pg_res = await db.execute(
        select(PlayerGame.id, PlayerGame.game_id)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .where(PlatformConnection.user_id == user.id)
    )
    pg_rows = pg_res.all()
    if not pg_rows:
        return []

    player_game_ids = [r[0] for r in pg_rows]

    game_owners_sub = (
        select(PlayerGame.game_id, func.count(PlayerGame.id.distinct()).label("cnt"))
        .group_by(PlayerGame.game_id)
        .subquery()
    )

    ach_owners_sub = (
        select(PlayerAchievement.achievement_id, func.count(PlayerAchievement.player_game_id.distinct()).label("cnt"))
        .where(PlayerAchievement.achieved == True)
        .group_by(PlayerAchievement.achievement_id)
        .subquery()
    )

    rows = (await db.execute(
        select(
            Achievement.id,
            Achievement.api_name,
            Achievement.display_name,
            Achievement.description,
            Achievement.icon_url,
            Achievement.game_id,
            Game.name.label("game_name"),
            Game.platform.label("game_platform"),
            Game.platform_game_id.label("platform_game_id"),
            Game.img_icon_url.label("game_icon"),
            PlayerAchievement.unlock_time,
            func.coalesce(ach_owners_sub.c.cnt, 0).label("ach_owners"),
            func.coalesce(game_owners_sub.c.cnt, 1).label("game_owners"),
        )
        .join(PlayerAchievement, PlayerAchievement.achievement_id == Achievement.id)
        .join(Game, Game.id == Achievement.game_id)
        .outerjoin(ach_owners_sub, ach_owners_sub.c.achievement_id == Achievement.id)
        .outerjoin(game_owners_sub, game_owners_sub.c.game_id == Achievement.game_id)
        .where(PlayerAchievement.player_game_id.in_(player_game_ids))
        .where(PlayerAchievement.achieved == True)
        .limit(limit)
    )).all()

    result = []
    for r in rows:
        rarity = round(min(max(r.ach_owners, 1) / max(r.game_owners, 1) * 100, 100.0), 1)
        unlock = r.unlock_time
        if unlock and hasattr(unlock, "isoformat"):
            unlock = unlock.isoformat()
        result.append({
            "id":               r.id,
            "api_name":         r.api_name,
            "display_name":     r.display_name or r.api_name,
            "description":      r.description or "",
            "icon_url":         r.icon_url,
            "game_id":          r.game_id,
            "game_name":        r.game_name,
            "game_icon":        r.game_icon,
            "platform":         r.game_platform,
            "platform_game_id": r.platform_game_id,
            "rarity_percent":   rarity,
            "rarity_label":     _rarity_label(rarity),
            "unlock_time":      unlock,
        })

    return sorted(result, key=lambda x: x["rarity_percent"])

async def get_game_achievements_for_user(
    db: AsyncSession, user: User, platform_game_id: str, platform: str = "steam"
) -> list[dict]:
    game_res = await db.execute(
        select(Game.id).where(Game.platform == platform, Game.platform_game_id == platform_game_id)
    )
    game_row = game_res.first()
    if not game_row:
        return []
    game_id = game_row[0]

    owners_cnt = (await db.execute(
        select(func.count(PlayerGame.id.distinct())).where(PlayerGame.game_id == game_id)
    )).scalar() or 1

    ach_owners_sub = (
        select(PlayerAchievement.achievement_id, func.count(PlayerAchievement.player_game_id.distinct()).label("cnt"))
        .where(PlayerAchievement.achieved == True)
        .group_by(PlayerAchievement.achievement_id)
        .subquery()
    )

    pg_ids = (await db.execute(
        select(PlayerGame.id)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .where(PlatformConnection.user_id == user.id, PlayerGame.game_id == game_id)
    )).scalars().all()

    if not pg_ids:
        return []

    rows = (await db.execute(
        select(
            Achievement.id,
            Achievement.api_name,
            Achievement.display_name,
            Achievement.description,
            Achievement.icon_url,
            PlayerAchievement.achieved,
            PlayerAchievement.unlock_time,
            func.coalesce(ach_owners_sub.c.cnt, 0).label("ach_owners"),
        )
        .join(PlayerAchievement, PlayerAchievement.achievement_id == Achievement.id)
        .outerjoin(ach_owners_sub, ach_owners_sub.c.achievement_id == Achievement.id)
        .where(Achievement.game_id == game_id)
        .where(PlayerAchievement.player_game_id.in_(pg_ids))
    )).all()

    seen, result = set(), []
    for r in rows:
        if r.id in seen:
            continue
        seen.add(r.id)
        rarity = round(min(max(r.ach_owners, 1) / max(owners_cnt, 1) * 100, 100.0), 1)
        unlock = r.unlock_time
        if unlock and hasattr(unlock, "isoformat"):
            unlock = unlock.isoformat()
        result.append({
            "id":             r.id,
            "api_name":       r.api_name,
            "display_name":   r.display_name or r.api_name,
            "description":    r.description or "",
            "icon_url":       r.icon_url,
            "achieved":       bool(r.achieved),
            "unlock_time":    unlock,
            "rarity_percent": rarity,
            "rarity_label":   _rarity_label(rarity),
        })

    return sorted(result, key=lambda x: (not x["achieved"], x["rarity_percent"]))

def _rarity_label(p: float) -> str:
    if p <= 5:  return "Legendary"
    if p <= 15: return "Epic"
    if p <= 30: return "Rare"
    if p <= 60: return "Uncommon"
    return "Common"