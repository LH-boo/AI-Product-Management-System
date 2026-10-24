"""AI 中心接口 /api/ai（问答 / Agent 调用链 / 会话历史）"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services import ai_service
from utils.response import fail, ok

router = APIRouter(prefix="/api/ai", tags=["AI助手"])


class ChatIn(BaseModel):
    """普通问答入参"""
    question: str
    session_id: str = "default"


@router.post("/chat")
def chat(payload: ChatIn, db: Session = Depends(get_db)):
    """普通 AI 问答：先 RAG 检索，命中知识库基于资料回答，未命中则直接问大模型"""
    if not payload.question or not payload.question.strip():
        return fail("问题不能为空")
    try:
        data = ai_service.chat_with_ai(payload.question, payload.session_id, db)
    except Exception as exc:
        return fail(f"AI 问答失败：{exc}")
    return ok(data)


@router.get("/trace")
def trace(limit: int = Query(20, ge=1, le=200), db: Session = Depends(get_db)):
    """Agent 调用链（倒序，Agent调用链页面使用）"""
    try:
        return ok(ai_service.get_trace(limit, db))
    except Exception as exc:
        return fail(f"查询调用链失败：{exc}")


@router.get("/history")
def history(
    session_id: str = Query("default", description="会话id"),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """会话历史"""
    try:
        return ok(ai_service.get_chat_history(session_id, limit, db))
    except Exception as exc:
        return fail(f"查询会话历史失败：{exc}")


# ==================== 挂载其余 AI 子路由 ====================
# 放在文件末尾导入，避免循环 import；这样 main.py 只需 include ai_api.router
from api import agent_api, mcp_api, rag_api  # noqa: E402

router.include_router(rag_api.router)
router.include_router(agent_api.router)
router.include_router(mcp_api.router)
