"""
EcoSentinel FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.system import router as system_router
from app.api.v1.investigation import (
    fer_router, findings_router, watch_router, cases_router
)
from app.api.v1.eo import router as eo_router

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables and baseline seed exist
    Base.metadata.create_all(bind=engine)
    try:
        from app.seed_mayawana import seed_mayawana
        seed_mayawana()
    except Exception:
        pass
    yield


app = FastAPI(
    title="EcoSentinel API",
    description="Environmental Intelligence Platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS
cors_origins = settings.cors_origins_list
allow_all = "*" in cors_origins or settings.cors_origins.strip() == "*"

if allow_all:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Register routers under /api/v1
PREFIX = "/api/v1"
app.include_router(auth_router, prefix=PREFIX)
app.include_router(projects_router, prefix=PREFIX)
app.include_router(fer_router, prefix=PREFIX)
app.include_router(findings_router, prefix=PREFIX)
app.include_router(watch_router, prefix=PREFIX)
app.include_router(cases_router, prefix=PREFIX)
app.include_router(eo_router, prefix=PREFIX)
app.include_router(system_router, prefix=PREFIX)


@app.get("/health")
def health_check():
    """Liveness probe for Google Cloud Run."""
    return {"status": "ok", "app": "EcoSentinel", "environment": settings.app_env}


@app.get("/")
def root():
    return {
        "name": "EcoSentinel API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/health",
        "api_health": "/api/v1/health",
        "status": "/api/v1/system/status",
    }
