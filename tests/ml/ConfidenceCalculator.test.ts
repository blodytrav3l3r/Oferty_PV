import { describe, expect, it } from '@jest/globals';
import { ConfidenceCalculator } from '../../src/services/telemetry/learning/ConfidenceCalculator';

describe('ConfidenceCalculator', () => {
    const calc = new ConfidenceCalculator();

    describe('rawConfidence', () => {
        it('zwraca 0 dla hitCount < MIN_HITS (3)', () => {
            expect(calc.rawConfidence(0)).toBe(0);
            expect(calc.rawConfidence(1)).toBe(0);
            expect(calc.rawConfidence(2)).toBe(0);
        });

        it('zwraca >0 dla hitCount >= 3', () => {
            expect(calc.rawConfidence(3)).toBeGreaterThan(0);
        });

        it('rosnie logarytmicznie z hitCount', () => {
            const c3 = calc.rawConfidence(3);
            const c5 = calc.rawConfidence(5);
            const c10 = calc.rawConfidence(10);
            expect(c5).toBeGreaterThan(c3);
            expect(c10).toBeGreaterThan(c5);
        });

        it('nie przekracza MAX_CONFIDENCE (0.95)', () => {
            expect(calc.rawConfidence(1000)).toBeLessThanOrEqual(0.95);
        });
    });

    describe('weighted', () => {
        it('zwraca 0 gdy rawConfidence = 0', () => {
            const w = calc.weighted({ hitCount: 0, successCount: 0, rejectionCount: 0 });
            expect(w).toBe(0);
        });

        it('koryguje w gore dla wysokiego successRatio', () => {
            const high = calc.weighted({ hitCount: 10, successCount: 10, rejectionCount: 0 });
            const low = calc.weighted({ hitCount: 10, successCount: 5, rejectionCount: 5 });
            expect(high).toBeGreaterThan(low);
        });

        it('nie przekracza MAX_CONFIDENCE', () => {
            const w = calc.weighted({ hitCount: 100, successCount: 100, rejectionCount: 0 });
            expect(w).toBeLessThanOrEqual(0.95);
        });
    });

    describe('decay', () => {
        it('zwraca weighted gdy lastHitAt < 30 dni', () => {
            const d = calc.decay({
                hitCount: 10,
                successCount: 8,
                rejectionCount: 2,
                lastHitAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
            });
            const w = calc.weighted({ hitCount: 10, successCount: 8, rejectionCount: 2 });
            expect(d).toBe(w);
        });

        it('zmniejsza confidence po 30+ dniach', () => {
            const d = calc.decay({
                hitCount: 10,
                successCount: 8,
                rejectionCount: 2,
                lastHitAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
            });
            const w = calc.weighted({ hitCount: 10, successCount: 8, rejectionCount: 2 });
            expect(d).toBeLessThan(w);
        });
    });
});
