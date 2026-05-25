import json
import base64
import os
import tempfile
import firebase_admin
from firebase_admin import auth, credentials
from app.core.config import settings

_app: firebase_admin.App | None = None


def init_firebase() -> None:
    global _app
    if _app is not None:
        return

    # Спочатку пробуємо base64 (для Railway)
    b64 = os.environ.get("FIREBASE_CREDENTIALS_BASE64")
    if b64:
        cred_dict = json.loads(base64.b64decode(b64).decode())
        cred = credentials.Certificate(cred_dict)
    else:
        # Локально — читаємо файл
        cred = credentials.Certificate(settings.firebase_credentials_path)

    _app = firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str) -> dict:
    try:
        return auth.verify_id_token(id_token)
    except auth.ExpiredIdTokenError as e:
        raise ValueError("Token expired") from e
    except auth.InvalidIdTokenError as e:
        raise ValueError("Invalid token") from e
