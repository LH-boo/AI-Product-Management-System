"""
Agent 工具层

把 MCP 工具（backend/mcp/agentserver.py 的 TOOL_REGISTRY）整理成
OpenAI function-calling 需要的 tools schema，并提供两种调用方式：

- call_tool：直接调用本地工具函数（默认方式，无需起子进程，性能好）
- call_tool_via_mcp：通过真正的 MCP stdio 客户端调用（演示完整 MCP 链路）
"""
import asyncio
import inspect
import json
import logging
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List

from config import settings
from mcp.agentserver import TOOL_REGISTRY

logger = logging.getLogger("agent.tools")

# Python 类型 -> JSON Schema 类型
_TYPE_MAP = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


def _to_jsonable(value: Any) -> Any:
    """把查询结果递归转成可直接 JSON 序列化的结构（Decimal -> float）"""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, dict):
        return {str(key): _to_jsonable(val) for key, val in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(item) for item in value]
    return str(value)


def _param_schema(func) -> Dict[str, Any]:
    """根据函数签名生成 JSON Schema 参数定义"""
    properties: Dict[str, Any] = {}
    required: List[str] = []
    try:
        signature = inspect.signature(func)
    except (TypeError, ValueError):
        return {"type": "object", "properties": {}}

    for name, param in signature.parameters.items():
        if param.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
            continue
        json_type = "string"
        if isinstance(param.annotation, type):
            json_type = _TYPE_MAP.get(param.annotation, "string")
        properties[name] = {"type": json_type}
        if param.default is inspect.Parameter.empty:
            required.append(name)

    schema: Dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def _description(func) -> str:
    """取函数 docstring（第一行作为工具简介）"""
    return (inspect.getdoc(func) or "").strip()


def build_tools_schema() -> List[dict]:
    """生成 OpenAI function-calling 的 tools 参数"""
    tools = []
    for name, func in TOOL_REGISTRY.items():
        tools.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": _description(func),
                    "parameters": _param_schema(func),
                },
            }
        )
    return tools


def list_tools() -> List[dict]:
    """工具元信息列表（MCP 工具页面展示用）：[{name, description, parameters}]"""
    return [
        {"name": name, "description": _description(func), "parameters": _param_schema(func)}
        for name, func in TOOL_REGISTRY.items()
    ]


# 供 Agent 直接使用的 tools schema
TOOLS_SCHEMA = build_tools_schema()


def call_tool(name: str, arguments: Dict[str, Any] = None) -> Any:
    """本地直接调用工具（默认方式）。

    返回工具的原始结果（dict/list），出错时返回 {"error": "..."}，不抛异常。
    """
    func = TOOL_REGISTRY.get(name)
    if func is None:
        return {"error": f"未知工具：{name}"}
    params = arguments or {}
    if not isinstance(params, dict):
        return {"error": "工具参数必须是对象"}
    try:
        return _to_jsonable(func(**params))
    except TypeError as exc:
        return {"error": f"工具参数不匹配：{exc}"}
    except Exception as exc:  # 数据库异常等统一兜底，避免中断 Agent 流程
        logger.warning("工具 %s 执行失败：%s", name, exc)
        return {"error": f"工具执行失败：{exc}"}


# ==================== 真实 MCP 链路（stdio 客户端） ====================

def _import_mcp_client():
    """在屏蔽本地 mcp 包的环境中导入官方 mcp 客户端符号。

    本地目录 mcp 会遮蔽官方 mcp 包，这里借用 agentserver.third_party_mcp_env()
    临时摘除本地包后再导入，导入完成后立即恢复。
    """
    from mcp.agentserver import third_party_mcp_env

    with third_party_mcp_env():
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

    return ClientSession, StdioServerParameters, stdio_client


async def _call_via_mcp_async(name: str, arguments: Dict[str, Any], timeout: float) -> Any:
    ClientSession, StdioServerParameters, stdio_client = _import_mcp_client()

    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "mcp.agentserver"],
        cwd=str(Path(settings.BASE_DIR) / "backend"),
    )
    async with stdio_client(params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            result = await asyncio.wait_for(session.call_tool(name, arguments or {}), timeout=timeout)
            return _to_jsonable(_extract_mcp_result(result))


def _extract_mcp_result(result: Any) -> Any:
    """把 MCP CallToolResult 转成可序列化结果（优先取结构化内容）"""
    structured = getattr(result, "structuredContent", None)
    if structured is not None:
        return structured
    contents = getattr(result, "content", None) or []
    texts = []
    for item in contents:
        text = getattr(item, "text", None)
        if text is not None:
            texts.append(text)
    if len(texts) == 1:
        try:
            return json.loads(texts[0])
        except (TypeError, ValueError):
            return texts[0]
    return texts or None


def call_tool_via_mcp(name: str, arguments: Dict[str, Any] = None, timeout: float = 30.0) -> Any:
    """通过真正的 MCP stdio 客户端调用工具（演示完整 MCP 链路）。

    会以子进程方式启动 `python -m mcp.agentserver`，通过 stdio 协议通信。
    失败时返回 {"error": "..."}，方便与本地调用方式对比演示。
    """
    try:
        return asyncio.run(_call_via_mcp_async(name, arguments or {}, timeout))
    except Exception as exc:
        logger.warning("MCP stdio 调用失败：%s", exc)
        return {"error": f"MCP stdio 调用失败：{exc}"}
