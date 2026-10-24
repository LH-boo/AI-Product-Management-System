"""
商品 MCP 服务端

用官方 mcp 包（`mcp.server.fastmcp.FastMCP`）把 tools/ 下的工具注册成 MCP 工具。

⚠ 同名遮蔽问题：
    本包目录名也叫 `mcp`，会遮蔽（shadow）site-packages 里的官方 mcp 包。
    因此本文件中所有对第三方 mcp 的导入都写在函数内部，并通过
    third_party_mcp_env() 临时把「本地 mcp 包」从 sys.modules 与 sys.path 中摘除，
    导入完成后再恢复，从而保证能 import 到真正的官方 mcp 包。

以 stdio 方式启动（供 MCP 客户端 / 演示真实 MCP 链路使用）：
    cd backend
    python -m mcp.agentserver
"""
import importlib
import logging
import os
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger("mcp.agentserver")

# ==================== 导入本地工具（注意：这里导入的是本包 mcp.tools） ====================
try:
    from mcp.tools.analytics_tools import get_sales_statistics, get_top_products
    from mcp.tools.inventory_tools import get_low_stock_products, search_inventory
    from mcp.tools.order_tools import get_order_statistics, search_order
    from mcp.tools.product_tools import (
        get_product_detail,
        search_product,
        search_product_by_category,
    )
except ImportError:  # 直接以脚本方式运行本文件（python mcp/agentserver.py）时的兜底
    from tools.analytics_tools import get_sales_statistics, get_top_products
    from tools.inventory_tools import get_low_stock_products, search_inventory
    from tools.order_tools import get_order_statistics, search_order
    from tools.product_tools import (
        get_product_detail,
        search_product,
        search_product_by_category,
    )

# 工具注册表：工具名 -> 函数（供 Agent 本地直接调用，也用于生成工具 schema）
TOOL_REGISTRY: Dict[str, object] = {
    "search_product": search_product,
    "search_product_by_category": search_product_by_category,
    "get_product_detail": get_product_detail,
    "search_inventory": search_inventory,
    "get_low_stock_products": get_low_stock_products,
    "search_order": search_order,
    "get_order_statistics": get_order_statistics,
    "get_sales_statistics": get_sales_statistics,
    "get_top_products": get_top_products,
}

_LOCAL_MCP_DIR = Path(__file__).resolve().parent


# ==================== 屏蔽本地同名包，安全导入官方 mcp ====================

@contextmanager
def third_party_mcp_env():
    """临时隐藏本地 mcp 包，使 `import mcp...` 命中 site-packages 里的官方 mcp 包。

    进入：把本地 mcp 及其子模块从 sys.modules 移除，并把项目内的 backend 目录从
          sys.path 移除，然后导入官方 mcp 包占据 sys.modules['mcp']；
    退出：恢复 sys.path 与本地 mcp 模块，保证包内既有引用不被破坏。
    """
    local_dir = os.path.normcase(str(_LOCAL_MCP_DIR))

    # 1. 摘除本地 mcp 相关模块
    saved_modules: Dict[str, object] = {}
    for name in list(sys.modules.keys()):
        if name != "mcp" and not name.startswith("mcp."):
            continue
        module = sys.modules.get(name)
        module_file = os.path.normcase(str(getattr(module, "__file__", "") or ""))
        if name == "mcp" or local_dir in module_file:
            saved_modules[name] = sys.modules.pop(name)

    # 2. 从 sys.path 移除 backend 目录（含 "" / cwd）
    project_dir = os.path.normcase(str(_LOCAL_MCP_DIR.parent))
    removed_paths: List[str] = []
    for path in list(sys.path):
        candidate = Path.cwd() if path == "" else Path(path)
        try:
            if os.path.normcase(str(candidate.resolve())) == project_dir:
                removed_paths.append(path)
        except OSError:
            continue
    for path in removed_paths:
        sys.path.remove(path)

    try:
        importlib.import_module("mcp")  # 此刻拿到的是官方 mcp 包
        yield
    finally:
        for path in removed_paths:
            sys.path.append(path)
        sys.modules.update(saved_modules)


def load_server_class() -> Optional[type]:
    """加载官方 MCP 服务端类：1.x 为 FastMCP，2.x 已改名为 MCPServer。"""
    with third_party_mcp_env():
        for module_name, class_name in (
            ("mcp.server.fastmcp", "FastMCP"),
            ("mcp.server.mcpserver", "MCPServer"),
        ):
            try:
                module = importlib.import_module(module_name)
            except ImportError as exc:
                logger.debug("导入 %s 失败：%s", module_name, exc)
                continue
            server_class = getattr(module, class_name, None)
            if server_class is not None:
                logger.info("已加载 MCP 服务端类：%s.%s", module_name, class_name)
                return server_class
    return None


class _NullServer:
    """官方 mcp 包不可用时的占位服务端，保证本模块能被正常导入（本地工具链路仍可用）"""

    def tool(self, *args, **kwargs):
        def decorator(func):
            return func

        return decorator

    def run(self, *args, **kwargs):
        raise RuntimeError(
            "未安装官方 mcp 包，无法以 MCP 服务端方式启动；"
            "请先执行 pip install -r requirements.txt"
        )


def _create_server(server_class):
    """在屏蔽本地包的环境中创建服务端并注册全部工具"""
    with third_party_mcp_env():
        server = server_class("product-mcp-server")
        for func in TOOL_REGISTRY.values():
            server.tool()(func)  # 工具名取函数名，描述取 docstring
        return server


_server_class = load_server_class()
if _server_class is not None:
    try:
        mcp = _create_server(_server_class)
    except Exception as exc:  # 极端情况下不让整个应用启动失败
        logger.warning("创建 MCP 服务端失败，降级为占位实现：%s", exc)
        mcp = _NullServer()
else:
    logger.warning("未找到官方 mcp 服务端类（FastMCP/MCPServer），MCP 服务端能力降级")
    mcp = _NullServer()


def run_server() -> None:
    """以 stdio 方式启动 MCP 服务端（阻塞）"""
    logger.info("启动 MCP 服务端 product-mcp-server（stdio），已注册 %d 个工具", len(TOOL_REGISTRY))
    with third_party_mcp_env():
        mcp.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    run_server()
