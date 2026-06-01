import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.platform import PlatformConnection, Game, PlayerGame
from app.integrations.steam.client import steam_client

logger = logging.getLogger(__name__)

async def sync_steam_data_for_user(db: AsyncSession, user_id: int, steam_id: str):
    logger.info(f"🚀 Початок синхронізації для user_id={user_id}")
    
    try:
        # Отримуємо підключення
        stmt = select(PlatformConnection).where(
            PlatformConnection.user_id == user_id,
            PlatformConnection.platform == "steam"
        )
        res = await db.execute(stmt)
        connection = res.scalars().first()
        
        if not connection:
            logger.error(f"❌ Не знайдено підключення Steam для user_id={user_id}")
            return
            
        # Отримуємо бібліотеку ігор
        games_list = await steam_client.get_owned_games(steam_id)
        if not games_list:
            logger.warning(f"⚠️ Бібліотека порожня або приватна для Steam_ID {steam_id}")
            return

        logger.info(f"🎁 Стягнуто {len(games_list)} ігор. Починаємо обробку...")

        for g in games_list:
            appid = g.get("appid")
            if not appid: continue
            
            appid_str = str(appid)
            game_name = g.get("name", f"Unknown Game {appid_str}")
            playtime_forever = g.get("playtime_forever", 0)
            playtime_2weeks = g.get("playtime_2weeks", 0)
            
            # Обробка іконки
            icon_hash = g.get("img_icon_url")
            img_icon_url = (
                f"https://media.steampowered.com/steamcommunity/public/images/apps/{appid_str}/{icon_hash}.jpg"
                if icon_hash else None
            )

            # 1. Знаходимо або створюємо гру в базі (Global Game)
            game_stmt = select(Game).where(Game.platform == "steam", Game.platform_game_id == appid_str)
            game_res = await db.execute(game_stmt)
            db_game = game_res.scalars().first()

            if not db_game:
                db_game = Game(
                    platform="steam",
                    platform_game_id=appid_str,
                    name=game_name,
                    img_icon_url=img_icon_url
                )
                db.add(db_game)
                await db.flush() # Отримуємо ID нової гри

            # 2. Отримуємо досягнення (тільки якщо в гру грали)
            achievement_total = 0
            achievement_count = 0
            if playtime_forever > 0:
                try:
                    ach_data = await steam_client.get_achievements(steam_id, int(appid))
                    if ach_data:
                        achievement_total = len(ach_data)
                        achievement_count = sum(1 for a in ach_data if a.get("achieved") == 1)
                except Exception as e:
                    logger.debug(f"Досягнення для {appid_str} недоступні: {e}")

            # 3. Синхронізуємо прогрес гравця
            pg_stmt = select(PlayerGame).where(
                PlayerGame.connection_id == connection.id,
                PlayerGame.game_id == db_game.id
            )
            pg_res = await db.execute(pg_stmt)
            db_player_game = pg_res.scalars().first()

            if db_player_game:
                db_player_game.playtime_minutes = playtime_forever
                db_player_game.playtime_2weeks_minutes = playtime_2weeks
                db_player_game.achievement_count = achievement_count
                db_player_game.achievement_total = achievement_total
            else:
                db_player_game = PlayerGame(
                    connection_id=connection.id,
                    game_id=db_game.id,
                    playtime_minutes=playtime_forever,
                    playtime_2weeks_minutes=playtime_2weeks,
                    achievement_count=achievement_count,
                    achievement_total=achievement_total
                )
                db.add(db_player_game)

        await db.commit()
        logger.info(f"🎉 Успішно синхронізовано {len(games_list)} ігор!")

    except Exception as e:
        await db.rollback()
        logger.error(f"🔥 Критична помилка синхронізації: {str(e)}", exc_info=True)
        raise e