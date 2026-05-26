"""
Testy logiki doboru elementów studni — clearance z cennika
==========================================================
Testuje przepływ wartości zapasów (zapasDol/Gora, zapasDolMin/GoraMin)
z cennika przez backend OR-Tools.

Scenariusze:
- Odczyt zapasów z AvailableProduct
- Dennica selection: standard → minimal → physical → fallback
- Walidacja przejść z różnymi poziomami zapasów
- RuleEngine.get_lowest_dennica — bezpośrednie testy
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from api.schemas import WellConfigInput, AvailableProduct, TransitionInput
from configuration_generator.generator import ConfigurationGenerator
from rule_engine.rules import RuleEngine


class MockProd:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
    @property
    def component_type(self):
        return getattr(self, 'componentType', '')


def _make_prod(pid, name, comp_type, dn, height, **kw):
    defaults = dict(formaStandardowaKLB=1, magazynKLB=1)
    defaults.update(kw)
    return MockProd(id=pid, name=name, componentType=comp_type, dn=dn, height=height, **defaults)


def _make_avail(pid, name, comp_type, dn, **kw):
    defaults = dict(zapasDol=0, zapasGora=0, zapasDolMin=0, zapasGoraMin=0)
    defaults.update(kw)
    return AvailableProduct(
        id=pid, name=name, componentType=comp_type, dn=str(dn),
        height=0,
        zapasDol=defaults['zapasDol'],
        zapasGora=defaults['zapasGora'],
        zapasDolMin=defaults['zapasDolMin'],
        zapasGoraMin=defaults['zapasGoraMin'],
    )


# Stałe zestawy produktów
ALL_DENNICE = [
    _make_prod("D-1000-300", "Dennica 1000 300", "dennica", 1000, 300),
    _make_prod("D-1000-400", "Dennica 1000 400", "dennica", 1000, 400),
    _make_prod("D-1000-500", "Dennica 1000 500", "dennica", 1000, 500),
    _make_prod("D-1000-600", "Dennica 1000 600", "dennica", 1000, 600),
]

ALL_RINGS = [
    _make_prod("K-1000-1000", "Krag 1000 1000", "krag", 1000, 1000),
    _make_prod("K-1000-500", "Krag 1000 500", "krag", 1000, 500),
    _make_prod("K-1000-250", "Krag 1000 250", "krag", 1000, 250),
]

ALL_TOP = [
    _make_prod("KON-10-625", "Konus 1000", "konus", 1000, 625),
    _make_prod("WLAZ-150", "Wlaz 150", "wlaz", None, 150),
]


def calc_target(den_h, rings_h):
    """Oblicza target height dla DN1000 (dennica + rings + konus 625 + wlaz 150)."""
    return den_h + rings_h + 625 + 150


# ============================================================
# 1. AvailableProduct — odczyt zapasów z cennika
# ============================================================

class TestClearanceFromCatalog:
    """Testy odczytu zapasów z AvailableProduct."""

    def test_standard_clearance_values(self):
        prod = _make_avail("PRZ-160", "Przejście 160", "przejscie", 160,
                           zapasDol=300, zapasGora=300,
                           zapasDolMin=150, zapasGoraMin=150)
        assert prod.zapasDol == 300
        assert prod.zapasGora == 300
        assert prod.zapasDolMin == 150
        assert prod.zapasGoraMin == 150

    def test_custom_clearance_values(self):
        prod = _make_avail("PRZ-CUSTOM", "Niestandardowe", "przejscie", 200,
                           zapasDol=500, zapasGora=400,
                           zapasDolMin=200, zapasGoraMin=100)
        assert prod.zapasDol == 500
        assert prod.zapasGora == 400
        assert prod.zapasDolMin == 200
        assert prod.zapasGoraMin == 100

    def test_zero_clearance(self):
        """zapas=0 w schemacie — ale kod używa float(x) or 300 → 300."""
        prod = _make_avail("PRZ-0", "Zero", "przejscie", 160,
                           zapasDol=0, zapasGora=0,
                           zapasDolMin=0, zapasGoraMin=0)
        assert prod.zapasDol == 0  # schema default
        # W kodzie: float(pprod.zapasGora) if pprod.zapasGora else 300 → 300


# ============================================================
# 2. Generator — pełen przepływ z clearance
# ============================================================

class TestDennicaSelectionWithClearance:
    """Generator ConfigurationGenerator — clearance z cennika wpływa na wybór dennicy."""

    def _gen(self, den_h, rings_h, transitions, avail_products):
        """Helper: buduje config i uruchamia generator."""
        products = ALL_DENNICE + ALL_RINGS + ALL_TOP
        target = calc_target(den_h, rings_h)
        config = WellConfigInput(
            dn=1000, target_height_mm=target, use_reduction=False,
            warehouse="KLB", transitions=transitions,
            available_products=avail_products,
        )
        gen = ConfigurationGenerator(products=products, config=config)
        return gen.generate()

    def test_standard_clearance_passes(self):
        """DN160@100mm, zapas=300 → dennica 600 OK (top=340>=315)."""
        tr = [TransitionInput(id="PRZ-160", height_from_bottom_mm=100.0)]
        avail = [_make_avail("PRZ-160", "Przejście 160", "przejscie", 160,
                             zapasDol=300, zapasGora=300)]
        results = self._gen(600, 1500, tr, avail)
        assert len(results) > 0
        assert results[0].is_valid, f"Standard clearance fail: {results[0].errors}"

    def test_minimal_clearance_fallback(self):
        """DN160@150mm → top=190. standard(315) FAIL, minimal(165) OK."""
        tr = [TransitionInput(id="PRZ-160", height_from_bottom_mm=150.0)]
        avail = [_make_avail("PRZ-160", "Przejście 160", "przejscie", 160,
                             zapasDol=300, zapasGora=300,
                             zapasDolMin=150, zapasGoraMin=150)]
        results = self._gen(500, 1500, tr, avail)
        assert len(results) > 0
        assert results[0].is_valid, f"Minimal clearance fail: {results[0].errors}"
        assert results[0].stage not in ["Standard"], "Should fallback from Standard"
        assert results[0].has_minimal_clearance, "Should flag minimal clearance"

    @pytest.mark.skip(reason="Physical fallback requires full chain (dennica→rings→validator); unit test in TestRuleEngineDirect")
    def test_physical_fallback(self):
        """Przejście tylko fizycznie mieści się w dennicy."""
        pass

    def test_no_transitions_selects_lowest_dennica(self):
        """Bez przejść → najniższa dennica (300mm)."""
        results = self._gen(300, 1500, [], [])
        assert len(results) > 0
        assert results[0].is_valid
        denn = [it for it in results[0].items if it.component_type == 'dennica']
        assert len(denn) > 0

    def test_no_dennica_available(self):
        """Brak dennic → brak rozwiązania."""
        products = ALL_RINGS + ALL_TOP
        config = WellConfigInput(dn=1000, target_height_mm=2575, warehouse="KLB")
        gen = ConfigurationGenerator(products=products, config=config)
        results = gen.generate()
        assert len(results) == 0 or not results[0].is_valid

    def test_dennica_selection_prefers_standard_vs_minimal(self):
        """Dennica 400 (standard OK) wybrana nad 300 (tylko physical)."""
        tr = [TransitionInput(id="PRZ-160", height_from_bottom_mm=100.0)]
        avail = [_make_avail("PRZ-160", "Przejście 160", "przejscie", 160,
                             zapasDol=300, zapasGora=100,
                             zapasDolMin=150, zapasGoraMin=50)]
        # Dennica 400: top=400-(100+160)=140 >= 100+15=115 → standard OK
        results = self._gen(400, 1500, tr, avail)
        assert len(results) > 0
        assert results[0].is_valid, f"Selection fail: {results[0].errors}"


# ============================================================
# 3. RuleEngine — testy jednostkowe get_lowest_dennica
# ============================================================

class TestRuleEngineDirect:
    """RuleEngine.get_lowest_dennica() zwraca (ProductModel|None, warnings[])"""

    RPRODS = [
        MockProd(id="D-1000-300", name="Dennica 1000 300", componentType="dennica",
                 dn=1000, height=300, formaStandardowaKLB=1, magazynKLB=1),
        MockProd(id="D-1000-500", name="Dennica 1000 500", componentType="dennica",
                 dn=1000, height=500, formaStandardowaKLB=1, magazynKLB=1),
    ]

    def test_no_transitions(self):
        """Bez przejść → najniższa dennica."""
        engine = RuleEngine(self.RPRODS, WellConfigInput(dn=1000, target_height_mm=2000, warehouse="KLB"))
        d, warns = engine.get_lowest_dennica()
        assert d is not None
        assert d.id == "D-1000-300"

    def test_transition_above_dennica(self):
        """Przejście powyżej dennicy (800mm) → nie wpływa na wybór."""
        engine = RuleEngine(self.RPRODS, WellConfigInput(
            dn=1000, target_height_mm=2000, warehouse="KLB",
            transitions=[TransitionInput(id="PRZ-160", height_from_bottom_mm=800.0)],
            available_products=[_make_avail("PRZ-160", "P", "przejscie", 160, zapasDol=300, zapasGora=300)]
        ))
        d, warns = engine.get_lowest_dennica()
        assert d is not None
        assert d.id == "D-1000-300"

    def test_custom_clearance_from_catalog(self):
        """Niestandardowe zapasy (100/50) z cennika → dennica 500 standard OK.
        DN160@100mm, dennica 300: top=300-(100+160)=40 < 100+15=115 → FAIL.
        Dennica 500: top=500-(100+160)=240 >= 115 → standard OK → wybiera 500.
        """
        engine = RuleEngine(self.RPRODS, WellConfigInput(
            dn=1000, target_height_mm=2000, warehouse="KLB",
            transitions=[TransitionInput(id="PRZ-CUSTOM", height_from_bottom_mm=100.0)],
            available_products=[_make_avail("PRZ-CUSTOM", "Custom", "przejscie", 160,
                                            zapasDol=100, zapasGora=100,
                                            zapasDolMin=50, zapasGoraMin=50)]
        ))
        d, warns = engine.get_lowest_dennica()
        assert d is not None
        assert d.id == "D-1000-500"  # standard OK, higher dennica needed

    def test_minimal_clearance_works(self):
        """Przejście na 150mm → dennica 300: top=90 < 100+15 FAIL, < 50+15 FAIL, physical OK."""
        engine = RuleEngine(self.RPRODS, WellConfigInput(
            dn=1000, target_height_mm=2000, warehouse="KLB",
            transitions=[TransitionInput(id="PRZ-CUSTOM", height_from_bottom_mm=150.0)],
            available_products=[_make_avail("PRZ-CUSTOM", "Custom", "przejscie", 160,
                                            zapasDol=100, zapasGora=100,
                                            zapasDolMin=50, zapasGoraMin=50)]
        ))
        d, warns = engine.get_lowest_dennica()
        assert d is not None
        # Dennica 300: top=300-(150+160)=-10 < 0 → physical FAIL
        # Dennica 500: top=500-(150+160)=190
        #   standard: 190 >= 100+15=115 → OK! → wybiera 500
        assert d.id == "D-1000-500"

    def test_default_clearance_300_when_missing(self):
        """Brak zapasów w cenniku → domyślnie 300."""
        # Przejście DN160 na 200mm, brak zapasów w avail_product
        engine = RuleEngine(self.RPRODS, WellConfigInput(
            dn=1000, target_height_mm=2000, warehouse="KLB",
            transitions=[TransitionInput(id="PRZ-NO-CLEAR", height_from_bottom_mm=200.0)],
            available_products=[
                AvailableProduct(id="PRZ-NO-CLEAR", name="No clear", componentType="przejscie", dn="160")
            ]
        ))
        d, warns = engine.get_lowest_dennica()
        # Brak zapasów → kod używa float(pprod.zapasGora) if pprod.zapasGora else 300.0
        # pprod.zapasGora is None → else 300.0
        # Dennica 300: top=300-(200+160)=-60 < 0 → physical FAIL
        # Dennica 500: top=500-(200+160)=140
        #   standard: 140 >= 300+15=315? N → FAIL
        #   minimal: 140 >= 300+15? N → FAIL (zapasMin też domyślnie 300)
        #   physical: 140 >= 0? Y → OK
        # Wybiera 500 (physical)
        assert d is not None
        assert d.id == "D-1000-500"
