from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
import logging

from database.local_db import get_db
from database.crud import get_products_by_dn
from api.schemas import WellConfigInput, WellConfigResult, SyncRequest, SyncItem
from configuration_generator.generator import ConfigurationGenerator
from ml.ranker import ConfigurationRanker
from ml.feedback_store import save_correction, ensure_tables as ensure_feedback_tables, get_correction_count
from ml.preference_learner import analyze_and_update_preferences, get_preferences_summary
from ml.passive_learner import (
    record_acceptance, ensure_passive_tables,
    analyze_and_save_usage_preferences, get_acceptance_stats
)
from sync.sync_manager import SyncManager
from optimizer.cache import cache

logger = logging.getLogger("AI_ENDPOINTS")

router = APIRouter()
ranker = ConfigurationRanker()

# Inicjalizacja tabel feedbacku i pasywnego uczenia przy pierwszym imporcie
try:
    ensure_feedback_tables()
    ensure_passive_tables()
except Exception as e:
    logger.warning(f"Nie udało się zainicjalizować tabel ML: {e}")


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
        "target_dn": config.target_dn,
        "redukcjaMinH": config.redukcjaMinH,
        "warehouse": config.warehouse,
        "forced_top_closure_id": config.forced_top_closure_id,
        "wkladkaZwienczenie": config.wkladkaZwienczenie,
        "psia_buda": config.psia_buda,
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
    ranked_results = ranker.rank_configurations(results, dn=str(config.dn))

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

@router.post("/telemetry/override")
def telemetry_override(payload: dict):
    """
    Zbiera dane telemetryczne o korektach użytkowników.
    Wywoływane z frontendu (offerManager.js) gdy użytkownik
    ręcznie zmieni konfigurację wygenerowaną przez AI.
    """
    original_config = payload.get("originalConfig", [])
    final_config = payload.get("finalConfig", [])
    override_reason = payload.get("overrideReason", "")
    well_params = payload.get("wellParams", {})

    if not original_config or not final_config:
        return {"status": "skipped", "reason": "brak danych konfiguracji"}

    try:
        row_id = save_correction(
            original_config=original_config,
            final_config=final_config,
            override_reason=override_reason,
            well_params=well_params,
        )

        # Po zapisie — przetrenuj preferencje
        total = get_correction_count()
        if total >= 3:
            analyze_and_update_preferences()
            logger.info(f"Preferencje zaktualizowane po {total} korektach.")

        return {"status": "ok", "correction_id": row_id, "total_corrections": total}
    except Exception as e:
        logger.error(f"Błąd zapisu telemetrii: {e}")
        return {"status": "error", "detail": str(e)}


@router.get("/telemetry/stats")
def telemetry_stats():
    """
    Zwraca statystyki systemu uczenia.
    Korekty + preferencje + akceptacje.
    """
    try:
        corrections = get_preferences_summary()
        acceptances = get_acceptance_stats()
        return {"status": "ok", **corrections, "acceptance": acceptances}
    except Exception as e:
        logger.error(f"Błąd odczytu statystyk telemetrii: {e}")
        return {"status": "error", "detail": str(e)}


@router.post("/telemetry/acceptance")
def telemetry_acceptance(payload: dict):
    """
    Pasywne uczenie — zapisuje każdą konfigurację studni
    przy zapisie oferty lub utworzeniu zamówienia.
    NIE wymaga ingerencji użytkownika.

    Frontend wysyła automatycznie przy:
    - saveOfferStudnie() → signal_type='OFFER_SAVE'
    - createOrderFromOffer() → signal_type='ORDER_CONFIRM'
    """
    wells_data = payload.get("wells", [])
    signal_type = payload.get("signalType", "OFFER_SAVE")

    if not wells_data:
        return {"status": "skipped", "reason": "brak studni"}

    try:
        saved = 0
        for w in wells_data:
            dn = w.get("dn", "")
            height = w.get("targetHeightMm", 0)
            source = w.get("configSource", "AUTO_AI")
            config = w.get("config", [])

            if not config:
                continue

            record_acceptance(
                dn=str(dn),
                target_height_mm=int(height),
                config_source=source,
                config_items=config,
                signal_type=signal_type,
            )
            saved += 1

        # Okresowo analizuj wzorce użycia (co 10 zapisów)
        stats = get_acceptance_stats()
        if stats.get("total_saved_configs", 0) % 10 == 0 and stats.get("total_saved_configs", 0) > 0:
            usage_count = analyze_and_save_usage_preferences()
            logger.info(f"Auto-analiza USAGE: {usage_count} preferencji.")

        return {"status": "ok", "saved": saved}
    except Exception as e:
        logger.error(f"Błąd zapisu acceptance: {e}")
        return {"status": "error", "detail": str(e)}


@router.get("/telemetry/export")
def telemetry_export():
    """
    Eksportuje wszystkie preferencje jako JSON.
    Umożliwia przeniesienie uczenia między komputerami.
    """
    try:
        from ml.preference_learner import get_active_preferences
        prefs = get_active_preferences(min_confidence=0.0)
        return {"status": "ok", "preferences": prefs, "count": len(prefs)}
    except Exception as e:
        logger.error(f"Błąd eksportu preferencji: {e}")
        return {"status": "error", "detail": str(e)}


@router.post("/telemetry/import")
def telemetry_import(payload: dict):
    """
    Importuje preferencje z innej instancji.
    Merge: istniejące preferencje o wyższym confidence nie są nadpisywane.
    """
    try:
        from ml.db_connection import get_ml_conn
        imported = payload.get("preferences", [])
        if not imported:
            return {"status": "skipped", "reason": "brak preferencji do importu"}

        conn = get_ml_conn()
        merged = 0
        skipped = 0
        try:
            for pref in imported:
                key = pref.get("pattern_key", "")
                if not key:
                    continue

                existing = conn.execute(
                    "SELECT confidence FROM learned_preferences WHERE pattern_key = ?",
                    (key,)
                ).fetchone()

                if existing and existing["confidence"] >= pref.get("confidence", 0):
                    skipped += 1
                    continue

                from datetime import datetime
                now = datetime.utcnow().isoformat()
                conn.execute("""
                    INSERT INTO learned_preferences
                        (pattern_type, pattern_key, pattern_data, confidence,
                         hit_count, last_hit, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(pattern_key) DO UPDATE SET
                        pattern_data = excluded.pattern_data,
                        confidence = excluded.confidence,
                        hit_count = excluded.hit_count,
                        last_hit = excluded.last_hit,
                        updated_at = excluded.updated_at
                """, (
                    pref.get("pattern_type", ""),
                    key,
                    pref.get("pattern_data", "{}") if isinstance(pref.get("pattern_data"), str)
                        else json.dumps(pref.get("pattern_data", {}), ensure_ascii=False),
                    pref.get("confidence", 0),
                    pref.get("hit_count", 0),
                    now, now, now,
                ))
                merged += 1

            conn.commit()
            return {"status": "ok", "merged": merged, "skipped": skipped}
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Błąd importu preferencji: {e}")
        return {"status": "error", "detail": str(e)}
