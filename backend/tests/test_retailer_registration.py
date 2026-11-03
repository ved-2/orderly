
from unittest.mock import MagicMock

import pytest

from app.modules.retailers.schemas import RetailerRegistrationRequest
from app.modules.retailers.registration_service import register_retailer
from app.modules.users.models import User
from app.modules.retailers.models import (
    Retailer,
    RetailerUser,
)
from app.modules.credit.models import CreditAccount


@pytest.fixture
def registration_payload():
    return RetailerRegistrationRequest(
        shop_name="Shree Ganesh General Stores",
        owner_name="Rahul Sharma",
        phone="9876543210",
        address="Main Market Road",
        city="Jabalpur",
        state="Madhya Pradesh",
        pincode="482001",
    )


@pytest.fixture
def firebase_identity():
    return {
        "firebase_uid": "firebase-test-uid-123",
        "email": "rahul@example.com",
    }


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.begin.return_value.__enter__.return_value = None
    return db


def test_successful_retailer_registration(
    mock_db,
    firebase_identity,
    registration_payload,
):
    mock_db.scalar.side_effect = [None, None]

    result = register_retailer(
        db=mock_db,
        identity=firebase_identity,
        payload=registration_payload,
    )

    assert result["shop_name"] == "Shree Ganesh General Stores"
    assert result["registration_status"] == "PENDING_REVIEW"
    assert result["credit_limit"] == 0.0
    assert result["can_place_orders"] is True
    assert result["duplicate_flag"] is False

    created_user, created_retailer = mock_db.add_all.call_args.args[0]

    assert isinstance(created_user, User)
    assert created_user.firebase_uid == "firebase-test-uid-123"
    assert created_user.email == "rahul@example.com"
    assert created_user.role == "RETAILER"

    assert isinstance(created_retailer, Retailer)
    assert created_retailer.registration_status == "PENDING_REVIEW"

    created_objects = [
        call.args[0]
        for call in mock_db.add.call_args_list
    ]

    assert any(isinstance(obj, RetailerUser) for obj in created_objects)
    assert any(isinstance(obj, CreditAccount) for obj in created_objects)

    credit_account = next(
        obj for obj in created_objects
        if isinstance(obj, CreditAccount)
    )

    assert credit_account.credit_limit == 0
    assert credit_account.current_outstanding == 0


def test_existing_user_cannot_register_again(
    mock_db,
    firebase_identity,
    registration_payload,
):
    mock_db.scalar.return_value = MagicMock(spec=User)

    with pytest.raises(ValueError, match="already registered"):
        register_retailer(
            db=mock_db,
            identity=firebase_identity,
            payload=registration_payload,
        )

    mock_db.add_all.assert_not_called()


def test_duplicate_shop_is_flagged_for_review(
    mock_db,
    firebase_identity,
    registration_payload,
):
    mock_db.scalar.side_effect = [
        None,
        "existing-retailer-id",
    ]

    result = register_retailer(
        db=mock_db,
        identity=firebase_identity,
        payload=registration_payload,
    )

    assert result["duplicate_flag"] is True
    assert result["registration_status"] == "PENDING_REVIEW"
    assert result["can_place_orders"] is True
