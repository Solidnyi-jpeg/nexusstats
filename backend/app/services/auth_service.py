import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

SECRET_KEY = settings.secret_key
# Використовуємо правильну назву змінної з config.py
ALGORITHM = getattr(settings, "jwt_algorithm", "HS256")

# Беремо час життя токена з конфігу. За замовчуванням залишаємо 30 днів (43200 хвилин), 
# щоб користувача не "викидало" занадто часто.
ACCESS_TOKEN_EXPIRE_MINUTES = getattr(settings, "access_token_expire_minutes", 60 * 24 * 30)

def create_access_token(data: dict[str, Any]) -> str:
    """Генерує JWT токен доступу для користувача."""
    to_encode = data.copy()
    
    # Використовуємо timezone.utc для уникнення проблем з часовими поясами серверів
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    try:
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Помилка при генерації JWT токена: {e}")
        raise e