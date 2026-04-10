# -*- coding: utf-8 -*-
from typing import List, Dict, Optional
from pydantic import BaseModel
from api.schemas import WellConfigInput, TransitionInput, AvailableProduct
from rule_engine.rules import get_default_clearance
import logging

logger = logging.getLogger("AI_VALIDATOR")

class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[str]
    has_minimal_clearance: bool = False
    konus_conflict: bool = False
    reduction_conflict: bool = False
    critical_conflict: bool = False
    joint_collision: bool = False

def get_product_for_transition(transition_id: str, available_products: List[AvailableProduct]) -> Optional[AvailableProduct]:
    for p in available_products:
        if p.id == transition_id:
            return p
    return None

def validate_transitions(segments: List[Dict], transitions: List[TransitionInput], available_products: List[AvailableProduct]) -> ValidationResult:
    """
    Sprawdza, czy przejścia nie wpadają w strefy zakazane oraz czy zapasy (góra/dół) są zachowane.
    KATEGORYCZNY ZAKAZ: Przejście na łączeniu elementów → is_valid=False
    """
    errors = []
    used_minimal = False
    konus_conflict = False
    reduction_conflict = False
    critical_conflict = False
    joint_collision = False

    if not transitions:
        return ValidationResult(is_valid=True, errors=[])

    # Zbierz wysokości WSZYSTKICH łączeń (joints) elementów
    joints = []
    for seg in segments:
        joints.append(seg['start'])
        joints.append(seg['end'])
    # Unikalne, posortowane
    joints = sorted(set(joints))

    # Pozycja płyty redukcyjnej
    reduction_top_mm = None
    for seg in segments:
        if seg['type'] in ['plyta_redukcyjna', 'reduction']:
            reduction_top_mm = seg['start']
            break

    forbidden_zones = ['plyta_din', 'plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy', 'plyta_redukcyjna', 'reduction']
    konus_types = ['konus']

    for idx_t, t in enumerate(transitions):
        hole_invert = float(t.height_from_bottom_mm)
        pprod = get_product_for_transition(t.id, available_products)
        
        pr_dn_num = 160.0
        z_gora, z_dol = 0.0, 0.0
        z_gora_min, z_dol_min = 0.0, 0.0
        pr_name = f"Przejście #{idx_t+1}"

        if pprod:
            if pprod.dn:
                pr_dn_num = float(pprod.dn)
            # Użyj zapasów z cennika, a jeśli brak (0) → domyślne wg DN
            defaults = get_default_clearance(pr_dn_num)
            z_gora = float(pprod.zapasGora or 0) if pprod.zapasGora else defaults[1]
            z_dol = float(pprod.zapasDol or 0) if pprod.zapasDol else defaults[0]
            z_gora_min = float(pprod.zapasGoraMin or 0) if pprod.zapasGoraMin else defaults[3]
            z_dol_min = float(pprod.zapasDolMin or 0) if pprod.zapasDolMin else defaults[2]
            pr_name = f"{pprod.name} DN{int(pr_dn_num)}"

        hole_bottom = hole_invert
        hole_top = hole_invert + pr_dn_num
        hole_center = hole_invert + (pr_dn_num / 2.0)

        # ═══════════════════════════════════════════════════════════════
        # KATEGORYCZNY ZAKAZ: Sprawdzenie kolizji rury z łączeniami
        # ═══════════════════════════════════════════════════════════════
        safety_margin = 15.0  # mm marginesu od krawędzi łączenia
        for joint_h in joints:
            if joint_h <= 0:
                continue  # Pomijaj dno studni
            if (hole_bottom - safety_margin) < joint_h < (hole_top + safety_margin):
                errors.append(
                    f"KRYTYCZNA KOLIZJA: {pr_name} przecina łączenie na wys. {int(joint_h)}mm "
                    f"(rura: {int(hole_bottom)}-{int(hole_top)}mm, margines: {int(safety_margin)}mm)"
                )
                joint_collision = True
                logger.warning(f"JOINT COLLISION: {pr_name} vs joint@{joint_h}mm (hole {hole_bottom:.0f}-{hole_top:.0f}mm)")

        # Sprawdzenie strefy redukcji
        if reduction_top_mm is not None and hole_center >= reduction_top_mm:
            errors.append(f"Przejście [{pr_name}]: BŁĄD — otwór w strefie redukcji")
            reduction_conflict = True

        # Sprawdzenie stref zakazanych (konus, płyty)
        for seg in segments:
            if seg['start'] <= hole_center < seg['end']:
                if seg['type'] in konus_types:
                    errors.append(f"Przejście [{pr_name}]: otwór w strefie konusa")
                    konus_conflict = True
                elif seg['type'] in forbidden_zones:
                    errors.append(f"Przejście [{pr_name}]: otwór w zabronionej strefie ({seg['type']})")
                    critical_conflict = True
                break

        # Sprawdzenie zapasów góra/dół z cennika
        hole_valid = False
        hole_minimal = False
        hole_minimal_str = ""

        for idx, seg in enumerate(segments):
            if seg['start'] <= hole_center < seg['end']:
                is_bottom_most = (idx == 0)
                bottom_clearance = hole_bottom - seg['start']
                top_clearance = seg['end'] - hole_top

                is_pipe_at_bottom = is_bottom_most and bottom_clearance < 1
                eff_z_dol = -9999.0 if is_pipe_at_bottom else z_dol
                eff_z_dol_min = -9999.0 if is_pipe_at_bottom else z_dol_min

                if bottom_clearance >= eff_z_dol and top_clearance >= z_gora:
                    hole_valid = True
                elif bottom_clearance >= eff_z_dol_min and top_clearance >= z_gora_min:
                    hole_valid = True
                    hole_minimal = True
                    hole_minimal_str = f"(dół {bottom_clearance:.0f}mm, góra {top_clearance:.0f}mm)"
                else:
                    errors.append(
                        f"Przejście [{pr_name}]: ZA MAŁY ZAPAS! "
                        f"Wymagane: dół≥{eff_z_dol:.0f}mm góra≥{z_gora:.0f}mm | "
                        f"Aktualne: dół={bottom_clearance:.0f}mm góra={top_clearance:.0f}mm"
                    )
                    logger.warning(f"CLEARANCE FAIL: {pr_name} bot={bottom_clearance:.0f} top={top_clearance:.0f}")
                break

        if hole_minimal:
            used_minimal = True
            errors.append(f"Przejście [{pr_name}]: zastosowano luzy minimalne {hole_minimal_str}")

    # KATEGORYCZNY ZAKAZ: jeśli jest kolizja na łączeniu → studnia NIEWAŻNA
    is_valid = not joint_collision
    
    return ValidationResult(
        is_valid=is_valid,
        errors=errors,
        has_minimal_clearance=used_minimal,
        konus_conflict=konus_conflict,
        reduction_conflict=reduction_conflict,
        critical_conflict=critical_conflict,
        joint_collision=joint_collision
    )

def substitute_ot_rings(segments: List[Dict], items: List, transitions: List[TransitionInput], available_products: List[AvailableProduct] = None):
    """
    Znajduje kręgi, w których mieści się otwór, i zamienia na OT (wiercone).
    Jeśli krąg NIE MA otworu, a jest zdefiniowany jako OT, przywraca go do wariantu standardowego.
    
    ZASADA BEZWZGLĘDNA: Krąg z przejściem = ZAWSZE krąg wiercony. Krąg bez przejścia = ZAWSZE zwykły.
    Dotyczy KAŻDEGO trybu — auto I ręcznego. NIE DO ZMIANY.
    """
    if available_products is None:
        available_products = []

    krag_idx = 0
    for idx, seg in enumerate(segments):
        if 'krag' not in seg['type']:
            continue
            
        has_hole = False
        for t in transitions:
            hole_invert = float(t.height_from_bottom_mm)
            
            pprod = get_product_for_transition(t.id, available_products)
            pr_dn = 160.0
            if pprod and pprod.dn:
                pr_dn = float(pprod.dn)
            
            hole_center = hole_invert + (pr_dn / 2.0)
            
            # Przejście w dennicy → nie szukamy kręgu OT
            dennica_seg = next((s for s in segments if s['type'] == 'dennica'), None)
            if dennica_seg and hole_center < dennica_seg['end']:
                continue
                
            if hole_center >= seg['start'] and hole_center < seg['end']:
                has_hole = True
                break

        if krag_idx < len(items):
            item = items[krag_idx]
            current_id = item.product_id
            is_currently_ot = item.is_ot or 'ot' in current_id.lower().split('-')[-1:][0]
            
            if has_hole:
                seg['is_ot'] = True
                seg['type'] = 'krag_ot'
                
                if not is_currently_ot:
                    # ─── Szukaj wariantu OT w katalogu ───
                    ot_product = _find_ot_product(
                        current_id, item.height_mm, available_products
                    )
                    
                    if ot_product:
                        item.product_id = ot_product.id
                        item.name = ot_product.name
                        item.component_type = 'krag_ot'
                        item.is_ot = True
                        logger.info(f"Zamiana kręgu {current_id} → {ot_product.id} (krąg wiercony z katalogu)")
                    else:
                        dynamic_id = current_id + '_OT'
                        item.product_id = dynamic_id
                        item.component_type = 'krag_ot'
                        item.is_ot = True
                        import re
                        if "wiercony" not in item.name.lower():
                            item.name = re.sub(r'^Kr[ąa]g', 'Krąg wiercony', item.name)
                            if "wiercony" not in item.name.lower():
                                item.name = "Krąg wiercony " + item.name
                        logger.info(f"Zamiana kręgu {current_id} → {dynamic_id} (dynamiczny OT)")
            else:
                # Nie ma otworu, a krąg jest zdefiniowany jako OT → degradacja do zwykłego
                if is_currently_ot:
                    import re
                    base_stripped = re.sub(r'-OT$', '', current_id, flags=re.IGNORECASE)
                    base_product = next((p for p in available_products if p.id == base_stripped), None)
                    
                    if base_product:
                        item.product_id = base_product.id
                        item.name = base_product.name
                        item.component_type = base_product.componentType or 'krag'
                        item.is_ot = False
                        seg['is_ot'] = False
                        seg['type'] = item.component_type
                        logger.info(f"Zamiana kręgu {current_id} → {base_product.id} (brak przejścia - powrót do kręgu standardowego)")
                    else:
                        item.product_id = base_stripped
                        item.name = re.sub(r' z otworami| wiercony', '', item.name, flags=re.IGNORECASE)
                        item.component_type = 'krag'
                        item.is_ot = False
                        seg['is_ot'] = False
                        seg['type'] = 'krag'
                        logger.info(f"Zamiana kręgu {current_id} → {base_stripped} (dynamiczna — brak przejścia)")

        krag_idx += 1


def _find_ot_product(
    base_product_id: str,
    height_mm: float,
    available_products: List[AvailableProduct],
) -> Optional[AvailableProduct]:
    """
    Szuka wariantu OT (z otworami) w katalogu produktów.
    Dopasowanie po: ten sam DN, ta sama wysokość, componentType='krag_ot'.
    """
    # Znajdź bazowy produkt aby poznać DN
    base = next((p for p in available_products if p.id == base_product_id), None)
    if not base:
        return None
    
    base_dn = base.dn
    base_h = int(height_mm)
    
    # Szukaj krag_ot o tym samym DN i wysokości
    for p in available_products:
        if (
            p.componentType == 'krag_ot'
            and p.dn == base_dn
            and int(p.height) == base_h
        ):
            return p
    
    # Szukaj po konwencji nazewnictwa (np. KDB-10-10-D → KDB-10-10-OT)
    # Usuń sufiks wariantu (-D, -B, -N-D) i dodaj -OT
    import re
    base_stripped = re.sub(r'-(D|B|N-D|N-B)$', '', base_product_id)
    ot_id = base_stripped + '-OT'
    
    for p in available_products:
        if p.id == ot_id and int(p.height) == base_h:
            return p
    
    return None
