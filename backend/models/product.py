"""商品模型 products"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text

from database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False, comment="商品名称")
    sku = Column(String(50), default="", comment="商品编码")
    category_id = Column(Integer, default=0, comment="分类id")
    brand = Column(String(50), default="", comment="品牌")
    price = Column(Numeric(10, 2), default=0, comment="售价")
    cost = Column(Numeric(10, 2), default=0, comment="成本价")
    image = Column(String(255), default="", comment="主图地址")
    description = Column(Text, comment="商品描述")
    status = Column(Integer, default=1, comment="1上架 0下架")
    sales = Column(Integer, default=0, comment="累计销量")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def to_dict(self, category_name: str = "", stock: int = 0):
        return {
            "id": self.id,
            "name": self.name,
            "sku": self.sku,
            "category_id": self.category_id,
            "category": category_name,
            "brand": self.brand,
            "price": float(self.price or 0),
            "cost": float(self.cost or 0),
            "image": self.image,
            "description": self.description or "",
            "status": self.status,
            "sales": self.sales,
            "stock": stock,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else None,
        }
