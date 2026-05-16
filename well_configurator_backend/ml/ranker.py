"""
Configuration Ranker — Scoring konfiguracji z uwzględnieniem preferencji
uczonych z korekt użytkowników.

Scoring składa się z 3 warstw:
1. Bazowy — mniej elementów = lepiej, brak minimalnych zapasów = lepiej
2. Preferencje — kary/bonusy z learned_preferences
3. Produkcyjny — standardowe formy fabryczne = bonus

Explainability: każda konfiguracja dostaje score_reasons[] z wyjaśnieniami.
"""
import json
import logging
from typing import List, Optional

from api.schemas import WellConfigResult

logger = logging.getLogger("AI_RANKER")


class ConfigurationRanker:
    """Ranker konfiguracji studni z adaptacyjnym scoringiem."""

    def __init__(self):
        self._preferences = []
        self._preferences_loaded = False

    def _load_preferences(self, dn: Optional[str] = None):
        """Ładuje preferencje z bazy (lazy loading, raz na sesję rankingu)."""
        if self._preferences_loaded:
            return
        try:
            from ml.preference_learner import get_active_preferences
            self._preferences = get_active_preferences(dn=dn, min_confidence=0.3)
            self._preferences_loaded = True
            if self._preferences:
                logger.info(
                    f"Załadowano {len(self._preferences)} aktywnych preferencji"
                    f"{' dla DN=' + dn if dn else ''}"
                )
        except Exception as e:
            logger.warning(f"Nie udało się załadować preferencji: {e}")
            self._preferences = []
            self._preferences_loaded = True

    def rank_configurations(
        self,
        configs: List[WellConfigResult],
        dn: Optional[str] = None
    ) -> List[WellConfigResult]:
        """
        Ocenia konfiguracje — 3 warstwy scoringu.
        Wyższy score = lepsza konfiguracja.
        """
        self._preferences_loaded = False  # Reset dla nowego rankingu
        self._load_preferences(dn=dn)

        for cfg in configs:
            reasons = []
            base_score = self._base_score(cfg, reasons)
            preference_score = self._preference_score(cfg, reasons)
            cfg.score = base_score + preference_score
            cfg.score_reasons = reasons

        configs.sort(key=lambda x: x.score, reverse=True)

        if configs:
            logger.info(
                f"Ranking: najlepsza={configs[0].score:.2f} "
                f"(base + {len(self._preferences)} preferencji), "
                f"najgorsza={configs[-1].score:.2f}"
            )

        return configs

    def _base_score(self, cfg: WellConfigResult, reasons: List[str]) -> float:
        """
        Bazowy scoring — identyczny jak w oryginalnym rankerze,
        ale z dodatkowym bonusem za mniejszą odchyłkę.
        
        Max: ~10.0
        """
        score = 10.0

        # Mniej elementów = lepiej (max kara: -5.0)
        item_count = len(cfg.items)
        score -= item_count * 0.5
        reasons.append(f"Elementy: {item_count} szt. (bazowy: {10.0 - item_count * 0.5:.1f}/10)")

        # Minimalne zapasy = kara
        if cfg.has_minimal_clearance:
            score -= 2.0
            reasons.append("Minimalne zapasy (-2.0)")

        # Stage ratunkowy/awaryjny = kara
        stage = getattr(cfg, 'stage', '')
        if 'ratunkowy' in stage.lower():
            score -= 1.0
            reasons.append("Stage ratunkowy (-1.0)")
        elif 'awaryjny' in stage.lower():
            score -= 3.0
            reasons.append("Stage awaryjny (-3.0)")

        return max(score, 0.0)

    def _preference_score(self, cfg: WellConfigResult, reasons: List[str]) -> float:
        """
        Scoring z preferencji uczonych z korekt użytkowników.
        
        SUBSTITUTION: produkt zamieniany → kara, zamiennik → bonus
        REMOVAL: produkt usuwany → kara
        ADDITION: produkt dodawany → bonus
        USAGE_BOOST: produkt popularny → bonus
        
        Max wpływ: ±3.0 punkty
        """
        if not self._preferences:
            return 0.0

        adjustment = 0.0
        item_ids = {item.product_id for item in cfg.items}

        for pref in self._preferences:
            try:
                data = json.loads(pref["pattern_data"]) if isinstance(pref["pattern_data"], str) else pref["pattern_data"]
            except (json.JSONDecodeError, TypeError):
                continue

            confidence = pref.get("confidence", 0.0)
            ptype = pref.get("pattern_type", "")

            if ptype == "SUBSTITUTION":
                removed_id = data.get("remove", "")
                replaced_id = data.get("replace_with", "")

                if removed_id in item_ids and replaced_id not in item_ids:
                    penalty = -1.5 * confidence
                    adjustment += penalty
                    reasons.append(
                        f"Użytkownicy zamieniają {removed_id} → {replaced_id} "
                        f"({penalty:+.1f}, pewność {confidence:.0%})"
                    )

                if replaced_id in item_ids and removed_id not in item_ids:
                    bonus = 0.5 * confidence
                    adjustment += bonus
                    reasons.append(
                        f"Zawiera preferowany {replaced_id} "
                        f"({bonus:+.1f}, pewność {confidence:.0%})"
                    )

            elif ptype == "REMOVAL":
                removed_id = data.get("remove", "")
                if removed_id in item_ids:
                    penalty = -1.0 * confidence
                    adjustment += penalty
                    reasons.append(
                        f"Użytkownicy usuwają {removed_id} "
                        f"({penalty:+.1f}, pewność {confidence:.0%})"
                    )

            elif ptype == "ADDITION":
                added_id = data.get("add", "")
                if added_id in item_ids:
                    bonus = 0.8 * confidence
                    adjustment += bonus
                    reasons.append(
                        f"Użytkownicy dodają {added_id} "
                        f"({bonus:+.1f}, pewność {confidence:.0%})"
                    )

            elif ptype == "USAGE_BOOST":
                product_id = data.get("product_id", "")
                if product_id in item_ids:
                    freq = data.get("frequency", 0)
                    bonus = 0.6 * confidence
                    adjustment += bonus
                    reasons.append(
                        f"Popularny komponent {product_id} "
                        f"(używany w {freq:.0%} konfiguracji, {bonus:+.1f})"
                    )

        clamped = max(min(adjustment, 3.0), -3.0)

        if abs(adjustment) > 0 and len(self._preferences) > 0:
            reasons.append(
                f"Łączny wpływ preferencji: {clamped:+.1f} "
                f"(z {len(self._preferences)} wzorców)"
            )

        return clamped
