from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.orders.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
)
from app.modules.orders.schemas import OrderCreate
from app.modules.orders.calculation_service import calculate_order_line
from app.modules.pricing.service import get_retailer_product_price
from app.modules.schemes.service import get_eligible_scheme_rules
from app.modules.retailers.models import Retailer


def create_order_draft(
    db: Session,
    payload: OrderCreate,
    created_by: UUID,
    source: str = "RETAILER_WEB",
) -> Order:
    """
    Create a priced order draft.

    created_by must come from a trusted authentication dependency,
    never directly from the request body.
    """

    try:
        # 1. Check for a previous request with the same idempotency key.
        existing_order = db.scalar(
            select(Order).where(
                Order.idempotency_key == payload.idempotency_key
            )
        )

        if existing_order is not None:
            if (
                existing_order.retailer_id != payload.retailer_id
                or existing_order.created_by != created_by
            ):
                raise ValueError("Idempotency key belongs to another order.")

            return existing_order

        # 2. Validate that the retailer exists and is active.
        retailer = db.scalar(
            select(Retailer).where(
                Retailer.id == payload.retailer_id,
                Retailer.is_active.is_(True),
            )
        )

        if retailer is None:
            raise ValueError("Retailer not found or inactive.")

        current_time = datetime.now(timezone.utc)

        # 3. Create the order header.
        order = Order(
            order_number=(
                f"ORD-{current_time:%Y%m%d}-{uuid4().hex[:8].upper()}"
            ),
            retailer_id=payload.retailer_id,
            created_by=created_by,
            status="DRAFT",
            source=source,
            idempotency_key=payload.idempotency_key,
            customer_note=payload.customer_note,
        )

        db.add(order)
        db.flush()

        subtotal = 0
        total_discount = 0
        total_tax = 0
        total_amount = 0

        # 4. Calculate every order line using trusted database records.
        for requested_item in payload.items:

            product, price_record = get_retailer_product_price(
                db=db,
                retailer_id=payload.retailer_id,
                product_id=requested_item.product_id,
                at=current_time,
            )

            if product.gst_rate is None:
                raise ValueError(
                    f"GST rate is not configured for SKU {product.sku}."
                )

            eligible_rows = get_eligible_scheme_rules(
                db=db,
                retailer_id=payload.retailer_id,
                product_id=product.id,
                quantity_unit=requested_item.quantity_unit,
                at=current_time,
            )

            # Do not silently stack separate schemes.
            scheme_groups = {}

            for scheme, rule in eligible_rows:
                scheme_groups.setdefault(scheme.id, (scheme, []))[1].append(
                    rule
                )

            if len(scheme_groups) > 1:
                raise ValueError(
                    f"Multiple schemes apply to SKU {product.sku}. "
                    "Manual scheme selection is required."
                )

            selected_scheme = None
            selected_rules = []

            if scheme_groups:
                selected_scheme, selected_rules = next(
                    iter(scheme_groups.values())
                )

            calculated = calculate_order_line(
                product=product,
                price_record=price_record,
                quantity=requested_item.quantity,
                quantity_unit=requested_item.quantity_unit,
                scheme=selected_scheme,
                scheme_rules=selected_rules,
            )

            # 5. Save the calculated line and historical snapshots.
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                scheme_id=calculated.scheme_id,
                product_name=product.name,
                sku=product.sku,
                quantity=calculated.quantity,
                quantity_unit=calculated.quantity_unit,
                free_quantity=calculated.free_quantity,
                unit_price=price_record.price,
                discount_amount=calculated.discount_amount,
                tax_amount=calculated.tax_amount,
                line_total=calculated.total_amount,
            )

            db.add(order_item)

            subtotal += calculated.subtotal
            total_discount += calculated.discount_amount
            total_tax += calculated.tax_amount
            total_amount += calculated.total_amount

        # 6. Save the authoritative order totals.
        order.subtotal = subtotal
        order.discount_amount = total_discount
        order.tax_amount = total_tax
        order.total_amount = total_amount

        # 7. Record the initial status.
        db.add(
            OrderStatusHistory(
                order_id=order.id,
                previous_status=None,
                new_status="DRAFT",
                changed_by=created_by,
                note="Order draft created.",
            )
        )

        db.commit()
        db.refresh(order)

        return order

    except Exception:
        db.rollback()
        raise