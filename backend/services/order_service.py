"""
订单业务逻辑

- 创建订单：生成订单号、写入明细、扣减库存、回写客户统计；
- 状态流转：严格按 ORDER_STATUS_FLOW 校验，非法流转抛 ValueError；
- 取消订单：归还库存。
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.customer import Customer
from models.inventory import Inventory
from models.order import ORDER_STATUS, ORDER_STATUS_FLOW, Order, OrderItem
from models.product import Product
from services.inventory_service import get_inventory


def _to_dict_with_items(db: Session, order: Order) -> dict:
    items = (
        db.query(OrderItem)
        .filter(OrderItem.order_id == order.id)
        .order_by(OrderItem.id.asc())
        .all()
    )
    return order.to_dict([item.to_dict() for item in items])


def _gen_order_no(db: Session) -> str:
    """订单号：SO + yyyyMMdd + 3位当日序号"""
    prefix = "SO" + datetime.now().strftime("%Y%m%d")
    last = (
        db.query(Order.order_no)
        .filter(Order.order_no.like(f"{prefix}%"))
        .order_by(Order.order_no.desc())
        .first()
    )
    seq = 1
    if last and last[0][len(prefix):].isdigit():
        seq = int(last[0][len(prefix):]) + 1
    return f"{prefix}{seq:03d}"


def list_orders(
    db: Session,
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> Tuple[List[dict], int]:
    """订单分页列表"""
    query = db.query(Order)
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.filter(or_(Order.order_no.like(like), Order.customer_name.like(like)))
    if status:
        query = query.filter(Order.status == status)

    total = query.count()
    rows = (
        query.order_by(Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [order.to_dict() for order in rows], total


def get_order(db: Session, order_id: int) -> Optional[dict]:
    """订单详情（含明细）"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return None
    return _to_dict_with_items(db, order)


def create_order(db: Session, data: dict) -> dict:
    """创建订单"""
    items = data.get("items") or []
    if not items:
        raise ValueError("订单明细不能为空")

    try:
        # ---------- 1. 校验商品与库存 ----------
        product_map = {}
        inventory_map = {}
        need_map = {}
        for item in items:
            product_id = int(item.get("product_id") or 0)
            quantity = int(item.get("quantity") or 0)
            if quantity <= 0:
                raise ValueError("商品数量必须大于0")

            if product_id not in product_map:
                product = db.query(Product).filter(Product.id == product_id).first()
                if not product:
                    raise ValueError(f"商品(id={product_id})不存在")
                product_map[product_id] = product
                inventory_map[product_id] = get_inventory(db, product_id)
            need_map[product_id] = need_map.get(product_id, 0) + quantity

        for product_id, quantity in need_map.items():
            inventory = inventory_map[product_id]
            current = int(inventory.current_stock or 0) if inventory else 0
            if current < quantity:
                raise ValueError(
                    f"商品[{product_map[product_id].name}]库存不足，当前库存 {current}"
                )

        # ---------- 2. 创建订单 ----------
        customer_id = int(data.get("customer_id") or 0)
        customer = None
        if customer_id:
            customer = db.query(Customer).filter(Customer.id == customer_id).first()

        customer_name = (data.get("customer_name") or "").strip()
        if not customer_name and customer:
            customer_name = customer.name

        order = Order(
            order_no=_gen_order_no(db),
            customer_id=customer_id,
            customer_name=customer_name,
            status="pending",
            remark=data.get("remark") or "",
            total_amount=Decimal("0"),
        )
        db.add(order)
        db.flush()

        # ---------- 3. 写入明细 + 扣减库存 ----------
        total_amount = Decimal("0")
        for product_id, quantity in need_map.items():
            product = product_map[product_id]
            price = Decimal(str(product.price or 0))
            subtotal = price * quantity
            total_amount += subtotal

            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product_id,
                    product_name=product.name,
                    price=price,
                    quantity=quantity,
                    subtotal=subtotal,
                )
            )

            inventory = inventory_map[product_id]
            if not inventory:
                inventory = Inventory(product_id=product_id, current_stock=0, safe_stock=20)
                db.add(inventory)
            inventory.current_stock = int(inventory.current_stock or 0) - quantity
            product.sales = int(product.sales or 0) + quantity

        order.total_amount = total_amount

        # ---------- 4. 回写客户统计 ----------
        if customer:
            customer.total_orders = int(customer.total_orders or 0) + 1
            customer.total_amount = Decimal(str(customer.total_amount or 0)) + total_amount
            customer.last_order_time = datetime.now()

        db.commit()
        db.refresh(order)
        return _to_dict_with_items(db, order)
    except Exception:
        db.rollback()
        raise


def update_order_status(
    db: Session,
    order_id: int,
    status: Optional[str] = None,
    remark: Optional[str] = None,
) -> Optional[dict]:
    """修改订单状态（校验状态流转）与备注"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return None

    try:
        if status and status != order.status:
            if status not in ORDER_STATUS:
                raise ValueError("订单状态不合法")
            allowed = ORDER_STATUS_FLOW.get(order.status, [])
            if status not in allowed:
                raise ValueError(
                    f"订单状态不能从 {ORDER_STATUS.get(order.status, order.status)} "
                    f"变更为 {ORDER_STATUS.get(status, status)}"
                )
            if status == "cancelled":
                _return_stock(db, order)
            order.status = status

        if remark is not None:
            order.remark = remark

        db.commit()
        db.refresh(order)
        return _to_dict_with_items(db, order)
    except Exception:
        db.rollback()
        raise


def cancel_order(db: Session, order_id: int) -> Optional[dict]:
    """取消订单并归还库存"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return None
    if order.status == "cancelled":
        raise ValueError("订单已取消，无需重复操作")
    return update_order_status(db, order_id, "cancelled")


def _return_stock(db: Session, order: Order) -> None:
    """取消订单时把明细数量归还到库存"""
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    for item in items:
        inventory = get_inventory(db, item.product_id)
        if not inventory:
            inventory = Inventory(
                product_id=item.product_id, current_stock=0, safe_stock=20
            )
            db.add(inventory)
        inventory.current_stock = int(inventory.current_stock or 0) + int(item.quantity or 0)

        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.sales = max(0, int(product.sales or 0) - int(item.quantity or 0))
