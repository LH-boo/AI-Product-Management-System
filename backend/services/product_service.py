"""
商品业务逻辑

约定：
- 所有函数接收 db: Session，返回 dict / list / 元组，不负责包装响应体；
- 商品列表统一返回 (列表, 总数)，由 api 层用 page() 包装分页结构；
- 列表接口一次性查出分类与库存，避免循环查库（N+1）。
"""
from typing import Dict, List, Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.category import Category
from models.inventory import Inventory
from models.product import Product

# 允许创建/更新的商品字段
_PRODUCT_FIELDS = (
    "name",
    "sku",
    "category_id",
    "brand",
    "price",
    "cost",
    "image",
    "description",
    "status",
)


def get_category_map(db: Session) -> Dict[int, str]:
    """一次性取出所有分类，返回 {分类id: 分类名}"""
    return {cid: name for cid, name in db.query(Category.id, Category.name).all()}


def get_stock_map(db: Session, product_ids: Optional[List[int]] = None) -> Dict[int, int]:
    """一次性取出库存，返回 {商品id: 当前库存}"""
    query = db.query(Inventory.product_id, Inventory.current_stock)
    if product_ids is not None:
        if not product_ids:
            return {}
        query = query.filter(Inventory.product_id.in_(product_ids))
    return {pid: int(stock or 0) for pid, stock in query.all()}


def list_products(
    db: Session,
    keyword: Optional[str] = None,
    category_id: Optional[int] = None,
    status: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
) -> Tuple[List[dict], int]:
    """商品分页列表，每项带分类名与当前库存"""
    query = db.query(Product)
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.filter(or_(Product.name.like(like), Product.sku.like(like)))
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
    if status is not None:
        query = query.filter(Product.status == status)

    total = query.count()
    rows = (
        query.order_by(Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    category_map = get_category_map(db)
    stock_map = get_stock_map(db, [p.id for p in rows])
    items = [
        p.to_dict(category_map.get(p.category_id, ""), stock_map.get(p.id, 0))
        for p in rows
    ]
    return items, total


def get_product(db: Session, product_id: int) -> Optional[dict]:
    """商品详情（含分类名与库存）"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    category_map = get_category_map(db)
    stock_map = get_stock_map(db, [product.id])
    return product.to_dict(category_map.get(product.category_id, ""), stock_map.get(product.id, 0))


def create_product(db: Session, data: dict) -> dict:
    """新建商品，并同步创建库存记录"""
    stock = data.pop("stock", 0) or 0
    safe_stock = data.pop("safe_stock", 20)
    safe_stock = 20 if safe_stock is None else safe_stock

    product = Product(**{k: data[k] for k in _PRODUCT_FIELDS if k in data})
    db.add(product)
    db.flush()  # 拿到自增 id

    inventory = Inventory(
        product_id=product.id,
        current_stock=int(stock),
        safe_stock=int(safe_stock),
    )
    db.add(inventory)
    db.commit()
    db.refresh(product)

    category_map = get_category_map(db)
    return product.to_dict(category_map.get(product.category_id, ""), int(stock))


def update_product(db: Session, product_id: int, data: dict) -> Optional[dict]:
    """修改商品；若传了 stock 则同步更新库存表"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None

    stock = data.pop("stock", None)
    safe_stock = data.pop("safe_stock", None)

    for field in _PRODUCT_FIELDS:
        if field in data and data[field] is not None:
            setattr(product, field, data[field])

    inventory = db.query(Inventory).filter(Inventory.product_id == product_id).first()
    if stock is not None or safe_stock is not None:
        if not inventory:
            inventory = Inventory(product_id=product_id, current_stock=0, safe_stock=20)
            db.add(inventory)
        if stock is not None:
            inventory.current_stock = int(stock)
        if safe_stock is not None:
            inventory.safe_stock = int(safe_stock)

    db.commit()
    db.refresh(product)

    category_map = get_category_map(db)
    current_stock = inventory.current_stock if inventory else 0
    return product.to_dict(category_map.get(product.category_id, ""), int(current_stock or 0))


def update_product_status(db: Session, product_id: int, status: int) -> Optional[dict]:
    """上下架"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    product.status = int(status)
    db.commit()
    db.refresh(product)
    return product.to_dict()


def delete_product(db: Session, product_id: int) -> bool:
    """删除商品，同时删除库存记录（订单明细保留快照）"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return False
    db.query(Inventory).filter(Inventory.product_id == product_id).delete()
    db.delete(product)
    db.commit()
    return True
