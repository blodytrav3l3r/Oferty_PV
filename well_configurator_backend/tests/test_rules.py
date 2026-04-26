import sys
sys.path.insert(0, r'g:\GitHub\Oferty_PV\well_configurator_backend')

from api.schemas import WellConfigInput, AvailableProduct
from rule_engine.rules import RuleEngine, get_default_clearance

# Mock product
class MockProd:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

products = [
    MockProd(id="D-1500-500", name="Dennica 1500 500", componentType="dennica", dn=1500, height=500, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-15-25-D", name="Krąg 1500 250", componentType="krag", dn=1500, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-15-25-OT", name="Krąg 1500 250 OT", componentType="krag_ot", dn=1500, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="PR-1500-1000", name="Płyta redukcyjna 1500/1000", componentType="plyta_redukcyjna", dn=1500, height=150, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-25-D", name="Krąg 1000 250", componentType="krag", dn=1000, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KON-10-625", name="Konus 1000", componentType="konus", dn=1000, height=625, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="WLAZ-150", name="Właz 150", componentType="wlaz", dn=None, height=150, formaStandardowaKLB=1, magazynKLB=1),
]

config = WellConfigInput(
    dn=1500,
    target_height_mm=3000,
    use_reduction=True,
    target_dn=1000,  # standardowa redukcja
    warehouse="KLB",
    transitions=[],
)

engine = RuleEngine(products, config)

# Test get_kregi_list exclude ot
kregi_1500 = engine.get_kregi_list(1500)
print(f"kregi 1500 count: {len(kregi_1500)}, types: {[p.componentType for p in kregi_1500]}")
assert all(p.componentType == "krag" for p in kregi_1500), "OT should be excluded by default"

# Test get_kregi_list include ot
kregi_1500_ot = engine.get_kregi_list(1500, include_ot=True)
print(f"kregi 1500 with OT count: {len(kregi_1500_ot)}, types: {[p.componentType for p in kregi_1500_ot]}")
assert any(p.componentType == "krag_ot" for p in kregi_1500_ot), "OT should be included when requested"

# Test reduction plate with target_dn
plate = engine.get_reduction_plate()
print(f"reduction plate: {plate.id if plate else None}")
assert plate is not None, "Should find reduction plate"

# Test top closure with target_dn
closure = engine.get_top_closure(is_reduced=True)
print(f"top closure for reduced: {closure.id if closure else None}, dn={closure.dn if closure else None}")
assert closure is not None, "Should find top closure"
assert closure.dn == 1000, f"Top closure should be DN1000, got {closure.dn}"

print("OK: all rule tests passed")
