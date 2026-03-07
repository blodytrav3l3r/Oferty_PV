from typing import List, Dict
from pydantic import BaseModel
from database.tables import ProductModel
from api.schemas import WellConfigInput, WellConfigResult, ItemDetail
from rule_engine.rules import RuleEngine
from optimizer.cp_optimizer import optimize_rings_for_distance
from validator.validator import validate_transitions, substitute_ot_rings

class ConfigurationGenerator:
    def __init__(self, products: List[ProductModel], config: WellConfigInput):
        self.products = products
        self.config = config
        self.engine = RuleEngine(products, config)
        
    def generate(self) -> List[WellConfigResult]:
        """
        Zwraca pełną wygenerowaną konfigurację lub listę alternatywnych wariantów.
        W uproszczeniu - wypluwa od razu 1 zoptymalizowany.
        """
        
        # 1. Base Dennica
        dennica = self.engine.get_lowest_dennica()
        if not dennica:
            return [WellConfigResult(is_valid=False, total_height_mm=0, items=[], errors=["Brak dostępnej dennicy dla podanego DN."])]
            
        # 2. Reduction Plating logic
        plate = self.engine.get_reduction_plate()
        is_reduced = plate is not None and self.config.use_reduction

        # 3. Top Closure (Konus / DIN)
        top = self.engine.get_top_closure(is_reduced=is_reduced, fallback_to_din=False)
        if not top:
             return [WellConfigResult(is_valid=False, total_height_mm=0, items=[], errors=["Brak odpowiedniego elementu zakończenia (Konus/Płyta)."])]

        # Złożenie wysokości znanych
        fixed_height = dennica.height + top.height
        if is_reduced:
            fixed_height += plate.height
            
        target_kregi_h = self.config.target_height_mm - fixed_height
        
        # 4. Kregi list (CP-SAT Solver)
        kregi_list_dn = self.engine.get_kregi_list(self.config.dn)
        
        # Jeżeli jest to studnia ulegająca redukcji, w dolnej sekcji (głównej średnicy) powiedzmy, 
        # że musimy zagwarantować X wysokości, a reszta w DN1000. 
        # Ponieważ reguły redukcji są skomplikowane - tutaj tworzymy jednoetapowe wypełnienie 
        # wysokości głównego komina ze zwykłych kręgów przed płytą redukcyjną; jako przykład 
        # dajemy wszystko pod płytę redukcyjną a na redukcję rzucamy tylko sam konus. 
        
        # To złożony problem, normalnie solver ma 2 zmienne - wysokości dolnego dn i górnego.
        # W uproszczeniu: wymuszamy, żeby CP-SAT dobrał dolną kolumnę. 
        
        success, selected_rings = optimize_rings_for_distance(
            target_distance=target_kregi_h, 
            available_rings=kregi_list_dn, 
            tolerance_below=50, 
            tolerance_above=20
        )
        
        if not success:
             return [WellConfigResult(is_valid=False, total_height_mm=fixed_height, items=[], errors=["Nie można spełnić wymaganej wysokości z dostępnych kręgów w limitach tolerancji +/-."])]

        # Złożenie struktury bottom-up dla Walidatora Przejść:
        segments = []
        cy = 0
        segments.append({'type': 'dennica', 'start': cy, 'end': cy + dennica.height})
        cy += dennica.height
        
        # Sortuj listę by najwyższe kręgi były na dole (najbliżej dennicy)
        selected_rings.sort(key=lambda r: r.height, reverse=True)
        
        for k in selected_rings:
            segments.append({'type': 'krag', 'start': cy, 'end': cy + k.height, 'is_ot': False})
            cy += k.height
            
        if is_reduced:
            segments.append({'type': 'plyta_redukcyjna', 'start': cy, 'end': cy + plate.height})
            cy += plate.height
            
        segments.append({'type': top.componentType, 'start': cy, 'end': cy + top.height})
        cy += top.height
        
        # 5. Walidacja
        validation = validate_transitions(segments, self.config.transitions)
        
        if validation.konus_conflict and top.componentType == 'konus':
            # Zmień na DIN i zrekompensuj wysokość - w prawdziwym silniku uruchomiłoby re-generację
            return [WellConfigResult(is_valid=False, total_height_mm=0, items=[], errors=["Przejście wpada w konus. Wymagana aplikacja zamiennika z płytą (wymaga regeneracji solvera)."])]
            
        if not validation.is_valid:
            return [WellConfigResult(is_valid=False, total_height_mm=cy, items=[], errors=validation.errors)]

        # Konstrukcja wyjścia JSON
        out_items = [
            ItemDetail(product_id=dennica.id, name=dennica.name, component_type=dennica.componentType, height_mm=dennica.height)
        ]
        
        # OT Rings mapping
        mock_out_kregi = []
        for r in selected_rings:
            mock_out_kregi.append(
                ItemDetail(product_id=r.id, name=r.name, component_type=r.componentType, height_mm=r.height, is_ot=False)
            )
        
        substitute_ot_rings(segments, mock_out_kregi, self.config.transitions)
        out_items.extend(mock_out_kregi)
        
        if is_reduced:
            out_items.append(
                ItemDetail(product_id=plate.id, name=plate.name, component_type=plate.componentType, height_mm=plate.height)
            )
            
        out_items.append(
            ItemDetail(product_id=top.id, name=top.name, component_type=top.componentType, height_mm=top.height)
        )
        
        res = WellConfigResult(
            is_valid=True,
            total_height_mm=cy,
            items=out_items,
            errors=[],
            has_minimal_clearance=validation.has_minimal_clearance,
            score=0.0
        )
        
        return [res]
