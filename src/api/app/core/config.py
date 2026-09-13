from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Enter — Política de acordos"
    database_url: str = "sqlite:///./db/app.db"
    storage_dir: Path = Path("./storage")
    data_dir: Path = Path("./data")
    demo_seed: bool = True
    demo_replay_enabled: bool = True
    demo_replay_seconds: float = 20.0
    openai_api_key: str = ""
    openai_model: str = "gpt-5"
    openai_chat_model: str = "gpt-5.6-luna"
    openai_chat_reasoning_effort: str = "medium"
    cors_origins: str = "http://localhost:5173"
    max_upload_bytes: int = 20 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
