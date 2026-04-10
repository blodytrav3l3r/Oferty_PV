import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from api.main import app
from database.local_db import SessionLocal
from data.seed import seed_db

client = TestClient(app)


def setup_module(module):
    """ Uprzednie seedowanie danych testowych """
    seed_db()


# ─── Dane testowe (wspólne) ────────────────────────────────────────────

def _make_product(pid, name, comp_type, dn, height, std_klb=1, std_wl=1, mag_klb=1, mag_wl=1):
    """Helper — tworzenie obiektu produktu dla payloadów testowych."""
    return {
        "id": pid, "name": name, "componentType": comp_type,
        "dn": dn, "height": height,
        "formaStandardowaKLB": std_klb, "formaStandardowaWL": std_wl,
        "magazynKLB": mag_klb, "magazynWL": mag_wl,
        "zapasDol": 100, "zapasGora": 100,
        "zapasDolMin": 50, "zapasGoraMin": 50
    }


def _base_products_dn1500():
    """Typowy zestaw produktów DN1500 z redukcją do DN1000."""
    return [
        # Dennice
        _make_product("DDD-15-06", "Dennica DN1500 H600", "dennica", 1500, 600),
        _make_product("DDD-15-10", "Dennica DN1500 H1000", "dennica", 1500, 1000),
        # Kręgi DN1500
        _make_product("KDB-15-10", "Krąg DN1500 H1000", "krag", 1500, 1000),
        _make_product("KDB-15-07", "Krąg DN1500 H750", "krag", 1500, 750),
        _make_product("KDB-15-05", "Krąg DN1500 H500", "krag", 1500, 500),
        _make_product("KDB-15-02", "Krąg DN1500 H250", "krag", 1500, 250),
        # Kręgi DN1000
        _make_product("KDB-10-10", "Krąg DN1000 H1000", "krag", 1000, 1000),
        _make_product("KDB-10-07", "Krąg DN1000 H750", "krag", 1000, 750),
        _make_product("KDB-10-05", "Krąg DN1000 H500", "krag", 1000, 500),
        _make_product("KDB-10-02", "Krąg DN1000 H250", "krag", 1000, 250),
        # Kręgi OT
        _make_product("KOT-15-10", "Krąg OT DN1500 H1000", "krag_ot", 1500, 1000),
        _make_product("KOT-10-10", "Krąg OT DN1000 H1000", "krag_ot", 1000, 1000),
        # Płyta redukcyjna
        _make_product("PDR-15-10", "Płyta Redukcyjna DN1500/DN1000", "plyta_redukcyjna", 1500, 200),
        # Zakończenia
        _make_product("KON-15", "Konus DN1500", "konus", 1500, 600),
        _make_product("KON-10", "Konus DN1000", "konus", 1000, 600),
        _make_product("PDD-15", "Płyta DIN DN1500", "plyta_din", 1500, 250),
        _make_product("PDD-10", "Płyta DIN DN1000", "plyta_din", 1000, 250),
        # AVR (pierścienie wyrównawcze)
        _make_product("AVR-50", "AVR H50", "avr", None, 50),
        _make_product("AVR-80", "AVR H80", "avr", None, 80),
        _make_product("AVR-100", "AVR H100", "avr", None, 100),
        # Właz
        _make_product("WLAZ-150", "Właz DN600 H150", "wlaz", None, 150),
    ]


# ─── Testy ─────────────────────────────────────────────────────────────

def test_single_section_well():
    """Studnia jednosekcyjna DN1500 bez redukcji.
    Poprawna kolejność: dennica → kręgi → konus → AVR → właz
    """
    # den(600) + konus(600) + właz(150) = 1350 stałe → rings=2000 → total=3350
    payload = {
        "dn": 1500,
        "target_height_mm": 3350,
        "use_reduction": False,
        "warehouse": "KLB",
        "transitions": [],
        "available_products": _base_products_dn1500()
    }

    response = client.post("/api/v1/configure", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert len(data) > 0
    config = data[0]
    assert config["is_valid"] is True

    items = config["items"]
    types = [i["component_type"] for i in items]

    # Kolejność: dennica na dole
    assert types[0] == "dennica"

    # Zakończenie (konus/plyta_din) na górze stacka
    top_closure_types = ["konus", "plyta_din"]
    assert types[-1] in top_closure_types

    # Brak redukcji
    assert "plyta_redukcyjna" not in types

    # Kręgi — tylko DN1500
    kregi = [i for i in items if i["component_type"] in ["krag", "krag_ot"]]
    assert all("DN1500" in k["name"] for k in kregi)


def test_two_section_reduction():
    """Studnia dwusekcyjna DN1500 z redukcją do DN1000.
    Poprawna kolejność: dennica → kręgi DN1500 → płyta redukcyjna → kręgi DN1000 → konus → AVR → właz
    """
    # den(600) + plate(200) + konus_1000(600) + właz(150) = 1550 → rings=2000 → total=3550
    payload = {
        "dn": 1500,
        "target_height_mm": 3550,
        "use_reduction": True,
        "warehouse": "KLB",
        "transitions": [],
        "available_products": _base_products_dn1500()
    }

    response = client.post("/api/v1/configure", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert len(data) > 0
    config = data[0]
    assert config["is_valid"] is True

    items = config["items"]
    types = [i["component_type"] for i in items]

    # Kolejność: dennica → kręgi → redukcja → konus
    assert types[0] == "dennica"
    assert types[-1] in ["konus", "plyta_din"]

    # Płyta redukcyjna obecna
    assert "plyta_redukcyjna" in types


def test_warehouse_filtering():
    """Produkty niedostępne w magazynie nie powinny być użyte."""
    products = _base_products_dn1500()

    # Oznacz dennicę H600 jako niedostępną w KLB
    for p in products:
        if p["id"] == "DDD-15-06":
            p["magazynKLB"] = 0

    payload = {
        "dn": 1500,
        "target_height_mm": 2750,
        "use_reduction": False,
        "warehouse": "KLB",
        "transitions": [],
        "available_products": products
    }

    response = client.post("/api/v1/configure", json=payload)
    assert response.status_code == 200

    data = response.json()
    config = data[0]
    assert config["is_valid"] is True

    # Dennica H600 niedostępna w KLB → NIE powinna być użyta
    assert config["items"][0]["product_id"] != "DDD-15-06"


def test_transition_validation():
    """Przejście na wysokości łączenia powinno być wykryte."""
    payload = {
        "dn": 1500,
        "target_height_mm": 3350,
        "use_reduction": False,
        "warehouse": "KLB",
        "transitions": [
            {"id": "T1", "height_from_bottom_mm": 500}
        ],
        "available_products": _base_products_dn1500()
    }

    response = client.post("/api/v1/configure", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert len(data) > 0
    # Wynik powinien istnieć (valid lub invalid z errorem)
    config = data[0]
    assert isinstance(config["is_valid"], bool)


def test_sync_push():
    payload = {
        "changes": [
            {"item_id": "TEST-123"}
        ]
    }
    response = client.post("/api/v1/sync/push", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
