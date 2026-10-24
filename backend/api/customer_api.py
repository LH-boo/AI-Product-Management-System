"""客户管理接口 /api/customers"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models.customer import Customer
from models.order import Order
from utils.response import fail, ok, page

router = APIRouter(prefix="/api/customers", tags=["客户管理"])


class CustomerCreate(BaseModel):
    """新建客户入参"""
    name: str
    phone: str = ""
    email: str = ""
    level: str = "normal"
    status: int = 1


class CustomerUpdate(BaseModel):
    """修改客户入参"""
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    level: Optional[str] = None
    status: Optional[int] = None


@router.get("")
def list_customers(
    keyword: Optional[str] = Query(None, description="按姓名/手机号/邮箱模糊搜索"),
    level: Optional[str] = Query(None, description="normal / vip / svip"),
    page_num: int = Query(1, alias="page", ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=200, description="每页条数"),
    db: Session = Depends(get_db),
):
    """客户分页列表"""
    query = db.query(Customer)
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.filter(
            or_(Customer.name.like(like), Customer.phone.like(like), Customer.email.like(like))
        )
    if level:
        query = query.filter(Customer.level == level)

    total = query.count()
    rows = (
        query.order_by(Customer.id.desc())
        .offset((page_num - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ok(page([customer.to_dict() for customer in rows], total, page_num, page_size))


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """客户详情（附带最近10条订单）"""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return fail("客户不存在")

    recent_orders = (
        db.query(Order)
        .filter(Order.customer_id == customer_id)
        .order_by(Order.id.desc())
        .limit(10)
        .all()
    )
    data = customer.to_dict()
    data["orders"] = [order.to_dict() for order in recent_orders]
    return ok(data)


@router.post("")
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    """新建客户"""
    if not payload.name or not payload.name.strip():
        return fail("客户姓名不能为空")

    customer = Customer(
        name=payload.name.strip(),
        phone=payload.phone,
        email=payload.email,
        level=payload.level,
        status=payload.status,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return ok(customer.to_dict(), "创建成功")


@router.put("/{customer_id}")
def update_customer(
    customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)
):
    """修改客户"""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return fail("客户不存在")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return ok(customer.to_dict(), "修改成功")


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """删除客户"""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return fail("客户不存在")
    db.delete(customer)
    db.commit()
    return ok(None, "删除成功")
