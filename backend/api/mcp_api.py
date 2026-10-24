"""MCP 工具接口 /api/ai/mcp"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from agent import agent_tools
from utils.response import fail, ok

# 注意：本 router 由 ai_api（prefix="/api/ai"）挂载，
# 因此这里只写相对前缀，最终路径为 /api/ai/mcp/...
router = APIRouter(prefix="/mcp", tags=["MCP工具"])


class ToolCallIn(BaseModel):
    """工具调用入参"""
    tool_name: str
    arguments: dict = Field(default_factory=dict)


@router.get("/tools")
def list_tools():
    """MCP 工具清单：[{name, description, parameters}]"""
    try:
        return ok(agent_tools.list_tools())
    except Exception as exc:
        return fail(f"获取工具清单失败：{exc}")


@router.post("/call")
def call_tool(payload: ToolCallIn):
    """直接调用 MCP 工具（本地调用，便于调试）"""
    if not payload.tool_name or not payload.tool_name.strip():
        return fail("工具名不能为空")
    arguments = payload.arguments or {}
    result = agent_tools.call_tool(payload.tool_name, arguments)
    return ok({"tool": payload.tool_name, "arguments": arguments, "result": result})
