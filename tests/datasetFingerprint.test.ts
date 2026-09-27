import { canonicalizeJson, fingerprintDataset } from '../src/utils/datasetFingerprint';

/**
 * P5.1: fingerprint datasetu — deterministyczny, stabilny, SHA-256.
 * 1. identyczny logiczny dataset -> identyczny fingerprint
 * 2. kolejność kluczy -> ten sam fingerprint
 * 3. istotna zmiana danych -> inny fingerprint
 * 4. dodanie rekordu -> inny fingerprint
 * 5. determinizm między runami
 */
describe('P5.1 dataset fingerprint', () => {
    const dataset = () => ({
        wells: [
            { id: 'w2', dn: 1200, price: 500 },
            { id: 'w1', dn: 1000, price: 300 }
        ],
        meta: { version: 3, source: 'telemetry' },
        ringHeights: [250, 500, 250]
    });

    it('identyczny dataset -> identyczny fingerprint (64 hex)', () => {
        const a = fingerprintDataset(dataset());
        const b = fingerprintDataset(dataset());
        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('kolejność kluczy i rekordów-obiektów -> ten sam fingerprint', () => {
        const shuffled = {
            ringHeights: [250, 500, 250],
            meta: { source: 'telemetry', version: 3 },
            wells: [
                { price: 300, dn: 1000, id: 'w1' },
                { price: 500, id: 'w2', dn: 1200 }
            ]
        };
        expect(fingerprintDataset(shuffled)).toBe(fingerprintDataset(dataset()));
    });

    it('istotna zmiana danych -> inny fingerprint', () => {
        const changed = dataset();
        changed.wells[0].price = 501;
        expect(fingerprintDataset(changed)).not.toBe(fingerprintDataset(dataset()));
    });

    it('dodanie rekordu -> inny fingerprint', () => {
        const grown = dataset();
        grown.wells.push({ id: 'w3', dn: 1500, price: 700 });
        expect(fingerprintDataset(grown)).not.toBe(fingerprintDataset(dataset()));
    });

    it('kolejność tablicy prymitywów ma znaczenie (ringHeights)', () => {
        const reordered = dataset();
        reordered.ringHeights = [500, 250, 250];
        expect(fingerprintDataset(reordered)).not.toBe(fingerprintDataset(dataset()));
    });

    it('kanonizacja sortuje klucze rekurencyjnie', () => {
        expect(canonicalizeJson({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}');
    });
});
