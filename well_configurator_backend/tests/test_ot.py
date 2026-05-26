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


def test_ot_ring_selection():
    packages = [
        MockProd(id="D-1000-500", name="Dennica 1000 500", componentType="dennica", dn=1000, height=500, formaStandardowaKLB=1, magazynKLB=1),
        MockProd(id="KDB-10-10-D", name="Krag 1000 1000", componentType="krag", dn=1000, height=1000, formaStandardowaKLB=1, magazynKLB=1),
        MockProd(id="KDB-10-05-D", name="Krag 1000 500", componentType="krag", dn=1000, height=500, formaStandardowaKLB=1, magazynKLB=1),
        MockProd(id="KDB-10-25-D", name="Krag 1000 250", componentType="krag", dn=1000, height=250, formaStandardowaKLB=1, magazynKLB=1),
        MockProd(id="KOT-10-25", name="Krag OT 1000 250", componentType="krag_ot", dn=1000, height=250, formaStandardowaKLB=1, magazynKLB=1),
        MockProd(id="KON-10-625", name="Konus 1000", componentType="konus", dn=1000, height=625, formaStandardowaKLB=1, magazynKLB=1),
        MockProd(id="WLAZ-150", name="Wlaz 150", componentType="wlaz", dn=None, height=150, formaStandardowaKLB=1, magazynKLB=1),
        MockProd(id="KIN-160", name="Kineta 160", componentType="przejscie", dn="160", height=0, formaStandardowaKLB=1, magazynKLB=1, zapasDol=200, zapasGora=200),
    ]

    # Transition at 750mm (in first ring above dennica 500mm)
    # dennica(500) + konus(625) + wlaz(150) = 1275mm fixed
    # rings needed: 2525 - 1275 = 1250mm → 1000+250=1250 (within tolerance)
    # transition at 750mm → first ring (500-750) and second ring (750-1250) overlap → should trigger OT
    transitions = [TransitionInput(id="KIN-160", height_from_bottom_mm=750.0)]

    config = WellConfigInput(
        dn=1000,
        target_height_mm=2525,
        use_reduction=False,
        warehouse="KLB",
        transitions=transitions,
        available_products=[]
    )

    gen = ConfigurationGenerator(products=packages, config=config)
    results = gen.generate()

    assert len(results) > 0
    assert results[0].is_valid, f"Should be valid, errors: {results[0].errors}"

    ot_items = [it for it in results[0].items if it.is_ot]
    assert len(ot_items) > 0, "Should have at least one OT ring"
    print(f"OK: OT test passed, {len(ot_items)} OT rings found")
