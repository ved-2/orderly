import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Optional

from app.modules.ai_assistant.schemas import (
    AssistantIntent,
    AssistantMessage,
    AssistantRole,
    AssistantSessionState,
    ClarificationOption,
    ExtractedOrderItem,
    PendingProductRequest,
    ProductCardInfo,
)

logger = logging.getLogger(__name__)

# In-memory session store keyed by retailer_id
_SESSION_STORE: Dict[str, AssistantSessionState] = {}

# Persistent directory for durable recovery across process restarts
_STORAGE_DIR = Path(__file__).resolve().parent.parent.parent.parent / ".sessions"


def _ensure_storage_dir() -> Path:
    try:
        _STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        logger.warning(f"Could not initialize session directory {_STORAGE_DIR}: {exc}")
    return _STORAGE_DIR


def _load_persisted_session(retailer_id: str) -> Optional[AssistantSessionState]:
    """Attempt to restore session from durable disk storage."""
    try:
        target_path = _STORAGE_DIR / f"{retailer_id}.json"
        if target_path.exists():
            data_str = target_path.read_text(encoding="utf-8")
            if data_str:
                state = AssistantSessionState.model_validate_json(data_str)
                _SESSION_STORE[retailer_id] = state
                return state
    except Exception as exc:
        logger.warning(f"Could not load persisted session for retailer {retailer_id}: {exc}")
    return None


def save_session(session: AssistantSessionState) -> None:
    """Save session to both in-memory store and durable storage."""
    _SESSION_STORE[session.retailer_id] = session
    try:
        dir_path = _ensure_storage_dir()
        target_path = dir_path / f"{session.retailer_id}.json"
        target_path.write_text(session.model_dump_json(indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning(f"Could not persist session {session.session_id}: {exc}")


def get_or_create_session(
    retailer_id: str,
    user_id: str,
    session_id: str | None = None,
) -> AssistantSessionState:
    """
    Retrieve an active conversation session for the retailer or initialize a new one.
    Recovers from durable storage if absent from memory.
    """
    existing = _SESSION_STORE.get(retailer_id)
    if not existing:
        existing = _load_persisted_session(retailer_id)

    if existing:
        existing.last_activity = datetime.now(timezone.utc)
        return existing

    new_session_id = session_id or str(uuid.uuid4())
    welcome_message = AssistantMessage(
        role=AssistantRole.ASSISTANT,
        content=(
            "Namaste! Main aapka Orderly AI ordering assistant hoon. "
            "Aap bol kar ya likh kar koi bhi product order kar sakte hain. "
            "Jaise: 'Parle-G 10 packet' ya 'Tata Salt 1 case add karo'."
        ),
        audio_text=(
            "Namaste! Main aapka Orderly assistant hoon. "
            "Aap bol kar ya likh kar apna order de sakte hain."
        ),
        intent=AssistantIntent.GENERAL_CHAT,
    )

    session = AssistantSessionState(
        session_id=new_session_id,
        retailer_id=retailer_id,
        user_id=user_id,
        mode="CHAT",
        messages=[welcome_message],
        draft_items=[],
        last_activity=datetime.now(timezone.utc),
    )
    save_session(session)
    return session


def append_message(
    session: AssistantSessionState,
    role: AssistantRole,
    content: str,
    audio_text: str | None = None,
    intent: AssistantIntent = AssistantIntent.GENERAL_CHAT,
    suggested_products: list[ProductCardInfo] | None = None,
    extracted_items: list[ExtractedOrderItem] | None = None,
    pending_clarification: str | None = None,
) -> AssistantMessage:
    """Append a new user or assistant message to the session history and persist."""
    msg = AssistantMessage(
        role=role,
        content=content,
        audio_text=audio_text or content,
        intent=intent,
        suggested_products=suggested_products or [],
        extracted_items=extracted_items or [],
        pending_clarification=pending_clarification,
    )
    session.messages.append(msg)
    # Keep up to 50 recent messages to preserve memory and token context
    if len(session.messages) > 50:
        session.messages = session.messages[-50:]
    session.last_activity = datetime.now(timezone.utc)
    save_session(session)
    return msg


def clear_session(retailer_id: str, user_id: str) -> AssistantSessionState:
    """Clear conversation history and draft items, resetting the session."""
    _SESSION_STORE.pop(retailer_id, None)
    try:
        target_path = _STORAGE_DIR / f"{retailer_id}.json"
        if target_path.exists():
            target_path.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning(f"Could not delete persisted session for {retailer_id}: {exc}")

    return get_or_create_session(retailer_id, user_id)


def set_pending_clarification(
    session: AssistantSessionState,
    question: str | None,
    options: list[ClarificationOption] | None = None,
) -> None:
    """Track a clarification question and candidate items awaiting retailer response."""
    session.pending_question = question
    session.pending_options = options or []
    session.last_activity = datetime.now(timezone.utc)
    save_session(session)


def set_pending_request(
    session: AssistantSessionState,
    request: PendingProductRequest | None,
) -> None:
    """Track an active stateful clarification slot request and persist."""
    session.pending_request = request
    if request:
        session.pending_question = request.active_question
        session.pending_options = request.active_options
    else:
        session.pending_question = None
        session.pending_options = []
    session.last_activity = datetime.now(timezone.utc)
    save_session(session)


def clear_pending_request(session: AssistantSessionState) -> None:
    """Clear active pending clarification request and options."""
    set_pending_request(session, None)


def update_session_draft(
    session: AssistantSessionState,
    items: list[ExtractedOrderItem],
) -> None:
    """Update active draft items extracted from conversation and persist."""
    session.draft_items = items
    session.last_activity = datetime.now(timezone.utc)
    save_session(session)


def add_draft_item(
    session: AssistantSessionState,
    item: ExtractedOrderItem,
) -> None:
    """Add or increment quantity for an item in the session draft."""
    for existing in session.draft_items:
        if (
            existing.product_id == item.product_id
            and existing.quantity_unit == item.quantity_unit
        ):
            existing.quantity += item.quantity
            session.last_activity = datetime.now(timezone.utc)
            save_session(session)
            return

    session.draft_items.append(item)
    session.last_activity = datetime.now(timezone.utc)
    save_session(session)


def update_draft_item_quantity(
    session: AssistantSessionState,
    product_id: str,
    quantity: int,
    quantity_unit: str = "PIECE",
) -> bool:
    """Update quantity for a specific product line in the session draft."""
    for item in session.draft_items:
        if item.product_id == product_id and item.quantity_unit.value == quantity_unit:
            item.quantity = quantity
            session.last_activity = datetime.now(timezone.utc)
            save_session(session)
            return True
    return False


def remove_draft_item(
    session: AssistantSessionState,
    product_id: str,
    quantity_unit: str | None = None,
) -> bool:
    """Remove a product line from the session draft."""
    initial_len = len(session.draft_items)
    if quantity_unit:
        session.draft_items = [
            it for it in session.draft_items
            if not (it.product_id == product_id and it.quantity_unit.value == quantity_unit)
        ]
    else:
        session.draft_items = [
            it for it in session.draft_items
            if it.product_id != product_id
        ]
    if len(session.draft_items) != initial_len:
        session.last_activity = datetime.now(timezone.utc)
        save_session(session)
        return True
    return False


def clear_draft_items(session: AssistantSessionState) -> None:
    """Clear all draft items from the session."""
    session.draft_items = []
    session.last_activity = datetime.now(timezone.utc)
    save_session(session)


def sync_draft_items(
    session: AssistantSessionState,
    cart_items: list[dict],
) -> None:
    """Sync session draft items from a client cart snapshot."""
    from app.modules.ai_assistant.schemas import MatchStatus, QuantityUnit

    synced: list[ExtractedOrderItem] = []
    for it in cart_items:
        pid = it.get("product_id")
        if not pid:
            continue
        unit_str = str(it.get("quantity_unit", "PIECE")).upper()
        unit = QuantityUnit.CASE if "CASE" in unit_str else QuantityUnit.PIECE
        qty = int(it.get("quantity", 1))
        if qty <= 0:
            continue

        synced.append(
            ExtractedOrderItem(
                raw_text=it.get("name") or it.get("product_name") or "",
                product_id=str(pid),
                sku=it.get("sku"),
                product_name=it.get("name") or it.get("product_name"),
                brand_name=it.get("brand_name"),
                pack_size=float(it.get("pack_size", 1.0)) if it.get("pack_size") is not None else None,
                pack_unit=it.get("pack_unit"),
                quantity=qty,
                quantity_unit=unit,
                unit_price=float(it.get("price", 0.0)) if it.get("price") is not None else None,
                confidence=1.0,
                status=MatchStatus.MATCHED,
            )
        )
    session.draft_items = synced
    session.last_activity = datetime.now(timezone.utc)
    save_session(session)


def cleanup_stale_sessions(max_age_hours: int = 24) -> int:
    """Prune sessions inactive for longer than max_age_hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    stale_keys = [
        k for k, s in _SESSION_STORE.items() if s.last_activity < cutoff
    ]
    for k in stale_keys:
        del _SESSION_STORE[k]
        try:
            target_path = _STORAGE_DIR / f"{k}.json"
            if target_path.exists():
                target_path.unlink(missing_ok=True)
        except Exception:
            pass
    return len(stale_keys)
