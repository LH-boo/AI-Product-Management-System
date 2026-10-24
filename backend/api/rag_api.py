"""RAG 知识库接口 /api/ai/rag"""
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.knowledge_document import KnowledgeDocument
from rag import rag_search, vector_store
from rag.document_loader import DEFAULT_CATEGORIES
from utils.response import fail, ok

logger = logging.getLogger("api.rag")

# 注意：本 router 由 ai_api（prefix="/api/ai"）挂载，
# 因此这里只写相对前缀，最终路径为 /api/ai/rag/...
router = APIRouter(prefix="/rag", tags=["RAG知识库"])

# 允许上传的知识文档类型
ALLOWED_SUFFIX = {".txt", ".md"}


class SearchIn(BaseModel):
    """检索/问答入参"""
    question: str
    top_k: Optional[int] = None


@router.post("/search")
def search(payload: SearchIn):
    """知识库检索：返回命中的文本块与基于资料的答案"""
    if not payload.question or not payload.question.strip():
        return fail("问题不能为空")
    try:
        result = rag_search.rag_answer(payload.question, payload.top_k)
    except Exception as exc:
        return fail(f"知识库检索失败：{exc}")
    return ok(
        {
            "question": payload.question,
            "results": result["results"],
            "answer": result["answer"],
        }
    )


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    """知识库总览：文档数、文本块数、向量数、状态与文档列表"""
    documents = db.query(KnowledgeDocument).order_by(KnowledgeDocument.id.desc()).all()
    vector_count = vector_store.count()
    chunk_count = sum(int(doc.chunk_count or 0) for doc in documents)
    return ok(
        {
            "doc_count": len(documents),
            "chunk_count": chunk_count,
            "vector_count": vector_count,
            "status": "indexed" if vector_count else "empty",
            "documents": [doc.to_dict() for doc in documents],
        }
    )


@router.post("/upload")
async def upload(
    file: UploadFile = File(..., description="知识文档（.txt / .md）"),
    category: str = Form("products", description="分类 products/after_sale/inventory/system"),
    db: Session = Depends(get_db),
):
    """上传知识文档并做增量索引"""
    filename = Path(file.filename or "").name
    suffix = Path(filename).suffix.lower()
    if not filename or suffix not in ALLOWED_SUFFIX:
        return fail("仅支持 .txt / .md 文件")

    final_category = (category or "products").strip() or "products"
    if final_category not in DEFAULT_CATEGORIES:
        final_category = "products"

    target_dir = Path(settings.KNOWLEDGE_DIR) / final_category
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / filename

    try:
        content = await file.read()
        target.write_bytes(content)
    except Exception as exc:
        logger.warning("保存上传文件失败：%s", exc)
        return fail(f"保存文件失败：{exc}")

    try:
        info = rag_search.index_file(target, final_category, db)
    except Exception as exc:
        logger.warning("增量索引失败：%s", exc)
        return fail(f"文件已保存，但索引失败：{exc}")

    return ok(info, "上传并索引成功")


@router.post("/reindex")
def reindex(db: Session = Depends(get_db)):
    """全量重建索引（清空向量库后重新加载 knowledge 目录）"""
    try:
        data = rag_search.index_all_knowledge(db)
    except Exception as exc:
        return fail(f"重建索引失败：{exc}")
    return ok(data, "重建索引完成")


@router.post("/ask")
def ask(payload: SearchIn):
    """完整 RAG 问答：返回答案、引用来源与耗时"""
    if not payload.question or not payload.question.strip():
        return fail("问题不能为空")
    try:
        data = rag_search.rag_answer(payload.question, payload.top_k)
    except Exception as exc:
        return fail(f"RAG 问答失败：{exc}")
    return ok(
        {
            "answer": data["answer"],
            "refs": data["refs"],
            "elapsed_ms": data["elapsed_ms"],
        }
    )
