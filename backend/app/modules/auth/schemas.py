"""
Authentication Module — Request/Response Schemas
"""

from pydantic import BaseModel, Field


class OtpRequestInput(BaseModel):
    mobile: str = Field(
        ...,
        pattern=r"^09\d{9}$",
        description="Iranian mobile number (09xxxxxxxxx)",
    )


class OtpChallengeResponse(BaseModel):
    challengeId: str
    expiresAt: str
    remainingAttempts: int
    resendCooldownSeconds: int


class OtpVerifyInput(BaseModel):
    challengeId: str
    code: str = Field(..., pattern=r"^\d{6}$", description="6-digit OTP code")


class OtpVerifyResponse(BaseModel):
    sessionId: str
    userId: str
    isNewUser: bool
