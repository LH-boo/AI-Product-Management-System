"""
Embedding 封装

统一走 utils.llm.embed（OpenAI 兼容协议），不自己 new 客户端。
未配置 Embedding API Key（或明显是占位符）以及远程调用失败时，
自动降级为「本地 n-gram 哈希向量」，保证没有 Key 也能跑通建索引 + 检索全流程。
注意：本地兜底向量只有词面匹配能力，没有深层语义，仅用于无 Key 演示。
"""
import hashlib
import logging
import math
from typing import List

from config import settings
from utils.llm import embed as _remote_embed

logger = logging.getLogger("rag.embedding")

# 本地兜底向量维度
FALLBACK_DIM = 256


def is_placeholder_key(key: str) -> bool:
    """判断 API Key 是否为空或占位符（如包含 xxxx）"""
    text = (key or "").strip()
    if not text:
        return True
    return "xxxx" in text.lower()


def has_embedding_key() -> bool:
    """是否配置了可用的 Embedding API Key"""
    return not is_placeholder_key(settings.EMBEDDING_API_KEY)


def _tokens(text: str) -> List[str]:
    """粗粒度分词：单字符 + 相邻字符二元组（对中文友好）"""
    content = (text or "").lower()
    chars = [ch for ch in content if not ch.isspace()]
    tokens = list(chars)
    tokens.extend(chars[i] + chars[i + 1] for i in range(len(chars) - 1))
    return tokens


def _local_embedding(text: str, dim: int = FALLBACK_DIM) -> List[float]:
    """本地兜底向量：基于哈希词袋 + L2 归一化"""
    vector = [0.0] * dim
    for token in _tokens(text):
        digest = hashlib.md5(token.encode("utf-8")).hexdigest()
        index = int(digest, 16) % dim
        vector[index] += 1.0
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def embed_texts(texts: List[str]) -> List[List[float]]:
    """批量向量化；远程失败或未配置 Key 时自动降级为本地向量"""
    contents = list(texts or [])
    if not contents:
        return []
    if has_embedding_key():
        try:
            vectors = _remote_embed(contents)
            if vectors and len(vectors) == len(contents):
                return vectors
            logger.warning("Embedding 返回条数与文本条数不一致，降级为本地向量")
        except Exception as exc:  # 网络/额度/鉴权等异常全部兜底
            logger.warning("Embedding 接口调用失败，降级为本地向量：%s", exc)
    return [_local_embedding(content) for content in contents]


def embed_query(text: str) -> List[float]:
    """单条文本向量化（检索用）"""
    vectors = embed_texts([text])
    return vectors[0] if vectors else _local_embedding(text)
