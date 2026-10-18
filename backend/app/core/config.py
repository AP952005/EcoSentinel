"""
EcoSentinel Backend Configuration
"""
import os
from pathlib import Path
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    # App
    app_env: str = "development"
    app_secret_key: str = "dev-secret-change-in-production"
    app_debug: bool = True
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "sqlite:///./data/ecosentinel.db"

    # Storage
    upload_dir: str = "./data/uploads"
    export_dir: str = "./data/exports"
    audio_cache_dir: str = "./data/audio_cache"

    # JWT
    jwt_secret_key: str = "jwt-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # Rate limiting
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 300

    # Gemini API / Google GenAI SDK
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-3.8-flash"
    gemini_thinking_level: str = "low"
    gemini_max_output_tokens_chat: int = 600
    gemini_max_output_tokens_fer: int = 1600
    gemini_max_output_tokens_proofloop: int = 1800

    # Google Cloud / BigQuery / Storage
    google_cloud_project: Optional[str] = "environmental-guardian-poc"
    earth_engine_project: Optional[str] = "environmental-guardian-poc"
    bigquery_dataset: Optional[str] = "environmental_guardian"
    bigquery_location: Optional[str] = "US"
    gcs_bucket: Optional[str] = "env-guardian-photos-shobika-878e"

    # Ollama (Fallback provider)
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "qwen3:8b"
    ollama_fallback_model: str = "gemma3:4b"
    ollama_timeout_seconds: int = 120

    # Piper TTS
    piper_enabled: bool = False
    piper_bin_path: str = "piper"
    piper_model_path: str = "./data/piper_models/en_US-lessac-medium.onnx"
    piper_voice: str = "en_US-lessac-medium"
    tts_fallback: str = "browser"

    # Earth Engine
    ee_enabled: bool = False
    ee_project: Optional[str] = None
    ee_service_account_key_file: Optional[str] = None

    # Map
    map_style_url: str = "https://tiles.openfreemap.org/styles/liberty"
    map_attribution: str = "© OpenStreetMap contributors | © OpenFreeMap"

    # Demo mode
    default_analysis_mode: str = "REPLAY"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()

# Ensure data directories exist
for d in [settings.upload_dir, settings.export_dir, settings.audio_cache_dir]:
    Path(d).mkdir(parents=True, exist_ok=True)
