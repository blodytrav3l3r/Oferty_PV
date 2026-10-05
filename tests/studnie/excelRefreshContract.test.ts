// @ts-nocheck -- wzorzec vm (excelWellLock.test.ts)
// Kontrakt refresha Excela (baza #58):
// - edycja komórki (Rodzaj/Średnica select, Właz) NIGDY nie robi full-rendera
//   tabeli — tylko in-place wiersza + sync preview + debounce (L2);
// - flush debounce robi ciężkie panele (updateSummary/diagram) TYLKO po
//   operacji strukturalnej (bez arg), nie po edycji wiersza (L1 już policzył).
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f: string) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function baseWell() {
    return {
        id: 'w1',
        name: 'S1',
        dn: 1000,
        rzednaWlazu: 10,
        rzednaDna: 5,
        config: [],
        przejscia: [],
        autoSelect: true,
        autoLocked: false
    };
}

function loadChangeHandlers(wells: any[], extra: any = {}) {
    const counters = {
        renderTable: 0,
        headerCodes: 0,
        immediatePreview: 0,
        syncErrors: 0,
        debounced: 0,
        dnOptions: 0
    };
    const context: any = {
        wells,
        window: {},
        studnieProducts: [],
        currentWellIndex: 0,
        _excelActiveTab: '1000',
        _excelMaxTransitions: { '1000': 1 },
        _excelAutoSelectEnabled: true,
        _excelPasteInProgress: false,
        _excelGuardWellLocked: () => true,
        _excelSaveUndoSnapshot: () => {},
        _excelCreatePrzejscie: () => ({ productId: '', rzednaWlaczenia: null, angle: 0 }),
        _excelMarkAsManual: () => {},
        _excelClearResCache: () => {},
        _excelInsertConfigItem: () => {},
        recalculateWellErrors: () => {},
        _excelRenderTable: () => {
            counters.renderTable++;
        },
        _excelUpdateHeaderProdCodes: () => {
            counters.headerCodes++;
        },
        _excelUpdateLeftPreview: () => {},
        _excelImmediatePreview: () => {
            counters.immediatePreview++;
        },
        _excelSyncActiveRowErrors: () => {
            counters.syncErrors++;
        },
        _excelDebouncedRefresh: () => {
            counters.debounced++;
        },
        console,
        ...extra
    };
    vm.createContext(context);
    vm.runInContext(readStudnie('excelChangeHandlers.js'), context);
    // helper in-place zdefiniowany w ładowanym pliku — wrap do liczenia wywołań
    const origDn = context._excelRefreshTransitionDnOptions;
    context._excelRefreshTransitionDnOptions = (...args: any[]) => {
        counters.dnOptions++;
        return origDn(...args);
    };
    return { ctx: context, counters };
}

describe('baza #58: edycja komórki bez full-rendera', () => {
    test('Rodzaj (select): model + in-place opcji Średnicy, zero _excelRenderTable', () => {
        const wells = [baseWell()];
        const { ctx, counters } = loadChangeHandlers(wells);
        ctx.excelOnPrzejscieTypeChange(0, 0, 'PCV');
        expect(wells[0].przejscia[0].tempCategory).toBe('PCV');
        expect(counters.renderTable).toBe(0);
        expect(counters.dnOptions).toBe(1);
        expect(counters.headerCodes).toBeGreaterThanOrEqual(1);
        expect(counters.immediatePreview).toBe(1);
        expect(counters.debounced).toBe(1);
    });

    test('Właz (select): tylko model flag, zero _excelRenderTable', () => {
        const wells = [baseWell()];
        const { ctx, counters } = loadChangeHandlers(wells);
        ctx.excelOnWlazChange(0, 'wlaz-1');
        expect(wells[0].autoSelect).toBe(false);
        expect(wells[0].configSource).toBe('MANUAL');
        expect(counters.renderTable).toBe(0);
        expect(counters.immediatePreview).toBe(1);
        expect(counters.debounced).toBe(1);
    });
});

describe('baza #58: flush debounce — ciężkie tylko po strukturalnej', () => {
    function loadPolling() {
        const counters = { headerCodes: 0, summary: 0, diagram: 0, dupColors: 0, dirty: 0 };
        const timers: any[] = [];
        const context: any = {
            wells: [baseWell(), baseWell()],
            currentWellIndex: 0,
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1 },
            _excelRefreshTimer: null,
            _excelPendingErrorWIdxs: [],
            _excelRefreshAllErrorsPending: false,
            _excelListStale: false,
            Date,
            setTimeout: (fn: any) => {
                timers.push(fn);
                return timers.length;
            },
            clearTimeout: () => {},
            document: { getElementById: () => ({}) },
            window: {
                updateSummary: () => {
                    counters.summary++;
                },
                renderWellDiagram: () => {
                    counters.diagram++;
                },
                renderWellsList: () => {}
            },
            _excelMarkDirty: () => {
                counters.dirty++;
            },
            _excelUpdateHeaderProdCodes: () => {
                counters.headerCodes++;
            },
            recalculateWellErrors: () => {},
            _excelRefreshDupColors: () => {
                counters.dupColors++;
            },
            _excelWellMatchesTab: () => true,
            console
        };
        vm.createContext(context);
        vm.runInContext(readStudnie('excelPolling.js'), context);
        return { ctx: context, counters, timers };
    }

    test('flush po edycji wiersza: kody h3 tak, panele NIE', () => {
        const { ctx, counters, timers } = loadPolling();
        ctx._excelDebouncedRefresh(0);
        expect(timers.length).toBe(1);
        timers[0]();
        expect(counters.headerCodes).toBe(1);
        expect(counters.summary).toBe(0);
        expect(counters.diagram).toBe(0);
    });

    test('flush po operacji strukturalnej: panele TAK', () => {
        const { ctx, counters, timers } = loadPolling();
        ctx._excelDebouncedRefresh();
        timers[0]();
        expect(counters.summary).toBe(1);
        expect(counters.diagram).toBe(1);
    });
});
