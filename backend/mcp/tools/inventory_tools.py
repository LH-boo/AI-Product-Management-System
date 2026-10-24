"""
库存相关 MCP 工具
"""
from typing import List, Optional

from database import SessionLocal
from models.inventory import Inventory
from models.product import Product

# 库存状态中文说明
_STOCK_STATUS_TEXT = {
    "out_of_stock": "缺货",
    "warning": "库存预警",
    "normal": "正常",
    "overstock": "库存积压",
}


def _row_to_dict(inventory: Inventory, product: Optional[Product]) -> dict:
    """库存记录 + 商品信息拼成 dict（金额/整数均已转成 JSON 友好类型）"""
    data = inventory.to_dict(
        product_name=product.name if product else "",
        sku=product.sku if product else "",
    )
    data["status_text"] = _STOCK_STATUS_TEXT.get(data.get("status", ""), data.get("status", ""))
    data["sales"] = int(product.sales or 0) if product else 0
    data["price"] = float(product.price or 0) if product else 0.0
    return data


def search_inventory(product_name: Optional[str] = None) -> List[dict]:
    """查询商品库存。

    参数：
        product_name: 商品名称关键词，支持模糊匹配；留空则返回全部库存（最多 100 条）
    返回：库存列表，每项包含商品名称、SKU、当前库存、安全库存、库存状态等。
    """
    db = SessionLocal()
    try:
        query = (
            db.query(Inventory, Product)
            .outerjoin(Product, Product.id == Inventory.product_id)
        )
        text = (product_name or "").strip()
        if text:
            query = query.filter(Product.name.like(f"%{text}%"))
        rows = query.order_by(Inventory.current_stock.asc()).limit(100).all()
        return [_row_to_dict(inventory, product) for inventory, product in rows]
    finally:
        db.close()


def get_low_stock_products(limit: int = 10) -> List[dict]:
    """查询库存不足（当前库存 <= 安全库存）的商品，按库存从少到多排序。

    参数：
        limit: 返回条数上限，默认 10
    返回：低库存商品列表，包含商品名称、当前库存、安全库存、库存状态；
          可用于生成补货建议。
    """
    db = SessionLocal()
    try:
        query = (
            db.query(Inventory, Product)
            .outerjoin(Product, Product.id == Inventory.product_id)
            .filter(Inventory.current_stock <= Inventory.safe_stock)
        )
        rows = query.order_by(Inventory.current_stock.asc()).limit(int(limit or 10)).all()
        return [_row_to_dict(inventory, product) for inventory, product in rows]
    finally:
        db.close()
