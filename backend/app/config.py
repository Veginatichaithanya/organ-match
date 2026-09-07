import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Env & Security
    APP_ENV: str = "development"
    FRONTEND_URL: str = "https://localhost:5173"
    PQC_ENABLED: bool = False
    COOKIE_SECURE: Optional[bool] = None
    COOKIE_SAMESITE: str = "lax"
    CORS_ORIGINS: list[str] = [
        "https://localhost:5173",
        "http://localhost:5173",
        "https://127.0.0.1:5173",
        "http://127.0.0.1:5173",
        "https://localhost:3000",
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/organ_donation_db"

    # JWT Configs
    JWT_SECRET_KEY: str = "generate_a_secure_random_hex_key_for_production"
    JWT_REFRESH_SECRET_KEY: str = "generate_a_separate_secure_random_hex_key_for_refresh_tokens"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Hyperledger Fabric Gateway Configs
    FABRIC_NETWORK: str = "test-network"
    FABRIC_CHANNEL: str = "organ-donation-channel"
    FABRIC_CHAINCODE: str = "organ-contract"
    FABRIC_MSP_ID: str = "Org1MSP"
    FABRIC_PEER_ENDPOINT: str = "localhost:7051"
    FABRIC_GATEWAY_ENDPOINT: str = "localhost:7051"
    FABRIC_CERT_PATH: str = ""
    FABRIC_KEY_PATH: str = ""
    FABRIC_TLS_CERT_PATH: str = ""

    # Locate and read configuration files in backend/.env or root .env
    model_config = SettingsConfigDict(
        env_file=(
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")),
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

if "@postgres:5432" in settings.DATABASE_URL:
    try:
        import socket
        socket.gethostbyname("postgres")
    except Exception:
        settings.DATABASE_URL = settings.DATABASE_URL.replace("@postgres:5432", "@localhost:5432")


