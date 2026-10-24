"""数据分析接口 /api/analytics（传统 SQL 统计，不调用大模型）"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from services import analytics_service
from utils.response import ok

router = APIRouter(prefix="/api/analytics", tags=["数据分析"])


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    """首页总览指标"""
    return ok(analytics_service.overview(db))


@router.get("/sales/trend")
def sales_trend(
    days: int = Query(7, ge=1, le=90, description="统计天数"),
    db: Session = Depends(get_db),
):
    """销售趋势（按天补零，日期升序）"""
    return ok(analytics_service.sales_trend(db, days))


@router.get("/sales/category")
def sales_category(db: Session = Depends(get_db)):
    """分类销售占比"""
    return ok(analytics_service.sales_by_category(db))


@router.get("/top-products")
def top_products(
    limit: int = Query(5, ge=1, le=50, description="取前N条"),
    db: Session = Depends(get_db),
):
    """热销商品 Top N"""
    return ok(analytics_service.top_products(db, limit))


@router.get("/inventory")
def inventory_analysis(db: Session = Depends(get_db)):
    """库存分析（销量前10的商品）"""
    return ok(analytics_service.inventory_analysis(db))
