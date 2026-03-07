from sqlalchemy import Column, String, Integer, Float, DateTime
from sqlalchemy.sql import func
from .local_db import Base

class ProductModel(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, index=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    sync_status = Column(String, default="synced") # pending, synced, conflict

    name = Column(String, nullable=False)
    category = Column(String)
    dn = Column(Integer, nullable=True) # None for non-dn specific items like właz
    componentType = Column(String) # dennica, krag, krag_ot, konus, plyta_din, plyta_redukcyjna, plyta_zamykajaca, pierscien_odciazajacy, przejscie
    height = Column(Integer, nullable=True) # in mm
    zapasDol = Column(Integer, nullable=True)
    zapasGora = Column(Integer, nullable=True)
    zapasDolMin = Column(Integer, nullable=True)
    zapasGoraMin = Column(Integer, nullable=True)

    # Warehouse availability and standard forms
    magazynWL = Column(Integer, default=1)
    magazynKLB = Column(Integer, default=1)
    formaStandardowaWL = Column(Integer, default=1)
    formaStandardowaKLB = Column(Integer, default=1)
