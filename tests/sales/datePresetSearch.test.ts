import { parseSearchParams, buildWhereParts } from '../../src/utils/searchUtils';

// Mock wierny semantyce Prisma: buildWhereParts/parseSearchParams używają
// Prisma.sql/raw/empty/join do budowy fragmentów SQL — renderujemy je do stringów.
jest.mock('../../generated/prisma', () => {
    const renderSql = (strings: any, values: any) => {
        if (strings && typeof strings === 'object' && strings.__prismaSql) {
            return strings.render();
        }
        let out = '';
        (strings || []).forEach((s: string, i: number) => {
            out += s;
            if (i < (values || []).length) {
                const v = values[i];
                out += v && typeof v === 'object' && v.__prismaSql ? v.render() : String(v);
            }
        });
        return out;
    };
    const makeSql = (strings: any, values: any) => ({
        __prismaSql: true,
        render: () => renderSql(strings, values)
    });
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => makeSql(strings, values);
    return {
        Prisma: {
            raw: (s: string) => makeSql([s], []),
            empty: makeSql([''], []),
            sql,
            join: (vals: unknown[], sep = ', ') =>
                makeSql(['', ...new Array(Math.max(vals.length - 1, 0)).fill(sep), ''], vals)
        }
    };
});

jest.mock('../../src/utils/fts5Sync', () => ({
    buildFts5Query: () => null
}));

const renderParts = (parts: any[]): string =>
    parts.map((p) => (p && p.render ? p.render() : String(p))).join(' AND ');

describe('parseSearchParams — walidacja dat', () => {
    it('akceptuje YYYY-MM-DD (zakres)', () => {
        const p = parseSearchParams({ dateFrom: '2026-08-01', dateTo: '2026-08-08' });
        expect(p.dateFrom).toBe('2026-08-01');
        expect(p.dateTo).toBe('2026-08-08');
    });

    it('akceptuje pelny ISO z czasem (preset resolveDatePreset)', () => {
        const p = parseSearchParams({
            dateFrom: '2026-08-07T22:00:00.000Z',
            dateTo: '2026-08-08T22:00:00.000Z'
        });
        expect(p.dateFrom).toBe('2026-08-07T22:00:00.000Z');
        expect(p.dateTo).toBe('2026-08-08T22:00:00.000Z');
    });

    it('odrzuca niepoprawne formaty (regresja #26)', () => {
        expect(parseSearchParams({ dateFrom: 'nie-data' }).dateFrom).toBe('');
        expect(parseSearchParams({ dateFrom: '2026-08-07 22:00' }).dateFrom).toBe('');
        expect(parseSearchParams({ dateFrom: '2026/08/07' }).dateFrom).toBe('');
        expect(parseSearchParams({ dateTo: '2026-08-07T22:00:00.000Z extra' }).dateTo).toBe('');
    });
});

describe('buildWhereParts — klauzule createdAt', () => {
    const base = {
        q: '',
        dateFrom: '',
        dateTo: '',
        userId: '',
        cursor: '',
        cursorId: '',
        sort: 'createdAt',
        order: 'desc'
    };

    it('dateFrom ISO: >= z surowa wartoscia', () => {
        const parts = buildWhereParts({ ...base, dateFrom: '2026-08-07T22:00:00.000Z' });
        expect(renderParts(parts)).toContain('"createdAt" >= 2026-08-07T22:00:00.000Z');
    });

    it('dateTo ISO: < z surowa wartoscia (poloowki przedzial presetu)', () => {
        const parts = buildWhereParts({ ...base, dateTo: '2026-08-08T22:00:00.000Z' });
        expect(renderParts(parts)).toContain('"createdAt" < 2026-08-08T22:00:00.000Z');
    });

    it('dateTo YYYY-MM-DD: <= z suffixem konca dnia', () => {
        const parts = buildWhereParts({ ...base, dateTo: '2026-08-08' });
        expect(renderParts(parts)).toContain('"createdAt" <= 2026-08-08T23:59:59.999Z');
    });

    it('puste daty: brak klauzul createdAt', () => {
        const parts = buildWhereParts(base);
        const sql = renderParts(parts);
        expect(sql).not.toContain('createdAt');
    });
});
