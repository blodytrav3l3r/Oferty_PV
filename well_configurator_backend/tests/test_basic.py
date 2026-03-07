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

def test_configure_well():
    payload = {
        "dn": 1500,
        "target_height_mm": 3500,
        "use_reduction": True,
        "warehouse": "KLB",
        "transitions": [
            {
                "id": "T1",
                "height_from_bottom_mm": 500
            }
        ]
    }
    
    response = client.post("/api/v1/configure", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) > 0
    config = data[0]
    
    # Validation z wymogów
    assert config["is_valid"] is True
    
    items = config["items"]
    
    # 1. Dennica powinna być na dole
    assert items[0]["component_type"] == "dennica"
    
    # 2. Płyta redukcyjna (ponieważ use_reduction=True) powinna być przed topem
    has_reduction = any(i["component_type"] == "plyta_redukcyjna" for i in items)
    assert has_reduction
    
    # 3. Zakończenie (domyślnie konus) na samej górze (jeśli z redukcją, to będzie to Konus DN1000)
    assert items[-1]["component_type"] in ["konus", "plyta_din"]
    
    # 4. Sprawdzenie, czy najwyższy krąg jest najbliżej dennicy
    kregi = [i for i in items if i["component_type"] in ["krag", "krag_ot"]]
    if len(kregi) >= 2:
        assert kregi[0]["height_mm"] >= kregi[1]["height_mm"]

def test_sync_push():
    payload = {
        "changes": [
            {"item_id": "TEST-123"}
        ]
    }
    response = client.post("/api/v1/sync/push", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
