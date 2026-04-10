from ortools.sat.python import cp_model
from typing import List, Tuple, Optional
from api.schemas import AvailableProduct

def solve_well_configuration(
    target_height_mm: int,
    dennica: AvailableProduct,
    top_closure: AvailableProduct,
    reduction_plate: Optional[AvailableProduct] = None,
    rings_low: List[AvailableProduct] = [],
    rings_high: List[AvailableProduct] = [],
    manhole_height_mm: int = 150,
    tolerance_below: int = 50,
    tolerance_above: int = 10
) -> Tuple[bool, List[AvailableProduct], List[str]]:
    """
    Używa Google OR-Tools CP-SAT do znalezienia optymalnej kombinacji kręgów.
    Obsługuje studnie jednośrednicowe oraz z redukcją (dwie sekcje).
    """
    model = cp_model.CpModel()
    
    # Stałe wysokości
    h_fixed = dennica.height + top_closure.height + manhole_height_mm
    if reduction_plate:
        h_fixed += reduction_plate.height
        
    remaining_height = target_height_mm - h_fixed
    
    # Jeśli wymagana wysokość jest mniejsza od stałych elementów
    if remaining_height < 0:
        if abs(remaining_height) <= tolerance_below:
            return True, [dennica, top_closure], []
        return False, [], ["Wymagana wysokość jest mniejsza niż minimalna wysokość elementów stałych."]

    # Unikalne wysokości kręgów (dolnych i górnych)
    h_low_list = sorted(list(set(r.height for r in rings_low)), reverse=True)
    h_high_list = sorted(list(set(r.height for r in rings_high)), reverse=True) if reduction_plate else []
    
    # Zmienne decyzyjne: Ilość sztuk każdego kręgu
    max_q = (remaining_height // 50) + 2 # Bezpieczny limit sztuk
    
    counts_low = [model.NewIntVar(0, max_q, f'low_{h}') for h in h_low_list]
    counts_high = [model.NewIntVar(0, max_q, f'high_{h}') for h in h_high_list]
    
    total_low = sum(c * h for c, h in zip(counts_low, h_low_list))
    total_high = sum(c * h for c, h in zip(counts_high, h_high_list))
    
    # Constraint: Suma wysokości w granicach tolerancji
    model.Add(total_low + total_high >= remaining_height - tolerance_below)
    model.Add(total_low + total_high <= remaining_height + tolerance_above)
    
    # DODATKOWE REGUŁY:
    # 1. Jeśli jest redukcja, sekcja dolna musi mieć co najmniej jeden krąg? 
    # (Zależy od specyfikacji, ale zwykle tak. Przyjmijmy jednak elastyczność).
    
    # Funkcja celu:
    # - Minimalizacja liczby elementów (sum of counts)
    # - Preferencja wysokich kręgów (weight proportional to height^2)
    # - Preferencja form standardowych (dodajemy mały bonus za standard)
    
    objective_terms = []
    for c, h in zip(counts_low, h_low_list):
        # Znajdź najlepszy produkt (standardowy) dla tej wysokości
        prod = next(r for r in rings_low if r.height == h)
        weight = h * h # Priorytet dla wysokości
        if getattr(prod, 'formaStandardowaKLB', 0) == 1 or getattr(prod, 'formaStandardowaWL', 0) == 1:
            weight += 1000 # Bonus za standard
        objective_terms.append(c * weight)
        
    for c, h in zip(counts_high, h_high_list):
        prod = next(r for r in rings_high if r.height == h)
        weight = h * h
        if getattr(prod, 'formaStandardowaKLB', 0) == 1 or getattr(prod, 'formaStandardowaWL', 0) == 1:
            weight += 1000
        objective_terms.append(c * weight)

    model.Maximize(sum(objective_terms))
    
    # Rozwiązanie
    solver = cp_model.CpSolver()
    
    # DODATKOWA REGUŁA: Jeśli jest redukcja, dolna sekcja (dennica + kręgi dolne) 
    # powinna mieć min 1.5m dla stabilności i miejsca na przejścia (o ile to możliwe)
    if reduction_plate and target_height_mm >= 2500:
        model.Add(dennica.height + total_low >= 1500)

    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        selected_items = [dennica]
        
        # Dodaj kręgi dolne
        for c, h in zip(counts_low, h_low_list):
            qty = solver.Value(c)
            if qty > 0:
                prod = next(r for r in rings_low if r.height == h)
                for _ in range(qty):
                    selected_items.append(prod)
                    
        # Dodaj płytę redukcyjną
        if reduction_plate:
            selected_items.append(reduction_plate)
            
        # Dodaj kręgi górne
        for c, h in zip(counts_high, h_high_list):
            qty = solver.Value(c)
            if qty > 0:
                prod = next(r for r in rings_high if r.height == h)
                for _ in range(qty):
                    selected_items.append(prod)
                    
        selected_items.append(top_closure)
        return True, selected_items, []
    else:
        return False, [], ["Nie udało się dobrać konfiguracji elementów dla zadanej wysokości."]
