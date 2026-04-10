from typing import List, Optional, Tuple, Any
from database.tables import ProductModel
from api.schemas import WellConfigInput, AvailableProduct
import logging

logger = logging.getLogger("AI_RULES")

# ─── Domyślne zapasy przejść gdy cennik nie definiuje ───
# Używane jako PODPOWIEDŹ (hint) — system preferuje konfiguracje
# spełniające te zapasy, ale NIE odrzuca konfiguracji twardym błędem.
# Klucz = max DN rury, wartość = (zapasDol, zapasGora, zapasDolMin, zapasGoraMin)
DEFAULT_CLEARANCES = {
    200:  (100, 100, 50, 50),
    400:  (150, 150, 100, 100),
    600:  (200, 150, 150, 100),
    800:  (200, 200, 150, 100),
    1000: (250, 250, 200, 150),
    9999: (300, 300, 250, 200),
}


def get_default_clearance(pipe_dn: float) -> Tuple[float, float, float, float]:
    """
    Zwraca domyślne zapasy (zapasDol, zapasGora, zapasDolMin, zapasGoraMin) dla danego DN rury.
    Wartości traktowane jako PODPOWIEDŹ — preferowane, ale nie obligatoryjne.
    """
    for max_dn, clearances in sorted(DEFAULT_CLEARANCES.items()):
        if pipe_dn <= max_dn:
            return clearances
    return (300, 300, 250, 200)



class RuleEngine:
    def __init__(self, products: List[ProductModel], config: WellConfigInput):
        self.products = products
        self.config = config

    def _get_transition_product(self, t_id: str) -> Optional[AvailableProduct]:
        for p in self.config.available_products:
            if p.id == t_id:
                return p
        return None

    def get_lowest_dennica(self) -> Tuple[Optional[ProductModel], List[str]]:
        """
        Wybiera NAJNIŻSZĄ dennicę dla danego DN.
        KLUCZOWA ZASADA: Rury POWYŻEJ dennicy trafiają do kręgów OT.
        Dennica sprawdza zapasy TYLKO dla rur, które fizycznie w niej siedzą.
        """
        dennicy = [
            p
            for p in self.products
            if p.componentType == "dennica" and p.dn == self.config.dn
        ]
        if not dennicy:
            return None, []

        attr_magazyn = "magazynWL" if self.config.warehouse == "WL" else "magazynKLB"
        attr_forma = (
            "formaStandardowaWL"
            if self.config.warehouse == "WL"
            else "formaStandardowaKLB"
        )

        available_dennicy = [
            d for d in dennicy if (getattr(d, attr_magazyn, 0) or 0) > 0
        ]
        if not available_dennicy:
            available_dennicy = dennicy

        # PRIORYTET: NAJNIŻSZA dennica → potem forma standardowa
        available_dennicy.sort(key=lambda x: (x.height, -(getattr(x, attr_forma) or 0)))

        def check_dennica_internal(d: ProductModel, mode: str):
            """Sprawdza zapasy TYLKO dla rur WEWNĄTRZ dennicy. Rury powyżej → kręgi OT."""
            for t in self.config.transitions:
                hc_invert = float(t.height_from_bottom_mm)

                # Rura powyżej dennicy? → POMIJAJ (trafi do kręgu OT)
                if hc_invert >= d.height:
                    continue

                pprod = self._get_transition_product(t.id)
                dn_val = float(pprod.dn) if pprod and pprod.dn else 160.0
                defaults = get_default_clearance(dn_val)
                z_g = float(pprod.zapasGora or 0) if (pprod and pprod.zapasGora) else defaults[1]
                z_d = float(pprod.zapasDol or 0) if (pprod and pprod.zapasDol) else defaults[0]
                z_g_min = float(pprod.zapasGoraMin or 0) if (pprod and pprod.zapasGoraMin) else defaults[3]
                z_d_min = float(pprod.zapasDolMin or 0) if (pprod and pprod.zapasDolMin) else defaults[2]

                eff_z_d = -9999.0 if hc_invert < 1 else z_d
                eff_z_d_min = -9999.0 if hc_invert < 1 else z_d_min

                bottom_clearance = hc_invert
                top_clearance = d.height - (hc_invert + dn_val)

                if mode == "standard":
                    if bottom_clearance < eff_z_d or top_clearance < z_g:
                        return False
                elif mode == "minimal":
                    if bottom_clearance < eff_z_d_min or top_clearance < z_g_min:
                        return False
            return True

        # 1. Najniższa dennica z zapasami standardowymi
        for d in available_dennicy:
            if check_dennica_internal(d, "standard"):
                return d, []

        # 2. Najniższa dennica z zapasami minimalnymi
        for d in available_dennicy:
            if check_dennica_internal(d, "minimal"):
                return d, ["Zastosowano luzy minimalne w dennicy."]

        # 3. Fallback: najniższa dostępna (rury powyżej pójdą do kręgów OT)
        return available_dennicy[0], [
            "Dennica dobrana jako najniższa. Rury powyżej w kręgach OT."
        ]

    def get_reduction_plate(self) -> Optional[ProductModel]:
        """Szuka płyty redukcyjnej (zawsze z DN do DN1000)"""
        if (
            not self.config.use_reduction
            or self.config.dn == "styczna"
            or (isinstance(self.config.dn, int) and self.config.dn <= 1000)
        ):
            return None
        # Z założenia redukcja sprowadza z self.config.dn np. 1500, 2000 na 1000. Szukamy "plyta_redukcyjna"
        plates = [
            p
            for p in self.products
            if p.componentType == "plyta_redukcyjna" and p.dn == self.config.dn
        ]
        return plates[0] if plates else None

    def get_top_closure(
        self, is_reduced: bool, fallback_to_din: bool = False
    ) -> ProductModel:
        """
        Dobór zakończenia. Zawsze próbuje Konus. Jeśli wymuszone w config, to używa wymuszonego.
        Jeżeli fallback_to_din == True (bo przechodzi np. otwór), wymusza Płytę DIN.
        """
        top_dn = 1000 if is_reduced or self.config.dn == "styczna" else self.config.dn

        # Jeśli użytkownik wymusił coś w UI (np. "PDD-20")
        if self.config.forced_top_closure_id and not fallback_to_din:
            forced = next(
                (p for p in self.products if p.id == self.config.forced_top_closure_id),
                None,
            )
            if forced and (forced.dn == top_dn or forced.dn is None):
                return forced

        # Domyślnie Konus (jeśli istnieje dla danego DN - z reguły tylko DN1000, 1200?)
        attr_forma = (
            "formaStandardowaWL"
            if self.config.warehouse == "WL"
            else "formaStandardowaKLB"
        )

        candidates_konus = [
            p for p in self.products if p.componentType == "konus" and p.dn == top_dn
        ]
        candidates_din = [
            p
            for p in self.products
            if p.componentType == "plyta_din" and p.dn == top_dn
        ]

        # ZASADA: Standardowy Konus (≤650mm) MA PRIORYTET nad Konus+ (>650mm)
        # W obrębie kategorii sortuj wg formy standardowej
        candidates_konus.sort(key=lambda x: (
            0 if (x.height or 0) <= 650 else 1,  # Standardowy konus PIERWSZY
            -(getattr(x, attr_forma) or 0)
        ))
        candidates_din.sort(key=lambda x: -(getattr(x, attr_forma) or 0))

        if fallback_to_din:
            if candidates_din:
                return candidates_din[0]
            if candidates_konus:
                return candidates_konus[0]
            return None

        # Preferuj Konus, jeśli nie było wymuszenia i fallbacku
        if candidates_konus:
            return candidates_konus[0]
        elif candidates_din:
            return candidates_din[0]

        return None

    def get_all_available_dennice(self) -> List[ProductModel]:
        """Zwraca WSZYSTKIE dennice, priorytetyzując wysokość (NAJNIŻSZA PIERWSZA)."""
        dennicy = [
            p
            for p in self.products
            if p.componentType == "dennica" and p.dn == self.config.dn
        ]
        if not dennicy:
            return []

        attr_magazyn = "magazynWL" if self.config.warehouse == "WL" else "magazynKLB"
        attr_forma = (
            "formaStandardowaWL"
            if self.config.warehouse == "WL"
            else "formaStandardowaKLB"
        )

        # PRIORYTET: 
        # 1. NAJNIŻSZA wysokość (KISS/Efficiency)
        # 2. Dostępność w magazynie (Mag=1)
        # 3. Forma standardowa (Std=1)
        dennicy.sort(key=lambda x: (
            x.height, 
            -(getattr(x, attr_magazyn, 0) or 0), 
            -(getattr(x, attr_forma, 0) or 0)
        ))
        
        return dennicy

    def get_kregi_list(self, dn: Any) -> List[ProductModel]:
        """Wylistuj kręgi dla danej średnicy"""
        target_dn = 1000 if dn == "styczna" else dn
        kregi = [
            p
            for p in self.products
            if p.componentType in ["krag", "krag_ot"] and p.dn == target_dn
        ]
        attr_forma = (
            "formaStandardowaWL"
            if self.config.warehouse == "WL"
            else "formaStandardowaKLB"
        )
        # Sortuj, żeby standardowe były na liście "lepsze" (ale optimizer będzie ich używał wg wysokości)
        kregi.sort(key=lambda x: (-(getattr(x, attr_forma) or 0), -(x.height or 0)))
        return kregi

    def get_avr_list(self) -> List[ProductModel]:
        """Wylistuj pierścienie wyrównawcze (AVR)"""
        candidates = [
            p for p in self.products
            if p.componentType == "avr"
        ]
        # Sortuj rosnąco wg wysokości
        candidates.sort(key=lambda x: x.height)
        return candidates

    def get_konus_plus(self, dn: Any) -> Optional[ProductModel]:
        """Szuka Konus+ (H~850mm) dla danego DN."""
        candidates = [
            p for p in self.products
            if p.componentType == "konus" and p.dn == dn and (p.height or 0) > 800
        ]
        if not candidates:
            return None
        
        attr_forma = "formaStandardowaWL" if self.config.warehouse == "WL" else "formaStandardowaKLB"
        candidates.sort(key=lambda x: -(getattr(x, attr_forma, 0) or 0))
        return candidates[0]

    def get_default_hatch(self) -> Optional[ProductModel]:
        """Zwraca domyślny właz (preferowany 150mm)"""
        hatches = [
            p for p in self.products
            if p.componentType and p.componentType.lower() == "wlaz"
        ]
        if not hatches:
            return None
        
        attr_forma = "formaStandardowaWL" if self.config.warehouse == "WL" else "formaStandardowaKLB"
        
        # Sortowanie: 
        # 1. Wysokość najbliższa 150mm
        # 2. Forma standardowa
        hatches.sort(key=lambda x: (abs((x.height or 0) - 150), -(getattr(x, attr_forma, 0) or 0)))
        
        return hatches[0]

    def get_alternative_hatch(self) -> Optional[ProductModel]:
        """
        Zwraca mniejszy właz (np. 110mm).
        UWAGA: Do użytku WYŁĄCZNIE przez użytkownika w trybie ręcznym.
        NIE wywoływać w auto-doborze.
        """
        hatches = [
            p for p in self.products
            if p.componentType and p.componentType.lower() == "wlaz"
        ]
        if not hatches:
            return None
        
        # Sortuj wg wysokości rosnąco — zwracamy najniższy
        hatches.sort(key=lambda x: (x.height or 9999))
        return hatches[0] if hatches else None

    def get_closure_for_available_space(
        self,
        available_space_mm: int,
        is_reduced: bool,
    ) -> Tuple[Optional[ProductModel], Optional[ProductModel]]:
        """
        Dobiera parę (zakończenie, właz) która mieści się w dostępnej przestrzeni.
        
        ZASADY:
        - Właz ZAWSZE 150mm w trybie auto (110mm tylko ręcznie przez użytkownika)
        - Kolejność prób zakończenia:
          1. Konus (najwyższy) + Właz 150mm
          2. Płyta DIN + Właz 150mm
        
        Zwraca: (top_closure, hatch) lub (None, None) jeśli nic nie pasuje.
        """
        top_dn = 1000 if is_reduced or self.config.dn == "styczna" else self.config.dn
        
        # Zbierz kandydatów
        konus_candidates = [
            p for p in self.products
            if p.componentType == "konus" and p.dn == top_dn
        ]
        din_candidates = [
            p for p in self.products
            if p.componentType == "plyta_din" and p.dn == top_dn
        ]
        
        # TYLKO właz 150mm w auto-doborze (110mm = wyłącznie ręcznie)
        hatch_150 = self.get_default_hatch()  # Preferuje 150mm
        
        # Jeśli użytkownik wymusił zakończenie
        if self.config.forced_top_closure_id:
            forced = next(
                (p for p in self.products if p.id == self.config.forced_top_closure_id),
                None,
            )
            if forced:
                if hatch_150 and forced.height + hatch_150.height <= available_space_mm:
                    return forced, hatch_150
                # Bez włazu — nie negocjujemy na 110mm
                if forced.height <= available_space_mm:
                    return forced, None
        
        # Próbuj najpierw standardowy Konus (625mm), potem Konus+ (850mm), potem DIN
        # ZASADA: Konus standardowy MA PRIORYTET nad Konus+
        # Konus+ jest używany TYLKO gdy standardowy nie mieści się z kręgami
        konus_standard = sorted(
            [k for k in konus_candidates if k.height and k.height <= 650],
            key=lambda x: (x.height or 0)  # Najniższy standardowy konus
        )
        konus_plus = sorted(
            [k for k in konus_candidates if k.height and k.height > 650],
            key=lambda x: (x.height or 0)
        )
        all_closures = konus_standard + konus_plus + din_candidates
        
        for closure in all_closures:
            if hatch_150 and closure.height + hatch_150.height <= available_space_mm:
                logger.info(
                    f"Dobrano zakończenie: {closure.name} (H={closure.height}) "
                    f"+ właz: {hatch_150.name} (H={hatch_150.height}) "
                    f"dla przestrzeni {available_space_mm}mm"
                )
                return closure, hatch_150
        
        # Ostatnia opcja: sam closure bez włazu (NIE próbujemy 110mm)
        for closure in all_closures:
            if closure.height <= available_space_mm:
                logger.warning(
                    f"Nie zmieścił się właz 150mm — tylko zakończenie: {closure.name}"
                )
                return closure, None
        
        return None, None
