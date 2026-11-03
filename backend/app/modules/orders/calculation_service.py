from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from app.modules.schemes.service import (
    calculate_free_quantity,
    DiscountTier,
    calculate_slab_discount,
)


ZERO = Decimal("0")
HUNDRED = Decimal("100")
CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class CalculatedOrderLine:
    quantity: Decimal
    quantity_unit: str
    quantity_in_pieces: Decimal
    free_quantity: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    scheme_id: object | None


def calculate_order_line(
    product,
    price_record,
    quantity: Decimal,
    quantity_unit: str,
    scheme=None,
    scheme_rules: list | None = None,
) -> CalculatedOrderLine:
    """
    Calculate one order line using trusted database records.

    Price is stored per individual piece.
    Scheme discounts are applied to the displayed selling amount.
    """

    if quantity <= ZERO:
        raise ValueError("Quantity must be greater than zero.")

    if quantity_unit not in ("CASE", "PIECE"):
        raise ValueError("Unsupported quantity unit.")

    if product.units_per_case <= 0:
        raise ValueError("Invalid product case configuration.")

    price = Decimal(price_record.price)
    gst_rate = Decimal(product.gst_rate or ZERO)

    if price < ZERO:
        raise ValueError("Product price cannot be negative.")

    if gst_rate < ZERO or gst_rate > HUNDRED:
        raise ValueError("Invalid GST rate.")

    if quantity_unit == "CASE":
        quantity_in_pieces = quantity * product.units_per_case
    else:
        quantity_in_pieces = quantity

    subtotal = money(quantity_in_pieces * price)
    discount_amount = ZERO
    free_quantity = ZERO
    scheme_id = None

    scheme_rules = scheme_rules or []
    if scheme is None and scheme_rules:
        raise ValueError("Scheme is required when rules are provided.")
    if scheme is not None:
        if not scheme.is_active:
            raise ValueError("Scheme is not active.")
        if not scheme_rules:
            raise ValueError("Scheme rules are required.")
        if any(
            rule.product_id != product.id
            or rule.quantity_unit != quantity_unit
            for rule in scheme_rules
        ):
            raise ValueError("Scheme rules do not match this product or unit.")

        if scheme.scheme_type == "BUY_X_GET_Y":
            if len(scheme_rules) != 1:
                raise ValueError("Buy X Get Y requires exactly one rule.")
            rule = scheme_rules[0]
            if (
                rule.buy_quantity is None
                or rule.reward_quantity is None
            ):
                raise ValueError("Incomplete Buy X Get Y rule.")

            if (
                rule.reward_product_id is not None
                and rule.reward_product_id != product.id
            ):
                raise ValueError(
                    "Different-product free goods are not supported yet."
                )

            free_quantity = calculate_free_quantity(
                purchase_quantity=quantity,
                buy_quantity=Decimal(rule.buy_quantity),
                reward_quantity=Decimal(rule.reward_quantity),
            )

        elif scheme.scheme_type == "SLAB_DISCOUNT":
            if any(
                rule.min_quantity is None
                or rule.discount_type is None
                or rule.discount_value is None
                for rule in scheme_rules
            ):
                raise ValueError("Incomplete slab discount rule.")

            scheme_unit_price = (
                price * product.units_per_case
                if quantity_unit == "CASE"
                else price
            )

            tiers = [
                DiscountTier(
                    min_quantity=Decimal(rule.min_quantity),
                    discount_type=rule.discount_type,
                    discount_value=Decimal(rule.discount_value),
                )
                for rule in scheme_rules
            ]

            discount_amount, _ = calculate_slab_discount(
                purchase_quantity=quantity,
                unit_price=scheme_unit_price,
                tiers=tiers,
            )

        else:
            raise ValueError("Unsupported scheme type.")

        scheme_id = scheme.id

    discounted_amount = money(subtotal - discount_amount)

    if price_record.gst_included:
        taxable_amount = money(
            discounted_amount / (Decimal("1") + gst_rate / HUNDRED)
        )
        tax_amount = money(discounted_amount - taxable_amount)
        total_amount = discounted_amount
    else:
        taxable_amount = discounted_amount
        tax_amount = money(taxable_amount * gst_rate / HUNDRED)
        total_amount = money(taxable_amount + tax_amount)

    return CalculatedOrderLine(
        quantity=quantity,
        quantity_unit=quantity_unit,
        quantity_in_pieces=quantity_in_pieces,
        free_quantity=free_quantity,
        subtotal=subtotal,
        discount_amount=discount_amount,
        taxable_amount=taxable_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        scheme_id=scheme_id,
    )