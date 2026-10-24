"""订单管理接口 /api/orders"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services import order_service
from utils.response import fail, ok, page

router = APIRouter(prefix="/api/orders", tags=["订单管理"])


class OrderItemIn(BaseModel):
    """订单明细入参"""
    product_id: int
    quantity: int = 1


class OrderCreate(BaseModel):
    """创建订单入参"""
    customer_id: int = 0
    customer_name: str = ""
    remark: str = ""
    items: List[OrderItemIn] = []


class OrderUpdate(BaseModel):
    """修改订单入参"""
    status: Optional[str] = None
    remark: Optional[str] = None


@router.get("")
def list_orders(
    keyword: Optional[str] = Query(None, description="按订单号/下单人模糊搜索"),
    status: Optional[str] = Query(None, description="订单状态"),
    page_num: int = Query(1, alias="page", ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=200, description="每页条数"),
    db: Session = Depends(get_db),
):
    """订单分页列表"""
    items, total = order_service.list_orders(
        db,
        keyword=keyword,
        status=status,
        page=page_num,
        page_size=page_size,
    )
    return ok(page(items, total, page_num, page_size))


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    """订单详情（含明细）"""
    data = order_service.get_order(db, order_id)
    if not data:
        return fail("订单不存在")
    return ok(data)


@router.post("")
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    """创建订单（自动扣减库存）"""
    try:
        data = order_service.create_order(db, payload.model_dump())
    except ValueError as exc:
        return fail(str(exc))
    return ok(data, "下单成功")


@router.put("/{order_id}")
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db)):
    """修改订单状态/备注（校验状态流转）"""
    try:
        data = order_service.update_order_status(
            db,
            order_id,
            status=payload.status,
            remark=payload.remark,
        )
    except ValueError as exc:
        return fail(str(exc))
    if not data:
        return fail("订单不存在")
    return ok(data, "修改成功")


@router.post("/{order_id}/cancel")
def cancel_order(order_id: int, db: Session = Depends(get_db)):
    """取消订单（归还库存）"""
    try:
        data = order_service.cancel_order(db, order_id)
    except ValueError as exc:
        return fail(str(exc))
    if not data:
        return fail("订单不存在")
    return ok(data, "已取消")
