"""库存模型 inventory（与商品 1:1）"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database import Base


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, unique=True, nullable=False, comment="商品id")
    current_stock = Column(Integer, default=0, comment="当前库存")
    safe_stock = Column(Integer, default=20, comment="安全库存(预警线)")
    max_stock = Column(Integer, default=1000, comment="库存上限")
    warehouse = Column(String(50), default="主仓库", comment="所在仓库")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def status(self) -> str:
        """库存状态：缺货 / 预警 / 正常 / 积压"""
        if self.current_stock <= 0:
            return "out_of_stock"
        if self.current_stock <= self.safe_stock:
            return "warning"
        if self.max_stock and self.current_stock >= self.max_stock:
            return "overstock"
        return "normal"

    def to_dict(self, product_name: str = "", sku: str = ""):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": product_name,
            "sku": sku,
            "current_stock": self.current_stock,
            "safe_stock": self.safe_stock,
            "max_stock": self.max_stock,
            "warehouse": self.warehouse,
            "status": self.status(),
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else None,
        }
