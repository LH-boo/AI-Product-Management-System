"""订单模型 orders / order_items"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text

from database import Base

# 订单状态机：待付款 → 已付款 → 待发货 → 已发货 → 已完成（可取消）
ORDER_STATUS = {
    "pending": "待付款",
    "paid": "已付款",
    "to_ship": "待发货",
    "shipped": "已发货",
    "completed": "已完成",
    "cancelled": "已取消",
}

# 允许的状态流转关系
ORDER_STATUS_FLOW = {
    "pending": ["paid", "cancelled"],
    "paid": ["to_ship", "cancelled"],
    "to_ship": ["shipped", "cancelled"],
    "shipped": ["completed"],
    "completed": [],
    "cancelled": [],
}


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_no = Column(String(32), unique=True, nullable=False, comment="订单号")
    customer_id = Column(Integer, default=0, comment="客户id")
    customer_name = Column(String(50), default="", comment="下单人")
    total_amount = Column(Numeric(12, 2), default=0, comment="订单总额")
    status = Column(String(20), default="pending", comment="订单状态")
    remark = Column(Text, comment="备注")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def to_dict(self, items=None):
        return {
            "id": self.id,
            "order_no": self.order_no,
            "customer_id": self.customer_id,
            "customer_name": self.customer_name,
            "total_amount": float(self.total_amount or 0),
            "status": self.status,
            "status_text": ORDER_STATUS.get(self.status, self.status),
            "remark": self.remark or "",
            "items": items if items is not None else [],
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else None,
        }


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, nullable=False, comment="订单id")
    product_id = Column(Integer, nullable=False, comment="商品id")
    product_name = Column(String(120), default="", comment="商品名称快照")
    price = Column(Numeric(10, 2), default=0, comment="成交单价")
    quantity = Column(Integer, default=1, comment="数量")
    subtotal = Column(Numeric(12, 2), default=0, comment="小计")

    def to_dict(self):
        return {
            "id": self.id,
            "order_id": self.order_id,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "price": float(self.price or 0),
            "quantity": self.quantity,
            "subtotal": float(self.subtotal or 0),
        }
