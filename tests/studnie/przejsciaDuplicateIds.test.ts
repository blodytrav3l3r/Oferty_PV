// @ts-nocheck -- wzorzec vm (rzednaClamp.test.ts)
// Kontrakt: pr.id globalnie unikalne (hover SVG → Excel po data-prz-id).
// structuredClone przy duplikacji kopiuje id 1:1 — kopia musi dostać nowe.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f: string) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

const clone = (o: any) => JSON.parse(JSON.stringify(o));

function loadElemId() {
    const context: any = { window: {} };
    vm.createContext(context);
    vm.runInContext(readStudnie('wellElemId.js'), context);
    return context;
}

function przIds(well: any): string[] {
    return (well.przejscia || []).map((p: any) => p.id);
}

describe('resetPrzejsciaIds', () => {
    it('regeneruje wszystkie id (stare znikają, nowe unikalne)', () => {
        const ctx = loadElemId();
        const list = [{ id: 'prz-A' }, { id: 'prz-B' }, {}];
        ctx.resetPrzejsciaIds(list);
        const ids = list.map((p: any) => p.id);
        expect(ids.every((id) => typeof id === 'string' && id !== '')).toBe(true);
        expect(ids).not.toContain('prz-A');
        expect(ids).not.toContain('prz-B');
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('bezpieczny dla nie-tablic', () => {
        const ctx = loadElemId();
        expect(ctx.resetPrzejsciaIds(null)).toBeNull();
        expect(ctx.resetPrzejsciaIds(undefined)).toBeUndefined();
    });
});

describe('ensureUniquePrzejsciaIdsAcrossWells', () => {
    it('konflikt między studiami: pierwsze zostaje, kolejne nowe', () => {
        const ctx = loadElemId();
        const wells = [
            { id: 'w1', przejscia: [{ id: 'prz-X' }, { id: 'prz-Y' }] },
            { id: 'w2', przejscia: [{ id: 'prz-X' }, { id: 'prz-Z' }] },
            { id: 'w3', przejscia: [{ id: 'prz-X' }] }
        ];
        ctx.ensureUniquePrzejsciaIdsAcrossWells(wells);
        expect(wells[0].przejscia[0].id).toBe('prz-X');
        expect(wells[1].przejscia[0].id).not.toBe('prz-X');
        expect(wells[2].przejscia[0].id).not.toBe('prz-X');
        const all = wells.flatMap((w) => przIds(w));
        expect(new Set(all).size).toBe(all.length);
        // Unikalne nietknięte.
        expect(wells[0].przejscia[1].id).toBe('prz-Y');
        expect(wells[1].przejscia[1].id).toBe('prz-Z');
    });

    it('idempotentny: drugi przebieg nic nie zmienia', () => {
        const ctx = loadElemId();
        const wells = [
            { id: 'w1', przejscia: [{ id: 'prz-X' }] },
            { id: 'w2', przejscia: [{ id: 'prz-X' }, {}] }
        ];
        ctx.ensureUniquePrzejsciaIdsAcrossWells(wells);
        const snap = JSON.stringify(wells);
        ctx.ensureUniquePrzejsciaIdsAcrossWells(wells);
        expect(JSON.stringify(wells)).toBe(snap);
    });

    it('bezpieczny dla braków (brak przejść, null)', () => {
        const ctx = loadElemId();
        expect(ctx.ensureUniquePrzejsciaIdsAcrossWells(null)).toBeNull();
        expect(() =>
            ctx.ensureUniquePrzejsciaIdsAcrossWells([{ id: 'w1' }, null, { przejscia: [null] }])
        ).not.toThrow();
    });
});

describe('duplicateWell (kontrakt)', () => {
    function loadCrud(wells: any[]) {
        const context: any = {
            window: {},
            document: { querySelectorAll: () => [], getElementById: () => null },
            wells,
            wellCounter: 0,
            structuredClone: clone,
            enforceGlobalKonusPehdRule: () => false,
            showToast: () => {},
            refreshAll: () => {}
        };
        vm.createContext(context);
        vm.runInContext(readStudnie('wellElemId.js'), context);
        vm.runInContext(readStudnie('actionsWellCrud.js'), context);
        return context;
    }

    it('kopia nie dzieli pr.id z oryginałem', () => {
        const wells = [{ id: 'w1', name: 'S1', przejscia: [{ id: 'prz-A' }, { id: 'prz-B' }] }];
        const ctx = loadCrud(wells);
        ctx.duplicateWell(0);
        expect(ctx.wells.length).toBe(2);
        const origIds = new Set(przIds(ctx.wells[0]));
        const copyIds = przIds(ctx.wells[1]);
        expect(copyIds.length).toBe(2);
        copyIds.forEach((id) => expect(origIds.has(id)).toBe(false));
        expect(new Set(copyIds).size).toBe(copyIds.length);
    });
});

describe('excelDuplicateWell (kontrakt)', () => {
    function loadExcelActions(wells: any[]) {
        const context: any = {
            window: {},
            document: { querySelectorAll: () => [], getElementById: () => null },
            setTimeout: () => 0,
            wells,
            structuredClone: clone,
            _excelIsWellLocked: () => false,
            _excelSaveUndoSnapshot: () => {},
            _excelMarkDirty: () => {},
            _excelRebuildWellIndex: () => {},
            _excelInvalidateFilteredIndexes: () => {},
            _excelMaxTransitions: {},
            _excelActiveTab: 'tab',
            _excelGetMaxTransitions: () => 1,
            _excelRenderTabs: () => {},
            _excelRenderTable: () => {},
            _excelUpdateWellCount: () => {},
            _excelDebouncedRefresh: () => {},
            _excelSelectedCells: [],
            _excelLastClickedCell: null,
            _excelRowSelectStates: {},
            showToast: () => {}
        };
        vm.createContext(context);
        vm.runInContext(readStudnie('wellElemId.js'), context);
        vm.runInContext(readStudnie('excelWellActions.js'), context);
        return context;
    }

    it('kopia nie dzieli pr.id z oryginałem', () => {
        const wells = [{ id: 'w1', name: 'S1', przejscia: [{ id: 'prz-A' }] }];
        const ctx = loadExcelActions(wells);
        ctx.excelDuplicateWell(0);
        expect(ctx.wells.length).toBe(2);
        const origIds = new Set(przIds(ctx.wells[0]));
        const copyIds = przIds(ctx.wells[1]);
        expect(copyIds.length).toBe(1);
        copyIds.forEach((id) => expect(origIds.has(id)).toBe(false));
    });
});

describe('podpięcie w kodzie (definicje)', () => {
    it('obie ścieżki duplikacji wołają resetPrzejsciaIds na kopii', () => {
        expect(readStudnie('actionsWellCrud.js')).toContain('resetPrzejsciaIds(copy.przejscia)');
        expect(readStudnie('excelWellActions.js')).toContain('resetPrzejsciaIds(copy.przejscia)');
    });

    it('render Excela deduplikuje id przed rysowaniem wierszy', () => {
        const src = readStudnie('excelTableBody.js');
        expect(src).toContain('ensureUniquePrzejsciaIdsAcrossWells(wells)');
    });

    it('open Excela: normalize (backfill + dedup) przed tabela, diagram po tabeli', () => {
        const src = readStudnie('excelModal.js');
        const backfillPos = src.indexOf('ensurePrzejsciaIds(wells[_rwo].przejscia)');
        const dedupPos = src.indexOf('ensureUniquePrzejsciaIdsAcrossWells(wells)');
        const renderPos = src.indexOf('_excelRenderTable(_excelActiveTab)');
        const diagramPos = src.indexOf('renderWellDiagram()', renderPos);
        expect(backfillPos).toBeGreaterThan(-1);
        expect(dedupPos).toBeGreaterThan(backfillPos);
        expect(renderPos).toBeGreaterThan(dedupPos);
        expect(diagramPos).toBeGreaterThan(renderPos);
    });
});

describe('diagnostyka hoveru (flaga __SOK_DEBUG)', () => {
    function loadRendererWithDebug(opts: any) {
        const debugCalls: any[] = [];
        const context: any = {
            window: { svgDragStartIndex: -1, __SOK_DEBUG: !!opts.debug },
            document: {
                querySelectorAll: (sel: string) => {
                    if (String(sel).includes('.prz-tile')) return [];
                    if (String(sel).includes('g[data-prz-id]')) return opts.shapes || [];
                    return [];
                },
                getElementById: (id: string) => (id === 'excel-table-overlay' ? opts.overlay : null)
            },
            getCurrentWell: () => ({ id: 'w9', przejscia: [] }),
            console: {
                debug: (...args: any[]) => {
                    debugCalls.push(args);
                }
            }
        };
        vm.createContext(context);
        vm.runInContext(readStudnie('diagramRenderer.js'), context);
        return { ctx: context, debugCalls };
    }

    function fakeTd(przId: string) {
        return {
            getAttribute: () => przId,
            classList: { toggle: () => {} }
        };
    }

    const overlayWith = (tds: any[]) => ({
        querySelectorAll: (sel: string) => (String(sel).includes('td[data-prz-id]') ? tds : [])
    });

    it('loguje brak matchu tylko za flagą', () => {
        const withFlag = loadRendererWithDebug({
            debug: true,
            overlay: overlayWith([fakeTd('prz-inne')])
        });
        withFlag.ctx.window.svgPrzPointerEnter({}, 'prz-brak');
        expect(withFlag.debugCalls.length).toBe(1);
        expect(withFlag.debugCalls[0][0]).toContain('Excel Hover');
        expect(withFlag.debugCalls[0][1].przejscieId).toBe('prz-brak');
        expect(withFlag.debugCalls[0][1].wellId).toBe('w9');
        expect(withFlag.debugCalls[0][1].tdCandidates).toBe(1);

        const noFlag = loadRendererWithDebug({
            debug: false,
            overlay: overlayWith([fakeTd('prz-inne')])
        });
        noFlag.ctx.window.svgPrzPointerEnter({}, 'prz-brak');
        expect(noFlag.debugCalls.length).toBe(0);
    });

    it('match kasuje diagnostykę (brak logu mimo flagi)', () => {
        const loaded = loadRendererWithDebug({
            debug: true,
            overlay: overlayWith([fakeTd('prz-traf')])
        });
        loaded.ctx.window.svgPrzPointerEnter({}, 'prz-traf');
        expect(loaded.debugCalls.length).toBe(0);
    });
});
