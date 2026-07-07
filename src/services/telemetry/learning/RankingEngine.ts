/**
 * RankingEngine.ts
 *
 * Ranking AI - oblicza score dla wzorców i dobiera top-N.
 * Pasywny: wynik to tylko rekomendacja, nie modyfikacja solvera.
 */

import type { FeatureVector } from './FeatureExtractor';
import type { KnowledgePattern } from './KnowledgeBase';

export interface RankedRecommendation {
    pattern: KnowledgePattern;
    score: number;
    rationale: string;
}

export class RankingEngine {
    /**
     * Rankinguje wzorce dla danego rekordu telemetry.
     */
    rank(
        features: FeatureVector,
        patterns: KnowledgePattern[],
        topN: number = 5
    ): RankedRecommendation[] {
        const self = this;
        const scored = patterns.map(function (p) {
            return self._score(features, p);
        });

        scored.sort(function (a, b) {
            return b.score - a.score;
        });
        return scored.slice(0, topN);
    }

    /**
     * Score kombinacja confidence + match cech geometrycznych z features.
     */
    _score(features: FeatureVector, pattern: KnowledgePattern): RankedRecommendation {
        const p = pattern;

        // 1. Bazowy score z confidence
        const base = p.confidence;

        // 2. Bonus za dn match (natychmiastowe matchowanie)
        const dnMatch = p.dn === features.dn ? 0.1 : 0;

        // 3. Świeżość - jeśli niedawno wykryto
        const recencyBoost = p.hitCount > 10 ? 0.05 : p.hitCount > 5 ? 0.03 : 0;

        const score = Math.min(base + dnMatch + recencyBoost, 1.0);

        return {
            pattern: p,
            score,
            rationale:
                'Confidence ' +
                base.toFixed(2) +
                (dnMatch > 0 ? ' + dn-match' : '') +
                (recencyBoost > 0 ? ' + fresh' : '')
        };
    }
}
