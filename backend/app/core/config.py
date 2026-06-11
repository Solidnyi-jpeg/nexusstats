from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

    app_name: str = "NexusStats"
    debug: bool = False

    api_url: str = "http://127.0.0.1:8000"
    frontend_url: str = "http://127.0.0.1:5173"

    # Бази даних та кеш
    database_url: str
    redis_url: str
    
    # Додай ці два рядки, якщо їх там немає:
    google_client_id: str
    google_client_secret: str

    # Ключ Steam API
    steam_api_key: str = Field(..., repr=False)
    
    # Налаштування безпеки та JWT (для власної системи авторизації)
    secret_key: str = Field("SUPER_SECRET_NEXUS_KEY_123!", repr=False)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 днів у хвилинах (можеш змінити за потреби)

settings = Settings()
class Config:
        env_file = ".env"