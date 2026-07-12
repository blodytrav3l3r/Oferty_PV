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
