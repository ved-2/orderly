
from fastapi import APIRouter

from app.api.v1.endpoints import retailer_registration


api_router = APIRouter()
api_router.include_router(retailer_registration.router)


@api_router.get("/health", tags=["Health"])
def api_health_check():
    return {
        "success": True,
        "message": "Orderly API v1 is working",
    }
