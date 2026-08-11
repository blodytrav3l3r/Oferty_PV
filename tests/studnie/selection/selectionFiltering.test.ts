import { MockProduct, getReductionPlate, filterByWellParams } from './selectionHelpers';

describe('getReductionPlate', () => {
    const PLATE: MockProduct = {
        id: 'PR-1500-1000',
        name: 'Plyta redukcyjna 1500/1000',
        componentType: 'plyta_redukcyjna',
        dn: 1500,
        height: 150,
        formaStandardowaKLB: 1
    };
    const PLATE_1200: MockProduct = {
        id: 'PR-1500-1200',
        name: 'Plyta redukcyjna 1500/1200',
        componentType: 'plyta_redukcyjna',
        dn: 1500,
        height: 150,
        formaStandardowaKLB: 1
    };

    it('znajduje płytę redukcyjną 1500→1000', () => {
        expect(getReductionPlate([PLATE], 1500, true, 1000)!.id).toBe('PR-1500-1000');
    });

    it('useReduction=false → null', () => {
        expect(getReductionPlate([PLATE], 1500, false, 1000)).toBeNull();
    });

    it('DN <= 1000 → null', () => {
        expect(getReductionPlate([PLATE], 1000, true, 1000)).toBeNull();
    });

    it('brak pasującej płyty → null', () => {
        expect(getReductionPlate([], 1500, true, 1000)).toBeNull();
    });

    it('targetDn=1200 → szuka płyty 1500→1200', () => {
        expect(getReductionPlate([PLATE, PLATE_1200], 1500, true, 1200)!.id).toBe('PR-1500-1200');
    });

    it('więcej formatów nazw (strzałki, DN)', () => {
        const p1: MockProduct = {
            id: 'PR-2000-1000',
            name: 'Redukcja DN2000->DN1000',
            componentType: 'plyta_redukcyjna',
            dn: 2000,
            height: 200,
            formaStandardowaKLB: 1
        };
        expect(getReductionPlate([p1], 2000, true, 1000)!.id).toBe('PR-2000-1000');
    });

    it('DN2000 z redukcją do 1000', () => {
        const p1: MockProduct = {
            id: 'PR-2000-1000',
            name: 'Plyta redukcyjna DN2000 na 1000',
            componentType: 'plyta_redukcyjna',
            dn: 2000,
            height: 200,
            formaStandardowaKLB: 1
        };
        expect(getReductionPlate([p1], 2000, true, 1000)!.id).toBe('PR-2000-1000');
    });

    it('DN1200 z redukcją do 1000', () => {
        const p1: MockProduct = {
            id: 'PR-1200-1000',
            name: 'Plyta redukcyjna 1200/1000',
            componentType: 'plyta_redukcyjna',
            dn: 1200,
            height: 150,
            formaStandardowaKLB: 1
        };
        expect(getReductionPlate([p1], 1200, true, 1000)!.id).toBe('PR-1200-1000');
    });

    it('DN2500 z redukcją do 1000', () => {
        const p1: MockProduct = {
            id: 'PR-2500-1000',
            name: 'Redukcja 2500 na 1000',
            componentType: 'plyta_redukcyjna',
            dn: 2500,
            height: 250,
            formaStandardowaKLB: 1
        };
        expect(getReductionPlate([p1], 2500, true, 1000)!.id).toBe('PR-2500-1000');
    });
});

describe('filterByWellParams — material', () => {
    it('beton → KDB OK, KDZ zablokowany', () => {
        const kdb: MockProduct = {
            id: 'KDB-10-10-D',
            name: 'KDB',
            componentType: 'krag',
            dn: 1000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        const kdz: MockProduct = {
            id: 'KDZ-10-10-D',
            name: 'KDZ',
            componentType: 'krag',
            dn: 1000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        expect(filterByWellParams(kdb, { nadbudowa: 'betonowa', stopnie: 'drabinka' })).toBe(true);
        expect(filterByWellParams(kdz, { nadbudowa: 'betonowa', stopnie: 'drabinka' })).toBe(false);
    });

    it('żelbet → KDZ OK, KDB zablokowany', () => {
        const kdb: MockProduct = {
            id: 'KDB-10-10-D',
            name: 'KDB',
            componentType: 'krag',
            dn: 1000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        const kdz: MockProduct = {
            id: 'KDZ-10-10-D',
            name: 'KDZ',
            componentType: 'krag',
            dn: 1000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        expect(filterByWellParams(kdb, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(
            false
        );
        expect(filterByWellParams(kdz, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(true);
    });

    it('DN2000/2500 uniwersalne materiałowo (KDB w żelbecie i KDZ w betonie OK)', () => {
        const kdb2000: MockProduct = {
            id: 'KDB-20-10-D',
            name: 'KDB',
            componentType: 'krag',
            dn: 2000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        const kdz2000: MockProduct = {
            id: 'KDZ-20-10-D',
            name: 'KDZ',
            componentType: 'krag',
            dn: 2000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        expect(filterByWellParams(kdb2000, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(
            true
        );
        expect(filterByWellParams(kdz2000, { nadbudowa: 'betonowa', stopnie: 'drabinka' })).toBe(
            true
        );
    });

    it('dennica DDD przepuszczana dla beton i żelbet', () => {
        const ddd1000: MockProduct = {
            id: 'DDD-10-045',
            name: 'DDD',
            componentType: 'dennica',
            dn: 1000,
            height: 300,
            formaStandardowaKLB: 1
        };
        const ddd1200: MockProduct = {
            id: 'DDD-12-065',
            name: 'DDD',
            componentType: 'dennica',
            dn: 1200,
            height: 500,
            formaStandardowaKLB: 1
        };
        expect(filterByWellParams(ddd1000, { dennicaMaterial: 'betonowa' })).toBe(true);
        expect(filterByWellParams(ddd1000, { dennicaMaterial: 'zelbetowa' })).toBe(true);
        expect(filterByWellParams(ddd1200, { dennicaMaterial: 'betonowa' })).toBe(true);
        expect(filterByWellParams(ddd1200, { dennicaMaterial: 'zelbetowa' })).toBe(true);
    });

    it('krag_ot filtrowany tak samo jak krag', () => {
        const kdbOt: MockProduct = {
            id: 'KDB-10-10-OT',
            name: 'KDB OT',
            componentType: 'krag_ot',
            dn: 1000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        const kdzOt: MockProduct = {
            id: 'KDZ-10-10-OT',
            name: 'KDZ OT',
            componentType: 'krag_ot',
            dn: 1000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        expect(filterByWellParams(kdbOt, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(
            false
        );
        expect(filterByWellParams(kdzOt, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(
            true
        );
    });
});

describe('filterByWellParams — stopnie', () => {
    const kragD: MockProduct = {
        id: 'KDB-10-10-D',
        name: 'Krag D',
        componentType: 'krag',
        dn: 1000,
        height: 1000,
        formaStandardowaKLB: 1
    };
    const kragND: MockProduct = {
        id: 'KDB-10-10-N-D',
        name: 'Krag ND',
        componentType: 'krag',
        dn: 1000,
        height: 1000,
        formaStandardowaKLB: 1
    };
    const kragB: MockProduct = {
        id: 'KDB-10-10-B',
        name: 'Krag B',
        componentType: 'krag',
        dn: 1000,
        height: 1000,
        formaStandardowaKLB: 1
    };
    const kragPlain: MockProduct = {
        id: 'KDB-10-10',
        name: 'Krag',
        componentType: 'krag',
        dn: 1000,
        height: 1000,
        formaStandardowaKLB: 1
    };
    const konusD: MockProduct = {
        id: 'KON-10-625-D',
        name: 'Konus D',
        componentType: 'konus',
        dn: 1000,
        height: 625,
        formaStandardowaKLB: 1
    };
    const base = { nadbudowa: 'betonowa', dennicaMaterial: 'betonowa' };

    it('stopnie=drabinka → pokazuje -D, blokuje -B i -N-D', () => {
        expect(filterByWellParams(kragD, { ...base, stopnie: 'drabinka' })).toBe(true);
        expect(filterByWellParams(kragND, { ...base, stopnie: 'drabinka' })).toBe(false);
        expect(filterByWellParams(kragB, { ...base, stopnie: 'drabinka' })).toBe(false);
    });

    it('stopnie=nierdzewna → pokazuje -N-D, blokuje -D i -B', () => {
        expect(filterByWellParams(kragND, { ...base, stopnie: 'nierdzewna' })).toBe(true);
        expect(filterByWellParams(kragD, { ...base, stopnie: 'nierdzewna' })).toBe(false);
        expect(filterByWellParams(kragB, { ...base, stopnie: 'nierdzewna' })).toBe(false);
    });

    it('stopnie=brak → pokazuje -B, blokuje -D i -N-D, przepuszcza plain', () => {
        expect(filterByWellParams(kragB, { ...base, stopnie: 'brak' })).toBe(true);
        expect(filterByWellParams(kragD, { ...base, stopnie: 'brak' })).toBe(false);
        expect(filterByWellParams(kragND, { ...base, stopnie: 'brak' })).toBe(false);
        expect(filterByWellParams(kragPlain, { ...base, stopnie: 'brak' })).toBe(true);
    });

    it('krag_ot zawsze widoczny niezależnie od stopni', () => {
        const kragOt: MockProduct = {
            id: 'KDB-10-10_OT',
            name: 'Krag OT',
            componentType: 'krag_ot',
            dn: 1000,
            height: 1000,
            formaStandardowaKLB: 1
        };
        expect(filterByWellParams(kragOt, { ...base, stopnie: 'drabinka' })).toBe(true);
        expect(filterByWellParams(kragOt, { ...base, stopnie: 'nierdzewna' })).toBe(true);
        expect(filterByWellParams(kragOt, { ...base, stopnie: 'brak' })).toBe(true);
    });

    it('stopnie dotyczą też konusa', () => {
        expect(filterByWellParams(konusD, { ...base, stopnie: 'drabinka' })).toBe(true);
        expect(filterByWellParams(konusD, { ...base, stopnie: 'brak' })).toBe(false);
    });

    it('produkt bez przyrostka stopni → przepuszczany gdy drabinka', () => {
        expect(filterByWellParams(kragPlain, { ...base, stopnie: 'drabinka' })).toBe(false);
    });
});

describe('filterByWellParams — redukcja', () => {
    const plate: MockProduct = {
        id: 'PR-1500-1000',
        name: 'Redukcyjna',
        componentType: 'plyta_redukcyjna',
        dn: 1500,
        height: 150,
        formaStandardowaKLB: 1
    };

    it('redukcjaDN1000=true → płyta widoczna', () => {
        expect(filterByWellParams(plate, { redukcjaDN1000: true })).toBe(true);
    });

    it('redukcjaDN1000=false → płyta ukryta', () => {
        expect(filterByWellParams(plate, { redukcjaDN1000: false })).toBe(false);
    });

    it('brak redukcjaDN1000 → płyta ukryta', () => {
        expect(filterByWellParams(plate, {})).toBe(false);
    });
});

describe('DN compatibility — max pipe diameter', () => {
    const MAX_DN: Record<string, number> = {
        '1000': 600,
        '1200': 800,
        '1500': 1000,
        '2000': 1600,
        '2500': 2200,
        styczna: 9999
    };

    it('DN1000 → max rura DN600', () => {
        expect(MAX_DN['1000']).toBe(600);
    });
    it('DN1200 → max rura DN800', () => {
        expect(MAX_DN['1200']).toBe(800);
    });
    it('DN1500 → max rura DN1000', () => {
        expect(MAX_DN['1500']).toBe(1000);
    });
    it('DN2000 → max rura DN1600', () => {
        expect(MAX_DN['2000']).toBe(1600);
    });
    it('DN2500 → max rura DN2200', () => {
        expect(MAX_DN['2500']).toBe(2200);
    });
    it('styczna → unlimited', () => {
        expect(MAX_DN['styczna']).toBe(9999);
    });
});
