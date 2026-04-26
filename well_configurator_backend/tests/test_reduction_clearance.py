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
    MockProd(id="PR-1500-1000", name="Płyta redukcyjna 1500/1000", componentType="plyta_redukcyjna", dn=1500, height=150, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-10-D", name="Krąg 1000 1000", componentType="krag", dn=1000, height=1000, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KDB-10-25-D", name="Krąg 1000 250", componentType="krag", dn=1000, height=250, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="KON-10-625", name="Konus 1000", componentType="konus", dn=1000, height=625, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="WLAZ-150", name="Właz 150", componentType="wlaz", dn=None, height=150, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="AVR-60", name="AVR 60", componentType="avr", dn=None, height=60, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="AVR-80", name="AVR 80", componentType="avr", dn=None, height=80, formaStandardowaKLB=1, magazynKLB=1),
    MockProd(id="AVR-100", name="AVR 100", componentType="avr", dn=None, height=100, formaStandardowaKLB=1, magazynKLB=1),
]

# Przejście na 3000mm, zapas standard 200, zapas minimal 50
# Cel: 5000mm
# Dennica 500 + płyta 150 + konus 625 + wlaz 150 = 1425
# Kręgi: 5000 - 1425 = 3575
# Bez redukcji: 1500 DN + 1000 DN = 3575 — nie mamy 1500 powyżej
# Z redukcją: komora = max(2500, 3000+160+200=3360) dla standard = 3360
#                komora = max(2500, 3000+160+50=3210) dla minimal = 3210
# Poniżej płyty (DN1500): 3360-500=2860 lub 3210-500=2710
# Powyżej płyty (DN1000): min 1 krąg 250
# Total kręgi: 3575 — poniżej: 2860 (2x1000=2000 + 1x1000=1000? nie, mamy tylko 1500)
# Mamy KDB-15-10-D (1000mm) dla DN1500 — trzeba 3x = 3000
# Hmm, zróbmy bardziej realistyczny test.

# Zmniejszmy target_height do 4200
# Dennica 500 + płyta 150 + konus 625 + wlaz 150 = 1425
# Kręgi: 4200 - 1425 = 2775
# Komora standard: max(2500, 3000+160+200=3360) = 3360 > 2775 — NIE DA SIĘ (za mało kręgów)
# Komora minimal: max(2500, 3000+160+50=3210) = 3210 > 2775 — też NIE DA SIĘ

# Zwiększmy target_height do 5000, ale dajmy więcej kręgów 1500
products2 = products + [
    MockProd(id="KDB-15-25-D", name="Krąg 1500 250", componentType="krag", dn=1500, height=250, formaStandardowaKLB=1, magazynKLB=1),
]

# Teraz: 5000 - 1425 = 3575 kręgów
# Poniżej płyty: 3360-500=2860 dla standard, 3210-500=2710 dla minimal
# 3x1000 (DN1500) = 3000 > 2860, więc 2x1000 + 1x250 = 2250 < 2860 — nadal za mało
# Hmm, problem z testowymi danymi.

# Zróbmy target_height = 5500
# 5500 - 1425 = 4075
# Poniżej płyty: 3360-500=2860 (standard) lub 3210-500=2710 (minimal)
# 2x1000 + 1x250 = 2250 < 2710 — nadal za mało
# 3x1000 = 3000 > 2860

# Dodajmy więcej kręgów
products3 = products2 + [
    MockProd(id="KDB-15-50-D", name="Krąg 1500 500", componentType="krag", dn=1500, height=500, formaStandardowaKLB=1, magazynKLB=1),
]

# 5500 - 1425 = 4075
# Poniżej: 3x1000 + 1x250 = 3250 > 2860 i > 2710 — OK
# Powyżej: 4075 - 3250 = 825 → 1x625? nie, konus jest osobno. 1x250 = 250, brakuje 575 → AVR?
# Hmm, konus jest osobno, więc kręgi powyżej = 4075 - 3250 = 825. Mamy tylko 250 i 1000 dla DN1000.
# 1000 > 825 (tolerance_above=20, więc 1000 > 845? nie)
# Z tolerance_below=60: 825+60=885, 1000 > 885 — nie
# Z tolerance_below=200: 825+200=1025, 1000 <= 1025 — tak!
# Czyli w Stage "Standard" (tol 60) — nie da się, w Stage "Optymalny" (tol 200) — da się.

# Ale to nie testuje zapasów minimalnych w redukcji...
# Zróbmy prościej: target_height=4500, redukcjaMinH=2500, przejście na 2700mm
# Przejście DN=160, zapas standard=200, zapas minimal=50
# Standard: 2700+160+200 = 3060 > 2500 → required_chamber_h = 3060
# Minimal: 2700+160+50 = 2910 > 2500 → required_chamber_h = 2910
# 4500 - 1425 = 3075 kręgów
# Poniżej płyty (standard): 3060-500=2560. 2x1000+1x250=2250 < 2560, 3x1000=3000 > 2560 (tolerance 60: 2560+60=2620, 3000>2620 — nie)
# tolerance 200: 2560+200=2760, 3000>2760 — nie
# Hmm, problem.

# Target_height=4800: 4800-1425=3375
# Poniżej standard: 2560. 3x1000=3000 <= 2560+200=2760 — nie, 3000 > 2760
# Poniżej minimal: 2410. 2x1000+1x250=2250 <= 2410+200=2610 — tak!
# Czyli w trybie minimalnym da się, w standardzie nie.

config = WellConfigInput(
    dn=1500,
    target_height_mm=4800,
    use_reduction=True,
    target_dn=1000,
    redukcja_min_h_mm=2500,
    warehouse="KLB",
    transitions=[
        TransitionInput(id="PRZ-160", height_from_bottom_mm=2700.0)
    ],
    available_products=[
        AvailableProduct(id="PRZ-160", name="Przejście 160", componentType="przejscie", dn="160", zapasDol=200, zapasGora=200, zapasDolMin=50, zapasGoraMin=50),
    ]
)

gen = ConfigurationGenerator(products=products3, config=config)
results = gen.generate()
print(f"Reduction clearance test results count: {len(results)}, is_valid: {results[0].is_valid if results else 'N/A'}")
if results and results[0].items:
    print(f"Stage: {results[0].stage}")
    for it in results[0].items:
        print(f"  {it.product_id}: {it.name} ({it.component_type}) h={it.height_mm}")

# Powinno przejść w trybie "Optymalny" lub "Ratunkowy" bo w "Standard" zapas górny 200 wymaga za dużej komory
assert results[0].is_valid, "Should be valid with minimal clearance mode"
assert results[0].stage in ["Optymalny", "Ratunkowy"], f"Should use non-standard stage, got {results[0].stage}"
print("OK: reduction clearance minimal test passed")
