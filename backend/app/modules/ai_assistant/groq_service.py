import json
import logging
from typing import Any, List, Optional
import httpx

from app.core.config import settings
from app.modules.ai_assistant.matcher import parse_retailer_phrase
from app.modules.ai_assistant.schemas import (
    AssistantIntent,
    AssistantSessionState,
    GroqExtractedItem,
    GroqNLUOutput,
    QuantityUnit,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the AI Ordering Assistant for Orderly, a B2B FMCG wholesale distributor platform in Jabalpur, India.
You converse with kirana store retailers in natural Hindi, Hinglish, or English.
Retailers may be speaking (Voice Mode) or typing (Chat Mode).

Your tasks:
1. Determine the retailer's INTENT from:
   - ADD_PRODUCT: Retailer wants to add one or more items to their order.
   - UPDATE_QUANTITY: Retailer wants to change the quantity of an existing item (e.g., "pichle product ki quantity 5 badha do", "Parle-G 10 ki jagah 15 kar do").
   - REMOVE_PRODUCT: Retailer wants to remove an item (e.g., "blue pen hata do", "chai nikaal do").
   - QUERY_PRICE_STOCK: Retailer asks about rate, stock, or schemes (e.g., "Tata Salt ka rate kya hai?", "Sugar available hai kya?").
   - REVIEW_ORDER: Retailer asks for order summary (e.g., "Mera abhi tak ka order batao", "Cart me kya hai?").
   - CLEAR_DRAFT: Retailer cancels or clears the cart (e.g., "Order cancel karo", "Cart khali karo").
   - CONFIRM_ORDER: Retailer confirms placing the order (e.g., "Order confirm karo", "Haan place kar do", "Bhej do").
   - CLARIFY: Retailer is answering a previously asked clarification question (e.g., "500 gram wala", "Pehla wala", "Red Label chahiye").
   - GENERAL_CHAT: Greetings, compliments, or general inquiries (e.g., "Namaste", "Theek hai", "Dhanyawaad").

2. Extract items for ADD_PRODUCT / UPDATE_QUANTITY / REMOVE_PRODUCT:
   - `product_phrase`: Clean product name (e.g., "Red Label Tea", "Parle-G", "Tata Salt", "Surf Excel").
   - `quantity`: Positive integer (default 1). Recognize Hindi words: ek=1, do=2, teen=3, char=4, paanch=5, das=10, bees=20, etc.
   - `quantity_unit`: "CASE" (peti, case, carton, box) or "PIECE" (packet, pouch, piece, nag, bottle, dabba). Default "PIECE".
   - `pack_size_hint`: Numeric weight/size if specified (e.g., 500 for 500g, 1000 for 1kg/1 litre, 250 for 250g).
   - `pack_unit_hint`: "gm", "kg", "ml", "litre" if specified.

3. Formulate responses:
   - `chat_reply`: Friendly, polite text for visual chat display (in natural Hinglish/Hindi).
   - `audio_reply`: ULTRA-CONCISE spoken response suitable for Text-to-Speech in Voice Mode. Keep it under 15 words.

4. Output MUST be valid JSON strictly adhering to this structure:
{
  "intent": "ADD_PRODUCT",
  "items": [
    {
      "product_phrase": "Red Label",
      "quantity": 2,
      "quantity_unit": "PIECE",
      "pack_size_hint": 500,
      "pack_unit_hint": "gm"
    }
  ],
  "target_product_to_modify": null,
  "clarification_choice": null,
  "chat_reply": "Red Label 500g ke 2 packet aapke cart me add kar rahe hain.",
  "audio_reply": "Red Label 500g ke do packet add kar diye."
}
"""


def deterministic_nlu_fallback(
    message: str,
    session: AssistantSessionState,
    cart_items: Optional[List[dict]] = None,
) -> GroqNLUOutput:
    """
    High-accuracy rule-based intent and entity extractor when Groq is offline or unconfigured.
    Guarantees reliable local testing and zero downtime.
    """
    norm = message.lower().strip()

    # 1. Check if user is replying to a pending clarification question
    if session.pending_question and session.pending_options:
        chosen_opt = None
        # Check numerical index choice: "first", "pehla", "1", "doosra", "2"
        if any(w in norm for w in ["pehla", "first", "1", "one"]) and len(session.pending_options) >= 1:
            chosen_opt = session.pending_options[0]
        elif any(w in norm for w in ["doosra", "second", "2", "two"]) and len(session.pending_options) >= 2:
            chosen_opt = session.pending_options[1]
        elif any(w in norm for w in ["teesra", "third", "3", "three"]) and len(session.pending_options) >= 3:
            chosen_opt = session.pending_options[2]
        else:
            # Check pack size match e.g. "500", "250", "1kg"
            for opt in session.pending_options:
                if str(int(opt.pack_size)) in norm or opt.name.lower() in norm or opt.sku.lower() in norm:
                    chosen_opt = opt
                    break

        if chosen_opt:
            return GroqNLUOutput(
                intent=AssistantIntent.CLARIFY,
                clarification_choice=chosen_opt.product_id,
                items=[
                    GroqExtractedItem(
                        product_phrase=f"{chosen_opt.brand_name} {chosen_opt.name}",
                        quantity=1,
                        quantity_unit=QuantityUnit.PIECE,
                        pack_size_hint=chosen_opt.pack_size,
                        pack_unit_hint=chosen_opt.pack_unit,
                    )
                ],
                chat_reply=f"{chosen_opt.brand_name} {chosen_opt.name} ({chosen_opt.pack_size}{chosen_opt.pack_unit}) select kiya gaya.",
                audio_reply=f"{chosen_opt.brand_name} {chosen_opt.name} select kar liya.",
            )

    # 2. Check CONFIRM_ORDER
    if any(k in norm for k in ["order confirm", "confirm karo", "place karo", "order place", "bhej do", "pakka karo"]):
        return GroqNLUOutput(
            intent=AssistantIntent.CONFIRM_ORDER,
            items=[],
            chat_reply="Aapka order confirm kiya ja raha hai.",
            audio_reply="Aapka order confirm kiya ja raha hai.",
        )

    # 3. Check CLEAR_DRAFT
    if any(k in norm for k in ["cancel", "khali karo", "clear cart", "delete all", "order cancel"]):
        return GroqNLUOutput(
            intent=AssistantIntent.CLEAR_DRAFT,
            items=[],
            chat_reply="Aapka cart khali kar diya gaya hai.",
            audio_reply="Cart khali kar diya gaya hai.",
        )

    # 4. Check REVIEW_ORDER
    if any(k in norm for k in ["order batao", "kya hai", "summary", "cart me kya hai", "kitna hua", "review"]):
        return GroqNLUOutput(
            intent=AssistantIntent.REVIEW_ORDER,
            items=[],
            chat_reply="Aapke current cart ki summary neeche di gayi hai.",
            audio_reply="Aapka current order draft ye hai.",
        )

    # 5. Check REMOVE_PRODUCT
    if any(k in norm for k in ["hata do", "hatao", "remove", "nikaal do", "delete"]):
        cleaned = norm
        for w in ["hata do", "hatao", "remove", "nikaal do", "delete", "mujhe", "please", "item", "product"]:
            cleaned = cleaned.replace(w, "")
        target = cleaned.strip()
        return GroqNLUOutput(
            intent=AssistantIntent.REMOVE_PRODUCT,
            target_product_to_modify=target,
            items=[],
            chat_reply=f"Cart se {target} hata diya gaya.",
            audio_reply=f"{target} hata diya gaya.",
        )

    # 6. Check QUERY_PRICE_STOCK
    if any(k in norm for k in ["rate kya hai", "price kya hai", "kitne ka hai", "available hai", "stock hai", "scheme hai"]):
        parsed = parse_retailer_phrase(norm)
        return GroqNLUOutput(
            intent=AssistantIntent.QUERY_PRICE_STOCK,
            items=[
                GroqExtractedItem(
                    product_phrase=parsed.clean_query,
                    quantity=parsed.quantity,
                    quantity_unit=parsed.quantity_unit,
                    pack_size_hint=parsed.pack_size_hint,
                    pack_unit_hint=parsed.pack_unit_hint,
                )
            ],
            chat_reply=f"{parsed.clean_query} ki details check kar rahe hain.",
            audio_reply=f"{parsed.clean_query} ki details check kar rahe hain.",
        )

    # 7. Check GREETING
    if norm in ["hi", "hello", "namaste", "namaskar", "pranam", "hey"]:
        return GroqNLUOutput(
            intent=AssistantIntent.GENERAL_CHAT,
            items=[],
            chat_reply="Namaste! Kahiye, aaj aapko kya order karna hai?",
            audio_reply="Namaste! Kahiye, aaj aapko kya order karna hai?",
        )

    # 8. Default: ADD_PRODUCT / item extraction
    parsed = parse_retailer_phrase(norm)
    unit_label = "case" if parsed.quantity_unit == QuantityUnit.CASE else "packet"
    return GroqNLUOutput(
        intent=AssistantIntent.ADD_PRODUCT,
        items=[
            GroqExtractedItem(
                product_phrase=parsed.clean_query,
                quantity=parsed.quantity,
                quantity_unit=parsed.quantity_unit,
                pack_size_hint=parsed.pack_size_hint,
                pack_unit_hint=parsed.pack_unit_hint,
            )
        ],
        chat_reply=f"{parsed.clean_query} ke {parsed.quantity} {unit_label} cart me add kar rahe hain.",
        audio_reply=f"{parsed.clean_query} ke {parsed.quantity} {unit_label} add kar diye.",
    )


def parse_with_groq(
    user_message: str,
    session: AssistantSessionState,
    cart_items: Optional[List[dict]] = None,
) -> GroqNLUOutput:
    """
    Parse retailer message using Groq LLM with structured JSON output.
    Gracefully falls back to deterministic NLU if Groq is not configured or errors.
    """
    if not settings.GROQ_API_KEY:
        return deterministic_nlu_fallback(user_message, session, cart_items)

    messages_payload: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    context_notes = []
    if cart_items:
        cart_desc = ", ".join(
            f"{c.get('name')} x{c.get('quantity')} {c.get('quantity_unit')}"
            for c in cart_items
        )
        context_notes.append(f"Current cart items: {cart_desc}")

    if session.pending_question and session.pending_options:
        opts_desc = ", ".join(
            f"{idx + 1}. {o.brand_name} {o.name} ({o.pack_size}{o.pack_unit}, ID:{o.product_id})"
            for idx, o in enumerate(session.pending_options)
        )
        context_notes.append(
            f"Pending question asked to retailer: '{session.pending_question}'. Options: {opts_desc}"
        )

    if context_notes:
        messages_payload.append({
            "role": "system",
            "content": "Operational Context:\n" + "\n".join(context_notes),
        })

    recent_msgs = session.messages[-6:]
    for m in recent_msgs:
        messages_payload.append({
            "role": "user" if m.role.value == "user" else "assistant",
            "content": m.content,
        })

    messages_payload.append({"role": "user", "content": user_message})

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.GROQ_MODEL,
                    "messages": messages_payload,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed_json = json.loads(content)
                return GroqNLUOutput(**parsed_json)
            else:
                logger.warning(
                    f"Groq API returned HTTP {resp.status_code}: {resp.text}. Using fallback."
                )
                return deterministic_nlu_fallback(user_message, session, cart_items)
    except Exception as exc:
        logger.warning(f"Groq call failed ({exc}). Using deterministic fallback.")
        return deterministic_nlu_fallback(user_message, session, cart_items)
