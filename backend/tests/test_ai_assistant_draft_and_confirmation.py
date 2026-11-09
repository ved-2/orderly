import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest

from app.modules.ai_assistant.schemas import (
    AssistantChatRequest,
    AssistantIntent,
    CartActionType,
    ExtractedOrderItem,
    MatchStatus,
    QuantityUnit,
)
from app.modules.ai_assistant.service import (
    execute_order_confirmation,
    process_assistant_chat,
)
from app.modules.ai_assistant.session_service import (
    add_draft_item,
    clear_draft_items,
    get_or_create_session,
    remove_draft_item,
    sync_draft_items,
    update_draft_item_quantity,
)
from app.modules.orders.models import Order, OrderItem, OrderStatusHistory
from app.modules.products.models import Brand, Product
from app.modules.retailers.models import Retailer
from app.modules.users.models import User


def test_session_draft_synchronization():
    retailer_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    session = get_or_create_session(retailer_id, user_id)
    clear_draft_items(session)

    item1 = ExtractedOrderItem(
        raw_text="Parle-G 100g",
        product_id=str(uuid.uuid4()),
        sku="PARLE-G-100",
        product_name="Parle-G 100g",
        brand_name="Parle",
        pack_size=100.0,
        pack_unit="gm",
        quantity=5,
        quantity_unit=QuantityUnit.PIECE,
        unit_price=10.0,
        status=MatchStatus.MATCHED,
    )

    # 1. Add item
    add_draft_item(session, item1)
    assert len(session.draft_items) == 1
    assert session.draft_items[0].quantity == 5

    # 2. Add same item (increment)
    add_draft_item(session, item1)
    assert len(session.draft_items) == 1
    assert session.draft_items[0].quantity == 10

    # 3. Update quantity
    updated = update_draft_item_quantity(session, item1.product_id, 15, "PIECE")
    assert updated is True
    assert session.draft_items[0].quantity == 15

    # 4. Remove item
    removed = remove_draft_item(session, item1.product_id, "PIECE")
    assert removed is True
    assert len(session.draft_items) == 0

    # 5. Sync from client cart snapshot
    snapshot = [
        {
            "product_id": str(uuid.uuid4()),
            "sku": "TATA-SALT-1KG",
            "name": "Tata Salt 1kg",
            "brand_name": "Tata",
            "pack_size": 1.0,
            "pack_unit": "kg",
            "quantity": 2,
            "quantity_unit": "CASE",
            "price": 28.0,
        }
    ]
    sync_draft_items(session, snapshot)
    assert len(session.draft_items) == 1
    assert session.draft_items[0].sku == "TATA-SALT-1KG"
    assert session.draft_items[0].quantity == 2
    assert session.draft_items[0].quantity_unit == QuantityUnit.CASE

    # 6. Clear draft
    clear_draft_items(session)
    assert len(session.draft_items) == 0


def test_execute_order_confirmation_pipeline():
    mock_db = MagicMock()
    retailer_id = uuid.uuid4()
    user_id = uuid.uuid4()
    product_id = uuid.uuid4()

    mock_retailer = Retailer(
        id=retailer_id,
        retailer_code="RET-JBP-01",
        shop_name="Jabalpur Kirana",
        owner_name="Anil Kumar",
        phone="9425012345",
        address="Ganjipura, Jabalpur",
        is_active=True,
        registration_status="ACTIVE",
    )

    prod = Product(
        id=product_id,
        sku="FORTUNE-OIL-1L",
        name="Fortune Oil 1L",
        category="Edible Oil",
        pack_size=Decimal("1"),
        pack_unit="L",
        units_per_case=12,
        is_active=True,
        gst_rate=Decimal("5.0"),
    )

    created_order = Order(
        id=uuid.uuid4(),
        order_number="ORD-20261107-TEST001",
        retailer_id=retailer_id,
        created_by=user_id,
        status="DRAFT",
        source="AI_CAPTURE",
        subtotal=Decimal("1500.00"),
        total_amount=Decimal("1575.00"),
    )

    mock_db.scalar.return_value = mock_retailer

    with patch("app.modules.ai_assistant.service.create_order_draft", return_value=created_order) as mock_create_draft:
        items = [
            ExtractedOrderItem(
                raw_text="Fortune Oil 1L",
                product_id=str(product_id),
                sku="FORTUNE-OIL-1L",
                product_name="Fortune Oil 1L",
                quantity=10,
                quantity_unit=QuantityUnit.PIECE,
                unit_price=150.0,
                status=MatchStatus.MATCHED,
            )
        ]

        order = execute_order_confirmation(
            db=mock_db,
            retailer_id=retailer_id,
            user_id=user_id,
            items=items,
            customer_note="Placed via test",
        )

        assert order.status == "SUBMITTED"
        assert order.source == "AI_CAPTURE"
        assert mock_create_draft.called
        assert mock_db.commit.called
        assert mock_db.add.called


def test_chat_confirmation_fast_path():
    mock_db = MagicMock()
    retailer_id = uuid.uuid4()
    user_id = uuid.uuid4()
    product_id = uuid.uuid4()

    mock_user = User(id=user_id, email="retailer@kirana.com", role="RETAILER")
    mock_retailer = Retailer(
        id=retailer_id,
        retailer_code="RET-001",
        shop_name="Aggarwal Stores",
        is_active=True,
        registration_status="ACTIVE",
    )

    def mock_scalar(query):
        q_str = str(query)
        if "retailer_id" in q_str and "retailer_users" in q_str:
            return retailer_id
        if "FROM retailers" in q_str:
            return mock_retailer
        return None

    mock_db.scalar.side_effect = mock_scalar

    created_order = Order(
        id=uuid.uuid4(),
        order_number="ORD-20261107-CONF001",
        retailer_id=retailer_id,
        created_by=user_id,
        status="DRAFT",
        source="AI_CAPTURE",
        subtotal=Decimal("500.00"),
        total_amount=Decimal("525.00"),
    )

    with patch("app.modules.ai_assistant.service.create_order_draft", return_value=created_order):
        cart_snap = [
            {
                "product_id": str(product_id),
                "sku": "PARLE-G-100",
                "name": "Parle-G 100g",
                "quantity": 5,
                "quantity_unit": "PIECE",
                "price": 10.0,
            }
        ]

        req = AssistantChatRequest(
            message="Order confirm karo",
            mode="CHAT",
            cart_snapshot=cart_snap,
        )

        resp = process_assistant_chat(mock_db, mock_user, req)
        assert resp.intent == AssistantIntent.CONFIRM_ORDER
        assert resp.is_order_confirmed is True
        assert resp.created_order_id == str(created_order.id)
        assert any(a.action == CartActionType.CLEAR for a in resp.cart_actions)
        assert "confirm ho gaya" in resp.reply
