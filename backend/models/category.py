"""商品分类模型 categories（支持父子级：手机 -> iPhone）"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, comment="分类名称")
    parent_id = Column(Integer, default=0, comment="父分类id，0为一级分类")
    sort = Column(Integer, default=0, comment="排序")
    description = Column(String(255), default="")
    status = Column(Integer, default=1, comment="1启用 0停用")
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self, children=None):
        data = {
            "id": self.id,
            "name": self.name,
            "parent_id": self.parent_id,
            "sort": self.sort,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
        }
        if children is not None:
            data["children"] = children
        return data
