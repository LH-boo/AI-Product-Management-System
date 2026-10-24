"""
全局配置
所有可调参数集中在这里，通过 .env 文件注入，代码里不要写死。
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# 项目根目录：backend/ 的上一级
BASE_DIR = Path(__file__).resolve().parent.parent

# 加载根目录下的 .env
load_dotenv(BASE_DIR / ".env")


def _get(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def _get_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except (TypeError, ValueError):
        return default


def _get_bool(key: str, default: bool = False) -> bool:
    return str(os.getenv(key, str(default))).lower() in ("1", "true", "yes", "on")


class Settings:
    # ---------- 应用 ----------
    APP_NAME: str = _get("APP_NAME", "AI智能商品管理系统")
    APP_HOST: str = _get("APP_HOST", "0.0.0.0")
    APP_PORT: int = _get_int("APP_PORT", 8000)
    DEBUG: bool = _get_bool("DEBUG", True)

    # ---------- MySQL ----------
    MYSQL_HOST: str = _get("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT: int = _get_int("MYSQL_PORT", 3306)
    MYSQL_USER: str = _get("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = _get("MYSQL_PASSWORD", "123456")
    MYSQL_DB: str = _get("MYSQL_DB", "ai_product")

    @property
    def DB_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset=utf8mb4"
        )

    # ---------- LLM ----------
    LLM_BASE_URL: str = _get("LLM_BASE_URL", "https://api.openai.com/v1")
    LLM_API_KEY: str = _get("LLM_API_KEY", "")
    LLM_MODEL: str = _get("LLM_MODEL", "gpt-4o-mini")
    LLM_TEMPERATURE: float = float(_get("LLM_TEMPERATURE", "0.3"))

    # ---------- Embedding ----------
    EMBEDDING_BASE_URL: str = _get("EMBEDDING_BASE_URL", "https://api.openai.com/v1")
    EMBEDDING_API_KEY: str = _get("EMBEDDING_API_KEY", "")
    EMBEDDING_MODEL: str = _get("EMBEDDING_MODEL", "text-embedding-3-small")

    # ---------- RAG ----------
    CHROMA_DIR: str = str(BASE_DIR / _get("CHROMA_DIR", "chroma_db"))
    CHROMA_COLLECTION: str = _get("CHROMA_COLLECTION", "product_knowledge")
    TOP_K: int = _get_int("TOP_K", 4)
    CHUNK_SIZE: int = _get_int("CHUNK_SIZE", 500)
    CHUNK_OVERLAP: int = _get_int("CHUNK_OVERLAP", 80)

    # ---------- 目录 ----------
    BASE_DIR: Path = BASE_DIR
    KNOWLEDGE_DIR: Path = BASE_DIR / "backend" / "knowledge"
    FRONTEND_DIR: Path = BASE_DIR / "frontend"


settings = Settings()

