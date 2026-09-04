// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * solverEquivalence.test.ts — gate rownowaznosci solvera (P0-1).
 *
 * Porownuje kanoniczna serializacje wyniku runJsAutoSelection() ze zlotymi
 * snapshotami. Dowolny refactor solvera (grupowanie DP, hoist filtra,
 * reuse tabeli) MUSI przechodzic ten test bez zmian goldenow.
 *
 * - QUICK=1: ~10 przypadkow (petla dev).
 * - Bez QUICK: pelna macierz DN x wysokosc x przejscia x redukcja x psiaBuda.
 * - GEN_GOLDEN=1: regeneruje goldeny (TЛЬKO na niezmienionym kodzie prod!).
 *
 * AI celowo odpiete (brak window.rankCandidates) — sciezka deterministyczna.
 * Kontrakt wyniku: config, totalHeight, diff, topLabel, errors, isMinimal,
 * fallback, fallbackReason, aiUsed. Kolejnosc kandydatow nie jest zwracana
 * przez runJsAutoSelection (zwyciezca = candidates[0]), wiec goleny obejmuja
 * finalny wybor sciezki technicznej.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');
const GOLDEN_PATH = path.join(__dirname, '__snapshots__/solverEquivalence.golden.json');
const QUICK = process.env.QUICK === '1';
const GEN_GOLDEN = process.env.GEN_GOLDEN === '1';

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
    // Ksztalt runtime (productsStudnieV2.ts:203-204: boolean -> 1/0).
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
        id: 'well-eq',
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

function buildMatrix(catalog: any[]): Array<[string, any]> {
    const transProd = catalog.find((p) => p.componentType === 'przejscie');
    const tp = (h: number) => ({ productId: transProd.id, rzednaWlaczenia: h });
    const full: Array<[string, any]> = [
        ['DN1000-3m-0prz', mkWell({})],
        ['DN1000-1m-krotka', mkWell({ rzednaWlazu: 1.0, wellHeight: 1000 })],
        [
            'DN1000-4m-2prz',
            mkWell({ rzednaWlazu: 4.0, wellHeight: 4000, przejscia: [tp(1.0), tp(1.8)] })
        ],
        [
            'DN1000-5m-5prz',
            mkWell({
                rzednaWlazu: 5.0,
                wellHeight: 5000,
                przejscia: [tp(0.5), tp(1.2), tp(2.0), tp(2.8), tp(3.5)]
            })
        ],
        ['DN1200-2m-0prz', mkWell({ dn: 1200, rzednaWlazu: 2.0, wellHeight: 2000 })],
        [
            'DN1200-4m-3prz',
            mkWell({
                dn: 1200,
                rzednaWlazu: 4.0,
                wellHeight: 4000,
                przejscia: [tp(0.8), tp(1.6), tp(2.4)]
            })
        ],
        [
            'DN1500-5m-red',
            mkWell({ dn: 1500, redukcjaDN1000: true, rzednaWlazu: 5.0, wellHeight: 5000 })
        ],
        [
            'DN1500-5m-red-2prz',
            mkWell({
                dn: 1500,
                redukcjaDN1000: true,
                rzednaWlazu: 5.0,
                wellHeight: 5000,
                przejscia: [tp(1.0), tp(2.0)]
            })
        ],
        [
            'DN2000-6m-3prz',
            mkWell({
                dn: 2000,
                rzednaWlazu: 6.0,
                wellHeight: 6000,
                przejscia: [tp(1), tp(2), tp(3)]
            })
        ],
        ['DN2000-3m-0prz', mkWell({ dn: 2000, rzednaWlazu: 3.0, wellHeight: 3000 })],
        ['DN1000-3m-psiaBuda', mkWell({ psiaBuda: true, type: 'psia_buda' })],
        [
            'DN1500-4m-zelbet',
            mkWell({ dn: 1500, nadbudowa: 'zelbetowa', rzednaWlazu: 4.0, wellHeight: 4000 })
        ],
        ['DN1000-3m-WL', mkWell({ magazyn: 'Włocławek' })],
        ['DN1000-3m-wlaz-redmin', mkWell({ redukcjaMinH: 2500 })]
    ];
    if (QUICK) return full.slice(0, 10);
    return full;
}

describe('solverEquivalence (P0-1 gate)', () => {
    const catalog = loadCatalog();
    const sb = makeCtx(catalog);
    const cases = buildMatrix(catalog);

    test.each(cases.map(([n]) => [n]))('wynik identyczny ze snapshotem: %s', async (name) => {
        const [, well] = cases.find(([n]) => n === name)!;
        const w = JSON.parse(JSON.stringify(well));
        const avail = sb.getAvailableProducts(w).filter((p: any) => sb.filterByWellParams(p, w));
        const requiredMm = Math.round((w.rzednaWlazu - (w.rzednaDna || 0)) * 1000);
        const res = await sb.runJsAutoSelection(w, requiredMm, avail);
        const snap = canonical({
            config: res.config || null,
            totalHeight: res.totalHeight ?? null,
            diff: res.diff ?? null,
            topLabel: res.topLabel ?? null,
            errors: res.errors || null,
            isMinimal: !!res.isMinimal,
            fallback: !!res.fallback,
            fallbackReason: res.fallbackReason || null,
            aiUsed: !!res.aiUsed,
            error: res.error || null
        });
        if (GEN_GOLDEN) {
            const goldens = fs.existsSync(GOLDEN_PATH)
                ? JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'))
                : {};
            goldens[name as string] = snap;
            fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
            fs.writeFileSync(GOLDEN_PATH, JSON.stringify(goldens, null, 2), 'utf8');
            return;
        }
        const goldens = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
        expect(goldens[name as string]).toBeDefined();
        expect(snap).toBe(goldens[name as string]);
    });
});
