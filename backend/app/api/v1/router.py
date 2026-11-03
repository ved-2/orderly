
from fastapi import APIRouter

api_router = APIRouter()


@api_router.get("/health", tags=["Health"])
def api_health_check():
    return {
        "success": True,
        "message": "Orderly API v1 is working",
    }
