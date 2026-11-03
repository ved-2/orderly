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
