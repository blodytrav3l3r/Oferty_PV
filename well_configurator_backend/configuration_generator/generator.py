from typing import List, Dict, Optional, Tuple
from pydantic import BaseModel
from database.tables import ProductModel
from api.schemas import WellConfigInput, WellConfigResult, ItemDetail
from rule_engine.rules import RuleEngine, get_default_clearance
from optimizer.cp_optimizer import optimize_rings_for_distance
from validator.validator import validate_transitions, substitute_ot_rings
import logging

logger = logging.getLogger("AI_GENERATOR")


class _BuildResult:
    """Helper for internal build results."""

    def __init__(self):
        self.items: List[ItemDetail] = []
        self.segments: List[Dict] = []
        self.total_height: int = 0
        self.is_valid: bool = False
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.has_minimal_clearance: bool = False


class ConfigurationGenerator:
    """
    Generator konfiguracji studni kanalizacyjnych.

    PIPELINE (5 etapów):
    ┌─────────────────────────────────────────────────────┐
    │ Stage 1: Dennica + przejścia w dennicy (zapasy std) │
    │ Stage 2: Kręgi OT dla rur powyżej dennicy           │
    │ Stage 3: CP-SAT z uwzględnieniem pozycji przejść    │
    │ Stage 4: Redukcja — walidacja 'brak przejść powyżej'│
    │ Stage 5: Fallback greedy gdy CP-SAT nie znajdzie    │
    └─────────────────────────────────────────────────────┘

    PRIORYTETY DECYZYJNE (kolejność):
    1. Możliwość technologiczna (czy da się wykonać)
    2. Najniższa dennica
    3. Zachowanie zapasów (standard → minimal)
    4. Użycie kręgów z otworami (OT)
    5. Minimalizacja wysokości i liczby elementów

    FALLBACK:
    - Najpierw narusz zapasy maksymalne
    - Potem minimalne
    - Nigdy nie łam zasad konstrukcyjnych (np. przejścia w redukcji)
    """

    def __init__(self, products: List[ProductModel], config: WellConfigInput):
        self.products = products
        self.config = config
        self.engine = RuleEngine(products, config)

    def generate(self) -> List[WellConfigResult]:
        """
        Główna metoda generowania konfiguracji.
        Zwraca listę wariantów (posortowanych od najlepszego).
        """
        all_dennice = self.engine.get_all_available_dennice()
        if not all_dennice:
            return [
                WellConfigResult(
                    is_valid=False,
                    total_height_mm=0,
                    items=[],
                    errors=[
                        f"Brak dostępnej dennicy dla DN{self.config.dn} w magazynie {self.config.warehouse}."
                    ],
                )
            ]

        plate = self.engine.get_reduction_plate()
        is_reduced = plate is not None and self.config.use_reduction

        # ─── Stage pipeline z progresywnym rozluźnianiem ───
        stages = [
            {
                "name": "Standard",
                "tolerance_below": 60,
                "tolerance_above": 20,
                "clearance_mode": "standard",
                "allow_ot_rings": True,
                "allow_fallback_dennica": True,
            },
            {
                "name": "Optymalny",
                "tolerance_below": 200,
                "tolerance_above": 20,
                "clearance_mode": "minimal",
                "allow_ot_rings": True,
                "allow_fallback_dennica": True,
            },
            {
                "name": "Ratunkowy",
                "tolerance_below": 500,
                "tolerance_above": 20,
                "clearance_mode": "minimal",
                "allow_ot_rings": True,
                "allow_fallback_dennica": True,
            },
        ]

        last_errors: List[str] = []
        best_invalid_result: Optional[WellConfigResult] = None

        for stage in stages:
            logger.info(
                f"═══ STAGE: {stage['name']} (tol: -{stage['tolerance_below']}/+{stage['tolerance_above']}) ═══"
            )

            # Oblicz required_chamber_h z uwzględnieniem trybu zapasów dla tego stage
            required_chamber_h = 0.0
            if is_reduced:
                reduction_errors, required_chamber_h = self._validate_reduction_transitions(
                    plate, stage["clearance_mode"]
                )
                if reduction_errors:
                    continue

            for dennica in all_dennice:
                result = self._try_build_well(dennica, is_reduced, plate, stage, required_chamber_h)

                if result.is_valid:
                    result.stage = stage["name"]
                    if stage["name"] != "Standard":
                        result.errors.insert(0, f"Zastosowano tryb: {stage['name']}")
                    logger.info(
                        f"SUKCES: Dennica {dennica.name} h={dennica.height}mm "
                        f"w trybie {stage['name']}, total={result.total_height_mm}mm"
                    )
                    return [result]
                else:
                    if best_invalid_result is None or len(result.errors) < len(
                        best_invalid_result.errors
                    ):
                        best_invalid_result = result
                    last_errors = result.errors
                    logger.warning(
                        f"ODRZUCONO: Dennica {dennica.name} h={dennica.height}: {result.errors}"
                    )

        # ─── Fallback: zwróć najlepszy nieudany (z elementami) ───
        if best_invalid_result and best_invalid_result.items:
            best_invalid_result.stage = "Wymuszony"
            best_invalid_result.errors.insert(
                0, "UWAGA: Nie znaleziono idealnej konfiguracji. Wynik wymaga kontroli!"
            )
            return [best_invalid_result]

        return [
            WellConfigResult(
                is_valid=False,
                total_height_mm=0,
                items=[],
                errors=last_errors or ["Nie znaleziono żadnej pasującej konfiguracji."],
                stage="Brak",
            )
        ]

    def _validate_reduction_transitions(
        self, plate: ProductModel, clearance_mode: str = "standard"
    ) -> Tuple[List[str], float]:
        """
        Kategoryczny zakaz: przejścia NIE MOGĄ być w sekcji redukcji (powyżej płyty redukcyjnej).
        Zwraca: (lista_bledow, required_chamber_h)
        Uwzględnia zapasy standardowe lub minimalne w zależności od clearance_mode.
        """
        errors = []
        required_chamber_h = 0.0

        if not self.config.transitions:
            return errors, required_chamber_h

        for t in self.config.transitions:
            pprod = self.engine._get_transition_product(t.id)
            dn = float(pprod.dn or 160.0) if pprod else 160.0
            
            # Pobierz zapasy dla rury
            defaults = get_default_clearance(dn)
            if clearance_mode == "standard":
                z_gora = float(pprod.zapasGora) if (pprod and pprod.zapasGora) else defaults[1]
            else:
                z_gora = float(pprod.zapasGoraMin) if (pprod and pprod.zapasGoraMin) else defaults[3]
            
            # Górna krawędź "strefy bezpieczeństwa" rury (rzędna włączenia + DN + zapas)
            top_safety_edge = float(t.height_from_bottom_mm) + dn + z_gora
            
            if top_safety_edge > required_chamber_h:
                required_chamber_h = top_safety_edge

        return errors, required_chamber_h

    def _try_build_well(
        self,
        dennica: ProductModel,
        is_reduced: bool,
        plate: Optional[ProductModel],
        stage: dict,
        required_chamber_h: float = 0.0,
    ) -> WellConfigResult:
        """
        Próbuje zbudować studnię z daną dennicą i parametrami stage'a.

        SEKWENCJA (bottom-up):
        dennica → [kręgi z OT] → [redukcja] → [kręgi DN1000] → zwieńczenie
        
        NOWA LOGIKA:
        - Dynamiczny dobór zakończenia+włazu na podstawie dostępnej przestrzeni
        - Obsługa studni płytkich (bez kręgów)
        - Automatyczna zamiana Konus → Płyta DIN gdy brak miejsca
        - Automatyczna zamiana Właz 150 → Właz 110 gdy brak miejsca
        """
        # ─── Krok 1: Oblicz dostępną przestrzeń nad dennicą ───
        reduction_height = plate.height if (is_reduced and plate) else 0
        available_above_dennica = self.config.target_height_mm - dennica.height - reduction_height

        if available_above_dennica < 0:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=dennica.height + reduction_height,
                items=[],
                errors=[
                    f"Dennica {dennica.name} (H={dennica.height}mm) "
                    f"{' + redukcja ' + str(plate.height) + 'mm' if is_reduced and plate else ''} "
                    f"przekracza cel {self.config.target_height_mm}mm."
                ],
            )

        # ─── Krok 2: Dynamiczny dobór zakończenia + włazu ───
        # Sprawdź co się zmieści w dostępnej przestrzeni
        top, hatch = self.engine.get_closure_for_available_space(
            available_space_mm=available_above_dennica,
            is_reduced=is_reduced,
        )

        if not top:
            # Fallback do klasycznego get_top_closure
            top = self.engine.get_top_closure(
                is_reduced=is_reduced,
                fallback_to_din=True,
            )
            hatch = self.engine.get_default_hatch()

        if not top:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=0,
                items=[],
                errors=["Brak zakończenia (Konus/DIN)."],
            )

        hatch_height = hatch.height if hatch else 0

        # ─── Krok 3: Oblicz cel dla kręgów ───
        fixed_height = dennica.height + reduction_height + top.height + hatch_height
        target_kregi_h = self.config.target_height_mm - fixed_height

        # UWAGA: Nie negocjujemy na mniejszy właz (110mm) automatycznie.
        # Właz 110mm może być dobrany WYŁĄCZNIE ręcznie przez użytkownika.

        # Jeśli target_kregi_h = 0 lub ujemny w tolerancji → studnia BEZ kręgów
        if target_kregi_h < -stage["tolerance_below"]:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=fixed_height,
                items=[],
                errors=[
                    f"Elementy stałe (dennica {dennica.height} + {top.name} {top.height} + właz {hatch_height} "
                    f"{' + redukcja ' + str(plate.height) if is_reduced and plate else ''}) "
                    f"= {fixed_height}mm przekraczają cel {self.config.target_height_mm}mm "
                    f"o {abs(target_kregi_h)}mm (tolerancja: {stage['tolerance_below']}mm)."
                ],
            )

        # ─── Krok 3: Klasyfikacja przejść ───
        # Które przejścia są w dennicy? Które powyżej?
        transitions_in_dennica = []
        transitions_above_dennica = []

        for t in self.config.transitions:
            hc = float(t.height_from_bottom_mm)
            if hc < dennica.height:
                transitions_in_dennica.append(t)
            else:
                transitions_above_dennica.append(t)

        # ─── Krok 4: Walidacja dennicy ───
        dennica_ok, dennica_warnings = self._validate_dennica(
            dennica, transitions_in_dennica, stage["clearance_mode"]
        )
        if not dennica_ok:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=fixed_height,
                items=[],
                errors=[f"Dennica {dennica.name} nie spełnia zapasów dla przejść."],
            )

        # ─── Krok 5: Dobór kręgów (CP-SAT transition-aware) ───
        # Dla studni bez redukcji: wszystkie kręgi to ten sam DN
        # Dla studni z redukcją: kręgi poniżej redukcji = DN studni, powyżej = DN1000

        if is_reduced and plate:
            # ─── STUDNIA Z REDUKCJĄ ───
            return self._build_reduced_well(
                dennica,
                plate,
                top,
                hatch,
                target_kregi_h,
                transitions_above_dennica,
                stage,
                required_chamber_h,
                dennica_warnings,
            )
        else:
            # ─── STUDNIA BEZ REDUKCJI ───
            return self._build_standard_well(
                dennica,
                top,
                hatch,
                target_kregi_h,
                self.config.transitions,
                stage,
                dennica_warnings,
            )

    def _build_standard_well(
        self,
        dennica: ProductModel,
        top: ProductModel,
        hatch: Optional[ProductModel],
        target_kregi_h: int,
        all_transitions: list,
        stage: dict,
        dennica_warnings: List[str],
    ) -> WellConfigResult:
        """Buduje studnię BEZ redukcji. Obsługuje zarówno studnie z kręgami jak i bez (płytkie)."""
        hatch_h = hatch.height if hatch else 0

        # ─── STUDNIA BEZ KRĘGÓW (płytka) ───
        # Gdy target_kregi_h <= 0 → dennica + zakończenie pokrywają całą wysokość
        if target_kregi_h <= 0:
            logger.info(
                f"Studnia płytka — BEZ kręgów: dennica={dennica.height}mm "
                f"+ {top.name}={top.height}mm + właz={hatch_h}mm "
                f"(target_kregi_h={target_kregi_h}mm)"
            )
            return self._build_no_ring_well(
                dennica, top, hatch, target_kregi_h, all_transitions, stage, dennica_warnings
            )

        # ─── STUDNIA Z KRĘGAMI ───
        kregi_list = self.engine.get_kregi_list(self.config.dn)
        if not kregi_list:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=dennica.height + top.height + hatch_h,
                items=[],
                errors=[f"Brak kręgów dla DN{self.config.dn}."],
            )

        success, selected_rings, optimizer_warnings = optimize_rings_for_distance(
            target_distance=target_kregi_h,
            available_rings=kregi_list,
            tolerance_below=stage["tolerance_below"],
            tolerance_above=stage["tolerance_above"],
            transitions=all_transitions,
            available_products=self.config.available_products,
            fixed_below_height=dennica.height,
            mode=stage["clearance_mode"],
        )

        if not success:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=dennica.height + top.height + hatch_h,
                items=[],
                errors=optimizer_warnings
                or [
                    f"Brak kombinacji kręgów dla h={target_kregi_h}mm "
                    f"(tol: -{stage['tolerance_below']}/+{stage['tolerance_above']}mm)."
                ],
            )

        # ─── Budowa segmentów ───
        segments = []
        cy = 0
        segments.append(
            {
                "type": "dennica",
                "start": cy,
                "end": cy + dennica.height,
                "is_ot": False,
            }
        )
        cy += dennica.height

        for k in selected_rings:
            segments.append(
                {
                    "type": "krag",
                    "start": cy,
                    "end": cy + int(k.height),
                    "is_ot": False,
                }
            )
            cy += int(k.height)

        segments.append(
            {
                "type": top.componentType,
                "start": cy,
                "end": cy + top.height,
                "is_ot": False,
            }
        )
        cy += top.height

        # ─── KROK: Fine-tuning z AVR ───
        # Teraz liczymy ile NAPRAWDĘ zostało do celu (terenu), uwzględniając właz
        remaining_gap = self.config.target_height_mm - cy - (hatch.height if hatch else 0)
        avr_to_add = self._select_avr_fill(remaining_gap)
        for avr in avr_to_add:
            segments.append(
                {
                    "type": "avr",
                    "start": cy,
                    "end": cy + avr.height_mm,
                    "is_ot": False
                }
            )
            cy += avr.height_mm

        # ─── KROK: Właz (Hatch) ───
        # Właz na samą górę
        if hatch:
            segments.append(
                {
                    "type": "wlaz",
                    "start": cy,
                    "end": cy + hatch.height,
                    "is_ot": False
                }
            )
            cy += hatch.height

        # ─── Walidacja przejść ───
        validation = validate_transitions(
            segments, self.config.transitions, self.config.available_products
        )

        # ─── Budowa listy elementów ───
        out_items = [
            ItemDetail(
                product_id=dennica.id,
                name=dennica.name,
                component_type=dennica.component_type,
                height_mm=dennica.height,
            )
        ]

        mock_out_kregi = []
        for r in selected_rings:
            mock_out_kregi.append(
                ItemDetail(
                    product_id=r.id,
                    name=r.name,
                    component_type=r.componentType,
                    height_mm=r.height,
                    is_ot=False,
                )
            )

        # Zamiana kręgów na OT
        substitute_ot_rings(
            segments,
            mock_out_kregi,
            self.config.transitions,
            self.config.available_products,
        )
        
        # UWAGA: NIE stosujemy automatycznej zamiany Konus 625 + Krąg 250 → Konus+
        # Konus standardowy (625mm) ma PRIORYTET — Konus+ jest dobierany
        # wyłącznie gdy system nie może znaleźć dobrej konfiguracji z Konusem 625.

        out_items.extend(mock_out_kregi)

        # Konus
        out_items.append(
            ItemDetail(
                product_id=top.id,
                name=top.name,
                component_type=top.component_type,
                height_mm=top.height,
            )
        )

        # AVR (pomiędzy konusem a włazem)
        out_items.extend(avr_to_add)

        # Właz (na samej górze)
        if hatch:
            out_items.append(
                ItemDetail(
                    product_id=hatch.id,
                    name=hatch.name,
                    component_type=hatch.component_type,
                    height_mm=hatch.height
                )
            )

        all_errors = dennica_warnings + validation.errors + optimizer_warnings
        if validation.has_minimal_clearance:
            all_errors.append("Zastosowano luzy minimalne.")

        return WellConfigResult(
            is_valid=validation.is_valid,
            total_height_mm=cy,
            items=out_items,
            errors=all_errors,
            has_minimal_clearance=validation.has_minimal_clearance,
            score=0.0,
        )

    def _build_reduced_well(
        self,
        dennica: ProductModel,
        plate: ProductModel,
        top: ProductModel,
        hatch: Optional[ProductModel],
        total_target_kregi_h: int,
        transitions_above_dennica: list,
        stage: dict,
        required_chamber_h: float,
        dennica_warnings: List[str],
    ) -> WellConfigResult:
        """
        Buduje studnię Z REDUKCJĄ.

        SEKWENCJA:
        dennica → kręgi DN_główny (z OT) → płyta redukcyjna → kręgi DN_docelowy → zwieńczenie
        """
        main_dn = self.config.dn
        reduction_dn = getattr(self.config, "target_dn", 1000) or 1000
        hatch_h = hatch.height if hatch else 0

        # ─── Krok 1: Wyznaczenie minimalnej wysokości komory roboczej ───
        # Komora robocza = Dennica + Kręgi pod płytą
        user_min_h = float(getattr(self.config, "redukcjaMinH", 2500) or 0)
        
        # Całkowita wymagana wysokość od dna do spodu płyty redukcyjnej
        min_chamber_total_h = max(user_min_h, required_chamber_h)
        
        # Wysokość samych kręgów pod płytą (komora - dennica)
        rings_below_min_h = max(0, min_chamber_total_h - dennica.height)

        # ─── Krok 2: Kręgi PONIŻEJ redukcji (DN główny) ───
        kregi_main = self.engine.get_kregi_list(main_dn)
        if not kregi_main:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=dennica.height + plate.height + top.height + hatch_h,
                items=[],
                errors=[f"Brak kręgów dla DN{main_dn} poniżej redukcji."],
            )

        # Szacujemy wysokość kręgów powyżej redukcji (min: 1 krąg)
        kregi_1000 = self.engine.get_kregi_list(reduction_dn)
        min_kregi_1000_h = min((int(k.height) for k in kregi_1000), default=250)
        estimated_above_reduction = min_kregi_1000_h

        # Preferowany podział: zostawiamy min_kregi_1000_h na górę, reszta na dół
        target_below_reduction = total_target_kregi_h - estimated_above_reduction
        
        # KOREKTA: jeśli preferowany podział sprawia, że komora jest za niska -> powiększ dół
        if target_below_reduction < rings_below_min_h:
            target_below_reduction = rings_below_min_h

        success_below, rings_below, warnings_below = optimize_rings_for_distance(
            target_distance=target_below_reduction,
            available_rings=kregi_main,
            tolerance_below=stage["tolerance_below"],
            tolerance_above=stage["tolerance_above"],
            transitions=transitions_above_dennica,
            available_products=self.config.available_products,
            fixed_below_height=dennica.height,
            mode=stage["clearance_mode"],
        )

        if not success_below:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=dennica.height + plate.height + top.height + hatch_h,
                items=[],
                errors=warnings_below
                or [
                    f"Brak kombinacji kręgów DN{main_dn} poniżej redukcji "
                    f"dla h={target_below_reduction}mm."
                ],
            )

        # ─── Krok 2: Kręgi POWYŻEJ redukcji (DN1000) ───
        remaining_h = total_target_kregi_h - sum(int(r.height) for r in rings_below)

        if not kregi_1000:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=dennica.height + plate.height + top.height,
                items=[],
                errors=[f"Brak kręgów DN{reduction_dn} powyżej redukcji."],
            )

        # Pozycja startowa kręgów DN1000 = dennica + kręgi poniżej + płyta redukcyjna
        offset_above = (
            dennica.height + sum(int(r.height) for r in rings_below) + plate.height
        )

        success_above, rings_above, warnings_above = optimize_rings_for_distance(
            target_distance=remaining_h,
            available_rings=kregi_1000,
            tolerance_below=stage["tolerance_below"],
            tolerance_above=stage["tolerance_above"],
            transitions=[],  # Brak przejść powyżej redukcji (zweryfikowane wcześniej)
            available_products=self.config.available_products,
            fixed_below_height=offset_above,
            mode=stage["clearance_mode"],
        )

        if not success_above:
            return WellConfigResult(
                is_valid=False,
                total_height_mm=dennica.height + plate.height + top.height,
                items=[],
                errors=warnings_above
                or [
                    f"Brak kombinacji kręgów DN{reduction_dn} powyżej redukcji "
                    f"dla h={remaining_h}mm."
                ],
            )

        # ─── Budowa segmentów ───
        segments = []
        cy = 0

        # Dennica
        segments.append(
            {
                "type": "dennica",
                "start": cy,
                "end": cy + dennica.height,
                "is_ot": False,
            }
        )
        cy += dennica.height

        # Kręgi DN główny (poniżej redukcji)
        for k in rings_below:
            segments.append(
                {
                    "type": "krag",
                    "start": cy,
                    "end": cy + int(k.height),
                    "is_ot": False,
                }
            )
            cy += int(k.height)

        # Płyta redukcyjna
        segments.append(
            {
                "type": "plyta_redukcyjna",
                "start": cy,
                "end": cy + plate.height,
                "is_ot": False,
            }
        )
        cy += plate.height

        # Kręgi powyżej redukcji
        for k in rings_above:
            segments.append(
                {
                    "type": "krag_reduced",
                    "start": cy,
                    "end": cy + int(k.height),
                    "is_ot": False,
                }
            )
            cy += int(k.height)

        # Zakończenie
        segments.append(
            {
                "type": top.componentType,
                "start": cy,
                "end": cy + top.height,
                "is_ot": False,
            }
        )
        cy += top.height

        # ─── KROK: Fine-tuning z AVR ───
        remaining_gap = self.config.target_height_mm - cy - (hatch.height if hatch else 0)
        avr_to_add = self._select_avr_fill(remaining_gap)
        for avr in avr_to_add:
            segments.append(
                {
                    "type": "avr",
                    "start": cy,
                    "end": cy + avr.height_mm,
                    "is_ot": False
                }
            )
            cy += avr.height_mm

        # ─── KROK: Właz (Hatch) ───
        if hatch:
            segments.append(
                {
                    "type": "wlaz",
                    "start": cy,
                    "end": cy + hatch.height,
                    "is_ot": False
                }
            )
            cy += hatch.height

        # ─── Walidacja przejść ───
        validation = validate_transitions(
            segments, self.config.transitions, self.config.available_products
        )

        # ─── Budowa listy elementów ───
        out_items = [
            ItemDetail(
                product_id=dennica.id,
                name=dennica.name,
                component_type=dennica.component_type,
                height_mm=dennica.height,
            )
        ]

        # Kręgi poniżej redukcji
        for r in rings_below:
            out_items.append(
                ItemDetail(
                    product_id=r.id,
                    name=r.name,
                    component_type=r.componentType,
                    height_mm=r.height,
                    is_ot=False,
                )
            )

        # Płyta redukcyjna
        out_items.append(
            ItemDetail(
                product_id=plate.id,
                name=plate.name,
                component_type=plate.component_type,
                height_mm=plate.height,
            )
        )

        # Kręgi powyżej redukcji
        mock_kregi_above = []
        for r in rings_above:
            mock_kregi_above.append(
                ItemDetail(
                    product_id=r.id,
                    name=r.name,
                    component_type=r.componentType,
                    height_mm=r.height,
                    is_ot=False,
                )
            )

        # OT substitution tylko dla kręgów poniżej redukcji (powyżej nie ma przejść)
        segments_below_reduction = [
            s for s in segments if s["type"] in ("dennica", "krag")
        ]
        mock_kregi_below = out_items[1 : len(rings_below) + 1]
        substitute_ot_rings(
            segments_below_reduction,
            mock_kregi_below,
            self.config.transitions,
            self.config.available_products,
        )

        # ─── ZASADA: Konus + Krąg 250 -> Konus+ ───
        # Kręgi powyżej redukcji są w mock_kregi_above
        if mock_kregi_above and mock_kregi_above[-1].height_mm == 250 and not mock_kregi_above[-1].is_ot:
            if top.component_type == "konus" and top.height == 625:
                # Szukamy Konus+ (H=850 lub H=875) dla docelowego DN redukcji
                konus_plus = self.engine.get_konus_plus(reduction_dn)
                if konus_plus:
                    # Zamiana
                    removed_krag = mock_kregi_above.pop()
                    top = konus_plus
                    logger.info(f"Zastosowano Konus+ {top.name} w DN{reduction_dn} zamiast Konus 625 + Krąg 250")

        out_items.extend(mock_kregi_above)

        # Konus
        out_items.append(
            ItemDetail(
                product_id=top.id,
                name=top.name,
                component_type=top.component_type,
                height_mm=top.height,
            )
        )

        # AVR
        out_items.extend(avr_to_add)

        # Właz
        if hatch:
            out_items.append(
                ItemDetail(
                    product_id=hatch.id,
                    name=hatch.name,
                    component_type=hatch.component_type,
                    height_mm=hatch.height
                )
            )

        all_errors = (
            dennica_warnings + validation.errors + warnings_below + warnings_above
        )
        if validation.has_minimal_clearance:
            all_errors.append("Zastosowano luzy minimalne.")

        return WellConfigResult(
            is_valid=validation.is_valid,
            total_height_mm=cy,
            items=out_items,
            errors=all_errors,
            has_minimal_clearance=validation.has_minimal_clearance,
            score=0.0,
        )

    def _build_no_ring_well(
        self,
        dennica: ProductModel,
        top: ProductModel,
        hatch: Optional[ProductModel],
        target_kregi_h: int,
        all_transitions: list,
        stage: dict,
        dennica_warnings: List[str],
    ) -> WellConfigResult:
        """
        Buduje studnię BEZ kręgów — dennica + zakończenie + AVR + właz.
        Dotyczy studni płytkich, np. DN1000 H=800mm.
        """
        hatch_h = hatch.height if hatch else 0

        # ─── Budowa segmentów ───
        segments = []
        cy = 0
        segments.append({
            "type": "dennica",
            "start": cy,
            "end": cy + dennica.height,
            "is_ot": False,
        })
        cy += dennica.height

        segments.append({
            "type": top.componentType,
            "start": cy,
            "end": cy + top.height,
            "is_ot": False,
        })
        cy += top.height

        # ─── AVR fine-tuning ───
        remaining_gap = self.config.target_height_mm - cy - hatch_h
        avr_to_add = self._select_avr_fill(remaining_gap)
        for avr in avr_to_add:
            segments.append({
                "type": "avr",
                "start": cy,
                "end": cy + avr.height_mm,
                "is_ot": False,
            })
            cy += avr.height_mm

        # ─── Właz ───
        if hatch:
            segments.append({
                "type": "wlaz",
                "start": cy,
                "end": cy + hatch.height,
                "is_ot": False,
            })
            cy += hatch.height

        # ─── Walidacja przejść ───
        validation = validate_transitions(
            segments, self.config.transitions, self.config.available_products
        )

        # ─── Budowa listy elementów ───
        out_items = [
            ItemDetail(
                product_id=dennica.id,
                name=dennica.name,
                component_type=dennica.component_type,
                height_mm=dennica.height,
            )
        ]

        # Zakończenie
        out_items.append(
            ItemDetail(
                product_id=top.id,
                name=top.name,
                component_type=top.component_type,
                height_mm=top.height,
            )
        )

        # AVR
        out_items.extend(avr_to_add)

        # Właz
        if hatch:
            out_items.append(
                ItemDetail(
                    product_id=hatch.id,
                    name=hatch.name,
                    component_type=hatch.component_type,
                    height_mm=hatch.height,
                )
            )

        all_errors = dennica_warnings + validation.errors
        if validation.has_minimal_clearance:
            all_errors.append("Zastosowano luzy minimalne.")

        logger.info(
            f"Studnia płytka zbudowana: {cy}mm "
            f"(dennica={dennica.height} + {top.name}={top.height} + AVR={sum(a.height_mm for a in avr_to_add)} + właz={hatch_h})"
        )

        return WellConfigResult(
            is_valid=validation.is_valid,
            total_height_mm=cy,
            items=out_items,
            errors=all_errors,
            has_minimal_clearance=validation.has_minimal_clearance,
            score=0.0,
        )

    def _validate_dennica(
        self,
        dennica: ProductModel,
        transitions_in_dennica: list,
        clearance_mode: str,
    ) -> Tuple[bool, List[str]]:
        """
        Waliduje czy dennica pomieści przejścia które w niej siedzą.
        Używa domyślnych zapasów gdy cennik nie definiuje wartości.
        Zwraca (ok, warnings).
        """
        if not transitions_in_dennica:
            return True, []

        warnings = []
        for t in transitions_in_dennica:
            hc_invert = float(t.height_from_bottom_mm)
            pprod = self.engine._get_transition_product(t.id)

            dn_val = 160.0
            if pprod and pprod.dn:
                dn_val = float(pprod.dn)

            # Użyj zapasów z cennika, a jeśli brak (0) → domyślne wg DN
            defaults = get_default_clearance(dn_val)
            z_dol = float(pprod.zapasDol) if (pprod and pprod.zapasDol) else defaults[0]
            z_gora = float(pprod.zapasGora) if (pprod and pprod.zapasGora) else defaults[1]
            z_dol_min = float(pprod.zapasDolMin) if (pprod and pprod.zapasDolMin) else defaults[2]
            z_gora_min = float(pprod.zapasGoraMin) if (pprod and pprod.zapasGoraMin) else defaults[3]

            # Rura przy samym dnie (dolna krawędź ~ 0) → ignoruj zapas dolny
            bottom_clearance = hc_invert
            top_clearance = dennica.height - (hc_invert + dn_val)
            
            is_at_bottom = bottom_clearance < 1
            eff_z_dol = -9999.0 if is_at_bottom else z_dol
            eff_z_dol_min = -9999.0 if is_at_bottom else z_dol_min

            if clearance_mode == "standard":
                if bottom_clearance < eff_z_dol or top_clearance < z_gora:
                    return False, []
            else:
                if bottom_clearance < eff_z_dol_min or top_clearance < z_gora_min:
                    return False, []
                if bottom_clearance < eff_z_dol or top_clearance < z_gora:
                    warnings.append(
                        f"Przejście w dennicy {pprod.name if pprod else '???'}: "
                        f"zastosowano luzy minimalne"
                    )

        return True, warnings

    def _select_avr_fill(self, remaining_mm: float) -> List[ItemDetail]:
        """Dobiera regulatory wejściowe (AVR) aby wypełnić brakującą wysokość.
        Używa backtrackingu (jak frontendowy bcktrAvr) by znaleźć kombinację
        najbliższą celowi, preferując mniej elementów przy tej samej różnicy.
        """
        if remaining_mm < 30:
            return []

        avr_list = self.engine.get_avr_list()
        if not avr_list:
            return []

        deficit = float(remaining_mm)
        best_combo: List[ProductModel] = []
        best_diff = deficit  # najmniejsza różnica |deficit - suma|

        def backtrack(combo: List[ProductModel], current_sum: float, start_idx: int):
            nonlocal best_combo, best_diff
            d = abs(deficit - current_sum)
            # Lepsza różnica, lub ta sama różnica ale mniej elementów
            if d < best_diff or (abs(d - best_diff) < 0.1 and len(combo) < len(best_combo)):
                best_diff = d
                best_combo = list(combo)
            if current_sum > deficit + 20:  # mała tolerancja nadmiaru
                return
            for i in range(start_idx, len(avr_list)):
                avr = avr_list[i]
                if current_sum + avr.height <= deficit + 20:
                    combo.append(avr)
                    backtrack(combo, current_sum + avr.height, i)
                    combo.pop()

        backtrack([], 0.0, 0)
        if not best_combo:
            return []

        # Zwróć jako osobne ItemDetail (bez quantity) — zgodnie z resztą generatora
        picked = []
        for avr in best_combo:
            picked.append(
                ItemDetail(
                    product_id=avr.id,
                    name=avr.name,
                    component_type=avr.componentType,
                    height_mm=avr.height,
                )
            )

        return picked
