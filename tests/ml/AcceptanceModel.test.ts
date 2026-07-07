/**
 * Testy modułu AcceptanceModel (Logistic Regression).
 *
 * Weryfikują:
 * - sigmoid działa poprawnie (w tym edge cases: -Inf, +Inf, 0)
 * - predict zwraca score [0-1]
 * - gradient descent zbiega się do sensownych wag
 * - batch predict działa na wielu przykładach
 */

import { describe, expect, it } from '@jest/globals';
import { AcceptanceModel } from '../../src/services/ml/AcceptanceModel';

describe('AcceptanceModel', () => {
    describe('sigmoid', () => {
        const model = new AcceptanceModel(1);

        it('zwraca 0.5 dla wejścia 0', () => {
            expect(model.sigmoid(0)).toBeCloseTo(0.5, 5);
        });

        it('zwraca ~1 dla dużego dodatniego wejścia', () => {
            expect(model.sigmoid(20)).toBeCloseTo(1.0, 5);
            expect(model.sigmoid(100)).toBeCloseTo(1.0, 5);
        });

        it('zwraca ~0 dla dużego ujemnego wejścia', () => {
            expect(model.sigmoid(-20)).toBeCloseTo(0.0, 5);
            expect(model.sigmoid(-100)).toBeCloseTo(0.0, 5);
        });

        it('jest symetryczny względem 0.5', () => {
            const s1 = model.sigmoid(2);
            const s2 = model.sigmoid(-2);
            expect(s1 + s2).toBeCloseTo(1.0, 5);
        });
    });

    describe('predict', () => {
        it('zwraca score między 0 a 1', () => {
            const model = new AcceptanceModel(3);
            const score = model.predict([1, 2, 3]);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(1);
        });

        it('zwraca 0.5 dla zerowych wag i cech', () => {
            const model = new AcceptanceModel(2);
            const score = model.predict([0, 0]);
            expect(score).toBeCloseTo(0.5, 5);
        });
    });

    describe('train', () => {
        it('uczy się prostego wzorca AND', () => {
            const model = new AcceptanceModel(2);

            const dataset = [
                { features: [0, 0], label: 0, weight: 1 },
                { features: [0, 1], label: 0, weight: 1 },
                { features: [1, 0], label: 0, weight: 1 },
                { features: [1, 1], label: 1, weight: 1 }
            ];

            model.train(dataset, 0.1, 10000);

            expect(model.predict([0, 0])).toBeLessThan(0.5);
            expect(model.predict([0, 1])).toBeLessThan(0.5);
            expect(model.predict([1, 0])).toBeLessThan(0.5);
            expect(model.predict([1, 1])).toBeGreaterThan(0.5);
        });

        it('uczy się prostego wzorca OR', () => {
            const model = new AcceptanceModel(2);

            const dataset = [
                { features: [0, 0], label: 0, weight: 1 },
                { features: [0, 1], label: 1, weight: 1 },
                { features: [1, 0], label: 1, weight: 1 },
                { features: [1, 1], label: 1, weight: 1 }
            ];

            model.train(dataset, 0.1, 10000);

            expect(model.predict([0, 0])).toBeLessThan(0.5);
            expect(model.predict([0, 1])).toBeGreaterThan(0.5);
            expect(model.predict([1, 0])).toBeGreaterThan(0.5);
            expect(model.predict([1, 1])).toBeGreaterThan(0.5);
        });

        it('akceptuje dataset z wagami', () => {
            const model = new AcceptanceModel(1);
            const dataset = [
                { features: [0], label: 0, weight: 0.5 },
                { features: [1], label: 1, weight: 2.0 }
            ];
            model.train(dataset, 0.01, 5000);
            expect(model.predict([1])).toBeGreaterThan(0.5);
        });

        it('nie rzuca błędu dla pustego datasetu', () => {
            const model = new AcceptanceModel(1);
            expect(() => model.train([], 0.01, 100)).not.toThrow();
        });
    });

    describe('predictBatch', () => {
        it('zwraca tablicę wyników', () => {
            const model = new AcceptanceModel(2);
            const results = model.predictBatch([[0, 0], [1, 1], [0, 1]]);
            expect(results).toHaveLength(3);
            results.forEach((r: number) => {
                expect(r).toBeGreaterThanOrEqual(0);
                expect(r).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('getWeights / getBias', () => {
        it('zwraca kopię wag', () => {
            const model = new AcceptanceModel(2, [0.5, -0.3], 0.1);
            const weights = model.getWeights();
            expect(weights).toEqual([0.5, -0.3]);
            weights[0] = 999; // modyfikacja kopii
            expect(model.getWeights()).toEqual([0.5, -0.3]); // oryginał nietknięty
        });

        it('zwraca bias', () => {
            const model = new AcceptanceModel(1, [0.5], -0.2);
            expect(model.getBias()).toBe(-0.2);
        });
    });
});
