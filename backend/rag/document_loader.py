"""
知识库文档加载与切分

知识库目录结构（settings.KNOWLEDGE_DIR）：
    knowledge/
        products/     商品资料
        after_sale/   售后政策
        inventory/    库存规则
        system/       系统使用说明

只读取 .txt / .md 纯文本；中文按字符数做滑动窗口切分，
优先在句号、问号、换行等语义边界处断开，尽量不把一句话切断。
"""
import logging
from pathlib import Path
from typing import Dict, List, Optional

from config import settings

logger = logging.getLogger("rag.loader")

# 支持的文件后缀
SUPPORTED_SUFFIX = {".txt", ".md"}

# 知识库内置分类（对应 knowledge 下的子目录）
DEFAULT_CATEGORIES = ["products", "after_sale", "inventory", "system"]

# 断句符号：切分时在这些符号处断开（取窗口内最靠右的一个）
_SENTENCE_MARKS = ("。", "！", "？", "；", "\n", "，", ".", "!", "?", ";", "\r", " ")


def _knowledge_root() -> Path:
    return Path(settings.KNOWLEDGE_DIR).resolve()


def _read_text(path: Path) -> str:
    """读取文本文件，遇到非法编码字符自动忽略"""
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding="gbk")
        except UnicodeDecodeError:
            return path.read_text(encoding="utf-8", errors="ignore")


def split_text(
    text: str,
    chunk_size: Optional[int] = None,
    overlap: Optional[int] = None,
) -> List[str]:
    """把整段文本按滑动窗口切分成若干块（中文按字符计）。

    - chunk_size：每块最大字符数，默认取 settings.CHUNK_SIZE
    - overlap：相邻块的重叠字符数，默认取 settings.CHUNK_OVERLAP
    - 尽量在句号/问号/换行等位置断开，保证语义完整
    """
    chunk_size = int(chunk_size or settings.CHUNK_SIZE)
    overlap = int(settings.CHUNK_OVERLAP if overlap is None else overlap)
    if chunk_size <= 0:
        chunk_size = 500
    if overlap < 0:
        overlap = 0
    if overlap >= chunk_size:
        overlap = max(chunk_size // 5, 0)

    content = (text or "").strip()
    if not content:
        return []
    if len(content) <= chunk_size:
        return [content]

    chunks: List[str] = []
    total = len(content)
    start = 0
    while start < total:
        end = min(start + chunk_size, total)
        if end < total:
            # 在 [start + chunk_size/2, end] 范围内从右往左找最近的断句符号
            window_start = start + chunk_size // 2
            cut = -1
            for mark in _SENTENCE_MARKS:
                index = content.rfind(mark, window_start, end)
                if index > cut:
                    cut = index
            if cut > 0:
                end = cut + 1  # 把断句符号本身包含进来
        piece = content[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= total:
            break
        start = max(end - overlap, start + 1)
    return chunks


def load_file(path) -> List[str]:
    """加载单个文件并切分，返回文本块列表（文件不存在或格式不支持时返回空列表）"""
    file_path = Path(path)
    if not file_path.is_file() or file_path.suffix.lower() not in SUPPORTED_SUFFIX:
        return []
    return split_text(_read_text(file_path))


def to_source(path) -> str:
    """把文件路径转成知识库内的相对路径（作为文档唯一标识 source），统一用 / 分隔"""
    file_path = Path(path).resolve()
    try:
        return file_path.relative_to(_knowledge_root()).as_posix()
    except ValueError:
        return file_path.name


def guess_category(path) -> str:
    """根据文件所在目录推断分类，不在已知子目录时归到 products"""
    file_path = Path(path).resolve()
    try:
        relative = file_path.relative_to(_knowledge_root())
    except ValueError:
        return DEFAULT_CATEGORIES[0]
    parts = relative.parts
    if len(parts) >= 2:
        return parts[0]
    return DEFAULT_CATEGORIES[0]


def doc_name(path) -> str:
    """文档名称（文件名，含后缀）"""
    return Path(path).name


def list_files() -> List[Dict]:
    """列出知识库下所有可索引的文件，返回 [{path, source, category, doc_name}]"""
    root = _knowledge_root()
    files: List[Dict] = []
    if not root.exists():
        logger.warning("知识库目录不存在：%s", root)
        return files
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_SUFFIX:
            continue
        files.append(
            {
                "path": str(path),
                "source": to_source(path),
                "category": guess_category(path),
                "doc_name": doc_name(path),
            }
        )
    return files


def load_all() -> List[Dict]:
    """加载知识库全部文件并切分。

    返回列表，每项形如：
        {"source": "products/xxx.md", "category": "products",
         "chunk_index": 0, "content": "文本块内容"}
    """
    all_chunks: List[Dict] = []
    for item in list_files():
        for index, content in enumerate(load_file(item["path"])):
            all_chunks.append(
                {
                    "source": item["source"],
                    "category": item["category"],
                    "chunk_index": index,
                    "content": content,
                }
            )
    return all_chunks
