import { MockProduct, getTopClosure } from './selectionHelpers';

describe('getTopClosure', () => {
    const KONUS: MockProduct = {
        id: 'KON-10-625',
        name: 'Konus 1000',
        componentType: 'konus',
        dn: 1000,
        height: 625,
        formaStandardowaKLB: 1
    };
    const KONUS_PLUS: MockProduct = {
        id: 'KON-10-850',
        name: 'Konus+ 1000',
        componentType: 'konus',
        dn: 1000,
        height: 850,
        formaStandardowaKLB: 1
    };
    const DIN: MockProduct = {
        id: 'PDD-10',
        name: 'Plyta DIN 1000',
        componentType: 'plyta_din',
        dn: 1000,
        height: 150,
        formaStandardowaKLB: 1
    };
    const PRODS = [KONUS, KONUS_PLUS, DIN];

    const KON1200: MockProduct = {
        id: 'JZW-12-625-D',
        name: 'Konus 1200',
        componentType: 'konus',
        dn: 1200,
        height: 625,
        formaStandardowaKLB: 1
    };
    const DIN1200: MockProduct = {
        id: 'PDD-12-62-00',
        name: 'Plyta DIN 1200',
        componentType: 'plyta_din',
        dn: 1200,
        height: 200,
        formaStandardowaKLB: 1
    };
    const KON1500: MockProduct = {
        id: 'JZW-15-625-D',
        name: 'Konus 1500',
        componentType: 'konus',
        dn: 1500,
        height: 625,
        formaStandardowaKLB: 1
    };
    const DIN1500: MockProduct = {
        id: 'PDD-15-62-00',
        name: 'Plyta DIN 1500',
        componentType: 'plyta_din',
        dn: 1500,
        height: 200,
        formaStandardowaKLB: 1
    };
    const DIN2000: MockProduct = {
        id: 'PDD-20-62-00',
        name: 'Plyta DIN 2000',
        componentType: 'plyta_din',
        dn: 2000,
        height: 200,
        formaStandardowaKLB: 1
    };
    const DIN2500: MockProduct = {
        id: 'PDD-25-62-00',
        name: 'Plyta DIN 2500',
        componentType: 'plyta_din',
        dn: 2500,
        height: 200,
        formaStandardowaKLB: 1
    };

    it('preferuje Konus nad Płytą DIN (domyślnie)', () => {
        expect(getTopClosure(PRODS, 1000, null, false, 'Kluczbork')!.id).toBe('KON-10-625');
    });

    it('fallbackToDin=true → Płyta DIN', () => {
        expect(getTopClosure(PRODS, 1000, null, true, 'Kluczbork')!.id).toBe('PDD-10');
    });

    it('fallbackToDin=true, brak DIN → null (blockKonus=true, brak Konusa)', () => {
        expect(getTopClosure([KONUS, KONUS_PLUS], 1000, null, true, 'Kluczbork')).toBeNull();
    });

    it('wymuszony ID → używa go', () => {
        expect(getTopClosure(PRODS, 1000, 'PDD-10', false, 'Kluczbork')!.id).toBe('PDD-10');
    });

    it('wymuszony KONUS z fallbackToDin → null (konus + PEHD zabroniony)', () => {
        expect(getTopClosure(PRODS, 1000, 'KON-10-625', true, 'Kluczbork')).toBeNull();
    });

    it('wymuszony nie-konus (Płyta DIN) z fallbackToDin → respektowany', () => {
        expect(getTopClosure(PRODS, 1000, 'PDD-10', true, 'Kluczbork')!.id).toBe('PDD-10');
    });

    it('wymuszony Pierścień Odciążający z fallbackToDin → respektowany', () => {
        const PIERSCIEN: MockProduct = {
            id: 'PO-16-10',
            name: 'Pierścień Odciążający 1000',
            componentType: 'pierscien_odciazajacy',
            dn: 1000,
            height: 100,
            formaStandardowaKLB: 1
        };
        expect(
            getTopClosure([KONUS, DIN, PIERSCIEN], 1000, 'PO-16-10', true, 'Kluczbork')!.id
        ).toBe('PO-16-10');
    });

    it('brak Konusa → Płyta DIN', () => {
        expect(getTopClosure([DIN], 1000, null, false, 'Kluczbork')!.id).toBe('PDD-10');
    });

    it('brak żadnego → null', () => {
        expect(getTopClosure([], 1000, null, false, 'Kluczbork')).toBeNull();
    });

    it('wymuszony z niepasującym DN → pomijany', () => {
        const forced: MockProduct = {
            id: 'KON-12',
            name: 'Konus 1200',
            componentType: 'konus',
            dn: 1200,
            height: 625,
            formaStandardowaKLB: 1
        };
        expect(getTopClosure([KONUS, forced], 1000, 'KON-12', false, 'Kluczbork')!.id).toBe(
            'KON-10-625'
        );
    });

    it('DN null na wymuszonym → akceptowany', () => {
        const forced: MockProduct = {
            id: 'WLAZ',
            name: 'Wlaz',
            componentType: 'wlaz',
            dn: null,
            height: 150,
            formaStandardowaKLB: 1
        };
        expect(getTopClosure([KONUS, forced], 1000, 'WLAZ', false, 'Kluczbork')!.id).toBe('WLAZ');
    });

    it('sortowanie: formaStandardowa malejąco', () => {
        const k1: MockProduct = {
            id: 'KON-A',
            name: 'Konus A',
            componentType: 'konus',
            dn: 1000,
            height: 625,
            formaStandardowaKLB: 0
        };
        const k2: MockProduct = {
            id: 'KON-B',
            name: 'Konus B',
            componentType: 'konus',
            dn: 1000,
            height: 625,
            formaStandardowaKLB: 1
        };
        expect(getTopClosure([k1, k2], 1000, null, false, 'Kluczbork')!.id).toBe('KON-B');
    });

    it('DN1200 → szuka konusa DN1200', () => {
        expect(getTopClosure([KONUS, DIN, KON1200], 1200, null, false, 'Kluczbork')!.id).toBe(
            'JZW-12-625-D'
        );
    });

    it('DN1500 → Konus DN1500 preferowany (gdy istnieje)', () => {
        expect(getTopClosure([KON1500, DIN1500], 1500, null, false, 'Kluczbork')!.id).toBe(
            'JZW-15-625-D'
        );
    });

    it('DN1500 → forcedZak=Plyta DIN respektowany (test fixa override)', () => {
        expect(
            getTopClosure([KON1500, DIN1500], 1500, 'PDD-15-62-00', false, 'Kluczbork')!.id
        ).toBe('PDD-15-62-00');
    });

    it('DN2000 → Plyta DIN (brak konusa)', () => {
        expect(getTopClosure([DIN2000], 2000, null, false, 'Kluczbork')!.id).toBe('PDD-20-62-00');
    });

    it('DN2500 → Plyta DIN (brak konusa)', () => {
        expect(getTopClosure([DIN2500], 2500, null, false, 'Kluczbork')!.id).toBe('PDD-25-62-00');
    });

    it('DN2000 → forcedZak respektowany', () => {
        const DIN2000_ALT: MockProduct = {
            id: 'PO-20-62-00',
            name: 'Plyta DIN 2000 (alternatywna)',
            componentType: 'plyta_din',
            dn: 2000,
            height: 210,
            formaStandardowaKLB: 1
        };
        expect(
            getTopClosure([DIN2000, DIN2000_ALT], 2000, 'PO-20-62-00', false, 'Kluczbork')!.id
        ).toBe('PO-20-62-00');
    });

    it('DN1200 → forcedZak respektowany', () => {
        expect(
            getTopClosure([KON1200, DIN1200], 1200, 'PDD-12-62-00', false, 'Kluczbork')!.id
        ).toBe('PDD-12-62-00');
    });

    it('DN1200 → forcedZak=null → Konus (domyslny)', () => {
        expect(getTopClosure([KON1200, DIN1200], 1200, null, false, 'Kluczbork')!.id).toBe(
            'JZW-12-625-D'
        );
    });
});

/* ============ findClosureForDn + zakonczenieByDn (styczne toggle) ============ */

function findClosureForDn(
    products: MockProduct[],
    productId: string,
    targetDn: number
): string | null {
    if (!productId) return null;
    const prod = products.find((p) => p.id === productId);
    if (!prod || !prod.componentType) return null;
    const match = products.find(
        (p) =>
            p.componentType === prod.componentType &&
            (parseInt(String(p.dn)) === targetDn || p.dn === null)
    );
    return match ? match.id : null;
}

const CLOSURE_PRODUCTS: MockProduct[] = [
    {
        id: 'PDD-10-62-00',
        name: 'Płyta DIN DN1000',
        componentType: 'plyta_din',
        dn: 1000,
        height: 0
    },
    {
        id: 'PDD-12-62-00',
        name: 'Płyta DIN DN1200',
        componentType: 'plyta_din',
        dn: 1200,
        height: 0
    },
    {
        id: 'PDD-15-62-00',
        name: 'Płyta DIN DN1500',
        componentType: 'plyta_din',
        dn: 1500,
        height: 0
    },
    {
        id: 'PDD-20-62-00',
        name: 'Płyta DIN DN2000',
        componentType: 'plyta_din',
        dn: 2000,
        height: 0
    },
    { id: 'JZW-10-625-D', name: 'Konus DN1000', componentType: 'konus', dn: 1000, height: 0 },
    { id: 'JZW-12-625-D', name: 'Konus DN1200', componentType: 'konus', dn: 1200, height: 0 },
    {
        id: 'PZE-16-10',
        name: 'Płyta zamyk DN1000',
        componentType: 'plyta_zamykajaca',
        dn: 1000,
        height: 0
    },
    {
        id: 'PZE-18-12',
        name: 'Płyta zamyk DN1200',
        componentType: 'plyta_zamykajaca',
        dn: 1200,
        height: 0
    }
];

describe('findClosureForDn — zamiana zakończenia przy przełączaniu nadbudowy', () => {
    it('plyta_din DN1000 → plyta_din DN1200', () => {
        const result = findClosureForDn(CLOSURE_PRODUCTS, 'PDD-10-62-00', 1200);
        expect(result).toBe('PDD-12-62-00');
    });

    it('plyta_din DN1200 → plyta_din DN1000', () => {
        const result = findClosureForDn(CLOSURE_PRODUCTS, 'PDD-12-62-00', 1000);
        expect(result).toBe('PDD-10-62-00');
    });

    it('konus DN1000 → konus DN1200', () => {
        const result = findClosureForDn(CLOSURE_PRODUCTS, 'JZW-10-625-D', 1200);
        expect(result).toBe('JZW-12-625-D');
    });

    it('plyta_zamykajaca DN1000 → plyta_zamykajaca DN1200', () => {
        const result = findClosureForDn(CLOSURE_PRODUCTS, 'PZE-16-10', 1200);
        expect(result).toBe('PZE-18-12');
    });

    it('zwraca null jeśli brak typu dla nowego DN', () => {
        const result = findClosureForDn(CLOSURE_PRODUCTS, 'PDD-10-62-00', 9999);
        expect(result).toBeNull();
    });

    it('zwraca null dla pustego productId', () => {
        const result = findClosureForDn(CLOSURE_PRODUCTS, '', 1200);
        expect(result).toBeNull();
    });
});

describe('zakonczenieByDn — pamięć per-DN przy przełączaniu', () => {
    interface MockWell {
        dn: string;
        stycznaNadbudowa1200: boolean;
        zakonczenie: string | null;
        zakonczenieByDn: Record<number, string>;
    }

    function simulateToggle(well: MockWell): void {
        const oldDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        well.stycznaNadbudowa1200 = !well.stycznaNadbudowa1200;
        const newDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        if (well.zakonczenie) well.zakonczenieByDn[oldDn] = well.zakonczenie;
        well.zakonczenie = well.zakonczenieByDn[newDn] || null;
        if (!well.zakonczenie) {
            well.zakonczenie = findClosureForDn(
                CLOSURE_PRODUCTS,
                well.zakonczenieByDn[oldDn],
                newDn
            );
            if (well.zakonczenie) well.zakonczenieByDn[newDn] = well.zakonczenie;
        }
    }

    it('symuluje toggle: wybierz plyta_din DN1000, toggle DN1200, toggle DN1000', () => {
        const well: MockWell = {
            dn: 'styczna',
            stycznaNadbudowa1200: false,
            zakonczenie: null,
            zakonczenieByDn: {}
        };

        // 1. Ręczny wybór plyta_din DN1000
        well.zakonczenie = 'PDD-10-62-00';
        well.zakonczenieByDn[1000] = 'PDD-10-62-00';
        expect(well.zakonczenie).toBe('PDD-10-62-00');

        // 2. Toggle do DN1200
        simulateToggle(well);
        expect(well.stycznaNadbudowa1200).toBe(true);
        expect(well.zakonczenie).toBe('PDD-12-62-00');
        expect(well.zakonczenieByDn[1000]).toBe('PDD-10-62-00');
        expect(well.zakonczenieByDn[1200]).toBe('PDD-12-62-00');

        // 3. Toggle z powrotem do DN1000
        simulateToggle(well);
        expect(well.stycznaNadbudowa1200).toBe(false);
        expect(well.zakonczenie).toBe('PDD-10-62-00');
    });

    it('ręczny wybór konus jest nadrzędny — toggle DN1200 → konus DN1200', () => {
        const well: MockWell = {
            dn: 'styczna',
            stycznaNadbudowa1200: false,
            zakonczenie: 'JZW-10-625-D',
            zakonczenieByDn: { 1000: 'JZW-10-625-D' }
        };

        simulateToggle(well);
        expect(well.zakonczenie).toBe('JZW-12-625-D');
    });

    it('ręczny wybór plyta_zamykajaca jest nadrzędny — toggle DN1200 → plyta_zamykajaca DN1200', () => {
        const well: MockWell = {
            dn: 'styczna',
            stycznaNadbudowa1200: false,
            zakonczenie: 'PZE-16-10',
            zakonczenieByDn: { 1000: 'PZE-16-10' }
        };

        simulateToggle(well);
        expect(well.zakonczenie).toBe('PZE-18-12');
    });

    it('zachowuje wybór gdy user zmienia zakończenie na DN1200, potem toggle do DN1000 i z powrotem', () => {
        const well: MockWell = {
            dn: 'styczna',
            stycznaNadbudowa1200: false,
            zakonczenie: 'PDD-10-62-00',
            zakonczenieByDn: { 1000: 'PDD-10-62-00' }
        };

        // Toggle do DN1200
        simulateToggle(well);
        expect(well.zakonczenie).toBe('PDD-12-62-00');

        // User ręcznie zmienia na konus DN1200
        well.zakonczenie = 'JZW-12-625-D';
        well.zakonczenieByDn[1200] = 'JZW-12-625-D';

        // Toggle do DN1000
        simulateToggle(well);
        expect(well.zakonczenie).toBe('PDD-10-62-00');

        // Toggle do DN1200 — powinien wrócić konus DN1200
        simulateToggle(well);
        expect(well.zakonczenie).toBe('JZW-12-625-D');
    });
});
