// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * solverFiniteGuard.test.ts — guard isFinite na wejsciu auto-doboru.
 *
 * Regresja: NaN przechodzil guard (NaN < 500 == false) i jako targetBody=NaN
 * splywal w dol do fillKregiDP/optimizeRings. Guard w autoSelectComponents
 * (rzednaWlazu/rzednaDna/requiredMm) odrzuca nie-skonczone wejscia ta sama
 * sciezka co wlazu==null||wlazu<=rzDna — zero NaN w dol, semantyka valid
 * nietknieta. Wzorzec sandboxu: solverDeterminism.test.ts.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

function loadCatalog(): any[] {
    const raw = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../data/seed_studnie.json'), 'utf8')
    );
    const arr = Array.isArray(raw) ? raw : raw.products || raw.data || [];
    return arr.map((p: any) => ({
        ...p,
        magazynWL: p.magazynWL === undefined ? undefined : p.magazynWL ? 1 : 0,
        magazynKLB: p.magazynKLB === undefined ? undefined : p.magazynKLB ? 1 : 0
    }));
}

function makeCtx(catalog: any[]) {
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
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        authHeaders: () => ({}),
        showToast: () => {},
        getCurrentWell: () => null,
        fmtInt: (v: any) => String(v),
        FLOW_TYPES: {}
    };
    sb.window = sb;
    sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of [
        'globals.js',
        'transitionZones.js',
        'ruleEngine.js',
        'wellConfigRules.js',
        'ringOptimizer.js',
        'solverAutoSelect.js'
    ]) {
        vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), sb, { filename: f });
    }
    sb.window.studnieProducts = catalog;
    // Hermetyczne stub'y UI — autoSelectComponents woła je bez guarda typeof
    // (realne malowanie DOM niepotrzebne; config i tak przypisywany wczesniej).
    sb.sortWellConfigByOrder = () => {};
    sb.renderWellConfig = () => {};
    sb.renderWellDiagram = () => {};
    sb.updateSummary = () => {};
    sb.refreshAll = () => {};
    // Spy DP: targetBody=NaN nie smei splywac do optimizeRingsForDistance.
    sb.__dpTargets = [];
    const origOpt = sb.optimizeRingsForDistance;
    sb.optimizeRingsForDistance = function (...args: any[]) {
        sb.__dpTargets.push(args[0]);
        return origOpt.apply(this, args);
    };
    return sb;
}

function mkWell(over: any = {}) {
    return {
        id: 'well-finite',
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
        psiaBuda: false,
        ...over
    };
}

function hasNaN(v: any, seen = new Set()): boolean {
    if (typeof v === 'number') return Number.isNaN(v);
    if (v !== null && typeof v === 'object') {
        if (seen.has(v)) return false;
        seen.add(v);
        return Object.values(v).some((x) => hasNaN(x, seen));
    }
    return false;
}

describe('solverFiniteGuard', () => {
    const catalog = loadCatalog();

    test.each([
        ['wlazu NaN', { rzednaWlazu: NaN, rzednaDna: 0 }],
        ['wlazu undefined', { rzednaWlazu: undefined, rzednaDna: 0 }],
        ['wlazu Infinity', { rzednaWlazu: Infinity, rzednaDna: 0 }],
        ['wlazu -Infinity', { rzednaWlazu: -Infinity, rzednaDna: 0 }],
        ['dna NaN', { rzednaWlazu: 3.0, rzednaDna: NaN }],
        ['dna Infinity', { rzednaWlazu: 3.0, rzednaDna: Infinity }],
        ['dna -Infinity', { rzednaWlazu: 3.0, rzednaDna: -Infinity }],
        ['obie NaN', { rzednaWlazu: NaN, rzednaDna: NaN }]
    ])('odrzucenie bez NaN w dol: %s', async (_name, over) => {
        const sb = makeCtx(catalog);
        const well = mkWell(over);
        sb.getCurrentWell = () => well;
        await sb.autoSelectComponents(true);
        // Odrzucone na bramce: config nietkniety, zero wywolan DP, zero NaN
        // w wyprowadzonych polach (same rzedne wejsciowe sa NaN z zalozenia).
        expect(well.config).toEqual([]);
        expect(sb.__dpTargets).toEqual([]);
        expect(sb.__dpTargets.some((t: any) => !Number.isFinite(t))).toBe(false);
        expect(hasNaN(well.config)).toBe(false);
        expect(hasNaN(well.configErrors)).toBe(false);
        expect(hasNaN(well._preAutoConfig)).toBe(false);
        expect(hasNaN(well._lastAutoConfig)).toBe(false);
    });

    test('valid bez zmian: rozwiazuje ze skonczonymi liczbami', async () => {
        const sb = makeCtx(catalog);
        const well = mkWell({});
        sb.getCurrentWell = () => well;
        await sb.autoSelectComponents(true);
        expect(well.config.length).toBeGreaterThan(0);
        expect(hasNaN(well)).toBe(false);
        for (const t of sb.__dpTargets) expect(Number.isFinite(t)).toBe(true);
    });
});
