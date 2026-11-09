from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.modules.orders.distributor_sales_router import (
    AssignRetailerRequest,
    UnassignRetailerRequest,
    assign_retailer_to_salesman,
    get_distributor_sales_metrics,
    list_distributor_salesmen,
    unassign_retailer_from_salesman,
)
from app.modules.retailers.models import Retailer, RetailerAssignment
from app.modules.users.models import User


def test_list_distributor_salesmen_unit():
    db = MagicMock()
    salesman = User(id=uuid4(), email="ram@orderly.com", role="SALESMAN", is_active=True)
    admin = User(id=uuid4(), email="admin@orderly.com", role="DISTRIBUTOR_ADMIN", is_active=True)

    scalars_mock = MagicMock()
    scalars_mock.all.side_effect = [[salesman], []]
    db.scalars.return_value = scalars_mock

    execute_mock = MagicMock()
    execute_mock.all.return_value = []
    db.execute.return_value = execute_mock

    res = list_distributor_salesmen(db=db, current_user=admin)
    assert "items" in res
    assert len(res["items"]) == 1
    assert res["items"][0]["email"] == "ram@orderly.com"


def test_assign_and_unassign_retailer_unit():
    db = MagicMock()
    salesman_id = uuid4()
    retailer_id = uuid4()
    admin = User(id=uuid4(), email="admin@orderly.com", role="DISTRIBUTOR_ADMIN", is_active=True)
    salesman = User(id=salesman_id, email="sales@orderly.com", role="SALESMAN", is_active=True)
    retailer = Retailer(id=retailer_id, shop_name="Gupta Kirana", retailer_code="RET01")

    def mock_get(model, entity_id):
        if model == User:
            return salesman
        if model == Retailer:
            return retailer
        return None

    db.get.side_effect = mock_get
    db.scalar.return_value = None

    req = AssignRetailerRequest(salesman_id=salesman_id, retailer_id=retailer_id)
    assign_res = assign_retailer_to_salesman(payload=req, db=db, current_user=admin)
    assert "assigned" in assign_res["message"].lower()

    # Now test unassign
    assignment = RetailerAssignment(id=uuid4(), salesman_id=salesman_id, retailer_id=retailer_id)
    db.scalar.return_value = assignment

    unassign_req = UnassignRetailerRequest(salesman_id=salesman_id, retailer_id=retailer_id)
    unassign_res = unassign_retailer_from_salesman(payload=unassign_req, db=db, current_user=admin)
    assert "unassigned" in unassign_res["message"].lower()


def test_sales_metrics_unit():
    db = MagicMock()
    admin = User(id=uuid4(), email="admin@orderly.com", role="DISTRIBUTOR_ADMIN", is_active=True)

    execute_mock = MagicMock()
    execute_mock.first.side_effect = [
        (10, Decimal("150000.00")),
        (Decimal("120000.00"), 8),
        (Decimal("30000.00"), 2),
    ]
    execute_mock.all.side_effect = [
        [("APPROVED", 8, Decimal("120000.00")), ("ON_HOLD", 2, Decimal("30000.00"))],
        [("SALESMAN", 7, Decimal("100000.00")), ("WEB", 3, Decimal("50000.00"))],
        [(uuid4(), "Gupta Stores", "RET01", "Jabalpur", 5, Decimal("80000.00"))],
    ]
    db.execute.return_value = execute_mock

    res = get_distributor_sales_metrics(db=db, current_user=admin)
    assert res["total_revenue"] == 150000.00
    assert res["confirmed_revenue"] == 120000.00
    assert res["pending_revenue"] == 30000.00
    assert res["avg_order_value"] == 15000.00
    assert len(res["top_retailers"]) == 1
    assert res["top_retailers"][0]["shop_name"] == "Gupta Stores"


def test_update_staff_role_and_toggle_status():
    from app.modules.users.staff_router import (
        UpdateStaffRoleRequest,
        update_staff_role,
        toggle_staff_active_status,
    )

    db = MagicMock()
    admin = User(id=uuid4(), email="admin@orderly.com", role="DISTRIBUTOR_ADMIN", is_active=True)
    salesman = User(id=uuid4(), email="sales@orderly.com", role="SALESMAN", is_active=True)

    db.get.return_value = salesman

    # Promote salesman to order desk
    req = UpdateStaffRoleRequest(role="ORDER_DESK")
    res = update_staff_role(user_id=salesman.id, payload=req, db=db, current_user=admin)
    assert res["role"] == "ORDER_DESK"
    assert salesman.role == "ORDER_DESK"

    # Toggle active status
    toggle_res = toggle_staff_active_status(user_id=salesman.id, db=db, current_user=admin)
    assert toggle_res["is_active"] is False
    assert salesman.is_active is False


def test_salesman_ai_assistant_retailer_resolution():
    from app.modules.ai_assistant.service import resolve_retailer_id

    db = MagicMock()
    salesman = User(id=uuid4(), email="sales@orderly.com", role="SALESMAN", is_active=True)
    assigned_retailer_id = uuid4()
    explicit_retailer_id = uuid4()

    # 1. With explicit retailer id
    db.scalar.return_value = explicit_retailer_id
    res_id = resolve_retailer_id(db, salesman, explicit_retailer_id)
    assert res_id == explicit_retailer_id

    # 2. Without explicit retailer id, falls back to assignment
    db.scalar.return_value = assigned_retailer_id
    res_id_assigned = resolve_retailer_id(db, salesman)
    assert res_id_assigned == assigned_retailer_id
