from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "NexusStats"
    debug: bool = False
    environment: str = "development"

    database_url: str
    steam_api_key: str
    firebase_credentials_path: str = "./serviceAccountKey.json"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-production"

    # CORS
    allowed_origins: str = "*"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        if self.allowed_origins == "*":
            return ["*"]
        return [o.strip() for o in self.allowed_origins.split(",")]


settings = Settings()
