function offerMatchesSearch(offer: any, query: string, ordersMap: Map<string, any[]>): boolean {
    if (!query) return true;
    query = query.toLowerCase();

    const num = (offer.number || offer.title || offer.offerName || '').toLowerCase();
    const client = (offer.clientName || (offer.data && offer.data.clientName) || '').toLowerCase();
    const nip = (offer.clientNip || (offer.data && offer.data.clientNip) || '').toLowerCase();
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
    const matchesOrderNumber =
        orders &&
        orders.some((o) => {
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
        { id: '3', number: 'OFF-789', clientName: 'Gamma Sp. z o.o.', investName: 'Budowa C' }
    ];

    const ordersMap = new Map<string, any[]>([
        ['1', [{ orderNumber: 'ZAM-001', data: { orderNumber: 'ZAM-001' } }]],
        ['2', [{ orderNumber: 'ZAM-002', data: { orderNumber: 'ZAM-002' } }]]
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
            ['99', [{ orderNumber: null, data: { orderNumber: 'ZAM-999' } }]]
        ]);
        expect(offerMatchesSearch({ id: '99', number: 'OFF-999' }, 'ZAM-999', map)).toBe(true);
    });

    it('nie rzuca błędem gdy ordersMap nie ma wpisu dla oferty', () => {
        expect(offerMatchesSearch(offers[0], 'ZAM-001', new Map())).toBe(false);
    });

    it('wyszukuje po orderNumber (gdy data jest puste)', () => {
        const map = new Map<string, any[]>([['7', [{ orderNumber: 'ZAM-777', data: {} }]]]);
        expect(offerMatchesSearch({ id: '7', number: 'OFF-777' }, 'ZAM-777', map)).toBe(true);
    });
});

function offerMatchesUser(
    offer: { userId?: string; lastEditedBy?: string },
    selectedUserId: string
): boolean {
    if (!selectedUserId) return true;
    const uid = offer.userId || offer.lastEditedBy || '';
    return uid === selectedUserId;
}

function offerMatchesDate(
    offer: { createdAt?: string | null },
    dateFilter: { mode: string; preset: string; from: string; to: string },
    boundaries: { today: Date; todayEnd: Date; weekAgo: Date; monthAgo: Date }
): boolean {
    if (dateFilter.mode === 'none') return true;
    if (!offer.createdAt) return false;
    const d = new Date(offer.createdAt);
    if (isNaN(d.getTime())) return false;
    const ts = d.getTime();

    if (dateFilter.mode === 'preset') {
        switch (dateFilter.preset) {
            case 'today':
                return ts >= boundaries.today.getTime() && ts < boundaries.todayEnd.getTime();
            case '7d':
                return ts >= boundaries.weekAgo.getTime();
            case '30d':
                return ts >= boundaries.monthAgo.getTime();
            case 'month': {
                const dLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const monthStart = new Date(
                    boundaries.today.getFullYear(),
                    boundaries.today.getMonth(),
                    1
                );
                const monthEnd = new Date(
                    boundaries.today.getFullYear(),
                    boundaries.today.getMonth() + 1,
                    1
                );
                return (
                    dLocal.getTime() >= monthStart.getTime() &&
                    dLocal.getTime() < monthEnd.getTime()
                );
            }
        }
        return true;
    }

    if (dateFilter.from || dateFilter.to) {
        const dd = new Date(offer.createdAt!);
        if (isNaN(dd.getTime())) return false;
        const y = dd.getFullYear();
        const m = String(dd.getMonth() + 1).padStart(2, '0');
        const day = String(dd.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        if (dateFilter.from && dateStr < dateFilter.from) return false;
        if (dateFilter.to && dateStr > dateFilter.to) return false;
    }
    return true;
}

describe('offerMatchesUser', () => {
    it('pusty = brak filtra', () => expect(offerMatchesUser({ userId: 'u1' }, '')).toBe(true));
    it('dopasowanie po userId', () => expect(offerMatchesUser({ userId: 'u1' }, 'u1')).toBe(true));
    it('brak dopasowania', () => expect(offerMatchesUser({ userId: 'u1' }, 'u2')).toBe(false));
    it('fallback lastEditedBy', () =>
        expect(offerMatchesUser({ lastEditedBy: 'u3' }, 'u3')).toBe(true));
    it('userId > lastEditedBy', () => {
        expect(offerMatchesUser({ userId: 'u1', lastEditedBy: 'u2' }, 'u1')).toBe(true);
        expect(offerMatchesUser({ userId: 'u1', lastEditedBy: 'u2' }, 'u2')).toBe(false);
    });
    it('brak userId i lastEditedBy', () => expect(offerMatchesUser({}, 'u1')).toBe(false));
});

describe('offerMatchesDate', () => {
    const b = {
        today: new Date(2026, 6, 17),
        todayEnd: new Date(2026, 6, 18),
        weekAgo: new Date(2026, 6, 11),
        monthAgo: new Date(2026, 5, 18)
    };

    it('mode=none = brak filtra', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-17' },
                { mode: 'none', preset: '', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('today: dopasowuje', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 17, 10, 30).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('today: odrzuca wczoraj', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 16, 23, 59).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('7d: dopasowuje sprzed 6 dni', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 11, 0, 0).toISOString() },
                { mode: 'preset', preset: '7d', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('7d: odrzuca sprzed 7 dni', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 10, 23, 59).toISOString() },
                { mode: 'preset', preset: '7d', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('30d: dopasowuje sprzed 29 dni', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 5, 18, 0, 0).toISOString() },
                { mode: 'preset', preset: '30d', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('30d: odrzuca sprzed 30 dni', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 5, 17, 0, 0).toISOString() },
                { mode: 'preset', preset: '30d', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('month: w bieżącym', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 1).toISOString() },
                { mode: 'preset', preset: 'month', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('month: poza', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 5, 30).toISOString() },
                { mode: 'preset', preset: 'month', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('month: grudzień auto-wrap', () => {
        const db = {
            today: new Date(2026, 11, 15),
            todayEnd: new Date(2026, 11, 16),
            weekAgo: new Date(2026, 11, 9),
            monthAgo: new Date(2026, 10, 16)
        };
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 11, 10).toISOString() },
                { mode: 'preset', preset: 'month', from: '', to: '' },
                db
            )
        ).toBe(true);
    });
    it('range: w przedziale', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-15T12:00' },
                { mode: 'range', preset: '', from: '2026-07-14', to: '2026-07-16' },
                b
            )
        ).toBe(true));
    it('range: from==to', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-17T12:00' },
                { mode: 'range', preset: '', from: '2026-07-17', to: '2026-07-17' },
                b
            )
        ).toBe(true));
    it('range: poza', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-10T12:00' },
                { mode: 'range', preset: '', from: '2026-07-14', to: '2026-07-16' },
                b
            )
        ).toBe(false));
    it('range: dateFrom > dateTo', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-15T12:00' },
                { mode: 'range', preset: '', from: '2026-07-20', to: '2026-07-14' },
                b
            )
        ).toBe(false));
    it('null createdAt', () =>
        expect(
            offerMatchesDate(
                { createdAt: null },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('invalid string', () =>
        expect(
            offerMatchesDate(
                { createdAt: 'bad' },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('granica: 00:00 w zakresie', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 17, 0, 0).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('granica: 23:59 w zakresie', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 17, 23, 59).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('29 lutego', () => {
        const lb = {
            today: new Date(2024, 1, 29),
            todayEnd: new Date(2024, 2, 1),
            weekAgo: new Date(2024, 1, 23),
            monthAgo: new Date(2024, 0, 31)
        };
        expect(
            offerMatchesDate(
                { createdAt: new Date(2024, 1, 29, 12).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                lb
            )
        ).toBe(true);
    });
    it('DST 2026-03-29', () => {
        const db = {
            today: new Date(2026, 2, 29),
            todayEnd: new Date(2026, 2, 30),
            weekAgo: new Date(2026, 2, 23),
            monthAgo: new Date(2026, 1, 28)
        };
        expect(
            offerMatchesDate(
                { createdAt: new Date('2026-03-29T01:30:00Z').toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                db
            )
        ).toBe(true);
    });
});
