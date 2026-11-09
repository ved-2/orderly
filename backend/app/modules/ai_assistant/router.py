from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.ai_assistant.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantSessionState,
    DraftItemInput,
    DraftResponse,
    ExtractedOrderItem,
    MatchStatus,
    OrderConfirmRequest,
    OrderConfirmResponse,
    QuantityUnit,
)
from app.modules.ai_assistant.service import (
    execute_order_confirmation,
    process_assistant_chat,
    process_parchi_image,
    resolve_retailer_id,
)
from app.modules.ai_assistant.session_service import (
    add_draft_item,
    clear_draft_items,
    clear_session,
    get_or_create_session,
    remove_draft_item,
    update_draft_item_quantity,
)
from app.modules.products.models import Product
from app.modules.retailers.models import RetailerUser
from app.modules.users.models import User

router = APIRouter(prefix="/assistant", tags=["AI Ordering Assistant"])

AI_ASSISTANT_ROLES = ("RETAILER", "SALESMAN", "DISTRIBUTOR_ADMIN", "ORDER_DESK")


@router.post(
    "/chat",
    response_model=AssistantChatResponse,
    status_code=status.HTTP_200_OK,
)
def assistant_chat(
    request: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
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


@router.post(
    "/scan-parchi",
    response_model=AssistantChatResponse,
    status_code=status.HTTP_200_OK,
)
async def scan_parchi(
    file: UploadFile = File(...),
    retailer_id: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Multimodal Kirana Parchi / Handwritten Order Slip OCR endpoint.
    Uses Google Gemini Vision (with Groq and local fallbacks) to transcribe products,
    matches against distributor catalogue, and automatically adds items to retailer draft.
    """
    try:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"
        return process_parchi_image(
            db=db,
            current_user=current_user,
            image_bytes=image_bytes,
            mime_type=mime_type,
            retailer_id_override=retailer_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Parchi scan failed: {str(exc)}",
        ) from exc


@router.get(
    "/session",
    response_model=AssistantSessionState,
    status_code=status.HTTP_200_OK,
)
def get_session(
    retailer_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Retrieve active conversation history and draft state for the authenticated retailer.
    Enables instant state restoration across page refreshes and mode switches.
    """
    try:
        retailer_id = resolve_retailer_id(db, current_user, retailer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

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
    retailer_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Clear active dialogue history and reset the assistant session.
    """
    try:
        retailer_id = resolve_retailer_id(db, current_user, retailer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    return clear_session(
        retailer_id=str(retailer_id),
        user_id=str(current_user.id),
    )


@router.get(
    "/draft",
    response_model=DraftResponse,
    status_code=status.HTTP_200_OK,
)
def get_draft(
    retailer_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Retrieve current server-authoritative draft items and calculate deterministic total.
    """
    try:
        retailer_id = resolve_retailer_id(db, current_user, retailer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    session = get_or_create_session(str(retailer_id), str(current_user.id))
    total_qty = sum(it.quantity for it in session.draft_items)
    subtotal = sum((it.unit_price or 0.0) * it.quantity for it in session.draft_items)

    return DraftResponse(
        items=session.draft_items,
        item_count=total_qty,
        subtotal=round(subtotal, 2),
    )


@router.post(
    "/draft/items",
    response_model=DraftResponse,
    status_code=status.HTTP_200_OK,
)
def add_item_to_draft_endpoint(
    payload: DraftItemInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Directly add an item to the server draft with catalog verification.
    """
    try:
        retailer_id = resolve_retailer_id(db, current_user, payload.retailer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    try:
        pid = UUID(payload.product_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid product ID format.",
        )

    product = db.scalar(select(Product).where(Product.id == pid, Product.is_active.is_(True)))
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or inactive.",
        )

    now = datetime.now(timezone.utc)
    from app.modules.pricing.service import get_retailer_product_price
    prod, price_record = get_retailer_product_price(db, retailer_id, pid, at=now)
    unit_price = float(price_record.price) if price_record else 0.0

    session = get_or_create_session(str(retailer_id), str(current_user.id))
    new_item = ExtractedOrderItem(
        raw_text=product.name,
        product_id=str(product.id),
        sku=product.sku,
        product_name=product.name,
        brand_name=product.brand.name if product.brand else "",
        pack_size=float(product.package_size) if product.package_size else 1.0,
        pack_unit=product.package_unit or "gm",
        quantity=payload.quantity,
        quantity_unit=payload.quantity_unit,
        unit_price=unit_price,
        confidence=1.0,
        status=MatchStatus.MATCHED,
    )
    add_draft_item(session, new_item)

    total_qty = sum(it.quantity for it in session.draft_items)
    subtotal = sum((it.unit_price or 0.0) * it.quantity for it in session.draft_items)
    return DraftResponse(
        items=session.draft_items,
        item_count=total_qty,
        subtotal=round(subtotal, 2),
    )


@router.patch(
    "/draft/items",
    response_model=DraftResponse,
    status_code=status.HTTP_200_OK,
)
def update_draft_item_endpoint(
    payload: DraftItemInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Update quantity of a line item in the server draft.
    """
    try:
        retailer_id = resolve_retailer_id(db, current_user, payload.retailer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    session = get_or_create_session(str(retailer_id), str(current_user.id))
    unit_str = payload.quantity_unit.value if hasattr(payload.quantity_unit, "value") else str(payload.quantity_unit)
    updated = update_draft_item_quantity(session, payload.product_id, payload.quantity, unit_str)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in draft.",
        )

    total_qty = sum(it.quantity for it in session.draft_items)
    subtotal = sum((it.unit_price or 0.0) * it.quantity for it in session.draft_items)
    return DraftResponse(
        items=session.draft_items,
        item_count=total_qty,
        subtotal=round(subtotal, 2),
    )


@router.delete(
    "/draft/items/{product_id}",
    response_model=DraftResponse,
    status_code=status.HTTP_200_OK,
)
def remove_draft_item_endpoint(
    product_id: str,
    quantity_unit: str | None = None,
    retailer_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Remove an item from the server draft.
    """
    try:
        retailer_id = resolve_retailer_id(db, current_user, retailer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    session = get_or_create_session(str(retailer_id), str(current_user.id))
    remove_draft_item(session, product_id, quantity_unit)

    total_qty = sum(it.quantity for it in session.draft_items)
    subtotal = sum((it.unit_price or 0.0) * it.quantity for it in session.draft_items)
    return DraftResponse(
        items=session.draft_items,
        item_count=total_qty,
        subtotal=round(subtotal, 2),
    )


@router.delete(
    "/draft",
    response_model=DraftResponse,
    status_code=status.HTTP_200_OK,
)
def clear_draft_endpoint(
    retailer_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Clear all items from the server draft.
    """
    try:
        retailer_id = resolve_retailer_id(db, current_user, retailer_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    session = get_or_create_session(str(retailer_id), str(current_user.id))
    clear_draft_items(session)
    return DraftResponse(items=[], item_count=0, subtotal=0.0)


@router.post(
    "/confirm",
    response_model=OrderConfirmResponse,
    status_code=status.HTTP_200_OK,
)
def confirm_order_endpoint(
    request: OrderConfirmRequest = OrderConfirmRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*AI_ASSISTANT_ROLES)),
):
    """
    Atomic server-authoritative explicit confirmation of order draft.
    Validates items, checks pricing and active schemes, creates Order with status SUBMITTED,
    sets source to AI_CAPTURE, creates OrderStatusHistory, and clears draft.
    """
    try:
        retailer_id = resolve_retailer_id(db, current_user, getattr(request, "retailer_id", None))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    session = get_or_create_session(str(retailer_id), str(current_user.id))
    
    # Priority: explicit cart snapshot if sent, else session draft items
    items_to_confirm = request.cart_snapshot or session.draft_items
    if not items_to_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draft me koi products nahi hain. Pehle product add karein.",
        )

    try:
        draft = execute_order_confirmation(
            db=db,
            retailer_id=retailer_id,
            user_id=current_user.id,
            items=items_to_confirm,
            customer_note=request.customer_note or "Placed via Kirana AI Assistant",
        )
        return OrderConfirmResponse(
            order_id=str(draft.id),
            order_number=draft.order_number,
            status=draft.status,
            total_amount=float(draft.total_amount),
            items_count=len(draft.items),
            message=f"Order #{draft.order_number} successfully placed and submitted to Order Desk.",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Order confirmation failed: {str(exc)}",
        ) from exc
