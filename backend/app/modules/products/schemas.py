from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)


class CatalogueResponse(BaseModel):
    items: list[CatalogueProductResponse]
    total: int
    page: int
    page_size: int