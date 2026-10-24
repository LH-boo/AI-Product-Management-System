"""
AI 智能商品管理系统 —— FastAPI 主入口

启动：
    cd backend
    uvicorn main:app --reload --port 8000
或直接：
    python main.py

文档：
    http://127.0.0.1:8000/docs
前端：
    http://127.0.0.1:8000/
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("app")

app = FastAPI(
    title=settings.APP_NAME,
    description="前后端分离 + 商品业务管理 + RAG 知识库 + 商品 Agent + MCP 工具 + AI 数据分析",
    version="1.0.0",
)

# 允许跨域（前端单独用 Live Server 打开时需要）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    try:
        init_db()
        logger.info("数据库初始化完成")
    except Exception as exc:  # 数据库没起来也不要阻塞服务，方便先看接口文档
        logger.error("数据库初始化失败：%s", exc)


# ==================== 业务模块 ====================
from api import (  # noqa: E402
    ai_api,
    analytics_api,
    category_api,
    customer_api,
    inventory_api,
    logs_api,
    order_api,
    product_api,
)

app.include_router(product_api.router)
app.include_router(category_api.router)
app.include_router(inventory_api.router)
app.include_router(order_api.router)
app.include_router(customer_api.router)
app.include_router(analytics_api.router)
app.include_router(logs_api.router)

# ==================== AI 模块 ====================
app.include_router(ai_api.router)   # /api/ai/chat、/api/ai/trace


@app.get("/api/health", tags=["system"])
def health():
    return {"code": 200, "message": "success", "data": {"status": "ok", "app": settings.APP_NAME}}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("请求异常：%s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=200,
        content={"code": 500, "message": f"服务器异常：{exc}", "data": None},
    )


# ==================== 前端静态页面 ====================
# 注意：必须放在所有 API 路由之后挂载，否则会拦截 /api 请求
if settings.FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(settings.FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.DEBUG,
    )
