"""系统日志业务逻辑"""
from typing import List

from sqlalchemy.orm import Session

from models.system_log import SystemLog


def list_logs(db: Session, limit: int = 100) -> List[dict]:
    """系统运行日志：按时间倒序返回，最新的在最前"""
    rows = (
        db.query(SystemLog)
        .order_by(SystemLog.created_at.desc(), SystemLog.id.desc())
        .limit(limit)
        .all()
    )
    return [row.to_dict() for row in rows]
