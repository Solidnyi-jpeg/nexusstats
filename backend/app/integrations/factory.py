import logging
from typing import Dict, Type
from app.integrations.base import BasePlatformClient
from app.integrations.steam.client import steam_client
from app.integrations.google_play.client import google_play_client # ДОДАНО

# Твій існуючий клієнт Steam (його треба буде трохи адаптувати під BasePlatformClient пізніше,
# але зараз просто імпортуємо його екземпляр)
from app.integrations.steam.client import steam_client 

logger = logging.getLogger(__name__)

class PlatformClientFactory:
    """
    Фабрика для отримання правильного API-клієнта залежно від назви платформи.
    """
    
    # Реєстр усіх підключених платформ
    _clients: Dict[str, BasePlatformClient] = {
        "steam": steam_client,
        "google_play": google_play_client,
        # "epic_games": epic_client,
    }

    @classmethod
    def get_client(cls, platform_name: str) -> BasePlatformClient:
        """
        Повертає інстанс клієнта для заданої платформи.
        """
        platform_key = platform_name.lower()
        client = cls._clients.get(platform_key)
        
        if not client:
            logger.error(f"Спроба використати непідтримувану платформу: {platform_key}")
            raise ValueError(f"Платформа '{platform_key}' не підтримується системою.")
            
        return client