"""
Passive Learning — Pasywne uczenie bez ingerencji użytkownika.

Trzy mechanizmy:
1. ACCEPTANCE — Śledzenie zaakceptowanych konfiguracji AI (pozytywne wzmocnienie)
2. USAGE_FREQUENCY — Analiza najczęściej używanych komponentów per DN/wysokość
3. ORDER_CONFIRMATION — Zamówienia = najsilniejszy sygnał (złoty standard)

Wywoływane automatycznie przez backend przy:
- Zapisie oferty (acceptance)
- Utworzeniu zamówienia (order confirmation)
- Periodycznie (usage frequency)
"""
import json
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Optional
from collections import Counter

from ml.db_connection import get_ml_conn

logger = logging.getLogger("AI_PASSIVE")


def _get_conn():
    return get_ml_conn()


def ensure_passive_tables():
    """Tworzy tabele dla pasywnego uczenia."""
    conn = _get_conn()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS config_acceptances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                dn TEXT NOT NULL,
                target_height_mm INTEGER DEFAULT 0,
                config_source TEXT DEFAULT 'AUTO_AI',
                was_modified INTEGER DEFAULT 0,
                config_items TEXT NOT NULL,
                signal_type TEXT DEFAULT 'OFFER_SAVE',
                config_hash TEXT DEFAULT ''
            );

            CREATE INDEX IF NOT EXISTS idx_accept_dn
                ON config_acceptances(dn);
            CREATE INDEX IF NOT EXISTS idx_accept_signal
                ON config_acceptances(signal_type);
        """)
        conn.commit()

        # Migracja: dodaj config_hash jeśli tabela istniała przed wprowadzeniem kolumny
        _migrate_add_column(conn, "config_acceptances", "config_hash", "TEXT DEFAULT ''")

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_accept_dedup
                ON config_acceptances(dn, config_hash, created_at);
        """)
        conn.commit()
    except Exception as e:
        logger.warning(f"Błąd inicjalizacji tabel pasywnych: {e}")
    finally:
        conn.close()


def _migrate_add_column(conn, table: str, column: str, col_def: str):
    """Dodaje kolumnę do tabeli jeśli jeszcze nie istnieje (migracja)."""
    try:
        existing = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        if column not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")
            conn.commit()
            logger.info(f"Migracja: dodano kolumnę '{column}' do tabeli '{table}'.")
    except Exception as e:
        logger.warning(f"Migracja kolumny '{column}': {e}")


def record_acceptance(
    dn: str,
    target_height_mm: int,
    config_source: str,
    config_items: List[Dict],
    signal_type: str = "OFFER_SAVE"
):
    """
    Zapisuje zaakceptowaną konfigurację.
    Wywoływane automatycznie przy zapisie oferty.

    signal_type:
    - OFFER_SAVE: konfiguracja zapisana w ofercie (słabszy sygnał)
    - ORDER_CONFIRM: konfiguracja potwierdzona zamówieniem (silny sygnał)
    """
    was_modified = 1 if config_source in ("MANUAL", "MANUAL_SWAP") else 0
    item_ids = [item.get("productId", "") for item in config_items if item.get("productId")]

    # Deduplikacja — sprawdzć czy identyczny zapis nie istnieje w ostatnich 60s
    config_hash = hashlib.md5(
        json.dumps(sorted(item_ids), ensure_ascii=False).encode()
    ).hexdigest()

    conn = _get_conn()
    try:
        recent = conn.execute("""
            SELECT id FROM config_acceptances
            WHERE dn = ? AND config_hash = ?
              AND created_at > datetime('now', '-60 seconds')
            LIMIT 1
        """, (str(dn), config_hash)).fetchone()

        if recent:
            logger.debug(f"Deduplikacja: pominięto duplikat DN={dn} (hash={config_hash[:8]})")
            return

        conn.execute("""
            INSERT INTO config_acceptances
                (dn, target_height_mm, config_source, was_modified, config_items, signal_type, config_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            str(dn),
            int(target_height_mm),
            config_source,
            was_modified,
            json.dumps(item_ids, ensure_ascii=False),
            signal_type,
            config_hash,
        ))
        conn.commit()
        logger.info(
            f"Acceptance [{signal_type}]: DN={dn}, h={target_height_mm}mm, "
            f"source={config_source}, items={len(item_ids)}"
        )
    except Exception as e:
        logger.error(f"Błąd zapisu acceptance: {e}")
    finally:
        conn.close()


def analyze_usage_patterns(min_occurrences: int = 3) -> List[Dict]:
    """
    Analizuje częstotliwość użycia komponentów w zaakceptowanych konfiguracjach.
    Generuje preferencje typu USAGE_BOOST dla często używanych produktów.

    Zwraca listę wykrytych wzorców.
    """
    conn = _get_conn()
    try:
        rows = conn.execute("""
            SELECT dn, config_items, signal_type
            FROM config_acceptances
            ORDER BY created_at DESC
            LIMIT 1000
        """).fetchall()

        if len(rows) < min_occurrences:
            return []

        # Zlicz produkty per DN (z wagami sygnału)
        dn_product_scores = {}  # { "1200": { "KREG-1200-500": 15.0, ... } }

        for row in rows:
            dn = row["dn"]
            signal = row["signal_type"]
            items = json.loads(row["config_items"])

            # Waga sygnału: zamówienie = 3x, oferta z AI = 1x, ręczna = 0.5x
            weight = _signal_weight(signal, row["config_source"] if "config_source" in row.keys() else "AUTO_AI")

            if dn not in dn_product_scores:
                dn_product_scores[dn] = Counter()

            for product_id in items:
                dn_product_scores[dn][product_id] += weight

        # Generuj preferencje dla produktów z wystarczającą ilością danych
        patterns = []
        for dn, product_counter in dn_product_scores.items():
            total_configs = sum(1 for r in rows if r["dn"] == dn)
            if total_configs < min_occurrences:
                continue

            for product_id, score in product_counter.most_common(20):
                frequency = score / total_configs
                if frequency < 0.3:  # Produkt musi pojawić się w ≥30% konfiguracji
                    continue

                patterns.append({
                    "pattern_type": "USAGE_BOOST",
                    "pattern_key": f"{dn}|USAGE|{product_id}",
                    "pattern_data": {
                        "dn": dn,
                        "product_id": product_id,
                        "frequency": round(frequency, 3),
                        "total_configs": total_configs,
                        "weighted_score": round(score, 1),
                    },
                    "confidence": min(frequency * 0.8, 0.9),
                    "hit_count": int(score),
                })

        return patterns

    finally:
        conn.close()


def analyze_and_save_usage_preferences():
    """
    Analizuje wzorce użycia i zapisuje jako preferencje.
    Wywoływane periodycznie lub po każdym zapisie.
    """
    patterns = analyze_usage_patterns()

    if not patterns:
        return 0

    conn = _get_conn()
    try:
        now = datetime.utcnow().isoformat()
        saved = 0
        for pattern in patterns:
            conn.execute("""
                INSERT INTO learned_preferences
                    (pattern_type, pattern_key, pattern_data, confidence, hit_count, last_hit, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pattern_key) DO UPDATE SET
                    pattern_data = excluded.pattern_data,
                    confidence = excluded.confidence,
                    hit_count = excluded.hit_count,
                    last_hit = excluded.last_hit,
                    updated_at = excluded.updated_at
            """, (
                pattern["pattern_type"],
                pattern["pattern_key"],
                json.dumps(pattern["pattern_data"], ensure_ascii=False),
                pattern["confidence"],
                pattern["hit_count"],
                now, now, now,
            ))
            saved += 1

        conn.commit()
        logger.info(f"Zapisano {saved} preferencji USAGE_BOOST.")
        return saved
    except Exception as e:
        logger.error(f"Błąd zapisu preferencji USAGE: {e}")
        return 0
    finally:
        conn.close()


def get_acceptance_stats() -> Dict:
    """Zwraca statystyki akceptacji."""
    conn = _get_conn()
    try:
        total = conn.execute("SELECT COUNT(*) FROM config_acceptances").fetchone()[0]
        auto_accepted = conn.execute(
            "SELECT COUNT(*) FROM config_acceptances WHERE was_modified = 0"
        ).fetchone()[0]
        orders = conn.execute(
            "SELECT COUNT(*) FROM config_acceptances WHERE signal_type = 'ORDER_CONFIRM'"
        ).fetchone()[0]

        acceptance_rate = round(auto_accepted / total * 100, 1) if total > 0 else 0.0

        return {
            "total_saved_configs": total,
            "auto_accepted": auto_accepted,
            "manually_modified": total - auto_accepted,
            "order_confirmed": orders,
            "acceptance_rate_percent": acceptance_rate,
        }
    except Exception:
        return {"total_saved_configs": 0, "acceptance_rate_percent": 0}
    finally:
        conn.close()


def _signal_weight(signal_type: str, config_source: str = "AUTO_AI") -> float:
    """Oblicza wagę sygnału dla uczenia."""
    base = {
        "ORDER_CONFIRM": 3.0,   # Zamówienie = najsilniejszy sygnał
        "OFFER_SAVE": 1.0,      # Zapis oferty = standardowy
    }.get(signal_type, 1.0)

    # Konfiguracje AI zaakceptowane bez zmian = bonus
    if config_source in ("AUTO_AI", "AUTO_JS"):
        return base * 1.2

    # Konfiguracje ręczne = mniejsza waga (mogą być eksperymenty)
    if config_source == "MANUAL":
        return base * 0.5

    return base
