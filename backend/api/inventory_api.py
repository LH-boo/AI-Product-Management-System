"""库存管理接口 /api/inventory"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services import inventory_service
from utils.response import fail, ok, page

router = APIRouter(prefix="/api/inventory", tags=["库存管理"])


class StockIn(BaseModel):
    """入库入参"""
    product_id: int
    quantity: int
    remark: str = ""


class StockOut(BaseModel):
    """出库入参"""
    product_id: int
    quantity: int
    remark: str = ""


@router.get("")
def list_inventory(
    keyword: Optional[str] = Query(None, description="按商品名称/编码模糊搜索"),
    status: Optional[str] = Query(
        None, description="normal 正常 / warning 预警 / out_of_stock 缺货 / overstock 积压"
    ),
    page_num: int = Query(1, alias="page", ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=200, description="每页条数"),
    db: Session = Depends(get_db),
):
    """库存分页列表"""
    items, total = inventory_service.list_inventory(
        db,
        keyword=keyword,
        status=status,
        page=page_num,
        page_size=page_size,
    )
    return ok(page(items, total, page_num, page_size))


@router.get("/warning")
def warning_list(db: Session = Depends(get_db)):
    """库存预警列表（含缺货，缺货排最前）"""
    return ok(inventory_service.warning_list(db))


@router.post("/in")
def stock_in(payload: StockIn, db: Session = Depends(get_db)):
    """入库"""
    try:
        data = inventory_service.stock_in(db, payload.product_id, payload.quantity, payload.remark)
    except ValueError as exc:
        return fail(str(exc))
    return ok(data, "入库成功")


@router.post("/out")
def stock_out(payload: StockOut, db: Session = Depends(get_db)):
    """出库"""
    try:
        data = inventory_service.stock_out(db, payload.product_id, payload.quantity, payload.remark)
    except ValueError as exc:
        return fail(str(exc))
    return ok(data, "出库成功")
