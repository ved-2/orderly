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
    AttributeStatus,
    CartAction,
    CartActionType,
    ClarificationOption,
    ClarificationStage,
    ExtractedOrderItem,
    MatchStatus,
    PendingProductRequest,
    ProductCardInfo,
    QuantityUnit,
)
from app.modules.ai_assistant.session_service import (
    add_draft_item,
    append_message,
    clear_draft_items,
    clear_pending_request,
    clear_session,
    get_or_create_session,
    remove_draft_item,
    save_session,
    set_pending_clarification,
    set_pending_request,
    sync_draft_items,
    update_draft_item_quantity,
    update_session_draft,
)
from app.modules.orders.models import Order, OrderStatusHistory
from app.modules.orders.schemas import OrderCreate, OrderItemCreate
from app.modules.orders.service import create_order_draft
from app.modules.retailers.models import Retailer, RetailerUser
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def execute_order_confirmation(
    db: Session,
    retailer_id: UUID,
    user_id: UUID,
    items: list[dict[str, Any]] | list[ExtractedOrderItem],
    customer_note: str | None = None,
) -> Order:
    """
    Deterministically validate, calculate, and submit an order draft from the AI assistant.
    Transitions status to SUBMITTED and sets source to AI_CAPTURE.
    """
    retailer = db.scalar(
        select(Retailer).where(Retailer.id == retailer_id, Retailer.is_active.is_(True))
    )
    if not retailer:
        raise ValueError("Retailer not found or inactive.")

    order_items: list[OrderItemCreate] = []
    for it in items:
        if isinstance(it, ExtractedOrderItem):
            if it.product_id and it.quantity > 0:
                unit_val = it.quantity_unit.value if hasattr(it.quantity_unit, "value") else str(it.quantity_unit)
                order_items.append(
                    OrderItemCreate(
                        product_id=UUID(str(it.product_id)),
                        quantity=it.quantity,
                        quantity_unit=unit_val,
                    )
                )
        elif isinstance(it, dict):
            pid = it.get("product_id")
            qty = int(it.get("quantity", 0))
            if pid and qty > 0:
                unit_str = str(it.get("quantity_unit", "PIECE")).upper()
                unit = "CASE" if "CASE" in unit_str else "PIECE"
                order_items.append(
                    OrderItemCreate(
                        product_id=UUID(str(pid)),
                        quantity=qty,
                        quantity_unit=unit,
                    )
                )

    if not order_items:
        raise ValueError("Draft me koi valid items nahi hain.")

    order_create_payload = OrderCreate(
        retailer_id=retailer.id,
        idempotency_key=str(uuid.uuid4()),
        customer_note=customer_note or "Placed via Orderly Kirana AI Assistant",
        items=order_items,
    )

    draft = create_order_draft(
        db=db,
        payload=order_create_payload,
        created_by=user_id,
        source="AI_CAPTURE",
    )

    # Transition to SUBMITTED for Order Desk review
    draft.status = "SUBMITTED"
    draft.submitted_at = datetime.now(timezone.utc)
    db.add(
        OrderStatusHistory(
            order_id=draft.id,
            previous_status="DRAFT",
            new_status="SUBMITTED",
            changed_by=user_id,
            note="Confirmed via Kirana AI Assistant",
        )
    )
    db.commit()
    db.refresh(draft)

    session = get_or_create_session(str(retailer_id), str(user_id))
    clear_draft_items(session)
    session.is_confirmed = True
    session.created_order_id = str(draft.id)
    save_session(session)

    return draft


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
    if request.cart_snapshot is not None:
        sync_draft_items(session, request.cart_snapshot)

    # 3. Append user message to history
    append_message(
        session=session,
        role=AssistantRole.USER,
        content=request.message,
        audio_text=request.message,
    )

    matcher = HybridProductMatcher(db, retailer_id)
    cart_actions: list[CartAction] = []
    suggested_cards: list[ProductCardInfo] = []
    extracted_items: list[ExtractedOrderItem] = []
    is_confirmed = False
    created_order_id = None

    # Clean speaker echo or repeated assistant questions from retailer voice audio
    from app.modules.ai_assistant.matcher import clean_retailer_speech_echo
    active_q = session.pending_question or (session.pending_request.active_question if session.pending_request else None)
    clean_msg = clean_retailer_speech_echo(request.message, active_q)
    user_msg_to_process = clean_msg if clean_msg else request.message

    # Check if user message is an order confirmation, clear, or affirmative add
    norm_msg = user_msg_to_process.lower().strip()
    is_confirm_cmd = any(k in norm_msg for k in ["order confirm", "confirm karo", "place karo", "order place", "bhej do", "pakka karo", "ऑर्डर कन्फर्म", "कन्फर्म करो", "भेज दो"])
    is_clear_cmd = any(k in norm_msg for k in ["clear cart", "delete all", "cart khali karo", "कार्ट खाली करो", "कैंसिल"])
    is_affirmative_add = any(k in norm_msg for k in ["ऐड कर देना", "ऐड कर दो", "ऐड करो", "एड कर देना", "add kar do", "add kar dena", "add kardo", "add kardena", "daal do", "daal dena", "daaldo", "daaldena", "kar do", "kar dena"])

    # Fast-path deterministic confirmation and cart clearing
    if is_confirm_cmd:
        items_to_confirm = session.draft_items or request.cart_snapshot or []
        if not items_to_confirm:
            chat_reply = "Aapke cart me abhi koi product nahi hai. Pehle product add karein."
            audio_reply = "Cart khali hai, pehle item add karein."
            final_intent = AssistantIntent.CONFIRM_ORDER
        else:
            try:
                draft = execute_order_confirmation(
                    db=db,
                    retailer_id=retailer.id,
                    user_id=current_user.id,
                    items=items_to_confirm,
                    customer_note="Placed via Orderly Kirana AI Assistant",
                )
                is_confirmed = True
                created_order_id = str(draft.id)
                cart_actions.append(CartAction(action=CartActionType.CLEAR))
                short_id = str(draft.id)[:8].upper()
                chat_reply = (
                    f"Badhaai ho! Aapka order #{short_id} successfully confirm ho gaya hai "
                    f"aur distributor ke paas submit ho gaya hai. Total Amount: ₹{float(draft.total_amount):.2f}."
                )
                audio_reply = f"Aapka order confirm ho gaya hai. Total amount {float(draft.total_amount):.0f} rupaye hai."
                final_intent = AssistantIntent.CONFIRM_ORDER
            except Exception as order_exc:
                db.rollback()
                logger.error(f"Failed to confirm order via AI assistant: {order_exc}")
                chat_reply = f"Order confirm karne me problem aayi: {str(order_exc)}"
                audio_reply = "Order confirm nahi ho paya. Kripya cart review karein."
                final_intent = AssistantIntent.CONFIRM_ORDER

    elif is_clear_cmd:
        clear_draft_items(session)
        cart_actions.append(CartAction(action=CartActionType.CLEAR))
        chat_reply = "Cart saaf kar diya gaya hai."
        audio_reply = "Cart khali kar diya hai."
        final_intent = AssistantIntent.CLEAR_DRAFT

    elif is_affirmative_add and not session.pending_request:
        # User confirmed previous item addition
        final_intent = AssistantIntent.GENERAL_CHAT
        if session.draft_items and len(session.draft_items) > 0:
            last_item = session.draft_items[-1]
            chat_reply = f"{last_item.product_name} aapke order draft me pehle se add ho gaya hai. Aap agla product bata sakte hain ya 'Order confirm karo' bol kar submit kar sakte hain."
            audio_reply = f"{last_item.product_name} draft me add hai."
        else:
            chat_reply = "Aapko kaunsa product add karna hai? Kripya product ka naam aur quantity batayein (jaise 'Parle-G 10 packet' ya 'Tata Salt 1 case')."
            audio_reply = "Kaunsa product add karna hai? Naam batayein."

    # 4. Check if session has an active PendingProductRequest for progressive clarification
    elif session.pending_request:
        # Topic switch detection: check if user asked for a completely new, distinct product
        from app.modules.ai_assistant.matcher import parse_retailer_phrase
        parsed_incoming = parse_retailer_phrase(user_msg_to_process)
        if parsed_incoming.clean_query and len(parsed_incoming.clean_query) >= 2 and not parsed_incoming.is_demonstrative:
            new_cands = matcher.score_candidates(parsed_incoming.clean_query, parsed_incoming.pack_size_hint, parsed_incoming.mrp_hint)
            if new_cands and new_cands[0][2] >= 85.0:
                top_prod = new_cands[0][0]
                pending_cat = (session.pending_request.category or "").lower()
                pending_brand = (session.pending_request.brand_name or "").lower()
                top_cat = (top_prod.category or "").lower()
                top_brand = (new_cands[0][1] or "").lower()

                if top_cat != pending_cat or (pending_brand and top_brand != pending_brand):
                    # User switched product topic! Clear pending request and treat as new command
                    clear_pending_request(session)

    if session.pending_request and not is_confirm_cmd and not is_clear_cmd:
        # User is answering the pending question or cancelling it
        pending = matcher.resolve_pending_slot(session.pending_request, user_msg_to_process)

        if pending.stage == ClarificationStage.CANCELLED:
            clear_pending_request(session)
            final_intent = AssistantIntent.GENERAL_CHAT
            chat_reply = pending.active_question or "Item cancel kar diya gaya. Aap agla product bata sakte hain."
            audio_reply = "Cancel kar diya."

        elif pending.stage == ClarificationStage.PRODUCT_IDENTIFIED:
            final_intent = AssistantIntent.ADD_PRODUCT
            pid = pending.confirmed_product_id
            card = matcher.build_product_card(pid) if pid else None

            qty = pending.quantity or 1
            unit = pending.selling_unit or QuantityUnit.CASE
            unit_label = "case" if unit == QuantityUnit.CASE else "packet"

            if card:
                suggested_cards.append(card)

            cart_actions.append(
                CartAction(
                    action=CartActionType.ADD,
                    product_id=pid,
                    sku=card.sku if card else "",
                    name=pending.product_name or (card.name if card else ""),
                    brand_name=pending.brand_name or (card.brand_name if card else ""),
                    pack_size=pending.pack_size or (card.pack_size if card else 1),
                    pack_unit=pending.pack_unit or (card.pack_unit if card else "gm"),
                    units_per_case=card.units_per_case if card else 1,
                    price=card.price if card and card.price else 0.0,
                    quantity=qty,
                    quantity_unit=unit,
                    quantity_available=card.quantity_available if card else 0,
                    image_url=card.image_url if card else None,
                )
            )

            pack_desc = f"{int(pending.pack_size)}{pending.pack_unit}" if pending.pack_size else ""
            prod_full = f"{pending.brand_name} {pending.product_name}"
            added_msg = f"Samajh gaya. {prod_full} ({pack_desc}) ke {qty} {unit_label} aapke order draft mein add kar diye."
            clear_pending_request(session)

            # Check if there are queued items from a multi-item request
            if session.pending_items_queue and len(session.pending_items_queue) > 0:
                next_item = session.pending_items_queue.pop(0)
                next_query = getattr(next_item, "product_phrase", "") or str(next_item)
                pack_sz = getattr(next_item, "pack_size_hint", None)
                pack_un = getattr(next_item, "pack_unit_hint", None) or "gm"
                if pack_sz and str(int(pack_sz)) not in next_query:
                    next_query = f"{next_query} {int(pack_sz)}{pack_un}"

                item_qty = getattr(next_item, "quantity", None)
                qty_exp = getattr(next_item, "quantity_explicit", False)
                item_unit = getattr(next_item, "quantity_unit", None)
                unit_exp = getattr(next_item, "quantity_unit_explicit", False)

                next_pending = matcher.create_pending_product_request(
                    phrase=next_query,
                    explicit_quantity=item_qty if qty_exp else None,
                    explicit_quantity_unit=item_unit if unit_exp else None,
                    pack_size_hint=pack_sz,
                    pack_unit_hint=pack_un,
                )

                if next_pending.stage == ClarificationStage.PRODUCT_IDENTIFIED:
                    next_pid = next_pending.confirmed_product_id
                    next_card = matcher.build_product_card(next_pid) if next_pid else None
                    nxt_q = next_pending.quantity or 1
                    nxt_u = next_pending.selling_unit or QuantityUnit.CASE
                    nxt_u_lbl = "case" if nxt_u == QuantityUnit.CASE else "packet"
                    cart_actions.append(
                        CartAction(
                            action=CartActionType.ADD,
                            product_id=next_pid,
                            sku=next_card.sku if next_card else "",
                            name=next_pending.product_name or (next_card.name if next_card else ""),
                            brand_name=next_pending.brand_name or (next_card.brand_name if next_card else ""),
                            pack_size=next_pending.pack_size or (next_card.pack_size if next_card else 1),
                            pack_unit=next_pending.pack_unit or (next_card.pack_unit if next_card else "gm"),
                            units_per_case=next_card.units_per_case if next_card else 1,
                            price=next_card.price if next_card and next_card.price else 0.0,
                            quantity=nxt_q,
                            quantity_unit=nxt_u,
                            quantity_available=next_card.quantity_available if next_card else 0,
                            image_url=next_card.image_url if next_card else None,
                        )
                    )
                    chat_reply = f"{added_msg} Aur {next_pending.brand_name} {next_pending.product_name} ke {nxt_q} {nxt_u_lbl} bhi cart me add ho gaye hain."
                    audio_reply = f"{prod_full} aur {next_pending.product_name} add kar diye."
                elif next_pending.stage != ClarificationStage.CANCELLED:
                    final_intent = AssistantIntent.CLARIFY
                    set_pending_request(session, next_pending)
                    for opt in next_pending.active_options:
                        c_opt = matcher.build_product_card(opt.product_id)
                        if c_opt:
                            suggested_cards.append(c_opt)

                    phrase_name = getattr(next_item, "product_phrase", "item")
                    next_q = next_pending.active_question or "Hamare paas ye uplabdh hai. Kitne packet ya case chahiye?"
                    chat_reply = f"{added_msg} Ab **{phrase_name}** ke liye: {next_q}"
                    audio_reply = f"{prod_full} add ho gaya. Ab {phrase_name} kitna chahiye?"
                else:
                    chat_reply = added_msg
                    audio_reply = f"{prod_full} ke {qty} {unit_label} add ho gaye."
            else:
                chat_reply = added_msg
                audio_reply = f"{prod_full} ke {qty} {unit_label} add ho gaye."

        else:
            # Still in clarification (Awaiting Brand / Variant / Size / Unit / Qty)
            final_intent = AssistantIntent.CLARIFY
            set_pending_request(session, pending)
            for opt in pending.active_options:
                c = matcher.build_product_card(opt.product_id)
                if c:
                    suggested_cards.append(c)

            chat_reply = pending.active_question or "Kripya sahi option batayein."
            audio_reply = chat_reply

    else:
        # No pending request: Parse intent and items with Groq / fallback
        nlu_output = parse_with_groq(
            user_message=user_msg_to_process,
            session=session,
            cart_items=request.cart_snapshot,
        )

        chat_reply = nlu_output.chat_reply
        audio_reply = nlu_output.audio_reply
        final_intent = nlu_output.intent

        # 5. Execute action based on parsed intent
        if final_intent == AssistantIntent.ADD_PRODUCT or final_intent == AssistantIntent.QUERY_PRICE_STOCK:
            items_to_match = nlu_output.items or []
            added_names = []

            for item in items_to_match:
                search_query = item.product_phrase
                if item.pack_size_hint and str(int(item.pack_size_hint)) not in search_query:
                    search_query = f"{search_query} {int(item.pack_size_hint)}{item.pack_unit_hint or 'gm'}"

                if final_intent == AssistantIntent.ADD_PRODUCT:
                    pending = matcher.create_pending_product_request(
                        phrase=search_query,
                        explicit_quantity=item.quantity if item.quantity_explicit else None,
                        explicit_quantity_unit=item.quantity_unit if item.quantity_unit_explicit else None,
                        pack_size_hint=item.pack_size_hint,
                        pack_unit_hint=item.pack_unit_hint,
                    )

                    if pending.stage == ClarificationStage.PRODUCT_IDENTIFIED:
                        pid = pending.confirmed_product_id
                        card = matcher.build_product_card(pid) if pid else None
                        if card:
                            suggested_cards.append(card)

                        qty = item.quantity if item.quantity > 0 else (pending.quantity or 1)
                        unit = item.quantity_unit or pending.selling_unit or QuantityUnit.CASE
                        unit_label = "case" if unit == QuantityUnit.CASE else "packet"

                        cart_actions.append(
                            CartAction(
                                action=CartActionType.ADD,
                                product_id=pid,
                                sku=card.sku if card else "",
                                name=pending.product_name or (card.name if card else ""),
                                brand_name=pending.brand_name or (card.brand_name if card else ""),
                                pack_size=pending.pack_size or (card.pack_size if card else 1),
                                pack_unit=pending.pack_unit or (card.pack_unit if card else "gm"),
                                units_per_case=card.units_per_case if card else 1,
                                price=card.price if card and card.price else 0.0,
                                quantity=qty,
                                quantity_unit=unit,
                                quantity_available=card.quantity_available if card else 0,
                                image_url=card.image_url if card else None,
                            )
                        )
                        added_names.append(f"{pending.brand_name} {pending.product_name} ({qty} {unit_label})")

                    elif pending.stage != ClarificationStage.CANCELLED:
                        # Queue any remaining items so they aren't lost
                        current_idx = items_to_match.index(item)
                        session.pending_items_queue = items_to_match[current_idx + 1:]

                        final_intent = AssistantIntent.CLARIFY
                        set_pending_request(session, pending)
                        for opt in pending.active_options:
                            c = matcher.build_product_card(opt.product_id)
                            if c:
                                suggested_cards.append(c)

                        all_item_phrases = [it.product_phrase for it in items_to_match]
                        if len(items_to_match) > 1:
                            chat_reply = f"Maine aapki request me **{', '.join(all_item_phrases)}** note kar li hai. Pehle **{item.product_phrase}**: {pending.active_question or 'Hamare paas ye uplabdh hai. Kitne packet ya case chahiye?'}"
                            audio_reply = f"{', '.join(all_item_phrases)} note kar li. Pehle {item.product_phrase}: kitne chahiye?"
                        else:
                            chat_reply = pending.active_question or "Kripya sahi variant select karein."
                            audio_reply = chat_reply
                        break
                    else:
                        if nlu_output.chat_reply and "add kar rahe" not in nlu_output.chat_reply:
                            chat_reply = nlu_output.chat_reply
                            audio_reply = nlu_output.audio_reply or chat_reply
                        else:
                            chat_reply = pending.active_question or f"'{item.product_phrase}' catalogue me nahi mila. Kripya doosra naam ya brand try karein."
                            audio_reply = chat_reply
                        audio_reply = chat_reply

                elif final_intent == AssistantIntent.QUERY_PRICE_STOCK:
                    matched = matcher.match_item(search_query)
                    if matched.status == MatchStatus.MATCHED:
                        card = matcher.build_product_card(matched.product_id)
                        if card:
                            suggested_cards.append(card)
                        price_str = f"₹{matched.unit_price:.2f}" if matched.unit_price else "Rate uplabdh nahi"
                        stock_qty = card.quantity_available if card else 0
                        chat_reply = f"{matched.brand_name} {matched.product_name} ka price {price_str} hai, aur stock {stock_qty} piece available hai."
                        audio_reply = f"{matched.product_name} ka price {matched.unit_price or 0:.0f} rupaye hai."
                    else:
                        chat_reply = matched.clarification_question or f"'{search_query}' ki details uplabdh nahi hain."
                        audio_reply = chat_reply

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
                            note="Confirmed via AI Conversational Assistant",
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

    # Deduplicate suggested product cards by product_id
    seen_card_ids = set()
    deduped_cards = []
    for sc in suggested_cards:
        if sc.product_id not in seen_card_ids:
            seen_card_ids.add(sc.product_id)
            deduped_cards.append(sc)
    suggested_cards = deduped_cards

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
        pending_request=session.pending_request,
    )


def process_parchi_image(
    db: Session,
    current_user: User,
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
) -> AssistantChatResponse:
    """
    Multimodal Kirana Parchi / Handwritten Order Slip OCR processing.
    Transcribes handwritten or printed slips using Gemini 2.5 Flash Vision,
    scores items against retailer catalogue, and adds recognized items directly to order draft.
    """
    from app.modules.ai_assistant.groq_service import parse_order_slip_image
    from app.modules.ai_assistant.matcher import HybridProductMatcher
    from app.modules.retailers.models import RetailerUser

    retailer_id = db.scalar(
        select(RetailerUser.retailer_id).where(RetailerUser.user_id == current_user.id)
    )
    if not retailer_id:
        raise ValueError("No retailer account is linked to this user.")

    session = get_or_create_session(str(retailer_id), str(current_user.id))
    matcher = HybridProductMatcher(db, retailer_id)

    # 1. Vision OCR Transcription
    extracted_vision_items = parse_order_slip_image(image_bytes, mime_type)

    cart_actions: list[CartAction] = []
    suggested_cards: list[ProductCardInfo] = []
    added_descriptions: list[str] = []
    pending_items: list[Any] = []

    for item in extracted_vision_items:
        phrase = item.product_phrase
        if not phrase:
            continue

        scored = matcher.score_candidates(
            phrase,
            pack_size_hint=item.pack_size_hint,
        )

        if scored and scored[0][2] >= 65.0:
            top_prod, top_brand, top_score = scored[0]
            price = matcher.price_map.get(top_prod.id, 0.0)
            avail = matcher.inventory_map.get(top_prod.id, 0)

            unit = item.quantity_unit if isinstance(item.quantity_unit, QuantityUnit) else QuantityUnit.PIECE
            qty = max(1, item.quantity)

            extracted_order_item = ExtractedOrderItem(
                raw_text=phrase,
                product_id=str(top_prod.id),
                sku=top_prod.sku,
                product_name=top_prod.name,
                brand_name=top_brand,
                pack_size=float(top_prod.pack_size) if top_prod.pack_size else None,
                pack_unit=top_prod.pack_unit,
                quantity=qty,
                quantity_unit=unit,
                confidence=top_score,
                unit_price=float(price),
                status=MatchStatus.MATCHED,
            )
            add_draft_item(session, extracted_order_item)

            cart_actions.append(
                CartAction(
                    action=CartActionType.ADD,
                    product_id=str(top_prod.id),
                    sku=top_prod.sku,
                    name=top_prod.name,
                    brand_name=top_brand,
                    pack_size=float(top_prod.pack_size) if top_prod.pack_size else None,
                    pack_unit=top_prod.pack_unit,
                    units_per_case=top_prod.units_per_case or 1,
                    price=float(price),
                    quantity=qty,
                    quantity_unit=unit,
                    quantity_available=avail,
                )
            )

            card = matcher.build_product_card(str(top_prod.id))
            if card:
                suggested_cards.append(card)

            unit_label = "case" if unit == QuantityUnit.CASE else "packet"
            added_descriptions.append(f"• {top_brand} {top_prod.name} ({qty} {unit_label})")
        else:
            pending_items.append(item)

    if pending_items and hasattr(session, "pending_items_queue"):
        session.pending_items_queue.extend(pending_items)

    save_session(session)

    if added_descriptions:
        chat_reply = (
            f"📸 Parchi successfully scan ho gayi! {len(added_descriptions)} products aapke cart me add kar diye hain:\n"
            + "\n".join(added_descriptions)
        )
        audio_reply = f"Parchi scan ho gayi. {len(added_descriptions)} products cart me add kar diye hain."
    else:
        chat_reply = (
            "Parchi scan hui lekin catalogue se koi direct match nahi mila. "
            "Kripya saaf photo upload karein ya text/voice me bol kar bataiye."
        )
        audio_reply = "Parchi me items pehchan me nahi aaye, kripya bol kar batayein."

    append_message(
        session=session,
        role=AssistantRole.ASSISTANT,
        content=chat_reply,
        audio_text=audio_reply,
        intent=AssistantIntent.ADD_PRODUCT,
        suggested_products=suggested_cards,
    )

    return AssistantChatResponse(
        session_id=session.session_id,
        reply=chat_reply,
        audio_text=audio_reply,
        intent=AssistantIntent.ADD_PRODUCT,
        messages=session.messages,
        suggested_products=suggested_cards,
        cart_actions=cart_actions,
        is_order_confirmed=False,
    )
