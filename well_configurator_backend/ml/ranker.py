# Dummy mock_ml/ranker.py
# W produkcji ładuje model LightGBM: `lgb.Booster(model_file="model.txt")`
import random
from typing import List
from api.schemas import WellConfigResult

class ConfigurationRanker:
    def __init__(self):
        # W normalnych warunkach tu ładowalibyśmy wytrenowany model
        pass

    def rank_configurations(self, configs: List[WellConfigResult]) -> List[WellConfigResult]:
        """
        Ocenia konfiguracje używając LightGBM (tu symulacja logiczna).
        - Liczba elementów (mniej -> lepiej)
        - Użycie minimalnych zapasów (gorzej)
        - Kary za brak preferowanych form std (już zaszyte w optimizerze)
        """
        for cfg in configs:
            features = [
                len(cfg.items), 
                1 if cfg.has_minimal_clearance else 0
            ]
            
            # Sztuczna ocena modelem
            # Mniej itemów = wyższy score (10.0 max)
            score = 10.0 - (len(cfg.items) * 0.5)
            if cfg.has_minimal_clearance:
                score -= 2.0
                
            cfg.score = score

        # Sortowanie od największego score'u
        configs.sort(key=lambda x: x.score, reverse=True)
        return configs
