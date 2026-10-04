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

function loadBody(overrides: any = {}) {
    const context: any = {
        window: {},
        currentWellIndex: -1,
        escapeHtml: (s: any) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        _excelStickyCellBg: (tint: any, solid: any) =>
            'linear-gradient(' + tint + ',' + tint + '),' + solid,
        ...overrides
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelTableBody.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return context;
}

function fakeRow(wIdx: number, opts: any = {}) {
    const attrs: Record<string, string> = {
        'data-widx': String(wIdx),
        'data-solid-bg': 'var(--excel-row-even)',
        'data-base-bg': 'var(--excel-row-even)',
        'data-hover-bg': 'var(--excel-row-hover)',
        'data-active-bg': 'var(--excel-row-active)'
    };
    const classes = new Set<string>(opts.dup ? ['excel-row-dup'] : []);
    return {
        getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
        setAttribute: (k: string, v: string) => {
            attrs[k] = v;
        },
        removeAttribute: (k: string) => {
            delete attrs[k];
        },
        getAttributeNames: () => Object.keys(attrs),
        style: {} as Record<string, string>,
        classList: {
            contains: (c: string) => classes.has(c),
            add: (...cs: string[]) => cs.forEach((c) => classes.add(c)),
            remove: (...cs: string[]) => cs.forEach((c) => classes.delete(c))
        },
        querySelectorAll: () => [] as any[],
        _attrs: attrs,
        _classes: classes
    };
}

function makeStrip() {
    let html = '';
    let writes = 0;
    return {
        style: { display: 'none' } as Record<string, string>,
        dataset: {} as Record<string, string>,
        get innerHTML() {
            return html;
        },
        set innerHTML(v: string) {
            writes++;
            html = v;
        },
        _writes: () => writes,
        _html: () => html
    };
}

function loadFast(overrides: any = {}) {
    const recalculated: number[] = [];
    const painted: number[] = [];
    const heavy = { summary: 0, list: 0, diagram: 0, table: 0 };
    const strip = makeStrip();
    const rows: Record<number, any> = {
        0: fakeRow(0),
        1: fakeRow(1),
        2: fakeRow(2)
    };
    const context: any = {
        window: {
            updateSummary: () => heavy.summary++,
            renderWellsList: () => heavy.list++,
            renderWellDiagram: () => heavy.diagram++
        },
        wells: [
            { id: 'w0', dn: '1000', config: [], configStatus: 'OK', configErrors: [], numer: 'S1' },
            {
                id: 'w1',
                dn: '1000',
                config: [],
                configStatus: 'ERROR',
                configErrors: ['Błąd zapasu w "Krąg" dla przejścia nr 1'],
                numer: 'S2'
            },
            { id: 'w2', dn: '1200', config: [], configStatus: '', configErrors: [] }
        ] as any[],
        currentWellIndex: 1,
        document: {
            getElementById: (id: string) => {
                if (id === 'excel-table-overlay') return {};
                if (id === 'excel-active-errors') return strip;
                return null;
            },
            querySelector: (sel: string) => {
                const m = /data-widx="(\d+)"/.exec(sel);
                return m ? rows[+m[1]] || null : null;
            }
        },
        escapeHtml: (s: any) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        recalculateWellErrors: (w: any) => {
            recalculated.push(context.wells.indexOf(w));
        },
        _excelPaintRowStatus: (row: any, w: any) => {
            painted.push(context.wells.indexOf(w));
        },
        _excelRenderTable: () => heavy.table++,
        ...overrides
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelPolling.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return { context, recalculated, painted, heavy, strip, rows };
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

describe('fast path aktywnego wiersza (sync model, rAF DOM, zero heavy)', () => {
    test('sync: recalc 1 studni + paint + pasek, bez updateSummary/list/diagram/table', () => {
        const { context, recalculated, painted, heavy, strip } = loadFast();
        const res = vm.runInContext('_excelSyncActiveRowErrors(1)', context);
        expect(res).toBe('scheduled');
        expect(recalculated).toEqual([1]);
        expect(painted).toEqual([1]);
        expect(strip.style.display).toBe('block');
        expect(strip._html()).toContain('S2');
        expect(strip._html()).toContain('Błąd zapasu');
        expect(heavy).toEqual({ summary: 0, list: 0, diagram: 0, table: 0 });
    });

    test('quiet (paste/fill): deferred, brak recalc i paint', () => {
        const { context, recalculated, painted, strip } = loadFast({
            _excelPasteQuiet: () => true
        });
        const res = vm.runInContext('_excelSyncActiveRowErrors(1)', context);
        expect(res).toBe('deferred');
        expect(recalculated).toEqual([]);
        expect(painted).toEqual([]);
        expect(strip.style.display).toBe('none');
    });

    test('bulk: dedup wIdx, pasek ostatniego, brak heavy', () => {
        const { context, recalculated, painted, strip } = loadFast();
        vm.runInContext('_excelSyncActiveRowErrorsBulk([1, 1, 0])', context);
        expect(recalculated.sort()).toEqual([0, 1]);
        expect(painted.sort()).toEqual([0, 1]);
        // ostatni = wIdx 0 (OK, brak bledow) -> pasek gasnie
        expect(strip.style.display).toBe('none');
    });

    test('strip guard: drugi sync bez zmian tresci nie pisze DOM', () => {
        const { context, strip } = loadFast();
        vm.runInContext('_excelSyncActiveRowErrors(1)', context);
        const writes1 = strip._writes();
        expect(writes1).toBe(1);
        vm.runInContext('_excelSyncActiveRowErrors(1)', context);
        expect(strip._writes()).toBe(writes1);
    });

    test('rAF koalescuje dwa schedule w jeden flush (ostatni wygrywa)', () => {
        const rafs: any[] = [];
        const { context, painted } = loadFast({
            requestAnimationFrame: (cb: any) => {
                rafs.push(cb);
                return rafs.length;
            }
        });
        vm.runInContext('_excelScheduleActiveRowPaint(0)', context);
        vm.runInContext('_excelScheduleActiveRowPaint(1)', context);
        expect(rafs.length).toBe(1);
        rafs.forEach((cb) => cb());
        expect(painted).toEqual([1]);
    });
});

describe('_excelPaintRowStatus (1 wiersz, bez mapy duplikatow)', () => {
    test('ERROR: klasa + kolor + title z bledem', () => {
        const ctx = loadBody();
        const row = fakeRow(1);
        const well = { configStatus: 'ERROR', configErrors: ['Błąd zapasu x'] };
        const fn = vm.runInContext('_excelPaintRowStatus', ctx);
        fn(row, well);
        expect(row._classes.has('excel-row-error')).toBe(true);
        expect(row.style.color).toBe('var(--danger-hover)');
        expect(row._attrs['title']).toContain('Błąd zapasu x');
        expect(row._attrs['data-base-bg']).toContain('danger');
    });

    test('dup: tlo zachowane, klasa bledu i title dodane', () => {
        const ctx = loadBody();
        const row = fakeRow(1, { dup: true });
        const before = row._attrs['data-base-bg'];
        const fn = vm.runInContext('_excelPaintRowStatus', ctx);
        fn(row, { configStatus: 'ERROR', configErrors: ['Kolizja otworu'] });
        expect(row._attrs['data-base-bg']).toBe(before);
        expect(row._classes.has('excel-row-error')).toBe(true);
        expect(row._classes.has('excel-row-dup')).toBe(true);
        expect(row._attrs['title']).toContain('Kolizja otworu');
    });

    test('OK: czysci klasy bledu i kolor', () => {
        const ctx = loadBody();
        const row = fakeRow(1);
        const fn = vm.runInContext('_excelPaintRowStatus', ctx);
        fn(row, { configStatus: 'ERROR', configErrors: ['x'] });
        expect(row._classes.has('excel-row-error')).toBe(true);
        fn(row, { configStatus: 'OK', configErrors: [] });
        expect(row._classes.has('excel-row-error')).toBe(false);
        expect(row._classes.has('excel-row-warning')).toBe(false);
        expect(row.style.color).toBe('');
        expect(row.getAttribute('title')).toBe(null);
    });
});
