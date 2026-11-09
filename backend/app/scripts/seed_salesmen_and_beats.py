import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import secrets
import hashlib

from app.db.session import SessionLocal
from app.modules.credit.models import CreditAccount
from app.modules.orders.models import Order, OrderItem, OrderStatusHistory
from app.modules.products.models import Product
from app.modules.schemes.models import Scheme, SchemeRule
from app.modules.retailers.models import Retailer, RetailerAssignment
from app.modules.users.models import StaffInvitation, User


def seed_salesmen_and_beats():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # 1. Real Salesmen
        salesmen_data = [
            {
                "email": "rajesh.sales@orderly.in",
                "phone": "9827011001",
                "role": "SALESMAN",
            },
            {
                "email": "sunil.sales@orderly.in",
                "phone": "9827022002",
                "role": "SALESMAN",
            },
            {
                "email": "amit.sales@orderly.in",
                "phone": "9827033003",
                "role": "SALESMAN",
            },
        ]

        salesmen_users = {}
        for s in salesmen_data:
            existing = db.query(User).filter(User.email == s["email"]).first()
            if not existing:
                u = User(
                    id=uuid.uuid4(),
                    firebase_uid=f"fb_salesman_{uuid.uuid4().hex[:12]}",
                    email=s["email"],
                    phone=s["phone"],
                    role=s["role"],
                    is_active=True,
                )
                db.add(u)
                db.flush()
                salesmen_users[s["email"]] = u
                print(f"Created salesman: {u.email}")
            else:
                existing.phone = s["phone"]
                existing.role = "SALESMAN"
                existing.is_active = True
                salesmen_users[s["email"]] = existing
                print(f"Salesman exists: {existing.email}")

        # 2. Real Jabalpur Kirana Retailers
        kiranas = [
            {
                "code": "RET-JBP-01",
                "name": "Shree Mahavir Kirana Stores",
                "owner": "Rajendra Jain",
                "phone": "9827011223",
                "address": "Shop 4, Wright Town Main Market",
                "city": "Jabalpur",
                "limit": Decimal("50000.00"),
            },
            {
                "code": "RET-JBP-02",
                "name": "Gupta Provision & General Mart",
                "owner": "Ramesh Gupta",
                "phone": "9827022334",
                "address": "12 Napier Town, Near Fourth Bridge",
                "city": "Jabalpur",
                "limit": Decimal("75000.00"),
            },
            {
                "code": "RET-JBP-03",
                "name": "Patel Brothers Daily Needs",
                "owner": "Dinesh Patel",
                "phone": "9827033445",
                "address": "Main Road, Gorakhpur",
                "city": "Jabalpur",
                "limit": Decimal("60000.00"),
            },
            {
                "code": "RET-JBP-04",
                "name": "Jabalpur Wholesale Traders",
                "owner": "Ashok Agrawal",
                "phone": "9827044556",
                "address": "Sadar Bazaar Cantt",
                "city": "Jabalpur",
                "limit": Decimal("100000.00"),
            },
            {
                "code": "RET-JBP-05",
                "name": "Sharma Ji Kirana Ghar",
                "owner": "Manoj Sharma",
                "phone": "9827055667",
                "address": "Lordganj Chowk",
                "city": "Jabalpur",
                "limit": Decimal("40000.00"),
            },
            {
                "code": "RET-JBP-06",
                "name": "Agrawal FMCG Super Store",
                "owner": "Vikas Agrawal",
                "phone": "9827066778",
                "address": "Ganjipura Cloth Market",
                "city": "Jabalpur",
                "limit": Decimal("80000.00"),
            },
        ]

        ret_objects = []
        for k in kiranas:
            ret = db.query(Retailer).filter(Retailer.retailer_code == k["code"]).first()
            if not ret:
                ret = Retailer(
                    id=uuid.uuid4(),
                    retailer_code=k["code"],
                    shop_name=k["name"],
                    owner_name=k["owner"],
                    phone=k["phone"],
                    address=k["address"],
                    city=k["city"],
                    state="MP",
                    pincode="482002",
                    registration_status="ACTIVE",
                    is_active=True,
                )
                db.add(ret)
                db.flush()
                print(f"Created Kirana: {ret.shop_name}")

                # Create credit account
                cred = CreditAccount(
                    id=uuid.uuid4(),
                    retailer_id=ret.id,
                    credit_limit=k["limit"],
                    current_outstanding=Decimal("0.00"),
                    payment_terms_days=14,
                )
                db.add(cred)
            ret_objects.append(ret)

        # 3. Beat Retailer Assignments
        # Rajesh -> Stores 0, 1
        # Sunil -> Stores 2, 3
        # Amit -> Stores 4, 5
        rajesh = salesmen_users["rajesh.sales@orderly.in"]
        sunil = salesmen_users["sunil.sales@orderly.in"]
        amit = salesmen_users["amit.sales@orderly.in"]

        assignments_to_create = [
            (rajesh.id, ret_objects[0].id),
            (rajesh.id, ret_objects[1].id),
            (sunil.id, ret_objects[2].id),
            (sunil.id, ret_objects[3].id),
            (amit.id, ret_objects[4].id),
            (amit.id, ret_objects[5].id),
        ]

        for s_id, r_id in assignments_to_create:
            existing_assign = db.query(RetailerAssignment).filter(
                RetailerAssignment.salesman_id == s_id,
                RetailerAssignment.retailer_id == r_id,
            ).first()
            if not existing_assign:
                assign = RetailerAssignment(
                    id=uuid.uuid4(),
                    salesman_id=s_id,
                    retailer_id=r_id,
                )
                db.add(assign)
                print(f"Created assignment for salesman {s_id} -> retailer {r_id}")

        # 4. Beat Orders per Salesman
        # Fetch some products for line items
        products = db.query(Product).filter(Product.is_active.is_(True)).limit(5).all()

        orders_to_create = [
            # Rajesh Orders
            {
                "salesman": rajesh,
                "retailer": ret_objects[0],
                "order_num": "ORD-SALES-JBP-01",
                "amount": Decimal("14250.00"),
                "status": "APPROVED",
            },
            {
                "salesman": rajesh,
                "retailer": ret_objects[1],
                "order_num": "ORD-SALES-JBP-02",
                "amount": Decimal("22800.00"),
                "status": "DISPATCHED",
            },
            # Sunil Orders
            {
                "salesman": sunil,
                "retailer": ret_objects[2],
                "order_num": "ORD-SALES-JBP-03",
                "amount": Decimal("18600.00"),
                "status": "APPROVED",
            },
            {
                "salesman": sunil,
                "retailer": ret_objects[3],
                "order_num": "ORD-SALES-JBP-04",
                "amount": Decimal("31400.00"),
                "status": "SUBMITTED",
            },
            # Amit Orders
            {
                "salesman": amit,
                "retailer": ret_objects[4],
                "order_num": "ORD-SALES-JBP-05",
                "amount": Decimal("9800.00"),
                "status": "APPROVED",
            },
            {
                "salesman": amit,
                "retailer": ret_objects[5],
                "order_num": "ORD-SALES-JBP-06",
                "amount": Decimal("16500.00"),
                "status": "ON_HOLD",
            },
        ]

        for ord_data in orders_to_create:
            existing_ord = db.query(Order).filter(Order.order_number == ord_data["order_num"]).first()
            if not existing_ord:
                order = Order(
                    id=uuid.uuid4(),
                    order_number=ord_data["order_num"],
                    retailer_id=ord_data["retailer"].id,
                    status=ord_data["status"],
                    total_amount=ord_data["amount"],
                    source="SALESMAN",
                    created_by=ord_data["salesman"].id,
                    customer_note="Booked during field beat visit",
                    created_at=now - timedelta(days=secrets.randbelow(5)),
                    submitted_at=now,
                )
                db.add(order)
                db.flush()

                # Add 2 order items
                if len(products) >= 2:
                    p1 = products[0]
                    p2 = products[1]
                    db.add(OrderItem(
                        id=uuid.uuid4(),
                        order_id=order.id,
                        product_id=p1.id,
                        product_name=p1.name,
                        sku=p1.sku,
                        quantity=Decimal("5"),
                        quantity_unit="CASE",
                        free_quantity=Decimal("0"),
                        unit_price=Decimal("1200.00"),
                        discount_amount=Decimal("0.00"),
                        tax_amount=Decimal("300.00"),
                        line_total=Decimal("6300.00"),
                    ))
                    db.add(OrderItem(
                        id=uuid.uuid4(),
                        order_id=order.id,
                        product_id=p2.id,
                        product_name=p2.name,
                        sku=p2.sku,
                        quantity=Decimal("8"),
                        quantity_unit="CASE",
                        free_quantity=Decimal("1"),
                        unit_price=Decimal("950.00"),
                        discount_amount=Decimal("200.00"),
                        tax_amount=Decimal("450.00"),
                        line_total=Decimal("7950.00"),
                    ))
                print(f"Created beat order: {order.order_number}")

        # 5. Pending Staff Invitation
        dist_admin = db.query(User).filter(User.role == "DISTRIBUTOR_ADMIN").first()
        invited_by_id = dist_admin.id if dist_admin else None

        existing_inv = db.query(StaffInvitation).filter(StaffInvitation.email == "vikram.field@orderly.in").first()
        if not existing_inv:
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            inv = StaffInvitation(
                id=uuid.uuid4(),
                email="vikram.field@orderly.in",
                role="SALESMAN",
                token_hash=token_hash,
                expires_at=now + timedelta(days=6),
                invited_by=invited_by_id,
            )
            db.add(inv)
            print("Created sample pending invitation: vikram.field@orderly.in")

        db.commit()
        print("Successfully seeded real salesmen, retailers, beat assignments, and orders!")
    except Exception as e:
        db.rollback()
        print("Error during seed:", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_salesmen_and_beats()
