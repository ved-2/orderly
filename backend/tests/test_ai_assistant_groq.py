import json
import httpx
from unittest.mock import patch
import pytest

from app.modules.ai_assistant.groq_service import (
    deterministic_nlu_fallback,
    parse_with_groq,
)
from app.modules.ai_assistant.schemas import (
    AssistantIntent,
    AssistantRole,
    ClarificationOption,
    QuantityUnit,
)
from app.modules.ai_assistant.session_service import get_or_create_session


def test_deterministic_nlu_fallback():
    session = get_or_create_session("ret-test", "user-test")

    # 1. ADD_PRODUCT
    res1 = deterministic_nlu_fallback("Parle-G ke 10 packet chahiye", session)
    assert res1.intent == AssistantIntent.ADD_PRODUCT
    assert len(res1.items) == 1
    assert res1.items[0].quantity == 10
    assert res1.items[0].quantity_unit == QuantityUnit.PIECE
    assert "parle-g" in res1.items[0].product_phrase.lower()

    # 2. CONFIRM_ORDER
    res2 = deterministic_nlu_fallback("Order confirm karo", session)
    assert res2.intent == AssistantIntent.CONFIRM_ORDER

    # 3. REVIEW_ORDER
    res3 = deterministic_nlu_fallback("Abhi tak ka mera order batao", session)
    assert res3.intent == AssistantIntent.REVIEW_ORDER

    # 4. REMOVE_PRODUCT
    res4 = deterministic_nlu_fallback("Blue pen hata do", session)
    assert res4.intent == AssistantIntent.REMOVE_PRODUCT
    assert "blue pen" in res4.target_product_to_modify.lower()

    # 5. CLARIFICATION response
    session.pending_question = "Aapko Red Label 250g chahiye ya 500g?"
    session.pending_options = [
        ClarificationOption(
            product_id="opt-250",
            sku="RED-250",
            name="Red Label 250g",
            brand_name="Brooke Bond",
            pack_size=250,
            pack_unit="gm",
        ),
        ClarificationOption(
            product_id="opt-500",
            sku="RED-500",
            name="Red Label 500g",
            brand_name="Brooke Bond",
            pack_size=500,
            pack_unit="gm",
        ),
    ]

    res5 = deterministic_nlu_fallback("500 gram wala do", session)
    assert res5.intent == AssistantIntent.CLARIFY
    assert res5.clarification_choice == "opt-500"


def test_parse_with_groq_mock_success():
    session = get_or_create_session("ret-test-2", "user-test-2")

    mock_llm_json = {
        "intent": "ADD_PRODUCT",
        "items": [
            {
                "product_phrase": "Red Label Tea",
                "quantity": 2,
                "quantity_unit": "PIECE",
                "pack_size_hint": 500.0,
                "pack_unit_hint": "gm",
            }
        ],
        "target_product_to_modify": None,
        "clarification_choice": None,
        "chat_reply": "Red Label Tea 500g ke 2 packet add kar rahe hain.",
        "audio_reply": "Red Label 500g ke do packet add kar diye.",
    }

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": json.dumps(mock_llm_json)}}]
            },
        )

    mock_transport = httpx.MockTransport(mock_handler)
    original_client = httpx.Client

    def custom_client(*args, **kwargs):
        kwargs["transport"] = mock_transport
        return original_client(*args, **kwargs)

    with patch("app.core.config.settings.GROQ_API_KEY", "gsk_test123"):
        with patch("httpx.Client", side_effect=custom_client):
            res = parse_with_groq(
                "Mujhe Red Label chai ke 500 gram ke do packet chahiye",
                session,
            )
            assert res.intent == AssistantIntent.ADD_PRODUCT
            assert len(res.items) == 1
            assert res.items[0].quantity == 2
            assert res.items[0].pack_size_hint == 500.0
            assert "Red Label" in res.audio_reply
