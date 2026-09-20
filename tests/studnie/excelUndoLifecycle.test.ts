// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * excelUndoLifecycle.test.ts — E5 Excel hardening (bez splitow, bez zmian semantyki).
 *
 * Pokrywa lifecycle undo/snapshot modala Excel w stylu excelPatchUndo.test.ts (vm):
 *  1. gate N>100 bez idxs odrzuca snapshot + logger.warn + toast 'warning'
 *     (koniec cichego braku Ctrl+Z).
 *  2. cap 1 MB/wpis odrzuca snapshot + warn.
 *  3. pusty patch (brak studni do snapshotu) jest CICHy — bez warna/spamu.
 *  4. eviction bytes FIFO (_excelEvictUndoIfNeeded): przekroczenie
 *     _EXCEL_UNDO_MAX_BYTES usuwa najstarsze wpisy.
 *  5. open-snapshot: "Zamknij bez zapisu" przywraca wells sprzed edycji.
 *  6. _excelClosing race: podwojne closeExcelTableModal() => jeden dialog.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

function makeCtx(extra: any = {}) {
    const warns: any[][] = [];
    const toasts: any[][] = [];
    let overlayRemoved = 0;
    const overlay = { remove: () => overlayRemoved++ };
    const context: any = {
        wells: [],
        currentWellIndex: 0,
        _excelActiveTab: '1000',
        _excelMaxTransitions: { '1000': 1 },
        _excelUndoStack: [],
        _excelRedoStack: [],
        _EXCEL_UNDO_LIMIT: 50,
        _excelWellIndexById: new Map(),
        structuredClone: global.structuredClone,
        _excelMarkDirty: () => {},
        _excelRenderTable: () => {},
        _excelRebuildWellIndex: () => {},
        _excelSnapshotLockedWells: () => ({}),
        _excelRestoreLockedWells: () => {},
        _excelDebouncedRefresh: () => {},
        _excelStopPolling: () => {},
        _excelUnregisterExcelListeners: () => {},
        _excelCleanEmptyPrzejscia: () => {},
        // _excelUnregisterExcelListeners w excelModal.js wola je bez guardow typeof
        _excelHandleCopy: () => {},
        _excelHandleCut: () => {},
        _excelHandlePaste: () => {},
        _excelOnMouseDown: () => {},
        _excelOnMouseMove: () => {},
        _excelOnMouseUp: () => {},
        _excelOnFocusIn: () => {},
        _excelOnFocusOut: () => {},
        _excelOnFocusInRow: () => {},
        _excelOnClickCell: () => {},
        _excelOnRowSelectChange: () => {},
        _excelHandleKeydown: () => {},
        _excelOnOverlayScroll: () => {},
        showToast: (...a: any[]) => toasts.push(a),
        logger: { warn: (...a: any[]) => warns.push(a), error: () => {} },
        console,
        document: {
            getElementById: (id: string) => (id === 'excel-table-overlay' ? overlay : null),
            querySelector: () => null,
            addEventListener: () => {},
            removeEventListener: () => {},
            createElement: () => ({}),
            body: { style: {} }
        },
        window: null as any,
        addEventListener: () => {},
        removeEventListener: () => {},
        localStorage: { getItem: () => null },
        location: { search: '' },
        _warns: warns,
        _toasts: toasts,
        _overlayRemoved: () => overlayRemoved,
        ...extra
    };
    context.window = context;
    vm.createContext(context);
    for (const f of [
        'excelState.js',
        'excelUndo.js',
        'excelPolling.js',
        'excelTableManager.js',
        'excelModal.js'
    ]) {
        const code = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
        vm.runInContext(code, context, { filename: f });
    }
    return context;
}

function mkWells(n: number) {
    const arr = [];
    for (let i = 0; i < n; i++)
        arr.push({
            id: 'well-' + i,
            name: 'Ss' + i,
            dn: '1000',
            config: [],
            rzednaWlazu: 10,
            rzednaDna: 5
        });
    return arr;
}

describe('excel undo lifecycle — E5', () => {
    test('gate N>100 bez idxs: odrzut full snapshot + warn + toast', () => {
        const ctx = makeCtx();
        ctx.wells = mkWells(101);
        ctx._excelSaveUndoSnapshot();
        // UWAGA: excelState.js deklaruje `let _excelUndoStack` — shadowuje prop sandboxa,
        // wewnatrz vm obowiazuje wiazanie leksykalne, stad odczyt przez vm string.
        expect(vm.runInContext('_excelUndoStack.length', ctx)).toBe(0);
        expect(ctx._warns.length).toBe(1);
        expect(String(ctx._warns[0][1])).toMatch(/100/);
        expect(ctx._toasts.length).toBe(1);
        expect(ctx._toasts[0][1]).toBe('warning');
    });

    test('cap 1 MB/wpis: odrzut patch + warn', () => {
        const ctx = makeCtx();
        ctx.wells = mkWells(2);
        ctx.wells[0].blob = 'x'.repeat(1100 * 1024);
        ctx._excelSaveUndoSnapshot([0]);
        expect(vm.runInContext('_excelUndoStack.length', ctx)).toBe(0);
        expect(ctx._warns.length).toBe(1);
        expect(String(ctx._warns[0][1])).toMatch(/1 MB/);
    });

    test('pusty patch (brak studni): cichy, bez warna', () => {
        const ctx = makeCtx();
        ctx.wells = mkWells(2);
        ctx._excelSaveUndoSnapshot([99]);
        expect(vm.runInContext('_excelUndoStack.length', ctx)).toBe(0);
        expect(ctx._warns.length).toBe(0);
        expect(ctx._toasts.length).toBe(0);
    });

    test('toast throttling: seryjne odrzuty nie spamuja', () => {
        const ctx = makeCtx();
        ctx.wells = mkWells(101);
        ctx._excelSaveUndoSnapshot();
        ctx._excelSaveUndoSnapshot();
        ctx._excelSaveUndoSnapshot();
        expect(ctx._warns.length).toBe(3);
        expect(ctx._toasts.length).toBe(1);
    });

    test('eviction bytes FIFO: nadmiar usuwa najstarsze', () => {
        const ctx = makeCtx();
        ctx.wells = mkWells(2);
        vm.runInContext(
            "_excelUndoStack.push({type:'full',tag:'old',data:'y'.repeat(7*1024*1024)})",
            ctx
        );
        vm.runInContext(
            "_excelUndoStack.push({type:'full',tag:'new',data:'y'.repeat(7*1024*1024)})",
            ctx
        );
        ctx._excelEvictUndoIfNeeded();
        expect(vm.runInContext('_excelUndoStack.length', ctx)).toBe(1);
        expect(vm.runInContext('_excelUndoStack[0].tag', ctx)).toBe('new');
    });

    test('open-snapshot: "Zamknij bez zapisu" przywraca wells', async () => {
        const ctx = makeCtx({ appConfirm: async () => false });
        ctx.wells = mkWells(2);
        vm.runInContext('_excelOpenSnapshot = structuredClone(wells)', ctx);
        vm.runInContext('_excelDirty = true', ctx);
        ctx.wells[0].name = 'EDYTOWANA';
        ctx.wells.push({
            id: 'well-2',
            name: 'Ss2',
            dn: '1000',
            config: [],
            rzednaWlazu: 12,
            rzednaDna: 6
        });
        await ctx.closeExcelTableModal();
        expect(ctx.wells.length).toBe(2);
        expect(ctx.wells[0].name).toBe('Ss0');
        expect(ctx._overlayRemoved()).toBe(1);
    });

    test('_excelClosing race: podwojne zamkniecie => jeden dialog', async () => {
        let calls = 0;
        let resolveDialog: (v: boolean) => void = () => {};
        const ctx = makeCtx({
            appConfirm: () =>
                new Promise<boolean>((res) => {
                    calls++;
                    resolveDialog = res;
                })
        });
        ctx.wells = mkWells(2);
        vm.runInContext('_excelOpenSnapshot = structuredClone(wells)', ctx);
        vm.runInContext('_excelDirty = true', ctx);
        const p1 = ctx.closeExcelTableModal();
        const p2 = ctx.closeExcelTableModal();
        expect(calls).toBe(1);
        resolveDialog(false);
        await p1;
        await p2;
        expect(calls).toBe(1);
        expect(ctx._overlayRemoved()).toBe(1);
        expect(vm.runInContext('_excelClosing', ctx)).toBe(false);
    });
});
