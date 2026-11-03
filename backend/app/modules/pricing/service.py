from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.products.models import Product
from app.modules.pricing.models import RetailerProductPrice
from app.modules.pricing.default_price_models import DistributorProductPrice


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


def _find_active_price(
    db: Session,
    model,
    product_id: UUID,
    at: datetime,
    retailer_id: UUID | None = None,
):
    statement = select(model).where(
        model.product_id == product_id,
        model.valid_from <= at,
        or_(
            model.valid_to.is_(None),
            model.valid_to > at,
        ),
    )

    if retailer_id is not None:
        statement = statement.where(
            model.retailer_id == retailer_id
        )

    statement = statement.order_by(model.valid_from.desc())

    results = list(db.scalars(statement).all())

    if len(results) > 1:
        raise ValueError(
            "Multiple active prices found. "
            "Resolve overlapping price records."
        )

    return results[0] if results else None


def get_retailer_product_price(
    db: Session,
    retailer_id: UUID,
    product_id: UUID,
    at: datetime | None = None,
) -> tuple[Product, RetailerProductPrice | DistributorProductPrice]:

    current_time = at or datetime.now(timezone.utc)

    product = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.is_active.is_(True),
        )
    )

    if product is None:
        raise ValueError("Product not found or inactive.")

    # Priority 1: Retailer-specific price.
    retailer_price = _find_active_price(
        db=db,
        model=RetailerProductPrice,
        product_id=product_id,
        retailer_id=retailer_id,
        at=current_time,
    )

    if retailer_price is not None:
        return product, retailer_price

    # Priority 2: Distributor default price.
    default_price = _find_active_price(
        db=db,
        model=DistributorProductPrice,
        product_id=product_id,
        at=current_time,
    )

    if default_price is not None:
        return product, default_price

    raise ValueError(
        "No active retailer-specific or distributor default price "
        "is configured for this product."
    )