from fastapi import APIRouter

from app.api.v1.endpoints import retailer_registration, auth
from app.modules.products.router import router as products_router

api_router = APIRouter()

api_router.include_router(retailer_registration.router)
api_router.include_router(products_router)
api_router.include_router(auth.router)


@api_router.get("/health", tags=["Health"])
def api_health_check():
    return {
        "success": True,
        "message": "Orderly API v1 is working",
    }