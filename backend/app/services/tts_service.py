"""
Piper TTS service — local speech synthesis.
Never claims Google Cloud TTS when Piper is used.
Falls back to browser speech if Piper is unavailable.
"""
import hashlib
import os
import subprocess
import time
from pathlib import Path
from typing import Optional, Dict, Any

from app.core.config import settings


class PiperTTSService:
    def __init__(self):
        self.enabled = settings.piper_enabled
        self.bin_path = settings.piper_bin_path
        self.model_path = settings.piper_model_path
        self.voice = settings.piper_voice
        self.cache_dir = Path(settings.audio_cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def health_check(self) -> Dict[str, Any]:
        """Check Piper availability and model presence."""
        if not self.enabled:
            return {
                "status": "not_configured",
                "engine": "piper",
                "voice": self.voice,
                "fallback": settings.tts_fallback,
                "details": "Set PIPER_ENABLED=true and configure PIPER_BIN_PATH and PIPER_MODEL_PATH",
                "setup_instructions": [
                    "1. Install piper-tts: pip install piper-tts",
                    f"2. Download voice model to: {self.model_path}",
                    "3. Set PIPER_ENABLED=true in .env",
                ],
            }

        # Check if binary exists
        bin_exists = self._check_binary()
        model_exists = os.path.isfile(self.model_path)

        if not bin_exists:
            return {
                "status": "unavailable",
                "engine": "piper",
                "voice": self.voice,
                "fallback": settings.tts_fallback,
                "details": f"Piper binary not found at: {self.bin_path}",
            }
        if not model_exists:
            return {
                "status": "unavailable",
                "engine": "piper",
                "voice": self.voice,
                "fallback": settings.tts_fallback,
                "details": f"Voice model not found at: {self.model_path}",
            }

        return {
            "status": "connected",
            "engine": "piper",
            "voice": self.voice,
            "model_path": self.model_path,
            "cache_dir": str(self.cache_dir),
        }

    def _check_binary(self) -> bool:
        try:
            result = subprocess.run(
                [self.bin_path, "--version"],
                capture_output=True, timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def text_hash(self, text: str) -> str:
        """Stable hash for caching."""
        return hashlib.sha256(f"{text}|{self.voice}".encode()).hexdigest()[:32]

    def synthesize(self, text: str) -> Dict[str, Any]:
        """Generate TTS audio. Returns path to WAV file or error."""
        if not self.enabled:
            return {
                "success": False,
                "engine": "browser_fallback",
                "fallback": True,
                "transcript": text,
                "error": "Piper not configured; use browser speech synthesis",
            }

        text_hash = self.text_hash(text)
        cache_path = self.cache_dir / f"{text_hash}.wav"

        # Return cached if exists
        if cache_path.exists():
            return {
                "success": True,
                "engine": "piper",
                "voice": self.voice,
                "file_path": str(cache_path),
                "audio_id": text_hash,
                "cached": True,
                "transcript": text,
            }

        # Check availability
        status = self.health_check()
        if status["status"] != "connected":
            return {
                "success": False,
                "engine": "browser_fallback",
                "fallback": True,
                "transcript": text,
                "error": status.get("details"),
            }

        try:
            # Truncate very long text
            safe_text = text[:4000]
            process = subprocess.run(
                [self.bin_path, "--model", self.model_path, "--output_file", str(cache_path)],
                input=safe_text.encode("utf-8"),
                capture_output=True,
                timeout=60,
            )
            if process.returncode == 0 and cache_path.exists():
                return {
                    "success": True,
                    "engine": "piper",
                    "voice": self.voice,
                    "file_path": str(cache_path),
                    "audio_id": text_hash,
                    "cached": False,
                    "transcript": text,
                }
            else:
                return {
                    "success": False,
                    "engine": "piper",
                    "error": process.stderr.decode("utf-8", errors="replace"),
                    "fallback": True,
                    "transcript": text,
                }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Piper timed out", "fallback": True, "transcript": text}
        except Exception as e:
            return {"success": False, "error": str(e), "fallback": True, "transcript": text}

    def get_cached_path(self, audio_id: str) -> Optional[Path]:
        """Return cached audio file path if it exists."""
        cache_path = self.cache_dir / f"{audio_id}.wav"
        return cache_path if cache_path.exists() else None


tts_service = PiperTTSService()
