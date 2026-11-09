from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.modules.products.service import get_retailer_catalogue


def test_catalogue_requires_registered_retailer():
    db = MagicMock()
    db.scalar.return_value = None

    with pytest.raises(ValueError, match="No retailer account is linked"):
        get_retailer_catalogue(db, uuid4())


def test_catalogue_rejects_inactive_retailer():
    retailer = SimpleNamespace(is_active=False, registration_status="ACTIVE")
    db = MagicMock()
    db.scalar.side_effect = [uuid4(), retailer]

    with pytest.raises(ValueError, match="Retailer account is inactive"):
        get_retailer_catalogue(db, uuid4())


def test_catalogue_batches_price_and_inventory_lookups():
    retailer_id = uuid4()
    retailer = SimpleNamespace(is_active=True, registration_status="ACTIVE")
    first_product = SimpleNamespace(
        id=uuid4(),
        sku="SKU-1",
        name="Product 1",
        description=None,
        category="Food",
        brand_id=uuid4(),
        pack_size=1,
        pack_unit="kg",
        units_per_case=10,
        hsn_code=None,
        gst_rate=None,
    )
    second_product = SimpleNamespace(
        id=uuid4(),
        sku="SKU-2",
        name="Product 2",
        description=None,
        category="Food",
        brand_id=uuid4(),
        pack_size=1,
        pack_unit="kg",
        units_per_case=10,
        hsn_code=None,
        gst_rate=None,
    )
    retailer_price = SimpleNamespace(
        product_id=first_product.id,
        price=90,
        gst_included=True,
    )
    default_price = SimpleNamespace(
        product_id=second_product.id,
        price=100,
        gst_included=False,
    )
    product_result = MagicMock()
    product_result.all.return_value = [
        (first_product, "Brand"),
        (second_product, "Brand"),
    ]
    inventory_result = MagicMock()
    inventory_result.all.return_value = [(first_product.id, 12, 2)]
    schemes_result = MagicMock()
    schemes_result.all.return_value = []

    retailer_prices_result = MagicMock()
    retailer_prices_result.all.return_value = [retailer_price]
    default_prices_result = MagicMock()
    default_prices_result.all.return_value = [default_price]

    db = MagicMock()
    db.scalar.side_effect = [retailer_id, retailer, 2]
    db.execute.side_effect = [product_result, inventory_result, schemes_result]
    db.scalars.side_effect = [retailer_prices_result, default_prices_result]

    response = get_retailer_catalogue(db, uuid4(), page_size=20)

    assert response["total"] == 2
    assert [item["price"] for item in response["items"]] == [90, 100]
    assert [item["quantity_available"] for item in response["items"]] == [10, 0]
    assert db.execute.call_count == 3
    assert db.scalars.call_count == 2
