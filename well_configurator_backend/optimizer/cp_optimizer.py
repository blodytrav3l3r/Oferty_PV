from ortools.sat.python import cp_model
from typing import List, Tuple
from database.tables import ProductModel

def optimize_rings_for_distance(
    target_distance: int, 
    available_rings: List[ProductModel], 
    tolerance_below: int = 50, 
    tolerance_above: int = 0
) -> Tuple[bool, List[ProductModel]]:
    """
    Używa Google OR-Tools CP-SAT do precyzyjnego obliczenia optymalnej
    kombinacji kręgów (najlepiej z najwyższych), żeby trafiały w cel wymiarowy limitów.
    """
    if target_distance <= 0:
        return True, []
        
    if not available_rings:
        return False, []

    # Unikalne wysokości dostępne w przekazanych kręgach (posortowane z wagami standardowych)
    # CP-SAT wylicza same długości, potem RuleEngine paruje długości na konkretne item_id
    heights = list(set([r.height for r in available_rings if r.height > 0]))
    heights.sort(reverse=True) # Najpierw największe 1000mm, potem 750, 500, 250
    
    if not heights:
        return False, []

    model = cp_model.CpModel()
    
    # Maksymalna ilosć pojedynczego kręgu (np limitujemy do 20 sztuk)
    max_q = (target_distance // min(heights)) + 2
    
    # Zmienne decyzyjne: Ilość sztuk z każdego 'height'
    counts = [model.NewIntVar(0, max_q, f'h_{h}') for h in heights]
    
    total_height = sum(c * h for c, h in zip(counts, heights))
    
    # Constrainty: Target height
    # np. chcemy równe 3000 lub pomidzy 2950 a 3000 (target 3000: dol_tol 50, gora_tol 0)
    model.Add(total_height >= target_distance - tolerance_below)
    model.Add(total_height <= target_distance + tolerance_above)
    
    # Funkcja celu: maksymalizacja największych kręgów, by ograniczyć ich ilość do minimum montażowego
    # Dodajemy wagi żeby zawsze wybrać np 2x 1000 a nie 4x 500.
    # Waga rośnie z kwadratem lub sześcianem wysokości.
    objective_func = sum(c * (h**2) for c, h in zip(counts, heights))
    model.Maximize(objective_func)
    
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        selected_heights = []
        for c, h in zip(counts, heights):
            qty = solver.Value(c)
            if qty > 0:
                selected_heights.extend([h] * qty)
                
        # Zmapuj wysokości na rzeczywiste modele produktów. 
        # Szukamy pierwszego modelu, który pasuje rozmiarem i jest forma std == 1.
        final_models = []
        for h in selected_heights:
            # wybieramy pierwszy z dostępnych dla tej wielkości
            # `available_rings` zostały uprzednio posortowane pod względem standardu.
            chosen = next(r for r in available_rings if r.height == h)
            final_models.append(chosen)
            
        return True, final_models
    else:
        return False, []
