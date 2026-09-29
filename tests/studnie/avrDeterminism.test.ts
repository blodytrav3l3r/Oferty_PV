// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * avrDeterminism.test.ts — gate determinizmu sciezki AVR (findBestAvrFill/solve).
 *
 * findBestAvrFill/solve sa zagniezdzone w runJsAutoSelection (nie sa dostepne
 * bezposrednio z zewnatrz), wiec test cwiczy je przez runJsAutoSelection —
 * ten sam input 2x daje IDENTYCZNY output (JSON equal), takze po busy-loop
 * dluzszym niz AVR_TIMEOUT_MS (100 ms). Wykrywa zaleznosc wyniku od czasu
 * (Date.now roznicujace backtracking AVR).
 *
 * AI celowo odpiete (brak window.rankCandidates) — sciezka deterministyczna.
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
    if (typeof v === 'number' && !Number.isInteger(v)) return String(Math.round(v * 1e6) / 1e6);
    return JSON.stringify(v);
}

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
    return sb;
}

function mkWell(over: any = {}) {
    return {
        id: 'well-avr-det',
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

async function solveSnapshot(sb: any, well: any): Promise<string> {
    const w = JSON.parse(JSON.stringify(well));
    const avail = sb.getAvailableProducts(w).filter((p: any) => sb.filterByWellParams(p, w));
    const requiredMm = Math.round((w.rzednaWlazu - (w.rzednaDna || 0)) * 1000);
    // runJsAutoSelection w srodku wywoluje solve -> findBestAvrFill (linie 59,769,777).
    const res = await sb.runJsAutoSelection(w, requiredMm, avail);
    return canonical(res);
}

function busyWait(ms: number) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        Math.sqrt(Math.random());
    }
}

describe('avrDeterminism', () => {
    test('findBestAvrFill/solve 2x na tych samych danych daje identyczny wynik', async () => {
        const catalog = loadCatalog();
        const sb = makeCtx(catalog);
        const well = mkWell({});
        const first = await solveSnapshot(sb, well);
        const second = await solveSnapshot(sb, well);
        expect(second).toBe(first);
    });

    test('wynik nie zalezy od obciazenia (run po busy-loop > AVR_TIMEOUT_MS)', async () => {
        const catalog = loadCatalog();
        const sb = makeCtx(catalog);
        const well = mkWell({});
        const first = await solveSnapshot(sb, well);
        busyWait(400);
        const afterLoad = await solveSnapshot(sb, well);
        expect(afterLoad).toBe(first);
    });
});
