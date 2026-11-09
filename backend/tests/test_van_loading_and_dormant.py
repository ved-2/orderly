from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.modules.orders.models import Order, OrderItem
from app.modules.products.models import Product, Brand
from app.modules.retailers.models import Retailer
from app.modules.credit.models import CreditAccount
from app.modules.orders.router import get_van_loading_sheet
from app.modules.retailers.admin_router import list_dormant_retailers
from app.modules.users.models import User


def test_van_loading_sheet_empty():
    db = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = []
    db.scalars.return_value = scalars_mock

    user = User(id=uuid4(), email="desk@orderly.com", role="ORDER_DESK", is_active=True)
    res = get_van_loading_sheet(
        status_filter="APPROVED",
        city=None,
        delivery_date=None,
        format_type="json",
        db=db,
        current_user=user,
    )

    assert res["summary"]["total_orders"] == 0
    assert res["summary"]["total_cases"] == 0
    assert len(res["items"]) == 0


def test_van_loading_sheet_aggregates_items():
    ret_id = uuid4()
    order_id = uuid4()
    prod_id = uuid4()

    mock_order = Order(
        id=order_id,
        order_number="ORD-TEST-001",
        retailer_id=ret_id,
        status="APPROVED",
        total_amount=Decimal("5000.00"),
        created_at=datetime.now(timezone.utc),
        approved_at=datetime.now(timezone.utc),
    )
    mock_retailer = Retailer(
        id=ret_id,
        retailer_code="RET-001",
        shop_name="Gupta Kirana",
        owner_name="Ramesh Gupta",
        phone="9876543210",
        address="Shop 4, Market Road",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        is_active=True,
        registration_status="ACTIVE",
    )
    mock_prod = Product(
        id=prod_id,
        sku="DD-OIL-001",
        name="Sunflower Oil 1L",
        category="Cooking Oil",
        units_per_case=12,
        pack_size=Decimal("1"),
        pack_unit="L",
    )
    mock_item = OrderItem(
        id=uuid4(),
        order_id=order_id,
        product_id=prod_id,
        product_name="Sunflower Oil 1L",
        quantity=Decimal("10"),
        free_quantity=Decimal("1"),
        quantity_unit="CASE",
        unit_price=Decimal("1500.00"),
        line_total=Decimal("15000.00"),
    )

    db = MagicMock()
    orders_mock = MagicMock()
    orders_mock.all.return_value = [mock_order]
    retailers_mock = MagicMock()
    retailers_mock.all.return_value = [mock_retailer]

    db.scalars.side_effect = [orders_mock, retailers_mock]

    items_res = MagicMock()
    items_res.all.return_value = [(mock_item, mock_prod, "DailyDrop")]
    db.execute.return_value = items_res

    user = User(id=uuid4(), email="desk@orderly.com", role="ORDER_DESK", is_active=True)
    res = get_van_loading_sheet(
        status_filter="APPROVED",
        city=None,
        delivery_date=None,
        format_type="json",
        db=db,
        current_user=user,
    )

    assert res["summary"]["total_orders"] == 1
    assert res["summary"]["total_cases"] == 11  # 10 billed + 1 free
    assert len(res["items"]) == 1
    assert res["items"][0]["sku"] == "DD-OIL-001"
    assert res["items"][0]["total_cases_billed"] == 10
    assert res["items"][0]["total_cases_free"] == 1
    assert res["items"][0]["brand_name"] == "DailyDrop"


def test_dormant_retailers_detection():
    now = datetime.now(timezone.utc)
    ret_active_id = uuid4()
    ret_dormant_id = uuid4()

    # Retailer 1: Ordered 5 days ago (Active, not dormant)
    ret1 = Retailer(
        id=ret_active_id,
        retailer_code="RET-01",
        shop_name="Fresh Mart",
        owner_name="Anil",
        phone="9876543211",
        city="Pune",
        address="Camp",
        state="MH",
        pincode="411001",
        is_active=True,
        registration_status="ACTIVE",
        created_at=now - timedelta(days=60),
    )
    # Retailer 2: Ordered 20 days ago (Dormant > 14 days)
    ret2 = Retailer(
        id=ret_dormant_id,
        retailer_code="RET-02",
        shop_name="Sharma Provision",
        owner_name="Sunil Sharma",
        phone="9876543212",
        city="Pune",
        address="FC Road",
        state="MH",
        pincode="411004",
        is_active=True,
        registration_status="ACTIVE",
        created_at=now - timedelta(days=90),
    )

    order2 = Order(
        id=uuid4(),
        order_number="ORD-OLD-002",
        retailer_id=ret_dormant_id,
        status="APPROVED",
        total_amount=Decimal("3500.00"),
        created_at=now - timedelta(days=20),
    )

    credit2 = CreditAccount(
        id=uuid4(),
        retailer_id=ret_dormant_id,
        credit_limit=Decimal("50000"),
        current_outstanding=Decimal("12000"),
        payment_terms_days=14,
    )

    db = MagicMock()
    # 1. active retailers
    ret_mock = MagicMock()
    ret_mock.all.return_value = [ret1, ret2]
    # 2. orders for latest
    orders_mock = MagicMock()
    orders_mock.all.return_value = [order2]
    # 3. credit accounts
    credit_mock = MagicMock()
    credit_mock.all.return_value = [credit2]

    db.scalars.side_effect = [ret_mock, orders_mock, credit_mock]

    # execute for last_orders_stmt
    row1 = MagicMock(retailer_id=ret_active_id, last_order_at=now - timedelta(days=5))
    row2 = MagicMock(retailer_id=ret_dormant_id, last_order_at=now - timedelta(days=20))
    exec_mock = MagicMock()
    exec_mock.all.return_value = [row1, row2]
    db.execute.return_value = exec_mock

    user = User(id=uuid4(), email="desk@orderly.com", role="ORDER_DESK", is_active=True)
    res = list_dormant_retailers(
        days=14,
        city=None,
        limit=50,
        offset=0,
        db=db,
        current_user=user,
    )

    assert res["summary"]["total_active_retailers"] == 2
    assert res["summary"]["total_dormant_retailers"] == 1
    assert len(res["items"]) == 1
    assert res["items"][0]["shop_name"] == "Sharma Provision"
    assert res["items"][0]["days_inactive"] >= 20
    assert res["items"][0]["current_outstanding"] == 12000.0
    assert "wa.me" in res["items"][0]["whatsapp_url"]
