from pydantic import Field # Додай цей імпорт
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

    api_url: str = "http://127.0.0.1:8000"
    frontend_url: str = "http://127.0.0.1:5173"

    firebase_credentials_path: str = "serviceAccountKey.json"

    database_url: str
    redis_url: str
    # Додаємо Field(repr=False) для безпеки
    steam_api_key: str = Field(..., repr=False)
    
    app_name: str = "NexusStats"
    debug: bool = False
    
    # Секретний ключ з використанням Field
    secret_key: str = Field("SUPER_SECRET_NEXUS_KEY_123!", repr=False)

settings = Settings()