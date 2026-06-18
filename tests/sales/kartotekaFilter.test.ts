function offerMatchesSearch(offer: any, query: string, ordersMap: Map<string, any[]>): boolean {
    if (!query) return true;
    query = query.toLowerCase();

    const num = (offer.number || offer.title || offer.offerName || '').toLowerCase();
    const client = (
        offer.clientName ||
        (offer.data && offer.data.clientName) ||
        ''
    ).toLowerCase();
    const nip = (
        offer.clientNip ||
        (offer.data && offer.data.clientNip) ||
        ''
    ).toLowerCase();
    const budowa = (
        offer.investName ||
        offer.budowa ||
        (offer.data && (offer.data.investName || offer.data.budowa)) ||
        ''
    ).toLowerCase();
    const userStr = (
        offer.userName ||
        offer.lastEditedBy ||
        (offer.data && offer.data.creatorName) ||
        ''
    ).toLowerCase();

    const offerId = String(offer.id);
    const orders = ordersMap.get(offerId);
    const matchesOrderNumber = orders && orders.some(o => {
        const on = o?.orderNumber || o?.data?.orderNumber || '';
        return on.toLowerCase().includes(query);
    });

    return !!(
        num.includes(query) ||
        client.includes(query) ||
        nip.includes(query) ||
        budowa.includes(query) ||
        userStr.includes(query) ||
        matchesOrderNumber
    );
}

describe('Kartoteka — wyszukiwanie po numerze zamówienia', () => {
    const offers = [
        { id: '1', number: 'OFF-123', clientName: 'Acme Corp', investName: 'Budowa A' },
        { id: '2', number: 'OFF-456', clientName: 'Beta Ltd', budowa: 'Budowa B' },
        { id: '3', number: 'OFF-789', clientName: 'Gamma Sp. z o.o.', investName: 'Budowa C' },
    ];

    const ordersMap = new Map<string, any[]>([
        ['1', [{ orderNumber: 'ZAM-001', data: { orderNumber: 'ZAM-001' } }]],
        ['2', [{ orderNumber: 'ZAM-002', data: { orderNumber: 'ZAM-002' } }]],
    ]);

    it('zwraca ofertę gdy query pasuje do numeru zamówienia', () => {
        expect(offerMatchesSearch(offers[0], 'ZAM-001', ordersMap)).toBe(true);
    });

    it('zwraca false gdy query nie pasuje do żadnego zamówienia', () => {
        expect(offerMatchesSearch(offers[0], 'NOPE-999', ordersMap)).toBe(false);
    });

    it('zwraca ofertę gdy query pasuje do numeru oferty (stare zachowanie)', () => {
        expect(offerMatchesSearch(offers[0], 'OFF-123', ordersMap)).toBe(true);
    });

    it('zwraca ofertę gdy query pasuje do klienta (stare zachowanie)', () => {
        expect(offerMatchesSearch(offers[1], 'Beta', ordersMap)).toBe(true);
    });

    it('zwraca wszystkie oferty dla pustego query', () => {
        expect(offerMatchesSearch(offers[0], '', ordersMap)).toBe(true);
        expect(offerMatchesSearch(offers[1], '', ordersMap)).toBe(true);
        expect(offerMatchesSearch(offers[2], '', ordersMap)).toBe(true);
    });

    it('zwraca ofertę przy częściowym dopasowaniu numeru zamówienia', () => {
        expect(offerMatchesSearch(offers[0], '001', ordersMap)).toBe(true);
    });

    it('zwraca false dla oferty bez zamówień gdy query pasuje tylko do innego zamówienia', () => {
        expect(offerMatchesSearch(offers[2], 'ZAM-001', ordersMap)).toBe(false);
    });

    it('wyszukuje po data.orderNumber (JSON blob)', () => {
        const map = new Map<string, any[]>([
            ['99', [{ orderNumber: null, data: { orderNumber: 'ZAM-999' } }]],
        ]);
        expect(offerMatchesSearch({ id: '99', number: 'OFF-999' }, 'ZAM-999', map)).toBe(true);
    });

    it('nie rzuca błędem gdy ordersMap nie ma wpisu dla oferty', () => {
        expect(offerMatchesSearch(offers[0], 'ZAM-001', new Map())).toBe(false);
    });

    it('wyszukuje po orderNumber (gdy data jest puste)', () => {
        const map = new Map<string, any[]>([
            ['7', [{ orderNumber: 'ZAM-777', data: {} }]],
        ]);
        expect(offerMatchesSearch({ id: '7', number: 'OFF-777' }, 'ZAM-777', map)).toBe(true);
    });
});
