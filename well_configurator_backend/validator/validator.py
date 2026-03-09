from typing import List, Dict, Optional
from pydantic import BaseModel
from api.schemas import WellConfigInput, TransitionInput, AvailableProduct

class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[str]
    has_minimal_clearance: bool = False
    konus_conflict: bool = False
    reduction_conflict: bool = False
    critical_conflict: bool = False

def get_product_for_transition(transition_id: str, available_products: List[AvailableProduct]) -> Optional[AvailableProduct]:
    for p in available_products:
        if p.id == transition_id:
            return p
    return None

def validate_transitions(segments: List[Dict], transitions: List[TransitionInput], available_products: List[AvailableProduct]) -> ValidationResult:
    """
    Sprawdza, czy przejścia nie wpadają w strefy zakazane oraz czy zapasy (góra/dół) są zachowane.
    Segments = struktura od dna w górę:
      [{'type': 'dennica', 'start': 0, 'end': 600}, ...]
    """
    errors = []
    used_minimal = False
    konus_conflict = False
    reduction_conflict = False
    critical_conflict = False

    if not transitions:
        return ValidationResult(is_valid=True, errors=[])

    # Pozycja płyty redukcyjnej
    reduction_top_mm = None
    for seg in segments:
        if seg['type'] in ['plyta_redukcyjna', 'reduction']:
            reduction_top_mm = seg['start']
            break

    forbidden_zones = ['plyta_din', 'plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy', 'plyta_redukcyjna', 'reduction']
    konus_types = ['konus']

    for idx_t, t in enumerate(transitions):
        hole_center = float(t.height_from_bottom_mm)
        pprod = get_product_for_transition(t.id, available_products)
        
        pr_dn_num = 160.0
        z_gora, z_dol = 0.0, 0.0
        z_gora_min, z_dol_min = 0.0, 0.0
        pr_name = f"Przejście #{idx_t+1}"

        if pprod:
            if pprod.dn:
                pr_dn_num = float(pprod.dn)
            z_gora = float(pprod.zapasGora or 0)
            z_dol = float(pprod.zapasDol or 0)
            z_gora_min = float(pprod.zapasGoraMin or 0)
            z_dol_min = float(pprod.zapasDolMin or 0)
            pr_name = f"{pprod.name} DN{int(pr_dn_num)}"

        hole_radius = pr_dn_num / 2.0

        if reduction_top_mm is not None and hole_center >= reduction_top_mm:
            errors.append(f"Przejście [{pr_name}]: BŁĄD — otwór w strefie redukcji")
            return ValidationResult(is_valid=False, errors=errors, reduction_conflict=True)

        # Sprawdzenie stref zakazanych
        broken_zone = False
        for seg in segments:
            if seg['start'] <= hole_center < seg['end']:
                if seg['type'] in konus_types:
                    errors.append(f"Przejście [{pr_name}]: otwór w strefie konusa")
                    konus_conflict = True
                    broken_zone = True
                elif seg['type'] in forbidden_zones:
                    is_din = seg['type'] == 'plyta_din'
                    errors.append(f"Przejście [{pr_name}]: otwór w zabronionej strefie ({seg['type']})")
                    critical_conflict = is_din
                    broken_zone = True
                break
        
        if broken_zone:
            return ValidationResult(is_valid=False, errors=errors, konus_conflict=konus_conflict, critical_conflict=critical_conflict)

        # Sprawdzenie luzów góra/dół
        hole_valid = False
        hole_minimal = False
        hole_minimal_str = ""
        collision_str = ""
        el_type_str = ""

        for idx, seg in enumerate(segments):
            if seg['start'] <= hole_center < seg['end']:
                el_type_str = "dennicy" if seg['type'] == 'dennica' else ("kręgu" if "krag" in seg['type'] else seg['type'])
                is_bottom_most = (idx == 0)
                is_pipe_at_bottom = is_bottom_most and abs(hole_center) < 1

                eff_z_dol = -9999.0 if is_pipe_at_bottom else z_dol
                eff_z_dol_min = -9999.0 if is_pipe_at_bottom else z_dol_min

                bottom_clearance = hole_center - seg['start'] - hole_radius
                top_clearance = seg['end'] - hole_center - hole_radius

                if bottom_clearance >= eff_z_dol and top_clearance >= z_gora:
                    hole_valid = True
                elif bottom_clearance >= eff_z_dol_min and top_clearance >= z_gora_min:
                    hole_valid = True
                    hole_minimal = True
                    hole_minimal_str = f"(dół {bottom_clearance:.0f}mm, góra {top_clearance:.0f}mm)"
                else:
                    collision_str = f"wymagane: dół {eff_z_dol:.0f}mm, góra {z_gora:.0f}mm | aktualnie: dół {bottom_clearance:.0f}mm, góra {top_clearance:.0f}mm"
                break
        
        if not hole_valid:
            if collision_str:
                errors.append(f"Przejście [{pr_name}]: kolizja zapasów ({collision_str})")
            else:
                errors.append(f"Przejście [{pr_name}]: kolizja powłok na łączeniu elementów")
            return ValidationResult(is_valid=False, errors=errors)

        if hole_minimal:
            used_minimal = True
            errors.append(f"Przejście [{pr_name}]: zastosowano luzy minimalne {hole_minimal_str}")

    return ValidationResult(is_valid=True, errors=errors, has_minimal_clearance=used_minimal, konus_conflict=konus_conflict, critical_conflict=critical_conflict)

def substitute_ot_rings(segments: List[Dict], items: List[Dict], transitions: List[TransitionInput]):
    """ Znajduje kręgi, w których mieści się otwór, i potencjalnie zamienia na OT. """
    for t in transitions:
        hole_center = float(t.height_from_bottom_mm)
        hole_radius = 80.0 # simplified for mock substitute
        hole_bottom = hole_center - hole_radius
        hole_top = hole_center + hole_radius
        for idx, seg in enumerate(segments):
            if 'krag' in seg['type'] and hole_bottom >= seg['start'] and hole_top <= seg['end']:
                seg['is_ot'] = True
                if idx < len(items):
                    items[idx]['is_ot'] = True
