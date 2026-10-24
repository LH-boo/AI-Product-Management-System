"""
数据分析业务逻辑（全部为传统 SQL 统计，不调用大模型）

统计口径：
- 销售额 / 分类占比 / 热销商品：均排除已取消订单；
- 库存预警数：current_stock <= safe_stock 的商品数。
"""
from datetime import date, datetime, time, timedelta
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.category import Category
from models.customer import Customer
from models.inventory import Inventory
from models.order import Order, OrderItem
from models.product import Product


def overview(db: Session) -> dict:
    """首页总览指标"""
    product_count = db.query(func.count(Product.id)).scalar() or 0
    category_count = db.query(func.count(Category.id)).scalar() or 0
    order_count = db.query(func.count(Order.id)).scalar() or 0
    customer_count = db.query(func.count(Customer.id)).scalar() or 0

    sales_amount = (
        db.query(func.sum(Order.total_amount))
        .filter(Order.status != "cancelled")
        .scalar()
    )
    stock_total = db.query(func.sum(Inventory.current_stock)).scalar()

    today_start = datetime.combine(date.today(), time.min)
    today_order_count = (
        db.query(func.count(Order.id)).filter(Order.created_at >= today_start).scalar() or 0
    )
    low_stock_count = (
        db.query(func.count(Inventory.id))
        .filter(Inventory.current_stock <= Inventory.safe_stock)
        .scalar()
        or 0
    )
    pending_order_count = (
        db.query(func.count(Order.id)).filter(Order.status == "pending").scalar() or 0
    )

    return {
        "product_count": int(product_count),
        "category_count": int(category_count),
        "order_count": int(order_count),
        "sales_amount": float(sales_amount or 0),
        "stock_total": int(stock_total or 0),
        "customer_count": int(customer_count),
        "today_order_count": int(today_order_count),
        "low_stock_count": int(low_stock_count),
        "pending_order_count": int(pending_order_count),
    }


def sales_trend(db: Session, days: int = 7) -> List[dict]:
    """近 N 天销售趋势，按天补零、日期升序，格式 %m-%d"""
    days = max(1, int(days or 7))
    start_day = date.today() - timedelta(days=days - 1)
    start_time = datetime.combine(start_day, time.min)

    rows = (
        db.query(
            func.date(Order.created_at).label("day"),
            func.sum(Order.total_amount).label("amount"),
            func.count(Order.id).label("count"),
        )
        .filter(Order.created_at >= start_time, Order.status != "cancelled")
        .group_by(func.date(Order.created_at))
        .all()
    )
    bucket = {
        str(day)[:10]: {"amount": float(amount or 0), "count": int(count or 0)}
        for day, amount, count in rows
    }

    result = []
    for offset in range(days):
        current = start_day + timedelta(days=offset)
        data = bucket.get(current.isoformat(), {"amount": 0.0, "count": 0})
        result.append(
            {
                "date": current.strftime("%m-%d"),
                "amount": round(data["amount"], 2),
                "count": data["count"],
            }
        )
    return result


def sales_by_category(db: Session) -> List[dict]:
    """分类销售占比（按订单明细关联商品分类），降序"""
    rows = (
        db.query(
            Category.name.label("name"),
            func.sum(OrderItem.subtotal).label("amount"),
        )
        .select_from(OrderItem)
        .join(Product, OrderItem.product_id == Product.id)
        .join(Category, Product.category_id == Category.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status != "cancelled")
        .group_by(Category.id, Category.name)
        .all()
    )

    total = sum(float(amount or 0) for _, amount in rows)
    result = [
        {
            "name": name,
            "amount": round(float(amount or 0), 2),
            "ratio": round(float(amount or 0) / total * 100, 1) if total else 0.0,
        }
        for name, amount in rows
    ]
    result.sort(key=lambda x: x["amount"], reverse=True)
    return result


def top_products(db: Session, limit: int = 5) -> List[dict]:
    """热销商品 Top N（按销量降序）"""
    limit = max(1, int(limit or 5))
    sales_sub = (
        db.query(
            OrderItem.product_id.label("pid"),
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.subtotal).label("amount"),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status != "cancelled")
        .group_by(OrderItem.product_id)
        .subquery()
    )

    rows = (
        db.query(
            Product.id,
            Product.name,
            func.coalesce(sales_sub.c.qty, 0).label("sales"),
            func.coalesce(sales_sub.c.amount, 0).label("amount"),
        )
        .outerjoin(sales_sub, sales_sub.c.pid == Product.id)
        .order_by(func.coalesce(sales_sub.c.qty, 0).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": pid,
            "name": name,
            "sales": int(sales or 0),
            "amount": round(float(amount or 0), 2),
        }
        for pid, name, sales, amount in rows
    ]


def inventory_analysis(db: Session, limit: int = 10) -> List[dict]:
    """库存分析：取销量前 N 的商品，返回当前库存与安全库存"""
    limit = max(1, int(limit or 10))
    rows = (
        db.query(
            Product.name.label("name"),
            Inventory.current_stock.label("current_stock"),
            Inventory.safe_stock.label("safe_stock"),
        )
        .outerjoin(Inventory, Inventory.product_id == Product.id)
        .order_by(Product.sales.desc(), Product.id.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "name": name,
            "current_stock": int(current_stock or 0),
            "safe_stock": int(safe_stock or 0),
        }
        for name, current_stock, safe_stock in rows
    ]
