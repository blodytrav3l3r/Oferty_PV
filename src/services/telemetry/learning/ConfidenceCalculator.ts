/**
 * ConfidenceCalculator.ts
 *
 * Krzywe zaufania dla wzorców w bazie wiedzy.
 * Wykorzystuje logarytmiczny wzrost + time-decay (pasywne uczenie).
 */

export interface ConfidenceInput {
    hitCount: number;
    successCount: number;
    rejectionCount: number;
    lastHitAt?: string | null;
    now?: string;
}

export class ConfidenceCalculator {
    /** minimalna liczba próbek by uznac wzorzec */
    public readonly MIN_HITS = 3;
    /** maksymalny confidence (cap) */
    public readonly MAX_CONFIDENCE = 0.95;

    /**
     * Confidence z hit_count z użyciem krzywej logarytmicznej:
     * 3 hits → 0.3, 5 → ~0.5, 10 → ~0.7, 20+ → 0.9+
     */
    rawConfidence(hitCount: number): number {
        if (hitCount < this.MIN_HITS) return 0;
        const raw = Math.log(hitCount) / Math.log(30);
        return Math.min(raw, this.MAX_CONFIDENCE);
    }

    /**
     * Confidence z korektą na sukces/odrzucenie.
     */
    weighted(input: ConfidenceInput): number {
        const raw = this.rawConfidence(input.hitCount);
        if (raw === 0) return 0;
        const total = input.successCount + input.rejectionCount;
        if (total === 0) return raw * 0.5;
        const successRatio = input.successCount / total;
        const weighted = raw * (0.5 + 0.5 * successRatio);
        return Math.min(weighted, this.MAX_CONFIDENCE);
    }

    /**
     * Decay: confidence spada o 5% za każde 30 dni bez aktywności.
     */
    decay(input: ConfidenceInput): number {
        if (!input.lastHitAt) {
            return this.weighted(input);
        }
        const now = input.now ? new Date(input.now) : new Date();
        const last = new Date(input.lastHitAt);
        const days = Math.max(
            0,
            Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
        );
        if (days < 30) {
            return this.weighted(input);
        }
        const periods = Math.floor(days / 30);
        const decay = 0.95 ** periods;
        return Math.max(this.weighted(input) * decay, 0);
    }
}
