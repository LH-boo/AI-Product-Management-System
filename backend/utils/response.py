"""
统一响应格式
全项目所有接口都返回 {"code": 200, "message": "success", "data": ...}
"""
from typing import Any

from fastapi.responses import JSONResponse


def ok(data: Any = None, message: str = "success") -> dict:
    return {"code": 200, "message": message, "data": data}


def fail(message: str = "操作失败", code: int = 500, data: Any = None) -> JSONResponse:
    return JSONResponse(status_code=200, content={"code": code, "message": message, "data": data})


def page(items: list, total: int, page_num: int = 1, page_size: int = 10) -> dict:
    return {
        "list": items,
        "total": total,
        "page": page_num,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if page_size else 0,
    }
