from ortools.sat.python import cp_model
from typing import List, Tuple, Dict, Optional, Any
from database.tables import ProductModel
from api.schemas import TransitionInput, AvailableProduct
from rule_engine.rules import get_default_clearance
import logging

logger = logging.getLogger("AI_OPTIMIZER")


def _get_transition_product(
    transition_id: str, available_products: List[AvailableProduct]
) -> Optional[AvailableProduct]:
    for p in available_products:
        if p.id == transition_id:
            return p
    return None


def _classify_transitions_for_ring(
    ring_start_mm: int,
    ring_end_mm: int,
    transitions: List[TransitionInput],
    available_products: List[AvailableProduct],
) -> List[Dict]:
    """
    Zwraca listę przejść, których środek otworu mieści się w danym segmencie kręgu.
    Dla każdego zwraca: {rel_invert, dn, z_dol, z_gora, z_dol_min, z_gora_min}
    współrzędna rel_invert jest względna względem ring_start_mm.
    """
    result = []
    for t in transitions:
        hc_invert = float(t.height_from_bottom_mm)
        pprod = _get_transition_product(t.id, available_products)
        dn_val = 160.0
        if pprod and pprod.dn:
            dn_val = float(pprod.dn)
        
        # Środek otworu decyduje w którym kręgu jest rura
        hole_center = hc_invert + (dn_val / 2.0)
        
        if ring_start_mm <= hole_center < ring_end_mm:
            # Użyj zapasów z cennika, a jeśli brak → domyślne wg DN
            defaults = get_default_clearance(dn_val)
            result.append(
                {
                    "rel_invert": hc_invert - ring_start_mm,
                    "dn": dn_val,
                    "z_dol": float(pprod.zapasDol) if (pprod and pprod.zapasDol) else defaults[0],
                    "z_gora": float(pprod.zapasGora) if (pprod and pprod.zapasGora) else defaults[1],
                    "z_dol_min": float(pprod.zapasDolMin) if (pprod and pprod.zapasDolMin) else defaults[2],
                    "z_gora_min": float(pprod.zapasGoraMin) if (pprod and pprod.zapasGoraMin) else defaults[3],
                }
            )
    return result


def _ring_can_hold_transitions(
    ring_height: int,
    transitions_in_ring: List[Dict],
    mode: str = "standard",
) -> bool:
    """
    Sprawdza czy krąg o danej wysokości pomieści wszystkie przejścia
    z zachowaniem zapasów (standard lub minimal).
    """
    if not transitions_in_ring:
        return True

    for tr in transitions_in_ring:
        bottom_clearance = tr["rel_invert"]
        top_clearance = ring_height - (tr["rel_invert"] + tr["dn"])

        if mode == "standard":
            if bottom_clearance < tr["z_dol"] or top_clearance < tr["z_gora"]:
                return False
        else:
            if bottom_clearance < tr["z_dol_min"] or top_clearance < tr["z_gora_min"]:
                return False
    return True



def optimize_rings_for_distance(
    target_distance: int,
    available_rings: List[ProductModel],
    tolerance_below: int = 50,
    tolerance_above: int = 20,
    transitions: Optional[List[TransitionInput]] = None,
    available_products: Optional[List[AvailableProduct]] = None,
    fixed_below_height: int = 0,
    mode: str = "standard",
) -> Tuple[bool, List[ProductModel], List[str]]:
    """
    Używa Google OR-Tools CP-SAT do precyzyjnego obliczenia optymalnej
    kombinacji kręgów W UŁOŻENIU SEKWENCYJNYM, chroniąc łączenia kręgów przed
    kolicją z rurami, minimalizując ilość użytych elementów.
    """
    target_distance = int(target_distance)
    if target_distance <= 0:
        return True, [], []

    if not available_rings:
        return False, [], ["Brak dostępnych kręgów."]

    if transitions is None:
        transitions = []
    if available_products is None:
        available_products = []

    # ─── Unikalne wysokości i pobranie najlepszych wariantów per wysokość ───
    heights = sorted(
        set(int(r.height) for r in available_rings if r.height and int(r.height) > 0),
        reverse=True,
    )
    if not heights:
        return False, [], ["Brak kręgów o dodatniej wysokości."]

    rings_by_height: Dict[int, List[ProductModel]] = {}
    for r in available_rings:
        h = int(r.height)
        if h not in rings_by_height:
            rings_by_height[h] = []
        rings_by_height[h].append(r)

    attr_forma = "formaStandardowaWL" if hasattr(available_rings[0], "formaStandardowaWL") else "formaStandardowaKLB"
    for h in rings_by_height:
        rings_by_height[h].sort(key=lambda x: -(getattr(x, attr_forma, 0) or 0))

    # Bezpieczny maksymalny limit kręgów (raczej nigdy nie będzie > 10 w studni domowej)
    MAX_SLOTS = min(15, target_distance // min(heights) + 5)

    # ─── CP-SAT Model ───
    model = cp_model.CpModel()
    valid_heights = [0] + heights
    
    slots_h = [model.NewIntVarFromDomain(cp_model.Domain.FromValues(valid_heights), f"slot_{i}") for i in range(MAX_SLOTS)]
    z_start = [model.NewIntVar(0, target_distance + tolerance_above, f"z_start_{i}") for i in range(MAX_SLOTS + 1)]

    # Wymuś, by puste sloty były zawsze "spychane" na prawą stronę (na górę)
    for i in range(MAX_SLOTS - 1):
        is_empty = model.NewBoolVar(f"is_empty_{i}")
        model.Add(slots_h[i] == 0).OnlyEnforceIf(is_empty)
        model.Add(slots_h[i] > 0).OnlyEnforceIf(is_empty.Not())
        model.Add(slots_h[i+1] == 0).OnlyEnforceIf(is_empty)

    # Obliczanie fizycznych rzędnych (start od zera względnego)
    model.Add(z_start[0] == 0)
    for i in range(MAX_SLOTS):
        model.Add(z_start[i+1] == z_start[i] + slots_h[i])

    # Zmienna celu = faktyczna wysokość kręgów
    total_h = z_start[MAX_SLOTS]
    model.Add(total_h >= target_distance - tolerance_below)
    model.Add(total_h <= target_distance + tolerance_above)

    # ─── Transition-aware constraints (Prawa Fizyki / Zderzenia) ───
    if transitions:
        for t in transitions:
            pprod = _get_transition_product(t.id, available_products)
            dn_val = float(pprod.dn) if pprod and pprod.dn else 160.0
            
            defaults = get_default_clearance(dn_val)
            z_dol = float(pprod.zapasDol) if pprod and pprod.zapasDol else defaults[0]
            z_gora = float(pprod.zapasGora) if pprod and pprod.zapasGora else defaults[1]
            if mode != "standard":
                z_dol = float(pprod.zapasDolMin) if pprod and pprod.zapasDolMin else defaults[2]
                z_gora = float(pprod.zapasGoraMin) if pprod and pprod.zapasGoraMin else defaults[3]

            # Rzędna rury WZGLĘDEM KRĘGÓW (zero w tym solverze to "fixed_below_height" w generatorze)
            # Parametr height_from_bottom_mm liczy się od całego dna, więc musimy odjąć fixed_below.
            # UWAGA: Ponieważ t.height_from_bottom_mm to wysokość od SAMEGO DNA (podłoga dennicy),
            # najpierw musimy "wyzerować" układ względem `fixed_below_height`.
            
            hc_invert_rel = float(t.height_from_bottom_mm) - fixed_below_height
            t_center_rel = hc_invert_rel + (dn_val / 2.0)
            
            # Strefa niebezpieczna łączeń:
            t_bottom_safe = int(round(t_center_rel - dn_val/2.0 - z_dol))
            t_top_safe = int(round(t_center_rel + dn_val/2.0 + z_gora))
            
            # Wymuszenie: ŻADNE fizyczne łączenie kręgów (z_start[1..MAX_SLOT-1]) nie może znajdować się 
            # wewnątrz "Strefy niebezpiecznej" [t_bottom_safe, t_top_safe].
            for i in range(1, MAX_SLOTS):
                left_of_pipe = model.NewBoolVar(f"left_{i}_{t.id}")
                right_of_pipe = model.NewBoolVar(f"right_{i}_{t.id}")
                model.Add(z_start[i] <= t_bottom_safe).OnlyEnforceIf(left_of_pipe)
                model.Add(z_start[i] >= t_top_safe).OnlyEnforceIf(right_of_pipe)
                model.AddBoolOr([left_of_pipe, right_of_pipe])

    # ─── Funkcja celu: Logika budowlana (maksymalizacja wielkich kręgów + największe na dół) ───
    # OR-Tools wymusza logikę liniową, dlatego robimy array wskaźników boolean dla każdej wysokości w każdym slocie
    obj_terms = []
    for i in range(MAX_SLOTS):
        for h in valid_heights:
            b = model.NewBoolVar(f"is_{h}_slot_{i}")
            model.Add(slots_h[i] == h).OnlyEnforceIf(b)
            model.Add(slots_h[i] != h).OnlyEnforceIf(b.Not())
            
            # Waga promuje:
            # 1. Duże kręgi (h*h)
            # 2. Duże kręgi NA DOLE (MAX_SLOTS - i) * h
            pos_weight = (MAX_SLOTS - i)
            obj_terms.append(b * (h * h + pos_weight * h))

    model.Maximize(sum(obj_terms))

    # ─── Solver Execution ───
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    solver.parameters.num_search_workers = 1
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        selected_models = []
        for i in range(MAX_SLOTS):
            val = int(solver.Value(slots_h[i]))
            if val > 0:
                selected_models.append(rings_by_height[val][0])
        logger.info(f"CP-SAT znalazł perfekcyjny matematyczny układ: {[int(r.height) for r in selected_models]}")
        return True, selected_models, []
    else:
        logger.info("CP-SAT nie znalazł rozwiązania — matematycznie nielogiczna wysokość bądź kolizja stref!")
        # Fallback Greedy dla ratunku błędnych założeń (aby użytkownik widział przynajmniej ostrzeżenie)
        return _greedy_fill_rings(
            target_distance, available_rings, rings_by_height,
            tolerance_below, tolerance_above, transitions, available_products,
            fixed_below_height, mode
        )


def _greedy_fill_rings(
    target_distance: int,
    available_rings: List[ProductModel],
    rings_by_height: Dict[int, List[ProductModel]],
    tolerance_below: int,
    tolerance_above: int,
    transitions: Optional[List[TransitionInput]],
    available_products: Optional[List[AvailableProduct]],
    fixed_below_height: int,
    mode: str,
) -> Tuple[bool, List[ProductModel], List[str]]:
    """
    Fallback greedy: dobiera kręgi od najwyższego do najniższego,
    sprawdzając zapasy przejść.
    """
    if transitions is None:
        transitions = []
    if available_products is None:
        available_products = []

    warnings = []
    selected = []
    remaining = target_distance
    current_y = fixed_below_height

    # Posortuj wysokości malejąco
    heights = sorted(rings_by_height.keys(), reverse=True)

    for h in heights:
        while remaining > tolerance_above:
            # Sprawdź czy krąg o wysokości h mieści się w remaining
            if h > remaining + tolerance_above:
                break

            # Sprawdź czy krąg pomieści przejścia
            ring_start = current_y
            ring_end = current_y + h
            trs = _classify_transitions_for_ring(
                ring_start, ring_end, transitions, available_products
            )

            can_use = True
            if trs:
                can_use = _ring_can_hold_transitions(h, trs, mode)

            if can_use:
                chosen = rings_by_height[h][0]
                selected.append(chosen)
                remaining -= h
                current_y += h
            else:
                # Spróbuj niższy krąg
                break

    # Jeśli remaining wciąż za duży — dodaj mniejsze kręgi
    for h in sorted(heights):  # od najniższego
        while remaining > tolerance_above and h <= remaining + tolerance_above:
            ring_start = current_y
            ring_end = current_y + h
            trs = _classify_transitions_for_ring(
                ring_start, ring_end, transitions, available_products
            )

            can_use = True
            if trs:
                can_use = _ring_can_hold_transitions(h, trs, mode)

            if can_use:
                chosen = rings_by_height[h][0]
                selected.append(chosen)
                remaining -= h
                current_y += h
            else:
                break

    total = sum(int(r.height) for r in selected)
    diff = target_distance - total

    if diff > tolerance_above:
        return (
            False,
            selected,
            [f"Greedy: nie udało się wypełnić wysokości. Brakuje {diff}mm."],
        )

    if diff < -tolerance_below:
        return False, selected, [f"Greedy: przekroczono wysokość o {abs(diff)}mm."]

    if diff < 0:
        warnings.append(f"Przekroczono wysokość o {abs(diff)}mm (w tolerancji)")

    return True, selected, warnings
