"""
OTP Provider Adapter — Static (Development) + Kavenegar-ready interface
"""

import uuid
import time
from abc import ABC, abstractmethod
from typing import Dict

from app.config import settings


class OtpProvider(ABC):
    """Abstract OTP provider interface."""

    @abstractmethod
    async def request_code(self, mobile: str) -> Dict:
        """Create an OTP challenge and return challenge metadata."""
        ...

    @abstractmethod
    async def verify_code(self, challenge_id: str, code: str) -> Dict:
        """Verify an OTP code and return session data."""
        ...


class StaticOtpProvider(OtpProvider):
    """
    Development-only OTP provider.
    Accepts only the configured static code.
    Must NEVER be used in production.
    """

    def __init__(self, static_code: str):
        self._static_code = static_code
        self._challenges: Dict[str, Dict] = {}

    async def request_code(self, mobile: str) -> Dict:
        challenge_id = str(uuid.uuid4())
        expires_at = int(time.time()) + settings.otp_ttl_seconds

        self._challenges[challenge_id] = {
            "mobile": mobile,
            "code": self._static_code,
            "expires_at": expires_at,
            "attempts": 0,
        }

        return {
            "challenge_id": challenge_id,
            "expires_at": expires_at,
            "remaining_attempts": settings.otp_max_attempts,
            "resend_cooldown_seconds": 60,
        }

    async def verify_code(self, challenge_id: str, code: str) -> Dict:
        challenge = self._challenges.get(challenge_id)
        if not challenge:
            raise ValueError("Challenge not found")

        challenge["attempts"] += 1

        if challenge["attempts"] > settings.otp_max_attempts:
            raise ValueError("Too many attempts")

        if int(time.time()) > challenge["expires_at"]:
            raise ValueError("Challenge expired")

        if code != challenge["code"]:
            raise ValueError("Invalid code")

        # Clean up used challenge
        del self._challenges[challenge_id]

        return {
            "session_id": str(uuid.uuid4()),
            "user_id": "u-pro-001",
            "is_new_user": False,
        }


class KavenegarOtpProvider(OtpProvider):
    """
    Production OTP provider using Kavenegar SMS service.
    Placeholder — will be implemented before production.
    """

    async def request_code(self, mobile: str) -> Dict:
        raise NotImplementedError("Kavenegar provider not yet implemented")

    async def verify_code(self, challenge_id: str, code: str) -> Dict:
        raise NotImplementedError("Kavenegar provider not yet implemented")


# Singleton factory
_provider: OtpProvider | None = None


def get_otp_provider() -> OtpProvider:
    global _provider

    if _provider is None:
        if settings.otp_provider == "static":
            if settings.environment == "production":
                raise RuntimeError("StaticOtpProvider cannot be used in production")
            _provider = StaticOtpProvider(static_code=settings.otp_static_code)
        elif settings.otp_provider == "kavenegar":
            _provider = KavenegarOtpProvider()
        else:
            raise ValueError(f"Unknown OTP provider: {settings.otp_provider}")

    return _provider
