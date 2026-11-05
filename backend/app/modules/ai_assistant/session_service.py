import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict

from app.modules.ai_assistant.schemas import (
    AssistantIntent,
    AssistantMessage,
    AssistantRole,
    AssistantSessionState,
    ClarificationOption,
    ExtractedOrderItem,
    ProductCardInfo,
)

logger = logging.getLogger(__name__)

# In-memory session store keyed by retailer_id
_SESSION_STORE: Dict[str, AssistantSessionState] = {}


def get_or_create_session(
    retailer_id: str,
    user_id: str,
    session_id: str | None = None,
) -> AssistantSessionState:
    """
    Retrieve an active conversation session for the retailer or initialize a new one.
    Maintains a single shared state engine between Voice Mode and Chat Mode.
    """
    existing = _SESSION_STORE.get(retailer_id)
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
    _SESSION_STORE[retailer_id] = session
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
    """Append a new user or assistant message to the session history."""
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
    return msg


def clear_session(retailer_id: str, user_id: str) -> AssistantSessionState:
    """Clear conversation history and draft items, resetting the session."""
    _SESSION_STORE.pop(retailer_id, None)
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


def update_session_draft(
    session: AssistantSessionState,
    items: list[ExtractedOrderItem],
) -> None:
    """Update active draft items extracted from conversation."""
    session.draft_items = items
    session.last_activity = datetime.now(timezone.utc)


def cleanup_stale_sessions(max_age_hours: int = 24) -> int:
    """Prune sessions inactive for longer than max_age_hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    stale_keys = [
        k for k, s in _SESSION_STORE.items() if s.last_activity < cutoff
    ]
    for k in stale_keys:
        del _SESSION_STORE[k]
    return len(stale_keys)
