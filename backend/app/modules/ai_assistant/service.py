import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.ai_assistant.groq_service import parse_with_groq
from app.modules.ai_assistant.matcher import HybridProductMatcher
from app.modules.ai_assistant.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantIntent,
    AssistantRole,
    CartAction,
    CartActionType,
    ClarificationOption,
    ExtractedOrderItem,
    MatchStatus,
    ProductCardInfo,
    QuantityUnit,
)
from app.modules.ai_assistant.session_service import (
    append_message,
    clear_session,
    get_or_create_session,
    set_pending_clarification,
    update_session_draft,
)
from app.modules.orders.models import Order, OrderStatusHistory
from app.modules.orders.schemas import OrderCreate, OrderItemCreate
from app.modules.orders.service import create_order_draft
from app.modules.retailers.models import Retailer, RetailerUser
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def process_assistant_chat(
    db: Session,
    current_user: User,
    request: AssistantChatRequest,
) -> AssistantChatResponse:
    """
    Central orchestration service for AI conversational ordering.
    Coordinates dialogue parsing, hybrid semantic product matching,
    cart state synchronization, and order submission.
    """
    # 1. Authorize retailer
    retailer_id = db.scalar(
        select(RetailerUser.retailer_id).where(
            RetailerUser.user_id == current_user.id
        )
    )
    if not retailer_id:
        raise ValueError("No retailer account is linked to this user.")

    retailer = db.scalar(
        select(Retailer).where(Retailer.id == retailer_id)
    )
    if not retailer or not retailer.is_active:
        raise ValueError("Retailer account is inactive.")

    if retailer.registration_status in {"REJECTED", "SUSPENDED"}:
        raise ValueError("Retailer account cannot place orders.")

    # 2. Get or create session
    session = get_or_create_session(str(retailer_id), str(current_user.id))
    session.mode = request.mode

    # 3. Append user message to history
    append_message(
        session=session,
        role=AssistantRole.USER,
        content=request.message,
        audio_text=request.message,
    )

    # 4. Parse intent and items with Groq / fallback
    nlu_output = parse_with_groq(
        user_message=request.message,
        session=session,
        cart_items=request.cart_snapshot,
    )

    matcher = HybridProductMatcher(db, retailer_id)
    cart_actions: list[CartAction] = []
    suggested_cards: list[ProductCardInfo] = []
    extracted_items: list[ExtractedOrderItem] = []
    is_confirmed = False
    created_order_id = None

    chat_reply = nlu_output.chat_reply
    audio_reply = nlu_output.audio_reply
    final_intent = nlu_output.intent

    # 5. Execute action based on parsed intent
    if final_intent == AssistantIntent.ADD_PRODUCT or final_intent == AssistantIntent.QUERY_PRICE_STOCK:
        items_to_match = nlu_output.items or []
        added_names = []

        for item in items_to_match:
            matched = matcher.match_item(item.product_phrase)
            extracted_items.append(matched)

            if matched.status == MatchStatus.MATCHED:
                card = matcher.build_product_card(matched.product_id)
                if card:
                    suggested_cards.append(card)

                if final_intent == AssistantIntent.ADD_PRODUCT:
                    cart_actions.append(
                        CartAction(
                            action=CartActionType.ADD,
                            product_id=matched.product_id,
                            sku=matched.sku,
                            name=matched.product_name,
                            brand_name=matched.brand_name,
                            pack_size=matched.pack_size,
                            pack_unit=matched.pack_unit,
                            units_per_case=card.units_per_case if card else 1,
                            price=matched.unit_price or 0.0,
                            quantity=item.quantity,
                            quantity_unit=item.quantity_unit,
                            quantity_available=card.quantity_available if card else 0,
                            image_url=card.image_url if card else None,
                        )
                    )
                    unit_label = "case" if item.quantity_unit == QuantityUnit.CASE else "packet"
                    added_names.append(f"{matched.brand_name} {matched.product_name} ({item.quantity} {unit_label})")

                elif final_intent == AssistantIntent.QUERY_PRICE_STOCK:
                    price_str = f"₹{matched.unit_price:.2f}" if matched.unit_price else "Rate uplabdh nahi"
                    stock_qty = card.quantity_available if card else 0
                    chat_reply = f"{matched.brand_name} {matched.product_name} ka price {price_str} hai, aur stock {stock_qty} piece available hai."
                    audio_reply = f"{matched.product_name} ka price {matched.unit_price or 0:.0f} rupaye hai."

            elif matched.status == MatchStatus.AMBIGUOUS:
                final_intent = AssistantIntent.CLARIFY
                set_pending_clarification(
                    session,
                    matched.clarification_question,
                    matched.candidate_options,
                )
                for opt in matched.candidate_options:
                    c = matcher.build_product_card(opt.product_id)
                    if c:
                        suggested_cards.append(c)

                chat_reply = matched.clarification_question or "Kripya sahi variant select karein."
                audio_reply = chat_reply
                break

            elif matched.status == MatchStatus.OUT_OF_STOCK:
                card = matcher.build_product_card(matched.product_id)
                if card:
                    suggested_cards.append(card)
                chat_reply = f"Maaf kijiye, {matched.brand_name} {matched.product_name} filhal out of stock hai."
                audio_reply = f"{matched.product_name} out of stock hai."

            elif matched.status == MatchStatus.NOT_FOUND:
                chat_reply = f"'{item.product_phrase}' catalogue me nahi mila. Kripya doosra naam ya brand try karein."
                audio_reply = "Ye product catalogue me nahi mila."

        if added_names and final_intent == AssistantIntent.ADD_PRODUCT:
            chat_reply = f"{', '.join(added_names)} cart me add kar diye gaye hain."
            audio_reply = f"{', '.join(added_names)} add kar diye."

    elif final_intent == AssistantIntent.CLARIFY:
        # User answered a clarification question
        chosen_id = nlu_output.clarification_choice
        chosen_opt = None
        if session.pending_options:
            if chosen_id:
                chosen_opt = next((o for o in session.pending_options if o.product_id == chosen_id), None)
            if not chosen_opt and session.pending_options:
                chosen_opt = session.pending_options[0]

        if chosen_opt:
            set_pending_clarification(session, None)
            card = matcher.build_product_card(chosen_opt.product_id)
            if card:
                suggested_cards.append(card)

            cart_actions.append(
                CartAction(
                    action=CartActionType.ADD,
                    product_id=chosen_opt.product_id,
                    sku=chosen_opt.sku,
                    name=chosen_opt.name,
                    brand_name=chosen_opt.brand_name,
                    pack_size=chosen_opt.pack_size,
                    pack_unit=chosen_opt.pack_unit,
                    units_per_case=chosen_opt.units_per_case,
                    price=chosen_opt.price or 0.0,
                    quantity=1,
                    quantity_unit=QuantityUnit.PIECE,
                    quantity_available=chosen_opt.quantity_available,
                )
            )
            chat_reply = f"{chosen_opt.brand_name} {chosen_opt.name} ({chosen_opt.pack_size}{chosen_opt.pack_unit}) cart me add kar diya hai."
            audio_reply = f"{chosen_opt.name} add kar diya."
        else:
            set_pending_clarification(session, None)
            chat_reply = "Theek hai, aap agla item bata sakte hain."
            audio_reply = "Theek hai, agla item batayein."

    elif final_intent == AssistantIntent.CONFIRM_ORDER:
        # Check if items exist in frontend cart snapshot
        raw_items = request.cart_snapshot or []
        if not raw_items:
            chat_reply = "Aapke cart me abhi koi product nahi hai. Pehle product add karein."
            audio_reply = "Cart khali hai, pehle item add karein."
        else:
            try:
                order_items = [
                    OrderItemCreate(
                        product_id=UUID(it["product_id"]),
                        quantity=int(it["quantity"]),
                        quantity_unit=it["quantity_unit"],
                    )
                    for it in raw_items
                    if "product_id" in it and int(it.get("quantity", 0)) > 0
                ]

                if not order_items:
                    raise ValueError("Cart me koi valid items nahi hain.")

                order_create_payload = OrderCreate(
                    retailer_id=retailer.id,
                    idempotency_key=str(uuid.uuid4()),
                    customer_note="Placed via Orderly AI Assistant",
                    items=order_items,
                )

                draft = create_order_draft(
                    db=db,
                    payload=order_create_payload,
                    created_by=current_user.id,
                    source="AI_CAPTURE",
                )

                # Submit the order
                draft.status = "SUBMITTED"
                draft.submitted_at = datetime.now(timezone.utc)
                db.add(
                    OrderStatusHistory(
                        order_id=draft.id,
                        previous_status="DRAFT",
                        new_status="SUBMITTED",
                        changed_by=current_user.id,
                        reason="Confirmed via AI Conversational Assistant",
                    )
                )
                db.commit()

                is_confirmed = True
                created_order_id = str(draft.id)
                cart_actions.append(CartAction(action=CartActionType.CLEAR))
                clear_session(str(retailer_id), str(current_user.id))

                short_id = str(draft.id)[:8].upper()
                chat_reply = (
                    f"Badhaai ho! Aapka order #{short_id} successfully confirm ho gaya hai "
                    f"aur distributor ke paas submit ho gaya hai. Total Amount: ₹{float(draft.total_amount):.2f}."
                )
                audio_reply = f"Aapka order confirm ho gaya hai. Total amount {float(draft.total_amount):.0f} rupaye hai."
            except Exception as order_exc:
                db.rollback()
                logger.error(f"Failed to confirm order via AI assistant: {order_exc}")
                chat_reply = f"Order confirm karne me problem aayi: {str(order_exc)}"
                audio_reply = "Order confirm nahi ho paya. Kripya cart review karein."

    elif final_intent == AssistantIntent.CLEAR_DRAFT:
        clear_session(str(retailer_id), str(current_user.id))
        cart_actions.append(CartAction(action=CartActionType.CLEAR))
        chat_reply = "Cart saaf kar diya gaya hai."
        audio_reply = "Cart khali kar diya hai."

    elif final_intent == AssistantIntent.REMOVE_PRODUCT:
        target = nlu_output.target_product_to_modify or ""
        removed = False
        if request.cart_snapshot and target:
            target_norm = target.lower()
            for it in request.cart_snapshot:
                name = it.get("name", "").lower()
                sku = it.get("sku", "").lower()
                if target_norm in name or target_norm in sku:
                    cart_actions.append(
                        CartAction(
                            action=CartActionType.REMOVE,
                            product_id=it.get("product_id"),
                            quantity_unit=it.get("quantity_unit", QuantityUnit.CASE),
                        )
                    )
                    removed = True
                    break
        if removed:
            chat_reply = f"{target} cart se hata diya gaya."
            audio_reply = f"{target} hata diya gaya."
        else:
            chat_reply = f"Cart me '{target}' nahi mila."
            audio_reply = f"Ye product cart me nahi mila."

    elif final_intent == AssistantIntent.REVIEW_ORDER:
        raw_items = request.cart_snapshot or []
        if raw_items:
            total_items = sum(int(it.get("quantity", 0)) for it in raw_items)
            lines = [f"• {it.get('name')} x{it.get('quantity')} {it.get('quantity_unit', '').lower()}" for it in raw_items]
            chat_reply = f"Aapke cart me kul {total_items} items hain:\n" + "\n".join(lines)
            audio_reply = f"Aapke cart me kul {total_items} items hain."
        else:
            chat_reply = "Aapka cart abhi khali hai."
            audio_reply = "Aapka cart abhi khali hai."

    # 6. Append assistant response to dialogue history
    append_message(
        session=session,
        role=AssistantRole.ASSISTANT,
        content=chat_reply,
        audio_text=audio_reply,
        intent=final_intent,
        suggested_products=suggested_cards,
        extracted_items=extracted_items,
        pending_clarification=session.pending_question,
    )

    return AssistantChatResponse(
        session_id=session.session_id,
        reply=chat_reply,
        audio_text=audio_reply,
        intent=final_intent,
        messages=session.messages,
        suggested_products=suggested_cards,
        cart_actions=cart_actions,
        is_order_confirmed=is_confirmed,
        created_order_id=created_order_id,
        pending_clarification=session.pending_question,
    )
