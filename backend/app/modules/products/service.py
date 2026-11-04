from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.modules.inventory.models import Inventory
from app.modules.products.models import Product, Brand
from app.modules.retailers.models import RetailerUser, Retailer
from app.modules.pricing.service import get_retailer_product_prices
from app.modules.schemes.models import Scheme, SchemeRule


def get_retailer_catalogue(
    db: Session,
    user_id,
    search: str | None = None,
    category: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    retailer_id = db.scalar(
        select(RetailerUser.retailer_id).where(
            RetailerUser.user_id == user_id
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
        raise ValueError("Retailer account cannot access the catalogue.")

    query = (
        select(Product, Brand.name)
        .join(Brand, Product.brand_id == Brand.id)
        .where(
            Product.is_active.is_(True),
            Brand.is_active.is_(True),
        )
    )

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            Product.name.ilike(term)
            | Product.sku.ilike(term)
            | Brand.name.ilike(term)
        )

    if category:
        query = query.where(Product.category == category)

    count_query = select(func.count()).select_from(
        query.order_by(None).subquery()
    )
    total = db.scalar(count_query) or 0

    products = db.execute(
        query
        .order_by(Product.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    product_ids = [product.id for product, _ in products]
    prices_by_product = get_retailer_product_prices(
        db=db,
        retailer_id=retailer_id,
        product_ids=product_ids,
    )
    inventory_rows = db.execute(
        select(
            Inventory.product_id,
            func.coalesce(func.sum(Inventory.quantity_on_hand), 0),
            func.coalesce(func.sum(Inventory.quantity_reserved), 0),
        )
        .where(Inventory.product_id.in_(product_ids))
        .group_by(Inventory.product_id)
    ).all() if product_ids else []
    inventory_by_product = {
        product_id: (quantity_on_hand, quantity_reserved)
        for product_id, quantity_on_hand, quantity_reserved in inventory_rows
    }

    # Preload active schemes for products
    now = datetime.now(timezone.utc)
    scheme_rules = db.execute(
        select(SchemeRule, Scheme.name.label("scheme_name"), Scheme.scheme_type)
        .join(Scheme, Scheme.id == SchemeRule.scheme_id)
        .where(
            SchemeRule.product_id.in_(product_ids),
            Scheme.is_active.is_(True),
            Scheme.valid_from <= now,
            Scheme.valid_to > now,
        )
    ).all() if product_ids else []

    scheme_map = {}
    for rule, scheme_name, scheme_type in scheme_rules:
        scheme_map.setdefault(rule.product_id, []).append({
            "scheme_name": scheme_name,
            "scheme_type": scheme_type,
            "buy_quantity": float(rule.buy_quantity) if rule.buy_quantity else None,
            "reward_quantity": float(rule.reward_quantity) if rule.reward_quantity else None,
            "min_quantity": float(rule.min_quantity) if rule.min_quantity else None,
            "discount_type": rule.discount_type,
            "discount_value": float(rule.discount_value) if rule.discount_value else None,
        })

    items = []

    for product, brand_name in products:
        price_record = prices_by_product.get(product.id)
        if price_record is not None:
            price = price_record.price
            gst_included = price_record.gst_included
        else:
            price = None
            gst_included = None

        quantity_on_hand, quantity_reserved = inventory_by_product.get(
            product.id, (0, 0)
        )
        quantity_available = quantity_on_hand - quantity_reserved

        items.append({
            "id": product.id,
            "sku": product.sku,
            "name": product.name,
            "description": product.description,
            "category": product.category,
            "brand_id": product.brand_id,
            "brand_name": brand_name,
            "pack_size": product.pack_size,
            "pack_unit": product.pack_unit,
            "units_per_case": product.units_per_case,
            "hsn_code": product.hsn_code,
            "gst_rate": product.gst_rate,
            "price": price,
            "gst_included": gst_included,
            "quantity_on_hand": quantity_on_hand,
            "quantity_reserved": quantity_reserved,
            "quantity_available": quantity_available,
            "schemes": scheme_map.get(product.id, []),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
