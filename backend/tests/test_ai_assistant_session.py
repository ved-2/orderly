import pytest
from app.modules.ai_assistant.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantIntent,
    AssistantMessage,
    AssistantRole,
    CartAction,
    CartActionType,
    ExtractedOrderItem,
    MatchStatus,
    ProductCardInfo,
    QuantityUnit,
)
from app.modules.ai_assistant.session_service import (
    append_message,
    clear_session,
    get_or_create_session,
    set_pending_clarification,
    update_session_draft,
)


def test_session_lifecycle():
    retailer_id = "test-retailer-123"
    user_id = "test-user-456"

    # 1. Create session
    session = get_or_create_session(retailer_id, user_id)
    assert session.retailer_id == retailer_id
    assert session.user_id == user_id
    assert len(session.messages) == 1
    assert session.messages[0].role == AssistantRole.ASSISTANT

    # 2. Append user message
    user_msg = append_message(
        session=session,
        role=AssistantRole.USER,
        content="Mujhe Parle-G 10 packet chahiye",
        audio_text="Mujhe Parle-G 10 packet chahiye",
        intent=AssistantIntent.ADD_PRODUCT,
    )
    assert len(session.messages) == 2
    assert user_msg.role == AssistantRole.USER
    assert user_msg.intent == AssistantIntent.ADD_PRODUCT

    # 3. Add extracted item and assistant reply
    extracted = ExtractedOrderItem(
        raw_text="Parle-G 10 packet",
        product_id="prod-1",
        sku="PARLE-G-100G",
        product_name="Parle-G Glucose Biscuit",
        quantity=10,
        quantity_unit=QuantityUnit.PIECE,
        confidence=0.95,
        status=MatchStatus.MATCHED,
    )
    update_session_draft(session, [extracted])
    assert len(session.draft_items) == 1
    assert session.draft_items[0].quantity == 10

    card = ProductCardInfo(
        product_id="prod-1",
        sku="PARLE-G-100G",
        name="Parle-G Glucose Biscuit",
        brand_name="Parle",
        category="Biscuits",
        pack_size=100,
        pack_unit="gm",
        units_per_case=24,
        price=10.0,
        is_in_stock=True,
        quantity_available=120,
    )
    append_message(
        session=session,
        role=AssistantRole.ASSISTANT,
        content="Parle-G ke 10 packet cart me add kar diye hain.",
        audio_text="Parle-G 10 packet add kar diye.",
        intent=AssistantIntent.ADD_PRODUCT,
        suggested_products=[card],
    )
    assert len(session.messages) == 3

    # 4. Check response schema serialization
    response = AssistantChatResponse(
        session_id=session.session_id,
        reply="Parle-G ke 10 packet cart me add kar diye hain.",
        audio_text="Parle-G 10 packet add kar diye.",
        intent=AssistantIntent.ADD_PRODUCT,
        messages=session.messages,
        suggested_products=[card],
        cart_actions=[
            CartAction(
                action=CartActionType.ADD,
                product_id="prod-1",
                sku="PARLE-G-100G",
                name="Parle-G Glucose Biscuit",
                quantity=10,
                quantity_unit=QuantityUnit.PIECE,
                price=10.0,
            )
        ],
    )
    dumped = response.model_dump()
    assert dumped["intent"] == "ADD_PRODUCT"
    assert len(dumped["cart_actions"]) == 1

    # 5. Clear session
    cleared = clear_session(retailer_id, user_id)
    assert len(cleared.messages) == 1
    assert len(cleared.draft_items) == 0
