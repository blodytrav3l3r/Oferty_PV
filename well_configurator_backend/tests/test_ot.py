import sys
sys.path.insert(0, r'g:\GitHub\Oferty_PV\well_configurator_backend')

from api.schemas import WellConfigInput, AvailableProduct, TransitionInput
from configuration_generator.generator import ConfigurationGenerator

class MockProd:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
    @property
    def component_type(self):
        return getattr(self, 'componentType', '')

products = [
    MockProd(id="D-1000-500", name="Dennica 1000 500", componentType="dennica", dn=1000, height=500, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-25-D", name="Krąg 1000 250", componentType="krag", dn=1000, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-10-D", name="Krąg 1000 1000", componentType="krag", dn=1000, height=1000, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-25-OT", name="Krąg 1000 250 OT", componentType="krag_ot", dn=1000, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KON-10-625", name="Konus 1000", componentType="konus", dn=1000, height=625, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="WLAZ-150", name="Właz 150", componentType="wlaz", dn=None, height=150, formaStandardowaKLB=1, magazynKLB=1),
    # Przejście produkt (kineta)
    MockProd(id="KIN-160", name="Kineta 160", componentType="przejscie", dn="160", height=0, formaStandardowaKLB=1, magazynKLB=1, zapasDol=200, zapasGora=200),
]

# Test z przejściem powyżej dennicy - powinien dać OT
transitions = [
    TransitionInput(id="KIN-160", height_from_bottom_mm=750.0)
]

config = WellConfigInput(
    dn=1000,
    target_height_mm=2500,
    use_reduction=False,
    warehouse="KLB",
    transitions=transitions,
    available_products=[
        AvailableProduct(id="KIN-160", name="Kineta 160", componentType="przejscie", dn="160", zapasDol=200, zapasGora=200),
    ]
)

gen = ConfigurationGenerator(products=products, config=config)
results = gen.generate()
print(f"OT test results count: {len(results)}, is_valid: {results[0].is_valid if results else 'N/A'}")
if results and results[0].items:
    for it in results[0].items:
        print(f"  {it.product_id}: {it.name} ({it.component_type}) h={it.height_mm} is_ot={it.is_ot}")

# Check OT was used
ot_items = [it for it in (results[0].items if results else []) if it.is_ot]
print(f"OT items count: {len(ot_items)}")
assert len(ot_items) > 0, "Should have at least one OT ring"
print("OK: OT test passed")
