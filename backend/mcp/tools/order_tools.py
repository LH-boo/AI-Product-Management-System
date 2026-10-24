"""
订单相关 MCP 工具
"""
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import func, or_

from database import SessionLocal
from models.order import ORDER_STATUS, Order


def _order_dict(order: Order) -> dict:
    """订单 ORM 转 dict（金额已转 float，状态带中文）"""
    return order.to_dict()


def search_order(
    order_no: Optional[str] = None,
    customer_name: Optional[str] = None,
    limit: int = 10,
) -> List[dict]:
    """查询订单。

    参数：
        order_no:      订单号关键词（模糊匹配），如不传则不按订单号过滤
        customer_name: 下单人姓名关键词（模糊匹配）
        limit:         返回条数上限，默认 10
    返回：订单列表，每项包含订单号、下单人、订单总额、状态等；
          两个过滤条件都不传时返回最近订单。
    """
    db = SessionLocal()
    try:
        query = db.query(Order)
        conditions = []
        if order_no and str(order_no).strip():
            conditions.append(Order.order_no.like(f"%{str(order_no).strip()}%"))
        if customer_name and str(customer_name).strip():
            conditions.append(Order.customer_name.like(f"%{str(customer_name).strip()}%"))
        if conditions:
            query = query.filter(or_(*conditions))
        rows = query.order_by(Order.id.desc()).limit(int(limit or 10)).all()
        return [_order_dict(order) for order in rows]
    finally:
        db.close()


def get_order_statistics(days: int = 30) -> dict:
    """统计最近若干天的订单情况（按订单创建时间过滤）。

    参数：
        days: 统计天数，默认 30 天
    返回：dict，包含订单总数、订单总金额、平均客单价、各状态订单数量与金额，
          以及最近 7 天的每日订单数与金额趋势。
    """
    db = SessionLocal()
    try:
        days = int(days or 30)
        since = datetime.now() - timedelta(days=days)
        base = db.query(Order).filter(Order.created_at >= since)

        order_count = base.count()
        total_amount = float(
            db.query(func.coalesce(func.sum(Order.total_amount), 0))
            .filter(Order.created_at >= since)
            .scalar()
            or 0
        )

        # 各状态数量与金额
        status_rows = (
            db.query(Order.status, func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0))
            .filter(Order.created_at >= since)
            .group_by(Order.status)
            .all()
        )
        by_status = [
            {
                "status": status,
                "status_text": ORDER_STATUS.get(status, status),
                "count": int(count or 0),
                "amount": float(amount or 0),
            }
            for status, count, amount in status_rows
        ]

        # 每日趋势（最近 min(days, 7) 天）
        trend_days = min(days, 7)
        trend_since = datetime.now() - timedelta(days=trend_days - 1)
        day_expr = func.date(Order.created_at)
        trend_rows = (
            db.query(day_expr, func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0))
            .filter(Order.created_at >= trend_since)
            .group_by(day_expr)
            .order_by(day_expr)
            .all()
        )
        daily_trend = [
            {"date": str(day), "count": int(count or 0), "amount": float(amount or 0)}
            for day, count, amount in trend_rows
        ]

        return {
            "days": days,
            "order_count": order_count,
            "total_amount": round(total_amount, 2),
            "average_amount": round(total_amount / order_count, 2) if order_count else 0,
            "by_status": by_status,
            "daily_trend": daily_trend,
        }
    finally:
        db.close()
