import { MockProduct, getFormaField, getTopClosure, filterByWellParams } from './selectionHelpers';

function getKregiList(
    products: MockProduct[],
    dn: number | string,
    warehouse: string
): MockProduct[] {
    const ff = getFormaField(warehouse);
    const effectiveDn = dn === 'styczna' ? 1000 : dn;
    const kregi = products.filter(
        (p) =>
            (p.componentType === 'krag' || p.componentType === 'krag_ot') &&
            parseInt(String(p.dn)) === parseInt(String(effectiveDn)) &&
            parseFloat(String(p.height)) > 0
    );
    kregi.sort((a, b) => {
        const fA = parseInt(String(a[ff])) || 0;
        const fB = parseInt(String(b[ff])) || 0;
        if (fA !== fB) return fB - fA;
        return (parseFloat(String(b.height)) || 0) - (parseFloat(String(a.height)) || 0);
    });
    return kregi;
}

describe('getKregiList', () => {
    const KREGI: MockProduct[] = [
        {
            id: 'K-1000-250',
            name: 'K 250',
            componentType: 'krag',
            dn: 1000,
            height: 250,
            formaStandardowaKLB: 1
        },
        {
            id: 'K-1000-500',
            name: 'K 500',
            componentType: 'krag',
            dn: 1000,
            height: 500,
            formaStandardowaKLB: 0
        },
        {
            id: 'K-1000-1000',
            name: 'K 1000',
            componentType: 'krag',
            dn: 1000,
            height: 1000,
            formaStandardowaKLB: 1
        }
    ];

    it('sortuje: formaStd malejąco, height malejąco', () => {
        const list = getKregiList(KREGI, 1000, 'Kluczbork');
        expect(list[0].id).toBe('K-1000-1000');
        expect(list[1].id).toBe('K-1000-250');
        expect(list[2].id).toBe('K-1000-500');
    });

    it('filtruje po DN', () => {
        const wrong: MockProduct = {
            id: 'K-1500-1000',
            name: 'K 1500',
            componentType: 'krag',
            dn: 1500,
            height: 1000,
            formaStandardowaKLB: 1
        };
        const list = getKregiList([...KREGI, wrong], 1000, 'Kluczbork');
        expect(list).toHaveLength(3);
        expect(list.every((k) => parseInt(String(k.dn)) === 1000)).toBe(true);
    });

    it('styczna → DN1000', () => {
        const list = getKregiList(KREGI, 'styczna', 'Kluczbork');
        expect(list.length).toBeGreaterThan(0);
    });

    it('ignoruje produkty z height=0', () => {
        const zero: MockProduct = {
            id: 'K-1000-0',
            name: 'K 0',
            componentType: 'krag',
            dn: 1000,
            height: 0,
            formaStandardowaKLB: 1
        };
        const list = getKregiList([...KREGI, zero], 1000, 'Kluczbork');
        expect(list).toHaveLength(3);
    });

    it('zawiera krag_ot', () => {
        const ot: MockProduct = {
            id: 'K-1000-500-OT',
            name: 'K OT',
            componentType: 'krag_ot',
            dn: 1000,
            height: 500,
            formaStandardowaKLB: 1
        };
        const list = getKregiList([...KREGI, ot], 1000, 'Kluczbork');
        expect(list.some((k) => k.componentType === 'krag_ot')).toBe(true);
    });
});

/* ================= Recalculation preserves forced items ================= */

function solverSelectTopClosure(
    products: MockProduct[],
    dn: number | string,
    forcedTopId: string | null,
    fallbackToDin: boolean,
    warehouse: string
): string | null {
    const top = getTopClosure(products, dn, forcedTopId, fallbackToDin, warehouse);
    return top ? top.id : null;
}

function solverSelectDennica(
    products: MockProduct[],
    dn: number | string,
    warehouse: string,
    transitions: Array<{ productId: string; rzednaWlaczenia: number }>,
    rzDna: number
): string | null {
    const ff =
        warehouse.includes('oc') || warehouse.includes('Włoc')
            ? 'formaStandardowa'
            : 'formaStandardowaKLB';
    const dns = products
        .filter(
            (p) =>
                p.componentType === 'dennica' &&
                parseInt(String(p.dn)) === parseInt(String(dn)) &&
                p.height > 0
        )
        .sort((a, b) => {
            const hA = a.height || 0,
                hB = b.height || 0;
            if (hA !== hB) return hA - hB;
            return ((b[ff] as number) || 0) - ((a[ff] as number) || 0);
        });
    if (dns.length === 0) return null;
    if (!transitions || transitions.length === 0) return dns[0].id;

    for (const d of dns) {
        let allFit = true;
        for (const t of transitions) {
            const pprod = products.find((x) => x.id === t.productId);
            if (!pprod) continue;
            let dnVal = 160;
            if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
                dnVal = parseFloat(pprod.dn.split('/')[1]) || 160;
            else dnVal = parseFloat(String(pprod.dn)) || 160;
            const hcInvert = (t.rzednaWlaczenia - rzDna) * 1000;
            if (hcInvert >= d.height) continue;
            const topClr = d.height - (hcInvert + dnVal);
            if (topClr < 0) {
                allFit = false;
                break;
            }
        }
        if (allFit) return d.id;
    }
    return dns[dns.length - 1].id;
}

describe('Recalculation — forced items preservation', () => {
    const DENNICE: MockProduct[] = [
        {
            id: 'D-1000-300',
            name: 'Dennica 300',
            componentType: 'dennica',
            dn: 1000,
            height: 300,
            formaStandardowaKLB: 1
        },
        {
            id: 'D-1000-500',
            name: 'Dennica 500',
            componentType: 'dennica',
            dn: 1000,
            height: 500,
            formaStandardowaKLB: 1
        }
    ];
    const KONUS: MockProduct = {
        id: 'KON-10-625',
        name: 'Konus 1000',
        componentType: 'konus',
        dn: 1000,
        height: 625,
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
    const PRZ160: MockProduct = {
        id: 'PRZ-160',
        name: 'Przejście 160',
        componentType: 'przejscie',
        dn: 160,
        height: 0,
        formaStandardowaKLB: 1
    };
    const PRZ200: MockProduct = {
        id: 'PRZ-200',
        name: 'Przejście 200',
        componentType: 'przejscie',
        dn: 200,
        height: 0,
        formaStandardowaKLB: 1
    };
    const ALL = [...DENNICE, KONUS, DIN, PRZ160, PRZ200];

    it('wymuszone zakończenie zachowane po zmianie DN przejścia', () => {
        const dennica1 = solverSelectDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0.2 }],
            0
        );
        expect(dennica1).toBe('D-1000-500');

        const top1 = solverSelectTopClosure(ALL, 1000, 'PDD-10', false, 'Kluczbork');
        expect(top1).toBe('PDD-10');

        const dennica2 = solverSelectDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-200', rzednaWlaczenia: 0.2 }],
            0
        );
        expect(dennica2).toBe('D-1000-500');

        const top2 = solverSelectTopClosure(ALL, 1000, 'PDD-10', false, 'Kluczbork');
        expect(top2).toBe('PDD-10');
    });

    it('wymuszony KONUS gdy fallbackToDin=true → null (konus + PEHD zabroniony)', () => {
        const top = solverSelectTopClosure([KONUS, DIN], 1000, 'KON-10-625', true, 'Kluczbork');
        expect(top).toBeNull();
    });

    it('wymuszony nie-konus (Płyta DIN) gdy fallbackToDin=true → respektowany', () => {
        const top = solverSelectTopClosure([KONUS, DIN], 1000, 'PDD-10', true, 'Kluczbork');
        expect(top).toBe('PDD-10');
    });

    it('wymuszone zakończenie z DN=null → akceptowane bo pasuje do każdego DN', () => {
        const wlaz: MockProduct = {
            id: 'WLAZ',
            name: 'Wlaz',
            componentType: 'wlaz',
            dn: null,
            height: 150,
            formaStandardowaKLB: 1
        };
        const top = solverSelectTopClosure([KONUS, DIN, wlaz], 1000, 'WLAZ', false, 'Kluczbork');
        expect(top).toBe('WLAZ');
    });

    it('brak wymuszenia → normalna selekcja (konus preferowany)', () => {
        const top = solverSelectTopClosure([KONUS, DIN], 1000, null, false, 'Kluczbork');
        expect(top).toBe('KON-10-625');
    });

    it('simulacja: przejście DN160 → DN200 → przeliczenie + zachowanie wymuszonego', () => {
        const transitions160 = [{ productId: 'PRZ-160', rzednaWlaczenia: 0.45 }];
        const transitions200 = [{ productId: 'PRZ-200', rzednaWlaczenia: 0.45 }];

        const d1 = solverSelectDennica(ALL, 1000, 'Kluczbork', transitions160, 0);
        const t1 = solverSelectTopClosure(ALL, 1000, 'PDD-10', false, 'Kluczbork');
        expect(t1).toBe('PDD-10');

        const d2 = solverSelectDennica(ALL, 1000, 'Kluczbork', transitions200, 0);
        const t2 = solverSelectTopClosure(ALL, 1000, 'PDD-10', false, 'Kluczbork');
        expect(t2).toBe('PDD-10');
        if (d1 !== d2) {
            expect(t1).toBe(t2);
        }
    });
});

/* ================= Full fallback flow (DN1500 scenario) ================= */

function getAvailableProducts(products: MockProduct[], mag: string): MockProduct[] {
    const field =
        (mag || '').includes('oc') || (mag || '').includes('Włoc') ? 'magazynWL' : 'magazynKLB';
    return products.filter((p) => {
        const val = p[field];
        return val === 1 || val === undefined;
    });
}

function getClosureWithFallback(
    availFiltered: MockProduct[],
    effectiveDn: number,
    forcedZak: string | null,
    isWkladka: boolean,
    warehouse: string,
    fullCatalog: MockProduct[]
): MockProduct | null {
    let topProd = getTopClosure(availFiltered, effectiveDn, forcedZak, isWkladka, warehouse);
    if (!forcedZak && topProd && topProd.componentType !== 'konus' && !isWkladka) {
        const konusFromCatalog = fullCatalog.find(
            (p) => p.componentType === 'konus' && parseInt(String(p.dn)) === effectiveDn
        );
        if (konusFromCatalog) topProd = konusFromCatalog;
    }
    if (!topProd && forcedZak) {
        topProd =
            fullCatalog.find((p) => p.id === forcedZak && parseInt(String(p.dn)) === effectiveDn) ||
            null;
    }
    if (!topProd) {
        topProd =
            fullCatalog.find(
                (p) => p.componentType === 'konus' && parseInt(String(p.dn)) === effectiveDn
            ) || null;
    }
    return topProd;
}

describe('full fallback flow (DN1500)', () => {
    const KON1500_KLB: MockProduct = {
        id: 'JZW-15-625-D',
        name: 'Konus 1500 (drabinka)',
        componentType: 'konus',
        dn: 1500,
        height: 625,
        formaStandardowaKLB: 1,
        magazynKLB: 1
    };
    const DIN1500_KLB: MockProduct = {
        id: 'PDD-15-62-00',
        name: 'Plyta DIN 1500',
        componentType: 'plyta_din',
        dn: 1500,
        height: 200,
        formaStandardowaKLB: 1,
        magazynKLB: 1
    };
    const KON1500_WL: MockProduct = {
        id: 'JZW-15-625-D',
        name: 'Konus 1500 (drabinka)',
        componentType: 'konus',
        dn: 1500,
        height: 625,
        formaStandardowa: 1,
        magazynWL: 1
    };
    const DIN1500_WL: MockProduct = {
        id: 'PDD-15-62-00',
        name: 'Plyta DIN 1500',
        componentType: 'plyta_din',
        dn: 1500,
        height: 200,
        formaStandardowa: 1,
        magazynWL: 1
    };
    const FULL_CATALOG = [KON1500_KLB, DIN1500_KLB];

    const wellStopnieBrak = {
        dn: 1500,
        magazyn: 'Kluczbork',
        stopnie: 'brak' as const,
        wkladkaZwienczenie: 'brak',
        zakonczenie: null,
        redukcjaDN1000: false,
        rzednaDna: 0,
        rzednaWlazu: 5.0,
        nadbudowa: 'betonowa',
        dennicaMaterial: 'betonowa'
    };

    it('DN1500, stopnie=brak: filterByWellParams usuwa konus (-D odrzucony)', () => {
        const avail = getAvailableProducts(FULL_CATALOG, 'Kluczbork');
        const filtered = avail.filter((p) => filterByWellParams(p, wellStopnieBrak));
        expect(filtered.find((p) => p.id === 'JZW-15-625-D')).toBeUndefined();
        expect(filtered.find((p) => p.id === 'PDD-15-62-00')).toBeDefined();
    });

    it('DN1500, stopnie=brak: getTopClosure zwraca Płyte DIN', () => {
        const filtered = FULL_CATALOG.filter((p) => filterByWellParams(p, wellStopnieBrak));
        expect(getTopClosure(filtered, 1500, null, false, 'Kluczbork')!.id).toBe('PDD-15-62-00');
    });

    it('DN1500, stopnie=brak: fallback znajduje konus z katalogu (gdy forcedZak=null)', () => {
        const filtered = FULL_CATALOG.filter((p) => filterByWellParams(p, wellStopnieBrak));
        const result = getClosureWithFallback(
            filtered,
            1500,
            null,
            false,
            'Kluczbork',
            FULL_CATALOG
        );
        expect(result!.id).toBe('JZW-15-625-D');
    });

    it('DN1500, stopnie=brak: forcedZak=PDD-15-62-00 respektowany (override pominiety)', () => {
        const filtered = FULL_CATALOG.filter((p) => filterByWellParams(p, wellStopnieBrak));
        const result = getClosureWithFallback(
            filtered,
            1500,
            'PDD-15-62-00',
            false,
            'Kluczbork',
            FULL_CATALOG
        );
        expect(result!.id).toBe('PDD-15-62-00');
    });

    it('DN1500, Kluczbork: magazynKLB=1 → oba produkty dostepne', () => {
        const avail = getAvailableProducts(FULL_CATALOG, 'Kluczbork');
        expect(avail.length).toBe(2);
    });

    it('DN1500, Wloclawek: magazynWL=1 → oba produkty dostepne', () => {
        const fullWL = [KON1500_WL, DIN1500_WL];
        const avail = getAvailableProducts(fullWL, 'Włocławek');
        expect(avail.length).toBe(2);
    });

    it('DN2000, Kluczbork: plyta_din (brak konusa), forcedZak respektowany', () => {
        const PRODS: MockProduct[] = [
            {
                id: 'PDD-20-62-00',
                name: 'Plyta DIN 2000',
                componentType: 'plyta_din',
                dn: 2000,
                height: 200,
                formaStandardowaKLB: 1
            }
        ];
        const result = getClosureWithFallback(PRODS, 2000, null, false, 'Kluczbork', PRODS);
        expect(result!.id).toBe('PDD-20-62-00');
    });

    it('DN2500, Kluczbork: plyta_din (brak konusa)', () => {
        const PRODS: MockProduct[] = [
            {
                id: 'PDD-25-62-00',
                name: 'Plyta DIN 2500',
                componentType: 'plyta_din',
                dn: 2500,
                height: 200,
                formaStandardowaKLB: 1
            }
        ];
        const result = getClosureWithFallback(PRODS, 2500, null, false, 'Kluczbork', PRODS);
        expect(result!.id).toBe('PDD-25-62-00');
    });
});
