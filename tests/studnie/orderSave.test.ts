export {};

// === saveCurrentOrder — core computation logic ===

interface WellStats {
    price: number;
    weight: number;
    height: number;
}

interface Well {
    name: string;
    dn: number | string;
    config: unknown[];
    przejscia: unknown[];
    [key: string]: unknown;
}

interface WellsExportEntry {
    name: string;
    dn: number | string;
    height: number;
    weight: number;
    zwienczenie: string;
    price: number;
    transportCost: number;
    totalPrice: number;
    config: unknown[];
    przejscia: unknown[];
}

interface ComputeOrderDataInput {
    wells: Well[];
    calcWellStatsFn: (well: Well) => WellStats;
    transportKmVal: number;
    transportRateVal: number;
    currentTransportMode: string;
    offerTotalWeight?: number;
    calcTransportCountFn?: (weight: number, mode: string) => number;
    getWellZwienczenieNameFn?: (well: Well) => string;
    maxTransportWeight?: number;
}

interface ComputeOrderDataResult {
    totalNetto: number;
    totalWeight: number;
    totalTransportCost: number;
    orderTotal: number;
    totalBrutto: number;
    wellsExport: WellsExportEntry[];
}

function computeOrderData(input: ComputeOrderDataInput): ComputeOrderDataResult {
    const {
        wells,
        calcWellStatsFn,
        transportKmVal,
        transportRateVal,
        currentTransportMode,
        offerTotalWeight,
        calcTransportCountFn,
        getWellZwienczenieNameFn,
        maxTransportWeight
    } = input;

    let totalNetto = 0;
    let totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStatsFn(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0 && totalWeight > 0) {
        const oTW = offerTotalWeight || totalWeight;
        const fullOfferCost =
            (calcTransportCountFn
                ? calcTransportCountFn(oTW, currentTransportMode)
                : Math.ceil(oTW / (maxTransportWeight || 24000))) *
            transportKmVal *
            transportRateVal;
        totalTransportCostForOffer = oTW > 0 ? fullOfferCost * (totalWeight / oTW) : 0;
    }

    const orderTotal = totalNetto + totalTransportCostForOffer;

    const wellsExport = wells.map((well) => {
        const stats = calcWellStatsFn(well);
        const wellTransportCost =
            totalWeight > 0 ? totalTransportCostForOffer * (stats.weight / totalWeight) : 0;
        const zwienczenie = getWellZwienczenieNameFn ? getWellZwienczenieNameFn(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config: well.config,
            przejscia: well.przejscia
        };
    });

    return {
        totalNetto,
        totalWeight,
        totalTransportCost: totalTransportCostForOffer,
        orderTotal,
        totalBrutto: orderTotal * 1.23,
        wellsExport
    };
}

describe('computeOrderData — core saveCurrentOrder logic', () => {
    function calcWellStatsFn(well: Well): WellStats {
        if (well.name === 'W1') return { price: 5000, weight: 8000, height: 2000 };
        if (well.name === 'W2') return { price: 7000, weight: 10000, height: 2500 };
        return { price: 0, weight: 0, height: 0 };
    }

    it('sumuje totalNetto i totalWeight z welli', () => {
        const result = computeOrderData({
            wells: [{ name: 'W1', dn: 1000, config: [], przejscia: [] }],
            calcWellStatsFn,
            transportKmVal: 0,
            transportRateVal: 0,
            currentTransportMode: 'full'
        });
        expect(result.totalNetto).toBe(5000);
        expect(result.totalWeight).toBe(8000);
        expect(result.totalTransportCost).toBe(0);
    });

    it('oblicza totalBrutto = totalNetto × 1.23', () => {
        const result = computeOrderData({
            wells: [
                { name: 'W1', dn: 1000, config: [], przejscia: [] },
                { name: 'W2', dn: 1200, config: [], przejscia: [] }
            ],
            calcWellStatsFn,
            transportKmVal: 0,
            transportRateVal: 0,
            currentTransportMode: 'full'
        });
        expect(result.totalNetto).toBe(12000);
        expect(result.totalBrutto).toBeCloseTo(14760);
    });

    it('oblicza transport proporcjonalnie gdy km i rate > 0', () => {
        const result = computeOrderData({
            wells: [{ name: 'W1', dn: 1000, config: [], przejscia: [] }],
            calcWellStatsFn,
            transportKmVal: 100,
            transportRateVal: 5,
            currentTransportMode: 'full',
            calcTransportCountFn: (w: number) => Math.ceil(w / 24000),
            maxTransportWeight: 24000
        });
        // 1 trip × 100 km × 5 rate = 500
        expect(result.totalTransportCost).toBe(500);
        expect(result.orderTotal).toBe(5500);
    });

    it('buduje wellsExport z poprawnymi polami', () => {
        const result = computeOrderData({
            wells: [{ name: 'W1', dn: 1000, config: [], przejscia: [] }],
            calcWellStatsFn,
            transportKmVal: 0,
            transportRateVal: 0,
            currentTransportMode: 'full',
            getWellZwienczenieNameFn: () => 'ZwP-1'
        });
        expect(result.wellsExport).toHaveLength(1);
        expect(result.wellsExport[0].name).toBe('W1');
        expect(result.wellsExport[0].dn).toBe(1000);
        expect(result.wellsExport[0].price).toBe(5000);
        expect(result.wellsExport[0].zwienczenie).toBe('ZwP-1');
        expect(result.wellsExport[0].totalPrice).toBe(5000);
    });

    it('rozkłada transport proporcjonalnie na wellsExport', () => {
        const result = computeOrderData({
            wells: [
                { name: 'W1', dn: 1000, config: [], przejscia: [] },
                { name: 'W2', dn: 1200, config: [], przejscia: [] }
            ],
            calcWellStatsFn,
            transportKmVal: 100,
            transportRateVal: 5,
            currentTransportMode: 'full',
            calcTransportCountFn: (w: number) => Math.ceil(w / 24000),
            maxTransportWeight: 24000,
            getWellZwienczenieNameFn: () => 'ZwP-1'
        });
        // totalWeight = 18000, totalTransport = 500
        // W1: 8000/18000 × 500 = 222.22, W2: 10000/18000 × 500 = 277.78
        expect(result.wellsExport[0].transportCost).toBeCloseTo(222.22, 1);
        expect(result.wellsExport[1].transportCost).toBeCloseTo(277.78, 1);
    });

    it('pomija transport gdy km lub rate = 0', () => {
        const result = computeOrderData({
            wells: [{ name: 'W1', dn: 1000, config: [], przejscia: [] }],
            calcWellStatsFn,
            transportKmVal: 100,
            transportRateVal: 0,
            currentTransportMode: 'full'
        });
        expect(result.totalTransportCost).toBe(0);
    });

    it('pomija transport gdy totalWeight = 0', () => {
        const calcZeroStats = () => ({ price: 0, weight: 0, height: 0 });
        const result = computeOrderData({
            wells: [{ name: 'W1', dn: 1000, config: [], przejscia: [] }],
            calcWellStatsFn: calcZeroStats,
            transportKmVal: 100,
            transportRateVal: 5,
            currentTransportMode: 'full'
        });
        expect(result.totalTransportCost).toBe(0);
    });
});

// === createOrderFromOffer — guard clauses ===

type CreateOrderGuardInput = {
    orderEditMode: boolean;
    hasCheckboxes: boolean;
    selectedWellsCount: number;
    isSavingOffer: boolean;
    offerNumber: string | null;
    editingOfferId: string | null;
    offerFound: boolean;
    conflictingWells: boolean;
};

type GuardResult = {
    allowed: boolean;
    reason: string | null;
};

function checkCreateOrderGuards(input: CreateOrderGuardInput): GuardResult {
    if (input.orderEditMode) {
        return { allowed: false, reason: 'orderEditMode active' };
    }
    if (input.hasCheckboxes && input.selectedWellsCount === 0) {
        return { allowed: false, reason: 'no wells selected' };
    }
    if (input.isSavingOffer) {
        return { allowed: false, reason: 'offer saving in progress' };
    }
    if (!input.offerNumber) {
        return { allowed: false, reason: 'missing offer number' };
    }
    if (!input.editingOfferId) {
        return { allowed: false, reason: 'missing offer ID' };
    }
    if (!input.offerFound) {
        return { allowed: false, reason: 'offer not found' };
    }
    if (input.conflictingWells) {
        return { allowed: false, reason: 'conflicting wells exist' };
    }
    return { allowed: true, reason: null };
}

describe('checkCreateOrderGuards — createOrderFromOffer guard clauses', () => {
    const happyInput: CreateOrderGuardInput = {
        orderEditMode: false,
        hasCheckboxes: true,
        selectedWellsCount: 3,
        isSavingOffer: false,
        offerNumber: 'OF/2024/001',
        editingOfferId: 'off1',
        offerFound: true,
        conflictingWells: false
    };

    it('blokuje gdy orderEditMode aktywny', () => {
        const result = checkCreateOrderGuards({ ...happyInput, orderEditMode: true });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('orderEditMode active');
    });

    it('blokuje gdy brak zaznaczonych studni', () => {
        const result = checkCreateOrderGuards({ ...happyInput, selectedWellsCount: 0 });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('no wells selected');
    });

    it('blokuje gdy oferta jest zapisywana', () => {
        const result = checkCreateOrderGuards({ ...happyInput, isSavingOffer: true });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('offer saving in progress');
    });

    it('blokuje gdy brak numeru oferty', () => {
        const result = checkCreateOrderGuards({ ...happyInput, offerNumber: null });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('missing offer number');
    });

    it('blokuje gdy brak ID oferty', () => {
        const result = checkCreateOrderGuards({ ...happyInput, editingOfferId: null });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('missing offer ID');
    });

    it('blokuje gdy oferta nie znaleziona', () => {
        const result = checkCreateOrderGuards({ ...happyInput, offerFound: false });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('offer not found');
    });

    it('blokuje gdy studnie są już w innym zamówieniu', () => {
        const result = checkCreateOrderGuards({ ...happyInput, conflictingWells: true });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('conflicting wells exist');
    });

    it('przepuszcza gdy wszystkie warunki spełnione', () => {
        const result = checkCreateOrderGuards(happyInput);
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeNull();
    });

    it('przepuszcza bez checkboxów (autoselect wszystkich studni)', () => {
        const result = checkCreateOrderGuards({
            ...happyInput,
            hasCheckboxes: false,
            selectedWellsCount: 0
        });
        expect(result.allowed).toBe(true);
    });
});
