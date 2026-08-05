"""
LEGALIR Backend API — FastAPI Application Skeleton
Phase 0: Health, Config, Error Contract, CORS baseline
"""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.modules import router as modules_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown."""
    # Startup
    print(f"LEGALIR Backend starting — env: {settings.environment}")
    yield
    # Shutdown
    print("LEGALIR Backend shutting down")


app = FastAPI(
    title="LEGALIR API",
    version="0.0.0",
    description="پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران",
    lifespan=lifespan,
)

# CORS — restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Correlation ID middleware
@app.middleware("http")
async def correlation_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    return response


# Error contract
class ApiError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, retryable: bool = False):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "correlationId": getattr(request.state, "correlation_id", str(uuid.uuid4())),
            "retryable": exc.retryable,
            "nextAction": None,
        },
    )


# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}


@app.get("/ready")
async def ready():
    """Readiness probe — checks DB, cache, etc."""
    # In Phase 0, always return ready
    return {"status": "ready", "checks": {"database": "ok", "cache": "ok"}}


# Mount module routers
app.include_router(modules_router, prefix="/api")
