// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadPolling(overrides: any = {}) {
    const recalculated: number[] = [];
    let dupColors = 0;
    let timerCb: any = null;
    const context: any = {
        window: {},
        wells: [
            { id: 'w0', dn: '1000', config: [], configStatus: '', configErrors: [] },
            { id: 'w1', dn: '1000', config: [], configStatus: '', configErrors: [] },
            { id: 'w2', dn: '1200', config: [], configStatus: '', configErrors: [] }
        ],
        currentWellIndex: -1,
        _excelActiveTab: '1000',
        _excelRefreshTimer: null,
        _excelMarkDirty: () => {},
        _excelUpdateHeaderProdCodes: () => {},
        _excelWellMatchesTab: (w: any, dn: any) => String(w.dn) === String(dn),
        recalculateWellErrors: (w: any) => {
            recalculated.push(context.wells.indexOf(w));
        },
        _excelRefreshDupColors: () => {
            dupColors++;
        },
        setTimeout: (cb: any) => {
            timerCb = cb;
            return 1;
        },
        clearTimeout: () => {},
        ...overrides
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelPolling.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return {
        context,
        recalculated,
        getDupColors: () => dupColors,
        fireTimer: () => timerCb && timerCb()
    };
}

function loadBody() {
    const context: any = {
        window: {},
        escapeHtml: (s: any) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelTableBody.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return context;
}

describe('odswiezanie bledow konfiguracji w Excelu (D1/D2)', () => {
    test('D1: _excelDebouncedRefresh(wIdx) przelicza edytowany wiersz mimo currentWellIndex=-1', () => {
        const { context, recalculated, getDupColors, fireTimer } = loadPolling();
        vm.runInContext('_excelDebouncedRefresh(1)', context);
        fireTimer();
        expect(recalculated).toEqual([1]);
        expect(getDupColors()).toBe(1);
    });

    test('D1: tablica wIdx przelicza kazda studnie raz (dedup)', () => {
        const { context, recalculated, fireTimer } = loadPolling();
        vm.runInContext('_excelDebouncedRefresh([0, 2, 2])', context);
        fireTimer();
        expect(recalculated.sort()).toEqual([0, 2]);
    });

    test('D1: bez argumentu przelicza cala aktywna zakladke, nie inne', () => {
        const { context, recalculated, fireTimer } = loadPolling();
        vm.runInContext('_excelDebouncedRefresh()', context);
        fireTimer();
        expect(recalculated.sort()).toEqual([0, 1]);
    });

    test('D1: kolejka laczy szybkie edycje w jeden przebieg timera', () => {
        const { context, recalculated, fireTimer } = loadPolling();
        vm.runInContext('_excelDebouncedRefresh(0)', context);
        vm.runInContext('_excelDebouncedRefresh(1)', context);
        fireTimer();
        expect(recalculated.sort()).toEqual([0, 1]);
    });

    test('D2: _excelErrorTitle formatuje pierwszy blad i licznik, escapuje HTML', () => {
        const ctx = loadBody();
        expect(ctx._excelErrorTitle({ configErrors: [] })).toBe('');
        expect(ctx._excelErrorTitle(null)).toBe('');
        expect(ctx._excelErrorTitle({ configErrors: ['blad A'] })).toBe('blad A');
        expect(ctx._excelErrorTitle({ configErrors: ['a', 'b', 'c'] })).toBe('a (+2)');
        expect(ctx._excelErrorTitle({ configErrors: ['<x>'] })).toBe('&lt;x&gt;');
    });
});
