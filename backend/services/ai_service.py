"""
AI 中心业务逻辑

- chat_with_ai：普通问答（先 RAG 检索，命中知识库则基于资料回答，未命中则直接用大模型回答）
- get_chat_history：会话历史
- get_trace：Agent 调用链（agent_logs，倒序）
"""
import logging
import time
from typing import List, Optional

from sqlalchemy.orm import Session

from database import SessionLocal
from models.agent_log import AgentLog
from models.chat_history import ChatHistory
from rag import rag_search
from utils.llm import chat

logger = logging.getLogger("services.ai")

# 未命中知识库时直接问答的系统提示词
DIRECT_SYSTEM_PROMPT = (
    "你是「AI智能商品管理系统」的智能助手，负责解答商品、库存、订单、售后等业务问题。"
    "回答要简洁、专业、条理清晰；如果问题涉及具体经营数据，建议用户在商品 Agent 中查看实时数据。"
)


def chat_with_ai(question: str, session_id: str = "default", db: Optional[Session] = None) -> dict:
    """普通问答：先 RAG 检索再回答，未命中知识库时退化为直接问大模型。"""
    started = time.time()
    text = (question or "").strip()
    session_id = session_id or "default"

    # 一次检索同时拿到「是否命中」与答案
    rag_result = rag_search.rag_answer(text)
    refs: List[str] = rag_result.get("refs") or []

    if refs:
        answer = rag_result["answer"]
    else:
        answer = _direct_answer(text)

    elapsed_ms = int((time.time() - started) * 1000)
    _save_history(db, session_id, text, answer, "chat", ",".join(refs), elapsed_ms)
    return {
        "answer": answer,
        "session_id": session_id,
        "refs": refs,
        "elapsed_ms": elapsed_ms,
    }


def _direct_answer(question: str) -> str:
    """知识库未命中时的兜底回答：优先直接问大模型，无 Key 时给出提示"""
    if not rag_search.has_llm_key():
        return (
            "（当前未配置可用的大模型 API Key）知识库中暂无相关信息，"
            "暂时无法直接回答该问题。你可以：\n"
            "1. 在「RAG知识库」页面上传相关资料并重建索引；\n"
            "2. 在 .env 中配置 LLM_API_KEY 后重启服务，即可启用大模型直答。"
        )
    try:
        return chat(
            [
                {"role": "system", "content": DIRECT_SYSTEM_PROMPT},
                {"role": "user", "content": question},
            ]
        )
    except Exception as exc:
        logger.warning("直接问答调用失败：%s", exc)
        return f"抱歉，智能问答暂时不可用：{exc}"


def get_chat_history(session_id: str = "default", limit: int = 20, db: Optional[Session] = None) -> List[dict]:
    """会话历史（按时间正序返回，便于前端直接渲染）"""
    own_session = db is None
    session = db or SessionLocal()
    try:
        rows = (
            session.query(ChatHistory)
            .filter(ChatHistory.session_id == (session_id or "default"))
            .order_by(ChatHistory.id.desc())
            .limit(int(limit or 20))
            .all()
        )
        return [row.to_dict() for row in reversed(rows)]
    finally:
        if own_session:
            session.close()


def get_trace(limit: int = 20, db: Optional[Session] = None) -> List[dict]:
    """Agent 调用链（倒序，最新的在最前）"""
    own_session = db is None
    session = db or SessionLocal()
    try:
        rows = (
            session.query(AgentLog)
            .order_by(AgentLog.id.desc())
            .limit(int(limit or 20))
            .all()
        )
        return [row.to_dict() for row in rows]
    finally:
        if own_session:
            session.close()


def _save_history(
    db: Optional[Session],
    session_id: str,
    question: str,
    answer: str,
    source: str,
    refs: str,
    elapsed_ms: int,
) -> None:
    """写入会话历史"""
    own_session = db is None
    session = db or SessionLocal()
    try:
        session.add(
            ChatHistory(
                session_id=session_id,
                question=question,
                answer=answer,
                source=source,
                refs=refs,
                elapsed_ms=elapsed_ms,
            )
        )
        session.commit()
    except Exception as exc:
        session.rollback()
        logger.warning("写入会话历史失败：%s", exc)
    finally:
        if own_session:
            session.close()
