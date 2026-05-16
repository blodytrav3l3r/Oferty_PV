"""
Testy modułu ML — feedback_store, preference_learner, passive_learner, ranker.
"""
import json
import os
import sqlite3
import pytest
from unittest.mock import patch
from datetime import datetime, timedelta


# ============================
# Helpers
# ============================

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_ml.db")


def _create_test_db():
    """Tworzy czystą bazę testową z wszystkimi tabelami ML."""
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)

    conn = sqlite3.connect(TEST_DB_PATH)
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
    """)
    conn.commit()
    conn.close()
    return TEST_DB_PATH


@pytest.fixture(autouse=True)
def mock_db_path(monkeypatch):
    """Każdy test używa oddzielnej bazy."""
    db_path = _create_test_db()
    monkeypatch.setattr("ml.db_connection.DB_PATH", db_path)
    yield
    if os.path.exists(db_path):
        os.remove(db_path)


# ============================
# feedback_store tests
# ============================

class TestFeedbackStore:
    def test_save_correction_returns_id(self):
        from ml.feedback_store import save_correction
        row_id = save_correction(
            original_config=[{"productId": "KREG-1200-500"}],
            final_config=[{"productId": "KREG-1200-250"}, {"productId": "KREG-1200-250"}],
            override_reason="Wolę 2 mniejsze kręgi",
            well_params={"dn": "1200", "target_height_mm": 3000}
        )
        assert row_id >= 1

    def test_get_corrections_returns_saved(self):
        from ml.feedback_store import save_correction, get_corrections
        save_correction(
            original_config=[{"productId": "A"}],
            final_config=[{"productId": "B"}],
            override_reason="test",
            well_params={"dn": "1000"}
        )
        corrections = get_corrections(dn="1000")
        assert len(corrections) == 1
        assert corrections[0]["dn"] == "1000"

    def test_diff_computation(self):
        from ml.feedback_store import _compute_diff
        diff = _compute_diff(
            [{"productId": "A"}, {"productId": "B"}],
            [{"productId": "B"}, {"productId": "C"}]
        )
        assert "A" in diff["removed"]
        assert "C" in diff["added"]
        assert "B" in diff["kept"]

    def test_correction_count(self):
        from ml.feedback_store import save_correction, get_correction_count
        for i in range(5):
            save_correction(
                original_config=[{"productId": f"X{i}"}],
                final_config=[{"productId": f"Y{i}"}],
                override_reason=f"reason {i}",
            )
        assert get_correction_count() == 5


# ============================
# preference_learner tests
# ============================

class TestPreferenceLearner:
    def _insert_corrections(self, n, dn="1200", removed="OLD", added="NEW"):
        from ml.feedback_store import save_correction
        for _ in range(n):
            save_correction(
                original_config=[{"productId": removed}],
                final_config=[{"productId": added}],
                override_reason="test",
                well_params={"dn": dn}
            )

    def test_no_preferences_with_few_corrections(self):
        from ml.preference_learner import analyze_and_update_preferences, get_active_preferences
        self._insert_corrections(2)
        analyze_and_update_preferences()
        prefs = get_active_preferences()
        assert len(prefs) == 0

    def test_substitution_detected(self):
        from ml.preference_learner import analyze_and_update_preferences, get_active_preferences
        self._insert_corrections(5, dn="1200", removed="KREG-OLD", added="KREG-NEW")
        analyze_and_update_preferences()
        prefs = get_active_preferences(dn="1200")
        subs = [p for p in prefs if p["pattern_type"] == "SUBSTITUTION"]
        assert len(subs) >= 1

    def test_confidence_increases_with_hits(self):
        from ml.preference_learner import _calculate_confidence
        c3 = _calculate_confidence(3)
        c10 = _calculate_confidence(10)
        c20 = _calculate_confidence(20)
        assert c3 < c10 < c20
        assert c3 > 0
        assert c20 <= 0.95

    def test_confidence_below_min_is_zero(self):
        from ml.preference_learner import _calculate_confidence
        assert _calculate_confidence(1) == 0.0
        assert _calculate_confidence(2) == 0.0

    def test_decay_reduces_old_preferences(self):
        from ml.preference_learner import _apply_decay
        from ml.db_connection import get_ml_conn

        conn = get_ml_conn()
        old_date = (datetime.utcnow() - timedelta(days=90)).isoformat()
        conn.execute("""
            INSERT INTO learned_preferences
                (pattern_type, pattern_key, pattern_data, confidence, hit_count, last_hit, created_at, updated_at)
            VALUES ('TEST', 'test|key', '{}', 0.8, 5, ?, ?, ?)
        """, (old_date, old_date, old_date))
        conn.commit()

        decayed = _apply_decay(conn)
        conn.commit()
        assert decayed == 1

        row = conn.execute("SELECT confidence FROM learned_preferences WHERE pattern_key = 'test|key'").fetchone()
        assert row is not None
        assert row[0] < 0.8  # Confidence powinno spaść
        conn.close()

    def test_height_bucket(self):
        from ml.preference_learner import _get_height_bucket
        assert _get_height_bucket(1500) == "shallow"
        assert _get_height_bucket(4000) == "medium"
        assert _get_height_bucket(8000) == "deep"


# ============================
# passive_learner tests
# ============================

class TestPassiveLearner:
    def test_record_acceptance(self):
        from ml.passive_learner import ensure_passive_tables, record_acceptance, get_acceptance_stats
        ensure_passive_tables()
        record_acceptance(
            dn="1200",
            target_height_mm=3000,
            config_source="AUTO_AI",
            config_items=[{"productId": "KREG-1200-500"}],
            signal_type="OFFER_SAVE"
        )
        stats = get_acceptance_stats()
        assert stats["total_saved_configs"] == 1
        assert stats["auto_accepted"] == 1

    def test_deduplication(self):
        from ml.passive_learner import ensure_passive_tables, record_acceptance, get_acceptance_stats
        ensure_passive_tables()
        items = [{"productId": "A"}, {"productId": "B"}]
        # Zapisz 3× w ciągu sekundy — powinno być 1 rekord
        record_acceptance("1200", 3000, "AUTO_AI", items)
        record_acceptance("1200", 3000, "AUTO_AI", items)
        record_acceptance("1200", 3000, "AUTO_AI", items)
        stats = get_acceptance_stats()
        assert stats["total_saved_configs"] == 1

    def test_order_confirm_weight(self):
        from ml.passive_learner import _signal_weight
        offer_weight = _signal_weight("OFFER_SAVE", "AUTO_AI")
        order_weight = _signal_weight("ORDER_CONFIRM", "AUTO_AI")
        assert order_weight > offer_weight

    def test_manual_config_lower_weight(self):
        from ml.passive_learner import _signal_weight
        auto_weight = _signal_weight("OFFER_SAVE", "AUTO_AI")
        manual_weight = _signal_weight("OFFER_SAVE", "MANUAL")
        assert manual_weight < auto_weight


# ============================
# ranker tests
# ============================

class TestRanker:
    def _make_config(self, items_count=3, has_minimal=False, stage=""):
        from api.schemas import WellConfigResult, ItemDetail
        items = [
            ItemDetail(product_id=f"PROD-{i}", name=f"Product {i}", component_type="krag")
            for i in range(items_count)
        ]
        return WellConfigResult(
            is_valid=True,
            total_height_mm=3000,
            items=items,
            has_minimal_clearance=has_minimal,
            stage=stage,
        )

    def test_fewer_items_scores_higher(self):
        from ml.ranker import ConfigurationRanker
        ranker = ConfigurationRanker()
        cfg_small = self._make_config(items_count=3)
        cfg_large = self._make_config(items_count=6)
        ranked = ranker.rank_configurations([cfg_large, cfg_small])
        assert ranked[0].score > ranked[1].score

    def test_minimal_clearance_penalty(self):
        from ml.ranker import ConfigurationRanker
        ranker = ConfigurationRanker()
        cfg_ok = self._make_config(has_minimal=False)
        cfg_min = self._make_config(has_minimal=True)
        ranked = ranker.rank_configurations([cfg_min, cfg_ok])
        assert ranked[0] == cfg_ok

    def test_score_reasons_populated(self):
        from ml.ranker import ConfigurationRanker
        ranker = ConfigurationRanker()
        cfg = self._make_config()
        ranker.rank_configurations([cfg])
        assert len(cfg.score_reasons) > 0
        assert any("Elementy" in r for r in cfg.score_reasons)

    def test_ranking_is_deterministic(self):
        from ml.ranker import ConfigurationRanker
        ranker = ConfigurationRanker()
        configs = [self._make_config(items_count=i) for i in range(3, 7)]
        r1 = [c.score for c in ranker.rank_configurations(configs[:])]
        r2 = [c.score for c in ranker.rank_configurations(configs[:])]
        assert r1 == r2
