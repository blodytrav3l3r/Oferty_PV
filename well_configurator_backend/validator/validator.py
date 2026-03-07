from typing import List, Dict
from pydantic import BaseModel
from api.schemas import WellConfigInput, TransitionInput

class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[str]
    has_minimal_clearance: bool = False
    konus_conflict: bool = False

def validate_transitions(segments: List[Dict], transitions: List[TransitionInput]) -> ValidationResult:
    """
    Sprawdza, czy przejścia nie wpadają w strefy zakazane oraz czy zapasy (góra/dół) są zachowane.
    Segments = struktura od dna w górę (bottom-up):
      [{'type': 'dennica', 'start': 0, 'end': 600}, ...]
    Zwraca informację o minimalnych zapasach oraz ewentualnych konfliktach z konusem.
    """
    errors = []
    used_minimal = False
    konus_conflict = False

    # strefy absolutnie zabronione dla otworów
    forbidden_zones = ['plyta_din', 'plyta_zamykajaca', 'pierscien_odciazajacy', 'plyta_redukcyjna']

    for t in transitions:
        # domyślna średnica rury dla przejścia w tym mocku przyjmujemy stałe 160 mm 
        # w zaawansowanym przypadku dołączylibyśmy info z cennika PRZ-* 
        hole_diameter = 160
        hole_bottom = t.height_from_bottom_mm
        hole_top = hole_bottom + hole_diameter
        hole_mid = hole_bottom + (hole_diameter / 2)

        # domyślne margins (standard 150, min 100) -> w rzeczywistości brane z modelu bazy
        z_dol = 150
        z_gora = 150
        z_dol_min = 100
        z_gora_min = 100
        
        # Jeżeli zapas jest jawnie 0 w dennicy -> wtedy tolerujemy. Tutaj uproszczenie.

        # Sprawdzenie w jakikolwiek zakazany obszar wypada przejście
        for seg in segments:
            if seg['start'] <= hole_mid < seg['end']:
                if seg['type'] in forbidden_zones:
                    errors.append(f"Przejście ({hole_bottom}mm) w strefie zakazanej: {seg['type']}")
                    return ValidationResult(is_valid=False, errors=errors)
                elif seg['type'] == 'konus':
                    konus_conflict = True

        hole_valid = False
        hole_minimal = False

        # Sprawdzenie krawędzi połączeń
        for idx, seg in enumerate(segments):
            if hole_bottom >= seg['start'] and hole_top <= seg['end']:
                # Przejście wypada całkowicie wewnątrz tego segmentu, np. krąg albo dennica
                is_bottom_most = (idx == 0)
                eff_z_dol = 0 if is_bottom_most else z_dol
                eff_z_gora = z_gora
                
                if (hole_bottom >= seg['start'] + eff_z_dol) and (hole_top <= seg['end'] - eff_z_gora):
                    hole_valid = True
                else:
                    min_z_dol = 0 if is_bottom_most else z_dol_min
                    min_z_gora = z_gora_min
                    if (hole_bottom >= seg['start'] + min_z_dol) and (hole_top <= seg['end'] - min_z_gora):
                        hole_valid = True
                        hole_minimal = True
                        used_minimal = True
                    else:
                        errors.append(f"Kolizja przejścia ze złączem w {seg['type']}.")
                break
        
        if not hole_valid and not errors:
            errors.append(f"Przejście na złączu (przecina granicę elementów).")
            
    if errors:
        return ValidationResult(is_valid=False, errors=errors, konus_conflict=konus_conflict)

    return ValidationResult(is_valid=True, errors=[], has_minimal_clearance=used_minimal, konus_conflict=konus_conflict)

def substitute_ot_rings(segments: List[Dict], items: List[Dict], transitions: List[TransitionInput]):
    """
    Znajduje kręgi, w których mieści się przejście i zamienia je w miarę możliwości na 'krag_ot'.
    Jeżeli dół zapasu dennicy jest wypchnięty, w rzeczywistości też trzeba ot (ale optymalizacja wyżej).
    """
    # Ta funkcja mogłaby na etapie generacji zaktualizować item.is_ot
    # W naszym demonstracyjnym solwerze po prostu oznaczmy to jako "need OT" w danym przedziale wys.
    for t in transitions:
        hole_diameter = 160
        hole_bottom = t.height_from_bottom_mm
        hole_top = hole_bottom + hole_diameter
        
        for idx, seg in enumerate(segments):
            if seg['type'] == 'krag' and hole_bottom >= seg['start'] and hole_top <= seg['end']:
                seg['is_ot'] = True
                # Zamiana w liście outputowej
                items[idx]['is_ot'] = True
