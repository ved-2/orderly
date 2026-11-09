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


def test_process_assistant_chat_multi_turn_clarification():
    mock_db = MagicMock()
    retailer_id = uuid.uuid4()
    user_id = uuid.uuid4()
    brand_bb = uuid.uuid4()
    brand_dd = uuid.uuid4()

    mock_user = User(id=user_id, email="retailer2@kirana.com", role="RETAILER")
    mock_retailer = Retailer(
        id=retailer_id,
        retailer_code="RET-002",
        shop_name="Sharma Stores",
        owner_name="Sanjay Sharma",
        phone="9876543211",
        address="Wright Town, Jabalpur",
        is_active=True,
        registration_status="ACTIVE",
    )

    rl_tea = Product(
        id=uuid.uuid4(),
        brand_id=brand_bb,
        sku="RL-TEA-500G",
        name="Red Label Tea 500g",
        category="Tea",
        pack_size=Decimal("500"),
        pack_unit="gm",
        units_per_case=12,
        is_active=True,
    )
    dd_tea = Product(
        id=uuid.uuid4(),
        brand_id=brand_dd,
        sku="DD-TEA-250G",
        name="DailyDrop Assam Tea 250g",
        category="Tea",
        pack_size=Decimal("250"),
        pack_unit="gm",
        units_per_case=24,
        is_active=True,
    )

    alias_rl = ProductAlias(
        id=uuid.uuid4(),
        product_id=rl_tea.id,
        alias="Red Label Chai",
        normalized_alias="red label chai",
        language="hi-Latn",
    )
    alias_dd = ProductAlias(
        id=uuid.uuid4(),
        product_id=dd_tea.id,
        alias="DailyDrop Chai",
        normalized_alias="dailydrop chai",
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
            mock_result.all.return_value = [
                (rl_tea, "Red Label"),
                (dd_tea, "DailyDrop"),
            ]
        elif "FROM product_aliases" in q_str:
            mock_result.scalars.return_value.all.return_value = [alias_rl, alias_dd]
        elif "FROM inventory" in q_str:
            mock_result.all.return_value = [
                (rl_tea.id, 50, 0),
                (dd_tea.id, 40, 0),
            ]
        else:
            mock_result.all.return_value = []
        return mock_result

    mock_db.scalar.side_effect = mock_scalar
    mock_db.execute.side_effect = mock_execute

    # Turn 1: Retailer says "chai" without brand or pack size
    req1 = AssistantChatRequest(message="Mujhe chai chahiye", mode="CHAT")
    resp1 = process_assistant_chat(mock_db, mock_user, req1)
    assert resp1.intent == AssistantIntent.CLARIFY
    assert resp1.pending_request is not None
    assert "Red Label" in resp1.reply or "DailyDrop" in resp1.reply

    # Turn 2: Retailer answers "Red Label"
    req2 = AssistantChatRequest(message="Red Label", mode="CHAT")
    resp2 = process_assistant_chat(mock_db, mock_user, req2)
    # Since Red Label has 500g and selling unit is missing, it asks selling unit
    assert resp2.intent == AssistantIntent.CLARIFY
    assert "Packet mein ya case mein" in resp2.reply or "Kitne" in resp2.reply

    # Turn 3: Retailer answers "2 case"
    req3 = AssistantChatRequest(message="2 case", mode="CHAT")
    resp3 = process_assistant_chat(mock_db, mock_user, req3)
    assert resp3.intent == AssistantIntent.ADD_PRODUCT
    assert len(resp3.cart_actions) == 1
    assert resp3.cart_actions[0].product_id == str(rl_tea.id)
    assert resp3.cart_actions[0].quantity == 2
    assert resp3.cart_actions[0].quantity_unit == QuantityUnit.CASE
    assert "Red Label" in resp3.reply


def test_clean_retailer_speech_echo_and_loop_prevention():
    from app.modules.ai_assistant.matcher import clean_retailer_speech_echo

    # 1. Echo of assistant question in Hindi should be stripped to empty
    echo_msg = "डेली ड्रॉप केक ओंस वेरिएंट का ऑप्शन चाहिए डेली ड्रॉप असेंबली डेली ड्रॉप शुगर"
    cleaned = clean_retailer_speech_echo(echo_msg, "DailyDrop ke kaunse variant ka option chahiye?")
    assert cleaned == ""

    # 2. Valid user reply answering an option should NOT be stripped
    user_reply = "Red Label"
    assert clean_retailer_speech_echo(user_reply, "Kaunsi brand chahiye? Red Label ya DailyDrop?") == "Red Label"
