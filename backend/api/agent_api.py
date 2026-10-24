"""商品 Agent 接口 /api/ai/agent"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from agent import agentclient
from database import get_db
from utils.response import fail, ok

# 注意：本 router 由 ai_api（prefix="/api/ai"）挂载，
# 因此这里只写相对前缀，最终路径为 /api/ai/agent/...
router = APIRouter(prefix="/agent", tags=["商品Agent"])


class AgentChatIn(BaseModel):
    """Agent 问答入参"""
    question: str
    session_id: str = "default"


@router.post("/chat")
def chat(payload: AgentChatIn, db: Session = Depends(get_db)):
    """商品 Agent 问答：自动选择并调用 MCP 工具查库后生成回答"""
    if not payload.question or not payload.question.strip():
        return fail("问题不能为空")
    try:
        data = agentclient.run_agent(payload.question, payload.session_id, db)
    except Exception as exc:
        return fail(f"Agent 执行失败：{exc}")
    return ok(data)
