import { buildReport, hasBlockers } from '../scripts/pricelist-preflight';

function row(id: string, effectiveFrom: string, status = 'ACTIVE') {
    return {
        id,
        type: 'rury',
        seq: 1,
        version: 'v1',
        status,
        effectiveFrom,
        createdBy: null
    };
}

describe('pricelist:preflight buildReport (S0/S2)', () => {
    test('czysta baza: brak blokerów', () => {
        const report = buildReport([
            row('a', '2026-01-01T00:00:00.000Z'),
            row('b', '2026-02-01T00:00:00.000Z')
        ]);
        expect(report.total).toBe(2);
        expect(report.collisions).toEqual([]);
        expect(hasBlockers(report)).toBe(false);
    });

    test('duplikat (type, effectiveFrom) po mapowaniu do APPROVED', () => {
        const report = buildReport([
            row('b', '2026-01-01T00:00:00.000Z'),
            row('a', '2026-01-01T00:00:00.000Z', 'SCHEDULED')
        ]);
        expect(report.collisions).toHaveLength(1);
        expect(report.collisions[0].versions.map((v) => v.id)).toEqual(['b', 'a']);
        expect(hasBlockers(report)).toBe(true);
    });

    test('DRAFT z tą samą datą nie jest kolizją (partial unique)', () => {
        const report = buildReport([
            row('a', '2026-01-01T00:00:00.000Z', 'DRAFT'),
            row('b', '2026-01-01T00:00:00.000Z', 'DRAFT')
        ]);
        expect(report.collisions).toEqual([]);
        expect(hasBlockers(report)).toBe(false);
    });

    test('niepoprawna data i nieznany status blokują', () => {
        const report = buildReport([
            row('a', 'not-a-date'),
            row('b', '2026-02-01T00:00:00.000Z', 'WEIRD')
        ]);
        expect(report.invalidDates.map((v) => v.id)).toEqual(['a']);
        expect(report.unknownStatuses.map((v) => v.id)).toEqual(['b']);
        expect(hasBlockers(report)).toBe(true);
    });

    test('data z offsetem lub małym z blokuje jak guard migracji', () => {
        const report = buildReport([
            row('a', '2026-01-01T00:00:00+01:00'),
            row('b', '2026-01-01T00:00:00.000z'),
            row('c', '2026-01-01T00:00:00.000Z')
        ]);
        expect(report.invalidDates.map((v) => v.id)).toEqual(['a', 'b']);
        expect(hasBlockers(report)).toBe(true);
    });

    test('brak historii migracji blokuje deploy', () => {
        expect(hasBlockers(buildReport([row('a', '2026-01-01T00:00:00.000Z')], true))).toBe(true);
    });
});
