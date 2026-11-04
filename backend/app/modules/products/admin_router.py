from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.inventory.models import Inventory, Warehouse
from app.modules.pricing.default_price_models import DistributorProductPrice
from app.modules.products.models import Brand, Product
from app.modules.schemes.models import Scheme, SchemeRule
from app.modules.users.models import User

router = APIRouter(prefix="/distributor/products", tags=["Distributor - Products"])


def get_default_warehouse(db: Session) -> Warehouse:
    wh = db.scalar(
        select(Warehouse)
        .where(Warehouse.is_active.is_(True))
        .order_by(Warehouse.created_at.asc())
    )
    if wh is None:
        wh = Warehouse(
            code="WH-DEFAULT",
            name="Primary Distribution Depot",
            city="Main",
            is_active=True,
        )
        db.add(wh)
        db.commit()
        db.refresh(wh)
    return wh


class BrandResponse(BaseModel):
    id: UUID
    name: str
    code: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class BrandCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=30)


class ProductCreateRequest(BaseModel):
    sku: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=150)
    brand_id: UUID
    category: str = Field(..., min_length=2, max_length=80)
    description: Optional[str] = None
    pack_size: Decimal = Field(..., gt=0)
    pack_unit: str = Field(..., min_length=1, max_length=20)
    units_per_case: int = Field(..., gt=0)
    hsn_code: Optional[str] = Field(None, max_length=20)
    gst_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    price: Decimal = Field(..., ge=0)
    initial_stock: Decimal = Field(Decimal("0.00"), ge=0)


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    brand_id: Optional[UUID] = None
    category: Optional[str] = Field(None, min_length=2, max_length=80)
    description: Optional[str] = None
    pack_size: Optional[Decimal] = Field(None, gt=0)
    pack_unit: Optional[str] = Field(None, min_length=1, max_length=20)
    units_per_case: Optional[int] = Field(None, gt=0)
    hsn_code: Optional[str] = Field(None, max_length=20)
    gst_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    price: Optional[Decimal] = Field(None, ge=0)
    stock_on_hand: Optional[Decimal] = Field(None, ge=0)


@router.get("/brands", response_model=list[BrandResponse])
def list_brands(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    return db.scalars(
        select(Brand).order_by(Brand.name.asc())
    ).all()


@router.post("/brands", response_model=BrandResponse)
def create_brand(
    payload: BrandCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    code_clean = payload.code.strip().upper()
    name_clean = payload.name.strip()

    existing = db.scalar(
        select(Brand).where(
            or_(Brand.code == code_clean, Brand.name == name_clean)
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A brand with this code or name already exists.",
        )

    brand = Brand(name=name_clean, code=code_clean, is_active=True)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@router.get("")
def list_distributor_products(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query("ALL", regex="^(ALL|ACTIVE|INACTIVE)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    warehouse = get_default_warehouse(db)

    query = select(Product, Brand.name.label("brand_name")).join(
        Brand, Brand.id == Product.brand_id
    )

    if status_filter == "ACTIVE":
        query = query.where(Product.is_active.is_(True))
    elif status_filter == "INACTIVE":
        query = query.where(Product.is_active.is_(False))

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                Product.sku.ilike(term),
                Product.name.ilike(term),
                Product.category.ilike(term),
                Brand.name.ilike(term),
            )
        )

    query = query.order_by(Product.name.asc())
    results = db.execute(query).all()

    if not results:
        return {"items": [], "total": 0}

    product_ids = [p.id for p, _ in results]

    # Preload inventory for all listed products
    inv_rows = db.scalars(
        select(Inventory).where(
            Inventory.product_id.in_(product_ids),
            Inventory.warehouse_id == warehouse.id,
        )
    ).all()
    inv_map = {inv.product_id: inv for inv in inv_rows}

    # Preload current active prices
    now = datetime.now(timezone.utc)
    price_rows = db.scalars(
        select(DistributorProductPrice)
        .where(
            DistributorProductPrice.product_id.in_(product_ids),
            DistributorProductPrice.valid_from <= now,
            or_(
                DistributorProductPrice.valid_to.is_(None),
                DistributorProductPrice.valid_to > now,
            ),
        )
        .order_by(DistributorProductPrice.valid_from.desc())
    ).all()
    price_map = {}
    for pr in price_rows:
        if pr.product_id not in price_map:
            price_map[pr.product_id] = pr.price

    # Preload active schemes count
    scheme_rows = db.execute(
        select(SchemeRule.product_id)
        .join(Scheme, Scheme.id == SchemeRule.scheme_id)
        .where(
            SchemeRule.product_id.in_(product_ids),
            Scheme.is_active.is_(True),
            Scheme.valid_from <= now,
            Scheme.valid_to > now,
        )
    ).all()
    scheme_counts = {}
    for r in scheme_rows:
        scheme_counts[r[0]] = scheme_counts.get(r[0], 0) + 1

    items = []
    for product, brand_name in results:
        inv = inv_map.get(product.id)
        q_on_hand = inv.quantity_on_hand if inv else Decimal("0.00")
        q_reserved = inv.quantity_reserved if inv else Decimal("0.00")
        q_available = max(Decimal("0.00"), q_on_hand - q_reserved)

        items.append({
            "id": str(product.id),
            "sku": product.sku,
            "name": product.name,
            "description": product.description,
            "category": product.category,
            "brand_id": str(product.brand_id),
            "brand_name": brand_name,
            "pack_size": float(product.pack_size),
            "pack_unit": product.pack_unit,
            "units_per_case": product.units_per_case,
            "hsn_code": product.hsn_code,
            "gst_rate": float(product.gst_rate) if product.gst_rate else None,
            "is_active": product.is_active,
            "price": float(price_map.get(product.id, Decimal("0.00"))),
            "quantity_on_hand": float(q_on_hand),
            "quantity_reserved": float(q_reserved),
            "quantity_available": float(q_available),
            "active_schemes_count": scheme_counts.get(product.id, 0),
            "created_at": product.created_at,
        })

    return {"items": items, "total": len(items)}


@router.post("")
def create_product(
    payload: ProductCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    sku_clean = payload.sku.strip().upper()
    existing = db.scalar(select(Product).where(Product.sku == sku_clean))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with SKU '{sku_clean}' already exists.",
        )

    brand = db.get(Brand, payload.brand_id)
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found.",
        )

    warehouse = get_default_warehouse(db)
    now = datetime.now(timezone.utc)

    # 1. Product
    product = Product(
        brand_id=payload.brand_id,
        sku=sku_clean,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        category=payload.category.strip(),
        pack_size=payload.pack_size,
        pack_unit=payload.pack_unit.strip(),
        units_per_case=payload.units_per_case,
        hsn_code=payload.hsn_code.strip() if payload.hsn_code else None,
        gst_rate=payload.gst_rate,
        is_active=True,
    )
    db.add(product)
    db.flush()

    # 2. Price
    price = DistributorProductPrice(
        product_id=product.id,
        price=payload.price,
        gst_included=True,
        valid_from=now,
    )
    db.add(price)

    # 3. Warehouse Inventory
    inventory = Inventory(
        warehouse_id=warehouse.id,
        product_id=product.id,
        quantity_on_hand=payload.initial_stock,
        quantity_reserved=Decimal("0.00"),
    )
    db.add(inventory)

    db.commit()
    db.refresh(product)

    return {
        "id": str(product.id),
        "sku": product.sku,
        "name": product.name,
        "is_active": product.is_active,
        "message": f"Product '{product.name}' created successfully.",
    }


@router.put("/{product_id}")
def update_product(
    product_id: UUID,
    payload: ProductUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    warehouse = get_default_warehouse(db)
    now = datetime.now(timezone.utc)

    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.brand_id is not None:
        product.brand_id = payload.brand_id
    if payload.category is not None:
        product.category = payload.category.strip()
    if payload.description is not None:
        product.description = payload.description.strip() if payload.description else None
    if payload.pack_size is not None:
        product.pack_size = payload.pack_size
    if payload.pack_unit is not None:
        product.pack_unit = payload.pack_unit.strip()
    if payload.units_per_case is not None:
        product.units_per_case = payload.units_per_case
    if payload.hsn_code is not None:
        product.hsn_code = payload.hsn_code.strip() if payload.hsn_code else None
    if payload.gst_rate is not None:
        product.gst_rate = payload.gst_rate

    # Price update
    if payload.price is not None:
        active_price = db.scalar(
            select(DistributorProductPrice)
            .where(
                DistributorProductPrice.product_id == product.id,
                DistributorProductPrice.valid_from <= now,
                or_(
                    DistributorProductPrice.valid_to.is_(None),
                    DistributorProductPrice.valid_to > now,
                ),
            )
            .order_by(DistributorProductPrice.valid_from.desc())
        )
        if active_price is None or active_price.price != payload.price:
            if active_price is not None:
                active_price.valid_to = now
            new_price = DistributorProductPrice(
                product_id=product.id,
                price=payload.price,
                gst_included=True,
                valid_from=now,
            )
            db.add(new_price)

    # Stock update
    if payload.stock_on_hand is not None:
        inv = db.scalar(
            select(Inventory).where(
                Inventory.product_id == product.id,
                Inventory.warehouse_id == warehouse.id,
            )
        )
        if inv is None:
            inv = Inventory(
                warehouse_id=warehouse.id,
                product_id=product.id,
                quantity_on_hand=payload.stock_on_hand,
                quantity_reserved=Decimal("0.00"),
            )
            db.add(inv)
        else:
            inv.quantity_on_hand = payload.stock_on_hand

    db.commit()
    db.refresh(product)

    return {
        "id": str(product.id),
        "sku": product.sku,
        "name": product.name,
        "is_active": product.is_active,
        "message": f"Product '{product.name}' updated successfully.",
    }


@router.post("/{product_id}/toggle-status")
def toggle_product_status(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DISTRIBUTOR_ADMIN")),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    product.is_active = not product.is_active
    db.commit()
    db.refresh(product)

    status_str = "activated" if product.is_active else "disabled"
    return {
        "id": str(product.id),
        "is_active": product.is_active,
        "message": f"Product '{product.name}' has been {status_str}.",
    }
