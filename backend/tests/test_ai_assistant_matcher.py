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
