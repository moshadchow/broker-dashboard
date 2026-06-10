from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    external_api_base_url: str
    app_type: int = 1

    auto_auth_username: str
    auto_auth_password: str
    auto_auth_device_id: str

    scheduled_time: str = "06:00"
    app_timezone: str = "Asia/Dhaka"

    default_stock_exchange: str = "DSE"
    token_refresh_skew_minutes: int = 5

    jwt_access_token: str = ""
    jwt_refresh_token: str = ""

    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str
    db_password: str
    db_name: str

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_allow_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]


settings = Settings()
