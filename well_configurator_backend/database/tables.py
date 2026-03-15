from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class ProductModel:
    id: str
    name: str
    version: int = 1
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    sync_status: str = "synced"
    category: Optional[str] = None
    dn: Optional[int] = None
    componentType: Optional[str] = None
    height: Optional[int] = None
    zapasDol: Optional[int] = None
    zapasGora: Optional[int] = None
    zapasDolMin: Optional[int] = None
    zapasGoraMin: Optional[int] = None
    magazynWL: int = 1
    magazynKLB: int = 1
    formaStandardowaWL: int = 1
    formaStandardowaKLB: int = 1
