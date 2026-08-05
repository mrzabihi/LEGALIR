"""
LEGALIR Backend Configuration — Environment-aware settings
"""

from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Environment
    environment: str = "development"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Database
    database_url: str = "postgresql+asyncpg://legalir:legalir@localhost:5432/legalir"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Object Storage (S3-compatible)
    storage_endpoint: str = "http://localhost:9000"
    storage_access_key: str = "minioadmin"
    storage_secret_key: str = "minioadmin"
    storage_bucket: str = "legalir-documents"

    # Auth
    session_secret: str = "dev-secret-change-in-production"
    session_ttl_minutes: int = 1440  # 24 hours

    # OTP
    otp_provider: str = "static"  # static | kavenegar
    otp_static_code: str = "405405"  # Development only
    otp_ttl_seconds: int = 120
    otp_max_attempts: int = 5

    # AI
    ai_provider: str = "fake"  # fake | openai | anthropic | custom

    # Feature Flags
    feature_document_analysis: bool = True
    feature_contract_workspace: bool = True
    feature_memory: bool = True

    model_config = {"env_prefix": "LEGALIR_", "env_file": ".env"}


settings = Settings()
