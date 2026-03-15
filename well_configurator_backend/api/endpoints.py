from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from api.schemas import WellConfigInput, WellConfigResult, SyncRequest, SyncItem
from configuration_generator.generator import ConfigurationGenerator
from ml.ranker import ConfigurationRanker
from database.couchdb_provider import CouchDBProvider

router = APIRouter()
ranker = ConfigurationRanker()

@router.post("/configure", response_model=List[WellConfigResult])
def configure_well(config: WellConfigInput):
    """
    Kalkuluje kompletną studnię podając listę uporządkowanych elementów
    """
    # Zbuduj lokalne obiekty ProductModel w pamięci z przesłanych danych
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
            zapasGoraMin=p.zapasGoraMin
        )
        products_dn.append(pm)

    # 2. Wygeneruj konfiguracje wariantowe
    generator = ConfigurationGenerator(products=products_dn, config=config)
    results = generator.generate()

    # 3. Przeparuj przez model ML, który zescaluje je od najlepszego i dorzuci wynik (Score)
    ranked_results = ranker.rank_configurations(results)

    return ranked_results

@router.post("/sync/push")
def sync_push(sync_data: SyncRequest):
    return {"status": "ok", "message": "Mode: Direct CouchDB. Offline sync disabled."}

@router.get("/sync/pull")
def sync_pull():
    return {"status": "online", "mode": "Direct CouchDB"}
