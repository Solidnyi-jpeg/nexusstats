from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db
from app.models.platform import Game, PlayerGame, PlayerAchievement, Achievement, PlatformConnection
from app.models.user import User
from app.services.user_service import get_or_create
from app.integrations.steam.store import get_game_details, get_game_news
from app.integrations.steam.client import steam_client

router = APIRouter(prefix="/games", tags=["games"])


async def _test_user(db):
    return await get_or_create(db, "test-uid-001", "test@nexusstats.com")


@router.get("/{platform}/{platform_game_id}")
async def game_detail(
    platform: str,
    platform_game_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Детальна інформація про гру."""

    # Знаходимо гру в БД
    game_result = await db.execute(
        select(Game).where(
            Game.platform == platform,
            Game.platform_game_id == platform_game_id,
        )
    )
    game = game_result.scalar_one_or_none()

    user = await _test_user(db)

    # PlayerGame для цього юзера
    player_game = None
    achievements = []
    if game:
        pg_result = await db.execute(
            select(PlayerGame)
            .join(PlatformConnection)
            .where(
                PlatformConnection.user_id == user.id,
                PlayerGame.game_id == game.id,
            )
        )
        player_game = pg_result.scalar_one_or_none()

        if player_game:
            ach_result = await db.execute(
                select(PlayerAchievement, Achievement)
                .join(Achievement, Achievement.id == PlayerAchievement.achievement_id)
                .where(PlayerAchievement.player_game_id == player_game.id)
                .order_by(PlayerAchievement.achieved.desc())
            )
            achievements = [
                {
                    "api_name": a.api_name,
                    "display_name": a.display_name,
                    "description": a.description,
                    "icon_url": a.icon_url,
                    "achieved": pa.achieved,
                    "unlock_time": pa.unlock_time,
                }
                for pa, a in ach_result.all()
            ]

    # Steam Store деталі
    store_data = {}
    news = []
    if platform == "steam":
        store_data = await get_game_details(platform_game_id)
        news = await get_game_news(platform_game_id)

    return {
        "game": {
            "id": game.id if game else None,
            "platform": platform,
            "platform_game_id": platform_game_id,
            "name": game.name if game else store_data.get("name", "Unknown"),
            "img_icon_url": game.img_icon_url if game else None,
        },
        "player_stats": {
            "playtime_hours": round(player_game.playtime_minutes / 60, 1) if player_game else 0,
            "playtime_2weeks_hours": round(player_game.playtime_2weeks_minutes / 60, 1) if player_game else 0,
            "achievement_count": player_game.achievement_count if player_game else 0,
            "achievement_total": player_game.achievement_total if player_game else 0,
        } if player_game else None,
        "store": {
            "description": store_data.get("short_description", ""),
            "detailed_description": store_data.get("detailed_description", ""),
            "header_image": store_data.get("header_image", ""),
            "background_raw": store_data.get("background_raw", ""),
            "developers": store_data.get("developers", []),
            "publishers": store_data.get("publishers", []),
            "genres": [g.get("description") for g in store_data.get("genres", [])],
            "categories": [c.get("description") for c in store_data.get("categories", [])],
            "release_date": store_data.get("release_date", {}).get("date", ""),
            "metacritic": store_data.get("metacritic", {}).get("score"),
            "website": store_data.get("website", ""),
            "screenshots": [
                s.get("path_thumbnail")
                for s in store_data.get("screenshots", [])[:6]
            ],
        },
        "news": [
            {
                "title": n.get("title"),
                "url": n.get("url"),
                "date": n.get("date"),
                "contents": n.get("contents", "")[:200],
            }
            for n in news
        ],
        "achievements": achievements,
    }


@router.get("/list/all")
async def list_games(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Список всіх ігор користувача."""
    user = await _test_user(db)

    result = await db.execute(
        select(PlayerGame)
        .join(PlatformConnection)
        .join(Game)
        .options(selectinload(PlayerGame.game))
        .where(PlatformConnection.user_id == user.id)
        .order_by(PlayerGame.playtime_minutes.desc())
    )
    player_games = result.scalars().all()

    return [
        {
            "game_id": pg.game.id,
            "platform": pg.game.platform,
            "platform_game_id": pg.game.platform_game_id,
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
        for pg in player_games
    ]
