from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.pricing.default_price_models import DistributorProductPrice
from app.modules.products.models import Brand, Product, ProductAlias
from app.modules.ai_assistant.matcher import BUILTIN_CATALOGUE_ALIASES


CATALOGUE = [
    ("FreshFarm", "FRESHFARM", "FF-RICE-001", "FreshFarm Premium Rice", "Staples", "5", "kg", 4, "1006", "5", "420"),
    ("FreshFarm", "FRESHFARM", "FF-WHEAT-001", "FreshFarm Wheat Flour", "Staples", "5", "kg", 4, "1101", "5", "260"),
    ("FreshFarm", "FRESHFARM", "FF-DAL-001", "FreshFarm Toor Dal", "Pulses", "1", "kg", 20, "0713", "5", "155"),
    ("FreshFarm", "FRESHFARM", "FF-SALT-001", "FreshFarm Iodised Salt", "Staples", "1", "kg", 30, "2501", "5", "24"),
    ("FreshFarm", "FRESHFARM", "FF-POHA-001", "FreshFarm Poha", "Breakfast", "1", "kg", 20, "1904", "5", "68"),
    ("DailyDrop", "DAILYDROP", "DD-OIL-001", "DailyDrop Refined Sunflower Oil", "Cooking Oil", "1", "L", 12, "1512", "5", "145"),
    ("DailyDrop", "DAILYDROP", "DD-SUGAR-001", "DailyDrop Sugar", "Staples", "1", "kg", 20, "1701", "5", "48"),
    ("DailyDrop", "DAILYDROP", "DD-TEA-001", "DailyDrop Assam Tea", "Beverages", "250", "g", 40, "0902", "5", "118"),
    ("DailyDrop", "DAILYDROP", "DD-COFFEE-001", "DailyDrop Instant Coffee", "Beverages", "100", "g", 30, "0901", "5", "165"),
    ("DailyDrop", "DAILYDROP", "DD-BISCUIT-001", "DailyDrop Glucose Biscuits", "Snacks", "100", "g", 48, "1905", "18", "22"),
    ("HomeBright", "HOMEBRIGHT", "HB-DISH-001", "HomeBright Dishwash Liquid", "Home Care", "500", "ml", 24, "3402", "18", "82"),
    ("HomeBright", "HOMEBRIGHT", "HB-DETERGENT-001", "HomeBright Laundry Powder", "Home Care", "1", "kg", 12, "3402", "18", "125"),
    ("HomeBright", "HOMEBRIGHT", "HB-SOAP-001", "HomeBright Bath Soap", "Personal Care", "100", "g", 72, "3401", "18", "32"),
    ("HomeBright", "HOMEBRIGHT", "HB-FLOOR-001", "HomeBright Floor Cleaner", "Home Care", "1", "L", 12, "3402", "18", "135"),
    ("HomeBright", "HOMEBRIGHT", "HB-TISSUE-001", "HomeBright Kitchen Towels", "Home Care", "1", "pack", 24, "4818", "18", "78"),
    ("SpiceRoute", "SPICEROUTE", "SR-CHILLI-001", "SpiceRoute Red Chilli Powder", "Spices", "200", "g", 48, "0904", "5", "72"),
    ("SpiceRoute", "SPICEROUTE", "SR-TURMERIC-001", "SpiceRoute Turmeric Powder", "Spices", "200", "g", 48, "0910", "5", "58"),
    ("SpiceRoute", "SPICEROUTE", "SR-CUMIN-001", "SpiceRoute Cumin Seeds", "Spices", "100", "g", 60, "0909", "5", "64"),
    ("SpiceRoute", "SPICEROUTE", "SR-GARAM-001", "SpiceRoute Garam Masala", "Spices", "100", "g", 60, "0910", "5", "88"),
    ("SpiceRoute", "SPICEROUTE", "SR-CORIANDER-001", "SpiceRoute Coriander Powder", "Spices", "200", "g", 48, "0909", "5", "62"),

    # Tea - multiple companies, blends, and pack sizes for realistic FMCG ordering.
    ("RedLeaf", "REDLEAF", "RL-TEA-001", "RedLeaf Strong Assam Tea", "Beverages", "250", "g", 40, "0902", "5", "132"),
    ("RedLeaf", "REDLEAF", "RL-TEA-002", "RedLeaf Strong Assam Tea", "Beverages", "500", "g", 24, "0902", "5", "248"),
    ("ChaiBrew", "CHAIBREW", "CB-TEA-001", "ChaiBrew Premium Leaf Tea", "Beverages", "250", "g", 40, "0902", "5", "145"),
    ("ChaiBrew", "CHAIBREW", "CB-TEA-002", "ChaiBrew Premium Leaf Tea", "Beverages", "1", "kg", 12, "0902", "5", "520"),
    ("MountainCup", "MOUNTAINCUP", "MC-TEA-001", "MountainCup Darjeeling Tea", "Beverages", "100", "g", 60, "0902", "5", "92"),
    ("MountainCup", "MOUNTAINCUP", "MC-TEA-002", "MountainCup Darjeeling Tea", "Beverages", "250", "g", 40, "0902", "5", "205"),
    ("TeaGarden", "TEAGARDEN", "TG-TEA-001", "TeaGarden Ginger Masala Tea", "Beverages", "100", "g", 60, "0902", "5", "78"),
    ("TeaGarden", "TEAGARDEN", "TG-TEA-002", "TeaGarden Ginger Masala Tea", "Beverages", "250", "g", 40, "0902", "5", "175"),
    ("RoyalChai", "ROYALCHAI", "RC-TEA-001", "RoyalChai Cardamom Tea", "Beverages", "100", "g", 60, "0902", "5", "88"),
    ("RoyalChai", "ROYALCHAI", "RC-TEA-002", "RoyalChai Cardamom Tea", "Beverages", "250", "g", 40, "0902", "5", "198"),
    ("NilgiriGold", "NILGIRIGOLD", "NG-TEA-001", "NilgiriGold Premium Tea", "Beverages", "250", "g", 40, "0902", "5", "155"),
    ("NilgiriGold", "NILGIRIGOLD", "NG-TEA-002", "NilgiriGold Premium Tea", "Beverages", "500", "g", 24, "0902", "5", "295"),

    # Additional fast-moving kirana products.
    ("DailyDrop", "DAILYDROP", "DD-GHEE-001", "DailyDrop Cow Ghee", "Cooking Oil", "1", "L", 12, "0405", "5", "610"),
    ("DailyDrop", "DAILYDROP", "DD-BESAN-001", "DailyDrop Besan", "Pulses", "500", "g", 24, "1106", "5", "68"),
    ("SnackJoy", "SNACKJOY", "SJ-BISCUIT-001", "SnackJoy Cream Biscuits", "Snacks", "120", "g", 48, "1905", "18", "30"),
    ("SnackJoy", "SNACKJOY", "SJ-NAMKEEN-001", "SnackJoy Aloo Bhujia", "Snacks", "200", "g", 36, "1905", "12", "58"),
    ("QuickBite", "QUICKBITE", "QB-NOODLES-001", "QuickBite Masala Noodles", "Instant Food", "70", "g", 72, "1902", "12", "16"),
    ("QuickBite", "QUICKBITE", "QB-NOODLES-002", "QuickBite Masala Noodles Family Pack", "Instant Food", "280", "g", 24, "1902", "12", "58"),
    ("CarePlus", "CAREPLUS", "CP-TOOTHPASTE-001", "CarePlus Fresh Mint Toothpaste", "Personal Care", "100", "g", 72, "3306", "18", "92"),
    ("CarePlus", "CAREPLUS", "CP-SHAMPOO-001", "CarePlus Daily Care Shampoo", "Personal Care", "180", "ml", 48, "3305", "18", "145"),
    ("HomeBright", "HOMEBRIGHT", "HB-HANDWASH-001", "HomeBright Hand Wash", "Personal Care", "250", "ml", 48, "3401", "18", "72"),
]


def seed_catalogue() -> int:
    inserted = 0
    now = datetime.now(timezone.utc)

    with SessionLocal() as db, db.begin():
        for (
            brand_name,
            brand_code,
            sku,
            name,
            category,
            pack_size,
            pack_unit,
            units_per_case,
            hsn_code,
            gst_rate,
            price,
        ) in CATALOGUE:
            brand = db.scalar(select(Brand).where(Brand.code == brand_code))
            if brand is None:
                brand = Brand(name=brand_name, code=brand_code, is_active=True)
                db.add(brand)
                db.flush()

            product = db.scalar(select(Product).where(Product.sku == sku))
            if product is None:
                product = Product(
                    brand_id=brand.id,
                    sku=sku,
                    name=name,
                    category=category,
                    pack_size=Decimal(pack_size),
                    pack_unit=pack_unit,
                    units_per_case=units_per_case,
                    hsn_code=hsn_code,
                    gst_rate=Decimal(gst_rate),
                    is_active=True,
                )
                db.add(product)
                db.flush()
                inserted += 1

            active_price = db.scalar(
                select(DistributorProductPrice.id).where(
                    DistributorProductPrice.product_id == product.id,
                    DistributorProductPrice.valid_from <= now,
                    DistributorProductPrice.valid_to.is_(None),
                )
            )
            if active_price is None:
                db.add(
                    DistributorProductPrice(
                        product_id=product.id,
                        price=Decimal(price),
                        gst_included=True,
                        valid_from=now,
                    )
                )

            aliases = BUILTIN_CATALOGUE_ALIASES.get(sku, [])
            for al in aliases:
                existing_al = db.scalar(
                    select(ProductAlias.id).where(
                        ProductAlias.product_id == product.id,
                        ProductAlias.normalized_alias == al.lower(),
                    )
                )
                if not existing_al:
                    db.add(
                        ProductAlias(
                            product_id=product.id,
                            alias=al,
                            normalized_alias=al.lower(),
                            language="hi" if any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in al) else "en",
                        )
                    )

    return inserted


if __name__ == "__main__":
    print(f"Catalogue seed complete. Products inserted: {seed_catalogue()}")
