"""
RAG 检索与问答核心

- index_all_knowledge：全量重建索引（清空向量库 → 加载切分 → 向量化写入 → 同步 knowledge_documents）
- index_file：单文件增量索引
- search：向量检索，返回结果、拼接好的上下文、来源列表
- rag_answer：检索 + LLM 生成答案（无 Key 时把检索原文整理成回答）
"""
import logging
import time
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal
from models.knowledge_document import KnowledgeDocument
from rag import vector_store
from rag.document_loader import (
    doc_name,
    guess_category,
    list_files,
    load_all,
    load_file,
    to_source,
)
from rag.embedding import embed_query, is_placeholder_key
from utils.llm import chat

logger = logging.getLogger("rag.search")


def has_llm_key() -> bool:
    """是否配置了可用的大模型 API Key（空或占位符视为不可用）"""
    return not is_placeholder_key(settings.LLM_API_KEY)


RAG_SYSTEM_PROMPT = (
    "你是「AI智能商品管理系统」的知识库问答助手。"
    "请严格依据【参考资料】回答用户问题："
    "1) 只使用参考资料中的信息，不要杜撰、不要自行补充；"
    "2) 如果参考资料里没有相关信息，直接回答「知识库中暂无相关信息」，不要编造；"
    "3) 回答要简洁、条理清晰，并在结尾用「参考资料：」列出你引用的来源文件名。"
)

RAG_USER_TEMPLATE = """【参考资料】
{context}

【用户问题】
{question}
"""


# ==================== 索引 ====================

def _chunk_counts(chunks: List[dict]) -> Dict[str, int]:
    """按 source 统计每个文档的块数"""
    counts: Dict[str, int] = {}
    for chunk in chunks:
        counts[chunk["source"]] = counts.get(chunk["source"], 0) + 1
    return counts


def index_all_knowledge(db: Optional[Session] = None) -> dict:
    """全量重建索引：清空向量库 → 加载知识库 → 切分 → 向量化 → 写入 → 同步文档表"""
    own_session = db is None
    session = db or SessionLocal()
    try:
        vector_store.reset()
        chunks = load_all()
        written = vector_store.add_chunks(chunks)
        counts = _chunk_counts(chunks)

        files = list_files()
        for item in files:
            source = item["source"]
            row = (
                session.query(KnowledgeDocument)
                .filter(KnowledgeDocument.file_path == source)
                .first()
            )
            if row is None:
                row = KnowledgeDocument(doc_name=item["doc_name"], file_path=source)
                session.add(row)
            chunk_count = counts.get(source, 0)
            row.doc_name = item["doc_name"]
            row.category = item["category"]
            row.chunk_count = chunk_count
            row.vector_count = chunk_count
            row.status = "indexed" if chunk_count else "failed"
        session.commit()

        return {
            "doc_count": len(files),
            "chunk_count": len(chunks),
            "vector_count": written,
        }
    except Exception:
        session.rollback()
        raise
    finally:
        if own_session:
            session.close()


def index_file(file_path, category: str = "", db: Optional[Session] = None) -> dict:
    """单文件增量索引：先删除该文档旧向量，再写入新向量，并同步文档表"""
    own_session = db is None
    session = db or SessionLocal()
    try:
        source = to_source(file_path)
        final_category = category or guess_category(file_path)
        chunks = [
            {
                "source": source,
                "category": final_category,
                "chunk_index": index,
                "content": content,
            }
            for index, content in enumerate(load_file(file_path))
        ]

        vector_store.delete_by_source(source)
        written = vector_store.add_chunks(chunks)

        row = (
            session.query(KnowledgeDocument)
            .filter(KnowledgeDocument.file_path == source)
            .first()
        )
        if row is None:
            row = KnowledgeDocument(doc_name=doc_name(file_path), file_path=source)
            session.add(row)
        row.doc_name = doc_name(file_path)
        row.category = final_category
        row.chunk_count = len(chunks)
        row.vector_count = written
        row.status = "indexed" if written else "failed"
        session.commit()

        return {
            "source": source,
            "category": final_category,
            "chunk_count": len(chunks),
            "vector_count": written,
        }
    except Exception:
        session.rollback()
        raise
    finally:
        if own_session:
            session.close()


# ==================== 检索 ====================

def _build_context(results: List[dict]) -> str:
    """把检索结果拼成给 LLM 的上下文文本"""
    parts = []
    for index, item in enumerate(results, 1):
        parts.append(f"[{index}] 来源：{item['source']}（{item['category']}）\n{item['content']}")
    return "\n\n".join(parts)


def search(question: str, top_k: Optional[int] = None) -> dict:
    """向量检索，返回 {results, context, sources}"""
    text = (question or "").strip()
    empty = {"results": [], "context": "", "sources": []}
    if not text or vector_store.count() == 0:
        return empty

    query_embedding = embed_query(text)
    results = vector_store.query(query_embedding, int(top_k or settings.TOP_K))

    sources: List[str] = []
    for item in results:
        if item["source"] and item["source"] not in sources:
            sources.append(item["source"])

    return {"results": results, "context": _build_context(results), "sources": sources}


# ==================== 问答 ====================

def _mock_answer(question: str, results: List[dict]) -> str:
    """无 LLM Key 时的降级回答：把检索到的知识原文整理后返回"""
    lines = [
        "（当前未配置可用的大模型 API Key，以下为知识库检索结果整理）",
        f"针对问题「{question}」，共检索到 {len(results)} 条相关资料：",
    ]
    for index, item in enumerate(results, 1):
        snippet = item["content"]
        if len(snippet) > 200:
            snippet = snippet[:200] + "..."
        lines.append(f"{index}. 来源：{item['source']}（相关度 {item['score']:.2f}）\n   {snippet}")
    lines.append("如需更自然的总结式回答，请在 .env 中配置 LLM_API_KEY 后点击「重建索引」重试。")
    return "\n".join(lines)


def _generate_answer(question: str, context: str) -> str:
    """优先调用 LLM 生成答案，失败或未配置 Key 时降级"""
    if has_llm_key():
        try:
            return chat(
                [
                    {"role": "system", "content": RAG_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": RAG_USER_TEMPLATE.format(context=context, question=question),
                    },
                ]
            )
        except Exception as exc:
            logger.warning("LLM 调用失败，降级为检索原文整理：%s", exc)
    return ""


def rag_answer(question: str, top_k: Optional[int] = None) -> dict:
    """完整 RAG 问答：检索 + LLM 生成答案。

    返回 {answer, refs, results, elapsed_ms}
    """
    started = time.time()
    text = (question or "").strip()
    found = search(text, top_k)
    results = found["results"]

    if not results:
        answer = "知识库中暂无相关信息。请先在「RAG知识库」页面上传相关资料，并点击「重建索引」后再试。"
    else:
        answer = _generate_answer(text, found["context"]) or _mock_answer(text, results)

    elapsed_ms = int((time.time() - started) * 1000)
    return {
        "answer": answer,
        "refs": found["sources"],
        "results": results,
        "elapsed_ms": elapsed_ms,
    }
