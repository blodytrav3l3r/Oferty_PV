/**
 * Test parytetu cech train/serve (Faza 2).
 *
 * Weryfikuje, że frontend (public/js/studnie/mlDualRanking.js buildFeatureVector)
 * i backend (src/services/ml/TrainingPipeline.ts oneHotEncode) produkują
 * IDENTYCZNY 29-wymiarowy wektor cech (v7) dla tej samej konfiguracji studni.
 *
 * Jeśli jedna strona zmieni kolejność/semantykę cech, model trenowany na
 * wektorach backendu będzie dostawał na serve zupełnie inne bity — test łapie
 * to przed wdrożeniem. Tło: FEATURE_NAMES (29 cech) + FEATURE_VERSION 'v7'
 * + guard FEATURE_VERSION_MISMATCH na endpointach.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { describe, expect, it, beforeAll } from '@jest/globals';

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {}
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

import { oneHotEncode, seasonToNum } from '../../src/services/ml/TrainingPipeline';

const FEATURE_VERSION = 'v7';
const FEATURE_COUNT = 29;

function makeProduct(
    id: string,
    price: number,
    weight: number,
    componentType: string,
    dn: string,
    height: number
): any {
    return {
        id,
        name: 'Produkt ' + id,
        price,
        weight,
        componentType,
        dn,
        height
    };
}

const PRODUCTS = [
    makeProduct('KDB-1000-500', 100, 50, 'krag', '1000', 500),
    makeProduct('KDZ-1000-500', 120, 60, 'krag_ot', '1000', 500),
    makeProduct('DDD-1000-500', 200, 100, 'dennica', '1000', 500),
    makeProduct('Uszczelka GSG DN1000', 10, 2, 'uszczelka', '1000', 0)
];
// Przejścia szczelne (PVC-SN8 / X-Stream) — idą w cechy v7 (średnica + rzędna).
PRODUCTS.push(
    makeProduct('PVC-SN8-300', 80, 5, 'przejscie', '300', 0),
    makeProduct('PVC-SN8-630', 120, 8, 'przejscie', '630', 0),
    makeProduct('X-Stream-600', 200, 20, 'przejscie', '600', 0),
    makeProduct('X-Stream-200', 90, 6, 'przejscie', '200', 0)
);

// Frontend szuka uszczelki po NAZWIE (gasketNameForDn), nie po ID.
PRODUCTS[3].name = 'Uszczelka GSG DN1000';

function makeLayout(): any {
    return {
        kregItems: [
            { productId: 'KDB-1000-500', quantity: 1 },
            { productId: 'KDZ-1000-500', quantity: 1 },
            { productId: 'KDB-1000-500', quantity: 1 }
        ],
        topItems: [],
        avrItems: [],
        dennica: { productId: 'DDD-1000-500', quantity: 1 }
    };
}

function makeWell(overrides: any = {}): any {
    return {
        dn: '1000',
        wellHeight: 2000,
        magazyn: 'Kluczbork',
        type: 'standard',
        uszczelka: 'brak',
        kineta: '',
        rzednaDna: 0,
        przejscia: [],
        ...overrides
    };
}

// Bieżący sezon w formie stringu (backend przechowuje string, frontend liczy
// numer z bieżącej daty). Oba końce liczą z "teraz", więc muszą się zgadzać.
function currentSeasonString(): string {
    const seasonNum = seasonFromMonth(new Date().getMonth() + 1);
    return ['spring', 'summer', 'autumn', 'winter'][seasonNum];
}

function seasonFromMonth(m: number): number {
    if (m >= 3 && m <= 5) return 0;
    if (m >= 6 && m <= 8) return 1;
    if (m >= 9 && m <= 11) return 2;
    return 3;
}

function loadFrontendModule() {
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/mlDualRanking.js'),
        'utf8'
    );
    const sandbox: any = {
        window: {
            location: { search: '' },
            localStorage: { getItem: () => null }
        },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        console: { warn: () => {}, log: () => {} },
        fetch: null as any,
        AbortController,
        setTimeout,
        clearTimeout,
        setInterval: () => 0,
        Map,
        Set,
        Math,
        Date,
        JSON
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

// Entropia Shannona znormalizowana (identyczny wzór jak FeatureExtractor.ts
// i mlDualRanking.js shannonEntropy) — nad unikalnymi ID kregów w kregItems.
function shannonEntropy(items: string[]): number {
    if (!items || items.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const item of items) {
        counts.set(item, (counts.get(item) || 0) + 1);
    }
    let entropy = 0;
    const total = items.length;
    for (const count of counts.values()) {
        const p = count / total;
        entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(counts.size);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

// Buduje backendowy raw (odpowiednik FeatureExtractor.extract) dla danej
// konfiguracji — pola zgodne z oneHotEncode. totalPrice/totalWeight/ringVariety
// liczone tym samym wzorem co frontend (z katalogu produktów).
function buildBackendRaw(layout: any, well: any, products: any[]) {
    const dn = parseInt(well.dn) || 0;
    const allRingIds = (Array.isArray(layout.kregItems) ? layout.kregItems : [])
        .map((ki: any) => ki.productId)
        .filter((id: string) => /^KDB-|^KDZ-/i.test(id));
    const ringCount = allRingIds.length;
    // Frontend liczy ringVariety z UNIKALNYCH ID kregow (ringUniqueIds) — tak samo
    // backend FeatureExtractor (shannonEntropy nad unikalnymi ID kregow).
    const uniqueRingIds = [...new Set(allRingIds)];
    const ringVariety = shannonEntropy(uniqueRingIds as string[]);

    let totalPrice = 0;
    let totalWeight = 0;
    const itemLists = [
        ...(Array.isArray(layout.kregItems) ? layout.kregItems : []),
        ...(Array.isArray(layout.topItems) ? layout.topItems : []),
        ...(Array.isArray(layout.avrItems) ? layout.avrItems : []),
        ...(layout.dennica ? [layout.dennica] : [])
    ];
    for (const it of itemLists) {
        if (!it || !it.productId) continue;
        const prod = products.find((p) => p.id === it.productId);
        if (prod) {
            totalPrice += (parseFloat(prod.price) || 0) * (it.quantity || 1);
            totalWeight += (parseFloat(prod.weight) || 0) * (it.quantity || 1);
        }
    }

    const gasketsEnabled = !!(well.uszczelka && well.uszczelka !== 'brak');
    const sealDns = new Set<string>();
    if (gasketsEnabled) {
        for (const ki of itemLists) {
            if (!ki || !ki.productId) continue;
            const prod = products.find((p) => p.id === ki.productId);
            if (!prod || !prod.dn) continue;
            const type = String(prod.componentType || '').toLowerCase();
            if (
                type === 'krag' ||
                type === 'krag_ot' ||
                type === 'plyta_din' ||
                type === 'plyta_redukcyjna' ||
                type === 'konus'
            ) {
                sealDns.add(String(prod.dn));
            }
        }
        // Dodaj koszt uszczelek tak jak frontend (GAP D) — nazwa jak w recalcGaskets.
        const gasketName = 'Uszczelka GSG DN' + (sealDns.size ? [...sealDns][0] : '');
        const gasketProd = products.find(
            (p) => p.componentType === 'uszczelka' && p.name === gasketName
        );
        if (gasketProd) {
            const qty = itemLists
                .filter((ki: any) => ki && ki.productId && /^KDB-|^KDZ-/i.test(ki.productId))
                .reduce((acc: number, ki: any) => acc + (ki.quantity || 1), 0);
            totalPrice += (parseFloat(gasketProd.price) || 0) * qty;
            totalWeight += (parseFloat(gasketProd.weight) || 0) * qty;
        }
    }
    const connectionCount = sealDns.size;

    // Cechy przejść (v7) — identycznie jak serve (mlDualRanking.js buildFeatureVector):
    // średnica maksymalna przejścia + min/max/śr podniesienie ponad rzednaDna.
    const transHeights: number[] = [];
    let transMaxDn = 0;
    for (const tp of well.przejscia || []) {
        const prod = products.find((p) => p.id === tp.productId);
        if (prod && prod.dn != null) {
            const dn = parseInt(String(prod.dn), 10) || 0;
            if (dn > 0) transMaxDn = Math.max(transMaxDn, dn);
        }
        const hRaw = (parseFloat(tp.rzednaWlaczenia) - parseFloat(well.rzednaDna)) * 1000;
        if (Number.isFinite(hRaw)) transHeights.push(Math.round(hRaw));
    }
    const transMinH = transHeights.length ? Math.min.apply(null, transHeights) : 0;
    const transMaxH = transHeights.length ? Math.max.apply(null, transHeights) : 0;
    const transAvgH = transHeights.length
        ? Math.round(transHeights.reduce((a, b) => a + b, 0) / transHeights.length)
        : 0;

    const wellType = (well.type || 'standard').toLowerCase();
    return {
        dn,
        heightMm: parseInt(well.wellHeight) || 0,
        warehouse: well.magazyn || 'Kluczbork',
        wellType,
        hasReduction: !!well.redukcjaDN1000,
        hasPsiaBuda: wellType === 'psia_buda',
        hasStyczna: wellType === 'styczna' || wellType === 'styczna_1200',
        ringCount,
        connectionCount,
        transitionsAboveDennica: Math.max(0, connectionCount - 1),
        totalPrice,
        totalWeight,
        ringVariety,
        season: currentSeasonString(),
        bottomType: layout.dennica ? layout.dennica.productId : 'unknown',
        topType: 'unknown',
        kinetaType: well.kineta || '',
        dennicaHeight: layout.dennica ? 500 : 0,
        transitionCount: (well.przejscia || []).length,
        maxTransitionDnMm: transMaxDn,
        minTransitionHeightMm: transMinH,
        maxTransitionHeightMm: transMaxH,
        avgTransitionHeightMm: transAvgH
    };
}

describe('parytet cech train/serve (buildFeatureVector vs oneHotEncode)', () => {
    let buildFeatureVector: any;

    beforeAll(() => {
        const sandbox = loadFrontendModule();
        sandbox.window.studnieProducts = PRODUCTS;
        buildFeatureVector = sandbox.window.buildFeatureVector;
        expect(typeof buildFeatureVector).toBe('function');
    });

    it(
        'stały wymiar: frontend i backend produkują 29 cech (FEATURE_VERSION ' +
            FEATURE_VERSION +
            ')',
        () => {
            const front = buildFeatureVector(makeLayout(), makeWell());
            const back = oneHotEncode(buildBackendRaw(makeLayout(), makeWell(), PRODUCTS) as any);
            expect(front).toHaveLength(FEATURE_COUNT);
            expect(back).toHaveLength(FEATURE_COUNT);
        }
    );

    it('standardowa studnia (Kluczbork, bez uszczelek): wektory identyczne', () => {
        const layout = makeLayout();
        const well = makeWell();
        const front = buildFeatureVector(layout, well);
        const back = oneHotEncode(buildBackendRaw(layout, well, PRODUCTS) as any);

        expect(front).toEqual(back);
        // sanity: kluczowe bity one-hot
        expect(front[0]).toBe(1000); // dn
        expect(front[2]).toBe(1); // KLB
        expect(front[3]).toBe(0); // WL
        expect(front[4]).toBe(1); // standard
        expect(front[9]).toBe(3); // ringCount
        expect(front[10]).toBe(0); // connectionCount (brak uszczelek)
        expect(front[15]).toBe(seasonFromMonth(new Date().getMonth() + 1)); // season
        expect(front[16]).toBe(1); // hasKnownBottom (dennica obecna)
        expect(front[17]).toBe(0); // topHasKnown (brak konusa)
        expect(front[19]).toBe(1); // KLB && standard
        expect(front[22]).toBe(1); // kineta standard
        expect(front[23]).toBe(500); // dennicaHeight
    });

    it('studnia z uszczelkami GSG: connectionCount i cena z uszczelkami po obu stronach', () => {
        const layout = makeLayout();
        const well = makeWell({ uszczelka: 'GSG' });
        const front = buildFeatureVector(layout, well);
        const back = oneHotEncode(buildBackendRaw(layout, well, PRODUCTS) as any);

        expect(front).toEqual(back);
        // 3 kręgi na DN1000 → 1 unikalny DN nośnika → 1 uszczelka GSG (qty 3)
        expect(front[10]).toBe(1); // connectionCount
        expect(front[11]).toBe(0); // transitionsAboveDennica = max(0, 1-1)
        // cena: kręgi(100+120+100)+dennica(200)=520 + uszczelka 10*3=30 → 550
        expect(front[12]).toBe(550);
        // waga: (50+60+50)+100=260 + 2*3=6 → 266
        expect(front[13]).toBe(266);
    });

    it('psia buda: bit wellType i hasPsiaBuda zgadzają się po obu stronach', () => {
        const layout = makeLayout();
        const well = makeWell({ type: 'psia_buda', psiaBuda: true });
        const front = buildFeatureVector(layout, well);
        const back = oneHotEncode(buildBackendRaw(layout, well, PRODUCTS) as any);

        expect(front).toEqual(back);
        expect(front[5]).toBe(1); // psia_buda
        expect(front[8]).toBe(1); // hasPsiaBuda
        expect(front[4]).toBe(0); // nie standard
    });

    it('kineta preco: tylko bit preco ustawiony (semaantyka jeden-z-3)', () => {
        const layout = makeLayout();
        const well = makeWell({ kineta: 'preco' });
        const front = buildFeatureVector(layout, well);
        const back = oneHotEncode(buildBackendRaw(layout, well, PRODUCTS) as any);

        expect(front).toEqual(back);
        expect(front[20]).toBe(1); // preco
        expect(front[21]).toBe(0); // unolith
        expect(front[22]).toBe(0); // standard
    });

    it('magazyn Włocławek: bity warehouse po obu stronach', () => {
        const layout = makeLayout();
        const well = makeWell({ magazyn: 'Włocławek' });
        const front = buildFeatureVector(layout, well);
        const back = oneHotEncode(buildBackendRaw(layout, well, PRODUCTS) as any);

        expect(front).toEqual(back);
        expect(front[2]).toBe(0); // KLB
        expect(front[3]).toBe(1); // WL
        expect(front[19]).toBe(0); // KLB && standard → 0
    });

    it('seasonToNum: mapowanie string→numer spójne z getSeasonNum()', () => {
        const m = new Date().getMonth() + 1;
        const expectedNum = seasonFromMonth(m);
        const seasonStr = currentSeasonString();
        expect(seasonToNum(seasonStr)).toBe(expectedNum);
    });

    it('przejścia szczelne: średnica i podniesienie od dna zgodne po obu stronach', () => {
        const layout = makeLayout();
        const well = makeWell({
            rzednaDna: 1,
            przejscia: [
                { productId: 'X-Stream-600', rzednaWlaczenia: '1.000' },
                { productId: 'PVC-SN8-300', rzednaWlaczenia: '2.200' },
                { productId: 'PVC-SN8-630', rzednaWlaczenia: '1.000' },
                { productId: 'X-Stream-200', rzednaWlaczenia: '2.200' }
            ]
        });
        const front = buildFeatureVector(layout, well);
        const back = oneHotEncode(buildBackendRaw(layout, well, PRODUCTS) as any);
        expect(front).toEqual(back);
        expect(front[24]).toBe(4); // transitionCount
        expect(front[25]).toBe(630); // maxTransitionDnMm
        expect(front[26]).toBe(0); // minTransitionHeightMm (rzedna 1.0 == dno)
        expect(front[27]).toBe(1200); // maxTransitionHeightMm (2.2 - 1.0 = 1200mm)
        expect(front[28]).toBe(600); // avgTransitionHeightMm ((0+1200+0+1200)/4)
    });
});
