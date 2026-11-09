import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class AssistantRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class AssistantIntent(str, Enum):
    ADD_PRODUCT = "ADD_PRODUCT"
    UPDATE_QUANTITY = "UPDATE_QUANTITY"
    REMOVE_PRODUCT = "REMOVE_PRODUCT"
    QUERY_PRICE_STOCK = "QUERY_PRICE_STOCK"
    REVIEW_ORDER = "REVIEW_ORDER"
    CLEAR_DRAFT = "CLEAR_DRAFT"
    CONFIRM_ORDER = "CONFIRM_ORDER"
    CLARIFY = "CLARIFY"
    GENERAL_CHAT = "GENERAL_CHAT"


class QuantityUnit(str, Enum):
    CASE = "CASE"
    PIECE = "PIECE"


class MatchStatus(str, Enum):
    MATCHED = "MATCHED"
    AMBIGUOUS = "AMBIGUOUS"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    NOT_FOUND = "NOT_FOUND"


class AttributeStatus(str, Enum):
    KNOWN = "KNOWN"
    UNKNOWN = "UNKNOWN"
    AMBIGUOUS = "AMBIGUOUS"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class ClarificationStage(str, Enum):
    NEW_REQUEST = "NEW_REQUEST"
    AWAITING_BRAND = "AWAITING_BRAND"
    AWAITING_VARIANT = "AWAITING_VARIANT"
    AWAITING_PACKAGE_SIZE = "AWAITING_PACKAGE_SIZE"
    AWAITING_SELLING_UNIT = "AWAITING_SELLING_UNIT"
    AWAITING_QUANTITY = "AWAITING_QUANTITY"
    PRODUCT_IDENTIFIED = "PRODUCT_IDENTIFIED"
    ADDED_TO_DRAFT = "ADDED_TO_DRAFT"
    CANCELLED = "CANCELLED"


class ClarificationOption(BaseModel):
    product_id: str
    sku: str
    name: str
    brand_name: str
    pack_size: float
    pack_unit: str
    units_per_case: int = 1
    price: float | None = None
    is_in_stock: bool = True
    quantity_available: int = 0


class PendingProductRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    raw_query: str = ""
    category: str | None = None
    product_name: str | None = None
    brand_id: str | None = None
    brand_name: str | None = None
    variant_id: str | None = None
    variant_name: str | None = None
    pack_size: float | None = None
    pack_unit: str | None = None
    selling_unit: QuantityUnit | None = None
    quantity: int | None = None
    quantity_unit: QuantityUnit | None = None
    confirmed_product_id: str | None = None
    stage: ClarificationStage = ClarificationStage.NEW_REQUEST
    brand_status: AttributeStatus = AttributeStatus.UNKNOWN
    variant_status: AttributeStatus = AttributeStatus.UNKNOWN
    pack_size_status: AttributeStatus = AttributeStatus.UNKNOWN
    selling_unit_status: AttributeStatus = AttributeStatus.UNKNOWN
    quantity_status: AttributeStatus = AttributeStatus.UNKNOWN
    candidate_product_ids: list[str] = Field(default_factory=list)
    active_question: str | None = None
    active_options: list[ClarificationOption] = Field(default_factory=list)


class ProductCardInfo(BaseModel):
    product_id: str
    sku: str
    name: str
    brand_name: str
    category: str
    pack_size: float
    pack_unit: str
    units_per_case: int
    price: float | None = None
    mrp: float | None = None
    is_in_stock: bool = True
    quantity_available: int = 0
    cart_quantity: int = 0
    cart_unit: QuantityUnit = QuantityUnit.CASE
    image_url: str | None = None
    scheme_label: str | None = None


class ExtractedOrderItem(BaseModel):
    raw_text: str
    product_id: str | None = None
    sku: str | None = None
    product_name: str | None = None
    brand_name: str | None = None
    pack_size: float | None = None
    pack_unit: str | None = None
    quantity: int = 1
    quantity_unit: QuantityUnit = QuantityUnit.CASE
    confidence: float = 0.0
    unit_price: float | None = None
    status: MatchStatus = MatchStatus.MATCHED
    clarification_question: str | None = None
    candidate_options: list[ClarificationOption] = Field(default_factory=list)


class CartActionType(str, Enum):
    ADD = "ADD"
    UPDATE = "UPDATE"
    REMOVE = "REMOVE"
    CLEAR = "CLEAR"
    SYNC = "SYNC"


class CartAction(BaseModel):
    action: CartActionType
    product_id: str | None = None
    sku: str | None = None
    name: str | None = None
    brand_name: str | None = None
    pack_size: float | None = None
    pack_unit: str | None = None
    units_per_case: int = 1
    price: float = 0.0
    quantity: int = 1
    quantity_unit: QuantityUnit = QuantityUnit.CASE
    quantity_available: int = 0
    gst_included: bool = True
    image_url: str | None = None


class AssistantMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: AssistantRole
    content: str
    audio_text: str | None = None
    intent: AssistantIntent = AssistantIntent.GENERAL_CHAT
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    suggested_products: list[ProductCardInfo] = Field(default_factory=list)
    extracted_items: list[ExtractedOrderItem] = Field(default_factory=list)
    pending_clarification: str | None = None


class AssistantSessionState(BaseModel):
    session_id: str
    retailer_id: str
    user_id: str
    mode: str = "CHAT"  # "CHAT" or "VOICE"
    messages: list[AssistantMessage] = Field(default_factory=list)
    draft_items: list[ExtractedOrderItem] = Field(default_factory=list)
    pending_question: str | None = None
    pending_options: list[ClarificationOption] = Field(default_factory=list)
    pending_request: PendingProductRequest | None = None
    pending_items_queue: list[Any] = Field(default_factory=list)
    is_confirmed: bool = False
    created_order_id: str | None = None
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    mode: str = Field(default="CHAT", description="'CHAT' or 'VOICE'")
    language: str = Field(default="auto", description="'auto', 'hi', 'en', or 'hinglish'")
    cart_snapshot: list[dict[str, Any]] | None = None
    retailer_id: str | None = None


class AssistantChatResponse(BaseModel):
    session_id: str
    reply: str
    audio_text: str
    intent: AssistantIntent
    messages: list[AssistantMessage]
    suggested_products: list[ProductCardInfo] = Field(default_factory=list)
    cart_actions: list[CartAction] = Field(default_factory=list)
    is_order_confirmed: bool = False
    created_order_id: str | None = None
    pending_clarification: str | None = None
    pending_request: PendingProductRequest | None = None


class GroqExtractedItem(BaseModel):
    product_phrase: str
    quantity: int = 1
    quantity_unit: QuantityUnit = QuantityUnit.PIECE
    quantity_explicit: bool = False
    quantity_unit_explicit: bool = False
    pack_size_hint: float | None = None
    pack_unit_hint: str | None = None


class GroqNLUOutput(BaseModel):
    intent: AssistantIntent
    items: list[GroqExtractedItem] = Field(default_factory=list)
    target_product_to_modify: str | None = None
    clarification_choice: Any | None = None
    chat_reply: str
    audio_reply: str


class DraftItemInput(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1)
    quantity_unit: QuantityUnit = QuantityUnit.PIECE
    retailer_id: str | None = None


class DraftResponse(BaseModel):
    items: list[ExtractedOrderItem] = Field(default_factory=list)
    item_count: int = 0
    subtotal: float = 0.0
    currency: str = "INR"


class OrderConfirmRequest(BaseModel):
    customer_note: str | None = None
    cart_snapshot: list[dict[str, Any]] | None = None
    retailer_id: str | None = None


class OrderConfirmResponse(BaseModel):
    order_id: str
    order_number: str
    status: str
    total_amount: float
    items_count: int
    message: str

