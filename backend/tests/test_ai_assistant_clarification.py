import uuid
from decimal import Decimal
from unittest.mock import MagicMock
import pytest

from app.modules.ai_assistant.matcher import (
    HybridProductMatcher,
    parse_retailer_phrase,
)
from app.modules.ai_assistant.schemas import (
    AttributeStatus,
    ClarificationStage,
    MatchStatus,
    QuantityUnit,
)
from app.modules.products.models import Brand, Product, ProductAlias


@pytest.fixture
def mock_tea_catalogue():
    mock_db = MagicMock()
    retailer_id = uuid.uuid4()
    brand_bb_id = uuid.uuid4()
    brand_tata_id = uuid.uuid4()

    # Red Label 250g & 500g
    rl_250 = Product(
        id=uuid.uuid4(),
        brand_id=brand_bb_id,
        sku="RL-TEA-250G",
        name="Red Label Tea",
        category="Tea",
        pack_size=Decimal("250"),
        pack_unit="gm",
        units_per_case=24,
        is_active=True,
    )
    rl_500 = Product(
        id=uuid.uuid4(),
        brand_id=brand_bb_id,
        sku="RL-TEA-500G",
        name="Red Label Tea",
        category="Tea",
        pack_size=Decimal("500"),
        pack_unit="gm",
        units_per_case=12,
        is_active=True,
    )
    # Tata Tea Gold 500g
    tata_500 = Product(
        id=uuid.uuid4(),
        brand_id=brand_tata_id,
        sku="TATA-GOLD-500G",
        name="Tata Tea Gold",
        category="Tea",
        pack_size=Decimal("500"),
        pack_unit="gm",
        units_per_case=12,
        is_active=True,
    )

    alias_1 = ProductAlias(
        id=uuid.uuid4(),
        product_id=rl_250.id,
        alias="Red Label Chai",
        normalized_alias="red label chai",
        language="hi-Latn",
    )
    alias_2 = ProductAlias(
        id=uuid.uuid4(),
        product_id=rl_500.id,
        alias="Red Label Chai",
        normalized_alias="red label chai",
        language="hi-Latn",
    )
    alias_3 = ProductAlias(
        id=uuid.uuid4(),
        product_id=tata_500.id,
        alias="Tata Chai",
        normalized_alias="tata chai",
        language="hi-Latn",
    )

    def mock_execute(query):
        mock_result = MagicMock()
        q_str = str(query)
        if "FROM products" in q_str:
            mock_result.all.return_value = [
                (rl_250, "Red Label"),
                (rl_500, "Red Label"),
                (tata_500, "Tata Tea"),
            ]
        elif "FROM product_aliases" in q_str:
            mock_result.scalars.return_value.all.return_value = [alias_1, alias_2, alias_3]
        elif "FROM inventory" in q_str:
            mock_result.all.return_value = [
                (rl_250.id, 50, 0),
                (rl_500.id, 30, 0),
                (tata_500.id, 40, 0),
            ]
        else:
            mock_result.all.return_value = []
        return mock_result

    mock_db.execute.side_effect = mock_execute
    matcher = HybridProductMatcher(mock_db, retailer_id)
    # Mock prices
    matcher.prices_map = {
        rl_250.id: MagicMock(price=Decimal("120.00"), mrp=Decimal("130.00")),
        rl_500.id: MagicMock(price=Decimal("230.00"), mrp=Decimal("250.00")),
        tata_500.id: MagicMock(price=Decimal("260.00"), mrp=Decimal("280.00")),
    }
    return matcher, rl_250, rl_500, tata_500


def test_progressive_clarification_dialogue_flow(mock_tea_catalogue):
    """
    Test the complete 4-turn dialogue from Part 3.1:
    Turn 1: "Mujhe chai chahiye" -> Asks Brand (Tata Tea vs Red Label)
    Turn 2: "Red Label" -> Asks Pack Size (250g vs 500g)
    Turn 3: "500 gram wala" -> Asks Selling Unit (Packet vs Case)
    Turn 4: "2 case" -> Product Identified!
    """
    matcher, rl_250, rl_500, tata_500 = mock_tea_catalogue

    # Turn 1: Retailer says "Mujhe chai chahiye"
    pending = matcher.create_pending_product_request("Mujhe chai chahiye")
    assert pending.stage == ClarificationStage.AWAITING_BRAND
    assert pending.brand_status == AttributeStatus.AMBIGUOUS
    assert "Red Label" in pending.active_question or "Tata" in pending.active_question

    # Turn 2: Retailer answers "Red Label"
    pending = matcher.resolve_pending_slot(pending, "Red Label")
    assert pending.stage == ClarificationStage.AWAITING_PACKAGE_SIZE
    assert pending.brand_name == "Red Label"
    assert "250gm" in pending.active_question or "500gm" in pending.active_question

    # Turn 3: Retailer answers "500 gram wala"
    pending = matcher.resolve_pending_slot(pending, "500 gram wala")
    assert pending.stage == ClarificationStage.AWAITING_SELLING_UNIT
    assert pending.confirmed_product_id == str(rl_500.id)
    assert "Packet mein ya case mein" in pending.active_question

    # Turn 4: Retailer answers "2 case"
    pending = matcher.resolve_pending_slot(pending, "2 case")
    assert pending.stage == ClarificationStage.PRODUCT_IDENTIFIED
    assert pending.confirmed_product_id == str(rl_500.id)
    assert pending.quantity == 2
    assert pending.selling_unit == QuantityUnit.CASE


def test_relative_selection_cheapest_and_largest(mock_tea_catalogue):
    matcher, rl_250, rl_500, tata_500 = mock_tea_catalogue

    # 1. "jo sasta hai" selects rl_250 (price 120 vs 230)
    pending = matcher.create_pending_product_request("Red Label chai")
    assert pending.stage == ClarificationStage.AWAITING_PACKAGE_SIZE
    pending = matcher.resolve_pending_slot(pending, "jo sasta hai")
    assert pending.confirmed_product_id == str(rl_250.id)

    # 2. "sabse bada wala" selects rl_500 (pack size 500g vs 250g)
    pending2 = matcher.create_pending_product_request("Red Label chai")
    pending2 = matcher.resolve_pending_slot(pending2, "sabse bada wala")
    assert pending2.confirmed_product_id == str(rl_500.id)


def test_clarification_cancellation(mock_tea_catalogue):
    matcher, _, _, _ = mock_tea_catalogue
    pending = matcher.create_pending_product_request("Mujhe chai chahiye")
    assert pending.stage == ClarificationStage.AWAITING_BRAND

    pending = matcher.resolve_pending_slot(pending, "nahi chahiye cancel karo")
    assert pending.stage == ClarificationStage.CANCELLED


def test_unit_correction_scenario(mock_tea_catalogue):
    matcher, rl_250, rl_500, tata_500 = mock_tea_catalogue

    # Start with Red Label 500g at AWAITING_SELLING_UNIT
    pending = matcher.create_pending_product_request("Red Label chai 500g")
    assert pending.stage == ClarificationStage.AWAITING_SELLING_UNIT
    assert pending.confirmed_product_id == str(rl_500.id)

    # Scenario: Retailer clarifies "2 packet, case nahi"
    resolved = matcher.resolve_pending_slot(pending, "2 packet, case nahi")
    assert resolved.stage == ClarificationStage.PRODUCT_IDENTIFIED
    assert resolved.quantity == 2
    assert resolved.selling_unit == QuantityUnit.PIECE


def test_demonstrative_selection_in_dialogue(mock_tea_catalogue):
    matcher, rl_250, rl_500, tata_500 = mock_tea_catalogue

    # Turn 1: Retailer asks for tea -> AWAITING_BRAND (options: Red Label, Tata Tea)
    pending = matcher.create_pending_product_request("Mujhe chai chahiye")
    assert pending.stage == ClarificationStage.AWAITING_BRAND
    assert len(pending.active_options) >= 2

    # Turn 2: Retailer says "i said i want this" or "ye wala"
    # Should select active_options[0] (Red Label) and advance
    resolved = matcher.resolve_pending_slot(pending, "i said i want this")
    assert resolved.confirmed_product_id == str(pending.active_options[0].product_id)
    assert resolved.stage == ClarificationStage.PRODUCT_IDENTIFIED
    assert resolved.quantity == 1
    assert resolved.selling_unit == QuantityUnit.PIECE


def test_demonstrative_with_explicit_quantity(mock_tea_catalogue):
    matcher, rl_250, rl_500, tata_500 = mock_tea_catalogue

    pending = matcher.create_pending_product_request("Red Label chai")
    assert pending.stage == ClarificationStage.AWAITING_PACKAGE_SIZE

    # Retailer clarifies: "5 packet of this"
    resolved = matcher.resolve_pending_slot(pending, "give me 5 packet of this")
    assert resolved.stage == ClarificationStage.PRODUCT_IDENTIFIED
    assert resolved.quantity == 5
    assert resolved.selling_unit == QuantityUnit.PIECE
