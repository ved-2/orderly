import uuid
from decimal import Decimal
from unittest.mock import MagicMock
import pytest

from app.modules.ai_assistant.matcher import (
    HybridProductMatcher,
    ParsedRequirement,
    parse_retailer_phrase,
)
from app.modules.ai_assistant.schemas import MatchStatus, QuantityUnit
from app.modules.products.models import Brand, Product, ProductAlias


def test_parse_retailer_phrase_hindi_and_hinglish():
    # 1. Hindi numbers + pack size in grams
    req1 = parse_retailer_phrase("Mujhe Red Label chai ke 500 gram ke do packet chahiye")
    assert req1.quantity == 2
    assert req1.quantity_unit == QuantityUnit.PIECE
    assert req1.pack_size_hint == 500.0
    assert req1.pack_unit_hint == "gm"
    assert "red label" in req1.clean_query

    # 2. Case unit (peti / case)
    req2 = parse_retailer_phrase("Tata Salt 1 case bhejo")
    assert req2.quantity == 1
    assert req2.quantity_unit == QuantityUnit.CASE
    assert "tata salt" in req2.clean_query

    # 3. Colloquial weight: "aadha kilo"
    req3 = parse_retailer_phrase("Surf excel aadha kilo teen packet")
    assert req3.quantity == 3
    assert req3.quantity_unit == QuantityUnit.PIECE
    assert req3.pack_size_hint == 500.0
    assert "surf excel" in req3.clean_query

    # 4. MRP token hint
    req4 = parse_retailer_phrase("Parle-G 10 rs wala 5 packet")
    assert req4.quantity == 5
    assert req4.mrp_hint == 10.0
    assert "parle-g" in req4.clean_query


def test_hybrid_product_matcher_disambiguation_and_exact():
    # Set up mock DB session with products
    mock_db = MagicMock()
    retailer_id = uuid.uuid4()
    brand_id = uuid.uuid4()

    prod_250 = Product(
        id=uuid.uuid4(),
        brand_id=brand_id,
        sku="REDLABEL-250G",
        name="Red Label Natural Care Tea 250g",
        category="Tea",
        pack_size=Decimal("250"),
        pack_unit="gm",
        units_per_case=24,
        is_active=True,
    )
    prod_500 = Product(
        id=uuid.uuid4(),
        brand_id=brand_id,
        sku="REDLABEL-500G",
        name="Red Label Natural Care Tea 500g",
        category="Tea",
        pack_size=Decimal("500"),
        pack_unit="gm",
        units_per_case=12,
        is_active=True,
    )
    brand_obj = Brand(id=brand_id, name="Brooke Bond", code="BB", is_active=True)

    alias_1 = ProductAlias(
        id=uuid.uuid4(),
        product_id=prod_250.id,
        alias="Red Label Chai",
        normalized_alias="red label chai",
        language="hi-Latn",
    )
    alias_2 = ProductAlias(
        id=uuid.uuid4(),
        product_id=prod_500.id,
        alias="Red Label Chai",
        normalized_alias="red label chai",
        language="hi-Latn",
    )

    # Mock execute results
    def mock_execute(query):
        mock_result = MagicMock()
        q_str = str(query)
        if "FROM products" in q_str:
            mock_result.all.return_value = [
                (prod_250, "Brooke Bond"),
                (prod_500, "Brooke Bond"),
            ]
        elif "FROM product_aliases" in q_str:
            mock_result.scalars.return_value.all.return_value = [alias_1, alias_2]
        elif "FROM inventory" in q_str:
            mock_result.all.return_value = [
                (prod_250.id, 50, 0),
                (prod_500.id, 30, 0),
            ]
        else:
            mock_result.all.return_value = []
        return mock_result

    mock_db.execute.side_effect = mock_execute

    matcher = HybridProductMatcher(mock_db, retailer_id)

    # 1. Ambiguous query: "Red Label chai" without pack size
    result_ambiguous = matcher.match_item("Red Label chai do packet")
    assert result_ambiguous.status == MatchStatus.AMBIGUOUS
    assert result_ambiguous.quantity == 2
    assert len(result_ambiguous.candidate_options) == 2
    assert "Red Label" in result_ambiguous.clarification_question

    # 2. Specific query: "Red Label 500g do packet"
    result_specific = matcher.match_item("Red Label chai 500g do packet")
    assert result_specific.status == MatchStatus.MATCHED
    assert result_specific.product_id == str(prod_500.id)
    assert result_specific.quantity == 2

    # 3. Exact SKU match
    result_sku = matcher.match_item("REDLABEL-250G ek peti")
    assert result_sku.status == MatchStatus.MATCHED
    assert result_sku.product_id == str(prod_250.id)
    assert result_sku.quantity_unit == QuantityUnit.CASE


def test_conversational_filler_and_vague_demonstrative():
    req1 = parse_retailer_phrase("i want tea")
    assert req1.clean_query == "tea"
    assert req1.quantity == 1

    req2 = parse_retailer_phrase("i said i want this")
    assert req2.is_demonstrative is True
    assert req2.clean_query == "this"

    req3 = parse_retailer_phrase("give me 2 packets of tea")
    assert req3.clean_query == "tea"
    assert req3.quantity == 2
    assert req3.quantity_unit == QuantityUnit.PIECE

    req4 = parse_retailer_phrase("give me 1 kg salt")
    assert req4.clean_query == "salt"
    assert req4.pack_size_hint == 1000.0


def test_vague_request_without_context_prompts_user():
    mock_db = MagicMock()
    matcher = HybridProductMatcher(mock_db, uuid.uuid4())
    pending = matcher.create_pending_product_request("i want this")
    assert pending.stage.value == "CANCELLED"
    assert "kaunsa product chahiye" in pending.active_question.lower()


def test_typo_tolerance_on_aliases():
    mock_db = MagicMock()
    retailer_id = uuid.uuid4()
    p_biscuit = Product(
        id=uuid.uuid4(),
        brand_id=uuid.uuid4(),
        sku="DD-BISCUIT-001",
        name="DailyDrop Glucose Biscuits",
        category="Snacks",
        pack_size=Decimal("100"),
        pack_unit="g",
        units_per_case=48,
        is_active=True,
    )
    p_rice = Product(
        id=uuid.uuid4(),
        brand_id=uuid.uuid4(),
        sku="FF-RICE-001",
        name="FreshFarm Premium Rice",
        category="Staples",
        pack_size=Decimal("5"),
        pack_unit="kg",
        units_per_case=4,
        is_active=True,
    )

    matcher = HybridProductMatcher.__new__(HybridProductMatcher)
    matcher.db = mock_db
    matcher.retailer_id = retailer_id
    matcher.products = [(p_biscuit, "DailyDrop"), (p_rice, "FreshFarm")]
    matcher.alias_map = {
        p_biscuit.id: ["biscuit", "biskt", "glucose biscuits"],
        p_rice.id: ["rice", "chawal"],
    }
    matcher.inventory_map = {p_biscuit.id: 50, p_rice.id: 50}
    matcher.prices_map = {
        p_biscuit.id: MagicMock(price=Decimal("20.00"), mrp=Decimal("25.00")),
        p_rice.id: MagicMock(price=Decimal("400.00"), mrp=Decimal("450.00")),
    }

    # "biskt" matches biscuit alias
    cands_biskt = matcher.score_candidates("biskt")
    assert len(cands_biskt) >= 1
    assert cands_biskt[0][0].sku == "DD-BISCUIT-001"

    # "chawl" typo matches chawal (rice, 91% ratio)
    cands_chawl = matcher.score_candidates("chawl")
    assert len(cands_chawl) >= 1
    assert cands_chawl[0][0].sku == "FF-RICE-001"


def test_anti_echo_noise_phrases_do_not_match_products():
    mock_db = MagicMock()
    from app.modules.ai_assistant.schemas import ClarificationStage
    matcher = HybridProductMatcher(mock_db, uuid.uuid4())

    # Assistant prompts picked up by mic should have empty clean queries
    parsed1 = parse_retailer_phrase("kitna chahiye ye upload hai")
    assert parsed1.clean_query == ""

    parsed2 = parse_retailer_phrase("vho upload hai")
    assert parsed2.clean_query == ""

    parsed3 = parse_retailer_phrase("kitne packet chahiye uplabdh hai")
    assert parsed3.clean_query == ""

    # Should not produce candidate products
    assert matcher.score_candidates(parsed1.clean_query) == []
    assert matcher.score_candidates(parsed2.clean_query) == []

    # create_pending_product_request should cancel and ask for product name, not hallucinate products
    pending = matcher.create_pending_product_request("kitna chahiye ye upload hai")
    assert pending.stage == ClarificationStage.CANCELLED
    assert "kaunsa product chahiye" in pending.active_question.lower()
