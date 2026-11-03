from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.modules.orders.calculation_service import calculate_order_line


def make_product():
    return SimpleNamespace(
        id=uuid4(),
        units_per_case=96,
        gst_rate=Decimal("0"),
    )


def make_price():
    return SimpleNamespace(
        price=Decimal("8.10"),
        gst_included=False,
    )


def test_order_line_without_scheme():
    result = calculate_order_line(
        product=make_product(),
        price_record=make_price(),
        quantity=Decimal("10"),
        quantity_unit="CASE",
    )

    assert result.quantity_in_pieces == Decimal("960")
    assert result.subtotal == Decimal("7776.00")
    assert result.discount_amount == Decimal("0")
    assert result.total_amount == Decimal("7776.00")


def test_buy_x_get_y_scheme():
    product = make_product()

    scheme = SimpleNamespace(
        id=uuid4(),
        is_active=True,
        scheme_type="BUY_X_GET_Y",
    )

    rule = SimpleNamespace(
        product_id=product.id,
        quantity_unit="CASE",
        buy_quantity=Decimal("10"),
        reward_quantity=Decimal("1"),
        reward_product_id=product.id,
    )

    result = calculate_order_line(
        product=product,
        price_record=make_price(),
        quantity=Decimal("10"),
        quantity_unit="CASE",
        scheme=scheme,
        scheme_rules=[rule],
    )

    assert result.free_quantity == Decimal("1")
    assert result.discount_amount == Decimal("0")
    assert result.total_amount == Decimal("7776.00")


def test_highest_slab_discount():
    product = make_product()

    scheme = SimpleNamespace(
        id=uuid4(),
        is_active=True,
        scheme_type="SLAB_DISCOUNT",
    )

    rules = [
        SimpleNamespace(
            product_id=product.id,
            quantity_unit="CASE",
            min_quantity=Decimal("5"),
            discount_type="PERCENTAGE",
            discount_value=Decimal("3"),
        ),
        SimpleNamespace(
            product_id=product.id,
            quantity_unit="CASE",
            min_quantity=Decimal("10"),
            discount_type="PERCENTAGE",
            discount_value=Decimal("5"),
        ),
    ]

    result = calculate_order_line(
        product=product,
        price_record=make_price(),
        quantity=Decimal("10"),
        quantity_unit="CASE",
        scheme=scheme,
        scheme_rules=rules,
    )

    assert result.discount_amount == Decimal("388.80")
    assert result.total_amount == Decimal("7387.20")


def test_gst_included_price():
    product = make_product()
    product.gst_rate = Decimal("18")

    price = SimpleNamespace(
        price=Decimal("118"),
        gst_included=True,
    )

    result = calculate_order_line(
        product=product,
        price_record=price,
        quantity=Decimal("1"),
        quantity_unit="PIECE",
    )

    assert result.taxable_amount == Decimal("100.00")
    assert result.tax_amount == Decimal("18.00")
    assert result.total_amount == Decimal("118.00")


def test_different_product_free_reward_is_rejected():
    product = make_product()

    scheme = SimpleNamespace(
        id=uuid4(),
        is_active=True,
        scheme_type="BUY_X_GET_Y",
    )

    rule = SimpleNamespace(
        product_id=product.id,
        quantity_unit="CASE",
        buy_quantity=Decimal("10"),
        reward_quantity=Decimal("1"),
        reward_product_id=uuid4(),
    )

    with pytest.raises(ValueError, match="Different-product"):
        calculate_order_line(
            product=product,
            price_record=make_price(),
            quantity=Decimal("10"),
            quantity_unit="CASE",
            scheme=scheme,
            scheme_rules=[rule],
        )


def test_non_positive_quantity_is_rejected():
    with pytest.raises(ValueError):
        calculate_order_line(
            product=make_product(),
            price_record=make_price(),
            quantity=Decimal("0"),
            quantity_unit="CASE",
        )