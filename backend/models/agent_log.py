"""Agent 调用链日志 agent_logs（“Agent调用链”页面的数据来源）"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from database import Base


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), default="default")
    question = Column(Text, comment="用户问题")
    agent = Column(String(50), default="ProductAgent", comment="Agent名称")
    tool_name = Column(String(80), default="", comment="调用的工具")
    tool_params = Column(Text, comment="工具入参 JSON")
    tool_result = Column(Text, comment="工具返回结果")
    answer = Column(Text, comment="最终回答")
    status = Column(String(20), default="success", comment="success/failed")
    elapsed_ms = Column(Integer, default=0, comment="执行耗时毫秒")
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "question": self.question,
            "agent": self.agent,
            "tool_name": self.tool_name,
            "tool_params": self.tool_params or "",
            "tool_result": self.tool_result or "",
            "answer": self.answer,
            "status": self.status,
            "elapsed_ms": self.elapsed_ms,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
        }
