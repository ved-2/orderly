import difflib
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.ai_assistant.schemas import (
    ClarificationOption,
    ExtractedOrderItem,
    MatchStatus,
    ProductCardInfo,
    QuantityUnit,
)
from app.modules.inventory.models import Inventory
from app.modules.pricing.service import get_retailer_product_prices
from app.modules.products.models import Brand, Product, ProductAlias


# Pure-Python fallback with optional RapidFuzz optimization
try:
    from rapidfuzz import fuzz as _rf_fuzz

    def token_set_ratio(s1: str, s2: str) -> float:
        return float(_rf_fuzz.token_set_ratio(s1, s2))

except ImportError:

    def token_set_ratio(s1: str, s2: str) -> float:
        """
        Pure-Python token-set ratio similarity matching.
        Evaluates token containment and character-level edit distance.
        """
        if not s1 or not s2:
            return 0.0

        t1 = set(s1.lower().split())
        t2 = set(s2.lower().split())
        if not t1 or not t2:
            return 0.0

        intersection = sorted(list(t1.intersection(t2)))
        diff1 = sorted(list(t1.difference(t2)))
        diff2 = sorted(list(t2.difference(t1)))

        # If all query tokens exist in target, very high score
        if not diff1:
            return 95.0

        t0_str = " ".join(intersection)
        t1_str = " ".join(intersection + diff1)
        t2_str = " ".join(intersection + diff2)

        ratios = [
            difflib.SequenceMatcher(None, t0_str, t1_str).ratio(),
            difflib.SequenceMatcher(None, t0_str, t2_str).ratio(),
            difflib.SequenceMatcher(None, t1_str, t2_str).ratio(),
        ]
        return max(ratios) * 100.0


# Number word mappings for Hindi / Hinglish
HINDI_NUMBER_MAP = {
    "ek": 1,
    "do": 2,
    "teen": 3,
    "char": 4,
    "chaar": 4,
    "paanch": 5,
    "panch": 5,
    "che": 6,
    "chhe": 6,
    "saat": 7,
    "aath": 8,
    "nau": 9,
    "das": 10,
    "gyarah": 11,
    "barah": 12,
    "terah": 13,
    "chaudah": 14,
    "pandrah": 15,
    "solah": 16,
    "satrah": 17,
    "atharah": 18,
    "unnis": 19,
    "bees": 20,
    "pachis": 25,
    "tees": 30,
    "chaalis": 40,
    "pachaas": 50,
    "pachas": 50,
    "sau": 100,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "twenty": 20,
}

# Unit mappings
CASE_UNITS = {"peti", "case", "cases", "carton", "cartons", "box", "boxes"}
PIECE_UNITS = {
    "packet",
    "packets",
    "pkt",
    "pkts",
    "piece",
    "pieces",
    "pcs",
    "nag",
    "bottle",
    "bottles",
    "pouch",
    "pouches",
    "dabba",
    "dabbe",
}

# Stop words to remove during search term extraction
NOISE_TOKENS = {
    "chahiye",
    "bhejo",
    "daalo",
    "karo",
    "de",
    "do",
    "aur",
    "bhi",
    "wala",
    "wali",
    "wale",
    "add",
    "please",
    "plz",
    "mujhe",
    "hume",
    "humko",
    "bhai",
    "ki",
    "ka",
    "ke",
    "par",
    "mein",
}


@dataclass
class ParsedRequirement:
    raw_query: str
    clean_query: str
    quantity: int
    quantity_unit: QuantityUnit
    pack_size_hint: Optional[float] = None
    pack_unit_hint: Optional[str] = None
    mrp_hint: Optional[float] = None


def normalize_text(text: str) -> str:
    """Normalize text by lowering, removing punctuation, and stripping whitespace."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s\.\-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_retailer_phrase(phrase: str) -> ParsedRequirement:
    """
    Extract quantity, packaging unit (case/piece), pack size (e.g. 500g, 1kg),
    and product search query from natural retailer voice/text input.
    """
    norm = normalize_text(phrase)

    quantity = 1
    quantity_unit = QuantityUnit.PIECE  # Default for FMCG kirana orders
    pack_size_hint = None
    pack_unit_hint = None
    mrp_hint = None

    # Check for colloquial pack sizes like "aadha kilo", "ek kilo", "paav"
    if "aadha kilo" in norm or "half kg" in norm:
        pack_size_hint = 500.0
        pack_unit_hint = "gm"
        norm = norm.replace("aadha kilo", "").replace("half kg", "")
    elif "ek kilo" in norm or "1 kilo" in norm:
        pack_size_hint = 1000.0
        pack_unit_hint = "gm"
        norm = norm.replace("ek kilo", "").replace("1 kilo", "")
    elif "paav" in norm or "ek paav" in norm:
        pack_size_hint = 250.0
        pack_unit_hint = "gm"
        norm = norm.replace("ek paav", "").replace("paav", "")

    # Regex for weights/volumes e.g. 500g, 500 gm, 1kg, 250 ml, 1 ltr
    size_match = re.search(
        r"(\d+(?:\.\d+)?)\s*(gm|g|gram|grams|kg|kilo|ml|l|ltr|litre|liter)\b",
        norm,
    )
    if size_match:
        val = float(size_match.group(1))
        unit = size_match.group(2)
        if unit in {"kg", "kilo"}:
            pack_size_hint = val * 1000
            pack_unit_hint = "gm"
        elif unit in {"l", "ltr", "litre", "liter"}:
            pack_size_hint = val * 1000
            pack_unit_hint = "ml"
        else:
            pack_size_hint = val
            pack_unit_hint = "gm" if unit in {"g", "gram", "grams", "gm"} else "ml"
        norm = norm[: size_match.start()] + " " + norm[size_match.end() :]

    # Regex for price/MRP hints e.g. "10 rs", "5 rupaye", "₹10"
    mrp_match = re.search(r"(\d+)\s*(?:rs|rupaye|rupee|rupees)\b", norm)
    if mrp_match:
        mrp_hint = float(mrp_match.group(1))
        norm = norm[: mrp_match.start()] + " " + norm[mrp_match.end() :]

    # Extract quantity & unit
    remaining_tokens = norm.split()
    clean_words = []
    i = 0
    while i < len(remaining_tokens):
        w = remaining_tokens[i]

        parsed_qty = None
        if w.isdigit():
            parsed_qty = int(w)
        elif w in HINDI_NUMBER_MAP:
            parsed_qty = HINDI_NUMBER_MAP[w]

        if parsed_qty is not None and parsed_qty > 0:
            quantity = parsed_qty
            # Check if next word is unit (e.g. "10 packet", "2 peti")
            if i + 1 < len(remaining_tokens):
                nxt = remaining_tokens[i + 1]
                if nxt in CASE_UNITS:
                    quantity_unit = QuantityUnit.CASE
                    i += 2
                    continue
                elif nxt in PIECE_UNITS:
                    quantity_unit = QuantityUnit.PIECE
                    i += 2
                    continue
            i += 1
            continue

        if w in CASE_UNITS:
            quantity_unit = QuantityUnit.CASE
            i += 1
            continue
        elif w in PIECE_UNITS:
            quantity_unit = QuantityUnit.PIECE
            i += 1
            continue

        if w not in NOISE_TOKENS:
            clean_words.append(w)
        i += 1

    clean_query = " ".join(clean_words).strip()
    return ParsedRequirement(
        raw_query=phrase,
        clean_query=clean_query or norm.strip(),
        quantity=quantity,
        quantity_unit=quantity_unit,
        pack_size_hint=pack_size_hint,
        pack_unit_hint=pack_unit_hint,
        mrp_hint=mrp_hint,
    )


class HybridProductMatcher:
    """
    Hybrid semantic matcher combining:
    1. Exact Barcode / SKU / Alias match.
    2. Token-set similarity matching over product names, brands, and aliases.
    3. Mandatory attribute constraint checks (brand, pack size, unit).
    4. Ambiguity resolution and clarification question generation.
    """

    def __init__(self, db: Session, retailer_id: UUID):
        self.db = db
        self.retailer_id = retailer_id
        self._load_catalogue_cache()

    def _load_catalogue_cache(self):
        """Preload active products, brands, and aliases."""
        products_query = (
            select(Product, Brand.name.label("brand_name"))
            .join(Brand, Product.brand_id == Brand.id)
            .where(Product.is_active.is_(True), Brand.is_active.is_(True))
        )
        self.products = self.db.execute(products_query).all()

        # Load aliases
        alias_query = select(ProductAlias)
        self.aliases = self.db.execute(alias_query).scalars().all()

        self.alias_map: dict[UUID, list[str]] = {}
        for a in self.aliases:
            self.alias_map.setdefault(a.product_id, []).append(
                a.normalized_alias.lower()
            )

        # Preload inventory
        product_ids = [p.id for p, _ in self.products]
        if product_ids:
            inv_rows = self.db.execute(
                select(
                    Inventory.product_id,
                    func.coalesce(func.sum(Inventory.quantity_on_hand), 0),
                    func.coalesce(func.sum(Inventory.quantity_reserved), 0),
                )
                .where(Inventory.product_id.in_(product_ids))
                .group_by(Inventory.product_id)
            ).all()
            self.inventory_map = {
                pid: max(0, qoh - qres) for pid, qoh, qres in inv_rows
            }
            # Preload prices
            try:
                self.prices_map = get_retailer_product_prices(
                    self.db, self.retailer_id, product_ids
                )
            except Exception:
                self.prices_map = {}
        else:
            self.inventory_map = {}
            self.prices_map = {}

    def match_item(self, phrase: str) -> ExtractedOrderItem:
        """
        Execute the hybrid matching pipeline for a natural phrase.
        Returns an ExtractedOrderItem with match status, confidence, candidate cards,
        or clarification question if ambiguous.
        """
        req = parse_retailer_phrase(phrase)
        query = req.clean_query.lower().strip()

        if not query:
            return ExtractedOrderItem(
                raw_text=phrase,
                quantity=req.quantity,
                quantity_unit=req.quantity_unit,
                status=MatchStatus.NOT_FOUND,
                clarification_question="Kripya product ka naam batayein.",
            )

        scored_candidates: list[Tuple[Product, str, float]] = []

        # Stage 1 & 2: Score candidates
        for prod, brand_name in self.products:
            prod_name = prod.name.lower()
            b_name = brand_name.lower()
            sku = prod.sku.lower()
            aliases = self.alias_map.get(prod.id, [])

            # Exact SKU or Barcode match
            if query == sku:
                score = 100.0
            elif query in aliases:
                score = 98.0
            else:
                # Token matching across name, brand + name, and aliases
                name_score = token_set_ratio(query, prod_name)
                brand_and_name_score = token_set_ratio(
                    query, f"{b_name} {prod_name}"
                )
                alias_score = 0.0
                if aliases:
                    alias_score = max(token_set_ratio(query, al) for al in aliases)
                score = max(name_score, brand_and_name_score, alias_score)

            # Stage 3: Attribute Constraint Adjustments
            # Pack size matching
            if req.pack_size_hint is not None:
                prod_pack_size = float(prod.pack_size)
                if prod.pack_unit.lower() in {"kg", "kilo"}:
                    prod_pack_size *= 1000

                if abs(prod_pack_size - req.pack_size_hint) < 1.0:
                    score += 15.0  # Boost matching pack size
                else:
                    score -= 25.0  # Penalize mismatched pack size

            # MRP hint matching
            if req.mrp_hint is not None:
                price_rec = self.prices_map.get(prod.id)
                if price_rec and hasattr(price_rec, "mrp") and price_rec.mrp:
                    if abs(float(price_rec.mrp) - req.mrp_hint) < 2.0:
                        score += 15.0

            if score >= 55.0:
                scored_candidates.append((prod, brand_name, score))

        # Sort candidates descending by score
        scored_candidates.sort(key=lambda x: x[2], reverse=True)

        # Stage 4: Ambiguity & Match Resolution
        if not scored_candidates:
            return ExtractedOrderItem(
                raw_text=phrase,
                quantity=req.quantity,
                quantity_unit=req.quantity_unit,
                status=MatchStatus.NOT_FOUND,
                confidence=0.0,
                clarification_question=f"'{phrase}' catalogue me nahi mila. Kripya doosra naam try karein.",
            )

        top_prod, top_brand, top_score = scored_candidates[0]

        # Check for ambiguity: multiple strong candidates close in score
        ambiguous_candidates = [
            c for c in scored_candidates if c[2] >= 65.0 and (top_score - c[2]) <= 12.0
        ]

        if len(ambiguous_candidates) > 1 and req.pack_size_hint is None:
            # Check if candidates are distinct variants/pack sizes
            options: list[ClarificationOption] = []
            for prod, brand, _ in ambiguous_candidates[:4]:
                price_rec = self.prices_map.get(prod.id)
                price_val = (
                    float(price_rec.price)
                    if price_rec and hasattr(price_rec, "price")
                    else None
                )
                stock = self.inventory_map.get(prod.id, 0)
                options.append(
                    ClarificationOption(
                        product_id=str(prod.id),
                        sku=prod.sku,
                        name=prod.name,
                        brand_name=brand,
                        pack_size=float(prod.pack_size),
                        pack_unit=prod.pack_unit,
                        units_per_case=prod.units_per_case,
                        price=price_val,
                        is_in_stock=stock > 0,
                        quantity_available=stock,
                    )
                )

            # Formulate concise bilingual clarification question
            option_names = [
                f"{opt.brand_name} {opt.name} ({opt.pack_size}{opt.pack_unit})"
                for opt in options[:3]
            ]
            clarification_q = (
                f"Hamare paas {', '.join(option_names)} available hain. Aapko kaunsa chahiye?"
            )

            return ExtractedOrderItem(
                raw_text=phrase,
                quantity=req.quantity,
                quantity_unit=req.quantity_unit,
                confidence=round(top_score / 100.0, 2),
                status=MatchStatus.AMBIGUOUS,
                clarification_question=clarification_q,
                candidate_options=options,
            )

        # Clear winner
        stock = self.inventory_map.get(top_prod.id, 0)
        price_rec = self.prices_map.get(top_prod.id)
        unit_price = (
            float(price_rec.price)
            if price_rec and hasattr(price_rec, "price")
            else None
        )

        match_status = (
            MatchStatus.MATCHED if stock > 0 else MatchStatus.OUT_OF_STOCK
        )
        clarification_msg = None
        if match_status == MatchStatus.OUT_OF_STOCK:
            clarification_msg = (
                f"{top_brand} {top_prod.name} filhal out of stock hai."
            )

        return ExtractedOrderItem(
            raw_text=phrase,
            product_id=str(top_prod.id),
            sku=top_prod.sku,
            product_name=top_prod.name,
            brand_name=top_brand,
            pack_size=float(top_prod.pack_size),
            pack_unit=top_prod.pack_unit,
            quantity=req.quantity,
            quantity_unit=req.quantity_unit,
            confidence=round(min(1.0, top_score / 100.0), 2),
            unit_price=unit_price,
            status=match_status,
            clarification_question=clarification_msg,
        )

    def build_product_card(self, product_id: str) -> Optional[ProductCardInfo]:
        """Generate a rich UI card for a matched or recommended product."""
        try:
            pid = UUID(product_id)
        except ValueError:
            return None

        found = next((p for p in self.products if p[0].id == pid), None)
        if not found:
            return None

        prod, brand_name = found
        stock = self.inventory_map.get(pid, 0)
        price_rec = self.prices_map.get(pid)
        price_val = (
            float(price_rec.price)
            if price_rec and hasattr(price_rec, "price")
            else None
        )
        mrp_val = (
            float(price_rec.mrp)
            if price_rec and hasattr(price_rec, "mrp")
            else None
        )

        return ProductCardInfo(
            product_id=str(prod.id),
            sku=prod.sku,
            name=prod.name,
            brand_name=brand_name,
            category=prod.category,
            pack_size=float(prod.pack_size),
            pack_unit=prod.pack_unit,
            units_per_case=prod.units_per_case,
            price=price_val,
            mrp=mrp_val,
            is_in_stock=stock > 0,
            quantity_available=stock,
            cart_quantity=0,
            cart_unit=QuantityUnit.CASE,
            image_url=None,
        )
