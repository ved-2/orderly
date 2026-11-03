
from fastapi import FastAPI
from app.api.v1.router import api_router

app = FastAPI(
    title="Orderly API",
    description="B2B FMCG Distribution Management Platform",
    version="1.0.0",
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "success": True,
        "message": "Orderly API is running",
        "status": "healthy",
    }
