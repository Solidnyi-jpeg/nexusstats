import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.platform import (
    PlatformConnection, Game, PlayerGame,
    Achievement, PlayerAchievement
)
from app.models.user import User
from app.integrations.steam.client import steam_client


async def get_connections(db: AsyncSession, user: User) -> list[PlatformConnection]:
    result = await db.execute(
        select(PlatformConnection)
        .where(PlatformConnection.user_id == user.id)
    )
    return result.scalars().all()


async def connect_steam(
    db: AsyncSession,
    user: User,
    steam_id: str,
) -> PlatformConnection:
    """Підключає Steam акаунт."""
    # Перевіряємо чи вже підключено
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == user.id,
            PlatformConnection.platform == "steam",
            PlatformConnection.platform_user_id == steam_id,
        )
    )
    conn = result.scalar_one_or_none()

    # Отримуємо профіль зі Steam
    profile = await steam_client.get_player_summary(steam_id)

    if conn is None:
        conn = PlatformConnection(
            user_id=user.id,
            platform="steam",
            platform_user_id=steam_id,
            platform_username=profile.get("personaname"),
            avatar_url=profile.get("avatarfull"),
            is_primary=True,
        )
        db.add(conn)
    else:
        conn.platform_username = profile.get("personaname", conn.platform_username)
        conn.avatar_url = profile.get("avatarfull", conn.avatar_url)

    await db.commit()
    await db.refresh(conn)
    return conn


async def sync_steam(db: AsyncSession, connection: PlatformConnection) -> dict:
    """Синхронізує всі ігри та досягнення з Steam."""
    steam_id = connection.platform_user_id
    games_raw = await steam_client.get_owned_games(steam_id)

    synced_games = 0
    synced_achievements = 0

    for g in games_raw:
        app_id = str(g.get("appid", ""))
        if not app_id:
            continue

        # Upsert Game
        game_result = await db.execute(
            select(Game).where(
                Game.platform == "steam",
                Game.platform_game_id == app_id,
            )
        )
        game = game_result.scalar_one_or_none()

        icon_hash = g.get("img_icon_url", "")
        icon_url = (
            f"https://media.steampowered.com/steamcommunity/public/images/apps/{app_id}/{icon_hash}.jpg"
            if icon_hash else None
        )

        if game is None:
            game = Game(
                platform="steam",
                platform_game_id=app_id,
                name=g.get("name", f"App {app_id}"),
                img_icon_url=icon_url,
            )
            db.add(game)
            await db.flush()
        else:
            game.name = g.get("name", game.name)
            game.img_icon_url = icon_url

        # Upsert PlayerGame
        pg_result = await db.execute(
            select(PlayerGame).where(
                PlayerGame.connection_id == connection.id,
                PlayerGame.game_id == game.id,
            )
        )
        pg = pg_result.scalar_one_or_none()

        playtime = g.get("playtime_forever", 0)
        playtime_2w = g.get("playtime_2weeks", 0)

        if pg is None:
            pg = PlayerGame(
                connection_id=connection.id,
                game_id=game.id,
                playtime_minutes=playtime,
                playtime_2weeks_minutes=playtime_2w,
            )
            db.add(pg)
        else:
            pg.playtime_minutes = playtime
            pg.playtime_2weeks_minutes = playtime_2w

        synced_games += 1

    await db.commit()

    # Синхронізація досягнень — всі ігри що мають статистику
    top_games = sorted(games_raw, key=lambda x: x.get("playtime_forever", 0), reverse=True)[:100]
    semaphore = asyncio.Semaphore(5)

    async def sync_ach(g):
        async with semaphore:
            return await _sync_achievements(db, connection, steam_id, str(g["appid"]))

    results = await asyncio.gather(*[sync_ach(g) for g in top_games], return_exceptions=True)
    synced_achievements = sum(r for r in results if isinstance(r, int))

    return {
        "platform": "steam",
        "synced_games": synced_games,
        "synced_achievements": synced_achievements,
    }


async def _sync_achievements(
    db: AsyncSession,
    connection: PlatformConnection,
    steam_id: str,
    app_id: str,
) -> int:
    achs_raw = await steam_client.get_achievements(steam_id, int(app_id))
    if not achs_raw:
        return 0

    # Знаходимо game та player_game
    game_result = await db.execute(
        select(Game).where(Game.platform == "steam", Game.platform_game_id == app_id)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        return 0

    pg_result = await db.execute(
        select(PlayerGame).where(
            PlayerGame.connection_id == connection.id,
            PlayerGame.game_id == game.id,
        )
    )
    pg = pg_result.scalar_one_or_none()
    if not pg:
        return 0

    count = 0
    for a in achs_raw:
        api_name = a.get("apiname", "")
        if not api_name:
            continue

        # Upsert Achievement
        ach_result = await db.execute(
            select(Achievement).where(
                Achievement.game_id == game.id,
                Achievement.api_name == api_name,
            )
        )
        ach = ach_result.scalar_one_or_none()

        if ach is None:
            ach = Achievement(
                game_id=game.id,
                api_name=api_name,
                display_name=api_name,
            )
            db.add(ach)
            await db.flush()

        # Upsert PlayerAchievement
        pa_result = await db.execute(
            select(PlayerAchievement).where(
                PlayerAchievement.player_game_id == pg.id,
                PlayerAchievement.achievement_id == ach.id,
            )
        )
        pa = pa_result.scalar_one_or_none()

        achieved = bool(a.get("achieved", 0))
        unlock_time = a.get("unlocktime")

        if pa is None:
            pa = PlayerAchievement(
                player_game_id=pg.id,
                achievement_id=ach.id,
                achieved=achieved,
                unlock_time=unlock_time,
            )
            db.add(pa)
        else:
            pa.achieved = achieved
            pa.unlock_time = unlock_time

        count += 1

    # Оновлюємо лічильники
    achieved_count = sum(1 for a in achs_raw if a.get("achieved"))
    pg.achievement_count = achieved_count
    pg.achievement_total = len(achs_raw)
    await db.flush()

    await db.commit()
    return count
