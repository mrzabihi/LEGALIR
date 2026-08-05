"""
LEGALIR Domain Modules — Router aggregation
"""

from fastapi import APIRouter

from app.modules.auth import router as auth_router
from app.modules.user import router as user_router

router = APIRouter()

# Core modules
router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
router.include_router(user_router, prefix="", tags=["User"])

# Future modules (skeleton placeholders):
# router.include_router(plans_router, prefix="/plans", tags=["Plans"])
# router.include_router(subscriptions_router, prefix="/subscriptions", tags=["Subscriptions"])
# router.include_router(conversations_router, prefix="/conversations", tags=["Conversations"])
# router.include_router(documents_router, prefix="/documents", tags=["Documents"])
# router.include_router(contracts_router, prefix="/contracts", tags=["Contracts"])
