import re
from decimal import Decimal
from unittest.mock import MagicMock
import pytest

from app.modules.ai_assistant.matcher import (
    HybridProductMatcher,
    normalize_text,
    parse_retailer_phrase,
    split_compound_retailer_message,
)
from app.modules.ai_assistant.schemas import MatchStatus, QuantityUnit
from app.modules.products.models import Brand, Product, ProductAlias


def test_devanagari_cleaning():
    text = "असम टी और साल्ट चाहिए"
    norm = normalize_text(text)
    assert "असम" in norm
    assert "टी" in norm
    assert "साल्ट" in norm


def test_compound_sentence_splitting():
    # 1. Hindi compound
    parts1 = split_compound_retailer_message("मुझे एक असम टी और टाटा साल्ट चाहिए")
    assert len(parts1) == 2
    req1_a = parse_retailer_phrase(parts1[0])
    req1_b = parse_retailer_phrase(parts1[1])
    assert "assam tea" in req1_a.clean_query.lower()
    assert req1_a.quantity == 1
    assert "tata salt" in req1_b.clean_query.lower()

    # 2. Hinglish compound with "aur"
    parts2 = split_compound_retailer_message("muzhe chai aur biscuit hone")
    assert len(parts2) == 2
    req2_a = parse_retailer_phrase(parts2[0])
    req2_b = parse_retailer_phrase(parts2[1])
    assert "tea" in req2_a.clean_query or "chai" in req2_a.clean_query
    assert "biscuit" in req2_b.clean_query

    # 3. Follow-up inquiry
    req3 = parse_retailer_phrase("and what about chai")
    assert "tea" in req3.clean_query or "chai" in req3.clean_query


def test_empty_query_fallback():
    mock_db = MagicMock()
    matcher = HybridProductMatcher(mock_db, "ret-id")

    # "मुझे एक" only has noise + quantity
    res = matcher.match_item("मुझे एक")
    assert res.status == MatchStatus.NOT_FOUND
    assert "kaunsa product" in res.clarification_question.lower() or "naam" in res.clarification_question.lower()


def test_compound_quantity_additive():
    # 4 pieces + 2 packets = 6 pieces/packets
    req = parse_retailer_phrase("के चार पीस और दो पैकेट कर देना")
    assert req.quantity == 6
    assert req.quantity_unit == QuantityUnit.PIECE
    assert req.quantity_explicit is True
    assert req.quantity_unit_explicit is True
    assert req.clean_query == ""


def test_affirmative_phrase_cleared():
    # 'ऐड कर देना' should not be left as a product search query
    req = parse_retailer_phrase("ऐड कर देना")
    assert req.clean_query == ""


def test_echo_and_phonetic_cleaning_with_case_and_piece():
    from app.modules.ai_assistant.matcher import clean_retailer_speech_echo
    raw = "250g का लव डे क्या आपको यह चाहिए कितनी ब्रैकेट या कैसे चाहिएहां मुझे इसके पांच पीस और दो कैसे कर देना"
    cleaned = clean_retailer_speech_echo(raw)
    assert "लव डे" not in cleaned
    assert "चाहिए" not in cleaned
    assert "पांच पीस" in cleaned
    assert "दो कैसे" in cleaned

    parsed = parse_retailer_phrase(cleaned)
    assert "love" not in parsed.clean_query.lower()
    assert "day" not in parsed.clean_query.lower()
    assert parsed.quantity_explicit is True
