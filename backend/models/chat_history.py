"""AI 会话历史 chat_history"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from database import Base


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), default="default", comment="会话id")
    user_id = Column(Integer, default=0)
    question = Column(Text, comment="用户问题")
    answer = Column(Text, comment="AI回答")
    source = Column(String(20), default="chat", comment="来源 chat/rag/agent")
    refs = Column(Text, comment="引用的知识库文档，逗号分隔")
    elapsed_ms = Column(Integer, default=0, comment="耗时毫秒")
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "question": self.question,
            "answer": self.answer,
            "source": self.source,
            "refs": self.refs or "",
            "elapsed_ms": self.elapsed_ms,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
        }
