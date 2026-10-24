"""知识库文档 knowledge_documents"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database import Base


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_name = Column(String(150), nullable=False, comment="文档名称")
    category = Column(String(30), default="products", comment="分类 products/after_sale/inventory/system")
    file_path = Column(String(255), default="", comment="文件相对路径")
    chunk_count = Column(Integer, default=0, comment="文本块数量")
    vector_count = Column(Integer, default=0, comment="向量数量")
    status = Column(String(20), default="pending", comment="pending 待向量化 / indexed 已向量化 / failed")
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "doc_name": self.doc_name,
            "category": self.category,
            "file_path": self.file_path,
            "chunk_count": self.chunk_count,
            "vector_count": self.vector_count,
            "status": self.status,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
        }
