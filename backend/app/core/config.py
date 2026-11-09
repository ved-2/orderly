from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    FIREBASE_SERVICE_ACCOUNT_PATH: str
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    GEMINI_API_KEY: str | None = None
    GEMINI_API_KEY1: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
