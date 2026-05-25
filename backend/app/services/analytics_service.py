from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import sqlalchemy as sa

from app.models.platform import (
    PlatformConnection, Game, PlayerGame,
    Achievement, PlayerAchievement
)
from app.models.user import User


async def get_overview(db: AsyncSession, user: User, platform: str | None = None) -> dict:
    """Загальна аналітика по всіх або одній платформі."""

    query = (
        select(PlayerGame)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .options(selectinload(PlayerGame.game))
        .where(PlatformConnection.user_id == user.id)
    )
    if platform:
        query = query.where(PlatformConnection.platform == platform)

    result = await db.execute(query)
    player_games = result.scalars().all()

    total_games = len(player_games)
    total_minutes = sum(pg.playtime_minutes for pg in player_games)
    total_hours = round(total_minutes / 60, 1)
    recent_minutes = sum(pg.playtime_2weeks_minutes for pg in player_games)
    recent_hours = round(recent_minutes / 60, 1)

    total_achievements = sum(pg.achievement_count for pg in player_games)
    total_possible = sum(pg.achievement_total for pg in player_games)

    top_games = sorted(player_games, key=lambda x: x.playtime_minutes, reverse=True)[:10]
    recent_games = sorted(
        [pg for pg in player_games if pg.playtime_2weeks_minutes > 0],
        key=lambda x: x.playtime_2weeks_minutes,
        reverse=True,
    )[:10]

    def fmt_game(pg: PlayerGame) -> dict:
        return {
            "game_id": pg.game.id,
            "platform_game_id": pg.game.platform_game_id,
            "platform": pg.game.platform,
            "name": pg.game.name,
            "img_icon_url": pg.game.img_icon_url,
            "playtime_hours": round(pg.playtime_minutes / 60, 1),
            "playtime_2weeks_hours": round(pg.playtime_2weeks_minutes / 60, 1),
            "achievement_count": pg.achievement_count,
            "achievement_total": pg.achievement_total,
            "achievement_percent": round(
                pg.achievement_count / pg.achievement_total * 100, 1
            ) if pg.achievement_total > 0 else 0,
        }

    # Розбивка по платформах
    platforms_breakdown = {}
    for pg in player_games:
        p = pg.game.platform
        if p not in platforms_breakdown:
            platforms_breakdown[p] = {"games": 0, "hours": 0.0, "achievements": 0}
        platforms_breakdown[p]["games"] += 1
        platforms_breakdown[p]["hours"] += round(pg.playtime_minutes / 60, 1)
        platforms_breakdown[p]["achievements"] += pg.achievement_count

    return {
        "total_games": total_games,
        "total_hours": total_hours,
        "recent_hours": recent_hours,
        "total_achievements": total_achievements,
        "total_possible_achievements": total_possible,
        "achievement_completion": round(
            total_achievements / total_possible * 100, 1
        ) if total_possible > 0 else 0,
        "top_games": [fmt_game(pg) for pg in top_games],
        "recent_games": [fmt_game(pg) for pg in recent_games],
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
    """Досягнення відсортовані за рідкістю."""
    result = await db.execute(
        select(
            Achievement.id,
            Achievement.api_name,
            Achievement.display_name,
            Achievement.description,
            Achievement.icon_url,
            Game.id.label("game_id"),
            Game.name.label("game_name"),
            Game.platform,
            PlayerAchievement.achieved,
            PlayerAchievement.unlock_time,
        )
        .join(PlayerAchievement, PlayerAchievement.achievement_id == Achievement.id)
        .join(PlayerGame, PlayerGame.id == PlayerAchievement.player_game_id)
        .join(PlatformConnection, PlatformConnection.id == PlayerGame.connection_id)
        .join(Game, Game.id == Achievement.game_id)
        .where(PlatformConnection.user_id == user.id)
        .where(PlayerAchievement.achieved == True)
        .limit(limit)
    )
    rows = result.all()

    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 1

    achievements = []
    for row in rows:
        owners_result = await db.execute(
            select(func.count(PlayerAchievement.id))
            .where(PlayerAchievement.achievement_id == row.id)
            .where(PlayerAchievement.achieved == True)
        )
        owners = owners_result.scalar() or 1
        rarity = round(owners / total_users * 100, 1)

        achievements.append({
            "id": row.id,
            "api_name": row.api_name,
            "display_name": row.display_name,
            "description": row.description,
            "icon_url": row.icon_url,
            "game_id": row.game_id,
            "game_name": row.game_name,
            "platform": row.platform,
            "rarity_percent": rarity,
            "rarity_label": _rarity_label(rarity),
            "unlock_time": row.unlock_time,
        })

    return sorted(achievements, key=lambda x: x["rarity_percent"])


def _rarity_label(p: float) -> str:
    if p <= 5:   return "Legendary"
    if p <= 15:  return "Epic"
    if p <= 30:  return "Rare"
    if p <= 60:  return "Uncommon"
    return "Common"
