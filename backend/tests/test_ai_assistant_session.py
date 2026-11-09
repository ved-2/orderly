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
    PendingProductRequest,
    ProductCardInfo,
    QuantityUnit,
)
from app.modules.ai_assistant.session_service import (
    _SESSION_STORE,
    append_message,
    clear_session,
    get_or_create_session,
    set_pending_clarification,
    set_pending_request,
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


def test_session_durability_across_process_restart():
    retailer_id = "durable-ret-777"
    user_id = "durable-usr-888"

    # Step 1: Create and populate session
    session = get_or_create_session(retailer_id, user_id)
    append_message(session, AssistantRole.USER, "Mujhe Tata Salt 2 case chahiye")
    append_message(session, AssistantRole.ASSISTANT, "Tata Salt 2 case ready")
    pending = PendingProductRequest(
        raw_query="Tata Salt",
        product_name="Tata Salt",
        brand_name="Tata",
        active_question="Kaunsa pack size chahiye?",
    )
    set_pending_request(session, pending)

    # Step 2: Simulate process crash / server restart by wiping in-memory dictionary
    _SESSION_STORE.clear()
    assert retailer_id not in _SESSION_STORE

    # Step 3: Re-fetch session (e.g. browser refresh or new request on restarted worker)
    recovered = get_or_create_session(retailer_id, user_id)
    assert recovered.retailer_id == retailer_id
    assert len(recovered.messages) == 3  # welcome + user + assistant
    assert recovered.messages[1].content == "Mujhe Tata Salt 2 case chahiye"
    assert recovered.pending_question == "Kaunsa pack size chahiye?"
    assert recovered.pending_request is not None
    assert recovered.pending_request.brand_name == "Tata"

    # Clean up
    clear_session(retailer_id, user_id)
