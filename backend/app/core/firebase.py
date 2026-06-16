import json
import base64
import os
import logging
from typing import Dict, Any
import firebase_admin
from firebase_admin import auth, credentials
from app.core.config import settings

logger = logging.getLogger(__name__)
_app: firebase_admin.App | None = None

def init_firebase() -> None:
    global _app
    if _app is not None:
        return

    try:
        
        b64 = os.environ.get("FIREBASE_CREDENTIALS_BASE64")
        if b64:
            logger.info("Ініціалізація Firebase через Base64 змінні.")
            cred_dict = json.loads(base64.b64decode(b64).decode())
            cred = credentials.Certificate(cred_dict)
        else:
            
            logger.info(f"Ініціалізація Firebase через файл: {settings.firebase_credentials_path}")
            cred = credentials.Certificate(settings.firebase_credentials_path)

        _app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK успішно запущено.")
        
    except Exception as e:
        logger.error(f"Помилка ініціалізації Firebase: {str(e)}")
        raise RuntimeError("Firebase не вдалося ініціалізувати") from e

def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """Верифікує токен і повертає декодовані дані."""
    try:
        return auth.verify_id_token(id_token)
    except auth.ExpiredIdTokenError:
        logger.warning("Спроба входу з простроченим токеном.")
        raise ValueError("Token expired")
    except auth.InvalidIdTokenError:
        logger.warning("Спроба входу з недійсним токеном.")
        raise ValueError("Invalid token")