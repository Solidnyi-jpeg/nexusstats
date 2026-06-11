from abc import ABC, abstractmethod
from typing import Dict, List, Any

class BasePlatformClient(ABC):
    """
    Абстрактний базовий клас для всіх ігрових платформ.
    Кожна нова платформа (Steam, Google Play, Epic) ПОВИННА реалізувати ці методи.
    """
    
    @abstractmethod
    async def get_player_profile(self, platform_user_id: str, access_token: str = None) -> Dict[str, Any]:
        """
        Отримує базовий профіль гравця.
        Повинен повертати словник з ключами: platform_user_id, personaname, avatar_url
        """
        pass

    @abstractmethod
    async def get_player_games(self, platform_user_id: str, access_token: str = None) -> List[Dict[str, Any]]:
        """
        Отримує список ігор користувача на цій платформі.
        """
        pass

    @abstractmethod
    async def get_game_achievements(self, platform_game_id: str, platform_user_id: str, access_token: str = None) -> List[Dict[str, Any]]:
        """
        Отримує прогрес досягнень гравця у конкретній грі.
        """
        pass