from decimal import Decimal

import pytest

from app.modules.pricing.service import calculate_price_quote


def test_case_quantity_conversion():
    result = calculate_price_quote(
        quantity=Decimal("10"),
        quantity_unit="CASE",
        price_per_piece=Decimal("8.10"),
        units_per_case=96,
        gst_rate=Decimal("0"),
        gst_included=False,
    )

    assert result.quantity_in_pieces == Decimal("960")
    assert result.subtotal == Decimal("7776.00")
    assert result.total_amount == Decimal("7776.00")


def test_piece_quantity_conversion():
    result = calculate_price_quote(
        quantity=Decimal("10"),
        quantity_unit="PIECE",
        price_per_piece=Decimal("8.10"),
        units_per_case=96,
        gst_rate=Decimal("0"),
        gst_included=False,
    )

    assert result.quantity_in_pieces == Decimal("10")
    assert result.total_amount == Decimal("81.00")


def test_gst_included_price():
    result = calculate_price_quote(
        quantity=Decimal("1"),
        quantity_unit="PIECE",
        price_per_piece=Decimal("118"),
        units_per_case=96,
        gst_rate=Decimal("18"),
        gst_included=True,
    )

    assert result.taxable_amount == Decimal("100.00")
    assert result.tax_amount == Decimal("18.00")
    assert result.total_amount == Decimal("118.00")


def test_gst_excluded_price():
    result = calculate_price_quote(
        quantity=Decimal("1"),
        quantity_unit="PIECE",
        price_per_piece=Decimal("100"),
        units_per_case=96,
        gst_rate=Decimal("18"),
        gst_included=False,
    )

    assert result.taxable_amount == Decimal("100.00")
    assert result.tax_amount == Decimal("18.00")
    assert result.total_amount == Decimal("118.00")


def test_invalid_quantity():
    with pytest.raises(ValueError):
        calculate_price_quote(
            quantity=Decimal("-1"),
            quantity_unit="CASE",
            price_per_piece=Decimal("8.10"),
            units_per_case=96,
            gst_rate=Decimal("0"),
            gst_included=False,
        )


def test_invalid_quantity_unit():
    with pytest.raises(ValueError):
        calculate_price_quote(
            quantity=Decimal("1"),
            quantity_unit="PALLET",
            price_per_piece=Decimal("8.10"),
            units_per_case=96,
            gst_rate=Decimal("0"),
            gst_included=False,
        )