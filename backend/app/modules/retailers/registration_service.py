import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.credit.models import CreditAccount
from app.modules.retailers.models import Retailer, RetailerUser
from app.modules.users.models import User


def register_retailer(db: Session, identity: dict, payload) -> dict:
    email = identity["email"].strip().lower()
    firebase_uid = identity["firebase_uid"]
    normalized_shop_name = payload.shop_name.strip()
    normalized_phone = payload.phone.strip()
    normalized_pincode = payload.pincode.strip()

    with db.begin():
        existing_user = db.scalar(
            select(User).where(
                (User.firebase_uid == firebase_uid)
                | (func.lower(User.email) == email)
            )
        )
        if existing_user:
            raise ValueError("A user is already registered for this Firebase identity.")

        duplicate_exists = db.scalar(
            select(Retailer.id).where(
                func.lower(Retailer.shop_name) == normalized_shop_name.lower(),
                func.lower(Retailer.city) == payload.city.strip().lower(),
            )
        ) is not None

        user = User(
            firebase_uid=firebase_uid,
            email=email,
            phone=normalized_phone,
            role="RETAILER",
            is_active=True,
        )
        retailer = Retailer(
            retailer_code=f"RET-{uuid.uuid4().hex[:10].upper()}",
            shop_name=normalized_shop_name,
            owner_name=payload.owner_name.strip(),
            phone=normalized_phone,
            address=payload.address.strip(),
            city=payload.city.strip(),
            state=payload.state.strip(),
            pincode=normalized_pincode,
            registration_status="PENDING_REVIEW",
            duplicate_flag=duplicate_exists,
            is_active=True,
        )
        db.add_all([user, retailer])
        db.flush()

        db.add(RetailerUser(retailer_id=retailer.id, user_id=user.id))
        credit_account = CreditAccount(retailer_id=retailer.id, credit_limit=0, current_outstanding=0)
        db.add(credit_account)
        db.flush()

        return {
            "retailer_id": str(retailer.id),
            "retailer_code": retailer.retailer_code,
            "shop_name": retailer.shop_name,
            "registration_status": retailer.registration_status,
            "credit_limit": float(credit_account.credit_limit),
            "can_place_orders": True,
            "duplicate_flag": retailer.duplicate_flag,
        }
