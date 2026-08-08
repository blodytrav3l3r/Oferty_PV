// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('_excelBuildFillPlan — plan wypełnienia Ctrl+Enter (F1)', () => {
    /* Wzorzec runChangeContext z excelDrilledRings.test.ts — ładuje tylko excelCopyPaste.js */
    function runFillPlanContext() {
        const context: any = {
            window: {}
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelCopyPaste.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        return context;
    }

    /* Wywołuje _excelBuildFillPlan z window (rejestracja globalna wg AGENTS.md)
       z fallbackiem na global vm — czytelny błąd, jeśli implementacja nie zarejestruje. */
    function callFillPlan(ctx: any, opts: any) {
        const fn = ctx.window._excelBuildFillPlan || ctx._excelBuildFillPlan;
        expect(typeof fn).toBe('function');
        return fn(opts);
    }

    function openRows(wIdxList: number[]) {
        const m: Record<number, { hidden: boolean; locked: boolean }> = {};
        wIdxList.forEach((w) => (m[w] = { hidden: false, locked: false }));
        return m;
    }

    test('zakres prostokątny: wypełnia wszystkie komórki poza aktywną', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [
                { wIdx: 0, colIdx: 4 },
                { wIdx: 0, colIdx: 5 },
                { wIdx: 1, colIdx: 4 },
                { wIdx: 1, colIdx: 5 }
            ],
            cols: [],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: openRows([0, 1])
        });
        expect(plan).toEqual([
            { wIdx: 0, colIdx: 5 },
            { wIdx: 1, colIdx: 4 },
            { wIdx: 1, colIdx: 5 }
        ]);
    });

    test('zakres nieciągły (Ctrl+klik): wypełnia tylko zaznaczone komórki', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [
                { wIdx: 0, colIdx: 4 },
                { wIdx: 2, colIdx: 6 },
                { wIdx: 5, colIdx: 8 }
            ],
            cols: [],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: openRows([0, 2, 5])
        });
        expect(plan).toEqual([
            { wIdx: 2, colIdx: 6 },
            { wIdx: 5, colIdx: 8 }
        ]);
    });

    test('aktywna komórka wykluczona: pojedyncza selekcja → pusty plan', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [{ wIdx: 0, colIdx: 4 }],
            cols: [],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: openRows([0])
        });
        expect(plan).toEqual([]);
    });

    test('colIdx 3 (nazwa studni) nigdy nie wchodzi do planu', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [
                { wIdx: 0, colIdx: 3 },
                { wIdx: 0, colIdx: 4 }
            ],
            cols: [],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: openRows([0])
        });
        /* jedyna pozostała komórka to nazwa — wykluczona */
        expect(plan).toEqual([]);
    });

    test('wiersze ukryte filtrem są pomijane', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [
                { wIdx: 0, colIdx: 4 },
                { wIdx: 1, colIdx: 4 },
                { wIdx: 2, colIdx: 4 }
            ],
            cols: [],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: {
                0: { hidden: false, locked: false },
                1: { hidden: true, locked: false },
                2: { hidden: false, locked: false }
            }
        });
        expect(plan).toEqual([{ wIdx: 2, colIdx: 4 }]);
    });

    test('studnie zablokowane (PZ / zamówienie) są pomijane', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [
                { wIdx: 0, colIdx: 4 },
                { wIdx: 1, colIdx: 4 },
                { wIdx: 2, colIdx: 4 }
            ],
            cols: [],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: {
                0: { hidden: false, locked: false },
                1: { hidden: false, locked: true },
                2: { hidden: false, locked: false }
            }
        });
        expect(plan).toEqual([{ wIdx: 2, colIdx: 4 }]);
    });

    test('zaznaczone kolumny rozwijane na wszystkie widoczne wiersze', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [],
            cols: [4, 6],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: {
                0: { hidden: false, locked: false },
                1: { hidden: true, locked: false },
                2: { hidden: false, locked: false }
            }
        });
        /* wiersz 1 ukryty → pominięty; aktywna (0,4) wykluczona */
        expect(plan).toEqual([
            { wIdx: 0, colIdx: 6 },
            { wIdx: 2, colIdx: 4 },
            { wIdx: 2, colIdx: 6 }
        ]);
    });

    test('rozwijanie kolumn pomija kolumny strukturalne (colIdx <= 3)', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [],
            cols: [2, 3, 4],
            active: { wIdx: 0, colIdx: 2 },
            rowsMeta: openRows([0, 1])
        });
        /* 2 (Lp) i 3 (nazwa) bez wartości; aktywna (0,2) wykluczona */
        expect(plan).toEqual([
            { wIdx: 0, colIdx: 4 },
            { wIdx: 1, colIdx: 4 }
        ]);
    });

    test('deduplikacja: komórka z selekcji nie dubluje się z rozwinięciem kolumny', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [{ wIdx: 1, colIdx: 4 }],
            cols: [4],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: openRows([0, 1, 2])
        });
        const keys = plan.map((c: any) => c.wIdx + ':' + c.colIdx);
        expect(new Set(keys).size).toBe(plan.length);
        expect(plan.filter((c: any) => c.wIdx === 1 && c.colIdx === 4)).toHaveLength(1);
    });

    test('pusta selekcja (brak cells i cols) → pusty plan', () => {
        const ctx = runFillPlanContext();
        const plan = callFillPlan(ctx, {
            cells: [],
            cols: [],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: openRows([0, 1])
        });
        expect(plan).toEqual([]);
    });

    test('nie mutuje wejściowych tablic', () => {
        const ctx = runFillPlanContext();
        const cells = [
            { wIdx: 0, colIdx: 4 },
            { wIdx: 1, colIdx: 4 }
        ];
        callFillPlan(ctx, {
            cells,
            cols: [4],
            active: { wIdx: 0, colIdx: 4 },
            rowsMeta: openRows([0, 1])
        });
        expect(cells).toEqual([
            { wIdx: 0, colIdx: 4 },
            { wIdx: 1, colIdx: 4 }
        ]);
    });
});
