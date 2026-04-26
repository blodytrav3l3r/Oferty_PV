import sys
sys.path.insert(0, r'g:\GitHub\Oferty_PV\well_configurator_backend')

from api.schemas import WellConfigInput, AvailableProduct
from configuration_generator.generator import ConfigurationGenerator
from rule_engine.rules import RuleEngine

class MockProd:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
    @property
    def component_type(self):
        return getattr(self, 'componentType', '')

products = [
    MockProd(id="D-1000-500", name="Dennica 1000 500", componentType="dennica", dn=1000, height=500, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-10-D", name="Krąg 1000 1000", componentType="krag", dn=1000, height=1000, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KON-10-625", name="Konus 1000", componentType="konus", dn=1000, height=625, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="WLAZ-150", name="Właz 150", componentType="wlaz", dn=None, height=150, formaStandardowaKLB=1, magazynKLB=1),
    # AVR regulatory wejsciowe
    MockProd(id="AVR-60", name="AVR 60", componentType="avr", dn=None, height=60, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="AVR-80", name="AVR 80", componentType="avr", dn=None, height=80, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="AVR-100", name="AVR 100", componentType="avr", dn=None, height=100, formaStandardowaKLB=1, magazynKLB=1),
]

# Test: target_height=2435 = dennica(500) + krag(1000) + konus(625) + wlaz(150) = 2275
# Brakuje 160mm — AVR 60+100 = 160, idealnie
config = WellConfigInput(
    dn=1000,
    target_height_mm=2435,
    use_reduction=False,
    warehouse="KLB",
    transitions=[],
)

gen = ConfigurationGenerator(products=products, config=config)
results = gen.generate()
print(f"AVR test results count: {len(results)}, is_valid: {results[0].is_valid if results else 'N/A'}")
if results and results[0].items:
    for it in results[0].items:
        print(f"  {it.product_id}: {it.name} ({it.component_type}) h={it.height_mm}")

avr_items = [it for it in (results[0].items if results else []) if it.component_type == 'avr']
print(f"AVR items count: {len(avr_items)}, total AVR height: {sum(it.height_mm for it in avr_items)}")
assert len(avr_items) > 0, "Should have AVR items"
assert sum(it.height_mm for it in avr_items) == 160, f"AVR should fill 160mm, got {sum(it.height_mm for it in avr_items)}"
print("OK: AVR test passed")
