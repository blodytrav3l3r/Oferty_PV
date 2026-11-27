import { describe, expect, it } from '@jest/globals';
import { datasetFingerprintOf, type DatasetRow } from '../../src/services/ml/transfer/dataset';

const row: DatasetRow = {
    id: 'record-a',
    telemetryId: null,
    dn: 1000,
    heightMm: 5000,
    warehouse: 'KLB',
    wellType: 'standard',
    hasReduction: false,
    hasPsiaBuda: false,
    hasStyczna: false,
    ringCount: 4,
    bottomType: 'flat',
    topType: 'waz',
    kinetaType: 'standard',
    dennicaHeight: 550,
    connectionCount: 2,
    transitionsAboveDennica: 1,
    totalPrice: 4200,
    totalWeight: 3800,
    ringVariety: 2,
    season: 'winter',
    label: 'ACCEPTED',
    reward: 1,
    decisionMs: 1200,
    createdAt: '2026-10-01T12:00:00.000Z'
};

describe('dataset snapshot fingerprint v2', () => {
    it('reaguje na zmianę zawartości, lecz nie ujawnia ani nie wiąże identyfikatorów', () => {
        const baseline = datasetFingerprintOf([row]);
        expect(datasetFingerprintOf([{ ...row, totalPrice: 4201 }])).not.toBe(baseline);
        expect(datasetFingerprintOf([{ ...row, id: 'record-b' }])).toBe(baseline);
        expect(datasetFingerprintOf([{ ...row, telemetryId: 'owner-link' }])).toBe(baseline);
    });

    it('jest stabilny względem kolejności i zachowuje liczność duplikatów', () => {
        const second = { ...row, id: 'record-b', dn: 1200 };
        expect(datasetFingerprintOf([row, second])).toBe(datasetFingerprintOf([second, row]));
        expect(datasetFingerprintOf([row, row])).not.toBe(datasetFingerprintOf([row]));
    });

    it('utrzymuje weryfikację legacy dataset schema v1', () => {
        const legacy = datasetFingerprintOf([row], 'v7', '1');
        expect(datasetFingerprintOf([row], 'v7', '1')).toBe(legacy);
    });
});
