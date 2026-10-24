"""
LLM / Embedding 统一客户端（OpenAI 兼容协议）

只要服务商兼容 OpenAI 的 /chat/completions 与 /embeddings，
改 .env 里的 base_url / api_key / model 即可无缝切换：
    OpenAI    https://api.openai.com/v1
    DeepSeek  https://api.deepseek.com/v1
    通义千问   https://dashscope.aliyuncs.com/compatible-mode/v1
    智谱GLM   https://open.bigmodel.cn/api/paas/v4
    Kimi      https://api.moonshot.cn/v1
"""
from typing import List, Optional

from openai import OpenAI

from config import settings

_llm_client: Optional[OpenAI] = None
_embedding_client: Optional[OpenAI] = None


def get_llm_client() -> OpenAI:
    global _llm_client
    if _llm_client is None:
        _llm_client = OpenAI(base_url=settings.LLM_BASE_URL, api_key=settings.LLM_API_KEY)
    return _llm_client


def get_embedding_client() -> OpenAI:
    global _embedding_client
    if _embedding_client is None:
        _embedding_client = OpenAI(
            base_url=settings.EMBEDDING_BASE_URL, api_key=settings.EMBEDDING_API_KEY
        )
    return _embedding_client


def chat(
    messages: List[dict],
    temperature: Optional[float] = None,
    model: Optional[str] = None,
) -> str:
    """调用大模型，返回纯文本答案"""
    resp = get_llm_client().chat.completions.create(
        model=model or settings.LLM_MODEL,
        messages=messages,
        temperature=settings.LLM_TEMPERATURE if temperature is None else temperature,
    )
    return (resp.choices[0].message.content or "").strip()


def embed(texts: List[str]) -> List[List[float]]:
    """文本向量化，返回向量列表"""
    resp = get_embedding_client().embeddings.create(
        model=settings.EMBEDDING_MODEL, input=texts
    )
    return [item.embedding for item in resp.data]
