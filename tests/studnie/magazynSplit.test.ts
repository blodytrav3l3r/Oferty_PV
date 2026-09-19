// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * magazynSplit.test.ts — magazyn per element (dennica/nadbudowa).
 *
 * 1. Jednostkowo: resolveWellMagazyn (fallback), partForProduct (determinizm),
 *    pule getAvailableProducts per part, dedup unii, helper MagazynCodes.
 * 2. Integracyjnie (seed catalog + runJsAutoSelection): izolacja pul —
 *    zmiana magazynDennica nie rusza nadbudowy i odwrotnie, w obie strony
 *    (dennica WL/nadbudowa KLB oraz dennica KLB/nadbudowa WL).
 * 3. Eksport per wiersz + grupowanie importu (_groupRows).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_STUDNIE = path.join(__dirname, '../../public/js/studnie');
const JS_IE = path.join(__dirname, '../../public/js/import-export/studnie');

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

function baseSandbox(extra: any = {}) {
    const sb: any = {
        console,
        structuredClone: (o: any) => JSON.parse(JSON.stringify(o)),
        performance: { now: () => Date.now() },
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
        FLOW_TYPES: {},
        ...extra
    };
    sb.window = sb;
    sb.globalThis = sb;
    vm.createContext(sb);
    return sb;
}

function loadRulesCtx() {
    const sb = baseSandbox();
    for (const f of ['globals.js', 'wellConfigRules.js']) {
        vm.runInContext(fs.readFileSync(path.join(JS_STUDNIE, f), 'utf8'), sb, {
            filename: f
        });
    }
    return sb;
}

function loadSolverCtx(catalog: any[]) {
    const sb = baseSandbox();
    for (const f of [
        'globals.js',
        'transitionZones.js',
        'ruleEngine.js',
        'wellConfigRules.js',
        'ringOptimizer.js',
        'solverAutoSelect.js'
    ]) {
        vm.runInContext(fs.readFileSync(path.join(JS_STUDNIE, f), 'utf8'), sb, {
            filename: f
        });
    }
    sb.window.studnieProducts = catalog;
    return sb;
}

function loadIeCtx() {
    const sb = baseSandbox();
    for (const f of ['magazynCodes.js', 'externalImport.js', 'externalExportTemplate.js']) {
        vm.runInContext(fs.readFileSync(path.join(JS_IE, f), 'utf8'), sb, { filename: f });
    }
    return sb;
}

function mkWell(over: any = {}) {
    return {
        id: 'well-mag',
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
        przejscia: [],
        config: [],
        uszczelka: 'brak',
        kineta: 'beton',
        psiaBuda: false,
        ...over
    };
}

describe('resolveWellMagazyn / partForProduct', () => {
    const sb = loadRulesCtx();

    test('fallback: brak pól → Kluczbork', () => {
        expect(sb.resolveWellMagazyn(null)).toBe('Kluczbork');
        expect(sb.resolveWellMagazyn({})).toBe('Kluczbork');
        expect(sb.resolveWellMagazyn({}, 'dennica')).toBe('Kluczbork');
    });

    test('legacy magazyn działa dla obu części', () => {
        const w = { magazyn: 'Włocławek' };
        expect(sb.resolveWellMagazyn(w)).toBe('Włocławek');
        expect(sb.resolveWellMagazyn(w, 'dennica')).toBe('Włocławek');
        expect(sb.resolveWellMagazyn(w, 'nadbudowa')).toBe('Włocławek');
    });

    test('split wygrywa z legacy, legacy nietknięty', () => {
        const w = {
            magazyn: 'Kluczbork',
            magazynDennica: 'Włocławek',
            magazynNadbudowa: 'Kluczbork'
        };
        expect(sb.resolveWellMagazyn(w, 'dennica')).toBe('Włocławek');
        expect(sb.resolveWellMagazyn(w, 'nadbudowa')).toBe('Kluczbork');
        expect(sb.resolveWellMagazyn(w)).toBe('Kluczbork');
        expect(w.magazyn).toBe('Kluczbork');
    });

    test('partForProduct: szeroki zbiór spodu (z kinetą)', () => {
        expect(sb.partForProduct({ componentType: 'dennica' })).toBe('dennica');
        expect(sb.partForProduct({ componentType: 'kineta' })).toBe('dennica');
        expect(sb.partForProduct({ componentType: 'styczna' })).toBe('dennica');
        expect(sb.partForProduct({ componentType: 'krag' })).toBe('nadbudowa');
        expect(sb.partForProduct({ componentType: 'krag_ot' })).toBe('nadbudowa');
        expect(sb.partForProduct({ componentType: 'konus' })).toBe('nadbudowa');
        expect(sb.partForProduct({ componentType: 'wlaz' })).toBe('nadbudowa');
    });
});

describe('pule magazynowe per part', () => {
    const sb = loadRulesCtx();
    sb.window.studnieProducts = [
        { id: 'DEN-WL', componentType: 'dennica', magazynWL: 1, magazynKLB: 0 },
        { id: 'DEN-KLB', componentType: 'dennica', magazynWL: 0, magazynKLB: 1 },
        { id: 'KIN-WL', componentType: 'kineta', magazynWL: 1, magazynKLB: 0 },
        { id: 'KR-WL', componentType: 'krag', magazynWL: 1, magazynKLB: 0 },
        { id: 'KR-KLB', componentType: 'krag', magazynWL: 0, magazynKLB: 1 },
        { id: 'KR-BOTH', componentType: 'krag', magazynWL: 1, magazynKLB: 1 }
    ];
    const ids = (arr: any[]) => arr.map((p: any) => p.id).sort();
    const w = {
        magazyn: 'Kluczbork',
        magazynDennica: 'Włocławek',
        magazynNadbudowa: 'Kluczbork'
    };

    test('part wybiera MAGAZYN (dennica WL, nadbudowa KLB)', () => {
        // Pula = dostępność w danym magazynie; podział po TYPACH robi consumer
        // (solver: isDenPart, eksport: _partForComp) — deterministycznie.
        expect(ids(sb.getAvailableProducts(w, 'dennica'))).toEqual([
            'DEN-WL',
            'KIN-WL',
            'KR-BOTH',
            'KR-WL'
        ]);
        expect(ids(sb.getAvailableProducts(w, 'nadbudowa'))).toEqual([
            'DEN-KLB',
            'KR-BOTH',
            'KR-KLB'
        ]);
    });

    test('bez part: legacy pool (kompatybilność wsteczna)', () => {
        expect(ids(sb.getAvailableProducts(w))).toEqual(['DEN-KLB', 'KR-BOTH', 'KR-KLB']);
    });

    test('unia bez duplikatów i z pokryciem obu pul', () => {
        const union = sb.getAvailableProductsUnion(w);
        expect(ids(union)).toEqual(['DEN-KLB', 'DEN-WL', 'KIN-WL', 'KR-BOTH', 'KR-KLB', 'KR-WL']);
        const same = { magazyn: 'Kluczbork' };
        expect(sb.getAvailableProductsUnion(same).length).toBe(
            sb.getAvailableProducts(same).length
        );
    });
});

describe('MagazynCodes helper', () => {
    const sb = loadIeCtx();

    test('domyślne WL/M0 i fallback Kluczbork', () => {
        const MC = sb.MagazynCodes;
        expect(MC.codeForPart('dennica', 'Włocławek')).toBe('WL');
        expect(MC.codeForPart('nadbudowa', 'Kluczbork')).toBe('M0');
        expect(MC.warehouseForCode('WL', 'dennica')).toBe('Włocławek');
        expect(MC.warehouseForCode('M0', 'nadbudowa')).toBe('Kluczbork');
        expect(MC.warehouseForCode('XX', 'dennica')).toBe('Kluczbork');
        expect(MC.warehouseForCode('', 'nadbudowa')).toBe('Kluczbork');
        expect(MC.warehouseForCode(null, 'dennica')).toBe('Kluczbork');
    });

    test('własne kody z settings działają per część', async () => {
        const MC = sb.MagazynCodes;
        MC.clear();
        sb.fetch = async () => ({
            ok: true,
            json: async () => ({
                dennicaWl: 'W1',
                dennicaKlb: 'K1',
                nadbudowaWl: 'W2',
                nadbudowaKlb: 'K2'
            })
        });
        const codes = await MC.get();
        expect(MC.codeForPart('dennica', 'Włocławek', codes)).toBe('W1');
        expect(MC.codeForPart('nadbudowa', 'Włocławek', codes)).toBe('W2');
        expect(MC.warehouseForCode('W1', 'dennica', codes)).toBe('Włocławek');
        // Kod dennicy pod częścią nadbudowy nie pasuje → Kluczbork.
        expect(MC.warehouseForCode('W1', 'nadbudowa', codes)).toBe('Kluczbork');
        expect(MC.warehouseForCode('K2', 'nadbudowa', codes)).toBe('Kluczbork');
    });
});

describe('eksport per wiersz', () => {
    const sb = loadIeCtx();
    const catalog = [
        { id: 'DEN-1', componentType: 'dennica', price: 100, dn: 1000, height: 500 },
        { id: 'KR-1', componentType: 'krag', price: 50, dn: 1000, height: 500 }
    ];
    sb.StudnieExternalExportTemplate._productMap = new Map(catalog.map((p) => [p.id, p]));

    test('dennica WL, nadbudowa M0 w jednej studni', () => {
        const data = {
            wells: [
                {
                    name: 'S1',
                    dn: 1000,
                    rzednaWlazu: 3,
                    rzednaDna: 0,
                    magazyn: 'Kluczbork',
                    magazynDennica: 'Włocławek',
                    magazynNadbudowa: 'Kluczbork',
                    config: [
                        { productId: 'DEN-1', quantity: 1 },
                        { productId: 'KR-1', quantity: 2 }
                    ]
                }
            ]
        };
        const rows = sb.StudnieExternalExportTemplate._wellRows(data, 'OF/1', null);
        expect(rows).toHaveLength(2);
        expect(rows[0].MAGAZYN).toBe('WL');
        expect(rows[1].MAGAZYN).toBe('M0');
    });

    test('legacy studnia (tylko magazyn) jak dawniej', () => {
        const data = {
            wells: [
                {
                    name: 'S1',
                    dn: 1000,
                    rzednaWlazu: 3,
                    rzednaDna: 0,
                    magazyn: 'Włocławek',
                    config: [{ productId: 'KR-1', quantity: 1 }]
                }
            ]
        };
        const rows = sb.StudnieExternalExportTemplate._wellRows(data, 'OF/1', null);
        expect(rows[0].MAGAZYN).toBe('WL');
    });
});

describe('import _groupRows', () => {
    const sb = loadIeCtx();
    const typeMap = new Map([
        ['DEN-1', 'dennica'],
        ['KR-1', 'krag']
    ]);
    const row = (indeks: string, mag: string) => ({
        NR_STUDNI: 'S1',
        SREDNICA: 'X1000',
        GLEBOKOSC: '3',
        INDEKS_CZESCI: indeks,
        ILOSC: '1',
        CENA_JEDNOSTKOWA: '10',
        WERSJA: '1',
        RABAT: '',
        MAGAZYN: mag,
        LP: '1'
    });

    test('split WL/M0 → magazynDennica WL, magazynNadbudowa KLB, legacy = KLB', () => {
        const wells = sb.StudnieExternalImport._groupRows(
            [row('DEN-1', 'WL'), row('KR-1', 'M0')],
            null,
            typeMap
        );
        expect(wells).toHaveLength(1);
        expect(wells[0].magazynDennica).toBe('Włocławek');
        expect(wells[0].magazynNadbudowa).toBe('Kluczbork');
        expect(wells[0].magazyn).toBe('Kluczbork');
    });

    test('nieznany produkt: tylko legacy, części nietknięte', () => {
        const wells = sb.StudnieExternalImport._groupRows([row('XXX-9', 'WL')], null, typeMap);
        expect(wells[0].magazyn).toBe('Włocławek');
        expect(wells[0].magazynDennica).toBe('Włocławek');
        expect(wells[0].magazynNadbudowa).toBe('Włocławek');
    });

    test('nieznany kod → Kluczbork', () => {
        const wells = sb.StudnieExternalImport._groupRows(
            [row('DEN-1', 'QQ'), row('KR-1', '')],
            null,
            typeMap
        );
        expect(wells[0].magazynDennica).toBe('Kluczbork');
        expect(wells[0].magazynNadbudowa).toBe('Kluczbork');
    });
});

describe('solver: izolacja pul dennica/nadbudowa', () => {
    const catalog = loadCatalog();
    const sb = loadSolverCtx(catalog);
    const typeOf = (id: string) => {
        const p = catalog.find((x: any) => x.id === id);
        return p ? p.componentType : '?';
    };
    const splitCfg = (config: any[]) => {
        const den: string[] = [];
        const nad: string[] = [];
        for (const it of config || []) {
            const t = typeOf(it.productId);
            if (t === 'dennica' || t === 'kineta' || t === 'styczna') den.push(it.productId);
            else nad.push(it.productId);
        }
        return { den: den.sort(), nad: nad.sort() };
    };
    async function solve(over: any) {
        const w = mkWell(over);
        const avail = sb
            .getAvailableProductsUnion(w)
            .filter((p: any) => sb.filterByWellParams(p, w));
        const requiredMm = Math.round((w.rzednaWlazu - (w.rzednaDna || 0)) * 1000);
        const res = await sb.runJsAutoSelection(w, requiredMm, avail);
        if (res.error) throw new Error('solver error: ' + res.error);
        return splitCfg(res.config);
    }

    test('oba KLB = legacy KLB (kompatybilność)', async () => {
        const base = await solve({ magazyn: 'Kluczbork' });
        const split = await solve({
            magazyn: 'Kluczbork',
            magazynDennica: 'Kluczbork',
            magazynNadbudowa: 'Kluczbork'
        });
        expect(split).toEqual(base);
    });

    test('dennica WL: spód może się zmienić, nadbudowa identyczna', async () => {
        const base = await solve({ magazyn: 'Kluczbork' });
        const mixed = await solve({
            magazyn: 'Kluczbork',
            magazynDennica: 'Włocławek',
            magazynNadbudowa: 'Kluczbork'
        });
        expect(mixed.nad).toEqual(base.nad);
    });

    test('nadbudowa WL: nadbudowa może się zmienić, spód identyczny', async () => {
        const base = await solve({ magazyn: 'Kluczbork' });
        const mixed = await solve({
            magazyn: 'Kluczbork',
            magazynDennica: 'Kluczbork',
            magazynNadbudowa: 'Włocławek'
        });
        expect(mixed.den).toEqual(base.den);
    });

    test('pełny WL = legacy WL', async () => {
        const base = await solve({ magazyn: 'Włocławek' });
        const split = await solve({
            magazyn: 'Włocławek',
            magazynDennica: 'Włocławek',
            magazynNadbudowa: 'Włocławek'
        });
        expect(split).toEqual(base);
    });
});
