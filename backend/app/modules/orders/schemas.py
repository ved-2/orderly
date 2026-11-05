from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


class OrderItemCreate(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    quantity_unit: Literal["CASE", "PIECE"]

    model_config = ConfigDict(extra="forbid")


class OrderCreate(BaseModel):
    retailer_id: UUID
    items: list[OrderItemCreate] = Field(min_length=1, max_length=100)
    customer_note: str | None = Field(default=None, max_length=1000)
    idempotency_key: str = Field(min_length=16, max_length=100)

    model_config = ConfigDict(extra="forbid")

class OrderApproveRequest(BaseModel):
    warehouse_id: UUID | None = None
    desk_note: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(extra="forbid")


class OrderRejectRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)

    model_config = ConfigDict(extra="forbid")


class OrderHoldRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)

    model_config = ConfigDict(extra="forbid")


class OrderUpdateItemsRequest(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1, max_length=100)

    model_config = ConfigDict(extra="forbid")
