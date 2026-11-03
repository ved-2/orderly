from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.schemes.models import (
    Scheme,
    SchemeRule,
    SchemeRetailer,
)


ZERO = Decimal("0")
ONE_HUNDRED = Decimal("100")
TWO_DECIMAL_PLACES = Decimal("0.01")


@dataclass(frozen=True)
class DiscountTier:
    min_quantity: Decimal
    discount_type: str
    discount_value: Decimal


def calculate_free_quantity(
    purchase_quantity: Decimal,
    buy_quantity: Decimal,
    reward_quantity: Decimal,
) -> Decimal:
    """
    Calculate free quantity for a BUY_X_GET_Y scheme.

    Example:
        Buy 10 cases, get 1 free.
        Purchase 25 cases -> 2 free cases.
    """

    if purchase_quantity < ZERO:
        raise ValueError("Purchase quantity cannot be negative.")

    if buy_quantity <= ZERO:
        raise ValueError("Buy quantity must be greater than zero.")

    if reward_quantity <= ZERO:
        raise ValueError("Reward quantity must be greater than zero.")

    eligible_sets = (
        purchase_quantity / buy_quantity
    ).to_integral_value(rounding=ROUND_FLOOR)

    return eligible_sets * reward_quantity


def calculate_slab_discount(
    purchase_quantity: Decimal,
    unit_price: Decimal,
    tiers: list[DiscountTier],
) -> tuple[Decimal, Decimal]:
    """
    Calculate discount using the highest eligible slab.

    FIXED_AMOUNT means discount per purchased quantity unit.
    For example, ₹5 per case when purchasing 5 or more cases.

    Returns:
        (discount_amount, net_amount_before_tax)
    """

    if purchase_quantity < ZERO:
        raise ValueError("Purchase quantity cannot be negative.")

    if unit_price < ZERO:
        raise ValueError("Unit price cannot be negative.")

    if not tiers:
        raise ValueError("At least one discount tier is required.")

    for tier in tiers:
        if tier.min_quantity <= ZERO:
            raise ValueError("Minimum quantity must be greater than zero.")

        if tier.discount_value <= ZERO:
            raise ValueError("Discount value must be greater than zero.")

        if tier.discount_type not in ("PERCENTAGE", "FIXED_AMOUNT"):
            raise ValueError("Unsupported discount type.")

        if (
            tier.discount_type == "PERCENTAGE"
            and tier.discount_value > ONE_HUNDRED
        ):
            raise ValueError("Percentage discount cannot exceed 100.")

    eligible_tiers = [
        tier
        for tier in tiers
        if purchase_quantity >= tier.min_quantity
    ]

    subtotal = purchase_quantity * unit_price

    if not eligible_tiers:
        return ZERO, subtotal.quantize(TWO_DECIMAL_PLACES)

    selected_tier = max(
        eligible_tiers,
        key=lambda tier: tier.min_quantity,
    )

    if selected_tier.discount_type == "PERCENTAGE":
        discount = (
            subtotal * selected_tier.discount_value / ONE_HUNDRED
        )
    else:
        discount = (
            purchase_quantity * selected_tier.discount_value
        )

    discount = min(discount, subtotal)

    discount = discount.quantize(
        TWO_DECIMAL_PLACES,
        rounding=ROUND_HALF_UP,
    )

    net_amount = (subtotal - discount).quantize(
        TWO_DECIMAL_PLACES,
        rounding=ROUND_HALF_UP,
    )

    return discount, net_amount
  
def get_eligible_scheme_rules(
    db: Session,
    retailer_id: UUID,
    product_id: UUID,
    quantity_unit: str,
    at: datetime | None = None,
) -> list[tuple[Scheme, SchemeRule]]:
    """
    Fetch active and eligible schemes for a retailer and product.

    Does not apply or combine schemes.
    """

    if quantity_unit not in ("CASE", "PIECE"):
        raise ValueError("Unsupported quantity unit.")

    current_time = at or datetime.now(timezone.utc)

    eligible_retailer_scheme = (
        select(SchemeRetailer.scheme_id)
        .where(SchemeRetailer.retailer_id == retailer_id)
    )

    statement = (
        select(Scheme, SchemeRule)
        .join(
            SchemeRule,
            SchemeRule.scheme_id == Scheme.id,
        )
        .where(
            SchemeRule.product_id == product_id,
            SchemeRule.quantity_unit == quantity_unit,
            Scheme.is_active.is_(True),
            Scheme.valid_from <= current_time,
            Scheme.valid_to > current_time,
            or_(
                Scheme.applies_to_all_retailers.is_(True),
                Scheme.id.in_(eligible_retailer_scheme),
            ),
        )
        .order_by(
            Scheme.code,
            SchemeRule.tier_number,
        )
    )

    return list(db.execute(statement).all())