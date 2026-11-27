import { describe, expect, it } from '@jest/globals';
import {
    computeTrainingConfigFingerprint,
    computeTrainingFingerprints,
    computeTrainingUserScopeFingerprint,
    type FingerprintTrainingRow
} from '../../src/services/ml/trainingLineage';

const rows: FingerprintTrainingRow[] = [
    { split: 'train', features: [1, 0.25], label: 1, weight: 0.9 },
    { split: 'validation', features: [0.2, 0.75], label: 0, weight: 0.8 },
    { split: 'test', features: [0.8, 0.5], label: 1, weight: 0.7 }
];

describe('training lineage fingerprints', () => {
    it('creates a deterministic user-scope fingerprint without storing raw identifiers', () => {
        const userIds = ['user-uuid-a', 'user-uuid-b'];
        const fingerprint = computeTrainingUserScopeFingerprint(userIds);

        expect(fingerprint).toMatch(/^sok-ml-user-scope-v1:sha256:[a-f0-9]{64}$/);
        expect(computeTrainingUserScopeFingerprint(['user-uuid-b', 'user-uuid-a'])).toBe(
            fingerprint
        );
        expect(
            computeTrainingUserScopeFingerprint(['user-uuid-a', 'user-uuid-a', 'user-uuid-b'])
        ).toBe(fingerprint);
        expect(fingerprint).not.toContain('user-uuid-a');
        expect(fingerprint).not.toContain('user-uuid-b');
        expect(computeTrainingUserScopeFingerprint(['user-uuid-a'])).not.toBe(fingerprint);
    });

    it('daje stabilny fingerprint dla tych samych wejść, schematu i splitu', () => {
        expect(computeTrainingFingerprints(rows, 'v7', 'chronological-70-15-15-v1')).toEqual(
            computeTrainingFingerprints(rows, 'v7', 'chronological-70-15-15-v1')
        );
    });

    it.each([
        ['cecha', rows.map((row, index) => (index === 0 ? { ...row, features: [1, 0.3] } : row))],
        ['label', rows.map((row, index) => (index === 0 ? { ...row, label: 0 as const } : row))],
        [
            'waga efektywna',
            rows.map((row, index) => (index === 0 ? { ...row, weight: 0.91 } : row))
        ],
        [
            'split',
            rows.map((row, index) => (index === 0 ? { ...row, split: 'validation' as const } : row))
        ]
    ])('zmiana %s zmienia fingerprint datasetu', (_name, changedRows) => {
        expect(
            computeTrainingFingerprints(changedRows, 'v7', 'chronological-70-15-15-v1')
                .datasetFingerprint
        ).not.toBe(
            computeTrainingFingerprints(rows, 'v7', 'chronological-70-15-15-v1').datasetFingerprint
        );
    });

    it('fingerprint uwzględnia wersję schematu i politykę splitu', () => {
        const baseline = computeTrainingFingerprints(rows, 'v7', 'chronological-70-15-15-v1');
        expect(
            computeTrainingFingerprints(rows, 'v8', 'chronological-70-15-15-v1').datasetFingerprint
        ).not.toBe(baseline.datasetFingerprint);
        expect(
            computeTrainingFingerprints(rows, 'v7', 'chronological-80-10-10-v2').datasetFingerprint
        ).not.toBe(baseline.datasetFingerprint);
    });

    it('fingerprint konfiguracji jest stabilny niezależnie od kolejności kluczy i czuły na parametry', () => {
        expect(
            computeTrainingConfigFingerprint({ epochs: 10, model: { seed: 42, rate: 0.01 } })
        ).toBe(computeTrainingConfigFingerprint({ model: { rate: 0.01, seed: 42 }, epochs: 10 }));
        expect(
            computeTrainingConfigFingerprint({ epochs: 11, model: { seed: 42, rate: 0.01 } })
        ).not.toBe(
            computeTrainingConfigFingerprint({ epochs: 10, model: { seed: 42, rate: 0.01 } })
        );
    });
});
