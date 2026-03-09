from sqlalchemy.orm import Session
from . import tables

def get_product(db: Session, product_id: str):
    return db.query(tables.ProductModel).filter(tables.ProductModel.id == product_id).first()

def get_products_by_dn(db: Session, dn: int, warehouse: str):
    query = db.query(tables.ProductModel).filter(
        (tables.ProductModel.dn == dn) | (tables.ProductModel.dn.is_(None))
    )
    if warehouse == "WL":
        query = query.filter(tables.ProductModel.magazynWL == 1)
    else:
        query = query.filter(tables.ProductModel.magazynKLB == 1)
        
    return query.all()

def sync_products(db: Session, updates: list[dict]):
    # Prosta logika synchronizacji offline-first
    # Last write wins wg updated_at albo conflict logic
    pass
