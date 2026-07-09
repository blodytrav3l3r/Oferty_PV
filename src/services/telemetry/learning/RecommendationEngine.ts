/**
 * RecommendationEngine.ts
 *
 * Rekomendacje AI - dla danego telemetry ID zwraca top-N wzorców
 * których confidence jest odpowiednio wysoka.
 *
 * Czysto suggestywne — NIE MOGĄ zmieniać solvera.
 * Solver JS pozostaje niezmienny; AI dostarcza tylko ranking opcjonalny.
 */

import type { PatternType } from './KnowledgeBase';
import { KnowledgeBase } from './KnowledgeBase';
import type { FeatureVector } from './types';
import { RankingEngine } from './RankingEngine';

export interface TopRecommendation {
    patternKey: string;
    patternType: string;
    description: string;
    score: number;
    confidence: number;
    rationale: string;
    recommendation: Record<string, unknown>;
}

export class RecommendationEngine {
    private kb: KnowledgeBase;
    private re: RankingEngine;

    constructor() {
        this.kb = new KnowledgeBase();
        this.re = new RankingEngine();
    }

    /**
     * Zwraca rekomendacje dla podanego rekordu telemetry.
     */
    async recommendForTelemetry(telemetryId: string, dn?: string): Promise<TopRecommendation[]> {
        const patterns = dn
            ? await this.kb.getPatternsForDn(dn)
            : await this.kb.getPatternsForDn('all_dn');
        if (patterns.length === 0) return [];
        const dummyFeatures: FeatureVector = {
            wellId: 'unknown',
            telemetryId,
            dn: dn || 'unknown',
            features: [],
            extractedAt: new Date().toISOString()
        };
        const ranked = this.re.rank(dummyFeatures, patterns, 5);
        return ranked.map(function (r) {
            return {
                patternKey: r.pattern.patternKey,
                patternType: r.pattern.patternType,
                description: r.pattern.description || '',
                score: r.score,
                confidence: r.pattern.confidence,
                rationale: r.rationale,
                recommendation: r.pattern.recommendation || {}
            };
        });
    }

    /**
     * Zwróć najlepsze wzorce dla danego DN z features.
     */
    async recommendForDn(features: FeatureVector, topN: number = 5) {
        const patterns = await this.kb.getPatternsForDn(features.dn);
        return this.re.rank(features, patterns, topN);
    }

    /**
     * Zapis rekomendacji do tabeli ai_recommendations.
     */
    async persistRecommendation(input: {
        patternType: PatternType | string;
        patternKey: string;
        dn?: string;
        wellId?: string;
        score: number;
        confidence: number;
        payload?: Record<string, unknown>;
    }): Promise<string> {
        return this.kb.recordRecommendation({
            patternType: input.patternType as PatternType,
            patternKey: input.patternKey,
            dn: input.dn,
            wellId: input.wellId,
            score: input.score,
            confidence: input.confidence,
            payload: input.payload
        });
    }

    /**
     * Decyzja acceptance/rejection rekomendacji.
     */
    async applyDecision(id: string, accepted: boolean, decidedBy: string): Promise<void> {
        await this.kb.decideRecommendation(id, accepted, decidedBy);
    }
}
