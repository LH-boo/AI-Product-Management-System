"""商品分类接口 /api/categories（支持两级：手机 -> iPhone）"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.category import Category
from models.product import Product
from utils.response import fail, ok

router = APIRouter(prefix="/api/categories", tags=["商品分类"])


class CategoryCreate(BaseModel):
    """新建分类入参"""
    name: str
    parent_id: int = 0
    sort: int = 0
    description: str = ""
    status: int = 1


class CategoryUpdate(BaseModel):
    """修改分类入参"""
    name: Optional[str] = None
    parent_id: Optional[int] = None
    sort: Optional[int] = None
    description: Optional[str] = None
    status: Optional[int] = None


def _all_categories(db: Session):
    """按排序字段取出全部分类"""
    return db.query(Category).order_by(Category.sort.asc(), Category.id.asc()).all()


@router.get("")
def list_categories(
    tree: bool = Query(True, description="true 返回两级树形结构，false 返回扁平列表"),
    db: Session = Depends(get_db),
):
    """分类列表"""
    categories = _all_categories(db)

    if tree:
        children_map = {}
        for category in categories:
            if category.parent_id:
                children_map.setdefault(category.parent_id, []).append(category)

        data = []
        for category in categories:
            if category.parent_id:
                continue
            children = [
                child.to_dict(children=[]) for child in children_map.get(category.id, [])
            ]
            data.append(category.to_dict(children=children))
        return ok(data)

    # 扁平列表：带 children 空数组与商品数量
    counts = dict(
        db.query(Product.category_id, func.count(Product.id)).group_by(Product.category_id).all()
    )
    data = []
    for category in categories:
        item = category.to_dict(children=[])
        item["product_count"] = int(counts.get(category.id, 0))
        data.append(item)
    return ok(data)


@router.post("")
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    """新建分类"""
    if not payload.name or not payload.name.strip():
        return fail("分类名称不能为空")

    parent_id = int(payload.parent_id or 0)
    if parent_id:
        parent = db.query(Category).filter(Category.id == parent_id).first()
        if not parent:
            return fail("父分类不存在")

    category = Category(
        name=payload.name.strip(),
        parent_id=parent_id,
        sort=payload.sort,
        description=payload.description,
        status=payload.status,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return ok(category.to_dict(children=[]), "创建成功")


@router.put("/{category_id}")
def update_category(
    category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)
):
    """修改分类"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        return fail("分类不存在")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return ok(category.to_dict(children=[]), "修改成功")


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """删除分类：存在子分类或商品时不允许删除"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        return fail("分类不存在")

    child_count = (
        db.query(func.count(Category.id)).filter(Category.parent_id == category_id).scalar() or 0
    )
    product_count = (
        db.query(func.count(Product.id)).filter(Product.category_id == category_id).scalar() or 0
    )
    if child_count or product_count:
        return fail("该分类下存在子分类或商品，无法删除")

    db.delete(category)
    db.commit()
    return ok(None, "删除成功")
