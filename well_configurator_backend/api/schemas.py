from pydantic import BaseModel
from typing import Optional, List

class TransitionInput(BaseModel):
    id: str
    height_from_bottom_mm: int  # Wysokość w mm od dna do środka rury
    angle: Optional[float] = 0.0

class WellConfigInput(BaseModel):
    dn: int # np. 1000, 1200, 1500, 2000, 2500
    target_height_mm: int # np. 3500 (od dna do włazu w mm)
    transitions: List[TransitionInput] = []
    
    # Redukcja
    use_reduction: bool = False
    
    # Zakończenie (domyślnie konus)
    forced_top_closure_id: Optional[str] = None
    
    # Magazyn kontekstowy ("WL" lub "KLB")
    warehouse: str = "KLB"

class ItemDetail(BaseModel):
    product_id: str
    name: str
    component_type: str
    quantity: int = 1
    height_mm: int = 0
    is_ot: bool = False
    
class WellConfigResult(BaseModel):
    is_valid: bool
    total_height_mm: int
    items: List[ItemDetail] # Ordered bottom to top
    errors: List[str] = []
    has_minimal_clearance: bool = False
    score: float = 0.0

class SyncItem(BaseModel):
    item_id: str
    # further sync metadata

class SyncRequest(BaseModel):
    changes: List[SyncItem]
