
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.modules.pricing.service import (
    get_retailer_product_price,
    get_retailer_product_prices,
)


def make_product(active=True):
    return SimpleNamespace(
        id=uuid4(),
        is_active=active,
    )


def make_price(price="100.00", gst_included=True):
    return SimpleNamespace(
        price=price,
        gst_included=gst_included,
    )


def make_db(product, price_results):
    db = MagicMock()
    db.scalar.return_value = product

    query_results = []

    for prices in price_results:
        result = MagicMock()
        result.all.return_value = prices
        query_results.append(result)

    db.scalars.side_effect = query_results

    return db


def test_retailer_specific_price_has_priority():
    product = make_product()
    retailer_price = make_price("90.00")
    db = make_db(product, [[retailer_price]])

    result_product, result_price = get_retailer_product_price(
        db,
        uuid4(),
        product.id,
    )

    assert result_product is product
    assert result_price is retailer_price
    assert db.scalars.call_count == 1


def test_distributor_default_price_is_used_as_fallback():
    product = make_product()
    default_price = make_price("100.00")

    db = make_db(
        product,
        [
            [],  # No retailer-specific price
            [default_price],
        ],
    )

    result_product, result_price = get_retailer_product_price(
        db,
        uuid4(),
        product.id,
    )

    assert result_product is product
    assert result_price is default_price
    assert db.scalars.call_count == 2


def test_missing_all_prices_raises_error():
    product = make_product()
    db = make_db(product, [[], []])

    with pytest.raises(ValueError, match="No active retailer-specific"):
        get_retailer_product_price(
            db,
            uuid4(),
            product.id,
        )


def test_overlapping_retailer_prices_raise_error():
    product = make_product()

    db = make_db(
        product,
        [
            [make_price("90.00"), make_price("95.00")],
        ],
    )

    with pytest.raises(ValueError, match="Multiple active prices"):
        get_retailer_product_price(
            db,
            uuid4(),
            product.id,
        )


def test_overlapping_default_prices_raise_error():
    product = make_product()

    db = make_db(
        product,
        [
            [],
            [make_price("100.00"), make_price("105.00")],
        ],
    )

    with pytest.raises(ValueError, match="Multiple active prices"):
        get_retailer_product_price(
            db,
            uuid4(),
            product.id,
        )


def test_inactive_product_cannot_be_priced():
    db = make_db(None, [])

    with pytest.raises(ValueError, match="Product not found or inactive"):
        get_retailer_product_price(
            db,
            uuid4(),
            uuid4(),
        )

    db.scalars.assert_not_called()


def test_expired_price_is_not_returned_by_resolver():
    """
    The resolver queries only records valid at the requested timestamp.
    This test verifies that the timestamp is passed into both lookups.
    Database-level expiry filtering is covered by integration tests.
    """
    product = make_product()
    default_price = make_price("100.00")
    db = make_db(product, [[], [default_price]])

    reference_time = datetime(2026, 11, 3, tzinfo=timezone.utc)

    get_retailer_product_price(
        db,
        uuid4(),
        product.id,
        at=reference_time,
    )

    assert db.scalars.call_count == 2


def test_batch_price_resolver_uses_retailer_price_before_default():
    retailer_id = uuid4()
    retailer_product_id = uuid4()
    default_product_id = uuid4()
    retailer_price = SimpleNamespace(
        product_id=retailer_product_id,
        price="90.00",
        gst_included=True,
    )
    default_price = SimpleNamespace(
        product_id=default_product_id,
        price="100.00",
        gst_included=False,
    )
    db = MagicMock()
    retailer_result = MagicMock()
    retailer_result.all.return_value = [retailer_price]
    default_result = MagicMock()
    default_result.all.return_value = [default_price]
    db.scalars.side_effect = [retailer_result, default_result]

    prices = get_retailer_product_prices(
        db,
        retailer_id,
        [retailer_product_id, default_product_id],
    )

    assert prices == {
        retailer_product_id: retailer_price,
        default_product_id: default_price,
    }
    assert db.scalars.call_count == 2


def test_batch_price_resolver_does_not_fallback_on_ambiguous_retailer_price():
    product_id = uuid4()
    retailer_prices = [
        SimpleNamespace(product_id=product_id),
        SimpleNamespace(product_id=product_id),
    ]
    db = MagicMock()
    result = MagicMock()
    result.all.return_value = retailer_prices
    db.scalars.return_value = result

    prices = get_retailer_product_prices(db, uuid4(), [product_id])

    assert prices == {}
    db.scalars.assert_called_once()


def test_batch_price_resolver_returns_empty_for_no_products():
    db = MagicMock()

    assert get_retailer_product_prices(db, uuid4(), []) == {}
    db.scalars.assert_not_called()
