from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.orders.schemas import OrderCreate


def test_valid_order_request():
    payload = OrderCreate(
        retailer_id=uuid4(),
        items=[
            {
                "product_id": str(uuid4()),
                "quantity": "10",
                "quantity_unit": "CASE",
            }
        ],
        idempotency_key="order-request-123456",
    )

    assert len(payload.items) == 1
    assert payload.items[0].quantity_unit == "CASE"


def test_invalid_quantity_unit():
    with pytest.raises(ValidationError):
        OrderCreate(
            retailer_id=uuid4(),
            items=[
                {
                    "product_id": str(uuid4()),
                    "quantity": "10",
                    "quantity_unit": "PALLET",
                }
            ],
            idempotency_key="order-request-123456",
        )


def test_zero_quantity_rejected():
    with pytest.raises(ValidationError):
        OrderCreate(
            retailer_id=uuid4(),
            items=[
                {
                    "product_id": str(uuid4()),
                    "quantity": "0",
                    "quantity_unit": "CASE",
                }
            ],
            idempotency_key="order-request-123456",
        )


def test_empty_order_rejected():
    with pytest.raises(ValidationError):
        OrderCreate(
            retailer_id=uuid4(),
            items=[],
            idempotency_key="order-request-123456",
        )