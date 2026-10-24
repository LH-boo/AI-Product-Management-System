"""客户模型 customers"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Numeric, String

from database import Base

CUSTOMER_LEVEL = {"normal": "普通客户", "vip": "VIP客户", "svip": "SVIP客户"}


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, comment="客户姓名")
    phone = Column(String(20), default="", comment="手机号")
    email = Column(String(100), default="")
    level = Column(String(20), default="normal", comment="客户等级")
    total_orders = Column(Integer, default=0, comment="消费次数")
    total_amount = Column(Numeric(12, 2), default=0, comment="累计消费金额")
    last_order_time = Column(DateTime, comment="最近购买时间")
    status = Column(Integer, default=1, comment="1正常 0流失")
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "level": self.level,
            "level_text": CUSTOMER_LEVEL.get(self.level, self.level),
            "total_orders": self.total_orders,
            "total_amount": float(self.total_amount or 0),
            "last_order_time": self.last_order_time.strftime("%Y-%m-%d %H:%M:%S") if self.last_order_time else None,
            "status": self.status,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
        }
