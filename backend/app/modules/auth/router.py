"""
Authentication Module — OTP, Session, Logout
Phase 0: Skeleton routes with mock responses
"""

from fastapi import APIRouter, Request

from app.modules.auth.schemas import (
    OtpRequestInput,
    OtpChallengeResponse,
    OtpVerifyInput,
    OtpVerifyResponse,
)
from app.adapters.otp import get_otp_provider

router = APIRouter()


@router.post("/otp/request", response_model=OtpChallengeResponse)
async def request_otp(body: OtpRequestInput, request: Request):
    """Request OTP for a mobile number."""
    provider = get_otp_provider()
    challenge = await provider.request_code(body.mobile)
    return OtpChallengeResponse(
        challengeId=challenge["challenge_id"],
        expiresAt=challenge["expires_at"],
        remainingAttempts=challenge["remaining_attempts"],
        resendCooldownSeconds=challenge["resend_cooldown_seconds"],
    )


@router.post("/otp/verify", response_model=OtpVerifyResponse)
async def verify_otp(body: OtpVerifyInput, request: Request):
    """Verify OTP and create session."""
    provider = get_otp_provider()
    result = await provider.verify_code(body.challengeId, body.code)
    return OtpVerifyResponse(
        sessionId=result["session_id"],
        userId=result["user_id"],
        isNewUser=result["is_new_user"],
    )


@router.post("/logout")
async def logout(request: Request):
    """Invalidate current session."""
    return {"data": None, "meta": {"requestId": str(request.state.correlation_id)}}
