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
        
        dennicy = self.engine.get_all_dennice_sorted()
        if not dennicy:
            return [WellConfigResult(is_valid=False, total_height_mm=0, items=[], errors=["Brak dostępnej dennicy dla podanego DN."])]
            
        last_error_res = None
        
        for dennica in dennicy:
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
            
            # Jeżeli zostaliśmy z ujemną odległością przekraczającą tolerancję, a mamy stożek i nie wymuszono zakończenia:
            if target_kregi_h < -20 and top.componentType == 'konus' and not self.config.forced_top_closure_id:
                # Fallback na płytę DIN, gdyż Konus fizycznie się nie zmieści
                fallback_top = self.engine.get_top_closure(is_reduced=is_reduced, fallback_to_din=True)
                if fallback_top:
                    top = fallback_top
                    fixed_height = dennica.height + top.height
                    if is_reduced:
                        fixed_height += plate.height
                    target_kregi_h = self.config.target_height_mm - fixed_height

            # 4. Kregi list (CP-SAT Solver)
            kregi_list_dn = self.engine.get_kregi_list(self.config.dn)
            
            success, selected_rings = optimize_rings_for_distance(
                target_distance=target_kregi_h, 
                available_rings=kregi_list_dn, 
                tolerance_below=50, 
                tolerance_above=20
            )
            
            if not success:
                 last_error_res = [WellConfigResult(is_valid=False, total_height_mm=fixed_height, items=[], errors=[f"Nie można spełnić wymaganej wysokości {target_kregi_h} z dostępnych kręgów w limitach tolerancji +/-. (Użyto dennicy " + str(dennica.height) + "mm)"])]
                 continue

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
            validation = validate_transitions(segments, self.config.transitions, self.config.available_products)
            
            if validation.konus_conflict and top.componentType == 'konus':
                last_error_res = [WellConfigResult(is_valid=False, total_height_mm=0, items=[], errors=["Przejście wpada w konus. Wymagana aplikacja zamiennika ze standardową płytą. (Aplikacja powinna użyć trybu 'Konus Conflict Fallback')."])]
                continue
                
            if validation.reduction_conflict:
                last_error_res = [WellConfigResult(is_valid=False, total_height_mm=0, items=[], errors=["Otwór wpada w strefę redukcji - wymagane wyższe posadowienie płyty redukcyjnej."])]
                continue

            if not validation.is_valid:
                last_error_res = [WellConfigResult(is_valid=False, total_height_mm=cy, items=[], errors=validation.errors)]
                continue

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
            
            # --- DODANIE DOMYŚLNEGO WŁAZU ---
            manhole = self.engine.get_default_manhole()
            if manhole:
                out_items.append(
                    ItemDetail(product_id=manhole.id, name=manhole.name, component_type=manhole.componentType, height_mm=manhole.height)
                )
                # Opcjonalnie: cy += manhole.height. Jeżeli właz wlicza się do łącznej wys. studni:
                cy += manhole.height

            return [WellConfigResult(
                is_valid=True,
                total_height_mm=cy,
                items=out_items,
                errors=[],
                has_minimal_clearance=validation.has_minimal_clearance,
                score=0.0
            )]
            
        return last_error_res or [WellConfigResult(is_valid=False, total_height_mm=0, items=[], errors=["Z żadną z dostępnych dennic nie udało się zestawić działającej konstrukcji."])]
