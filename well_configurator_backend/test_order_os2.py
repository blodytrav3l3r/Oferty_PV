"""
Test konfiguracji studni z zamówienia OS/000002/AD/2026.
Symuluje problematyczne przypadki aby zweryfikować naprawione algorytmy.
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')

from configuration_generator.generator import ConfigurationGenerator
from api.schemas import WellConfigInput, TransitionInput, AvailableProduct
from database.tables import ProductModel
from database.local_db import get_db, Base, engine
import logging

logging.basicConfig(level=logging.INFO, format='%(name)s: %(message)s')
logger = logging.getLogger("TEST")

# Load products from local catalog
from sqlalchemy.orm import Session
db = next(get_db())
all_products_db = db.query(ProductModel).all()
logger.info(f"Loaded {len(all_products_db)} products from catalog")

# Convert DB products to AvailableProduct format
def db_to_available(p):
    return AvailableProduct(
        id=p.id,
        name=p.name,
        componentType=p.componentType,
        dn=p.dn,
        height=p.height or 0,
        formaStandardowaKLB=p.formaStandardowaKLB or 0,
        formaStandardowaWL=p.formaStandardowaWL or 0,
        zapasDol=p.zapasDol or 0,
        zapasGora=p.zapasGora or 0,
        zapasDolMin=p.zapasDolMin or 0,
        zapasGoraMin=p.zapasGoraMin or 0,
        magazynWL=p.magazynWL or 1,
        magazynKLB=p.magazynKLB or 1,
    )

available_products = [db_to_available(p) for p in all_products_db]

def test_well(name, dn, target_h_mm, transitions=None, use_reduction=False, forced_top=None):
    """Testuje konfigurację studni i wyświetla wynik."""
    print(f"\n{'='*70}")
    print(f"TEST: {name}")
    print(f"  DN={dn}, Target H={target_h_mm}mm ({target_h_mm/1000:.2f}m)")  
    if transitions:
        for t in transitions:
            print(f"  Przejście: {t.id} @ {t.height_from_bottom_mm}mm od dna")
    print(f"  Redukcja: {use_reduction}")
    print(f"{'='*70}")

    config = WellConfigInput(
        dn=dn,
        target_height_mm=target_h_mm,
        transitions=transitions or [],
        use_reduction=use_reduction,
        forced_top_closure_id=forced_top,
        warehouse="KLB",
        available_products=available_products,
    )

    # Build products list for the generator
    products_dn = []
    for p in available_products:
        pm = ProductModel(
            id=p.id, name=p.name, componentType=p.componentType,
            dn=p.dn, height=p.height,
            formaStandardowaKLB=p.formaStandardowaKLB,
            formaStandardowaWL=p.formaStandardowaWL,
            zapasDol=p.zapasDol, zapasGora=p.zapasGora,
            zapasDolMin=p.zapasDolMin, zapasGoraMin=p.zapasGoraMin,
            magazynWL=p.magazynWL, magazynKLB=p.magazynKLB,
        )
        products_dn.append(pm)

    gen = ConfigurationGenerator(products=products_dn, config=config)
    results = gen.generate()

    for r in results:
        status = "✅ VALID" if r.is_valid else "❌ INVALID"
        print(f"\n  {status} | Total H = {r.total_height_mm}mm | Stage = {r.stage}")
        if r.items:
            print(f"  Elementy ({len(r.items)}):")
            for item in r.items:
                ot_mark = " [OT/wiercony]" if item.is_ot else ""
                print(f"    • {item.name} (H={item.height_mm}mm) [{item.component_type}]{ot_mark}")
        if r.errors:
            print(f"  Błędy/ostrzeżenia:")
            for e in r.errors:
                print(f"    ⚠ {e}")

    return results

# ═══════════════════════════════════════════════════════════════
# TEST 1: Studnia s3 — DN1000, H=1340mm (PŁYTKA — wcześniej FAIL)
# Oczekiwane: dennica ~400 + konus 625 + AVR + właz = ~1340
# ═══════════════════════════════════════════════════════════════
test_well(
    "s3: DN1000 H=1340mm — studnia płytka z 2 przejściami w dennicy",
    dn=1000,
    target_h_mm=1340,
    transitions=[
        TransitionInput(id="PVC-lite-200", height_from_bottom_mm=0),  # wylot na dnie
        TransitionInput(id="PVC-lite-200", height_from_bottom_mm=0),  # wlot na dnie
    ]
)

# ═══════════════════════════════════════════════════════════════
# TEST 2: Studnia #4 — DN1000, H=800mm (BARDZO PŁYTKA — wcześniej FAIL)
# Oczekiwane: dennica ~500 + płyta DIN 200 + właz 110 = 810 ≈ 800
# ═══════════════════════════════════════════════════════════════
test_well(
    "#4: DN1000 H=800mm — bardzo płytka, wymaga DIN zamiast Konusa",
    dn=1000,
    target_h_mm=800,
    transitions=[
        TransitionInput(id="PVC-lite-200", height_from_bottom_mm=0),
        TransitionInput(id="PVC-lite-200", height_from_bottom_mm=0),
    ]
)

# ═══════════════════════════════════════════════════════════════
# TEST 3: Studnia s1 — DN1000, H=2500mm (STANDARDOWA)
# Oczekiwane: dennica + kręgi + konus + właz = ~2500
# ═══════════════════════════════════════════════════════════════
test_well(
    "s1: DN1000 H=2500mm — standardowa z przejściem na 1.20m",
    dn=1000,
    target_h_mm=2500,
    transitions=[
        TransitionInput(id="PVC-lite-400", height_from_bottom_mm=0),   # wylot na dnie
        TransitionInput(id="PVC-lite-200", height_from_bottom_mm=1200), # wlot na 1.20m
    ]
)

# ═══════════════════════════════════════════════════════════════
# TEST 4: Studnia #10 — DN1500, H=2000mm (PŁYTKA DN1500)
# Oczekiwane: dennica 1200 + konus 625 + właz 150 = 1975 ≈ 2000
# ═══════════════════════════════════════════════════════════════
test_well(
    "#10: DN1500 H=2000mm — płytka DN1500 (3 duże przejścia w dennicy)",
    dn=1500,
    target_h_mm=2000,
    transitions=[
        TransitionInput(id="Pragma-ID-400", height_from_bottom_mm=0),
        TransitionInput(id="Pragma-ID-400", height_from_bottom_mm=0),
        TransitionInput(id="Pragma-ID-800", height_from_bottom_mm=0),
    ]
)

# ═══════════════════════════════════════════════════════════════
# TEST 5: Studnia #12 — DN1500, H=3000mm (wysoka dennica, brak kręgów)
# Oczekiwane: dennica 2100 + konus 625 + AVR + właz = ~3000
# ═══════════════════════════════════════════════════════════════
test_well(
    "#12: DN1500 H=3000mm — duża dennica pokrywa prawie wszystko",
    dn=1500,
    target_h_mm=3000,
    transitions=[
        TransitionInput(id="Pragma-ID-1000", height_from_bottom_mm=500),  # wylot na 0.5m
        TransitionInput(id="Pragma-ID-1000", height_from_bottom_mm=0),    # wlot na dnie
    ]
)

# ═══════════════════════════════════════════════════════════════
# TEST 6: DN2500 #1 — H=3000mm (PŁYTKA DN2500, oczekiwana konfiguracja bez kręgów)
# Oczekiwane: dennica 2400 + płyta DIN 250 + AVR + właz = ~3000
# ═══════════════════════════════════════════════════════════════
test_well(
    "DN2500 #1: H=3000mm — płytka DN2500",
    dn=2500,
    target_h_mm=3000,
    transitions=[
        TransitionInput(id="Pragma-ID-1000", height_from_bottom_mm=0),
        TransitionInput(id="Pragma-ID-1000", height_from_bottom_mm=0),
        TransitionInput(id="Pragma-ID-1000", height_from_bottom_mm=1000),
    ]
)

# ═══════════════════════════════════════════════════════════════
# TEST 7: DN1000 #1 (last) — H=4000mm (WYSOKA — standardowa z przejściem na 2m)
# ═══════════════════════════════════════════════════════════════
test_well(
    "DN1000 #1: H=4000mm — wysoka z przejściem na 2.00m",
    dn=1000,
    target_h_mm=4000,
    transitions=[
        TransitionInput(id="PVC-lite-200", height_from_bottom_mm=0),
        TransitionInput(id="PVC-lite-200", height_from_bottom_mm=0),
        TransitionInput(id="PVC-lite-200", height_from_bottom_mm=2000),
    ]
)

print("\n\n" + "="*70)
print("WSZYSTKIE TESTY ZAKOŃCZONE")
print("="*70)
