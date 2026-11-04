from pydantic import BaseModel, Field


class RetailerRegistrationRequest(BaseModel):
    shop_name: str = Field(min_length=2, max_length=150)
    owner_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=20, pattern=r"^\+?[0-9]{10,15}$")
    address: str = Field(min_length=5, max_length=300)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    pincode: str = Field(pattern=r"^[0-9]{6}$")


class RetailerRegistrationResponse(BaseModel):
    retailer_id: str
    retailer_code: str
    shop_name: str
    registration_status: str
    credit_limit: float
    can_place_orders: bool
    duplicate_flag: bool
from decimal import Decimal
from typing import Literal
from pydantic import ConfigDict


class RetailerVerifyRequest(BaseModel):
    action: Literal["APPROVE", "REJECT", "SUSPEND"]
    credit_limit: Decimal | None = Field(default=None, ge=0)
    payment_terms_days: int | None = Field(default=None, ge=1, le=90)
    rejection_reason: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(extra="forbid")


class RetailerPaymentRequest(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    payment_mode: Literal["CASH", "UPI", "CHEQUE", "BANK_TRANSFER"]
    reference_note: str | None = Field(default=None, max_length=300)

    model_config = ConfigDict(extra="forbid")


class CreditLimitUpdateRequest(BaseModel):
    credit_limit: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    payment_terms_days: int | None = Field(default=None, ge=1, le=90)
    note: str | None = Field(default=None, max_length=300)

    model_config = ConfigDict(extra="forbid")
