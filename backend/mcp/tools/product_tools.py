"""
商品相关 MCP 工具

约定：
- 每个工具函数自己开 SessionLocal 会话，返回可直接 JSON 序列化的 dict/list；
- 函数 docstring 会被 MCP / 大模型当作「工具描述」使用，务必写清楚用途与参数；
- 金额统一转成 float（ORM 里是 Decimal）。
"""
from typing import Dict, List, Optional

from sqlalchemy import or_

from database import SessionLocal
from models.category import Category
from models.inventory import Inventory
from models.product import Product


def _category_map(db) -> Dict[int, str]:
    """一次性取出分类：{分类id: 分类名}"""
    return {cid: name for cid, name in db.query(Category.id, Category.name).all()}


def _stock_map(db, product_ids: List[int]) -> Dict[int, int]:
    """一次性取出库存：{商品id: 当前库存}"""
    if not product_ids:
        return {}
    rows = (
        db.query(Inventory.product_id, Inventory.current_stock)
        .filter(Inventory.product_id.in_(product_ids))
        .all()
    )
    return {pid: int(stock or 0) for pid, stock in rows}


def _build_products(db, rows) -> List[dict]:
    """把商品 ORM 对象转成带分类名与库存的 dict 列表"""
    categories = _category_map(db)
    stocks = _stock_map(db, [p.id for p in rows])
    return [
        p.to_dict(categories.get(p.category_id, ""), stocks.get(p.id, 0))
        for p in rows
    ]


def search_product(keyword: Optional[str] = None, limit: int = 10) -> List[dict]:
    """按关键词模糊搜索商品。

    参数：
        keyword: 商品名称 / SKU / 品牌 关键词，留空则返回最新商品
        limit:   返回条数上限，默认 10
    返回：商品列表，每项包含名称、价格、销量、分类名、当前库存等字段。
    """
    db = SessionLocal()
    try:
        query = db.query(Product)
        text = (keyword or "").strip()
        if text:
            like = f"%{text}%"
            query = query.filter(
                or_(Product.name.like(like), Product.sku.like(like), Product.brand.like(like))
            )
        rows = query.order_by(Product.id.desc()).limit(int(limit or 10)).all()
        return _build_products(db, rows)
    finally:
        db.close()


def search_product_by_category(category: str, limit: int = 10) -> List[dict]:
    """按分类查询商品。

    参数：
        category: 分类名称（支持模糊匹配，如「手机」）或分类id（如「1」）
        limit:    返回条数上限，默认 10
    返回：该分类下的商品列表（按销量倒序）。
    """
    db = SessionLocal()
    try:
        query = db.query(Product)
        text = str(category or "").strip()
        if text.isdigit():
            query = query.filter(Product.category_id == int(text))
        elif text:
            matched = db.query(Category).filter(Category.name.like(f"%{text}%")).all()
            category_ids = [c.id for c in matched]
            if not category_ids:
                return []
            query = query.filter(Product.category_id.in_(category_ids))
        rows = query.order_by(Product.sales.desc()).limit(int(limit or 10)).all()
        return _build_products(db, rows)
    finally:
        db.close()


def get_product_detail(product_id: int) -> dict:
    """查询单个商品的详细信息。

    参数：
        product_id: 商品id（products 表主键）
    返回：商品详情 dict（含分类名、售价、成本、销量、当前库存）；
          商品不存在时返回 {"error": "..."}。
    """
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == int(product_id)).first()
        if not product:
            return {"error": f"商品不存在：id={product_id}"}
        return _build_products(db, [product])[0]
    finally:
        db.close()
