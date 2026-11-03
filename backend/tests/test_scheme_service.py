from decimal import Decimal

import pytest

from app.modules.schemes.service import (
    DiscountTier,
    calculate_free_quantity,
    calculate_slab_discount,
)


def test_buy_x_get_y_calculation():
    result = calculate_free_quantity(
        purchase_quantity=Decimal("10"),
        buy_quantity=Decimal("10"),
        reward_quantity=Decimal("1"),
    )

    assert result == Decimal("1")


def test_buy_x_get_y_multiple_sets():
    result = calculate_free_quantity(
        purchase_quantity=Decimal("25"),
        buy_quantity=Decimal("10"),
        reward_quantity=Decimal("1"),
    )

    assert result == Decimal("2")


def test_buy_x_get_y_below_threshold():
    result = calculate_free_quantity(
        purchase_quantity=Decimal("9"),
        buy_quantity=Decimal("10"),
        reward_quantity=Decimal("1"),
    )

    assert result == Decimal("0")


def test_highest_eligible_discount_tier():
    tiers = [
        DiscountTier(
            min_quantity=Decimal("5"),
            discount_type="PERCENTAGE",
            discount_value=Decimal("3"),
        ),
        DiscountTier(
            min_quantity=Decimal("10"),
            discount_type="PERCENTAGE",
            discount_value=Decimal("5"),
        ),
    ]

    discount, net_amount = calculate_slab_discount(
        purchase_quantity=Decimal("10"),
        unit_price=Decimal("810"),
        tiers=tiers,
    )

    assert discount == Decimal("405.00")
    assert net_amount == Decimal("7695.00")


def test_discount_below_minimum_quantity():
    tiers = [
        DiscountTier(
            min_quantity=Decimal("5"),
            discount_type="PERCENTAGE",
            discount_value=Decimal("3"),
        ),
    ]

    discount, net_amount = calculate_slab_discount(
        purchase_quantity=Decimal("4"),
        unit_price=Decimal("810"),
        tiers=tiers,
    )

    assert discount == Decimal("0")
    assert net_amount == Decimal("3240.00")


def test_fixed_amount_discount():
    tiers = [
        DiscountTier(
            min_quantity=Decimal("5"),
            discount_type="FIXED_AMOUNT",
            discount_value=Decimal("10"),
        ),
    ]

    discount, net_amount = calculate_slab_discount(
        purchase_quantity=Decimal("5"),
        unit_price=Decimal("100"),
        tiers=tiers,
    )

    assert discount == Decimal("50.00")
    assert net_amount == Decimal("450.00")


def test_negative_purchase_quantity_is_rejected():
    with pytest.raises(ValueError):
        calculate_free_quantity(
            purchase_quantity=Decimal("-1"),
            buy_quantity=Decimal("10"),
            reward_quantity=Decimal("1"),
        )