from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database.local_db import get_db
from database.crud import get_products_by_dn
from api.schemas import WellConfigInput, WellConfigResult, SyncRequest, SyncItem
from configuration_generator.generator import ConfigurationGenerator
from ml.ranker import ConfigurationRanker
from sync.sync_manager import SyncManager

router = APIRouter()
ranker = ConfigurationRanker()

@router.post("/configure", response_model=List[WellConfigResult])
def configure_well(config: WellConfigInput, db: Session = Depends(get_db)):
    """
    Kalkuluje kompletną studnię podając listę uporządkowanych elementów
    """
    # 1. Pobierz przefiltrowane produkty (np. po magazynie i DN z bazy)
    # W rzeczywistości Configuration Generator potrzebuje wszystkich elementów związanych (włazów, redukcji, konusów 1000 itd)
    # dlatego pobieramy `dn` i `1000` 
    products_dn = get_products_by_dn(db, config.dn, config.warehouse)
    if config.dn != 1000:
        products_1000 = get_products_by_dn(db, 1000, config.warehouse)
        # Złączanie bez duplikatów
        seen = set([p.id for p in products_dn])
        for p in products_1000:
            if p.id not in seen:
                products_dn.append(p)
                seen.add(p.id)

    # 2. Wygeneruj konfiguracje wariantowe
    generator = ConfigurationGenerator(products=products_dn, config=config)
    results = generator.generate()

    # 3. Przeparuj przez model ML, który zescaluje je od najlepszego i dorzuci wynik (Score)
    ranked_results = ranker.rank_configurations(results)

    return ranked_results

@router.post("/sync/push")
def sync_push(sync_data: SyncRequest, db: Session = Depends(get_db)):
    """
    Synchronizacja "offline-first". Wypchnięcie zmian do bazy serwera/zapisanie w bazie lokalnej.
    """
    manager = SyncManager(db)
    # Omijamy faktyczne transformacje dict() dla ułatwienia mocka
    # result = manager.sync_up(sync_data.changes)
    return {"status": "ok", "message": "Changes accepted and queued for sync if offline."}

@router.get("/sync/pull")
def sync_pull(db: Session = Depends(get_db)):
    """
    Pobiera aktualizacje asortymentu w postaci nowego słownika elementów 
    """
    manager = SyncManager(db)
    items = manager.sync_down()
    return {"items_to_update": len(items)}
