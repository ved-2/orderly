from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.modules.products.models import Product, Brand
from app.modules.retailers.models import RetailerUser, Retailer
from app.modules.pricing.service import get_retailer_product_price


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

    items = []

    for product, brand_name in products:
        try:
            _, price_record = get_retailer_product_price(
                db=db,
                retailer_id=retailer_id,
                product_id=product.id,
            )
            price = price_record.price
            gst_included = price_record.gst_included
        except ValueError:
            price = None
            gst_included = None

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
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
