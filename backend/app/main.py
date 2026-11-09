import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title="Orderly API",
    description="B2B FMCG Distribution Management Platform",
    version="1.0.0",
)

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if settings.CORS_ORIGINS:
    for origin in settings.CORS_ORIGINS.split(","):
        cleaned = origin.strip()
        if cleaned and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
def root():
    return {
        "success": True,
        "message": "Orderly B2B FMCG Distribution API is running",
        "docs_url": "/docs",
        "health_url": "/health",
        "api_v1_url": "/api/v1",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "success": True,
        "message": "Orderly API is running",
        "status": "healthy",
    }
