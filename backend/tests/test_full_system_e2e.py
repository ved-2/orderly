import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api.deps import (
    get_current_user,
    get_db,
    get_verified_firebase_identity,
)
from app.main import app
from app.modules.products.models import Brand, Product
from app.modules.retailers.models import Retailer
from app.modules.users.models import StaffInvitation, User


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.begin.return_value.__enter__.return_value = None
    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_public_health_endpoints(client):
    res_root = client.get("/health")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "healthy"

    res_v1 = client.get("/api/v1/health")
    assert res_v1.status_code == 200
    assert res_v1.json()["success"] is True


def test_retailer_catalogue_endpoint(client, mock_db):
    user_id = uuid.uuid4()
    retailer_user = User(
        id=user_id,
        email="retailer@kirana.com",
        role="RETAILER",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: retailer_user

    with patch("app.modules.products.router.get_retailer_catalogue") as mock_cat:
        mock_cat.return_value = {
            "items": [],
            "total": 0,
            "page": 1,
            "page_size": 20,
            "total_pages": 1,
        }
        res = client.get("/api/v1/products/catalogue")
        assert res.status_code == 200
        assert res.json()["total"] == 0


def test_retailer_registration_flow(client, mock_db):
    app.dependency_overrides[get_verified_firebase_identity] = lambda: {
        "firebase_uid": "fb-test-retailer-1",
        "email": "newretailer@kirana.com",
    }
    # Return None for uniqueness checks
    mock_db.scalar.side_effect = [None, None]

    payload = {
        "shop_name": "Radha Krishna Stores",
        "owner_name": "Radhey Shyam",
        "phone": "9826112233",
        "address": "Civic Center, Jabalpur",
        "city": "Jabalpur",
        "state": "Madhya Pradesh",
        "pincode": "482002",
    }
    res = client.post("/api/v1/retailers/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["shop_name"] == "Radha Krishna Stores"
    assert data["registration_status"] == "PENDING_REVIEW"


def test_retailer_ai_chat_and_draft_workflow(client, mock_db):
    user_id = uuid.uuid4()
    retailer_id = uuid.uuid4()
    retailer_user = User(
        id=user_id,
        email="retailer@kirana.com",
        role="RETAILER",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: retailer_user
    mock_db.scalar.return_value = retailer_id

    with patch("app.modules.ai_assistant.router.process_assistant_chat") as mock_chat:
        from app.modules.ai_assistant.schemas import AssistantChatResponse, AssistantIntent
        mock_chat.return_value = AssistantChatResponse(
            session_id=str(uuid.uuid4()),
            reply="DailyDrop Refined Sunflower Oil (50 packet) cart me add kar diye gaye hain.",
            audio_text="Sunflower oil add kar diya gaya hai",
            intent=AssistantIntent.ADD_PRODUCT,
            messages=[],
            cart_actions=[],
        )

        res = client.post(
            "/api/v1/assistant/chat",
            json={"message": "50 packet sunflower oil chahiye", "mode": "CHAT"},
        )
        assert res.status_code == 200
        assert "Sunflower Oil" in res.json()["reply"]

    # Test Draft Fetch
    with patch("app.modules.ai_assistant.router.get_or_create_session") as mock_get_sess:
        mock_sess = MagicMock()
        mock_sess.draft_items = []
        mock_get_sess.return_value = mock_sess

        res_draft = client.get("/api/v1/assistant/draft")
        assert res_draft.status_code == 200
        assert res_draft.json()["item_count"] == 0


def test_salesman_portal_workflow(client, mock_db):
    salesman_id = uuid.uuid4()
    salesman_user = User(
        id=salesman_id,
        email="salesman@orderly.com",
        role="SALESMAN",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: salesman_user

    # Assigned Retailers
    ret = Retailer(
        id=uuid.uuid4(),
        retailer_code="RET-001",
        shop_name="Jabalpur Super Kirana",
        owner_name="Vijay Kumar",
        phone="9876500000",
        address="Wright Town",
        city="Jabalpur",
        pincode="482002",
        is_active=True,
        registration_status="ACTIVE",
    )
    mock_db.scalar.return_value = None  # has_assignments check
    scalars_mock = MagicMock()
    scalars_mock.all.side_effect = [[ret], []]
    mock_db.scalars.return_value = scalars_mock

    exec_mock = MagicMock()
    exec_mock.all.return_value = []
    mock_db.execute.return_value = exec_mock

    res_ret = client.get("/api/v1/salesman/retailers")
    assert res_ret.status_code == 200
    assert len(res_ret.json()["items"]) == 1
    assert res_ret.json()["items"][0]["shop_name"] == "Jabalpur Super Kirana"

    # Catalogue for salesman
    prod = Product(
        id=uuid.uuid4(),
        brand_id=uuid.uuid4(),
        sku="SKU-SALES-1",
        name="Tata Salt 1kg",
        category="Staples",
        pack_size=Decimal("1.0"),
        pack_unit="kg",
        units_per_case=24,
        is_active=True,
    )
    scalars_mock2 = MagicMock()
    scalars_mock2.all.return_value = [prod]
    mock_db.scalars.return_value = scalars_mock2

    res_cat = client.get("/api/v1/salesman/catalogue")
    assert res_cat.status_code == 200


def test_distributor_admin_staff_management_workflow(client, mock_db):
    admin_id = uuid.uuid4()
    admin_user = User(
        id=admin_id,
        email="admin@orderly.com",
        role="DISTRIBUTOR_ADMIN",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: admin_user

    # List Staff
    staff_user = User(
        id=uuid.uuid4(),
        email="worker@orderly.com",
        role="SALESMAN",
        phone="9876543210",
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    scalars_mock = MagicMock()
    scalars_mock.all.side_effect = [[staff_user], []]  # staff_users, pending invitations
    mock_db.scalars.return_value = scalars_mock

    res_staff = client.get("/api/v1/distributor/staff")
    assert res_staff.status_code == 200
    assert len(res_staff.json()["staff"]) == 1

    # Invite Staff
    invite_payload = {
        "email": "neworderdesk@orderly.com",
        "role": "ORDER_DESK",
    }
    mock_db.scalar.return_value = None  # user does not exist yet

    with patch("app.modules.users.staff_router.create_staff_invitation") as mock_invite:
        mock_invite.return_value = {
            "invitation_token": "token-xyz-123",
            "email": "neworderdesk@orderly.com",
            "role": "ORDER_DESK",
            "expires_at": datetime.now(timezone.utc).isoformat(),
        }
        res_inv = client.post("/api/v1/distributor/staff/invite", json=invite_payload)
        assert res_inv.status_code == 200
        assert res_inv.json()["email"] == "neworderdesk@orderly.com"

    # Promote/Change Role of Staff
    mock_db.get.return_value = staff_user
    res_promote = client.patch(
        f"/api/v1/distributor/staff/{staff_user.id}/role",
        json={"role": "ORDER_DESK"},
    )
    assert res_promote.status_code == 200
    assert res_promote.json()["role"] == "ORDER_DESK"


def test_order_desk_and_distributor_analytics(client, mock_db):
    order_desk_user = User(
        id=uuid.uuid4(),
        email="desk@orderly.com",
        role="ORDER_DESK",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: order_desk_user

    # Van loading sheet
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = []
    mock_db.scalars.return_value = scalars_mock

    res_van = client.get("/api/v1/orders/desk/van-loading-sheet?format_type=json")
    assert res_van.status_code == 200
    assert "summary" in res_van.json()

    # Switch to Admin for distributor sales metrics
    admin_user = User(
        id=uuid.uuid4(),
        email="admin@orderly.com",
        role="DISTRIBUTOR_ADMIN",
        is_active=True,
    )
    app.dependency_overrides[get_current_user] = lambda: admin_user

    scalars_mock_sales = MagicMock()
    scalars_mock_sales.all.side_effect = [[], []]
    mock_db.scalars.return_value = scalars_mock_sales

    exec_mock = MagicMock()
    exec_mock.all.return_value = []
    mock_db.execute.return_value = exec_mock

    res_metrics = client.get("/api/v1/distributor/sales/metrics")
    assert res_metrics.status_code == 200
    assert "total_revenue" in res_metrics.json()

    res_salesmen = client.get("/api/v1/distributor/salesmen")
    assert res_salesmen.status_code == 200
    assert "items" in res_salesmen.json()
