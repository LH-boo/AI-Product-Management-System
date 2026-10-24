"""商品管理接口 /api/products"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services import product_service
from utils.response import fail, ok, page

router = APIRouter(prefix="/api/products", tags=["商品管理"])


class ProductCreate(BaseModel):
    """新建商品入参"""
    name: str
    sku: str = ""
    category_id: int = 0
    brand: str = ""
    price: float = 0
    cost: float = 0
    image: str = ""
    description: str = ""
    status: int = 1
    stock: int = 0
    safe_stock: int = 20


class ProductUpdate(BaseModel):
    """修改商品入参（只传需要修改的字段）"""
    name: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[int] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    image: Optional[str] = None
    description: Optional[str] = None
    status: Optional[int] = None
    stock: Optional[int] = None
    safe_stock: Optional[int] = None


class ProductStatusIn(BaseModel):
    """上下架入参"""
    status: int


def _parse_int(value: Optional[str]) -> Optional[int]:
    """把可能为空的查询参数安全转成 int，非法值直接忽略"""
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        return int(text)
    except ValueError:
        return None


@router.get("")
def list_products(
    keyword: Optional[str] = Query(None, description="按商品名称/编码模糊搜索"),
    category_id: Optional[str] = Query(None, description="分类id"),
    status: Optional[str] = Query(None, description="1上架 0下架"),
    page_num: int = Query(1, alias="page", ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=200, description="每页条数"),
    db: Session = Depends(get_db),
):
    """商品分页列表"""
    items, total = product_service.list_products(
        db,
        keyword=keyword,
        category_id=_parse_int(category_id),
        status=_parse_int(status),
        page=page_num,
        page_size=page_size,
    )
    return ok(page(items, total, page_num, page_size))


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    """商品详情"""
    data = product_service.get_product(db, product_id)
    if not data:
        return fail("商品不存在")
    return ok(data)


@router.post("")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    """新建商品（同时创建库存记录）"""
    if not payload.name or not payload.name.strip():
        return fail("商品名称不能为空")
    data = product_service.create_product(db, payload.model_dump())
    return ok(data, "创建成功")


@router.put("/{product_id}")
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    """修改商品"""
    data = product_service.update_product(db, product_id, payload.model_dump(exclude_unset=True))
    if not data:
        return fail("商品不存在")
    return ok(data, "修改成功")


@router.put("/{product_id}/status")
def update_product_status(
    product_id: int, payload: ProductStatusIn, db: Session = Depends(get_db)
):
    """商品上下架"""
    data = product_service.update_product_status(db, product_id, payload.status)
    if not data:
        return fail("商品不存在")
    return ok(data, "上下架成功")


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """删除商品（同时删除库存记录，订单明细保留快照）"""
    if not product_service.delete_product(db, product_id):
        return fail("商品不存在")
    return ok(None, "删除成功")
