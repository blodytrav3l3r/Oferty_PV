// @ts-nocheck -- fixture CJS, celowy brak typów jak w innych testach vm
/* F0: walidacja deterministycznego fixture 1200 (plan 2026-09-12). Czyste dane. */
const {
    buildPerfWells,
    PERF_FIXTURE_SEED,
    PERF_FIXTURE_TOTAL,
    PERF_FIXTURE_DN_PLAN
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS bez typów, wzorzec testów vm
} = require('../playwright/excelPerfFixture.cjs');

describe('excelPerfFixture 1200', () => {
    test('łącznie 1200 studni zgodnie z planem DN', () => {
        const wells = buildPerfWells();
        expect(wells).toHaveLength(PERF_FIXTURE_TOTAL);
        const counts = {};
        wells.forEach((w) => {
            counts[w.dn] = (counts[w.dn] || 0) + 1;
        });
        PERF_FIXTURE_DN_PLAN.forEach(([dn, n]) => {
            expect(counts[dn]).toBe(n);
        });
    });

    test('determinizm: ten sam seed daje identyczne dane', () => {
        const a = buildPerfWells(PERF_FIXTURE_SEED);
        const b = buildPerfWells(PERF_FIXTURE_SEED);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test('rozkład pokrywa gałęzie renderu', () => {
        const wells = buildPerfWells();
        const names = wells.map((w) => w.name);
        // Duplikaty nazw (gałąź dup-tint).
        expect(new Set(names).size).toBeLessThan(wells.length);
        // Statusy ERROR/WARNING/OK.
        const statuses = new Set(wells.map((w) => w.configStatus));
        expect(statuses.has('ERROR')).toBe(true);
        expect(statuses.has('WARNING')).toBe(true);
        expect(statuses.has('OK')).toBe(true);
        // Oba magazyny.
        const mags = new Set(wells.map((w) => w.magazyn));
        expect(mags.has('Kluczbork')).toBe(true);
        expect(mags.has('Włocławek')).toBe(true);
        // Przejścia 0..3 i configi pełne/minimalne.
        const trCounts = new Set(wells.map((w) => w.przejscia.length));
        expect(trCounts.has(0)).toBe(true);
        expect([...trCounts].every((n) => n <= 3)).toBe(true);
        expect(wells.some((w) => w.config.length === 0)).toBe(true);
        expect(wells.some((w) => w.config.length > 0)).toBe(true);
        // Unikalne stabilne id (bez Date.now — brak flakiness).
        expect(new Set(wells.map((w) => w.id)).size).toBe(wells.length);
    });
});
