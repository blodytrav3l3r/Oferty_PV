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
    MockProd(id="D-1500-500", name="Dennica 1500 500", componentType="dennica", dn=1500, height=500, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-15-25-D", name="Krąg 1500 250", componentType="krag", dn=1500, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-15-10-D", name="Krąg 1500 1000", componentType="krag", dn=1500, height=1000, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-15-25-OT", name="Krąg 1500 250 OT", componentType="krag_ot", dn=1500, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="PR-1500-1000", name="Płyta redukcyjna 1500/1000", componentType="plyta_redukcyjna", dn=1500, height=150, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-25-D", name="Krąg 1000 250", componentType="krag", dn=1000, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-10-D", name="Krąg 1000 1000", componentType="krag", dn=1000, height=1000, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KON-10-625", name="Konus 1000", componentType="konus", dn=1000, height=625, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="WLAZ-150", name="Właz 150", componentType="wlaz", dn=None, height=150, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="AVR-50", name="AVR 50", componentType="avr", dn=None, height=50, formaStandardowaKLB=1, magazynKLB=1),
]

# Test standard reduction DN1000
config1000 = WellConfigInput(
    dn=1500,
    target_height_mm=3000,
    use_reduction=True,
    target_dn=1000,
    warehouse="KLB",
    transitions=[],
)

gen = ConfigurationGenerator(products=products, config=config1000)
results = gen.generate()
print(f"Standard reduction results count: {len(results)}, is_valid: {results[0].is_valid if results else 'N/A'}")
if results and results[0].items:
    for it in results[0].items:
        print(f"  {it.product_id}: {it.name} ({it.component_type}) h={it.height_mm}")

# Test custom reduction DN1200 (but no DN1200 products available - should fallback)
config1200 = WellConfigInput(
    dn=1500,
    target_height_mm=3000,
    use_reduction=True,
    target_dn=1200,
    warehouse="KLB",
    transitions=[],
)

gen2 = ConfigurationGenerator(products=products, config=config1200)
results2 = gen2.generate()
print(f"Custom reduction DN1200 results count: {len(results2)}, is_valid: {results2[0].is_valid if results2 else 'N/A'}")
if results2 and results2[0].items:
    for it in results2[0].items:
        print(f"  {it.product_id}: {it.name} ({it.component_type}) h={it.height_mm}")

print("OK: generator tests completed")
