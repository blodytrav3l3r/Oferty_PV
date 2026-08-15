/**
 * Test regresyjny leakage cech (plan MLOps, ETAP 2).
 *
 * FEATURE_NAMES nie może zawierać sygnałów decyzji (label/reward/decision),
 * a oneHotEncode() i buildFeatureVector() nie mogą ich wyprowadzać.
 * Test parytetu train/serve żyje osobno (tests/ml/featureParity.test.ts).
 */

import { describe, expect, it } from '@jest/globals';

const LEAKAGE_KEYS = ['wasAccepted', 'accepted', 'finalConfig', 'decision', 'reward', 'label'];

describe('Feature leakage (ETAP 2)', () => {
    it('FEATURE_NAMES nie zawiera sygnałów decyzji', async () => {
        const { FEATURE_NAMES } = await import('../../src/config/mlConstants');
        for (const key of LEAKAGE_KEYS) {
            expect(FEATURE_NAMES.some((f) => f.toLowerCase().includes(key))).toBe(false);
        }
    });

    it('oneHotEncode() nie wyprowadza label/reward/decyzji', async () => {
        const { oneHotEncode } = await import('../../src/services/ml/TrainingPipeline');
        const vec = oneHotEncode({
            dn: 1500,
            heightMm: 3000,
            warehouse: 'KLB',
            wellType: 'standard',
            ringCount: 3,
            connectionCount: 2,
            totalPrice: 2500,
            totalWeight: 5000,
            season: 'summer',
            label: 'ACCEPTED',
            reward: 1.0,
            wasAccepted: true,
            decisionMs: 123
        } as unknown as Record<string, unknown>);
        // Wektor ma długość FEATURE_NAMES i żadna wartość nie może być "wartością decyzji"
        const { FEATURE_NAMES } = await import('../../src/config/mlConstants');
        expect(vec.length).toBe(FEATURE_NAMES.length);
        // 1.0 może legalnie wystąpić (bity one-hot), ale wynik nie może zależeć
        // od label/reward — porównaj wektor z tym samym wektorem bez label/reward.
        const vecNoLeak = oneHotEncode({
            dn: 1500,
            heightMm: 3000,
            warehouse: 'KLB',
            wellType: 'standard',
            ringCount: 3,
            connectionCount: 2,
            totalPrice: 2500,
            totalWeight: 5000,
            season: 'summer'
        } as unknown as Record<string, unknown>);
        expect(vec).toEqual(vecNoLeak);
    });
});
