"""
Chroma 向量库封装

- 使用持久化客户端：chromadb.PersistentClient(path=settings.CHROMA_DIR)
- 所有向量都由业务侧（utils.llm.embed）显式计算后显式传入，
  因此这里传入一个「空实现的 embedding_function」而不是留空，
  避免 chromadb 自行实例化默认 ONNX 模型（会联网下载）。
"""
import logging
from typing import List, Optional

import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from chromadb.config import Settings as ChromaSettings

from config import settings
from rag.embedding import embed_texts

logger = logging.getLogger("rag.vector_store")

# 写入批次大小（一次批量向量化 + 写入，避免单次请求过大）
BATCH_SIZE = 32

_client: Optional[object] = None


class _NoopEmbeddingFunction(EmbeddingFunction):
    """空实现的 EmbeddingFunction：禁止 Chroma 自行把文本转向量"""

    def __call__(self, input: Documents) -> Embeddings:  # noqa: A002
        raise RuntimeError("向量必须由 utils.llm.embed 显式计算后传入，Chroma 不应自行嵌入文本")

    @staticmethod
    def name() -> str:
        return "noop"


def get_client():
    """获取（懒加载）Chroma 持久化客户端"""
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.CHROMA_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def get_collection():
    """获取（不存在则创建）知识库 collection；距离度量用余弦"""
    return get_client().get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        embedding_function=_NoopEmbeddingFunction(),
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(chunks: List[dict], batch_size: int = BATCH_SIZE) -> int:
    """写入文本块。

    chunks 每项：{source, category, chunk_index, content}
    id 形如 "products/xxx.md-0"；metadata 存 source/category/chunk_index。
    返回实际写入的块数量。
    """
    if not chunks:
        return 0
    collection = get_collection()
    written = 0
    for start in range(0, len(chunks), batch_size):
        group = chunks[start : start + batch_size]
        documents = [item["content"] for item in group]
        ids = [f"{item['source']}-{item['chunk_index']}" for item in group]
        metadatas = [
            {
                "source": item["source"],
                "category": item.get("category", ""),
                "chunk_index": int(item["chunk_index"]),
            }
            for item in group
        ]
        embeddings = embed_texts(documents)
        collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        written += len(group)
    return written


def delete_by_source(source: str) -> None:
    """按文档来源删除其全部向量"""
    try:
        get_collection().delete(where={"source": source})
    except Exception as exc:
        logger.warning("按来源删除向量失败（source=%s）：%s", source, exc)


def reset() -> None:
    """删除并重建 collection（全量重建索引前调用）"""
    client = get_client()
    try:
        client.delete_collection(settings.CHROMA_COLLECTION)
    except Exception as exc:
        logger.info("删除 collection 跳过（可能不存在）：%s", exc)
    get_collection()


def query(query_embedding: List[float], top_k: int) -> List[dict]:
    """向量检索，返回 [{content, source, category, score}]，score 为 0~1 的相似度"""
    try:
        collection = get_collection()
        total = collection.count()
        if total == 0:
            return []
        n_results = max(1, min(int(top_k or settings.TOP_K), total))
        result = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as exc:
        logger.warning("向量检索失败：%s", exc)
        return []

    documents = (result.get("documents") or [[]])[0]
    metadatas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    hits: List[dict] = []
    for index, content in enumerate(documents):
        metadata = metadatas[index] if index < len(metadatas) else {}
        distance = float(distances[index]) if index < len(distances) else 1.0
        # 余弦距离越小越相似，换算成 0~1 的相似度
        score = max(0.0, min(1.0, 1.0 - distance))
        hits.append(
            {
                "content": content,
                "source": (metadata or {}).get("source", ""),
                "category": (metadata or {}).get("category", ""),
                "score": round(score, 4),
            }
        )
    return hits


def count() -> int:
    """collection 中的向量条数"""
    try:
        return int(get_collection().count())
    except Exception as exc:
        logger.warning("统计向量条数失败：%s", exc)
        return 0
