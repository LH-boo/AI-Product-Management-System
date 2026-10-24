"""
商品 Agent Client

run_agent(question, session_id, db) 的执行流程：
1. 组装 messages（system + user）；
2. 有可用 LLM Key 时走 OpenAI function calling（最多 5 轮工具调用）；
   没有 Key 时降级为关键词规则匹配 + 直接查库，保证全流程可跑通；
3. 把用户问题 / agent名 / tool_name / tool_params / tool_result / answer / status / elapsed_ms
   写入 agent_logs 表；
4. 返回 {answer, tool_calls, elapsed_ms, session_id, agent}。
"""
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from agent.agent_prompt import SYSTEM_PROMPT
from agent.agent_tools import TOOLS_SCHEMA, call_tool
from config import settings
from database import SessionLocal
from models.agent_log import AgentLog
from utils.llm import get_llm_client

logger = logging.getLogger("agent.client")

AGENT_NAME = "ProductAgent"
MAX_ROUNDS = 5

# 关键词规则 -> 工具（无 LLM Key 时的降级路由），顺序即优先级
_KEYWORD_RULES = [
    (("库存", "缺货", "补货", "预警", "存货", "断货"), "get_low_stock_products"),
    (("热销", "排行", "卖得最好", "最好卖", "top", "爆款"), "get_top_products"),
    (("销售", "营业额", "销售额", "卖了多少钱", "业绩", "营收", "流水"), "get_sales_statistics"),
    (("订单统计", "订单情况", "订单量", "统计", "概览"), "get_order_statistics"),
    (("分类", "类目", "品类"), "search_product_by_category"),
    (("订单", "下单", "发货"), "search_order"),
    (("客户", "买家", "会员"), "search_order"),
    (("商品", "产品", "价格", "多少钱", "有没有"), "search_product"),
]

# 抽取关键词时剔除的停用词
_STOP_WORDS = [
    "请问", "帮我", "帮忙", "查一下", "查询", "查查", "看看", "看一下", "有哪些", "有没有",
    "是多少", "多少钱", "怎么样", "情况", "目前", "现在", "还有", "库存", "订单", "客户",
    "销售", "分类", "统计", "商品", "产品", "一下", "多少", "怎么", "如何", "请", "想", "要",
    "的", "吗", "呢", "个", "我", "和", "与",
    "？", "?", "，", ",", "。", ".", "！", "!", "：", ":", "；", ";", "、", " ", "\t",
]

_ORDER_NO_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9\-]{5,}")


def _has_llm_key() -> bool:
    """是否配置了可用的大模型 API Key（空或含 xxxx 的占位符视为不可用）"""
    key = (settings.LLM_API_KEY or "").strip()
    return bool(key) and "xxxx" not in key.lower()


def run_agent(question: str, session_id: str = "default", db: Optional[Session] = None) -> dict:
    """执行商品 Agent，返回最终回答与工具调用链"""
    started = time.time()
    text = (question or "").strip()
    session_id = session_id or "default"
    tool_calls: List[dict] = []
    status = "success"
    try:
        if _has_llm_key():
            answer = _run_with_llm(text, tool_calls)
        else:
            answer = _run_with_rules(text, tool_calls)
    except Exception as exc:
        logger.warning("Agent 执行失败：%s", exc)
        status = "failed"
        answer = f"抱歉，Agent 执行失败：{exc}"

    elapsed_ms = int((time.time() - started) * 1000)
    _save_log(db, session_id, text, tool_calls, answer, status, elapsed_ms)
    return {
        "answer": answer,
        "tool_calls": tool_calls,
        "elapsed_ms": elapsed_ms,
        "session_id": session_id,
        "agent": AGENT_NAME,
    }


# ==================== LLM function calling ====================

def _run_with_llm(question: str, tool_calls: List[dict]) -> str:
    """走 OpenAI function calling：LLM 决定调用哪个工具，结果回填后生成最终答案"""
    client = get_llm_client()
    messages: List[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]

    for _ in range(MAX_ROUNDS):
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
            tools=TOOLS_SCHEMA,
            temperature=settings.LLM_TEMPERATURE,
        )
        message = response.choices[0].message
        calls = getattr(message, "tool_calls", None)
        if not calls:
            return (message.content or "").strip() or "（模型未返回内容）"

        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments or "{}",
                        },
                    }
                    for call in calls
                ],
            }
        )

        for call in calls:
            name = call.function.name
            try:
                arguments = json.loads(call.function.arguments or "{}")
            except (TypeError, ValueError):
                arguments = {}
            result = call_tool(name, arguments)
            tool_calls.append({"tool": name, "arguments": arguments, "result": result})
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result, ensure_ascii=False, default=str),
                }
            )

    # 达到最大轮次：再问一次（不给工具）逼模型基于已有数据总结
    final = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=messages,
        temperature=settings.LLM_TEMPERATURE,
    )
    return (final.choices[0].message.content or "").strip() or "（Agent 达到最大工具调用轮次，未生成最终回答）"


# ==================== 无 LLM Key 时的规则降级 ====================

def _extract_keyword(question: str) -> str:
    """粗暴剔除停用词，得到可能的商品/客户关键词"""
    text = question or ""
    for word in _STOP_WORDS:
        text = text.replace(word, " ")
    return text.strip()[:30]


def _extract_order_no(question: str) -> Optional[str]:
    """尝试从问题中抽取订单号（字母数字组合且含数字）"""
    for token in _ORDER_NO_RE.findall(question or ""):
        if any(ch.isdigit() for ch in token):
            return token
    return None


def _match_rule(question: str, keyword: str):
    """关键词规则匹配：返回 (工具名, 参数字典)"""
    text = (question or "").lower()
    for keywords, tool_name in _KEYWORD_RULES:
        if not any(word.lower() in text for word in keywords):
            continue
        if tool_name == "get_low_stock_products":
            return tool_name, {"limit": 10}
        if tool_name == "get_top_products":
            return tool_name, {"limit": 5}
        if tool_name == "get_sales_statistics":
            return tool_name, {"days": 30}
        if tool_name == "get_order_statistics":
            return tool_name, {"days": 30}
        if tool_name == "search_product_by_category":
            return tool_name, {"category": keyword or question, "limit": 10}
        if tool_name == "search_order":
            order_no = _extract_order_no(question)
            if order_no:
                return tool_name, {"order_no": order_no, "limit": 10}
            if any(word in question for word in ("客户", "买家", "会员")):
                return tool_name, {"customer_name": keyword, "limit": 10}
            return tool_name, {"limit": 10}
        # search_product
        return tool_name, ({"keyword": keyword} if keyword else {"limit": 10})
    # 兜底：按商品关键词搜索
    return "search_product", ({"keyword": keyword} if keyword else {"limit": 10})


def _format_row(row: Any) -> str:
    """把一行结果压成简洁的中文描述"""
    if isinstance(row, dict):
        preferred = [
            "name", "product_name", "order_no", "customer_name", "current_stock",
            "safe_stock", "stock", "status_text", "status", "price", "sales",
            "total_amount", "quantity",
        ]
        parts = [f"{key}={row[key]}" for key in preferred if row.get(key) not in (None, "")]
        if not parts:
            parts = [f"{key}={value}" for key, value in list(row.items())[:6]]
        return "，".join(parts)
    return str(row)


def _format_rows(result: Any, max_rows: int = 5) -> List[str]:
    lines: List[str] = []
    if isinstance(result, list):
        if not result:
            return ["（查询结果为空）"]
        for row in result[:max_rows]:
            lines.append("- " + _format_row(row))
        if len(result) > max_rows:
            lines.append(f"... 共 {len(result)} 条")
    elif isinstance(result, dict):
        for key, value in result.items():
            if isinstance(value, (list, dict)):
                lines.append(f"- {key}：{json.dumps(value, ensure_ascii=False, default=str)}")
            else:
                lines.append(f"- {key}：{value}")
    else:
        lines.append(str(result))
    return lines


def _mock_answer(question: str, tool_name: str, result: Any) -> str:
    """无 LLM Key 时，用规则路由 + 数据查询结果拼装回答"""
    lines = [
        "（当前未配置可用的大模型 API Key，已用本地规则匹配工具并直接查询数据库）",
        f"问题：{question}",
        f"调用工具：{tool_name}",
    ]
    if isinstance(result, dict) and result.get("error"):
        lines.append(f"查询失败：{result['error']}")
    elif not result:
        lines.append("查询结果：暂无相关数据，可能是数据库中还没有对应记录，请先导入示例数据。")
    else:
        lines.append("查询结果：")
        lines.extend(_format_rows(result))
    return "\n".join(lines)


def _run_with_rules(question: str, tool_calls: List[dict]) -> str:
    """无 LLM Key 时的降级实现：关键词匹配工具 + 直接查库"""
    keyword = _extract_keyword(question)
    tool_name, arguments = _match_rule(question, keyword)
    result = call_tool(tool_name, arguments)
    tool_calls.append({"tool": tool_name, "arguments": arguments, "result": result})
    return _mock_answer(question, tool_name, result)


# ==================== 日志落库 ====================

def _save_log(
    db: Optional[Session],
    session_id: str,
    question: str,
    tool_calls: List[dict],
    answer: str,
    status: str,
    elapsed_ms: int,
) -> None:
    """把本次 Agent 调用链写入 agent_logs"""
    own_session = db is None
    session = db or SessionLocal()
    try:
        row = AgentLog(
            session_id=session_id,
            question=question,
            agent=AGENT_NAME,
            tool_name=",".join(call["tool"] for call in tool_calls),
            tool_params=_dumps([{"tool": c["tool"], "arguments": c["arguments"]} for c in tool_calls]),
            tool_result=_dumps([c["result"] for c in tool_calls]),
            answer=answer,
            status=status,
            elapsed_ms=elapsed_ms,
        )
        session.add(row)
        session.commit()
    except Exception as exc:
        session.rollback()
        logger.warning("写入 Agent 调用链失败：%s", exc)
    finally:
        if own_session:
            session.close()


def _dumps(value: Any) -> str:
    """序列化并截断，避免超长内容写库失败"""
    text = json.dumps(value, ensure_ascii=False, default=str)
    return text[:60000]
