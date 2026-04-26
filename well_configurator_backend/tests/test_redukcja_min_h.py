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
    MockProd(id="D-1500-500", name="Dennica 1500 500", componentType="dennica", dn=1500, height=500, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-15-10-D", name="Krąg 1500 1000", componentType="krag", dn=1500, height=1000, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-15-25-D", name="Krąg 1500 250", componentType="krag", dn=1500, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="PR-1500-1000", name="Płyta redukcyjna 1500/1000", componentType="plyta_redukcyjna", dn=1500, height=150, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-10-D", name="Krąg 1000 1000", componentType="krag", dn=1000, height=1000, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-25-D", name="Krąg 1000 250", componentType="krag", dn=1000, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KON-10-625", name="Konus 1000", componentType="konus", dn=1000, height=625, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="WLAZ-150", name="Właz 150", componentType="wlaz", dn=None, height=150, formaStandardowaKLB=1, magazynKLB=1),
]

# Test: redukcjaMinH = 3000mm, bez przejść (required_chamber_h = 0)
# Target = 6000mm
# Dennica 500 + płyta 150 + konus 625 + wlaz 150 = 1425
# Kręgi: 6000 - 1425 = 4575
# Komora = max(3000, 0) = 3000
# Kręgi pod płytą: 3000 - 500 = 2500
# Kręgi powyżej: 4575 - 2500 = 2075 → można 2x1000=2000 (tolerance 75 < 60? nie, 75 > 60, więc Stage Standard nie przejdzie)
# tolerance_below=200 w Stage Optymalny → 2500+200=2700 >= 2000, 2075 <= 2500+200=2700 → tak
# Ale kręgi powyżej: 2075, tolerance_above=20, więc 2000 <= 2075+20=2095 → tak
# Czyli powinno przejść w Stage Optymalny

config = WellConfigInput(
    dn=1500,
    target_height_mm=6000,
    use_reduction=True,
    target_dn=1000,
    redukcja_min_h_mm=3000,
    warehouse="KLB",
    transitions=[],
    available_products=[]
)

gen = ConfigurationGenerator(products=products, config=config)
results = gen.generate()

print(f"=== redukcjaMinH=3000, target=6000, bez przejść ===")
print(f"Results count: {len(results)}, is_valid: {results[0].is_valid if results else 'N/A'}")
if results and results[0].items:
    print(f"Stage: {results[0].stage}")
    total_h = 0
    for it in results[0].items:
        print(f"  {it.product_id}: {it.name} ({it.component_type}) h={it.height_mm}")
        total_h += it.height_mm
    print(f"  Total height: {total_h}")

    # Sprawdź gdzie jest płyta redukcyjna
    h = 0
    for it in results[0].items:
        if it.component_type == 'plyta_redukcyjna':
            print(f"  Płyta redukcyjna na wysokości: {h}mm od dna (powinno być >= 3000mm)")
            break
        h += it.height_mm

assert results[0].is_valid, "Should be valid"
print("OK: redukcjaMinH test passed")
