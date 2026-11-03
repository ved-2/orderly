from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, ConfigDict,Field


class CatalogueProductResponse(BaseModel):
    id: UUID
    sku: str
    name: str
    description: str | None
    category: str

    brand_id: UUID
    brand_name: str

    pack_size: Decimal
    pack_unit: str
    units_per_case: int

    hsn_code: str | None
    gst_rate: Decimal | None

    price: Decimal | None
    gst_included: bool | None

    quantity_on_hand: Decimal
    quantity_reserved: Decimal
    quantity_available: Decimal

    model_config = ConfigDict(from_attributes=True)


class CatalogueResponse(BaseModel):
    items: list[CatalogueProductResponse]
    total: int
    page: int
    page_size: int
    



class ProductImageSignatureResponse(BaseModel):
    cloud_name: str
    api_key: str
    timestamp: int
    public_id: str
    signature: str
    allowed_formats: str


class ProductImageConfirmRequest(BaseModel):
    public_id: str = Field(min_length=1, max_length=255)


class ProductImageResponse(BaseModel):
    product_id: str
    image_url: str
    image_public_id: str