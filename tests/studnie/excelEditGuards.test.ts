/**
 * @jest-environment jsdom
 */
// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function readStudnie(f: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8');
}

/**
 * P4-A3/A4/A5: guardy edycji Excel (prawdziwe pliki w vm).
 * - A3: _excelRowTitle scala błąd + blokadę w jeden title (brak duplikatu atrybutu).
 * - A4: odrzucona rzędna nie robi snapshotu undo (snapshot po walidacji).
 * - A5: pusta nazwa nie robi snapshotu ani dirty (early-return przed).
 */
describe('P4 edit guards (A3/A4/A5)', () => {
    test('A3: _excelRowTitle — błąd, blokada, oba, brak', () => {
        const ctx: any = {
            window: {},
            escapeHtml: (s: any) => String(s).replace(/</g, '&lt;')
        };
        vm.createContext(ctx);
        vm.runInContext(readStudnie('excelTableBody.js'), ctx);
        expect(typeof ctx._excelRowTitle).toBe('function');
        expect(ctx._excelRowTitle('blad A', false)).toBe('blad A');
        expect(ctx._excelRowTitle('', true)).toContain('zablokowana');
        const both = ctx._excelRowTitle('blad A', true);
        expect(both).toContain('blad A');
        expect(both).toContain('zablokowana');
        expect(ctx._excelRowTitle('', false)).toBe('');
    });

    function loadHandlers() {
        const calls: { snapshots: number; dirty: number; toasts: string[] } = {
            snapshots: 0,
            dirty: 0,
            toasts: []
        };
        const ctx: any = {
            window: {},
            document,
            wells: [{ id: 'w0', rzednaWlazu: 102, rzednaDna: 100, przejscia: [] }],
            _excelAutoSelectEnabled: false,
            _excelPasteInProgress: false,
            _excelGuardWellLocked: () => true,
            _excelSaveUndoSnapshot: () => {
                calls.snapshots++;
            },
            _excelClearResCache: () => {},
            _excelMarkDirty: () => {
                calls.dirty++;
            },
            _excelMarkAsManual: () => {},
            _excelRefreshAutoCells: () => {},
            _excelUpdateLeftPreview: () => {},
            showToast: (m: string) => {
                calls.toasts.push(m);
            },
            listPrzejsciaBelowDna: () => []
        };
        vm.createContext(ctx);
        vm.runInContext(readStudnie('excelChangeHandlers.js'), ctx);
        return { ctx, calls };
    }

    function rowHtml(wlazu: string, dna: string): string {
        // <tr> poza <table> parser wyrzuca — pełny szkielet jak w produkcji.
        return (
            '<table><tbody><tr data-widx="0">' +
            '<td><input data-field="rzednaWlazu" value="' +
            wlazu +
            '" /></td>' +
            '<td><input data-field="rzednaDna" value="' +
            dna +
            '" /></td>' +
            '</tr></tbody></table>'
        );
    }

    test('A4: odrzucona rzędna (wlaz<=dno) — brak snapshotu, błąd + toast', () => {
        const { ctx, calls } = loadHandlers();
        vm.runInContext(
            `document.body.innerHTML = ${JSON.stringify(rowHtml('100', '100'))}; excelOnRzednaChange(0);`,
            ctx
        );
        expect(calls.snapshots).toBe(0);
        expect(calls.dirty).toBe(0);
        expect(calls.toasts.some((t) => t.includes('musi być większa'))).toBe(true);
        expect(ctx.wells[0].rzednaWlazu).toBe(102);
    });

    test('A4: poprawna rzędna — jeden snapshot + zapis modelu', () => {
        const { ctx, calls } = loadHandlers();
        vm.runInContext(
            `document.body.innerHTML = ${JSON.stringify(rowHtml('103', '100'))}; excelOnRzednaChange(0);`,
            ctx
        );
        expect(calls.snapshots).toBe(1);
        expect(ctx.wells[0].rzednaWlazu).toBe(103);
        expect(ctx.wells[0].rzednaDna).toBe(100);
    });

    function loadWellActions() {
        const calls: { snapshots: number; manual: number } = { snapshots: 0, manual: 0 };
        const ctx: any = {
            window: {},
            wells: [{ id: 'w0', name: 'S1', numer: 'S1' }],
            _excelGuardWellLocked: () => true,
            _excelSaveUndoSnapshot: () => {
                calls.snapshots++;
            },
            _excelMarkAsManual: () => {
                calls.manual++;
            },
            _excelRefreshDupColors: () => {},
            _excelRenderTabs: () => {},
            _excelUpdateWellCount: () => {},
            _excelDebouncedRefresh: () => {},
            _excelInvalidateFilteredIndexes: () => {},
            document: { getElementById: () => null }
        };
        vm.createContext(ctx);
        vm.runInContext(readStudnie('excelWellActions.js'), ctx);
        return { ctx, calls };
    }

    test('A5: pusta nazwa — brak snapshotu i manual', () => {
        const { ctx, calls } = loadWellActions();
        vm.runInContext(`excelOnNameChange(0, '   ');`, ctx);
        expect(calls.snapshots).toBe(0);
        expect(calls.manual).toBe(0);
        expect(ctx.wells[0].name).toBe('S1');
    });

    test('A5: poprawna nazwa — snapshot + zapis', () => {
        const { ctx, calls } = loadWellActions();
        vm.runInContext(`excelOnNameChange(0, 'S2');`, ctx);
        expect(calls.snapshots).toBe(1);
        expect(calls.manual).toBe(1);
        expect(ctx.wells[0].name).toBe('S2');
    });
});
