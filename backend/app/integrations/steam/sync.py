import logging
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.platform import PlatformConnection, Game, PlayerGame, Achievement, PlayerAchievement
from app.integrations.steam.client import steam_client
from app.core.redis import cache_delete_pattern

logger = logging.getLogger(__name__)

async def sync_steam_data_for_user(db: AsyncSession, user_id: int, steam_id: str):
    logger.info(f"🚀 Початок синхронізації для user_id={user_id} (SteamID: {steam_id})")
    
    try:
        stmt = select(PlatformConnection).where(
            PlatformConnection.user_id == user_id,
            PlatformConnection.platform == "steam"
        )
        res = await db.execute(stmt)
        connection = res.scalars().first()
        
        if not connection:
            logger.error(f"❌ Не знайдено підключення Steam для user_id={user_id}")
            return
            
        games_list = await steam_client.get_owned_games(steam_id)
        
       

        logger.info(f"🎁 Стягнуто {len(games_list)} ігор. Починаємо обробку...")

        appids = [str(g.get("appid")) for g in games_list if g.get("appid")]
        
        existing_games_stmt = select(Game).where(Game.platform == "steam", Game.platform_game_id.in_(appids))
        existing_games_res = await db.execute(existing_games_stmt)
        existing_games_map = {g.platform_game_id: g for g in existing_games_res.scalars().all()}

        pg_stmt = select(PlayerGame).where(PlayerGame.connection_id == connection.id)
        pg_res = await db.execute(pg_stmt)
        existing_pg_map = {pg.game_id: pg for pg in pg_res.scalars().all()}

        sem = asyncio.Semaphore(15)

        async def process_game_data(g):
            appid = g.get("appid")
            if not appid: return None
            
            appid_str = str(appid)
            playtime_forever = g.get("playtime_forever", 0)
            
            achievement_total = 0
            achievement_count = 0
            ach_data_list = []
            
            if playtime_forever > 0:
                async with sem:
                    try:
                        ach_data = await steam_client.get_achievements(steam_id, int(appid))
                        if ach_data:
                            ach_data_list = ach_data
                            achievement_total = len(ach_data)
                            achievement_count = sum(1 for a in ach_data if a.get("achieved") == 1)
                    except Exception:
                        pass

            icon_hash = g.get("img_icon_url")
            # Формуємо URL іконки
            icon_url = f"https://media.steampowered.com/steamcommunity/public/images/apps/{appid_str}/{icon_hash}.jpg" if icon_hash else None
            
            return {
                "appid_str": appid_str,
                "game_name": g.get("name", f"Unknown Game {appid_str}"),
                "img_icon_url": icon_url,
                "playtime_forever": playtime_forever,
                "playtime_2weeks": g.get("playtime_2weeks", 0),
                "achievement_count": achievement_count,
                "achievement_total": achievement_total,
                "achievements_data": ach_data_list
            }

        tasks = [process_game_data(g) for g in games_list]
        processed_games = await asyncio.gather(*tasks)

        for data in processed_games:
            if data["appid_str"] == "570":
                logger.info(f"DEBUG: Обробка Dota 2, іконка: {data['img_icon_url']}")
            if not data: continue

            # Оновлюємо або створюємо глобальну гру
            db_game = existing_games_map.get(data["appid_str"])
            if not db_game:
                db_game = Game(
                    platform="steam",
                    platform_game_id=data["appid_str"],
                    name=data["game_name"],
                    img_icon_url=data["img_icon_url"]
                )
                db.add(db_game)
                await db.flush()
                existing_games_map[data["appid_str"]] = db_game
            else:
                # Оновлюємо іконку, якщо її раніше не було
                if not db_game.img_icon_url and data["img_icon_url"]:
                    db_game.img_icon_url = data["img_icon_url"]

            # Оновлюємо або створюємо прогрес гравця
            db_player_game = existing_pg_map.get(db_game.id)
            if db_player_game:
                db_player_game.playtime_minutes = data["playtime_forever"]
                db_player_game.playtime_2weeks_minutes = data["playtime_2weeks"]
                db_player_game.achievement_count = data["achievement_count"]
                db_player_game.achievement_total = data["achievement_total"]
            else:
                db_player_game = PlayerGame(
                    connection_id=connection.id,
                    game_id=db_game.id,
                    playtime_minutes=data["playtime_forever"],
                    playtime_2weeks_minutes=data["playtime_2weeks"],
                    achievement_count=data["achievement_count"],
                    achievement_total=data["achievement_total"]
                )
                db.add(db_player_game)
                existing_pg_map[db_game.id] = db_player_game

            # Синхронізація досягнень
            if data["achievements_data"]:
                stmt_achs = select(Achievement).where(Achievement.game_id == db_game.id)
                res_achs = await db.execute(stmt_achs)
                existing_achs = {a.api_name: a for a in res_achs.scalars().all()}

                stmt_pa = select(PlayerAchievement).where(PlayerAchievement.player_game_id == db_player_game.id)
                res_pa = await db.execute(stmt_pa)
                existing_pas = {pa.achievement_id: pa for pa in res_pa.scalars().all()}

                for ach_item in data["achievements_data"]:
                    api_name = ach_item.get("apiname")
                    if not api_name: continue

                    db_ach = existing_achs.get(api_name)
                    if not db_ach:
                        db_ach = Achievement(
                            game_id=db_game.id,
                            api_name=api_name,
                            display_name=ach_item.get("displayName") or api_name,
                            description=ach_item.get("description", ""),
                            icon_url=ach_item.get("icon", ""),
                            icon_gray_url=ach_item.get("icongray", ""),
                            rarity_percent=float(ach_item.get("percent", 0.0))
                        )
                        db.add(db_ach)
                        await db.flush()
                        existing_achs[api_name] = db_ach

                    db_pa = existing_pas.get(db_ach.id)
                    is_achieved = ach_item.get("achieved") == 1
                    
                    if not db_pa:
                        db_pa = PlayerAchievement(
                            player_game_id=db_player_game.id,
                            achievement_id=db_ach.id,
                            achieved=is_achieved,
                            unlock_time=ach_item.get("unlocktime")
                        )
                        db.add(db_pa)
                        existing_pas[db_ach.id] = db_pa
                    else:
                        db_pa.achieved = is_achieved
                        db_pa.unlock_time = ach_item.get("unlocktime")

        await db.commit()
        await cache_delete_pattern(f"user:{user_id}:*")
        logger.info(f"🎉 Успішно синхронізовано для user_id={user_id}!")

    except Exception as e:
        await db.rollback()
        logger.error(f"🔥 Критична помилка: {str(e)}", exc_info=True)
        raise e