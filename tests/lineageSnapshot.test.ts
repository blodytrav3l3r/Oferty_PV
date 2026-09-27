import {
    buildLineageSnapshot,
    parseLineageSnapshot,
    fingerprintDataset
} from '../src/utils/lineageSnapshot';
import { UnknownSnapshotVersionError } from '../src/utils/snapshots';

/**
 * P5.2: inwarianty lineage (8):
 * kompatybilność schematu, determinizm fingerprintu, fingerprint w snapshocie,
 * wersje modelu/samplera, odrzut złego formatu, odrzut braku obowiązkowych,
 * brak mutacji źródła, równoważność powtórzeń.
 */
const input = () => ({
    source: 'training-run',
    payload: { wells: [{ id: 'w1' }], score: 0.87 },
    datasetFingerprint: fingerprintDataset([{ id: 'w1' }]),
    modelVersion: 'v1.8.4',
    solverVersion: '4.2',
    featureVersion: 'v8'
});

describe('P5.2 lineage invariants', () => {
    it('kompatybilność schematu: koperta v1 z lineage', () => {
        const raw = buildLineageSnapshot(input());
        const parsed = JSON.parse(raw);
        expect(parsed.schemaVersion).toBe(1);
        expect(parsed.data.source).toBe('training-run');
    });

    it('deterministyczny fingerprint w snapshocie', () => {
        const a = parseLineageSnapshot(buildLineageSnapshot(input()));
        const b = parseLineageSnapshot(buildLineageSnapshot(input()));
        expect(a.datasetFingerprint).toBe(b.datasetFingerprint);
        expect(a.datasetFingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it('wersje modelu/samplera gdzie dotyczą; null gdzie nie', () => {
        const full = parseLineageSnapshot(buildLineageSnapshot(input()));
        expect(full.modelVersion).toBe('v1.8.4');
        expect(full.solverVersion).toBe('4.2');
        expect(full.rulesVersion).toBeNull();
        const minimal = parseLineageSnapshot(
            buildLineageSnapshot({ source: 'ml-rank', payload: null })
        );
        expect(minimal.modelVersion).toBeNull();
        expect(minimal.payload).toBeNull();
    });

    it('uszkodzony snapshot odrzucony (nie silent)', () => {
        expect(() => parseLineageSnapshot('nie json{')).toThrow(SyntaxError);
        expect(() => parseLineageSnapshot(JSON.stringify({ schemaVersion: 7, data: {} }))).toThrow(
            UnknownSnapshotVersionError
        );
    });

    it('brak obowiązkowych pól odrzucony', () => {
        expect(() => buildLineageSnapshot({ source: '', payload: {} })).toThrow();
        expect(() => buildLineageSnapshot({ source: 'x', payload: undefined })).toThrow();
        expect(() =>
            parseLineageSnapshot(JSON.stringify({ schemaVersion: 1, data: { payload: 1 } }))
        ).toThrow();
    });

    it('writer nie mutuje źródła', () => {
        const src = input();
        const before = JSON.stringify(src);
        buildLineageSnapshot(src);
        expect(JSON.stringify(src)).toBe(before);
    });

    it('powtórzenia tego samego wejścia równoważne (poza createdAt)', () => {
        const a = parseLineageSnapshot(buildLineageSnapshot(input()));
        const b = parseLineageSnapshot(buildLineageSnapshot(input()));
        const { createdAt: _ca, ...restA } = a;
        const { createdAt: _cb, ...restB } = b;
        expect(restA).toEqual(restB);
        expect(typeof a.createdAt).toBe('string');
    });
});
