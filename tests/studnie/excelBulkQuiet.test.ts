// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * excelBulkQuiet.test.ts — gate strukturalny P1a (quiet bulk render).
 *
 * Invariant: __excelBulkDepth > 0 wycisza WYLACZNIE UI/render, nigdy stan
 * ani logike (solver, zapis wells, sort/usZczelki/kineta, walidacje).
 * Test laduje PRAWDZIWE solverAutoSelect.js + wellManager.js do vm:
 *  1. refreshAll() przy fladze: zero renderow + refreshSkipped++.
 *  2. refreshAll() bez flagi: rendery normalnie.
 *  3. autoSelectComponents cicho vs glosno: kanoniczny config IDENTYCZNY,
 *     zero refreshAll/renderow w trybie cichym, logika stanu wykonana
 *     (sortWellConfigByOrder/recalcGaskets/syncKineta w obu trybach).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

function canonical(v: any): string {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v !== null && typeof v === 'object') {
        return (
            '{' +
            Object.keys(v)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
                .join(',') +
            '}'
        );
    }
    return JSON.stringify(v);
}

const CATALOG = [
    {
        id: 'DDD-10-100',
        name: 'Dennica DN1000 H=1000',
        componentType: 'dennica',
        dn: '1000',
        height: 1000,
        magazynKLB: 1,
        formaStandardowaKLB: 1
    },
    {
        id: 'KON-10-D',
        name: 'Konus DN1000',
        componentType: 'konus',
        dn: '1000',
        height: 500,
        magazynKLB: 1,
        formaStandardowaKLB: 1
    },
    {
        id: 'KDB-10-10-D',
        name: 'Krag DN1000/1000',
        componentType: 'krag',
        dn: '1000',
        height: 1000,
        magazynKLB: 1,
        formaStandardowaKLB: 1
    },
    {
        id: 'KDB-10-05-D',
        name: 'Krag DN1000/500',
        componentType: 'krag',
        dn: '1000',
        height: 500,
        magazynKLB: 1,
        formaStandardowaKLB: 1
    },
    { id: 'AVR-06', name: 'AVR 60', componentType: 'avr', dn: '1000', height: 60, magazynKLB: 1 }
];
const BY_ID = new Map(CATALOG.map((p) => [p.id, p]));

function mkWell() {
    return {
        id: 'w-bulk',
        dn: 1000,
        type: 'standard',
        magazyn: 'Kluczbork',
        nadbudowa: 'betonowa',
        stopnie: 'drabinka',
        dennicaMaterial: 'beton',
        wkladkaDennica: 'brak',
        zakonczenie: null,
        wkladkaZwienczenie: 'brak',
        redukcjaDN1000: false,
        redukcjaMinH: 0,
        redukcjaZakonczenie: null,
        redukcjaTargetDN: 1000,
        stycznaNadbudowa1200: false,
        stycznaDn: null,
        rzednaWlazu: 3.0,
        rzednaDna: 0,
        wellHeight: 3000,
        przejscia: [],
        config: [],
        uszczelka: 'brak',
        kineta: 'beton',
        psiaBuda: false
    };
}

function makeCtx() {
    const calls: Record<string, number> = {
        refreshAll: 0,
        renderWellConfig: 0,
        renderWellDiagram: 0,
        updateSummary: 0,
        renderWellsList: 0,
        renderTiles: 0,
        renderWellPrzejscia: 0,
        showToast: 0,
        sortWellConfigByOrder: 0,
        recalcGaskets: 0,
        syncKineta: 0
    };
    const sb: any = {
        console,
        structuredClone: (o: any) => JSON.parse(JSON.stringify(o)),
        performance: { now: () => Date.now() },
        requestAnimationFrame: (cb: any) => setTimeout(cb, 0),
        setInterval: () => 0,
        clearInterval: () => {},
        setTimeout,
        clearTimeout,
        localStorage: {
            _m: new Map(),
            getItem(k: string) {
                return this._m.has(k) ? this._m.get(k) : null;
            },
            setItem(k: string, v: string) {
                this._m.set(k, v);
            }
        },
        location: { search: '' },
        fetch: async () => ({ ok: false, json: async () => ({}) }),
        document: {
            getElementById: () => null,
            createElement: () => ({ style: {} }),
            querySelector: () => null,
            querySelectorAll: () => []
        },
        HTMLElement: function () {},
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        authHeaders: () => ({}),
        showToast: () => {
            calls.showToast++;
        },
        getCurrentWell: () => sb.wells[sb.currentWellIndex] || null,
        getStudnieProductById: (id: string) => BY_ID.get(String(id)) || null,
        sortWellConfigByOrder: () => {
            calls.sortWellConfigByOrder++;
        },
        recalcGaskets: () => {
            calls.recalcGaskets++;
        },
        syncKineta: () => {
            calls.syncKineta++;
        },
        enforceGlobalKonusPehdRule: () => {},
        renderWellsList: () => {
            calls.renderWellsList++;
        },
        renderTiles: () => {
            calls.renderTiles++;
        },
        renderWellConfig: () => {
            calls.renderWellConfig++;
        },
        renderWellPrzejscia: () => {
            calls.renderWellPrzejscia++;
        },
        renderWellDiagram: () => {
            calls.renderWellDiagram++;
        },
        updateSummary: () => {
            calls.updateSummary++;
        },
        updateDNButtons: () => {},
        syncElevationInputs: () => {},
        updateAutoLockUI: () => {},
        updateZakonczenieButton: () => {},
        updateRedukcjaButton: () => {},
        updateParamTilesUI: () => {},
        renderWellParams: () => {},
        applyOrderedWellSoftLockUI: () => {},
        renderOfferSummary: () => {},
        orderEditMode: null,
        fmtInt: (v: any) => String(v),
        FLOW_TYPES: {},
        wells: [],
        currentWellIndex: 0,
        __excelBulkDepth: 0,
        __excelBulkStats: null
    };
    sb.window = sb;
    sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of [
        'globals.js',
        'ruleEngine.js',
        'wellConfigRules.js',
        'ringOptimizer.js',
        'solverAutoSelect.js',
        'wellManager.js'
    ]) {
        vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), sb, { filename: f });
    }
    // wellManager.refreshAll musi wygrac z probe stubem: modul definiuje wlasna.
    sb.window.studnieProducts = CATALOG;
    return { sb, calls };
}

describe('excelBulkQuiet (P1a gate)', () => {
    test('refreshAll przy fladze: zero renderow + licznik', () => {
        const { sb, calls } = makeCtx();
        sb.__excelBulkDepth = 1;
        sb.__excelBulkStats = { solverRuns: 0, refreshSkipped: 0, rendersSkipped: 0 };
        sb.refreshAll();
        expect(calls.renderWellsList).toBe(0);
        expect(calls.renderWellConfig).toBe(0);
        expect(calls.renderWellDiagram).toBe(0);
        expect(calls.updateSummary).toBe(0);
        expect(sb.__excelBulkStats.refreshSkipped).toBe(1);
    });

    test('refreshAll bez flagi: rendery normalnie', () => {
        const { sb, calls } = makeCtx();
        sb.wells = [mkWell()];
        sb.refreshAll();
        expect(calls.renderWellsList).toBe(1);
        expect(calls.renderWellConfig).toBe(1);
        expect(calls.updateSummary).toBe(1);
    });

    test('autoSelect cicho vs glosno: identyczny config, zero UI w bulk', async () => {
        const loud = makeCtx();
        loud.sb.wells = [mkWell()];
        await loud.sb.autoSelectComponents(true);
        expect(loud.sb.wells[0].config.length).toBeGreaterThan(0);
        // Prawdziwy refreshAll z wellManager: liczymy przez stuby renderow.
        expect(loud.calls.renderWellConfig).toBeGreaterThan(0);
        expect(loud.calls.renderWellDiagram).toBeGreaterThan(0);
        const loudSnap = canonical({
            config: loud.sb.wells[0].config,
            status: loud.sb.wells[0].configStatus,
            errors: loud.sb.wells[0].configErrors,
            source: loud.sb.wells[0].configSource
        });

        const quiet = makeCtx();
        quiet.sb.wells = [mkWell()];
        quiet.sb.__excelBulkDepth = 1;
        quiet.sb.__excelBulkStats = { solverRuns: 0, refreshSkipped: 0, rendersSkipped: 0 };
        await quiet.sb.autoSelectComponents(true);
        const quietSnap = canonical({
            config: quiet.sb.wells[0].config,
            status: quiet.sb.wells[0].configStatus,
            errors: quiet.sb.wells[0].configErrors,
            source: quiet.sb.wells[0].configSource
        });
        // Stan identyczny (solver + zapis + statusy).
        expect(quietSnap).toBe(loudSnap);
        // Zero UI w bulk.
        expect(quiet.calls.renderWellConfig).toBe(0);
        expect(quiet.calls.renderWellDiagram).toBe(0);
        expect(quiet.calls.updateSummary).toBe(0);
        expect(quiet.calls.renderWellsList).toBe(0);
        expect(quiet.calls.showToast).toBe(0);
        expect(quiet.sb.__excelBulkStats.rendersSkipped).toBeGreaterThan(0);
        // Quiet omija WYWOLANIE refreshAll (liczone w rendersSkipped w miejscu
        // wywolania); refreshSkipped rosnie tylko gdy ktos refreshAll WYWOLA
        // przy fladze (test 1). Tu: 0 i tak ma byc.
        expect(quiet.sb.__excelBulkStats.refreshSkipped).toBe(0);
        // Logika stanu wykonana w obu trybach. Quiet robi DOKLADNIE jedno
        // przeliczenie ze sciezki solvera; loud doklada te same funkcje przez
        // posrednie refreshAll (stad loud >= quiet; identyczny config dowodzi
        // idempotentnosci).
        expect(quiet.calls.sortWellConfigByOrder).toBe(1);
        expect(quiet.calls.recalcGaskets).toBe(1);
        expect(quiet.calls.syncKineta).toBe(1);
        expect(loud.calls.recalcGaskets).toBeGreaterThanOrEqual(quiet.calls.recalcGaskets);
        expect(loud.calls.syncKineta).toBeGreaterThanOrEqual(quiet.calls.syncKineta);
    });
});
