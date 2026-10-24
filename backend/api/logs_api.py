"""系统日志接口 /api/logs"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from services import log_service
from utils.response import fail, ok

router = APIRouter(prefix="/api/logs", tags=["系统日志"])


@router.get("")
def list_logs(
    limit: int = Query(100, ge=1, le=500, description="返回条数"),
    db: Session = Depends(get_db),
):
    """系统运行日志列表（倒序）。Agent 调用日志请使用 /api/ai/trace"""
    try:
        return ok(log_service.list_logs(db, limit))
    except Exception as exc:
        return fail(f"查询系统日志失败：{exc}")
