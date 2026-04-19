// Mock progress logic for unit testing
function getOfferOrderProgress(offerId: string, offerWells: any[], ordersStudnie: any[]) {
    const normalizeId = (id: string) => (id && id.includes(':') ? id.split(':').pop() : id);
    
    const nId = normalizeId(offerId);
    const relatedOrders = ordersStudnie.filter((o: any) => normalizeId(o.offerId) === nId);
    
    const orderedIds = new Set();
    relatedOrders.forEach((order) => {
        (order.wells || []).forEach((w: any) => {
            if (w.id) orderedIds.add(w.id);
        });
    });

    const total = (offerWells || []).length;
    const ordered = (offerWells || []).filter((w) => w.id && orderedIds.has(w.id)).length;
    const percent = total > 0 ? Math.round((ordered / total) * 100) : 0;
    return { ordered, total, percent };
}

describe('Offer Progress Calculation Logic', () => {
    const offerIdRaw = 'offer:studnie:123';
    const wells = [
        { id: 'w1', name: 'Well 1' },
        { id: 'w2', name: 'Well 2' },
        { id: 'w3', name: 'Well 3' },
        { id: 'w4', name: 'Well 4' },
    ];

    it('should show 0% progress when no orders exist', () => {
        const progress = getOfferOrderProgress(offerIdRaw, wells, []);
        expect(progress.ordered).toBe(0);
        expect(progress.percent).toBe(0);
    });

    it('should calculate 50% partial progress', () => {
        const orders = [
            { id: 'o1', offerId: '123', wells: [{ id: 'w1' }, { id: 'w2' }] }
        ];
        const progress = getOfferOrderProgress(offerIdRaw, wells, orders);
        expect(progress.ordered).toBe(2);
        expect(progress.percent).toBe(50);
    });

    it('should handle multi-order progress correctly', () => {
        const orders = [
            { id: 'o1', offerId: '123', wells: [{ id: 'w1' }] },
            { id: 'o2', offerId: '123', wells: [{ id: 'w3' }] }
        ];
        const progress = getOfferOrderProgress(offerIdRaw, wells, orders);
        expect(progress.ordered).toBe(2);
        expect(progress.total).toBe(4);
        expect(progress.percent).toBe(50);
    });

    it('should show 100% when all wells are ordered across multiple orders', () => {
        const orders = [
            { id: 'o1', offerId: '123', wells: [{ id: 'w1' }, { id: 'w2' }] },
            { id: 'o2', offerId: '123', wells: [{ id: 'w3' }, { id: 'w4' }] }
        ];
        const progress = getOfferOrderProgress(offerIdRaw, wells, orders);
        expect(progress.percent).toBe(100);
    });
});
