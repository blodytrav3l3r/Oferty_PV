/**
 * Testy metryk uzupełniających (plan MLOps, ETAP 4).
 *
 * Zasada: metryka matematycznie nieokreślona → null (nigdy NaN/Infinity).
 */

import { describe, expect, it } from '@jest/globals';
import {
    computeBrier,
    computeConfusion,
    computeEce,
    computeLogLoss,
    computePrAuc
} from '../../src/services/ml/metrics';

describe('computePrAuc', () => {
    it('doskonała separacja → PR-AUC=1', () => {
        const preds = [0.9, 0.8, 0.1, 0.05];
        const labels = [1, 1, 0, 0];
        const auc = computePrAuc(preds, labels);
        expect(auc).not.toBeNull();
        expect(auc!).toBeCloseTo(1, 5);
    });

    it('predykcje odwrotne do etykiet → PR-AUC bliski 0', () => {
        const preds = [0.1, 0.05, 0.9, 0.8];
        const labels = [1, 1, 0, 0];
        const auc = computePrAuc(preds, labels);
        expect(auc).not.toBeNull();
        expect(auc!).toBeLessThan(0.3);
    });

    it('brak pozytywów → null (nieokreślone)', () => {
        expect(computePrAuc([0.5, 0.6], [0, 0])).toBeNull();
    });

    it('pusty zbiór → null', () => {
        expect(computePrAuc([], [])).toBeNull();
    });
});

describe('computeLogLoss', () => {
    it('doskonałe predykcje → log-loss bliski 0', () => {
        const ll = computeLogLoss([0.999, 0.001], [1, 0]);
        expect(ll).not.toBeNull();
        expect(ll!).toBeLessThan(0.01);
    });

    it('predykcje 0.5 dla wszystkiego → log-loss = ln(2)', () => {
        const ll = computeLogLoss([0.5, 0.5], [1, 0]);
        expect(ll).toBeCloseTo(Math.log(2), 5);
    });

    it('pusty zbiór → null', () => {
        expect(computeLogLoss([], [])).toBeNull();
    });

    it('różne długości → null', () => {
        expect(computeLogLoss([0.5], [1, 0])).toBeNull();
    });

    it('nigdy nie zwraca Infinity (predykcje przycięte)', () => {
        const ll = computeLogLoss([0, 1], [1, 0]);
        expect(ll).not.toBeNull();
        expect(Number.isFinite(ll)).toBe(true);
    });
});

describe('computeBrier', () => {
    it('doskonałe predykcje → 0', () => {
        expect(computeBrier([1, 0], [1, 0])).toBeCloseTo(0, 10);
    });

    it('predykcje 0.5 → 0.25', () => {
        expect(computeBrier([0.5, 0.5], [1, 0])).toBeCloseTo(0.25, 10);
    });

    it('pusty zbiór → null', () => {
        expect(computeBrier([], [])).toBeNull();
    });
});

describe('computeEce', () => {
    it('dobrze skalibrowane predykcje → ECE≈0', () => {
        // pred 0.5 przy dokładnie 50/50 etykiet: acc == conf → ECE 0
        const preds = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
        const labels = [1, 1, 1, 0, 0, 0];
        const ece = computeEce(preds, labels, 10);
        expect(ece).not.toBeNull();
        expect(ece!).toBeLessThan(1e-10);
    });

    it('słaba kalibracja → ECE > 0', () => {
        // wysoka pewność, złe etykiety
        const preds = [0.95, 0.9, 0.05, 0.1];
        const labels = [0, 0, 1, 1];
        const ece = computeEce(preds, labels, 10);
        expect(ece).not.toBeNull();
        expect(ece!).toBeGreaterThan(0.5);
    });

    it('pusty zbiór → null', () => {
        expect(computeEce([], [])).toBeNull();
    });
});

describe('computeConfusion', () => {
    it('liczy tp/fp/fn/tn dla progu 0.5', () => {
        const cm = computeConfusion([0.9, 0.4, 0.6, 0.1], [1, 1, 0, 0]);
        expect(cm).toEqual({ tp: 1, fp: 1, fn: 1, tn: 1 });
    });

    it('pusty zbiór → null', () => {
        expect(computeConfusion([], [])).toBeNull();
    });
});
