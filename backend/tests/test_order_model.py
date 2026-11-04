from sqlalchemy import DateTime

from app.modules.orders.models import Order


def test_order_dispatched_at_is_optional_timestamp():
    column = Order.__table__.c.dispatched_at

    assert isinstance(column.type, DateTime)
    assert column.nullable
