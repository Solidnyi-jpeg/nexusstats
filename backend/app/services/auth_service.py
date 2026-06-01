from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from jose import jwt
from app.core.config import settings

# Константи для підпису токена
SECRET_KEY = settings.secret_key
# Використовуємо алгоритм з налаштувань, або дефолтний HS256
ALGORITHM = getattr(settings, "algorithm", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 години

def create_access_token(data: Dict[str, Any]) -> str:
    """
    Генерує локальний JWT токен безпеки для сесій користувача.
    """
    to_encode = data.copy()
    
    # Використовуємо timezone.utc замість застарілого utcnow()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt