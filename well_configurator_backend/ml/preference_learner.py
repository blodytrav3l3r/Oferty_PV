"""
Preference Learner — Analiza wzorców z korekt użytkowników.
Przetwarza correction_events → learned_preferences.

Wykrywane wzorce:
1. SUBSTITUTION — "Użytkownicy zamieniają produkt X na Y"
2. ADDITION — "Użytkownicy dodają produkt X w kontekście Z"
3. REMOVAL — "Użytkownicy usuwają produkt X w kontekście Z"
"""
import json
import sqlite3
import math
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import Counter

from ml.db_connection import get_ml_conn

logger = logging.getLogger("AI_LEARNER")

# Minimalna liczba korekt zanim wzorzec stanie się preferencją
MIN_HITS_FOR_PREFERENCE = 3

# Maksymalny confidence (osiągalny po wielu korektach)
MAX_CONFIDENCE = 0.95

# Bucket'y wysokości (mm) do kontekstualizacji preferencji
HEIGHT_BUCKETS = [
    (0, 3000, "shallow"),      # 0-3m
    (3000, 6000, "medium"),    # 3-6m
    (6000, 99999, "deep"),     # 6m+
]

# Decay: confidence spada o 5% za każde 30 dni bez potwierdzenia
DECAY_RATE = 0.05
DECAY_PERIOD_DAYS = 30


def _get_conn():
    return get_ml_conn()


def analyze_and_update_preferences():
    """
    Główna funkcja uczenia — analizuje wszystkie korekty i aktualizuje preferencje.
    Wywoływana po każdym zapisie korekty lub periodycznie.
    """
    conn = _get_conn()
    try:
        corrections = conn.execute(
            "SELECT * FROM correction_events ORDER BY created_at DESC LIMIT 500"
        ).fetchall()

        if len(corrections) < MIN_HITS_FOR_PREFERENCE:
            logger.info(f"Za mało korekt ({len(corrections)}/{MIN_HITS_FOR_PREFERENCE}) — pomijam analizę.")
            return

        corrections = [dict(r) for r in corrections]

        # Analizuj wzorce substytucji
        substitution_patterns = _detect_substitutions(corrections)
        for pattern in substitution_patterns:
            _upsert_preference(conn, pattern)

        # Analizuj wzorce dodawania
        addition_patterns = _detect_additions(corrections)
        for pattern in addition_patterns:
            _upsert_preference(conn, pattern)

        # Analizuj wzorce usuwania
        removal_patterns = _detect_removals(corrections)
        for pattern in removal_patterns:
            _upsert_preference(conn, pattern)

        conn.commit()
        total = len(substitution_patterns) + len(addition_patterns) + len(removal_patterns)
        logger.info(f"Zaktualizowano {total} preferencji z {len(corrections)} korekt.")

        # Zastosuj decay do starych preferencji
        decayed = _apply_decay(conn)
        if decayed > 0:
            conn.commit()
            logger.info(f"Decay: obniżono confidence {decayed} starych preferencji.")
    finally:
        conn.close()


def _detect_substitutions(corrections: List[Dict]) -> List[Dict]:
    """
    Wykrywa wzorce substytucji: produkt X usunięty + produkt Y dodany
    w tym samym kontekście (DN + wysokość).
    """
    patterns = []
    substitution_counter = Counter()

    for c in corrections:
        diff = json.loads(c.get("diff_summary", "{}"))
        removed = diff.get("removed", [])
        added = diff.get("added", [])
        dn = c.get("dn", "")

        if not removed or not added:
            continue

        # Każda para (removed, added) to potencjalna substytucja
        for r_id in removed:
            for a_id in added:
                key = f"{dn}|{r_id}|{a_id}"
                substitution_counter[key] += 1

    for key, count in substitution_counter.items():
        if count < MIN_HITS_FOR_PREFERENCE:
            continue
        dn, removed_id, added_id = key.split("|")
        confidence = _calculate_confidence(count)
        patterns.append({
            "pattern_type": "SUBSTITUTION",
            "pattern_key": key,
            "pattern_data": {
                "dn": dn,
                "remove": removed_id,
                "replace_with": added_id,
                "hit_count": count
            },
            "confidence": confidence,
            "hit_count": count,
        })

    return patterns


def _detect_additions(corrections: List[Dict]) -> List[Dict]:
    """
    Wykrywa wzorce: użytkownicy konsekwentnie DODAJĄ produkt X
    w kontekście DN.
    """
    patterns = []
    addition_counter = Counter()

    for c in corrections:
        diff = json.loads(c.get("diff_summary", "{}"))
        added = diff.get("added", [])
        dn = c.get("dn", "")

        for a_id in added:
            key = f"{dn}|ADD|{a_id}"
            addition_counter[key] += 1

    for key, count in addition_counter.items():
        if count < MIN_HITS_FOR_PREFERENCE:
            continue
        dn, _, added_id = key.split("|")
        confidence = _calculate_confidence(count)
        patterns.append({
            "pattern_type": "ADDITION",
            "pattern_key": key,
            "pattern_data": {
                "dn": dn,
                "add": added_id,
                "hit_count": count
            },
            "confidence": confidence,
            "hit_count": count,
        })

    return patterns


def _detect_removals(corrections: List[Dict]) -> List[Dict]:
    """
    Wykrywa wzorce: użytkownicy konsekwentnie USUWAJĄ produkt X
    z konfiguracji AI.
    """
    patterns = []
    removal_counter = Counter()

    for c in corrections:
        diff = json.loads(c.get("diff_summary", "{}"))
        removed = diff.get("removed", [])
        dn = c.get("dn", "")

        for r_id in removed:
            key = f"{dn}|REM|{r_id}"
            removal_counter[key] += 1

    for key, count in removal_counter.items():
        if count < MIN_HITS_FOR_PREFERENCE:
            continue
        dn, _, removed_id = key.split("|")
        confidence = _calculate_confidence(count)
        patterns.append({
            "pattern_type": "REMOVAL",
            "pattern_key": key,
            "pattern_data": {
                "dn": dn,
                "remove": removed_id,
                "hit_count": count
            },
            "confidence": confidence,
            "hit_count": count,
        })

    return patterns


def _calculate_confidence(hit_count: int) -> float:
    """
    Oblicza confidence score na podstawie liczby korekt.
    Krzywa logarytmiczna: szybko rośnie, potem zwalnia.
    
    3 korekty → 0.3
    5 korekt → 0.5
    10 korekt → 0.7
    20+ korekt → 0.9+
    """
    if hit_count < MIN_HITS_FOR_PREFERENCE:
        return 0.0
    raw = math.log(hit_count) / math.log(30)  # log_30(count)
    return min(round(raw, 3), MAX_CONFIDENCE)


def _apply_decay(conn: sqlite3.Connection) -> int:
    """
    Obniża confidence preferencji, które nie były potwierdzone od dawna.
    Preferencje z confidence < 0.1 po decay są usuwane.
    """
    now = datetime.utcnow()
    rows = conn.execute(
        "SELECT id, confidence, last_hit FROM learned_preferences"
    ).fetchall()

    decayed = 0
    for row in rows:
        last_hit = row["last_hit"]
        if not last_hit:
            continue
        try:
            last_dt = datetime.fromisoformat(last_hit)
        except ValueError:
            continue

        days_since = (now - last_dt).days
        if days_since < DECAY_PERIOD_DAYS:
            continue

        periods = days_since // DECAY_PERIOD_DAYS
        decay_factor = (1 - DECAY_RATE) ** periods
        new_confidence = round(row["confidence"] * decay_factor, 4)

        if new_confidence < 0.1:
            conn.execute("DELETE FROM learned_preferences WHERE id = ?", (row["id"],))
        else:
            conn.execute(
                "UPDATE learned_preferences SET confidence = ?, updated_at = ? WHERE id = ?",
                (new_confidence, now.isoformat(), row["id"])
            )
        decayed += 1

    return decayed


def _get_height_bucket(height_mm: int) -> str:
    """Zwraca bucket wysokości dla danej wysokości w mm."""
    for low, high, label in HEIGHT_BUCKETS:
        if low <= height_mm < high:
            return label
    return "deep"


def _upsert_preference(conn: sqlite3.Connection, pattern: Dict):
    """Wstawia lub aktualizuje preferencję w bazie."""
    now = datetime.utcnow().isoformat()
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


def get_active_preferences(
    dn: Optional[str] = None,
    min_confidence: float = 0.3
) -> List[Dict]:
    """
    Pobiera aktywne preferencje powyżej progu confidence.
    Opcjonalnie filtruje po DN.
    """
    conn = _get_conn()
    try:
        if dn:
            rows = conn.execute("""
                SELECT * FROM learned_preferences
                WHERE confidence >= ? AND pattern_key LIKE ?
                ORDER BY confidence DESC
            """, (min_confidence, f"{dn}|%")).fetchall()
        else:
            rows = conn.execute("""
                SELECT * FROM learned_preferences
                WHERE confidence >= ?
                ORDER BY confidence DESC
            """, (min_confidence,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_preferences_summary() -> Dict:
    """Zwraca podsumowanie systemu preferencji."""
    conn = _get_conn()
    try:
        total = conn.execute("SELECT COUNT(*) FROM learned_preferences").fetchone()[0]
        active = conn.execute(
            "SELECT COUNT(*) FROM learned_preferences WHERE confidence >= 0.3"
        ).fetchone()[0]
        corrections = conn.execute("SELECT COUNT(*) FROM correction_events").fetchone()[0]

        top_prefs = conn.execute("""
            SELECT pattern_type, pattern_key, confidence, hit_count
            FROM learned_preferences
            WHERE confidence >= 0.3
            ORDER BY confidence DESC
            LIMIT 10
        """).fetchall()

        return {
            "total_corrections": corrections,
            "total_preferences": total,
            "active_preferences": active,
            "top_preferences": [dict(r) for r in top_prefs],
        }
    finally:
        conn.close()
