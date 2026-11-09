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
    # Calling with empty or dummy bytes should return valid structured items (fallback or vision)
    res = parse_order_slip_image(b"fake_image_bytes", "image/jpeg")
    assert isinstance(res, list)
    assert len(res) >= 1
    assert all(isinstance(x, GroqExtractedItem) for x in res)
    assert all(x.quantity >= 1 for x in res)
