from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any

class TransitionInput(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
    height_from_bottom_mm: float  # Wysokość w mm od dna do dolnej krawędzi rury (invert)
    angle: Optional[float] = 0.0

class AvailableProduct(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str
    name: str = ""
    componentType: Optional[str] = None
    dn: Optional[Any] = None
    height: Optional[float] = 0
    formaStandardowaKLB: Optional[int] = 0
    formaStandardowaWL: Optional[int] = 0
    magazynWL: Optional[int] = 1
    magazynKLB: Optional[int] = 1
    zapasDol: Optional[float] = 0
    zapasGora: Optional[float] = 0
    zapasDolMin: Optional[float] = 0
    zapasGoraMin: Optional[float] = 0

class WellConfigInput(BaseModel):
    model_config = ConfigDict(extra='allow')
    dn: Any # np. 1000, 1200, 1500, 2000, 2500, "styczna"
    target_height_mm: int # np. 3500 (od dna do włazu w mm)
    transitions: List[TransitionInput] = []
    
    # Redukcja
    use_reduction: bool = False
    redukcjaMinH: Optional[float] = 2500.0  # Minimalna wysokość komory roboczej (od dna do płyty)
    
    # Zakończenie (domyślnie konus)
    forced_top_closure_id: Optional[str] = None
    
    # Magazyn kontekstowy ("WL" lub "KLB")
    warehouse: str = "KLB"
    
    # Przekazane dynamicznie z JS
    available_products: List[AvailableProduct] = []

class ItemDetail(BaseModel):
    product_id: str
    name: str
    component_type: str
    quantity: int = 1
    height_mm: float = 0
    is_ot: bool = False
    
class WellConfigResult(BaseModel):
    is_valid: bool
    total_height_mm: float
    items: List[ItemDetail] # Ordered bottom to top
    errors: List[str] = []
    has_minimal_clearance: bool = False
    score: float = 0.0
    stage: str = ""

class SyncItem(BaseModel):
    item_id: str
    # further sync metadata

class SyncRequest(BaseModel):
    changes: List[SyncItem]
