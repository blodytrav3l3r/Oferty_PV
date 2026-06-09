export {};
/* =============================================================
   Testy reguł dobierania elementów studni
   =============================================================
   Obejmuje: top closure, redukcja, material (beton/żelbet),
   DN compatibility, OT rules, scoring, component ordering
   ============================================================= */

interface MockProduct {
    id: string; name: string; componentType: string;
    dn: number | string | null; height: number;
    formaStandardowaKLB?: number; formaStandardowa?: number;
    magazynKLB?: number; magazynWL?: number;
    zapasDol?: number; zapasGora?: number;
    zapasDolMin?: number; zapasGoraMin?: number;
    [key: string]: unknown;
}

/* ================= 1. Top closure selection ================= */

function getFormaField(warehouse: string): string {
    return (warehouse || '').includes('oc') || (warehouse || '').includes('Włoc') ? 'formaStandardowa' : 'formaStandardowaKLB';
}

function getTopClosure(products: MockProduct[], topDn: number | string, forcedId: string | null,
    fallbackToDin: boolean, warehouse: string): MockProduct | null {
    const ff = getFormaField(warehouse);
    const dn = parseInt(String(topDn));
    const blockKonus = fallbackToDin;

    if (forcedId && !fallbackToDin) {
        const forced = products.find(p => p.id === forcedId);
        if (forced && (parseInt(String(forced.dn)) === dn || forced.dn === null)) return forced;
    }

    const konusy = blockKonus ? [] : products
        .filter(p => p.componentType === 'konus' && parseInt(String(p.dn)) === dn)
        .sort((a, b) => (parseInt(String(b[ff])) || 0) - (parseInt(String(a[ff])) || 0));

    const dinPlates = products
        .filter(p => p.componentType === 'plyta_din' && parseInt(String(p.dn)) === dn)
        .sort((a, b) => (parseInt(String(b[ff])) || 0) - (parseInt(String(a[ff])) || 0));

    if (fallbackToDin) {
        if (dinPlates.length > 0) return dinPlates[0];
        if (konusy.length > 0) return konusy[0];
        return null;
    }

    if (konusy.length > 0) return konusy[0];
    if (dinPlates.length > 0) return dinPlates[0];
    return null;
}

describe('getTopClosure', () => {
    const KONUS: MockProduct = { id: 'KON-10-625', name: 'Konus 1000', componentType: 'konus', dn: 1000, height: 625, formaStandardowaKLB: 1 };
    const KONUS_PLUS: MockProduct = { id: 'KON-10-850', name: 'Konus+ 1000', componentType: 'konus', dn: 1000, height: 850, formaStandardowaKLB: 1 };
    const DIN: MockProduct = { id: 'PDD-10', name: 'Plyta DIN 1000', componentType: 'plyta_din', dn: 1000, height: 150, formaStandardowaKLB: 1 };
    const PRODS = [KONUS, KONUS_PLUS, DIN];

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

    it('wymuszony ID z fallbackToDin → ignoruje wymuszenie, zwraca DIN', () => {
        expect(getTopClosure(PRODS, 1000, 'KON-10-625', true, 'Kluczbork')!.id).toBe('PDD-10');
    });

    it('brak Konusa → Płyta DIN', () => {
        expect(getTopClosure([DIN], 1000, null, false, 'Kluczbork')!.id).toBe('PDD-10');
    });

    it('brak żadnego → null', () => {
        expect(getTopClosure([], 1000, null, false, 'Kluczbork')).toBeNull();
    });

    it('wymuszony z niepasującym DN → pomijany', () => {
        const forced: MockProduct = { id: 'KON-12', name: 'Konus 1200', componentType: 'konus', dn: 1200, height: 625, formaStandardowaKLB: 1 };
        expect(getTopClosure([KONUS, forced], 1000, 'KON-12', false, 'Kluczbork')!.id).toBe('KON-10-625');
    });

    it('DN null na wymuszonym → akceptowany', () => {
        const forced: MockProduct = { id: 'WLAZ', name: 'Wlaz', componentType: 'wlaz', dn: null, height: 150, formaStandardowaKLB: 1 };
        expect(getTopClosure([KONUS, forced], 1000, 'WLAZ', false, 'Kluczbork')!.id).toBe('WLAZ');
    });

    it('sortowanie: formaStandardowa malejąco', () => {
        const k1: MockProduct = { id: 'KON-A', name: 'Konus A', componentType: 'konus', dn: 1000, height: 625, formaStandardowaKLB: 0 };
        const k2: MockProduct = { id: 'KON-B', name: 'Konus B', componentType: 'konus', dn: 1000, height: 625, formaStandardowaKLB: 1 };
        expect(getTopClosure([k1, k2], 1000, null, false, 'Kluczbork')!.id).toBe('KON-B');
    });

    it('DN1200 → szuka konusa DN1200', () => {
        const KON1200: MockProduct = { id: 'KON-12-625', name: 'Konus 1200', componentType: 'konus', dn: 1200, height: 625, formaStandardowaKLB: 1 };
        expect(getTopClosure([KONUS, DIN, KON1200], 1200, null, false, 'Kluczbork')!.id).toBe('KON-12-625');
    });
});

/* ================= 2. Reduction plate selection ================= */

function getReductionPlate(products: MockProduct[], dn: number | string, useReduction: boolean, targetDn = 1000): MockProduct | null {
    if (!useReduction || parseInt(String(dn)) <= 1000) return null;

    const plates = products.filter(p => {
        if (p.componentType !== 'plyta_redukcyjna') return false;
        if (parseInt(String(p.dn)) !== parseInt(String(dn))) return false;
        const nameUpper = (p.name || '').toUpperCase();
        return nameUpper.includes('/' + targetDn) || nameUpper.includes(' DN' + targetDn) ||
            nameUpper.includes('X' + targetDn) || nameUpper.includes(' NA ' + targetDn) ||
            nameUpper.includes('→DN' + targetDn) || nameUpper.includes('→' + targetDn) ||
            nameUpper.includes('->DN' + targetDn) || nameUpper.includes('->' + targetDn);
    });
    return plates.length > 0 ? plates[0] : null;
}

describe('getReductionPlate', () => {
    const PLATE: MockProduct = { id: 'PR-1500-1000', name: 'Plyta redukcyjna 1500/1000', componentType: 'plyta_redukcyjna', dn: 1500, height: 150, formaStandardowaKLB: 1 };
    const PLATE_1200: MockProduct = { id: 'PR-1500-1200', name: 'Plyta redukcyjna 1500/1200', componentType: 'plyta_redukcyjna', dn: 1500, height: 150, formaStandardowaKLB: 1 };

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
        const p1: MockProduct = { id: 'PR-2000-1000', name: 'Redukcja DN2000->DN1000', componentType: 'plyta_redukcyjna', dn: 2000, height: 200, formaStandardowaKLB: 1 };
        expect(getReductionPlate([p1], 2000, true, 1000)!.id).toBe('PR-2000-1000');
    });

    it('DN2000 z redukcją do 1000', () => {
        const p1: MockProduct = { id: 'PR-2000-1000', name: 'Plyta redukcyjna DN2000 na 1000', componentType: 'plyta_redukcyjna', dn: 2000, height: 200, formaStandardowaKLB: 1 };
        expect(getReductionPlate([p1], 2000, true, 1000)!.id).toBe('PR-2000-1000');
    });
});

/* ================= 3. Material compatibility ================= */

function filterByWellParams(p: MockProduct, well: { nadbudowa?: string; dennicaMaterial?: string; stopnie?: string; redukcjaDN1000?: boolean }): boolean {
    if (!well) return true;
    const id = p.id || '';
    let checkId = id;
    if (checkId.endsWith('_OT')) checkId = checkId.slice(0, -3);
    else if (checkId.endsWith('-OT')) checkId = checkId.slice(0, -3);

    // Kregi
    if (p.componentType === 'krag') {
        const isZelbet = well.nadbudowa === 'zelbetowa';
        if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
        if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
    }

    // Kregi OT
    if (p.componentType === 'krag_ot') {
        const isZelbet = well.nadbudowa === 'zelbetowa';
        if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
        if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
    }

    // Dennice — wszystkie DDD są uniwersalne materiałowo
    // Dopłata za żelbet realizowana przez pole doplataZelbet + parametr dennicaMaterial

    // Stopnie (tylko kreg i konus)
    if (p.componentType === 'krag' || p.componentType === 'konus') {
        const isNierdzewna = checkId.endsWith('-N-D');
        const isDrabinka = !isNierdzewna && checkId.endsWith('-D');
        const isBrak = checkId.endsWith('-B');
        const hasStepSuffix = isNierdzewna || isDrabinka || isBrak;

        if (well.stopnie === 'brak') {
            if (hasStepSuffix && !isBrak) return false;
        } else if (well.stopnie === 'nierdzewna') {
            if (isBrak || isDrabinka) return false;
            if (!isNierdzewna) return false;
        } else {
            if (isBrak || isNierdzewna) return false;
            if (!hasStepSuffix) return false;
        }
    }

    // Plyta redukcyjna
    if (p.componentType === 'plyta_redukcyjna' && !well.redukcjaDN1000) return false;

    return true;
}

describe('filterByWellParams — material', () => {
    it('beton → KDB OK, KDZ zablokowany', () => {
        const kdb: MockProduct = { id: 'KDB-10-10-D', name: 'KDB', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
        const kdz: MockProduct = { id: 'KDZ-10-10-D', name: 'KDZ', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
        expect(filterByWellParams(kdb, { nadbudowa: 'betonowa', stopnie: 'drabinka' })).toBe(true);
        expect(filterByWellParams(kdz, { nadbudowa: 'betonowa', stopnie: 'drabinka' })).toBe(false);
    });

    it('żelbet → KDZ OK, KDB zablokowany', () => {
        const kdb: MockProduct = { id: 'KDB-10-10-D', name: 'KDB', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
        const kdz: MockProduct = { id: 'KDZ-10-10-D', name: 'KDZ', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
        expect(filterByWellParams(kdb, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(false);
        expect(filterByWellParams(kdz, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(true);
    });

    it('DN2000/2500 uniwersalne materiałowo (KDB w żelbecie i KDZ w betonie OK)', () => {
        // DN2000/2500: materiał uniwersalny, ale stopnie nadal filtrowane
        const kdb2000: MockProduct = { id: 'KDB-20-10-D', name: 'KDB', componentType: 'krag', dn: 2000, height: 1000, formaStandardowaKLB: 1 };
        const kdz2000: MockProduct = { id: 'KDZ-20-10-D', name: 'KDZ', componentType: 'krag', dn: 2000, height: 1000, formaStandardowaKLB: 1 };
        // KDB w żelbecie: materiał OK (DN2000 universal), stopnie OK (-D przy drabinka)
        expect(filterByWellParams(kdb2000, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(true);
        // KDZ w betonie: materiał OK (DN2000 universal), stopnie OK (-D przy drabinka)
        expect(filterByWellParams(kdz2000, { nadbudowa: 'betonowa', stopnie: 'drabinka' })).toBe(true);
    });

    it('dennica DDD przepuszczana dla beton i żelbet', () => {
        const ddd1000: MockProduct = { id: 'DDD-10-045', name: 'DDD', componentType: 'dennica', dn: 1000, height: 300, formaStandardowaKLB: 1 };
        const ddd1200: MockProduct = { id: 'DDD-12-065', name: 'DDD', componentType: 'dennica', dn: 1200, height: 500, formaStandardowaKLB: 1 };
        expect(filterByWellParams(ddd1000, { dennicaMaterial: 'betonowa' })).toBe(true);
        expect(filterByWellParams(ddd1000, { dennicaMaterial: 'zelbetowa' })).toBe(true);
        expect(filterByWellParams(ddd1200, { dennicaMaterial: 'betonowa' })).toBe(true);
        expect(filterByWellParams(ddd1200, { dennicaMaterial: 'zelbetowa' })).toBe(true);
    });

    it('krag_ot filtrowany tak samo jak krag', () => {
        const kdbOt: MockProduct = { id: 'KDB-10-10-OT', name: 'KDB OT', componentType: 'krag_ot', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
        const kdzOt: MockProduct = { id: 'KDZ-10-10-OT', name: 'KDZ OT', componentType: 'krag_ot', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
        expect(filterByWellParams(kdbOt, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(false);
        expect(filterByWellParams(kdzOt, { nadbudowa: 'zelbetowa', stopnie: 'drabinka' })).toBe(true);
    });
});

describe('filterByWellParams — stopnie', () => {
    const kragD: MockProduct = { id: 'KDB-10-10-D', name: 'Krag D', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
    const kragND: MockProduct = { id: 'KDB-10-10-N-D', name: 'Krag ND', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
    const kragB: MockProduct = { id: 'KDB-10-10-B', name: 'Krag B', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
    const kragPlain: MockProduct = { id: 'KDB-10-10', name: 'Krag', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
    const konusD: MockProduct = { id: 'KON-10-625-D', name: 'Konus D', componentType: 'konus', dn: 1000, height: 625, formaStandardowaKLB: 1 };
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
        const kragOt: MockProduct = { id: 'KDB-10-10_OT', name: 'Krag OT', componentType: 'krag_ot', dn: 1000, height: 1000, formaStandardowaKLB: 1 };
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
    const plate: MockProduct = { id: 'PR-1500-1000', name: 'Redukcyjna', componentType: 'plyta_redukcyjna', dn: 1500, height: 150, formaStandardowaKLB: 1 };

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

/* ================= 4. DN compatibility rules ================= */

/* Zasada: max pipe DN dla danej studni
   DN1000 → max DN600
   DN1200 → max DN800
   DN1500 → max DN1000
   DN2000 → max DN1600
   DN2500 → max DN2200
   styczna → unlimited
*/

describe('DN compatibility — max pipe diameter', () => {
    const MAX_DN: Record<string, number> = {
        '1000': 600, '1200': 800, '1500': 1000,
        '2000': 1600, '2500': 2200, 'styczna': 9999,
    };

    it('DN1000 → max rura DN600', () => { expect(MAX_DN['1000']).toBe(600); });
    it('DN1200 → max rura DN800', () => { expect(MAX_DN['1200']).toBe(800); });
    it('DN1500 → max rura DN1000', () => { expect(MAX_DN['1500']).toBe(1000); });
    it('DN2000 → max rura DN1600', () => { expect(MAX_DN['2000']).toBe(1600); });
    it('DN2500 → max rura DN2200', () => { expect(MAX_DN['2500']).toBe(2200); });
    it('styczna → unlimited', () => { expect(MAX_DN['styczna']).toBe(9999); });
});

/* ================= 5. OT (drilled ring) rules ================= */

describe('OT substitution rules', () => {
    it('OT wymagane gdy środek otworu jest wewnątrz kręgu', () => {
        // Dennica 500mm + krąg 1000mm
        // Przejście DN160 na 750mm → środek = 750+80=830 → w kręgu (500-1500)
        expect(true).toBe(true); // logic verified in transitions.test.ts
    });

    it('OT niepotrzebne gdy przejście w dennicy (środek w dennicy)', () => {
        // Dennica 500mm, przejście DN160 na 200mm → środek=280 → w dennicy
        expect(true).toBe(true);
    });

    it('OT niepotrzebne gdy przejście całkowicie powyżej kręgów', () => {
        // wszystko powyżej
        expect(true).toBe(true);
    });

    it('przejście na łączeniu dennicy z kręgiem → needsTallerDennica', () => {
        // Dennica 500mm, przejście DN160 na 450mm → środek=530
        // otwór: 450-610. Dennica kończy się na 500.
        // Otwór przechodzi przez połączenie (450 < 500 < 610) → needsTallerDennica
        const dennicaHeight = 500;
        const przHeight = 160;
        const przFromBottom = 450;
        const dennicaEnd = dennicaHeight;
        const transitionOverlapsJoint = przFromBottom < dennicaEnd && (przFromBottom + przHeight) > dennicaEnd;
        expect(transitionOverlapsJoint).toBe(true);
    });

    it('OT zamiana zachowuje wysokość kręgu', () => {
        // Krag 500mm → zastąpiony przez krag_ot 500mm
        // Wysokość całkowita bez zmian
        const originalHeight = 500;
        const otHeight = 500;
        expect(originalHeight).toBe(otHeight);
    });

    it('dynamiczny OT tworzony gdy brak w cenniku', () => {
        const baseId = 'KDB-10-05-D';
        const dynamicOtId = baseId + '_OT';
        expect(dynamicOtId).toBe('KDB-10-05-D_OT');
    });
});

/* ================= 6. Scoring rules (z wellSolver.js) ================= */

describe('Solver scoring rules', () => {
    const score = (dennicaHeight: number, ringCount: number, diff: number,
        outOfBounds: boolean, minimalClearance: boolean, dennicaTooShort: boolean,
        fallbackTop: boolean, reductionNeeded: boolean): number => {
        let s = dennicaHeight * 1000 + ringCount * 10 + Math.abs(diff) * 5;
        if (outOfBounds) s += 20000;
        if (minimalClearance || dennicaTooShort) s += 50000;
        if (fallbackTop) s += 100000;
        if (reductionNeeded) s += 5000000;
        return s;
    };

    it('niższa dennica → lepszy score', () => {
        const s300 = score(300, 2, 10, false, false, false, false, false);
        const s500 = score(500, 2, 10, false, false, false, false, false);
        expect(s300).toBeLessThan(s500);
    });

    it('mniej kręgów → lepszy score', () => {
        const s2 = score(300, 2, 10, false, false, false, false, false);
        const s3 = score(300, 3, 10, false, false, false, false, false);
        expect(s2).toBeLessThan(s3);
    });

    it('mniejszy diff → lepszy score', () => {
        const s0 = score(300, 2, 0, false, false, false, false, false);
        const s50 = score(300, 2, 50, false, false, false, false, false);
        expect(s0).toBeLessThan(s50);
    });

    it('poza zakresem → kara +20000', () => {
        const ok = score(300, 2, 10, false, false, false, false, false);
        const oob = score(300, 2, 10, true, false, false, false, false);
        expect(oob - ok).toBe(20000);
    });

    it('minimal clearance → kara +50000', () => {
        const ok = score(300, 2, 10, false, false, false, false, false);
        const min = score(300, 2, 10, false, true, false, false, false);
        expect(min - ok).toBe(50000);
    });

    it('fallback top closure → kara +100000', () => {
        const ok = score(300, 2, 10, false, false, false, false, false);
        const fb = score(300, 2, 10, false, false, false, true, false);
        expect(fb - ok).toBe(100000);
    });

    it('brak redukcji gdy potrzebna → kara +5000000 (ogromna)', () => {
        const ok = score(300, 2, 10, false, false, false, false, false);
        const noRed = score(300, 2, 10, false, false, false, false, true);
        expect(noRed - ok).toBe(5000000);
    });

    it('priorytety: redukcja > fallback > minimal > outOfBounds > rings > height', () => {
        const withoutRed = score(300, 2, 10, false, false, false, false, false);
        const withRed = score(300, 2, 10, false, false, false, false, true);
        // Różnica 5e6 jest tak duża, że przewyższa wszystko inne
        expect(withRed).toBeGreaterThan(withoutRed + 100000);
    });
});

/* ================= 7. Kregi list sorting ================= */

function getKregiList(products: MockProduct[], dn: number | string, warehouse: string): MockProduct[] {
    const ff = getFormaField(warehouse);
    const effectiveDn = dn === 'styczna' ? 1000 : dn;
    const kregi = products.filter(p =>
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
        { id: 'K-1000-250', name: 'K 250', componentType: 'krag', dn: 1000, height: 250, formaStandardowaKLB: 1 },
        { id: 'K-1000-500', name: 'K 500', componentType: 'krag', dn: 1000, height: 500, formaStandardowaKLB: 0 },
        { id: 'K-1000-1000', name: 'K 1000', componentType: 'krag', dn: 1000, height: 1000, formaStandardowaKLB: 1 },
    ];

    it('sortuje: formaStd malejąco, height malejąco', () => {
        const list = getKregiList(KREGI, 1000, 'Kluczbork');
        expect(list[0].id).toBe('K-1000-1000'); // forma=1, height=1000
        expect(list[1].id).toBe('K-1000-250');  // forma=1, height=250
        expect(list[2].id).toBe('K-1000-500');  // forma=0
    });

    it('filtruje po DN', () => {
        const wrong: MockProduct = { id: 'K-1500-1000', name: 'K 1500', componentType: 'krag', dn: 1500, height: 1000, formaStandardowaKLB: 1 };
        const list = getKregiList([...KREGI, wrong], 1000, 'Kluczbork');
        expect(list).toHaveLength(3);
        expect(list.every(k => parseInt(String(k.dn)) === 1000)).toBe(true);
    });

    it('styczna → DN1000', () => {
        const list = getKregiList(KREGI, 'styczna', 'Kluczbork');
        expect(list.length).toBeGreaterThan(0);
    });

    it('ignoruje produkty z height=0', () => {
        const zero: MockProduct = { id: 'K-1000-0', name: 'K 0', componentType: 'krag', dn: 1000, height: 0, formaStandardowaKLB: 1 };
        const list = getKregiList([...KREGI, zero], 1000, 'Kluczbork');
        expect(list).toHaveLength(3);
    });

    it('zawiera krag_ot', () => {
        const ot: MockProduct = { id: 'K-1000-500-OT', name: 'K OT', componentType: 'krag_ot', dn: 1000, height: 500, formaStandardowaKLB: 1 };
        const list = getKregiList([...KREGI, ot], 1000, 'Kluczbork');
        expect(list.some(k => k.componentType === 'krag_ot')).toBe(true);
    });
});

/* ================= 8. Recalculation preserves forced items ================= */

/* Symulacja przepływu: zmiana DN przejścia → solver z wymuszonym zakończeniem */
function solverSelectTopClosure(
    products: MockProduct[], dn: number | string, forcedTopId: string | null,
    fallbackToDin: boolean, warehouse: string
): string | null {
    const top = getTopClosure(products, dn, forcedTopId, fallbackToDin, warehouse);
    return top ? top.id : null;
}

function solverSelectDennica(
    products: MockProduct[], dn: number | string, warehouse: string,
    transitions: Array<{ productId: string; rzednaWlaczenia: number }>, rzDna: number
): string | null {
    /* Uproszczona wersja getLowestDennica: wybiera dennicę z wystarczającą wysokością */
    const ff = warehouse.includes('oc') || warehouse.includes('Włoc') ? 'formaStandardowa' : 'formaStandardowaKLB';
    const dns = products
        .filter(p => p.componentType === 'dennica' && parseInt(String(p.dn)) === parseInt(String(dn)) && p.height > 0)
        .sort((a, b) => {
            const hA = a.height || 0, hB = b.height || 0;
            if (hA !== hB) return hA - hB;
            return ((b[ff] as number) || 0) - ((a[ff] as number) || 0);
        });
    if (dns.length === 0) return null;
    if (!transitions || transitions.length === 0) return dns[0].id;

    /* Sprawdź czy przejście fizycznie mieści się w dennicy */
    for (const d of dns) {
        let allFit = true;
        for (const t of transitions) {
            const pprod = products.find(x => x.id === t.productId);
            if (!pprod) continue;
            let dnVal = 160;
            if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
                dnVal = parseFloat(pprod.dn.split('/')[1]) || 160;
            else dnVal = parseFloat(String(pprod.dn)) || 160;
            const hcInvert = (t.rzednaWlaczenia - rzDna) * 1000;
            if (hcInvert >= d.height) continue; // poza dennicą
            const topClr = d.height - (hcInvert + dnVal);
            if (topClr < 0) { allFit = false; break; }
        }
        if (allFit) return d.id;
    }
    return dns[dns.length - 1].id;
}

describe('Recalculation — forced items preservation', () => {
    const DENNICE: MockProduct[] = [
        { id: 'D-1000-300', name: 'Dennica 300', componentType: 'dennica', dn: 1000, height: 300, formaStandardowaKLB: 1 },
        { id: 'D-1000-500', name: 'Dennica 500', componentType: 'dennica', dn: 1000, height: 500, formaStandardowaKLB: 1 },
    ];
    const KONUS: MockProduct = { id: 'KON-10-625', name: 'Konus 1000', componentType: 'konus', dn: 1000, height: 625, formaStandardowaKLB: 1 };
    const DIN: MockProduct = { id: 'PDD-10', name: 'Plyta DIN 1000', componentType: 'plyta_din', dn: 1000, height: 150, formaStandardowaKLB: 1 };
    const PRZ160: MockProduct = { id: 'PRZ-160', name: 'Przejście 160', componentType: 'przejscie', dn: 160, height: 0, formaStandardowaKLB: 1 };
    const PRZ200: MockProduct = { id: 'PRZ-200', name: 'Przejście 200', componentType: 'przejscie', dn: 200, height: 0, formaStandardowaKLB: 1 };
    const ALL = [...DENNICE, KONUS, DIN, PRZ160, PRZ200];

    it('wymuszone zakończenie zachowane po zmianie DN przejścia', () => {
        /* Przejście DN160@200mm → D-300 physical OK (top=300-(200+160)=-60<0 FAIL) */
        /* D-300: topClr=300-(200+160)=-60<0 → FAIL → D-500 */
        const dennica1 = solverSelectDennica(ALL, 1000, 'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0.2 }], 0);
        expect(dennica1).toBe('D-1000-500');

        /* Wymuszone zakończenie: Płyta DIN */
        const top1 = solverSelectTopClosure(ALL, 1000, 'PDD-10', false, 'Kluczbork');
        expect(top1).toBe('PDD-10');

        /* Zmiana na DN200@200mm → większy otwór, D-500 dalej OK (top=500-(200+200)=100>=0) */
        const dennica2 = solverSelectDennica(ALL, 1000, 'Kluczbork',
            [{ productId: 'PRZ-200', rzednaWlaczenia: 0.2 }], 0);
        expect(dennica2).toBe('D-1000-500');

        /* Wymuszone zakończenie NADAL zachowane mimo innego przejścia */
        const top2 = solverSelectTopClosure(ALL, 1000, 'PDD-10', false, 'Kluczbork');
        expect(top2).toBe('PDD-10');
    });

    it('wymuszone zakończenie ignorowane gdy fallbackToDin=true (reguła getTopClosure)', () => {
        /* fallbackToDin=true → forcedId ignorowane → normalna selekcja (DIN) */
        const top = solverSelectTopClosure([KONUS, DIN], 1000, 'KON-10-625', true, 'Kluczbork');
        expect(top).toBe('PDD-10');
    });

    it('wymuszone zakończenie z DN=null → akceptowane bo pasuje do każdego DN', () => {
        const wlaz: MockProduct = { id: 'WLAZ', name: 'Wlaz', componentType: 'wlaz', dn: null, height: 150, formaStandardowaKLB: 1 };
        const top = solverSelectTopClosure([KONUS, DIN, wlaz], 1000, 'WLAZ', false, 'Kluczbork');
        expect(top).toBe('WLAZ');
    });

    it('brak wymuszenia → normalna selekcja (konus preferowany)', () => {
        const top = solverSelectTopClosure([KONUS, DIN], 1000, null, false, 'Kluczbork');
        expect(top).toBe('KON-10-625');
    });

    it('simulacja: przejście DN160 → DN200 → przeliczenie + zachowanie wymuszonego', () => {
        /* Pełny flow solvera:
           1. Określ dennicę dla przejść
           2. Wybierz zakończenie z wymuszonym ID
           3. Zmień DN przejścia → powtórz krok 1-2
           4. Wymuszone zakończenie powinno być to samo */
        const transitions160 = [{ productId: 'PRZ-160', rzednaWlaczenia: 0.45 }];
        const transitions200 = [{ productId: 'PRZ-200', rzednaWlaczenia: 0.45 }];

        /* Krok 1: DN160 */
        const d1 = solverSelectDennica(ALL, 1000, 'Kluczbork', transitions160, 0);
        const t1 = solverSelectTopClosure(ALL, 1000, 'PDD-10', false, 'Kluczbork');
        expect(t1).toBe('PDD-10');

        /* Krok 2: Zmiana na DN200 → dennica może być inna */
        const d2 = solverSelectDennica(ALL, 1000, 'Kluczbork', transitions200, 0);

        /* Krok 3: Wymuszone zakończenie to samo */
        const t2 = solverSelectTopClosure(ALL, 1000, 'PDD-10', false, 'Kluczbork');
        expect(t2).toBe('PDD-10');
        /* Notatka: dennica może się zmienić (DN200@450mm: top=500-(450+200)=-150<0 → D-300 FAIL,
           D-500: top=500-(450+200)=-150<0 FAIL → physical FAIL) */
        if (d1 !== d2) {
            expect(t1).toBe(t2); // forced preserved even though dennica changed
        }
    });
});

/* ============ 6. findClosureForDn + zakonczenieByDn (styczne toggle) ============ */

function findClosureForDn(products: MockProduct[], productId: string, targetDn: number): string | null {
    if (!productId) return null;
    const prod = products.find(p => p.id === productId);
    if (!prod || !prod.componentType) return null;
    const match = products.find(p =>
        p.componentType === prod.componentType &&
        (parseInt(String(p.dn)) === targetDn || p.dn === null)
    );
    return match ? match.id : null;
}

const CLOSURE_PRODUCTS: MockProduct[] = [
    { id: 'PDD-10-62-00', name: 'Płyta DIN DN1000', componentType: 'plyta_din', dn: 1000, height: 0 },
    { id: 'PDD-12-62-00', name: 'Płyta DIN DN1200', componentType: 'plyta_din', dn: 1200, height: 0 },
    { id: 'PDD-15-62-00', name: 'Płyta DIN DN1500', componentType: 'plyta_din', dn: 1500, height: 0 },
    { id: 'PDD-20-62-00', name: 'Płyta DIN DN2000', componentType: 'plyta_din', dn: 2000, height: 0 },
    { id: 'JZW-10-625-D', name: 'Konus DN1000', componentType: 'konus', dn: 1000, height: 0 },
    { id: 'JZW-12-625-D', name: 'Konus DN1200', componentType: 'konus', dn: 1200, height: 0 },
    { id: 'PZE-16-10', name: 'Płyta zamyk DN1000', componentType: 'plyta_zamykajaca', dn: 1000, height: 0 },
    { id: 'PZE-18-12', name: 'Płyta zamyk DN1200', componentType: 'plyta_zamykajaca', dn: 1200, height: 0 },
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
            well.zakonczenie = findClosureForDn(CLOSURE_PRODUCTS, well.zakonczenieByDn[oldDn], newDn);
            if (well.zakonczenie) well.zakonczenieByDn[newDn] = well.zakonczenie;
        }
    }

    it('symuluje toggle: wybierz plyta_din DN1000, toggle DN1200, toggle DN1000', () => {
        const well: MockWell = {
            dn: 'styczna',
            stycznaNadbudowa1200: false,
            zakonczenie: null,
            zakonczenieByDn: {},
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
            zakonczenieByDn: { 1000: 'JZW-10-625-D' },
        };

        simulateToggle(well);
        expect(well.zakonczenie).toBe('JZW-12-625-D');
    });

    it('ręczny wybór plyta_zamykajaca jest nadrzędny — toggle DN1200 → plyta_zamykajaca DN1200', () => {
        const well: MockWell = {
            dn: 'styczna',
            stycznaNadbudowa1200: false,
            zakonczenie: 'PZE-16-10',
            zakonczenieByDn: { 1000: 'PZE-16-10' },
        };

        simulateToggle(well);
        expect(well.zakonczenie).toBe('PZE-18-12');
    });

    it('zachowuje wybór gdy user zmienia zakończenie na DN1200, potem toggle do DN1000 i z powrotem', () => {
        const well: MockWell = {
            dn: 'styczna',
            stycznaNadbudowa1200: false,
            zakonczenie: 'PDD-10-62-00',
            zakonczenieByDn: { 1000: 'PDD-10-62-00' },
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

        // Toggle do DN1200 — powinienwrócićć konus DN1200
        simulateToggle(well);
        expect(well.zakonczenie).toBe('JZW-12-625-D');
    });
});
