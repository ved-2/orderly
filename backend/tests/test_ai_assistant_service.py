import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest

from app.modules.ai_assistant.schemas import (
    AssistantChatRequest,
    AssistantIntent,
    CartActionType,
    MatchStatus,
    QuantityUnit,
)
from app.modules.ai_assistant.service import process_assistant_chat
from app.modules.products.models import Brand, Product, ProductAlias
from app.modules.retailers.models import Retailer
from app.modules.users.models import User


def test_process_assistant_chat_orchestration():
    mock_db = MagicMock()
    retailer_id = uuid.uuid4()
    user_id = uuid.uuid4()
    brand_id = uuid.uuid4()

    mock_user = User(id=user_id, email="retailer@kirana.com", role="RETAILER")
    mock_retailer = Retailer(
        id=retailer_id,
        retailer_code="RET-001",
        shop_name="Aggarwal Stores",
        owner_name="Ramesh Aggarwal",
        phone="9876543210",
        address="Lordganj, Jabalpur",
        is_active=True,
        registration_status="ACTIVE",
    )

    prod = Product(
        id=uuid.uuid4(),
        brand_id=brand_id,
        sku="PARLE-G-100G",
        name="Parle-G Biscuit 100g",
        category="Biscuits",
        pack_size=Decimal("100"),
        pack_unit="gm",
        units_per_case=24,
        is_active=True,
    )
    alias = ProductAlias(
        id=uuid.uuid4(),
        product_id=prod.id,
        alias="Parle G",
        normalized_alias="parle g",
        language="hi-Latn",
    )

    def mock_scalar(query):
        q_str = str(query)
        if "retailer_id" in q_str and "retailer_users" in q_str:
            return retailer_id
        if "FROM retailers" in q_str:
            return mock_retailer
        return None

    def mock_execute(query):
        mock_result = MagicMock()
        q_str = str(query)
        if "FROM products" in q_str:
            mock_result.all.return_value = [(prod, "Parle")]
        elif "FROM product_aliases" in q_str:
            mock_result.scalars.return_value.all.return_value = [alias]
        elif "FROM inventory" in q_str:
            mock_result.all.return_value = [(prod.id, 100, 0)]
        else:
            mock_result.all.return_value = []
        return mock_result

    mock_db.scalar.side_effect = mock_scalar
    mock_db.execute.side_effect = mock_execute

    # 1. ADD_PRODUCT chat request
    req1 = AssistantChatRequest(
        message="Mujhe Parle-G ke 10 packet chahiye",
        mode="CHAT",
    )
    resp1 = process_assistant_chat(mock_db, mock_user, req1)
    assert resp1.intent == AssistantIntent.ADD_PRODUCT
    assert len(resp1.cart_actions) == 1
    assert resp1.cart_actions[0].action == CartActionType.ADD
    assert resp1.cart_actions[0].product_id == str(prod.id)
    assert resp1.cart_actions[0].quantity == 10
    assert resp1.cart_actions[0].quantity_unit == QuantityUnit.PIECE
    assert len(resp1.suggested_products) >= 1
    assert "Parle-G" in resp1.audio_text

    # 2. CLEAR_DRAFT chat request
    req2 = AssistantChatRequest(
        message="Order cancel karo",
        mode="CHAT",
    )
    resp2 = process_assistant_chat(mock_db, mock_user, req2)
    assert resp2.intent == AssistantIntent.CLEAR_DRAFT
    assert any(a.action == CartActionType.CLEAR for a in resp2.cart_actions)
