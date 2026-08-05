"""
User Module — Profile, Preferences
Phase 0: Skeleton routes with mock responses
"""

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/me")
async def get_profile(request: Request):
    """Get current user profile and preferences."""
    return {
        "data": {
            "user": {
                "id": "u-pro-001",
                "mobileE164": "+989120000003",
                "mobileDisplay": "۰۹۱۲۰۰۰۰۰۰۳",
                "status": "active",
            },
            "profile": {
                "userId": "u-pro-001",
                "displayName": "مریم محمدی",
                "city": "تهران",
                "occupation": "کارشناس حقوقی",
                "completionPercent": 85,
                "avatarUrl": None,
            },
            "preferences": {
                "theme": "light",
                "locale": "fa-IR",
                "notifications": {
                    "appointments": True,
                    "contractExpiry": True,
                    "lawyerResponse": True,
                    "paymentStatus": True,
                    "caseUpdate": True,
                    "marketing": False,
                },
            },
        },
        "meta": {"requestId": str(request.state.correlation_id)},
    }


@router.patch("/me")
async def update_profile(request: Request):
    """Update current user profile."""
    return {
        "data": {"status": "updated"},
        "meta": {"requestId": str(request.state.correlation_id)},
    }
