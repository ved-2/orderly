from decimal import Decimal

from sqlalchemy import select

from app.db.models import User  # noqa: F401 - registers the users foreign-key target
from app.db.session import SessionLocal
from app.modules.inventory.models import (
    Inventory,
    InventoryTransaction,
    Warehouse,
)
from app.modules.products.models import Product


WAREHOUSE_CODE = "JBP-MAIN"
PRODUCT_OPENING_STOCK = Decimal("500")


def seed_inventory() -> int:
    seeded = 0

    with SessionLocal() as db, db.begin():
        warehouse = db.scalar(
            select(Warehouse).where(Warehouse.code == WAREHOUSE_CODE)
        )
        if warehouse is None:
            warehouse = Warehouse(
                code=WAREHOUSE_CODE,
                name="Orderly Main Distribution Warehouse",
                city="Jabalpur",
                is_active=True,
            )
            db.add(warehouse)
            db.flush()

        products = db.scalars(select(Product)).all()
        for product in products:
            inventory = db.scalar(
                select(Inventory).where(
                    Inventory.warehouse_id == warehouse.id,
                    Inventory.product_id == product.id,
                )
            )
            if inventory is not None:
                continue

            db.add(
                Inventory(
                    warehouse_id=warehouse.id,
                    product_id=product.id,
                    quantity_on_hand=PRODUCT_OPENING_STOCK,
                    quantity_reserved=Decimal("0"),
                )
            )
            db.add(
                InventoryTransaction(
                    warehouse_id=warehouse.id,
                    product_id=product.id,
                    movement_type="opening_stock",
                    quantity_delta=PRODUCT_OPENING_STOCK,
                    reference_type="seed",
                    note="Initial warehouse stock seed",
                )
            )
            seeded += 1

    return seeded


if __name__ == "__main__":
    print(f"Inventory seed complete. Products seeded: {seed_inventory()}")
