from dataclasses import dataclass

from pydantic_settings import BaseSettings, SettingsConfigDict


@dataclass(frozen=True)
class CredentialSet:
    name: str
    username: str
    password: str
    device_id: str
    app_type: int
    base_url: str


@dataclass(frozen=True)
class OmsEndpoint:
    name: str
    base_url: str
    credentials: CredentialSet


class Settings(BaseSettings):
    app_env: str = "uat"

    scheduled_time: str = "15:00"
    scheduled_days: str = "sun,mon,tue,wed,thu"
    excluded_weekdays: str = "fri,sat"
    app_timezone: str = "Asia/Dhaka"

    default_stock_exchange: str = "DSE"
    token_refresh_skew_minutes: int = 5

    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "root"
    db_name: str = "broker_db"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_allow_origins: str = "http://localhost:5173"

    jwt_secret_key: str = "NmsnuNpb2ZuTQc1_Mn4UNQpA63YbKIo9ZzYY4footYjoy5q2OTe-_-kTD0fhj5Ai"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    app_encryption_key: str = ""

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
