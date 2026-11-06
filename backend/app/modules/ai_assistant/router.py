from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.ai_assistant.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantSessionState,
)
from app.modules.ai_assistant.service import process_assistant_chat
from app.modules.ai_assistant.session_service import (
    clear_session,
    get_or_create_session,
)
from app.modules.retailers.models import RetailerUser
from app.modules.users.models import User

router = APIRouter(prefix="/assistant", tags=["AI Ordering Assistant"])


@router.post(
    "/chat",
    response_model=AssistantChatResponse,
    status_code=status.HTTP_200_OK,
)
def assistant_chat(
    request: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    """
    Multilingual conversational ordering endpoint.
    Handles Voice Mode and Chat Mode inputs, executes hybrid semantic matching,
    updates cart state, and provides dual visual chat and concise speech audio text.
    """
    try:
        return process_assistant_chat(
            db=db,
            current_user=current_user,
            request=request,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assistant processing error: {str(exc)}",
        ) from exc


@router.get(
    "/session",
    response_model=AssistantSessionState,
    status_code=status.HTTP_200_OK,
)
def get_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    """
    Retrieve active conversation history and draft state for the authenticated retailer.
    Enables instant state restoration across page refreshes and mode switches.
    """
    retailer_id = db.scalar(
        select(RetailerUser.retailer_id).where(
            RetailerUser.user_id == current_user.id
        )
    )
    if not retailer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No retailer account is linked to this user.",
        )

    return get_or_create_session(
        retailer_id=str(retailer_id),
        user_id=str(current_user.id),
    )


@router.delete(
    "/session",
    response_model=AssistantSessionState,
    status_code=status.HTTP_200_OK,
)
def reset_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("RETAILER")),
):
    """
    Clear active dialogue history and reset the assistant session.
    """
    retailer_id = db.scalar(
        select(RetailerUser.retailer_id).where(
            RetailerUser.user_id == current_user.id
        )
    )
    if not retailer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No retailer account is linked to this user.",
        )

    return clear_session(
        retailer_id=str(retailer_id),
        user_id=str(current_user.id),
    )
