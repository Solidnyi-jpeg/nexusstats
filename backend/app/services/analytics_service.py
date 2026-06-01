import logging
from collections import defaultdict
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.platform import (
    PlatformConnection, Game, PlayerGame,
    Achievement, PlayerAchievement
)
from app.models.user import User
from app.integrations.steam.client import steam_client

logger = logging.getLogger(__name__)

async def get_overview(db: AsyncSession, user: User, platform: str | None = None) -> dict:
    """Загальна аналітика по всіх або одній платформі з фільтрацією дублікатів сесій."""

    # 1. Визначаємо, які платформи користувач взагалі ПІДКЛЮЧИВ (фізично є в базі)
    active_conns_stmt = select(PlatformConnection.platform).where(PlatformConnection.user_id == user.id)
    active_conns_res = await db.execute(active_conns_stmt)
    active_platforms = active_conns_res.scalars().all()

    # 2. Отримуємо ігри з бази даних
    query = (
        select(PlayerGame)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .options(selectinload(PlayerGame.game))                
        .where(PlatformConnection.user_id == user.id)
    )
    if platform:
        query = query.where(PlatformConnection.platform == platform)

    result = await db.execute(query)
    raw_player_games = result.scalars().all()

    # ЗАХИСТ ВІД ДУБЛІКАТІВ СЕСІЙ: залишаємо лише один запис для кожної унікальної гри
    seen_game_ids = set()
    player_games = []
    for pg in raw_player_games:
        if pg.game_id not in seen_game_ids:
            seen_game_ids.add(pg.game_id)
            player_games.append(pg)

    total_games = len(player_games)
    total_minutes = sum(pg.playtime_minutes for pg in player_games)
    recent_minutes = sum(pg.playtime_2weeks_minutes for pg in player_games)
    
    total_achievements = sum(pg.achievement_count for pg in player_games)
    total_possible = sum(pg.achievement_total for pg in player_games)

    top_games = sorted(player_games, key=lambda x: x.playtime_minutes, reverse=True)[:15]
    recent_games = sorted(
        [pg for pg in player_games if pg.playtime_2weeks_minutes > 0],
        key=lambda x: x.playtime_2weeks_minutes,
        reverse=True,
    )[:10]

    def fmt_game(pg: PlayerGame) -> dict:
        total = pg.achievement_total if pg.achievement_total and pg.achievement_total > 0 else 0
        return {
            "game_id": pg.game.id,
            "platform_game_id": pg.game.platform_game_id,
            "platform": pg.game.platform,
            "name": pg.game.name,
            "img_icon_url": pg.game.img_icon_url,
            "playtime_hours": round(pg.playtime_minutes / 60, 1),
            "playtime_2weeks_hours": round(pg.playtime_2weeks_minutes / 60, 1),
            "achievement_count": pg.achievement_count,
            "achievement_total": total,
            "achievement_percent": round(pg.achievement_count / total * 100, 1) if total > 0 else 0,
        }

    friends_list = []
    try:
        conn_stmt = select(PlatformConnection).where(
            PlatformConnection.user_id == user.id, 
            PlatformConnection.platform == "steam"
        )
        conn_res = await db.execute(conn_stmt)
        steam_conn = conn_res.scalars().first()
        
        if steam_conn and steam_conn.platform_user_id:
            friends_list = await steam_client.get_friends(steam_conn.platform_user_id)
    except Exception as e:
        logger.warning(f"Не вдалося отримати список друзів Steam: {e}")

    platforms_breakdown = defaultdict(lambda: {"games": 0, "hours": 0.0, "achievements": 0})
    
    # Якщо платформа підключена, вона МАЄ бути у звіті, навіть з 0 ігор (захист race condition)
    for p in active_platforms:
        platforms_breakdown[p] = {"games": 0, "hours": 0.0, "achievements": 0}

    for pg in player_games:
        p = pg.game.platform
        platforms_breakdown[p]["games"] += 1
        platforms_breakdown[p]["hours"] += round(pg.playtime_minutes / 60, 1)
        platforms_breakdown[p]["achievements"] += pg.achievement_count

    return {
        "connected_platforms": active_platforms,
        "total_games": total_games,
        "total_hours": round(total_minutes / 60, 1),
        "recent_hours": round(recent_minutes / 60, 1),
        "total_achievements": total_achievements,
        "total_possible_achievements": total_possible,
        "achievement_completion": round(total_achievements / total_possible * 100, 1) if total_possible > 0 else 0,
        "top_games": [fmt_game(pg) for pg in top_games],
        "recent_games": [fmt_game(pg) for pg in recent_games],
        "friends": friends_list,
        "platforms_breakdown": [
            {"platform": k, **v}
            for k, v in sorted(platforms_breakdown.items(), key=lambda x: -x[1]["hours"])
        ],
    }


async def get_achievements_by_rarity(
    db: AsyncSession,
    user: User,
    limit: int = 50,
) -> list[dict]:
    """Оптимізоване під PostgreSQL та захищене від збоїв отримання глобальних досягнень."""
    
    pg_stmt = (
        select(PlayerGame.id, PlayerGame.game_id)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .where(PlatformConnection.user_id == user.id)
    )
    pg_res = await db.execute(pg_stmt)
    pg_rows = pg_res.all()
    
    player_game_ids = [row[0] for row in pg_rows]
    global_game_ids = [row[1] for row in pg_rows]
    
    if not player_game_ids:
        return []

    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 1

    owners_subquery = (
        select(
            PlayerAchievement.achievement_id,
            func.count(PlayerAchievement.id).label("owners_count")
        )
        .where(PlayerAchievement.achieved == True) # Чистий булевий тип для Postgres
        .group_by(PlayerAchievement.achievement_id)
        .subquery()
    )

    query = (
        select(
            Achievement.id,
            Achievement.api_name,
            Achievement.display_name,
            Achievement.description,
            Achievement.icon_url,
            Achievement.game_id,
            func.coalesce(Game.name, "Unknown Game").label("game_name"),
            func.coalesce(Game.platform, "steam").label("game_platform"),
            PlayerAchievement.achieved,
            PlayerAchievement.unlock_time,
            func.coalesce(owners_subquery.c.owners_count, 0).label("global_owners")
        )
        .join(PlayerAchievement, PlayerAchievement.achievement_id == Achievement.id)
        .outerjoin(Game, Game.id == Achievement.game_id)
        .outerjoin(owners_subquery, owners_subquery.c.achievement_id == Achievement.id)
        .where(
            or_(
                PlayerAchievement.player_game_id.in_(player_game_ids),
                PlayerAchievement.player_game_id.in_(global_game_ids)
            )
        )
        .where(PlayerAchievement.achieved == True)
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    achievements = []
    for row in rows:
        owners = row.global_owners if row.global_owners > 0 else 1
        rarity = round((owners / total_users) * 100, 1)

        u_time = row.unlock_time
        if u_time and hasattr(u_time, "isoformat"):
            u_time = u_time.isoformat()

        achievements.append({
            "id": row.id,
            "api_name": row.api_name,
            "display_name": row.display_name or row.api_name,
            "description": row.description or "",
            "icon_url": row.icon_url,
            "game_id": row.game_id,
            "game_name": row.game_name,
            "platform": row.game_platform,
            "rarity_percent": rarity,
            "rarity_label": _rarity_label(rarity),
            "unlock_time": u_time,
        })

    return sorted(achievements, key=lambda x: x["rarity_percent"])


async def get_game_achievements(db: AsyncSession, steam_id: str, game_id: str) -> list[dict]:
    """Супер-оптимізоване отримання досягнень гри без циклів та з захистом від дублікатів."""
    
    query = (
        select(
            Achievement.id,
            Achievement.api_name,
            Achievement.display_name,
            Achievement.description,
            Achievement.icon_url,
            PlayerAchievement.achieved,
            PlayerAchievement.unlock_time
        )
        .join(PlayerAchievement, PlayerAchievement.achievement_id == Achievement.id)
        .join(PlayerGame, PlayerGame.id == PlayerAchievement.player_game_id)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .join(Game, Game.id == Achievement.game_id)
        .where(PlatformConnection.platform_user_id == steam_id)
    )
    
    if game_id.isdigit():
        query = query.where(
            or_(
                Game.id == int(game_id), 
                Game.platform_game_id == str(game_id)
            )
        )
    else:
        query = query.where(Game.platform_game_id == str(game_id))

    result = await db.execute(query)
    rows = result.all()
    
    seen_achievements = set()
    achievements = []
    
    for row in rows:
        if row.id in seen_achievements:
            continue
        seen_achievements.add(row.id)
        
        u_time = row.unlock_time
        if u_time and hasattr(u_time, "isoformat"):
            u_time = u_time.isoformat()
            
        achievements.append({
            "id": row.id,
            "api_name": row.api_name,
            "display_name": row.display_name or row.api_name,
            "description": row.description or "",
            "icon_url": row.icon_url,
            "is_achieved": bool(row.achieved),
            "unlock_time": u_time
        })
        
    return sorted(achievements, key=lambda x: not x["is_achieved"])


def _rarity_label(p: float) -> str:
    if p <= 5:   return "Legendary"
    if p <= 15:  return "Epic"
    if p <= 30:  return "Rare"
    if p <= 60:  return "Uncommon"
    return "Common"