import httpx
from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.platform import PlatformConnection, Game, PlayerGame, PlayerAchievement, Achievement
from app.services.analytics_service import get_overview

router = APIRouter(prefix="/analytics", tags=["analytics"])

async def resolve_target_user(current_user: User, steam_id: str | None, db: AsyncSession) -> User:
    if not steam_id:
        return current_user
        
    res = await db.execute(
        select(User).join(PlatformConnection).where(
            PlatformConnection.platform == "steam",
            PlatformConnection.platform_user_id == steam_id,
        )
    )
    found = res.scalar_one_or_none()
    
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Користувача зі SteamID {steam_id} не знайдено."
        )
    return found

@router.get("/overview")
async def overview(
    platform: str | None = Query(default=None),
    steam_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    target = await resolve_target_user(current_user, steam_id, db)
    return await get_overview(db, target, platform)

@router.get("/achievements/rare", response_model=List[dict])
async def rare_achievements(
    limit: int = Query(default=200, le=2000), 
    steam_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    target = await resolve_target_user(current_user, steam_id, db)
    
    conn_res = await db.execute(select(PlatformConnection).where(PlatformConnection.user_id == target.id, PlatformConnection.platform == "steam"))
    conn = conn_res.scalar_one_or_none()
    if not conn: return []

    stmt = (
        select(Achievement, PlayerAchievement, Game)
        .join(Game, Achievement.game_id == Game.id)
        .join(PlayerGame, (PlayerGame.game_id == Game.id) & (PlayerGame.connection_id == conn.id))
        .outerjoin(PlayerAchievement, (PlayerAchievement.achievement_id == Achievement.id) & (PlayerAchievement.player_game_id == PlayerGame.id))
        .order_by(PlayerAchievement.achieved.desc().nulls_last(), Achievement.rarity_percent.asc())
        .limit(limit)
    )
    res = await db.execute(stmt)

    results = []
    for ach, p_ach, game in res.all():
        results.append({
            "id": ach.id, "api_name": ach.api_name, "display_name": ach.display_name,
            "description": ach.description, "icon_url": ach.icon_url, "icon_gray_url": ach.icon_gray_url,   
            "rarity_percent": ach.rarity_percent, "hidden": ach.hidden,
            "achieved": p_ach.achieved if p_ach else False, "unlock_time": p_ach.unlock_time if p_ach else None,
            "game_name": game.name, "game_icon": game.img_icon_url,
            "platform": game.platform, "platform_game_id": game.platform_game_id
        })
    return results

@router.get("/games/{platform_game_id}/achievements")
async def game_achievements(
    platform_game_id: str,
    steam_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    target = await resolve_target_user(current_user, steam_id, db)
    
    conn_res = await db.execute(select(PlatformConnection).where(PlatformConnection.user_id == target.id, PlatformConnection.platform == "steam"))
    conn = conn_res.scalar_one_or_none()
    if not conn: return []
        
    stmt = (
        select(Achievement, PlayerAchievement)
        .join(Game, Achievement.game_id == Game.id)
        .join(PlayerGame, (PlayerGame.game_id == Game.id) & (PlayerGame.connection_id == conn.id))
        .outerjoin(PlayerAchievement, (PlayerAchievement.achievement_id == Achievement.id) & (PlayerAchievement.player_game_id == PlayerGame.id))
        .where(Game.platform_game_id == str(platform_game_id))
    )
    res = await db.execute(stmt)
    
    results = []
    for ach, p_ach in res.all():
        results.append({
            "api_name": ach.api_name, "display_name": ach.display_name, "description": ach.description,
            "icon_url": ach.icon_url, "icon_gray_url": ach.icon_gray_url, "rarity_percent": ach.rarity_percent, 
            "hidden": ach.hidden, "achieved": p_ach.achieved if p_ach else False, "unlock_time": p_ach.unlock_time if p_ach else None
        })
    return results

# ==========================================
# РОЗУМНИЙ ЖИВИЙ ЕНДПОІНТ ДЛЯ WARGAMING
# ==========================================
@router.get("/wargaming")
async def wargaming_stats(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    conn_res = await db.execute(select(PlatformConnection).where(PlatformConnection.user_id == current_user.id, PlatformConnection.platform == "wargaming"))
    conn = conn_res.scalar_one_or_none()
    
    if not conn: 
        return {"has_data": False, "error": "not_connected"}

    account_id = str(conn.platform_user_id)
    nickname = conn.platform_username
    app_id = "7f718cf85a9ad6397aa4c32459518d41" 
    
    url = f"https://api.worldoftanks.eu/wot/account/info/?application_id={app_id}&account_id={account_id}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            data = resp.json()
            
            # --- ЛОГУВАННЯ ДЛЯ ДЕБАГІНГУ ---
            print("\n" + "="*50)
            print(f"📡 ЗАПИТ ДО WARGAMING API (Account: {nickname})")
            print(f"URL: {url}")
            print(f"ВІДПОВІДЬ: {data}")
            print("="*50 + "\n")
            
            if data.get("status") == "ok":
                # Перевіряємо, чи повернув WG хоч щось
                acc_data = data.get("data", {}).get(account_id)
                
                if acc_data is None:
                    return {"has_data": False, "nickname": nickname, "error": "hidden_or_no_pc_stats"}

                stats = acc_data.get("statistics", {}).get("all", {})
                battles = stats.get("battles", 0)
                
                if battles > 0:
                    winrate = round((stats.get("wins", 0) / battles * 100), 2)
                    survival_rate = round((stats.get("survived_battles", 0) / battles * 100), 2)
                    
                    return {
                        "has_data": True,
                        "nickname": nickname,
                        "battles": battles,
                        "winrate": winrate,
                        "frags": stats.get("frags", 0),
                        "survival_rate": survival_rate
                    }
                else:
                    return {"has_data": False, "nickname": nickname, "error": "zero_battles"}
    except Exception as e:
        print(f"❌ Помилка запиту WG: {e}")

    return {"has_data": False, "nickname": nickname, "error": "api_failed"}