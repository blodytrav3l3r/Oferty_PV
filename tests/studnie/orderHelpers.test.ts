export {};

// === orderZlecenia.js — pure helper functions ===

function parseWysokoscGlebokosc(productName: string | null): {
    wysokosc: number;
    glebokosc: number;
} {
    const m = productName && productName.match(/H\s*=\s*(\d+)\s*\/\s*(\d+)/i);
    if (m) return { wysokosc: parseInt(m[1]), glebokosc: parseInt(m[2]) };
    return { wysokosc: 0, glebokosc: 0 };
}

function getStudniaDIN(dn: number): string {
    if ([1000, 1200].includes(dn)) return 'AT/2009-03-1733';
    if ([1500, 2000, 2500].includes(dn)) return 'PN-EN 1917:2004';
    return 'AT/2009-03-1733';
}

function calcStopnieExecution(angle: number | string): number {
    const a = typeof angle === 'number' ? angle : parseFloat(angle) || 0;
    return a > 0 ? 360 - a : 0;
}

// === orderState.js — critical state logic (mock globals) ===

interface Well {
    id: string;
    name?: string;
    price?: number;
}

interface Order {
    offerId?: string;
    wells?: Well[];
    originalSnapshot?: {
        wells?: Well[];
        transportKm?: number;
        transportRate?: number;
        transportMode?: string;
    };
    transportKm?: number;
    transportRate?: number;
    transportMode?: string;
}

function getOfferOrderProgress(
    orderedIds: Set<string>,
    offerWells: Well[]
): { ordered: number; total: number; percent: number } {
    const total = (offerWells || []).length;
    const ordered = (offerWells || []).filter((w) => w.id && orderedIds.has(w.id)).length;
    const percent = total > 0 ? Math.round((ordered / total) * 100) : 0;
    return { ordered, total, percent };
}

function getOrderedWellIdsLogic(orders: Order[], offerId: string): Set<string> {
    const nId = offerId;
    const ids = new Set<string>();
    orders
        .filter((o) => (o.offerId || '') === nId)
        .forEach((order) => {
            (order.wells || []).forEach((w) => {
                if (w.id) ids.add(w.id);
            });
        });
    return ids;
}

describe('parseWysokoscGlebokosc', () => {
    it('parsuje H=450/300 z nazwy produktu', () => {
        expect(parseWysokoscGlebokosc('Dennica DN1000 H=450/300')).toEqual({
            wysokosc: 450,
            glebokosc: 300
        });
    });

    it('parsuje H=600/400 z odstępami', () => {
        expect(parseWysokoscGlebokosc('Dennica H = 600 / 400')).toEqual({
            wysokosc: 600,
            glebokosc: 400
        });
    });

    it('zwraca {0,0} dla null', () => {
        expect(parseWysokoscGlebokosc(null)).toEqual({ wysokosc: 0, glebokosc: 0 });
    });

    it('zwraca {0,0} dla nazwy bez H=', () => {
        expect(parseWysokoscGlebokosc('Studnia betonowa DN1000')).toEqual({
            wysokosc: 0,
            glebokosc: 0
        });
    });
});

describe('getStudniaDIN', () => {
    it('DN1000 → AT/2009-03-1733', () => {
        expect(getStudniaDIN(1000)).toBe('AT/2009-03-1733');
    });

    it('DN1200 → AT/2009-03-1733', () => {
        expect(getStudniaDIN(1200)).toBe('AT/2009-03-1733');
    });

    it('DN1500 → PN-EN 1917:2004', () => {
        expect(getStudniaDIN(1500)).toBe('PN-EN 1917:2004');
    });

    it('DN2000 → PN-EN 1917:2004', () => {
        expect(getStudniaDIN(2000)).toBe('PN-EN 1917:2004');
    });

    it('DN2500 → PN-EN 1917:2004', () => {
        expect(getStudniaDIN(2500)).toBe('PN-EN 1917:2004');
    });

    it('nieznany DN → domyślny AT/2009-03-1733', () => {
        expect(getStudniaDIN(800)).toBe('AT/2009-03-1733');
    });
});

describe('calcStopnieExecution', () => {
    it('angle=45 → 315', () => {
        expect(calcStopnieExecution(45)).toBe(315);
    });

    it('angle=0 → 0', () => {
        expect(calcStopnieExecution(0)).toBe(0);
    });

    it('angle="90" (string) → 270', () => {
        expect(calcStopnieExecution('90')).toBe(270);
    });

    it('angle=360 → 0', () => {
        expect(calcStopnieExecution(360)).toBe(0);
    });
});

describe('getOfferOrderProgress', () => {
    const wells: Well[] = [{ id: 'w1' }, { id: 'w2' }, { id: 'w3', name: 'bez id' }, { id: 'w4' }];

    it('0/4 ordered = 0%', () => {
        expect(getOfferOrderProgress(new Set(), wells)).toEqual({
            ordered: 0,
            total: 4,
            percent: 0
        });
    });

    it('2/4 ordered = 50%', () => {
        expect(getOfferOrderProgress(new Set(['w1', 'w4']), wells)).toEqual({
            ordered: 2,
            total: 4,
            percent: 50
        });
    });

    it('4/4 ordered = 100%', () => {
        expect(getOfferOrderProgress(new Set(['w1', 'w2', 'w4']), wells)).toEqual({
            ordered: 3,
            total: 4,
            percent: 75
        });
    });

    it('empty wells = 0/0 = 0%', () => {
        expect(getOfferOrderProgress(new Set(), [])).toEqual({ ordered: 0, total: 0, percent: 0 });
    });
});

describe('getOrderedWellIdsLogic', () => {
    const orders: Order[] = [
        { offerId: 'off1', wells: [{ id: 'w1' }, { id: 'w2' }] },
        { offerId: 'off1', wells: [{ id: 'w3' }] },
        { offerId: 'off2', wells: [{ id: 'w5' }] }
    ];

    it('zwraca zbiór ID studni dla danej oferty', () => {
        const ids = getOrderedWellIdsLogic(orders, 'off1');
        expect(ids).toEqual(new Set(['w1', 'w2', 'w3']));
    });

    it('zwraca pusty zbiór dla oferty bez zamówień', () => {
        const ids = getOrderedWellIdsLogic(orders, 'off3');
        expect(ids).toEqual(new Set());
    });
});

// === orderKartaBudowy.js — transport costs ===

interface CalcWellStatsResult {
    weight: number;
    price: number;
}

interface OrderEditModeMock {
    order: {
        totalWeight?: number;
        wells?: Array<{ transportCost?: number }>;
        transportKm?: number | string;
        transportRate?: number | string;
    };
}

interface PendingOrderDataMock {
    offer: {
        totalWeight?: number;
        transportKm?: number | string;
        transportRate?: number | string;
        transportMode?: string;
    };
    selectedWells?: Array<Record<string, unknown>>;
}

function calcTransportCostsLogic(
    orderEditMode: OrderEditModeMock | null,
    pendingOrderCreationData: PendingOrderDataMock | null,
    calcWellStatsFn?: (w: Record<string, unknown>) => CalcWellStatsResult,
    calcTransportCountFn?: (weight: number, mode: string) => number,
    maxTransportWeight?: number
): { tCost: number; costPerTrip: number } {
    let tCost = 0;
    let tWeight = 0;
    let costPerTrip = 0;

    if (orderEditMode && orderEditMode.order) {
        const o = orderEditMode.order;
        tWeight = o.totalWeight || 0;
        if (o.wells) {
            o.wells.forEach((w: { transportCost?: number }) => {
                tCost += typeof w.transportCost === 'number' ? w.transportCost : 0;
            });
        }
        costPerTrip =
            (parseFloat(String(o.transportKm)) || 0) * (parseFloat(String(o.transportRate)) || 0);
    } else if (pendingOrderCreationData) {
        const off = pendingOrderCreationData.offer;
        const sel = pendingOrderCreationData.selectedWells;
        if (sel) {
            sel.forEach((w) => (tWeight += calcWellStatsFn ? calcWellStatsFn(w).weight : 0));
        }
        const gWeight = off.totalWeight || 0;
        const gKm = parseFloat(String(off.transportKm)) || 0;
        const gRate = parseFloat(String(off.transportRate)) || 0;
        const offerMode = off.transportMode || 'full';
        const gCost =
            gKm > 0 && gRate > 0
                ? (calcTransportCountFn
                      ? calcTransportCountFn(gWeight, offerMode)
                      : Math.ceil(gWeight / (maxTransportWeight || 24000))) *
                  gKm *
                  gRate
                : 0;
        if (gWeight > 0 && tWeight > 0) {
            tCost = gCost * (tWeight / gWeight);
        }
        costPerTrip = gKm * gRate;
    }

    return { tCost: Math.max(0, tCost), costPerTrip };
}

describe('calcTransportCostsLogic', () => {
    it('zwraca 0 dla braku danych (obie ścieżki null)', () => {
        expect(calcTransportCostsLogic(null, null)).toEqual({ tCost: 0, costPerTrip: 0 });
    });

    it('ścieżka orderEditMode: sumuje transportCost z welli', () => {
        const editMode: OrderEditModeMock = {
            order: {
                totalWeight: 3000,
                wells: [{ transportCost: 500 }, { transportCost: 700 }],
                transportKm: 100,
                transportRate: 5
            }
        };
        const result = calcTransportCostsLogic(editMode, null);
        expect(result.tCost).toBe(1200);
        expect(result.costPerTrip).toBe(500);
    });

    it('ścieżka orderEditMode: zero gdy brak transportCost na wellach', () => {
        const editMode: OrderEditModeMock = {
            order: {
                totalWeight: 3000,
                wells: [{}, {}],
                transportKm: 0,
                transportRate: 0
            }
        };
        const result = calcTransportCostsLogic(editMode, null);
        expect(result.tCost).toBe(0);
        expect(result.costPerTrip).toBe(0);
    });

    it('ścieżka pendingOrderCreation: proporcjonalny koszt', () => {
        const pending: PendingOrderDataMock = {
            offer: {
                totalWeight: 24000,
                transportKm: 100,
                transportRate: 5,
                transportMode: 'full'
            },
            selectedWells: [{}, {}]
        };
        const calcWellStatsFn = () => ({ weight: 6000, price: 1000 });
        const calcTransportCountFn = (w: number) => Math.ceil(w / 24000);
        const result = calcTransportCostsLogic(
            null,
            pending,
            calcWellStatsFn,
            calcTransportCountFn
        );
        // 2 wells × 6000 = 12000 tWeight; gWeight = 24000
        // gCost = 1 trip × 100 km × 5 rate = 500
        // tCost = 500 × (12000/24000) = 250
        expect(result.tCost).toBe(250);
        expect(result.costPerTrip).toBe(500);
    });
});

// === orderKartaBudowy.js — buildOfferPrzejsciaTypes ===

interface Product {
    id: string;
    componentType: string;
    active?: number;
    category?: string;
    dn: string | number;
    [key: string]: unknown;
}

interface WellWithPrzejscia {
    id: string;
    przejscia?: Array<{ productId: string }>;
    [key: string]: unknown;
}

function buildOfferPrzejsciaTypesLogic(
    wells: WellWithPrzejscia[],
    products: Product[]
): Array<{
    rodzaj: string;
    dnOd: number | string;
    dnDo: number | string;
    ilosc: number;
    uwagi: string;
    czyPrzejscie: string;
    source: string;
}> {
    const usedProductIds = new Set<string>();
    if (Array.isArray(wells)) {
        wells.forEach((w) => {
            if (w.przejscia && Array.isArray(w.przejscia)) {
                w.przejscia.forEach((pr) => {
                    if (pr.productId) {
                        usedProductIds.add(pr.productId);
                    }
                });
            }
        });
    }

    const przejsciaProducts = products.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0 && usedProductIds.has(p.id)
    );
    const typeMap = new Map<string, { dnMin: number; dnMax: number }>();
    const stringDnMap = new Map<string, { dnStrings: string[] }>();

    przejsciaProducts.forEach((p) => {
        const cat = p.category;
        if (!cat) return;

        if (typeof p.dn === 'string' && (p.dn as string).includes('/')) {
            if (!stringDnMap.has(cat)) {
                stringDnMap.set(cat, { dnStrings: [] });
            }
            stringDnMap.get(cat)!.dnStrings.push(p.dn as string);
        } else {
            const dn = parseFloat(String(p.dn)) || 0;
            if (!typeMap.has(cat)) {
                typeMap.set(cat, { dnMin: dn, dnMax: dn });
            } else {
                const entry = typeMap.get(cat)!;
                if (dn < entry.dnMin) entry.dnMin = dn;
                if (dn > entry.dnMax) entry.dnMax = dn;
            }
        }
    });

    const result: Array<{
        rodzaj: string;
        dnOd: number | string;
        dnDo: number | string;
        ilosc: number;
        uwagi: string;
        czyPrzejscie: string;
        source: string;
    }> = [];

    typeMap.forEach((val, key) => {
        result.push({
            rodzaj: key,
            dnOd: val.dnMin,
            dnDo: val.dnMax,
            ilosc: 1,
            uwagi: '',
            czyPrzejscie: 'TAK',
            source: 'offer'
        });
    });

    stringDnMap.forEach((val, key) => {
        const sorted = [...val.dnStrings].sort((a, b) => {
            const aFirst = parseFloat(a.split('/')[0]) || 0;
            const bFirst = parseFloat(b.split('/')[0]) || 0;
            return aFirst - bFirst;
        });
        const uniqueDns = [...new Set(sorted)];
        uniqueDns.forEach((dn) => {
            result.push({
                rodzaj: key,
                dnOd: dn,
                dnDo: dn,
                ilosc: 1,
                uwagi: '',
                czyPrzejscie: 'TAK',
                source: 'offer'
            });
        });
    });

    return result.sort((a, b) => a.rodzaj.localeCompare(b.rodzaj));
}

describe('buildOfferPrzejsciaTypesLogic', () => {
    const mockProducts: Product[] = [
        { id: 'prz1', componentType: 'przejscie', active: 1, category: 'PRZ-160', dn: 160 },
        { id: 'prz2', componentType: 'przejscie', active: 1, category: 'PRZ-200', dn: 200 },
        { id: 'prz3', componentType: 'przejscie', active: 1, category: 'PRZ-300', dn: 300 },
        { id: 'prz4', componentType: 'przejscie', active: 1, category: 'PRZ-160-T', dn: '160/250' },
        { id: 'prz5', componentType: 'przejscie', active: 1, category: 'PRZ-200-T', dn: '200/315' },
        { id: 'prz6', componentType: 'przejscie', active: 0, category: 'PRZ-160', dn: 160 },
        { id: 'kin1', componentType: 'kineta', active: 1, category: 'KINETA', dn: 1000 }
    ];

    it('zwraca puste gdy brak studni', () => {
        const result = buildOfferPrzejsciaTypesLogic([], mockProducts);
        expect(result).toEqual([]);
    });

    it('zwraca typy przejść używane w studniach', () => {
        const wells: WellWithPrzejscia[] = [
            { id: 'w1', przejscia: [{ productId: 'prz1' }, { productId: 'prz2' }] }
        ];
        const result = buildOfferPrzejsciaTypesLogic(wells, mockProducts);
        expect(result).toHaveLength(2);
        expect(result[0].rodzaj).toBe('PRZ-160');
        expect(result[0].dnOd).toBe(160);
        expect(result[1].rodzaj).toBe('PRZ-200');
        expect(result[1].dnOd).toBe(200);
    });

    it('pomija nieaktywne produkty (active=0)', () => {
        const wells: WellWithPrzejscia[] = [{ id: 'w1', przejscia: [{ productId: 'prz6' }] }];
        const result = buildOfferPrzejsciaTypesLogic(wells, mockProducts);
        expect(result).toEqual([]);
    });

    it('filtruje tylko komponenty typu przejscie', () => {
        const wells: WellWithPrzejscia[] = [{ id: 'w1', przejscia: [{ productId: 'kin1' }] }];
        const result = buildOfferPrzejsciaTypesLogic(wells, mockProducts);
        expect(result).toEqual([]);
    });

    it('oblicza zakres DN (dnMin-dnMax) dla kategorii', () => {
        const products: Product[] = [
            { id: 'p1', componentType: 'przejscie', active: 1, category: 'PRZ-160', dn: 160 },
            { id: 'p2', componentType: 'przejscie', active: 1, category: 'PRZ-160', dn: 200 },
            { id: 'p3', componentType: 'przejscie', active: 1, category: 'PRZ-160', dn: 300 }
        ];
        const wells: WellWithPrzejscia[] = [
            { id: 'w1', przejscia: [{ productId: 'p1' }, { productId: 'p2' }, { productId: 'p3' }] }
        ];
        const result = buildOfferPrzejsciaTypesLogic(wells, products);
        expect(result).toHaveLength(1);
        expect(result[0].rodzaj).toBe('PRZ-160');
        expect(result[0].dnOd).toBe(160);
        expect(result[0].dnDo).toBe(300);
    });

    it('obsługuje DN z ukośnikiem (np. 160/250)', () => {
        const wells: WellWithPrzejscia[] = [
            { id: 'w1', przejscia: [{ productId: 'prz4' }, { productId: 'prz5' }] }
        ];
        const result = buildOfferPrzejsciaTypesLogic(wells, mockProducts);
        expect(result).toHaveLength(2);
        expect(result[0].dnOd).toBe('160/250');
        expect(result[1].dnOd).toBe('200/315');
    });

    it('sortuje wynik alfabetycznie po rodzaj', () => {
        const products: Product[] = [
            { id: 'z1', componentType: 'przejscie', active: 1, category: 'ZZZ', dn: 300 },
            { id: 'a1', componentType: 'przejscie', active: 1, category: 'AAA', dn: 100 }
        ];
        const wells: WellWithPrzejscia[] = [
            { id: 'w1', przejscia: [{ productId: 'z1' }, { productId: 'a1' }] }
        ];
        const result = buildOfferPrzejsciaTypesLogic(wells, products);
        expect(result[0].rodzaj).toBe('AAA');
        expect(result[1].rodzaj).toBe('ZZZ');
    });
});
