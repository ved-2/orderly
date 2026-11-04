from fastapi import APIRouter

from app.api.v1.endpoints import retailer_registration, auth
from app.modules.orders.router import router as orders_router
from app.modules.products.router import router as products_router
from app.modules.products.admin_router import router as distributor_products_router
from app.modules.schemes.admin_router import router as distributor_schemes_router
from app.modules.retailers.admin_router import router as distributor_retailers_router
from app.modules.users.staff_router import router as distributor_staff_router
from app.modules.credit.router import router as credit_router

api_router = APIRouter()

api_router.include_router(retailer_registration.router)
api_router.include_router(distributor_retailers_router)
api_router.include_router(distributor_staff_router)
api_router.include_router(distributor_products_router)
api_router.include_router(distributor_schemes_router)
api_router.include_router(credit_router)
api_router.include_router(products_router)
api_router.include_router(orders_router)
api_router.include_router(auth.router)


@api_router.get("/health", tags=["Health"])
def api_health_check():
    return {
        "success": True,
        "message": "Orderly API v1 is working",
    }