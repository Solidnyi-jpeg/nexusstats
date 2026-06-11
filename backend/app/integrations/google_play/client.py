# backend/app/integrations/google_play/client.py
import httpx
import logging
from typing import Dict, List, Any
from app.integrations.base import BasePlatformClient

logger = logging.getLogger(__name__)

class GooglePlayClient(BasePlatformClient):
    """
    Клієнт для взаємодії з Google Play Games Services API.
    """
    def __init__(self):
        self.base_url = "https://games.googleapis.com/games/v1"

    async def get_player_profile(self, platform_user_id: str, access_token: str = None) -> Dict[str, Any]:
        """Отримує профіль гравця (ім'я, аватар) з Google Play"""
        if not access_token:
            raise ValueError("Для Google Play необхідний access_token")

        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/players/me", headers=headers)
            
            if resp.status_code != 200:
                logger.error(f"Помилка Google API: {resp.text}")
                raise Exception("Не вдалося отримати профіль Google Play")
                
            data = resp.json()
            
            # Повертаємо дані у нашому універсальному форматі
            return {
                "platform_user_id": data.get("playerId"),
                "personaname": data.get("displayName", "Google Player"),
                "avatar_url": data.get("avatarImageUrl")
            }

    async def get_player_games(self, platform_user_id: str, access_token: str = None) -> List[Dict[str, Any]]:
        # Тут пізніше буде логіка отримання ігор з Google Play API
        return []

    async def get_game_achievements(self, platform_game_id: str, platform_user_id: str, access_token: str = None) -> List[Dict[str, Any]]:
        # Тут пізніше буде логіка отримання досягнень
        return []

# Створюємо єдиний екземпляр клієнта
google_play_client = GooglePlayClient()