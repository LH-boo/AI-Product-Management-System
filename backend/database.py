"""
MySQL 数据库连接
使用 SQLAlchemy 管理连接池与 ORM 会话。
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings

# echo=True 会在控制台打印 SQL，调试时打开很方便
engine = create_engine(
    settings.DB_URL,
    echo=False,
    pool_pre_ping=True,   # 连接前先 ping 一下，避免 MySQL 8 小时断连
    pool_recycle=3600,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类"""
    pass


def get_db():
    """FastAPI 依赖注入：每个请求一个独立 session，请求结束自动关闭"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """根据模型自动建表（已存在的表不会被修改）"""
    # 导入所有模型，确保它们都注册到了 Base.metadata 上
    from models import (  # noqa: F401
        agent_log,
        category,
        chat_history,
        customer,
        inventory,
        knowledge_document,
        order,
        product,
        system_log,
        user,
    )

    Base.metadata.create_all(bind=engine)
