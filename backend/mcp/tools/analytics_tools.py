"""
经营分析相关 MCP 工具（销售统计、热销商品排行）
"""
from datetime import datetime, timedelta
from typing import List

from sqlalchemy import func

from database import SessionLocal
from models.order import Order, OrderItem
from models.product import Product

# 不纳入销售额统计的订单状态
_EXCLUDED_STATUS = ("cancelled",)


def get_sales_statistics(days: int = 30) -> dict:
    """统计最近若干天的销售情况（按订单创建时间过滤，已取消订单不计入销售额）。

    参数：
        days: 统计天数，默认 30 天
    返回：dict，包含销售额、有效订单数、客单价、售出商品件数，
          以及最近 7 天每日销售额趋势和销售额 Top5 商品。
    """
    db = SessionLocal()
    try:
        days = int(days or 30)
        since = datetime.now() - timedelta(days=days)

        valid_orders = db.query(Order).filter(
            Order.created_at >= since, ~Order.status.in_(_EXCLUDED_STATUS)
        )
        order_count = valid_orders.count()
        sales_amount = float(
            db.query(func.coalesce(func.sum(Order.total_amount), 0))
            .filter(Order.created_at >= since, ~Order.status.in_(_EXCLUDED_STATUS))
            .scalar()
            or 0
        )

        sold_quantity = int(
            db.query(func.coalesce(func.sum(OrderItem.quantity), 0))
            .join(Order, Order.id == OrderItem.order_id)
            .filter(Order.created_at >= since, ~Order.status.in_(_EXCLUDED_STATUS))
            .scalar()
            or 0
        )

        # 每日销售额趋势（最近 min(days, 7) 天）
        trend_days = min(days, 7)
        trend_since = datetime.now() - timedelta(days=trend_days - 1)
        day_expr = func.date(Order.created_at)
        trend_rows = (
            db.query(day_expr, func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0))
            .filter(Order.created_at >= trend_since, ~Order.status.in_(_EXCLUDED_STATUS))
            .group_by(day_expr)
            .order_by(day_expr)
            .all()
        )
        daily_trend = [
            {"date": str(day), "count": int(count or 0), "amount": float(amount or 0)}
            for day, count, amount in trend_rows
        ]

        # 销售额 Top5 商品
        top_rows = (
            db.query(
                OrderItem.product_id,
                OrderItem.product_name,
                func.coalesce(func.sum(OrderItem.quantity), 0),
                func.coalesce(func.sum(OrderItem.subtotal), 0),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(Order.created_at >= since, ~Order.status.in_(_EXCLUDED_STATUS))
            .group_by(OrderItem.product_id, OrderItem.product_name)
            .order_by(func.coalesce(func.sum(OrderItem.subtotal), 0).desc())
            .limit(5)
            .all()
        )
        top_products = [
            {
                "product_id": int(product_id or 0),
                "product_name": name or "",
                "quantity": int(quantity or 0),
                "amount": round(float(amount or 0), 2),
            }
            for product_id, name, quantity, amount in top_rows
        ]

        return {
            "days": days,
            "sales_amount": round(sales_amount, 2),
            "order_count": order_count,
            "average_amount": round(sales_amount / order_count, 2) if order_count else 0,
            "sold_quantity": sold_quantity,
            "daily_trend": daily_trend,
            "top_products": top_products,
        }
    finally:
        db.close()


def get_top_products(limit: int = 5) -> dict:
    """查询热销商品排行。

    参数：
        limit: 返回条数上限，默认 5
    返回：dict，包含按累计销量排名的商品列表，每项含商品名称、分类、售价、
          累计销量、当前库存；同时给出基于订单明细的销量排行作为参考。
    """
    db = SessionLocal()
    try:
        limit = int(limit or 5)
        rows = (
            db.query(Product)
            .order_by(Product.sales.desc(), Product.id.desc())
            .limit(limit)
            .all()
        )
        # 商品自身的累计销量（products.sales 字段）
        by_product_field = [
            {
                "product_id": p.id,
                "product_name": p.name,
                "brand": p.brand or "",
                "price": float(p.price or 0),
                "sales": int(p.sales or 0),
            }
            for p in rows
        ]

        # 基于订单明细的实际成交量排行
        order_rows = (
            db.query(
                OrderItem.product_id,
                OrderItem.product_name,
                func.coalesce(func.sum(OrderItem.quantity), 0),
                func.coalesce(func.sum(OrderItem.subtotal), 0),
            )
            .group_by(OrderItem.product_id, OrderItem.product_name)
            .order_by(func.coalesce(func.sum(OrderItem.quantity), 0).desc())
            .limit(limit)
            .all()
        )
        by_order_items = [
            {
                "product_id": int(product_id or 0),
                "product_name": name or "",
                "quantity": int(quantity or 0),
                "amount": round(float(amount or 0), 2),
            }
            for product_id, name, quantity, amount in order_rows
        ]

        return {
            "limit": limit,
            "by_sales_field": by_product_field,
            "by_order_items": by_order_items,
        }
    finally:
        db.close()
