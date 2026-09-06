from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = Field(
        default="mongodb://localhost:27017",
        validation_alias=AliasChoices("MONGODB_URI", "MONGO_URI"),
    )
    mongodb_db: str = "school_bus_tracking"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    jwt_ws_expire_minutes: int = 2
    stale_seconds: int = 60
    signal_lost_seconds: int = 30
    stop_reached_meters: float = 150.0
    eta_alert_minutes: float = 5.0
    fallback_speed_kmh: float = 25.0
    use_osrm: bool = True
    osrm_base_url: str = "https://router.project-osrm.org"
    osrm_timeout_seconds: float = 2.0
    school_name: str = "Demo Public School"
    school_phone: str = "+91 90000 00000"
    school_email: str = "office@schoolbus.app"
    school_address: str = "Main Campus Gate"


settings = Settings()
