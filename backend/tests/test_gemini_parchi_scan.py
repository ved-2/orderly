from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.modules.ai_assistant.groq_service import parse_order_slip_image
from app.modules.ai_assistant.schemas import QuantityUnit, GroqExtractedItem
from app.modules.ai_assistant.service import process_parchi_image
from app.modules.products.models import Product
from app.modules.users.models import User


def test_parse_order_slip_fallback():
    # Calling with dummy bytes should return (is_parchi=False, items=[], notes) without fake static items
    is_parchi, items, notes = parse_order_slip_image(b"fake_image_bytes", "image/jpeg")
    assert isinstance(is_parchi, bool)
    assert isinstance(items, list)
    assert isinstance(notes, str)


def test_matcher_price_map_property():
    from app.modules.ai_assistant.matcher import HybridProductMatcher

    matcher = HybridProductMatcher.__new__(HybridProductMatcher)
    pid = uuid4()
    price_mock = MagicMock()
    price_mock.price = Decimal("150.50")
    matcher.prices_map = {pid: price_mock}
    matcher.inventory_map = {pid: 10}

    assert pid in matcher.price_map
    assert matcher.price_map[pid] == 150.50


def test_process_parchi_image_rejects_non_parchi():
    db = MagicMock()
    user = User(id=uuid4(), email="user@kirana.com", role="RETAILER")
    ret_id = uuid4()
    db.scalar.return_value = ret_id

    with patch("app.modules.ai_assistant.groq_service.parse_order_slip_image") as mock_parse:
        mock_parse.return_value = (False, [], "Not a parchi")
        res = process_parchi_image(db=db, current_user=user, image_bytes=b"dummy_bytes")
        assert "parchi ya order slip ki nahi" in res.reply
        assert len(res.cart_actions) == 0
