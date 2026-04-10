from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import logging

from database.local_db import get_db
from database.crud import get_products_by_dn
from api.schemas import WellConfigInput, WellConfigResult, SyncRequest, SyncItem
from configuration_generator.generator import ConfigurationGenerator
from ml.ranker import ConfigurationRanker
from sync.sync_manager import SyncManager
from optimizer.cache import cache

logger = logging.getLogger("AI_ENDPOINTS")

router = APIRouter()
ranker = ConfigurationRanker()


@router.post("/configure", response_model=List[WellConfigResult])
def configure_well(config: WellConfigInput, db: Session = Depends(get_db)):
    """
    Kalkuluje kompletną studnię podając listę uporządkowanych elementów.
    Z cache'owaniem — identyczne konfiguracje zwracane natychmiastowo.
    """
    # 1. Sprawdź cache
    cache_key_data = {
        "dn": config.dn,
        "target_height_mm": config.target_height_mm,
        "transitions": [
            {"id": t.id, "height_from_bottom_mm": t.height_from_bottom_mm}
            for t in config.transitions
        ],
        "use_reduction": config.use_reduction,
        "warehouse": config.warehouse,
        "forced_top_closure_id": config.forced_top_closure_id,
        "available_products": config.available_products,
    }
    cached = cache.get(cache_key_data)
    if cached is not None:
        logger.info(
            f"Cache HIT dla konfiguracji DN={config.dn}, h={config.target_height_mm}mm"
        )
        return cached

    # 2. Zbuduj lokalne obiekty ProductModel w pamięci z przesłanych danych
    products_dn = []
    from database.tables import ProductModel

    for p in config.available_products:
        pm = ProductModel(
            id=p.id,
            name=p.name,
            componentType=p.componentType,
            dn=p.dn,
            height=p.height,
            formaStandardowaKLB=p.formaStandardowaKLB,
            formaStandardowaWL=p.formaStandardowaWL,
            zapasDol=p.zapasDol,
            zapasGora=p.zapasGora,
            zapasDolMin=p.zapasDolMin,
            zapasGoraMin=p.zapasGoraMin,
            magazynWL=p.magazynWL,
            magazynKLB=p.magazynKLB,
        )
        products_dn.append(pm)

    # 3. Wygeneruj konfiguracje wariantowe
    generator = ConfigurationGenerator(products=products_dn, config=config)
    results = generator.generate()

    # 4. Przeparuj przez model ML, który zescaluje je od najlepszego i dorzuci wynik (Score)
    ranked_results = ranker.rank_configurations(results)

    # 5. Zapisz w cache (tylko serializowalne dict)
    cache.put(cache_key_data, [r.model_dump() for r in ranked_results])

    return ranked_results


@router.post("/sync/push")
def sync_push(db: Session = Depends(get_db)):
    """
    Wypchnięcie lokalnych zmian do Master Server
    """
    manager = SyncManager(db)
    result = manager.sync_push()
    return result


@router.get("/sync/pull")
def sync_pull(db: Session = Depends(get_db)):
    """
    Pobranie aktualizacji z Master Server
    """
    manager = SyncManager(db)
    result = manager.sync_pull()
    return result
