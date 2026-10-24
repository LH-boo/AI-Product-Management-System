"""
库存业务逻辑

库存状态由 Inventory.status() 计算得到：normal / warning / out_of_stock / overstock。
库存不足等业务异常统一抛 ValueError，由 api 层捕获后返回 fail(消息)。
"""
from typing import List, Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.inventory import Inventory
from models.product import Product
from models.system_log import SystemLog


def _build_items(rows: List[Tuple[Inventory, Product]]) -> List[dict]:
    return [inv.to_dict(product.name, product.sku) for inv, product in rows]


def list_inventory(
    db: Session,
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> Tuple[List[dict], int]:
    """库存分页列表，关联商品名称与 sku"""
    query = db.query(Inventory, Product).join(Product, Inventory.product_id == Product.id)
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.filter(or_(Product.name.like(like), Product.sku.like(like)))

    if status:
        # status 是 Python 计算值，无法直接在 SQL 中过滤，先取出匹配行再切片
        items = [item for item in _build_items(query.all()) if item["status"] == status]
        total = len(items)
        start = (page - 1) * page_size
        return items[start:start + page_size], total

    total = query.count()
    rows = (
        query.order_by(Inventory.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return _build_items(rows), total


def get_inventory(db: Session, product_id: int) -> Optional[Inventory]:
    """按商品id取库存记录"""
    return db.query(Inventory).filter(Inventory.product_id == product_id).first()


def stock_in(db: Session, product_id: int, quantity: int, remark: str = "") -> dict:
    """入库：增加库存并写操作日志"""
    if not quantity or int(quantity) <= 0:
        raise ValueError("入库数量必须大于0")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError("商品不存在")

    inventory = get_inventory(db, product_id)
    if not inventory:
        inventory = Inventory(product_id=product_id, current_stock=0, safe_stock=20)
        db.add(inventory)

    inventory.current_stock = int(inventory.current_stock or 0) + int(quantity)
    db.add(
        SystemLog(
            level="INFO",
            module="inventory",
            message=f"商品[{product.name}]入库 {quantity}，当前库存 {inventory.current_stock}"
                    + (f"，备注：{remark}" if remark else ""),
        )
    )
    db.commit()
    db.refresh(inventory)
    return inventory.to_dict(product.name, product.sku)


def stock_out(db: Session, product_id: int, quantity: int, remark: str = "") -> dict:
    """出库：扣减库存，库存不足时抛业务异常"""
    if not quantity or int(quantity) <= 0:
        raise ValueError("出库数量必须大于0")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError("商品不存在")

    inventory = get_inventory(db, product_id)
    current = int(inventory.current_stock or 0) if inventory else 0
    if not inventory or current < int(quantity):
        raise ValueError(f"库存不足，当前库存 {current}")

    inventory.current_stock = current - int(quantity)
    db.add(
        SystemLog(
            level="INFO",
            module="inventory",
            message=f"商品[{product.name}]出库 {quantity}，当前库存 {inventory.current_stock}"
                    + (f"，备注：{remark}" if remark else ""),
        )
    )
    db.commit()
    db.refresh(inventory)
    return inventory.to_dict(product.name, product.sku)


def warning_list(db: Session) -> List[dict]:
    """库存预警列表：current_stock <= safe_stock（含缺货），缺货排最前，其余按库存升序"""
    rows = (
        db.query(Inventory, Product)
        .join(Product, Inventory.product_id == Product.id)
        .filter(Inventory.current_stock <= Inventory.safe_stock)
        .all()
    )
    items = _build_items(rows)
    items.sort(key=lambda x: (0 if x["current_stock"] <= 0 else 1, x["current_stock"]))
    return items
