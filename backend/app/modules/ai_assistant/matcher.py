import difflib
import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.ai_assistant.schemas import (
    AttributeStatus,
    ClarificationOption,
    ClarificationStage,
    ExtractedOrderItem,
    MatchStatus,
    PendingProductRequest,
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

        if not diff1:
            return 95.0

        if intersection:
            t0_str = " ".join(intersection)
            t1_str = " ".join(intersection + diff1)
            t2_str = " ".join(intersection + diff2)

            ratios = [
                difflib.SequenceMatcher(None, t0_str, t1_str).ratio(),
                difflib.SequenceMatcher(None, t0_str, t2_str).ratio(),
                difflib.SequenceMatcher(None, t1_str, t2_str).ratio(),
            ]
            return max(ratios) * 100.0

        # No token intersection: require substring or high sequence similarity
        s1_l = s1.lower().strip()
        s2_l = s2.lower().strip()
        if s1_l in s2_l or s2_l in s1_l:
            return 85.0

        sm = difflib.SequenceMatcher(None, s1_l, s2_l).ratio()
        return (sm * 100.0) if sm >= 0.70 else 0.0


# Number word mappings for Hindi (Latin script and Devanagari) and English
HINDI_NUMBER_MAP = {
    # Latin transliterated
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
    # Devanagari script numbers
    "एक": 1,
    "दो": 2,
    "तीन": 3,
    "चार": 4,
    "पांच": 5,
    "पाँच": 5,
    "छह": 6,
    "सात": 7,
    "आठ": 8,
    "नौ": 9,
    "दस": 10,
    "ग्यारह": 11,
    "बारह": 12,
    "तेरह": 13,
    "चौदह": 14,
    "पंद्रह": 15,
    "सोलह": 16,
    "सत्रह": 17,
    "अठारह": 18,
    "उन्नीस": 19,
    "बीस": 20,
    "पच्चीस": 25,
    "तीस": 30,
    "चालीस": 40,
    "पचास": 50,
    "सौ": 100,
}

# Unit mappings (Latin and Devanagari)
CASE_UNITS = {
    "peti",
    "case",
    "cases",
    "carton",
    "cartons",
    "box",
    "boxes",
    "पेटी",
    "पेटियां",
    "केस",
    "कार्टन",
    "डिब्बा",
    "डिब्बे",
    "कैसे",
    "kaise",
    "किस",
    "kis",
}

PIECE_UNITS = {
    "packet",
    "packets",
    "paket",
    "pakets",
    "pkt",
    "pkts",
    "piece",
    "pieces",
    "pcs",
    "piceces",
    "nag",
    "bottle",
    "bottles",
    "pouch",
    "pouches",
    "pouchs",
    "dabba",
    "dabbe",
    "dibba",
    "dibbe",
    "pack",
    "packs",
    "पैकेट",
    "पैकेट्स",
    "पॉकेट",
    "पीस",
    "नग",
    "पाउच",
    "बोतल",
    "डिब्बा",
    "डिब्बे",
    "ब्रैकेट",
    "ब्रैकेट्स",
    "bracket",
    "brackets",
}

# Stop words to remove during search term extraction (Latin and Devanagari)
NOISE_TOKENS = {
    # English conversational filler
    "i",
    "want",
    "wants",
    "wanted",
    "give",
    "me",
    "send",
    "can",
    "you",
    "need",
    "needs",
    "said",
    "say",
    "saying",
    "put",
    "take",
    "bring",
    "item",
    "items",
    "product",
    "products",
    "the",
    "a",
    "an",
    "of",
    "some",
    "for",
    "to",
    "in",
    "from",
    "with",
    "sir",
    "bhaiya",
    "ji",
    "order",
    "please",
    "plz",
    # Hinglish / Latin
    "chahiye",
    "kitna",
    "kitne",
    "kitni",
    "uplabdh",
    "upload",
    "uplaod",
    "uplod",
    "uplabd",
    "available",
    "batao",
    "batayein",
    "bataiye",
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
    "mujhe",
    "muzhe",
    "hume",
    "humko",
    "bhai",
    "ki",
    "ka",
    "ke",
    "k",
    "par",
    "mein",
    "hona",
    "hone",
    "honi",
    "what",
    "about",
    "and",
    "hai",
    "hain",
    "nahi",
    "nahin",
    "mat",
    "not",
    "no",
    "kripya",
    "apna",
    "apne",
    "bhejna",
    "dalna",
    "karna",
    "mai",
    "mein",
    "konsa",
    "kaunsa",
    "lao",
    # Demonstratives
    "this",
    "that",
    "these",
    "those",
    "ye",
    "yeh",
    "woh",
    "voh",
    "vho",
    "wo",
    "is",
    "ise",
    "isey",
    "isko",
    "use",
    "usey",
    "usko",
    "yehi",
    "wohi",
    # Devanagari
    "नहीं",
    "मत",
    "चाहिए",
    "चाहिये",
    "होना",
    "होने",
    "दो",
    "दें",
    "लाओ",
    "भेजो",
    "डालो",
    "करो",
    "है",
    "हैं",
    "का",
    "की",
    "के",
    "मुझे",
    "हमे",
    "हमको",
    "भी",
    "वाला",
    "वाली",
    "वाले",
    "पर",
    "में",
    "यही",
    "वही",
    "यह",
    "ये",
    "वह",
    "वो",
    "और",
    "ऐड",
    "एड",
    "कर",
    "देना",
    "दे",
    "डाल",
    "डालना",
    "करना",
    "उपलब्ध",
    "कितना",
    "कितने",
    "कितनी",
    "हाँ",
    "हां",
    "अच्छा",
    "ठीक",
    "dena",
    "daal",
    "लव",
    "डे",
    "लवडे",
    "love",
    "day",
    "इसके",
    "उसका",
    "उसके",
    "इन्हें",
    "उन्हें",
    "iske",
    "iski",
    "iska",
}

def clean_retailer_speech_echo(msg: str, active_question: Optional[str] = None) -> str:
    """
    Cleans speaker echo or assistant prompt repetition from user audio transcript.
    Handles glued words like 'चाहिएचार' -> 'चाहिए चार' and 'मेंचार' -> 'में चार',
    and strips echoed question prefixes before user responses.
    """
    if not msg:
        return ""
    cleaned = msg.strip()

    # 1. Separate glued numbers (e.g. 'चाहिएचार' -> 'चाहिए चार', 'मेंचार' -> 'में चार')
    hindi_num_words = [
        "एक", "दो", "तीन", "चार", "पांच", "पाँच", "छह", "सात", "आठ", "नौ",
        "दस", "ग्यारह", "बारह", "बीस", "तीस", "चालीस", "पचास", "सौ"
    ]
    num_split_pat = re.compile(rf"([^\s\d])({'|'.join(hindi_num_words)}|\d+)")
    cleaned = num_split_pat.sub(r"\1 \2", cleaned)

    # 2. Strip assistant question echoes ending with chahiye/mein/? followed by numbers or user affirmations
    lookahead_tokens = hindi_num_words + [
        "\\d+", "हाँ", "हां", "haan", "yes", "theek", "theek hai", "ha",
        "mujhe", "मुझे", "aur", "iske", "इसके", "uska", "उसके", "kripya", "please"
    ]
    q_end_pat = re.compile(
        r"^.*?(?:चाहिए\??|चाहिये\??|\?|batayein|batao|bataiye|chahiye\??|केस\s*में|packet\s*mein|case\s*mein|में|डेट)\s*(?=(?:" + "|".join(lookahead_tokens) + r"))",
        re.IGNORECASE,
    )
    m = q_end_pat.search(cleaned)
    if m:
        remaining = cleaned[m.end() :].strip()
        if remaining:
            cleaned = remaining

    # 3. Check if entire message is just assistant echo or prompt repetition
    norm_l = cleaned.lower()
    pure_echo_tokens = {
        "uplabdh", "uplabd", "uplaod", "upload", "उपलब्ध", "लव डे", "लवडे", "love day",
        "kya aapko ye chahiye", "kya aapko yeh chahiye", "क्या आपको यह चाहिए",
        "kitne packet ya case", "kitni bracket ya kaise", "कितनी ब्रैकेट या कैसे",
    }
    for echo_phrase in pure_echo_tokens:
        if norm_l == echo_phrase or norm_l == f"{echo_phrase}?" or norm_l == f"{echo_phrase} hai":
            return ""

    # Common spoken echo signatures from assistant questions & note confirmations
    echo_signatures = [
        "ऑप्शन चाहिए", "option chahiye", "वेरिएंट का ऑप्शन", "variant ka option",
        "वेरिएंट का", "variant ka", "पैक का ऑप्शन", "pack ka option",
        "नोट कर ली है", "note kar li hai", "नोट करली", "note karli",
        "उपलब्ध है", "uplabdh hai", "upload hai",
        "kaunse variant", "कौनसे वेरिएंट", "केक ओंस", "केक ऑन", "के कौनसे",
        "kitne packet ya case", "packet mein ya case mein",
    ]
    for sig in echo_signatures:
        if sig in norm_l:
            return ""

    if active_question:
        norm_q = active_question.lower()
        q_indicator_words = {"chahiye", "kaunse", "konsa", "kaunsi", "variant", "option", "pack", "packet", "uplabdh", "available", "चाहिए", "वेरिएंट", "ऑप्शन", "उपलब्ध", "कौनसे"}
        shared_indicators = set(re.findall(r"\w+", norm_l)).intersection(q_indicator_words)
        if len(shared_indicators) >= 2:
            return ""

    return cleaned


def is_demonstrative_reference(phrase: str) -> bool:
    """
    Check if a user utterance points to a contextual product
    (e.g., 'i want this', 'i said i want this', 'give me 5 packet of this', 'ye chahiye', 'ye wala', '2 peti ye de do').
    """
    if not phrase:
        return False
    norm = normalize_text(phrase).lower().strip()
    tokens = set(norm.split())
    demo_tokens = {
        "this", "that", "these", "those", "ye", "yeh", "woh", "voh", "vho", "wo",
        "yehi", "wohi", "ise", "isey", "isko", "use", "usey", "usko", "yahi",
        "यह", "ये", "वह", "वो", "यही", "वही",
    }
    has_demo_token = bool(tokens.intersection(demo_tokens))
    if not has_demo_token and not any(p in norm for p in ["ye wala", "yeh wala", "woh wala", "this one", "that one", "of this"]):
        return False

    units_and_noise = {
        "i", "said", "say", "want", "give", "me", "send", "need", "please", "plz",
        "bhai", "bhaiya", "ji", "mujhe", "humko", "de", "do", "bhejo", "add", "karo",
        "chahiye", "wala", "wali", "wale", "one", "of", "ka", "ke", "ki",
        "packet", "packets", "pkt", "pkts", "piece", "pieces", "pcs", "nag",
        "case", "cases", "peti", "carton", "cartons", "box", "boxes",
        "पैकेट", "पेटी", "पीस", "नग", "डिब्बा",
    }
    words = [
        w for w in norm.split()
        if not w.isdigit() and w not in units_and_noise and w not in demo_tokens and w not in HINDI_NUMBER_MAP
    ]
    return len(words) == 0

# Built-in FMCG catalogue aliases for seamless Kirana store matching
BUILTIN_CATALOGUE_ALIASES: dict[str, list[str]] = {
    "RL-TEA-001": ["redleaf tea", "red leaf tea", "strong assam tea", "assam tea", "chai", "tea"],
    "RL-TEA-002": ["redleaf tea 500g", "red leaf 500g", "strong assam 500g"],
    "CB-TEA-001": ["chaibrew tea", "chai brew", "premium leaf tea", "leaf tea"],
    "CB-TEA-002": ["chaibrew tea 1kg", "chai brew 1kg", "premium leaf 1kg"],
    "MC-TEA-001": ["mountaincup tea", "mountain cup", "darjeeling tea"],
    "MC-TEA-002": ["mountaincup tea 250g", "darjeeling 250g"],
    "TG-TEA-001": ["teagarden tea", "tea garden", "ginger tea", "masala tea"],
    "TG-TEA-002": ["teagarden tea 250g", "ginger masala tea 250g"],
    "RC-TEA-001": ["royalchai tea", "royal chai", "cardamom tea", "elaichi tea"],
    "RC-TEA-002": ["royalchai tea 250g", "cardamom tea 250g"],
    "NG-TEA-001": ["nilgirigold tea", "nilgiri gold", "nilgiri tea"],
    "NG-TEA-002": ["nilgirigold tea 500g", "nilgiri gold 500g"],
    "DD-GHEE-001": ["cow ghee", "ghee", "desi ghee", "dailydrop ghee"],
    "DD-BESAN-001": ["besan", "gram flour", "chickpea flour", "dailydrop besan"],
    "SJ-BISCUIT-001": ["cream biscuits", "cream biscuit", "snackjoy biscuit"],
    "SJ-NAMKEEN-001": ["aloo bhujia", "bhujia", "namkeen", "snackjoy namkeen"],
    "QB-NOODLES-001": ["masala noodles", "noodles", "instant noodles", "quickbite noodles"],
    "QB-NOODLES-002": ["family noodles", "noodles 280g", "quickbite family pack"],
    "CP-TOOTHPASTE-001": ["toothpaste", "mint toothpaste", "careplus toothpaste"],
    "CP-SHAMPOO-001": ["shampoo", "hair shampoo", "careplus shampoo"],
    "HB-HANDWASH-001": ["handwash", "hand wash", "liquid handwash"],
    "FF-RICE-001": ["rice", "premium rice", "chawal", "basmati", "chawal 5kg", "rice 5kg", "चावल"],
    "FF-WHEAT-001": ["wheat flour", "atta", "aata", "flour", "gehu", "gehoon", "chakki atta", "आटा"],
    "FF-DAL-001": ["toor dal", "tuvar dal", "arhar dal", "dal", "daal", "pulses", "दाल"],
    "FF-SALT-001": ["iodised salt", "salt", "namak", "tata salt", "salt 1kg", "namak 1kg", "नमक"],
    "FF-POHA-001": ["poha", "chivda", "flattened rice", "aval", "पोहा"],
    "DD-OIL-001": ["refined sunflower oil", "sunflower oil", "oil", "tel", "refined oil", "cooking oil", "refined", "sunflower", "तेल"],
    "DD-SUGAR-001": ["sugar", "cheeni", "chini", "shakkar", "sugar 1kg", "cheeni 1kg", "चीनी"],
    "DD-TEA-001": ["assam tea", "tea", "chai", "chaye", "chaipatti", "chai patti", "red label", "taj mahal", "taaza", "चाय"],
    "DD-COFFEE-001": ["instant coffee", "coffee", "nescafe", "bru", "कॉफी"],
    "DD-BISCUIT-001": ["glucose biscuits", "biscuit", "biscuits", "biskt", "parle-g", "parleg", "parle g", "glucose", "बिस्कुट"],
    "HB-DISH-001": ["dishwash liquid", "dishwash", "dish wash", "bartan liquid", "vim liquid", "vim", "bartan", "pril"],
    "HB-DETERGENT-001": ["laundry powder", "detergent", "washing powder", "surf", "surf excel", "ariel", "ghadi", "tide", "wheel", "सर्फ"],
    "HB-SOAP-001": ["bath soap", "soap", "sabun", "lifebuoy", "dettol", "lux", "साबुन"],
    "HB-FLOOR-001": ["floor cleaner", "cleaner", "pochha", "lizol", "phenyl"],
    "HB-TISSUE-001": ["kitchen towels", "kitchen roll", "tissue", "paper towel", "napkin"],
    "SR-CHILLI-001": ["red chilli powder", "red chilli", "chilli powder", "chilli", "mirchi", "mirch", "lal mirch", "लाल मिर्च"],
    "SR-TURMERIC-001": ["turmeric powder", "turmeric", "haldi powder", "haldi", "हल्दी"],
    "SR-CUMIN-001": ["cumin seeds", "cumin", "jeera", "jira", "zeera", "जीरा"],
    "SR-GARAM-001": ["garam masala", "masala", "sabji masala", "spices", "गरम मसाला"],
    "SR-CORIANDER-001": ["coriander powder", "coriander", "dhaniya powder", "dhaniya", "धनिया"],
}

# Devanagari FMCG words to Roman / English mappings
DEVANAGARI_WORD_MAP = {
    # Brands
    "टाटा": "tata",
    "पारले": "parle",
    "अमूल": "amul",
    "ब्रिटानिया": "britannia",
    "नेस्ले": "nestle",
    "मैगी": "maggi",
    "सर्फ": "surf",
    "एक्सेल": "excel",
    "एरियल": "ariel",
    "टाइड": "tide",
    "व्हील": "wheel",
    "घड़ी": "ghadi",
    "घड़ी": "ghadi",
    "लाइफबॉय": "lifebuoy",
    "डेटॉल": "dettol",
    "लक्स": "lux",
    "कोलगेट": "colgate",
    "फॉर्च्यून": "fortune",
    "रेड": "red",
    "लेबल": "label",
    "ताज": "taj",
    "महल": "mahal",
    "ताजा": "taaza",
    "डेलीड्रॉप": "dailydrop",
    "फ्रेशफार्म": "freshfarm",
    # Commodities
    "असम": "assam",
    "टी": "tea",
    "चाय": "tea",
    "चायपत्ती": "tea",
    "साल्ट": "salt",
    "नमक": "salt",
    "बिस्कुट": "biscuit",
    "बिस्कूट": "biscuit",
    "चीनी": "sugar",
    "शक्कर": "sugar",
    "तेल": "oil",
    "रिफाइंड": "refined",
    "सरसों": "mustard",
    "सोयाबीन": "soybean",
    "घी": "ghee",
    "दाल": "dal",
    "चावल": "rice",
    "आटा": "atta",
    "मैदा": "maida",
    "सूजी": "sooji",
    "बेसन": "besan",
    "मसाला": "masala",
    "हल्दी": "haldi turmeric",
    "मिर्च": "mirch chilli",
    "मिर्ची": "mirch chilli",
    "धनिया": "dhaniya coriander",
    "जीरा": "jeera",
    "साबुन": "soap",
    "शैम्पू": "shampoo",
}

# Generic category keywords that require brand/variant clarification (Zero Guessing)
GENERIC_CATEGORY_KEYWORDS = {
    "chai": "Tea",
    "tea": "Tea",
    "चाय": "Tea",
    "biscuit": "Biscuits",
    "biscuits": "Biscuits",
    "बिस्कुट": "Biscuits",
    "बिस्किट": "Biscuits",
    "soap": "Soap",
    "sabun": "Soap",
    "साबुन": "Soap",
    "oil": "Cooking Oil",
    "tel": "Cooking Oil",
    "तेल": "Cooking Oil",
    "namak": "Salt",
    "salt": "Salt",
    "नमक": "Salt",
    "rice": "Rice",
    "chawal": "Rice",
    "चावल": "Rice",
    "atta": "Flour",
    "flour": "Flour",
    "आटा": "Flour",
    "dal": "Pulses",
    "दाल": "Pulses",
    "coffee": "Coffee",
    "कॉफी": "Coffee",
    "shampoo": "Personal Care",
    "detergent": "Detergent",
    "surf": "Detergent",
    "masala": "Spices",
    "मसाला": "Spices",
}


@dataclass
class ParsedRequirement:
    raw_query: str
    clean_query: str
    quantity: int = 1
    quantity_unit: QuantityUnit = QuantityUnit.PIECE
    quantity_explicit: bool = False
    quantity_unit_explicit: bool = False
    pack_size_hint: Optional[float] = None
    pack_unit_hint: Optional[str] = None
    mrp_hint: Optional[float] = None
    is_demonstrative: bool = False


def normalize_text(text: str) -> str:
    """
    Safely normalize text by lowering, removing punctuation without stripping
    hyphens, Devanagari vowel signs (matras), halants, or combining marks.
    """
    if not text:
        return ""

    text = text.lower()
    cleaned_chars = []
    for ch in text:
        # Keep hyphens for SKUs/brand names like Parle-G
        if ch == "-":
            cleaned_chars.append(ch)
            continue
        cat = unicodedata.category(ch)
        # Strip punctuation (P*), symbols (S*), control characters (C*)
        # Keep letters (L*), marks/matras (M*), numbers (N*), whitespace (Z*)
        if cat.startswith("P") or cat.startswith("S") or cat.startswith("C"):
            cleaned_chars.append(" ")
        else:
            cleaned_chars.append(ch)

    cleaned = "".join(cleaned_chars)
    return re.sub(r"\s+", " ", cleaned).strip()


def transliterate_hindi_tokens(text: str) -> str:
    """
    Convert Devanagari FMCG words and characters to their standard Latin/Roman equivalents.
    """
    words = text.split()
    translated = []
    for w in words:
        if w in DEVANAGARI_WORD_MAP:
            translated.append(DEVANAGARI_WORD_MAP[w])
        else:
            translated.append(w)
    return " ".join(translated)


def split_compound_retailer_message(message: str) -> List[str]:
    """
    Split compound sentences containing multiple items (e.g. joined by 'aur', 'and', 'और', ',').
    Example: 'असम टी और साल्ट चाहिए' -> ['असम टी', 'साल्ट चाहिए']
    """
    norm = normalize_text(message)

    # Conjunction separators: aur, और, and, तथा, एवं, saath me, साथ में
    pattern = r"\b(?:aur|and|और|तथा|एवं|saath\s+me|साथ\s+में)\b|,"
    parts = re.split(pattern, norm)
    clean_parts = [p.strip() for p in parts if p.strip()]
    return clean_parts if clean_parts else [norm]


def parse_retailer_phrase(phrase: str) -> ParsedRequirement:
    """
    Extract quantity, packaging unit (case/piece), pack size (e.g. 500g, 1kg),
    and product search query from natural retailer voice/text input (Hindi, English, Hinglish).
    """
    norm = normalize_text(phrase)

    quantity = 1
    quantity_unit = QuantityUnit.PIECE  # Default for FMCG kirana orders
    quantity_explicit = False
    quantity_unit_explicit = False
    pack_size_hint = None
    pack_unit_hint = None
    mrp_hint = None

    # Check for colloquial pack sizes (Latin & Devanagari)
    if "aadha kilo" in norm or "half kg" in norm or "आधा किलो" in norm:
        pack_size_hint = 500.0
        pack_unit_hint = "gm"
        norm = (
            norm.replace("aadha kilo", "")
            .replace("half kg", "")
            .replace("आधा किलो", "")
        )
    elif "ek kilo" in norm or "1 kilo" in norm or "एक किलो" in norm:
        pack_size_hint = 1000.0
        pack_unit_hint = "gm"
        norm = (
            norm.replace("ek kilo", "")
            .replace("1 kilo", "")
            .replace("एक किलो", "")
        )
    elif "paav" in norm or "ek paav" in norm or "पाव" in norm or "एक पाव" in norm:
        pack_size_hint = 250.0
        pack_unit_hint = "gm"
        norm = (
            norm.replace("ek paav", "")
            .replace("paav", "")
            .replace("एक पाव", "")
            .replace("पाव", "")
        )

    # Regex for weights/volumes e.g. 500g, 250 g, 100gm, 1kg, 250 ml, 1 ltr, 250 ग्राम
    size_match = re.search(
        r"(\d+(?:\.\d+)?)\s*(gm|g|gram|grams|kg|kilo|ml|l|ltr|litre|liter|ग्राम|ग्रा|किलो|किग्रा|लीटर|ली|एमएल)\b",
        norm,
    )
    if size_match:
        val = float(size_match.group(1))
        unit = size_match.group(2)
        if unit in {"kg", "kilo", "किलो", "किग्रा"}:
            pack_size_hint = val * 1000
            pack_unit_hint = "gm"
        elif unit in {"l", "ltr", "litre", "liter", "लीटर", "ली"}:
            pack_size_hint = val * 1000
            pack_unit_hint = "ml"
        else:
            pack_size_hint = val
            pack_unit_hint = "gm" if unit in {"g", "gram", "grams", "gm", "ग्राम", "ग्रा"} else "ml"
        norm = norm[: size_match.start()] + " " + norm[size_match.end() :]

    # Regex for price/MRP hints e.g. "10 rs", "5 rupaye", "₹10", "10 रुपये"
    mrp_match = re.search(r"(\d+)\s*(?:rs|rupaye|rupee|rupees|रुपये|रुपए)\b", norm)
    if mrp_match:
        mrp_hint = float(mrp_match.group(1))
        norm = norm[: mrp_match.start()] + " " + norm[mrp_match.end() :]

    # Detect negated units (e.g. "2 packet, case nahi", "case nahi 2 packet")
    neg_case_pat = r"\b(?:case|peti|carton|box|पेटी)\s+(?:nahi|nahin|not|mat|chhod ke)\b|\b(?:nahi|nahin|not|mat)\s+(?:case|peti|carton|box|पेटी)\b"
    neg_piece_pat = r"\b(?:packet|packets|pkt|piece|pieces|pcs|nag|पैकेट)\s+(?:nahi|nahin|not|mat|chhod ke)\b|\b(?:nahi|nahin|not|mat)\s+(?:packet|packets|pkt|piece|pieces|pcs|nag|पैकेट)\b"
    negated_case = bool(re.search(neg_case_pat, norm))
    negated_piece = bool(re.search(neg_piece_pat, norm))

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
            if w == "do":
                # In Hindi: "bhej do", "de do", "maggi do" -> "do" is verb 'give', not number 2
                next_word = remaining_tokens[i + 1] if i + 1 < len(remaining_tokens) else ""
                prev_word = remaining_tokens[i - 1] if i > 0 else ""
                if prev_word in {"de", "bhej", "kar"} or i == len(remaining_tokens) - 1 or next_word in NOISE_TOKENS:
                    parsed_qty = None
                else:
                    parsed_qty = 2
            else:
                parsed_qty = HINDI_NUMBER_MAP[w]

        if parsed_qty is not None and parsed_qty > 0:
            parsed_unit = QuantityUnit.PIECE
            has_unit = False
            # Check if next word is unit (e.g. "10 packet", "2 peti", "1 case")
            if i + 1 < len(remaining_tokens):
                nxt = remaining_tokens[i + 1]
                if nxt in CASE_UNITS and not negated_case:
                    parsed_unit = QuantityUnit.CASE
                    has_unit = True
                    i += 1
                elif nxt in PIECE_UNITS and not negated_piece:
                    parsed_unit = QuantityUnit.PIECE
                    has_unit = True
                    i += 1

            if quantity_explicit:
                # Additive compound quantities (e.g. "4 piece aur 2 packet" -> 4 + 2 = 6)
                if parsed_unit == quantity_unit:
                    quantity += parsed_qty
                elif parsed_unit == QuantityUnit.CASE:
                    quantity = parsed_qty
                    quantity_unit = parsed_unit
            else:
                quantity = parsed_qty
                quantity_explicit = True
                quantity_unit = parsed_unit
                if has_unit:
                    quantity_unit_explicit = True
            i += 1
            continue

        if w in CASE_UNITS:
            if not negated_case:
                quantity_unit = QuantityUnit.CASE
                quantity_unit_explicit = True
            i += 1
            continue
        elif w in PIECE_UNITS:
            if not negated_piece:
                quantity_unit = QuantityUnit.PIECE
                quantity_unit_explicit = True
            i += 1
            continue

        if w not in NOISE_TOKENS:
            clean_words.append(w)
        i += 1

    if negated_case and not negated_piece:
        quantity_unit = QuantityUnit.PIECE
        quantity_unit_explicit = True
    elif negated_piece and not negated_case:
        quantity_unit = QuantityUnit.CASE
        quantity_unit_explicit = True

    is_demo = is_demonstrative_reference(phrase)
    clean_phrase = " ".join(clean_words).strip()
    if not clean_phrase and is_demo:
        clean_phrase = "this"

    # Transliterate any Devanagari words to Latin for catalogue lookup
    latin_clean = transliterate_hindi_tokens(clean_phrase)

    return ParsedRequirement(
        raw_query=phrase,
        clean_query=latin_clean or clean_phrase,
        quantity=quantity,
        quantity_unit=quantity_unit,
        quantity_explicit=quantity_explicit,
        quantity_unit_explicit=quantity_unit_explicit,
        pack_size_hint=pack_size_hint,
        pack_unit_hint=pack_unit_hint,
        mrp_hint=mrp_hint,
        is_demonstrative=is_demo,
    )


class HybridProductMatcher:
    """
    Hybrid semantic matcher combining:
    1. Exact Barcode / SKU / Alias match.
    2. Token-set similarity matching over product names, brands, and multilingual aliases.
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

        # Merge built-in FMCG aliases for catalogue products
        for prod, _ in self.products:
            prod_aliases = self.alias_map.setdefault(prod.id, [])
            if prod.sku in BUILTIN_CATALOGUE_ALIASES:
                for al in BUILTIN_CATALOGUE_ALIASES[prod.sku]:
                    if al.lower() not in prod_aliases:
                        prod_aliases.append(al.lower())

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
            try:
                self.prices_map = get_retailer_product_prices(
                    self.db, self.retailer_id, product_ids
                )
            except Exception:
                self.prices_map = {}
        else:
            self.inventory_map = {}
            self.prices_map = {}


    @property
    def price_map(self) -> dict:
        """Accessor providing numeric unit prices by product ID."""
        if not hasattr(self, "prices_map"):
            return {}
        return {
            pid: float(prec.price) if prec and hasattr(prec, "price") else 0.0
            for pid, prec in self.prices_map.items()
        }

    def _get_tuples_by_ids(self, ids: list[str]) -> list[Tuple[Product, str, float]]:
        """Retrieve candidate tuples by product IDs."""
        id_set = set(ids)
        res = []
        for p, b in self.products:
            if str(p.id) in id_set:
                res.append((p, b, 80.0))
        return res

    def score_candidates(
        self,
        query: str,
        pack_size_hint: float | None = None,
        mrp_hint: float | None = None,
    ) -> list[Tuple[Product, str, float]]:
        """
        Score all products in catalogue against query, aliases, brand, category,
        and attribute constraints.
        """
        scored_candidates: list[Tuple[Product, str, float]] = []
        q = query.lower().strip()
        if not q or len(q) < 2:
            return []

        # Check if query matches generic category keywords
        matched_cat = GENERIC_CATEGORY_KEYWORDS.get(q)

        for prod, brand_name in self.products:
            prod_name = prod.name.lower()
            b_name = brand_name.lower()
            sku = prod.sku.lower()
            category = (prod.category or "").lower()
            aliases = self.alias_map.get(prod.id, [])

            # Exact SKU or Barcode match
            if q == sku:
                score = 100.0
            elif q in aliases:
                score = 98.0
            elif len(q) >= 3 and any(q == al or (len(al) >= 3 and al in q) for al in aliases):
                score = 92.0
            elif len(q) >= 3 and any(len(al) >= 3 and q in al for al in aliases):
                score = 88.0
            elif matched_cat and (matched_cat.lower() in category or matched_cat.lower() in prod_name):
                # Generic category query matches all products in this category
                score = 80.0
            else:
                q_clean = q.replace("-", "").strip()
                sku_clean = sku.replace("-", "").strip()
                if q_clean and (q_clean in sku_clean or sku_clean in q_clean):
                    sku_score = 95.0
                else:
                    sku_score = token_set_ratio(q, sku)

                name_score = token_set_ratio(q, prod_name)
                brand_and_name_score = token_set_ratio(q, f"{b_name} {prod_name}")
                alias_score = 0.0
                if aliases:
                    alias_score = max(
                        max(token_set_ratio(q, al), difflib.SequenceMatcher(None, q, al).ratio() * 100.0)
                        for al in aliases
                    )
                cat_score = token_set_ratio(q, category)
                score = max(sku_score, name_score, brand_and_name_score, alias_score, cat_score)

            # Attribute Constraint Adjustments
            if pack_size_hint is not None:
                prod_pack_size = float(prod.pack_size)
                if prod.pack_unit.lower() in {"kg", "kilo", "l", "litre", "liter"}:
                    prod_pack_size *= 1000

                if abs(prod_pack_size - pack_size_hint) < 1.0:
                    score += 15.0
                else:
                    score -= 25.0

            if mrp_hint is not None:
                price_rec = self.prices_map.get(prod.id)
                if price_rec and hasattr(price_rec, "mrp") and price_rec.mrp:
                    if abs(float(price_rec.mrp) - mrp_hint) < 2.0:
                        score += 15.0

            if score >= 72.0:
                scored_candidates.append((prod, brand_name, score))

        scored_candidates.sort(key=lambda x: x[2], reverse=True)
        return scored_candidates

    def build_clarification_options(
        self,
        candidates: list[Tuple[Product, str, float]],
    ) -> list[ClarificationOption]:
        """Convert candidate product tuples into rich ClarificationOptions."""
        options: list[ClarificationOption] = []
        for prod, brand, _ in candidates:
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
        return options

    def create_pending_product_request(
        self,
        phrase: str,
        explicit_quantity: int | None = None,
        explicit_quantity_unit: QuantityUnit | None = None,
        pack_size_hint: float | None = None,
        pack_unit_hint: str | None = None,
    ) -> PendingProductRequest:
        """
        Initialize or advance a stateful PendingProductRequest for progressive clarification.
        Guarantees ZERO GUESSING by checking brand, variant, package size, unit, and quantity.
        """
        req = parse_retailer_phrase(phrase)
        if explicit_quantity is not None and explicit_quantity > 0:
            req.quantity = explicit_quantity
            req.quantity_explicit = True
        if explicit_quantity_unit is not None:
            req.quantity_unit = explicit_quantity_unit
            req.quantity_unit_explicit = True
        if pack_size_hint is not None:
            req.pack_size_hint = pack_size_hint
            req.pack_unit_hint = pack_unit_hint

        query = req.clean_query.lower().strip()

        if req.is_demonstrative or query in {"this", "that", "ye", "yeh", "woh", "voh", "vho", "wo", ""} or len(query) < 2:
            return PendingProductRequest(
                raw_query=phrase,
                stage=ClarificationStage.CANCELLED,
                active_question="Aapko kaunsa product chahiye? Kripya product ka naam batayein (jaise Chai, Sugar, Oil, Salt, ya Rice).",
            )

        is_generic = (
            query in GENERIC_CATEGORY_KEYWORDS
            or any(
                cat in query
                for cat in [
                    "chai", "tea", "biscuit", "sabun", "soap",
                    "oil", "tel", "namak", "salt", "chawal",
                    "rice", "atta", "dal",
                ]
            )
        )

        candidates = self.score_candidates(query, req.pack_size_hint, req.mrp_hint)
        if not candidates:
            return PendingProductRequest(
                raw_query=phrase,
                stage=ClarificationStage.CANCELLED,
                active_question=f"'{req.clean_query}' catalogue me nahi mila. Kripya doosra naam ya brand try karein.",
            )

        candidate_ids = [str(p.id) for p, _, _ in candidates]
        options = self.build_clarification_options(candidates[:5])

        distinct_brands = list(dict.fromkeys(b for _, b, _ in candidates if b))
        distinct_variants = list(dict.fromkeys(p.name for p, _, _ in candidates))
        distinct_sizes = list(dict.fromkeys(f"{int(p.pack_size)}{p.pack_unit}" for p, _, _ in candidates))

        pending = PendingProductRequest(
            raw_query=phrase,
            category=GENERIC_CATEGORY_KEYWORDS.get(query, candidates[0][0].category),
            candidate_product_ids=candidate_ids,
            active_options=options,
            pack_size=req.pack_size_hint,
            pack_unit=req.pack_unit_hint,
            selling_unit=req.quantity_unit if req.quantity_unit_explicit else None,
            quantity=req.quantity if req.quantity_explicit else None,
            quantity_unit=req.quantity_unit if req.quantity_unit_explicit else None,
        )

        # 1. Multiple brands and brand was not explicitly given in phrase
        brand_explicit = any(b.lower() in query for b in distinct_brands)
        if len(distinct_brands) > 1 and not brand_explicit:
            pending.stage = ClarificationStage.AWAITING_BRAND
            pending.brand_status = AttributeStatus.AMBIGUOUS
            brand_list_str = ", ".join(distinct_brands[:3])
            pending.active_question = f"Bilkul! Kaunsi {pending.category or 'brand'} chahiye? {brand_list_str} ya koi aur?"
            return pending

        matched_brand = distinct_brands[0] if len(distinct_brands) == 1 else next(
            (b for b in distinct_brands if b.lower() in query), distinct_brands[0]
        )
        pending.brand_name = matched_brand
        pending.brand_status = AttributeStatus.KNOWN

        brand_candidates = [c for c in candidates if c[1].lower() == matched_brand.lower()] or [candidates[0]]
        pending.candidate_product_ids = [str(p.id) for p, _, _ in brand_candidates]
        pending.active_options = self.build_clarification_options(brand_candidates[:5])

        # 2. Multiple variants of this brand
        brand_variants = list(dict.fromkeys(p.name for p, _, _ in brand_candidates))
        variant_explicit = any(p.name.lower() in query for p, _, _ in brand_candidates)
        if len(brand_variants) > 1 and not variant_explicit and req.pack_size_hint is None:
            pending.stage = ClarificationStage.AWAITING_VARIANT
            pending.variant_status = AttributeStatus.AMBIGUOUS
            pending.active_question = f"{matched_brand} ke kaunse variant ka option chahiye? {', '.join(brand_variants[:3])}?"
            return pending

        # 3. Multiple pack sizes of this variant/product
        brand_sizes = list(dict.fromkeys(f"{int(p.pack_size)}{p.pack_unit}" for p, _, _ in brand_candidates))
        if len(brand_sizes) > 1 and req.pack_size_hint is None:
            pending.stage = ClarificationStage.AWAITING_PACKAGE_SIZE
            pending.pack_size_status = AttributeStatus.AMBIGUOUS
            top_name = brand_candidates[0][0].name
            name_disp = top_name if top_name.lower().startswith(matched_brand.lower()) else f"{matched_brand} {top_name}"
            pending.active_question = f"{name_disp} ke kaunse pack ka option chahiye? {', '.join(brand_sizes[:3])}?"
            return pending

        # 4. If only 1 product remains or pack size was specified:
        chosen_prod, chosen_brand, _ = brand_candidates[0]
        pending.confirmed_product_id = str(chosen_prod.id)
        pending.product_name = chosen_prod.name
        pending.brand_name = chosen_brand
        pending.pack_size = float(chosen_prod.pack_size)
        pending.pack_unit = chosen_prod.pack_unit
        pending.brand_status = AttributeStatus.KNOWN
        pending.variant_status = AttributeStatus.KNOWN
        pending.pack_size_status = AttributeStatus.KNOWN

        # If user only said generic term ("chai") without explicit confirmation
        if is_generic and not brand_explicit and not req.quantity_explicit:
            pending.stage = ClarificationStage.AWAITING_QUANTITY
            disp_name = chosen_prod.name if chosen_prod.name.lower().startswith(chosen_brand.lower()) else f"{chosen_brand} {chosen_prod.name}"
            pending.active_question = f"Hamare paas {disp_name} ({int(chosen_prod.pack_size)}{chosen_prod.pack_unit}) uplabdh hai. Kya aapko ye chahiye? Kitne packet ya case chahiye?"
            return pending

        # 5. Check selling unit and quantity
        if not req.quantity_unit_explicit and not req.quantity_explicit:
            pending.stage = ClarificationStage.AWAITING_SELLING_UNIT
            pending.active_question = "Kitne chahiye? Packet mein ya case mein?"
            return pending
        elif not req.quantity_explicit:
            pending.stage = ClarificationStage.AWAITING_QUANTITY
            pending.active_question = f"Kitne {pending.selling_unit.value.lower() if pending.selling_unit else 'packet'} chahiye?"
            return pending
        else:
            pending.stage = ClarificationStage.PRODUCT_IDENTIFIED
            pending.quantity = req.quantity
            pending.selling_unit = req.quantity_unit
            pending.quantity_unit = req.quantity_unit
            pending.active_question = None
            return pending

    def resolve_pending_slot(
        self,
        req_state: PendingProductRequest,
        user_utterance: str,
    ) -> PendingProductRequest:
        """
        Progressively fill missing attributes from multi-turn user responses.
        Resolves brand, variant, pack size, selling unit (CASE/PIECE), and quantity.
        """
        norm = normalize_text(user_utterance).lower().strip()

        # Cancellation
        if any(w in norm for w in ["cancel", "nahi chahiye", "rehne do", "hatao", "chhod do", "nahin"]):
            req_state.stage = ClarificationStage.CANCELLED
            req_state.active_question = "Theek hai, cancel kar diya gaya."
            return req_state

        parsed = parse_retailer_phrase(user_utterance)

        # Check demonstrative / affirmative reference: "this", "ye wala", "ऐड कर देना", "add kar do", "kar do"
        is_demo = is_demonstrative_reference(user_utterance)
        is_affirmative = any(
            w in norm for w in [
                "add", "ऐड", "एड", "daal do", "daal dena", "kar do", "kar dena",
                "kardo", "kardena", "add kardo", "add kardena", "haan", "ha", "yes", "हाँ", "हां",
                "theek", "theek hai", "sahi", "ok", "le lo", "de do", "bhej do"
            ]
        )
        if is_affirmative and not is_demo:
            is_demo = True
        if is_demo:
            if req_state.active_options:
                selected_option = req_state.active_options[0]
            elif req_state.confirmed_product_id:
                if parsed.quantity_explicit:
                    req_state.quantity = parsed.quantity
                    req_state.quantity_status = AttributeStatus.KNOWN
                if parsed.quantity_unit_explicit:
                    req_state.selling_unit = parsed.quantity_unit
                    req_state.quantity_unit = parsed.quantity_unit
                    req_state.selling_unit_status = AttributeStatus.KNOWN
                if req_state.quantity is None:
                    req_state.quantity = 1
                if req_state.selling_unit is None:
                    req_state.selling_unit = QuantityUnit.PIECE
                    req_state.quantity_unit = QuantityUnit.PIECE
                req_state.stage = ClarificationStage.PRODUCT_IDENTIFIED
                req_state.active_question = None
                return req_state
            else:
                selected_option = None
        else:
            selected_option = None
        if any(w in norm for w in ["pehla", "first", "number 1", " 1 ", "1st"]) and len(req_state.active_options) >= 1:
            selected_option = req_state.active_options[0]
        elif any(w in norm for w in ["doosra", "second", "number 2", " 2 ", "2nd"]) and len(req_state.active_options) >= 2:
            selected_option = req_state.active_options[1]
        elif any(w in norm for w in ["teesra", "third", "number 3", " 3 ", "3rd"]) and len(req_state.active_options) >= 3:
            selected_option = req_state.active_options[2]

        # Check relative terms: sasta / bada / chhota
        if "sasta" in norm or "cheapest" in norm or "kam rate" in norm:
            if req_state.active_options:
                sorted_opts = sorted(req_state.active_options, key=lambda o: o.price or 999999.0)
                selected_option = sorted_opts[0]
        elif "bada" in norm or "largest" in norm or "sabse bada" in norm:
            if req_state.active_options:
                sorted_opts = sorted(req_state.active_options, key=lambda o: o.pack_size, reverse=True)
                selected_option = sorted_opts[0]
        elif "chhota" in norm or "smallest" in norm or "sabse chhota" in norm:
            if req_state.active_options:
                sorted_opts = sorted(req_state.active_options, key=lambda o: o.pack_size)
                selected_option = sorted_opts[0]

        if selected_option:
            req_state.candidate_product_ids = [selected_option.product_id]
            req_state.confirmed_product_id = selected_option.product_id
            req_state.brand_name = selected_option.brand_name
            req_state.product_name = selected_option.name
            req_state.pack_size = selected_option.pack_size
            req_state.pack_unit = selected_option.pack_unit
            req_state.brand_status = AttributeStatus.KNOWN
            req_state.variant_status = AttributeStatus.KNOWN
            req_state.pack_size_status = AttributeStatus.KNOWN

            if parsed.quantity_explicit:
                req_state.quantity = parsed.quantity
                req_state.quantity_status = AttributeStatus.KNOWN
            if parsed.quantity_unit_explicit:
                req_state.selling_unit = parsed.quantity_unit
                req_state.quantity_unit = parsed.quantity_unit
                req_state.selling_unit_status = AttributeStatus.KNOWN

            if is_demo:
                if req_state.quantity is None:
                    req_state.quantity = 1
                if req_state.selling_unit is None:
                    req_state.selling_unit = QuantityUnit.PIECE
                    req_state.quantity_unit = QuantityUnit.PIECE
                req_state.stage = ClarificationStage.PRODUCT_IDENTIFIED
                req_state.active_question = None
                return req_state

        # If stage is AWAITING_VARIANT:
        if req_state.stage == ClarificationStage.AWAITING_VARIANT and not selected_option:
            matched_var_ids = []
            for pid in req_state.candidate_product_ids:
                found = next((p for p in self.products if str(p[0].id) == pid), None)
                if found:
                    p, b_name = found
                    aliases = self.alias_map.get(p.id, [])
                    if (
                        parsed.clean_query in p.name.lower()
                        or token_set_ratio(parsed.clean_query, p.name) >= 70.0
                        or any(parsed.clean_query in al or al in parsed.clean_query for al in aliases)
                    ):
                        matched_var_ids.append(pid)
                        req_state.product_name = p.name
                        req_state.variant_status = AttributeStatus.KNOWN

            if matched_var_ids:
                req_state.candidate_product_ids = matched_var_ids
                tuples = self._get_tuples_by_ids(matched_var_ids)
                req_state.active_options = self.build_clarification_options(tuples)

        # If stage is AWAITING_BRAND:
        if req_state.stage == ClarificationStage.AWAITING_BRAND and not selected_option:
            matched_candidate_ids = []
            for pid in req_state.candidate_product_ids:
                found = next((p for p in self.products if str(p[0].id) == pid), None)
                if found:
                    p, b_name = found
                    if parsed.clean_query in b_name.lower() or token_set_ratio(parsed.clean_query, b_name) >= 70.0:
                        matched_candidate_ids.append(pid)
                        req_state.brand_name = b_name
                        req_state.brand_status = AttributeStatus.KNOWN

            if matched_candidate_ids:
                req_state.candidate_product_ids = matched_candidate_ids
                tuples = self._get_tuples_by_ids(matched_candidate_ids)
                req_state.active_options = self.build_clarification_options(tuples)
            else:
                all_brand_matches = [
                    c for c in self.products
                    if parsed.clean_query in c[1].lower() or token_set_ratio(parsed.clean_query, c[1]) >= 70.0
                ]
                if all_brand_matches:
                    req_state.candidate_product_ids = [str(c[0].id) for c in all_brand_matches]
                    req_state.brand_name = all_brand_matches[0][1]
                    req_state.brand_status = AttributeStatus.KNOWN
                    req_state.active_options = self.build_clarification_options(
                        [(p, b, 90.0) for p, b in all_brand_matches]
                    )
                else:
                    avail_brands = list(
                        dict.fromkeys(
                            b for _, b in self.products
                            if req_state.category and (req_state.category.lower() in _[0].category.lower() or req_state.category.lower() in _[0].name.lower())
                        )
                    )
                    avail_str = ", ".join(avail_brands[:3]) if avail_brands else "hamare catalogue me"
                    req_state.active_question = f"Maaf kijiye, '{user_utterance}' catalogue me nahi mila. Hamare paas {avail_str} available hain. Kaunsa chahiye?"
                    return req_state

        # If pack size was mentioned in utterance
        if parsed.pack_size_hint is not None:
            matching_size_ids = []
            for pid in req_state.candidate_product_ids:
                found = next((p for p in self.products if str(p[0].id) == pid), None)
                if found:
                    p, _ = found
                    sz = float(p.pack_size)
                    if p.pack_unit.lower() in {"kg", "kilo", "l", "litre", "liter"}:
                        sz *= 1000
                    if abs(sz - parsed.pack_size_hint) < 1.0:
                        matching_size_ids.append(pid)
            if matching_size_ids:
                req_state.candidate_product_ids = matching_size_ids
                req_state.pack_size = parsed.pack_size_hint
                req_state.pack_unit = parsed.pack_unit_hint or "gm"
                req_state.pack_size_status = AttributeStatus.KNOWN
            else:
                # Pack size requested does not exist for this product
                curr_tuples = self._get_tuples_by_ids(req_state.candidate_product_ids)
                avail_sizes = [f"{int(p.pack_size)}{p.pack_unit}" for p, _, _ in curr_tuples]
                avail_str = ", ".join(dict.fromkeys(avail_sizes)) if avail_sizes else "standard pack"
                req_state.active_question = f"Maaf kijiye, {req_state.brand_name or ''} {req_state.product_name or req_state.category or ''} {int(parsed.pack_size_hint)}{parsed.pack_unit_hint or 'g'} me uplabdh nahi hai. Sirf {avail_str} me uplabdh hai. Kya ye chahiye?"
                return req_state

        # Check quantity & unit from utterance
        if parsed.quantity_explicit:
            req_state.quantity = parsed.quantity
            req_state.quantity_status = AttributeStatus.KNOWN
        if parsed.quantity_unit_explicit:
            req_state.selling_unit = parsed.quantity_unit
            req_state.quantity_unit = parsed.quantity_unit
            req_state.selling_unit_status = AttributeStatus.KNOWN

        # Re-evaluate remaining candidates to advance stage
        tuples = self._get_tuples_by_ids(req_state.candidate_product_ids)
        if not tuples:
            tuples = [(p, b, 80.0) for p, b in self.products if str(p.id) in req_state.candidate_product_ids]

        if not tuples:
            req_state.stage = ClarificationStage.CANCELLED
            req_state.active_question = "Catalogue me koi matching product nahi mila."
            return req_state

        distinct_brands = list(dict.fromkeys(b for _, b, _ in tuples))
        distinct_sizes = list(dict.fromkeys(f"{int(p.pack_size)}{p.pack_unit}" for p, _, _ in tuples))
        distinct_variants = list(dict.fromkeys(p.name for p, _, _ in tuples))

        if len(distinct_brands) > 1 and req_state.brand_status != AttributeStatus.KNOWN:
            req_state.stage = ClarificationStage.AWAITING_BRAND
            req_state.active_question = f"Kaunsi {req_state.category or 'brand'} chahiye? {', '.join(distinct_brands[:3])}?"
            return req_state

        if len(distinct_variants) > 1 and req_state.variant_status != AttributeStatus.KNOWN and req_state.pack_size_status != AttributeStatus.KNOWN:
            req_state.stage = ClarificationStage.AWAITING_VARIANT
            req_state.active_question = f"{req_state.brand_name or distinct_brands[0]} ke kaunse variant ka option chahiye? {', '.join(distinct_variants[:3])}?"
            return req_state

        if len(distinct_sizes) > 1 and req_state.pack_size_status != AttributeStatus.KNOWN:
            req_state.stage = ClarificationStage.AWAITING_PACKAGE_SIZE
            req_state.active_question = f"Kaunsa pack chahiye? {', '.join(distinct_sizes[:3])}?"
            return req_state

        # 1 candidate remains
        top_prod, top_brand, _ = tuples[0]
        req_state.confirmed_product_id = str(top_prod.id)
        req_state.brand_name = top_brand
        req_state.product_name = top_prod.name
        req_state.pack_size = float(top_prod.pack_size)
        req_state.pack_unit = top_prod.pack_unit

        if req_state.selling_unit is None and not parsed.quantity_unit_explicit:
            req_state.stage = ClarificationStage.AWAITING_SELLING_UNIT
            req_state.active_question = "Kitne chahiye? Packet mein ya case mein?"
            return req_state

        if req_state.quantity is None and not parsed.quantity_explicit:
            # If user affirmed (e.g. "haan", "theek hai")
            if any(w in norm for w in ["haan", "yes", "theek hai", "bhejo", "karo", "do"]):
                req_state.quantity = 1
                req_state.selling_unit = req_state.selling_unit or QuantityUnit.CASE
            else:
                req_state.stage = ClarificationStage.AWAITING_QUANTITY
                unit_label = req_state.selling_unit.value.lower() if req_state.selling_unit else "packet"
                req_state.active_question = f"Kitne {unit_label} chahiye?"
                return req_state

        if req_state.quantity is None:
            req_state.quantity = 1
        if req_state.selling_unit is None:
            req_state.selling_unit = QuantityUnit.PIECE
            req_state.quantity_unit = QuantityUnit.PIECE

        req_state.stage = ClarificationStage.PRODUCT_IDENTIFIED
        req_state.active_question = None
        return req_state

    def match_item(self, phrase: str) -> ExtractedOrderItem:
        """
        Execute the hybrid matching pipeline for a natural phrase.
        Integrates with the progressive clarification engine while preserving backwards compatibility.
        """
        req = parse_retailer_phrase(phrase)
        pending = self.create_pending_product_request(phrase)

        if pending.stage == ClarificationStage.CANCELLED:
            return ExtractedOrderItem(
                raw_text=phrase,
                quantity=req.quantity,
                quantity_unit=req.quantity_unit,
                status=MatchStatus.NOT_FOUND,
                confidence=0.0,
                clarification_question=pending.active_question,
            )

        if pending.stage != ClarificationStage.PRODUCT_IDENTIFIED:
            # Ambiguous: needs clarification
            return ExtractedOrderItem(
                raw_text=phrase,
                quantity=req.quantity,
                quantity_unit=req.quantity_unit,
                confidence=0.75,
                status=MatchStatus.AMBIGUOUS,
                clarification_question=pending.active_question,
                candidate_options=pending.active_options,
            )

        # Product identified
        pid = UUID(pending.confirmed_product_id)
        found = next((p for p in self.products if p[0].id == pid), None)
        if not found:
            return ExtractedOrderItem(
                raw_text=phrase,
                quantity=req.quantity,
                quantity_unit=req.quantity_unit,
                status=MatchStatus.NOT_FOUND,
                clarification_question="Product catalogue me nahi mila.",
            )

        top_prod, top_brand = found
        stock = self.inventory_map.get(pid, 0)
        price_rec = self.prices_map.get(pid)
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
            clarification_msg = f"{top_brand} {top_prod.name} filhal out of stock hai."

        return ExtractedOrderItem(
            raw_text=phrase,
            product_id=str(top_prod.id),
            sku=top_prod.sku,
            product_name=top_prod.name,
            brand_name=top_brand,
            pack_size=float(top_prod.pack_size),
            pack_unit=top_prod.pack_unit,
            quantity=pending.quantity or req.quantity,
            quantity_unit=pending.selling_unit or req.quantity_unit,
            confidence=0.95,
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
