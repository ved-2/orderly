from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.products.models import Product
from app.modules.pricing.models import RetailerProductPrice


CENT = Decimal("0.01")
ZERO = Decimal("0")
HUNDRED = Decimal("100")


@dataclass(frozen=True)
class PriceQuote:
    quantity_in_pieces: Decimal
    subtotal: Decimal
    taxable_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    gst_included: bool


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_price_quote(
    quantity: Decimal,
    quantity_unit: str,
    price_per_piece: Decimal,
    units_per_case: int,
    gst_rate: Decimal,
    gst_included: bool,
) -> PriceQuote:
    if quantity <= ZERO:
        raise ValueError("Quantity must be greater than zero.")

    if price_per_piece < ZERO:
        raise ValueError("Price cannot be negative.")

    if gst_rate < ZERO or gst_rate > HUNDRED:
        raise ValueError("Invalid GST rate.")

    if units_per_case <= 0:
        raise ValueError("Units per case must be positive.")

    if quantity_unit == "CASE":
        quantity_in_pieces = quantity * units_per_case
    elif quantity_unit == "PIECE":
        quantity_in_pieces = quantity
    else:
        raise ValueError("Unsupported quantity unit.")

    subtotal = money(quantity_in_pieces * price_per_piece)

    if gst_included:
        taxable_amount = money(
            subtotal / (Decimal("1") + gst_rate / HUNDRED)
        )
        tax_amount = money(subtotal - taxable_amount)
        total_amount = subtotal
    else:
        taxable_amount = subtotal
        tax_amount = money(taxable_amount * gst_rate / HUNDRED)
        total_amount = money(taxable_amount + tax_amount)

    return PriceQuote(
        quantity_in_pieces=quantity_in_pieces,
        subtotal=subtotal,
        taxable_amount=taxable_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        gst_included=gst_included,
    )
    
def get_retailer_product_price(
    db: Session,
    retailer_id: UUID,
    product_id: UUID,
    at: datetime | None = None,
) -> tuple[Product, RetailerProductPrice]:

    current_time = at or datetime.now(timezone.utc)

    statement = (
        select(Product, RetailerProductPrice)
        .join(
            RetailerProductPrice,
            RetailerProductPrice.product_id == Product.id,
        )
        .where(
            Product.id == product_id,
            Product.is_active.is_(True),
            RetailerProductPrice.retailer_id == retailer_id,
            RetailerProductPrice.valid_from <= current_time,
            or_(
                RetailerProductPrice.valid_to.is_(None),
                RetailerProductPrice.valid_to > current_time,
            ),
        )
        .order_by(RetailerProductPrice.valid_from.desc())
    )

    results = list(db.execute(statement).all())

    if not results:
        raise ValueError(
            "No active price found for this retailer and product."
        )

    if len(results) > 1:
        raise ValueError(
            "Multiple active prices found. Resolve overlapping price records."
        )

    return results[0]