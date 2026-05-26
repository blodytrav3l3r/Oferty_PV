export {};
/* =============================================================
   Testy doboru dennicy — reguły 4-stopniowe
   =============================================================
   Dennica selection priority:
     1. Standard   → zapasDol + SAFETY && zapasGora + SAFETY
     2. Minimal    → zapasDolMin + SAFETY && zapasGoraMin + SAFETY
     3. Physical   → topClearance >= 0
     4. Fallback   → najwyższa dostępna
   ============================================================= */

interface MockProduct {
    id: string; name: string; componentType: string;
    dn: number | string; height: number;
    formaStandardowaKLB?: number; formaStandardowa?: number;
    zapasDol?: number; zapasGora?: number;
    zapasDolMin?: number; zapasGoraMin?: number;
    [key: string]: unknown;
}

interface Transition { productId: string; rzednaWlaczenia: number; flowType?: string; angle?: number; }

const SAFETY = 15;

function parseFloatSafe(v: unknown, f: number): number {
    if (v === undefined || v === null || v === '') return f;
    const p = Number(v); return isNaN(p) ? f : p;
}

function getClearanceFromProduct(prod: MockProduct) {
    return {
        zDol: parseFloatSafe(prod.zapasDol, 300), zGora: parseFloatSafe(prod.zapasGora, 300),
        zDolMin: parseFloatSafe(prod.zapasDolMin, 150), zGoraMin: parseFloatSafe(prod.zapasGoraMin, 150),
    };
}

function checkDennicaClearance(dHeight: number, transitions: Transition[], products: MockProduct[],
    rzDna: number, mode: 'standard' | 'minimal' | 'physical'): boolean {
    for (const pr of transitions) {
        const hcInvert = (pr.rzednaWlaczenia - rzDna) * 1000;
        if (isNaN(hcInvert) || hcInvert >= dHeight) continue;
        const pprod = products.find(x => x.id === pr.productId);
        if (!pprod) continue;
        let dnVal = 160;
        if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
            dnVal = parseFloatSafe(pprod.dn.split('/')[1], 160);
        else dnVal = parseFloatSafe(pprod.dn, 160);
        const { zDol, zGora, zDolMin, zGoraMin } = getClearanceFromProduct(pprod);
        const isNearBottom = hcInvert <= 0;
        const effZDol = isNearBottom ? -9999 : zDol;
        const effZDolMin = isNearBottom ? -9999 : zDolMin;
        const botClr = hcInvert;
        const topClr = dHeight - (hcInvert + dnVal);
        if (mode === 'standard') {
            if (botClr < (effZDol + SAFETY) || topClr < (zGora + SAFETY)) return false;
        } else if (mode === 'minimal') {
            if (botClr < (effZDolMin + SAFETY) || topClr < (zGoraMin + SAFETY)) return false;
        } else if (mode === 'physical') {
            if (topClr < 0) return false;
        }
    }
    return true;
}

function selectLowestDennica(products: MockProduct[], dn: number | string, warehouse: string,
    transitions?: Transition[], rzDna?: number): MockProduct | null {
    const ff = warehouse.includes('oc') || warehouse.includes('Włoc') ? 'formaStandardowa' : 'formaStandardowaKLB';
    const dns = products.filter(p => p.componentType === 'dennica'
        && parseInt(String(p.dn)) === parseInt(String(dn)) && p.height > 0);
    if (dns.length === 0) return null;
    dns.sort((a, b) => {
        const hA = a.height || 0, hB = b.height || 0;
        if (hA !== hB) return hA - hB;
        return ((b[ff] as number) || 0) - ((a[ff] as number) || 0);
    });
    if (!transitions || transitions.length === 0) return dns[0];
    const rzd = rzDna ?? 0;
    for (const d of dns) { if (checkDennicaClearance(d.height, transitions, products, rzd, 'standard')) return d; }
    for (const d of dns) { if (checkDennicaClearance(d.height, transitions, products, rzd, 'minimal')) return d; }
    for (const d of dns) { if (checkDennicaClearance(d.height, transitions, products, rzd, 'physical')) return d; }
    return dns[dns.length - 1];
}

/* ========== FIXTURES ========== */
const DENNICE: MockProduct[] = [
    { id: 'D-1000-300', name: 'Dennica 300', componentType: 'dennica', dn: 1000, height: 300, formaStandardowaKLB: 1 },
    { id: 'D-1000-400', name: 'Dennica 400', componentType: 'dennica', dn: 1000, height: 400, formaStandardowaKLB: 1 },
    { id: 'D-1000-500', name: 'Dennica 500', componentType: 'dennica', dn: 1000, height: 500, formaStandardowaKLB: 1 },
    { id: 'D-1000-600', name: 'Dennica 600', componentType: 'dennica', dn: 1000, height: 600, formaStandardowaKLB: 1 },
];

const PRZ: MockProduct = {
    id: 'PRZ-160', name: 'Przejście 160', componentType: 'przejscie', dn: 160, height: 0,
    zapasDol: 300, zapasGora: 300, zapasDolMin: 150, zapasGoraMin: 150, formaStandardowaKLB: 1,
};

const PRZ0: MockProduct = {
    id: 'PRZ-0', name: 'Przejście 0', componentType: 'przejscie', dn: 160, height: 0,
    zapasDol: 0, zapasGora: 0, zapasDolMin: 0, zapasGoraMin: 0, formaStandardowaKLB: 1,
};

const ALL = [...DENNICE, PRZ, PRZ0];

/* ================= 1. Bez przejść ================= */
describe('selectLowestDennica — bez przejść', () => {
    it('zwraca najniższą dennicę (300mm)', () => {
        expect(selectLowestDennica(DENNICE, 1000, 'Kluczbork')!.id).toBe('D-1000-300');
    });

    it('brak dennic → null', () => {
        expect(selectLowestDennica([], 1000, 'Kluczbork')).toBeNull();
    });

    it('sortowanie: height rosnąco, formaStd malejąco', () => {
        const p: MockProduct[] = [
            { id: 'B', name: 'B', componentType: 'dennica', dn: 1000, height: 400, formaStandardowaKLB: 1 },
            { id: 'A', name: 'A', componentType: 'dennica', dn: 1000, height: 300, formaStandardowaKLB: 0 },
        ];
        expect(selectLowestDennica(p, 1000, 'Kluczbork')!.id).toBe('A');
    });

    it('DN1000 dla magazynu Włocławek używa formaStandardowa', () => {
        const p: MockProduct[] = [
            { id: 'D-1000-400', name: 'D', componentType: 'dennica', dn: 1000, height: 400, formaStandardowa: 1, formaStandardowaKLB: 0 },
        ];
        expect(selectLowestDennica(p, 1000, 'Włocławek')!.id).toBe('D-1000-400');
    });

    it('ignoruje dennice z height=0 lub height=null', () => {
        const p: MockProduct[] = [
            { id: 'D-1000-0', name: 'Zerowa', componentType: 'dennica', dn: 1000, height: 0, formaStandardowaKLB: 1 },
            { id: 'D-1000-300', name: 'D-300', componentType: 'dennica', dn: 1000, height: 300, formaStandardowaKLB: 1 },
        ];
        expect(selectLowestDennica(p, 1000, 'Kluczbork')!.id).toBe('D-1000-300');
    });
});

/* ================= 2. Rura przy dnie (hcInvert <= 0) ================= */
describe('selectLowestDennica — rura przy dnie (hcInvert=0)', () => {
    it('hcInvert=0 → bottom ignored → standard OK dla D-500', () => {
        // topClearance D-500: 500-(0+160)=340 >= 300+15=315 → OK
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0 }], 0);
        expect(d!.id).toBe('D-1000-500');
    });

    it('D-400: top=240 < 315 → std FAIL, ale minimal 240 >= 165 → OK → ale D-500 wygrywa bo std', () => {
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0 }], 0);
        expect(d!.id).toBe('D-1000-500');
    });

    it('zapas=0 w cenniku → effZDol=-9999 (ignorowany) → top OK', () => {
        const d = selectLowestDennica([...DENNICE, PRZ0], 1000, 'Kluczbork',
            [{ productId: 'PRZ-0', rzednaWlaczenia: 0 }], 0);
        // PRZ-0: zapasGora=0 → topClearance=340 >= 0+15=15 → OK dla D-500
        // Ale D-300: top=300-(0+0)=... wait PRZ-0 ma dn=160
        // D-300: top=300-(0+160)=140 >= 0+15=15 → OK → D-300!
        expect(d!.id).toBe('D-1000-300');
    });
});

/* ================= 3. Minimal OK (standard impossible with these fixtures) ================= */
describe('selectLowestDennica — minimal OK', () => {
    // Standard wymaga hcInvert>=315 i dHeight>=hcInvert+475 → żadna dennica nie spełnia
    // Minimal: hcInvert>=165 i dHeight>=hcInvert+325
    it('hcInvert=170 → D-500 minimal OK (500>=170+325=495)', () => {
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0.17 }], 0);
        expect(d!.id).toBe('D-1000-500');
    });

    it('hcInvert=200 → D-600 minimal OK (600>=200+325=525)', () => {
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0.2 }], 0);
        expect(d!.id).toBe('D-1000-600');
    });

    it('hcInvert=280 → D-500 minimal FAIL (500<280+325=605), D-600 minimal FAIL (600<280+325=605), D-500 physical OK', () => {
        // physical: D-500: 500-(280+160)=60 >=0 → OK
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0.28 }], 0);
        expect(d!.id).toBe('D-1000-500');
    });
});

/* ================= 4. Pipe above dennica (skipped) ================= */
describe('selectLowestDennica — rura powyżej dennicy', () => {
    // hcInvert >= dHeight → transition skipped → dennica considered valid
    it('hcInvert=350 → D-300 skipped (350>=300), D-300 wins as lowest valid', () => {
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0.35 }], 0);
        expect(d!.id).toBe('D-1000-300');
    });

    it('hcInvert=800 → wszystkie skipped → najniższa D-300', () => {
        expect(selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0.8 }], 0)!.id).toBe('D-1000-300');
    });

    it('hcInvert=480 → D-300 skipped (480>=300), D-300 wins as lowest', () => {
        // hcInvert >= dHeight → transition skipped → dennica valid in all modes
        // D-300: 480>=300 → skip → standard OK
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0.48 }], 0);
        expect(d!.id).toBe('D-1000-300');
    });

    it('hcInvert=530 → wszystkie skipped → najniższa D-300', () => {
        // 530 >= 300/400/500/600 → wszystkie skipped → najniższa D-300
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [{ productId: 'PRZ-160', rzednaWlaczenia: 0.53 }], 0);
        expect(d!.id).toBe('D-1000-300');
    });
});

/* ================= 5. Fallback ================= */
describe('selectLowestDennica — fallback', () => {
    it('wszystkie physical FAIL → fallback test (with custom large DN)', () => {
        // With DN400@250mm (inside all), all dennicas physical FAIL (top<0)
        const PRZ400: MockProduct = {
            id: 'PRZ-400', name: 'Przejście 400', componentType: 'przejscie', dn: 400, height: 0,
            zapasDol: 300, zapasGora: 300, zapasDolMin: 150, zapasGoraMin: 150, formaStandardowaKLB: 1,
        };
        // D-300: 250<300 → check. top=300-(250+400)=-350<0 → physical FAIL
        // D-400: 250<400 → check. top=400-(250+400)=-250<0 → physical FAIL
        // D-500: 250<500 → check. top=500-(250+400)=-150<0 → physical FAIL
        // D-600: 250<600 → check. top=600-(250+400)=-50<0 → physical FAIL
        // All fail → fallback: D-600
        const d = selectLowestDennica([...DENNICE, PRZ400], 1000, 'Kluczbork',
            [{ productId: 'PRZ-400', rzednaWlaczenia: 0.25 }], 0);
        expect(d!.id).toBe('D-1000-600');
    });
});

/* ================= 6. Custom clearance values ================= */
describe('selectLowestDennica — niestandardowe zapasy', () => {
    it('zapas=0 w cenniku → effZDol=-9999 przy dnie, top liczony z 0', () => {
        const d = selectLowestDennica([...DENNICE, PRZ0], 1000, 'Kluczbork',
            [{ productId: 'PRZ-0', rzednaWlaczenia: 0 }], 0);
        // nearBottom → effZDol=-9999, effZDolMin=-9999
        // PRZ-0: zGora=0, SAFETY=15
        // D-300: top=300-(0+160)=140 >= 0+15=15 → standard OK → D-300
        expect(d!.id).toBe('D-1000-300');
    });

    it('zapas=0, hcInvert=200 → bottom=200>=0+15=15 OK, top=600-(200+160)=240>=15 → standard OK', () => {
        const d = selectLowestDennica([...DENNICE, PRZ0], 1000, 'Kluczbork',
            [{ productId: 'PRZ-0', rzednaWlaczenia: 0.2 }], 0);
        // D-300: 200<300 → check. top=300-(200+160)=-60 < 15→ FAIL
        // D-400: 200<400 → check. top=400-(200+160)=40 >= 15 → standard OK → D-400!
        expect(d!.id).toBe('D-1000-400');
    });

    it('custom 100/50, hcInvert=100 → D-400 standard OK (top=140>=115)', () => {
        const customPrz: MockProduct = {
            id: 'PRZ-CUSTOM', name: 'Custom', componentType: 'przejscie', dn: 160, height: 0,
            zapasDol: 100, zapasGora: 100, zapasDolMin: 50, zapasGoraMin: 50, formaStandardowaKLB: 1,
        };
        const d = selectLowestDennica([...DENNICE, customPrz], 1000, 'Kluczbork',
            [{ productId: 'PRZ-CUSTOM', rzednaWlaczenia: 0.1 }], 0);
        // D-300: top=300-(100+160)=40 < 115 → FAIL
        // D-400: top=400-(100+160)=140 >= 115 → standard OK → D-400
        expect(d!.id).toBe('D-1000-400');
    });
});

/* ================= 7. Wiele przejść ================= */
describe('selectLowestDennica — wiele przejść', () => {
    it('dwa przejścia — oba w dennicy, wyższe determinuje', () => {
        // PRZ-160@100mm i PRZ-160@280mm
        // D-500: 280<500, check: top=500-(280+160)=60 >=0 → physical OK, 100mm: top=340>=315 → standard OK
        // Łącznie: 100mm OK, 280mm OK (physical)
        // D-600: 280<600, check: top=600-(280+160)=160 <315 → standard FAIL
        // 280mm: bottom=280 < 315 → standard FAIL. minimal: top=160 <165 → FAIL
        // physical: 160 >=0 → OK
        // D-500 physical OK → D-500
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [
            { productId: 'PRZ-160', rzednaWlaczenia: 0.1 },
            { productId: 'PRZ-160', rzednaWlaczenia: 0.28 },
        ], 0);
        expect(d!.id).toBe('D-1000-500');
    });

    it('jedno w dennicy, drugie powyżej — tylko to w dennicy wpływa', () => {
        // PRZ-160@100mm (w dennicy), PRZ-160@900mm (above all → skipped)
        // D-300: 100mm: bottom=100<315→FAIL std, bottom=100<165→FAIL min, top=40>=0→physical OK
        // D-400: top=140>=0→physical OK. D-300 passes physical first → D-300
        const d = selectLowestDennica(ALL, 1000, 'Kluczbork', [
            { productId: 'PRZ-160', rzednaWlaczenia: 0.1 },
            { productId: 'PRZ-160', rzednaWlaczenia: 0.9 },
        ], 0);
        expect(d!.id).toBe('D-1000-300');
    });
});

/* ================= 6. Duże DN (1200, 1500) ================= */
describe('selectLowestDennica — różne DN', () => {
    const DN1500_DENNICE: MockProduct[] = [
        { id: 'D-1500-500', name: 'Dennica 1500 500', componentType: 'dennica', dn: 1500, height: 500, formaStandardowaKLB: 1 },
        { id: 'D-1500-600', name: 'Dennica 1500 600', componentType: 'dennica', dn: 1500, height: 600, formaStandardowaKLB: 1 },
    ];
    const PRZ_200: MockProduct = {
        id: 'PRZ-200', name: 'Przejście 200', componentType: 'przejscie', dn: 200, height: 0,
        zapasDol: 300, zapasGora: 300, zapasDolMin: 150, zapasGoraMin: 150, formaStandardowaKLB: 1,
    };

    it('DN1500 bez przejść → najniższa 500mm', () => {
        expect(selectLowestDennica(DN1500_DENNICE, 1500, 'Kluczbork')!.id).toBe('D-1500-500');
    });

    it('DN1500 z przejściem → standard OK', () => {
        // DN200@100mm, D-500: top=500-(100+200)=200 < 315? N → min OK
        const d = selectLowestDennica([...DN1500_DENNICE, PRZ_200], 1500, 'Kluczbork',
            [{ productId: 'PRZ-200', rzednaWlaczenia: 0.1 }], 0);
        expect(d!.id).toBe('D-1500-500');
    });
});
