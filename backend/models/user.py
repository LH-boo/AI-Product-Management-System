"""系统用户模型 users"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, comment="登录名")
    password = Column(String(128), nullable=False, comment="密码(sha256)")
    nickname = Column(String(50), default="", comment="昵称")
    role = Column(String(20), default="admin", comment="角色 admin/user")
    phone = Column(String(20), default="")
    email = Column(String(100), default="")
    status = Column(Integer, default=1, comment="1正常 0禁用")
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "nickname": self.nickname,
            "role": self.role,
            "phone": self.phone,
            "email": self.email,
            "status": self.status,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
        }
