from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.orders.models import Order, OrderItem
from app.modules.retailers.models import Retailer, RetailerAssignment
from app.modules.users.models import User

router = APIRouter(prefix="/distributor", tags=["Distributor - Sales & Salesmen"])


class AssignRetailerRequest(BaseModel):
    salesman_id: UUID
    retailer_id: UUID

    model_config = ConfigDict(extra="forbid")


class UnassignRetailerRequest(BaseModel):
    salesman_id: UUID
    retailer_id: UUID

    model_config = ConfigDict(extra="forbid")


@router.get("/salesmen")
def list_distributor_salesmen(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    """
    Returns the list of field salesmen, their assigned kirana retailers count,
    detailed retailer assignments, total orders placed, and total booked sales GMV.
    """
    # 1. Query all users with role SALESMAN
    salesmen = db.scalars(
        select(User)
        .where(User.role == "SALESMAN")
        .order_by(User.created_at.desc())
    ).all()

    salesmen_ids = [s.id for s in salesmen]

    # 2. Query Retailer Assignments for these salesmen
    assignments_rows = (
        db.execute(
            select(
                RetailerAssignment.salesman_id,
                Retailer.id,
                Retailer.shop_name,
                Retailer.retailer_code,
                Retailer.owner_name,
                Retailer.phone,
                Retailer.city,
            )
            .join(Retailer, Retailer.id == RetailerAssignment.retailer_id)
            .where(RetailerAssignment.salesman_id.in_(salesmen_ids))
        ).all()
        if salesmen_ids
        else []
    )

    assigned_map: dict = {}
    for s_id, r_id, shop_name, code, owner, phone, city in assignments_rows:
        assigned_map.setdefault(s_id, []).append({
            "id": str(r_id),
            "shop_name": shop_name,
            "retailer_code": code,
            "owner_name": owner,
            "phone": phone,
            "city": city,
        })

    # 3. Query order counts and total sales amounts per salesman
    sales_stats_rows = (
        db.execute(
            select(
                Order.created_by,
                func.count(Order.id),
                func.coalesce(func.sum(Order.total_amount), 0),
                func.max(Order.created_at),
            )
            .where(
                Order.created_by.in_(salesmen_ids),
                Order.status != "REJECTED",
            )
            .group_by(Order.created_by)
        ).all()
        if salesmen_ids
        else []
    )

    stats_map = {
        row[0]: {
            "orders_count": int(row[1]),
            "total_sales": float(row[2]),
            "last_order_at": row[3],
        }
        for row in sales_stats_rows
    }

    # 4. Also fetch active kirana retailers to allow assigning
    all_retailers = db.scalars(
        select(Retailer)
        .where(Retailer.is_active.is_(True))
        .order_by(Retailer.shop_name.asc())
        .limit(200)
    ).all()

    results = []
    for s in salesmen:
        stats = stats_map.get(s.id, {"orders_count": 0, "total_sales": 0.0, "last_order_at": None})
        assigned_list = assigned_map.get(s.id, [])
        results.append({
            "id": str(s.id),
            "email": s.email,
            "phone": s.phone,
            "is_active": s.is_active,
            "created_at": s.created_at,
            "assigned_retailers_count": len(assigned_list),
            "assigned_retailers": assigned_list,
            "total_orders": stats["orders_count"],
            "total_sales": stats["total_sales"],
            "last_order_at": stats["last_order_at"],
        })

    return {
        "items": results,
        "total": len(results),
        "available_retailers": [
            {
                "id": str(r.id),
                "shop_name": r.shop_name,
                "retailer_code": r.retailer_code,
                "owner_name": r.owner_name,
                "phone": r.phone,
                "city": r.city,
                "registration_status": r.registration_status,
            }
            for r in all_retailers
        ],
    }


@router.post("/salesmen/assign")
def assign_retailer_to_salesman(
    payload: AssignRetailerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    salesman = db.get(User, payload.salesman_id)
    if not salesman or salesman.role != "SALESMAN":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Salesman not found.",
        )

    retailer = db.get(Retailer, payload.retailer_id)
    if not retailer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retailer not found.",
        )

    # Check if assignment already exists
    existing = db.scalar(
        select(RetailerAssignment).where(
            RetailerAssignment.salesman_id == payload.salesman_id,
            RetailerAssignment.retailer_id == payload.retailer_id,
        )
    )
    if existing:
        return {"message": "Retailer is already assigned to this salesman.", "assignment_id": str(existing.id)}

    assignment = RetailerAssignment(
        salesman_id=payload.salesman_id,
        retailer_id=payload.retailer_id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return {
        "message": f"{retailer.shop_name} assigned to {salesman.email} successfully.",
        "assignment_id": str(assignment.id),
    }


@router.post("/salesmen/unassign")
def unassign_retailer_from_salesman(
    payload: UnassignRetailerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    assignment = db.scalar(
        select(RetailerAssignment).where(
            RetailerAssignment.salesman_id == payload.salesman_id,
            RetailerAssignment.retailer_id == payload.retailer_id,
        )
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )

    db.delete(assignment)
    db.commit()

    return {"message": "Retailer unassigned successfully."}


@router.get("/sales/metrics")
def get_distributor_sales_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    """
    High-level B2B wholesale sales intelligence, revenue figures, breakdown by order status,
    sales source (Salesman Beat vs Web vs AI), and top performing kirana retailers.
    """
    # 1. All-time revenue & orders count
    orders_stat = db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_amount), 0),
        ).where(Order.status != "REJECTED")
    ).first()
    total_orders = int(orders_stat[0] or 0)
    total_revenue = float(orders_stat[1] or 0.0)

    # 2. Approved/Dispatched Confirmed Revenue
    confirmed_stat = db.execute(
        select(
            func.coalesce(func.sum(Order.total_amount), 0),
            func.count(Order.id),
        ).where(Order.status.in_(["APPROVED", "DISPATCHED"]))
    ).first()
    confirmed_revenue = float(confirmed_stat[0] or 0.0)
    confirmed_orders_count = int(confirmed_stat[1] or 0)

    # 3. Pending Review & On Hold Pipeline Value
    pending_stat = db.execute(
        select(
            func.coalesce(func.sum(Order.total_amount), 0),
            func.count(Order.id),
        ).where(Order.status.in_(["SUBMITTED", "UNDER_REVIEW", "ON_HOLD"]))
    ).first()
    pending_revenue = float(pending_stat[0] or 0.0)
    pending_orders_count = int(pending_stat[1] or 0)

    # 4. Status counts
    status_counts_rows = db.execute(
        select(Order.status, func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0))
        .group_by(Order.status)
    ).all()
    status_counts = {
        row[0]: {"count": int(row[1]), "amount": float(row[2])}
        for row in status_counts_rows
    }

    # 5. Orders by source
    source_counts_rows = db.execute(
        select(Order.source, func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.status != "REJECTED")
        .group_by(Order.source)
    ).all()
    source_breakdown = {
        (row[0] or "DIRECT"): {"count": int(row[1]), "amount": float(row[2])}
        for row in source_counts_rows
    }

    # 6. Top 5 Kirana Retailers by Sales
    top_retailers_rows = db.execute(
        select(
            Retailer.id,
            Retailer.shop_name,
            Retailer.retailer_code,
            Retailer.city,
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_amount), 0),
        )
        .join(Retailer, Retailer.id == Order.retailer_id)
        .where(Order.status != "REJECTED")
        .group_by(Retailer.id, Retailer.shop_name, Retailer.retailer_code, Retailer.city)
        .order_by(func.coalesce(func.sum(Order.total_amount), 0).desc())
        .limit(5)
    ).all()

    top_retailers = [
        {
            "id": str(r[0]),
            "shop_name": r[1],
            "retailer_code": r[2],
            "city": r[3],
            "orders_count": int(r[4]),
            "total_spend": float(r[5]),
        }
        for r in top_retailers_rows
    ]

    avg_order_value = round(total_revenue / total_orders, 2) if total_orders > 0 else 0.0

    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "confirmed_revenue": confirmed_revenue,
        "confirmed_orders_count": confirmed_orders_count,
        "pending_revenue": pending_revenue,
        "pending_orders_count": pending_orders_count,
        "avg_order_value": avg_order_value,
        "status_breakdown": status_counts,
        "source_breakdown": source_breakdown,
        "top_retailers": top_retailers,
    }
