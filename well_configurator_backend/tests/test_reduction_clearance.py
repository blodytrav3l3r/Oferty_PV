import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from api.schemas import WellConfigInput, AvailableProduct, TransitionInput
from configuration_generator.generator import ConfigurationGenerator


class MockProd:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
    @property
    def component_type(self):
        return getattr(self, 'componentType', '')


def _make_prod(pid, name, comp_type, dn, height, **kw):
    defaults = dict(formaStandardowaKLB=1, magazynKLB=1, zapasDol=0, zapasGora=0)
    defaults.update(kw)
    return MockProd(id=pid, name=name, componentType=comp_type, dn=dn, height=height, **defaults)


def _minimal_reduction_products():
    """Produkty DN1500→DN1000 z redukcją — celowo brak 250mm DN1500 by wymusić fallback."""
    return [
        _make_prod("D-1500-500", "Dennica 1500 500", "dennica", 1500, 500),
        _make_prod("KDB-15-10-A", "Krag 1500 1000", "krag", 1500, 1000),
        _make_prod("KDB-15-10-B", "Krag 1500 1000", "krag", 1500, 1000),
        _make_prod("KDB-15-07-A", "Krag 1500 750", "krag", 1500, 750),
        _make_prod("KDB-15-05-A", "Krag 1500 500", "krag", 1500, 500),
        _make_prod("PR-1500-1000", "Plyta redukcyjna 1500/1000", "plyta_redukcyjna", 1500, 150),
        _make_prod("KDB-10-10-A", "Krag 1000 1000", "krag", 1000, 1000),
        _make_prod("KDB-10-07-A", "Krag 1000 750", "krag", 1000, 750),
        _make_prod("KDB-10-05-A", "Krag 1000 500", "krag", 1000, 500),
        _make_prod("KDB-10-25-A", "Krag 1000 250", "krag", 1000, 250),
        _make_prod("KON-10-625", "Konus 1000", "konus", 1000, 625),
        _make_prod("WLAZ-150", "Wlaz 150", "wlaz", None, 150),
        _make_prod("AVR-60", "AVR 60", "avr", None, 60),
        _make_prod("AVR-80", "AVR 80", "avr", None, 80),
        _make_prod("AVR-100", "AVR 100", "avr", None, 100),
    ]


def test_reduction_clearance_minimal():
    """Reduction with transition that forces minimal clearance mode.
    Transition at 3040mm, DN160, standard zapas 200/minimal 50.
    
    Standard: chamber=3040+160+200=3400, target_below=3400-500=2900, range[2900,2920]
             Available DN1500 sums: 2500, 2750, 3000 — none in range → FAILS
    
    Minimal:  chamber=3040+160+50=3250,  target_below=3250-500=2750, range[2750,2770]
              DN1500 rings: 1000+1000+750=2750 → in range ✓
              Joints at 1000,2000(unit coords) → both below danger zone[2490,2750] ✓
    
    Total target 6000: den(500)+below(2750)+plate(150)+above+konus(625)+wlaz(150)=6000
                       above_rings = 6000-4175 = 1825 → 1000+750=1750 + AVR80=1830 ✓
    """
    products = _minimal_reduction_products()

    config = WellConfigInput(
        dn=1500,
        target_height_mm=6000,
        use_reduction=True,
        target_dn=1000,
        redukcja_min_h_mm=2500,
        warehouse="KLB",
        transitions=[
            TransitionInput(id="PRZ-160", height_from_bottom_mm=3040.0)
        ],
        available_products=[
            AvailableProduct(id="PRZ-160", name="Przejscie 160", componentType="przejscie", dn="160", zapasDol=200, zapasGora=200, zapasDolMin=50, zapasGoraMin=50),
        ]
    )

    gen = ConfigurationGenerator(products=products, config=config)
    results = gen.generate()

    assert len(results) > 0
    assert results[0].is_valid, f"Should be valid, errors: {results[0].errors}"
    # Standard stage fails (below section unreachable), minimal stage succeeds → fallback
    assert results[0].stage in ["Optymalny", "Ratunkowy"], f"Should use non-standard stage, got {results[0].stage}"

    types = [it.component_type for it in results[0].items]
    assert "plyta_redukcyjna" in types
    assert "dennica" in types
    assert "wlaz" in types
