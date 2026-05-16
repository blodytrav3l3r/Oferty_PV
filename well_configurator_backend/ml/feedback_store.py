"""
Feedback Store — Przechowywanie korekt użytkowników w SQLite.
Zbiera dane telemetryczne: co AI dobrało vs co użytkownik zmienił.
"""
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any

from ml.db_connection import get_ml_conn

logger = logging.getLogger("AI_FEEDBACK")


def _get_conn():
    return get_ml_conn()


def ensure_tables():
    """Tworzy tabele jeśli nie istnieją."""
    conn = _get_conn()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS correction_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                dn TEXT,
                target_height_mm INTEGER,
                use_reduction INTEGER DEFAULT 0,
                psia_buda INTEGER DEFAULT 0,
                warehouse TEXT DEFAULT 'KLB',
                transition_count INTEGER DEFAULT 0,
                override_reason TEXT,
                original_config TEXT NOT NULL,
                final_config TEXT NOT NULL,
                diff_summary TEXT
            );

            CREATE TABLE IF NOT EXISTS learned_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_type TEXT NOT NULL,
                pattern_key TEXT NOT NULL UNIQUE,
                pattern_data TEXT NOT NULL,
                confidence REAL DEFAULT 0.0,
                hit_count INTEGER DEFAULT 0,
                last_hit TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_corrections_dn
                ON correction_events(dn);
            CREATE INDEX IF NOT EXISTS idx_preferences_type
                ON learned_preferences(pattern_type);
            CREATE INDEX IF NOT EXISTS idx_preferences_confidence
                ON learned_preferences(confidence DESC);
        """)
        conn.commit()
        logger.info("Tabele feedback/preferences zainicjalizowane.")
    finally:
        conn.close()


def save_correction(
    original_config: List[Dict],
    final_config: List[Dict],
    override_reason: str,
    well_params: Optional[Dict] = None
) -> int:
    """
    Zapisuje pojedynczą korektę użytkownika.
    Zwraca ID zapisanego rekordu.
    """
    params = well_params or {}
    diff = _compute_diff(original_config, final_config)

    conn = _get_conn()
    try:
        cursor = conn.execute("""
            INSERT INTO correction_events
                (dn, target_height_mm, use_reduction, psia_buda,
                 warehouse, transition_count, override_reason,
                 original_config, final_config, diff_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(params.get("dn", "")),
            int(params.get("target_height_mm", 0)),
            1 if params.get("use_reduction") else 0,
            1 if params.get("psia_buda") else 0,
            params.get("warehouse", "KLB"),
            int(params.get("transition_count", 0)),
            override_reason,
            json.dumps(original_config, ensure_ascii=False),
            json.dumps(final_config, ensure_ascii=False),
            json.dumps(diff, ensure_ascii=False),
        ))
        conn.commit()
        row_id = cursor.lastrowid
        logger.info(
            f"Zapisano korektę #{row_id}: DN={params.get('dn')} "
            f"reason='{override_reason}' diff={len(diff.get('added', []))}+/{len(diff.get('removed', []))}-"
        )
        return row_id
    finally:
        conn.close()


def get_corrections(
    dn: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """Pobiera korekty, opcjonalnie filtrowane po DN."""
    conn = _get_conn()
    try:
        if dn:
            rows = conn.execute(
                "SELECT * FROM correction_events WHERE dn = ? ORDER BY created_at DESC LIMIT ?",
                (str(dn), limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM correction_events ORDER BY created_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_correction_count() -> int:
    """Zwraca łączną liczbę korekt w bazie."""
    conn = _get_conn()
    try:
        row = conn.execute("SELECT COUNT(*) FROM correction_events").fetchone()
        return row[0] if row else 0
    finally:
        conn.close()


def _compute_diff(original: List[Dict], final: List[Dict]) -> Dict:
    """
    Oblicza różnicę między konfiguracją oryginalną a finalną.
    Zwraca: { added: [...], removed: [...], kept: [...] }
    """
    orig_ids = [item.get("productId", "") for item in original]
    final_ids = [item.get("productId", "") for item in final]

    # Wielokrotne wystąpienia — używamy list zamiast setów
    orig_count = _count_items(orig_ids)
    final_count = _count_items(final_ids)

    added = []
    removed = []
    kept = []

    all_ids = set(list(orig_count.keys()) + list(final_count.keys()))
    for pid in all_ids:
        o = orig_count.get(pid, 0)
        f = final_count.get(pid, 0)
        if f > o:
            added.extend([pid] * (f - o))
        elif o > f:
            removed.extend([pid] * (o - f))
        if min(o, f) > 0:
            kept.extend([pid] * min(o, f))

    return {"added": added, "removed": removed, "kept": kept}


def _count_items(ids: List[str]) -> Dict[str, int]:
    """Zlicza wystąpienia każdego ID."""
    counts = {}
    for pid in ids:
        counts[pid] = counts.get(pid, 0) + 1
    return counts
