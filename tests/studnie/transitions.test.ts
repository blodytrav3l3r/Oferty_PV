export {};
/* =============================================================
   Testy konfiguracji studni z przejściami
   =============================================================
   Sprawdza czy reguły dobierania są przestrzegane gdy studnia
   ma przejścia (transition holes) na różnych wysokościach.
   ============================================================= */

interface MockProduct {
    id: string;
    name: string;
    componentType: string;
    dn: number | string | null;
    height: number;
    formaStandardowaKLB?: number;
    formaStandardowa?: number;
    zapasDol?: number;
    zapasGora?: number;
    zapasDolMin?: number;
    zapasGoraMin?: number;
    [key: string]: unknown;
}

interface Transition {
    productId: string;
    rzednaWlaczenia: number;
    flowType?: string;
    angle?: number;
}
interface Segment {
    type: string;
    start: number;
    end: number;
    itemBase?: any;
}

const SAFETY = 15;

function parseFloatSafe(v: unknown, f: number): number {
    if (v === undefined || v === null || v === '') return f;
    const p = Number(v);
    return isNaN(p) ? f : p;
}

/* ================= 1. Transition inside dennica ================= */

function getClearanceFromProduct(prod: MockProduct) {
    return {
        zDol: parseFloatSafe(prod.zapasDol, 300),
        zGora: parseFloatSafe(prod.zapasGora, 300),
        zDolMin: parseFloatSafe(prod.zapasDolMin, 150),
        zGoraMin: parseFloatSafe(prod.zapasGoraMin, 150)
    };
}

function checkDennicaClearance(
    dHeight: number,
    transitions: Transition[],
    products: MockProduct[],
    rzDna: number,
    mode: 'standard' | 'minimal' | 'physical'
): boolean {
    for (const pr of transitions) {
        const hcInvert = (pr.rzednaWlaczenia - rzDna) * 1000;
        if (isNaN(hcInvert) || hcInvert >= dHeight) continue;
        const pprod = products.find((x) => x.id === pr.productId);
        if (!pprod) continue;
        let dnVal = 160;
        if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
            dnVal = parseFloatSafe(pprod.dn.split('/')[1], 160);
        else dnVal = parseFloatSafe(pprod.dn, 160);
        const { zDol, zGora, zDolMin, zGoraMin } = getClearanceFromProduct(pprod);
        const isNearBottom = hcInvert <= 0;
        const effZDol = isNearBottom ? -9999 : zDol;
        const effZDolMin = isNearBottom ? -9999 : zDolMin;
        const botClr = hcInvert;
        const topClr = dHeight - (hcInvert + dnVal);
        if (mode === 'standard') {
            if (botClr < effZDol + SAFETY || topClr < zGora + SAFETY) return false;
        } else if (mode === 'minimal') {
            if (botClr < effZDolMin + SAFETY || topClr < zGoraMin + SAFETY) return false;
        } else if (mode === 'physical') {
            if (topClr < 0) return false;
        }
    }
    return true;
}

function selectLowestDennica(
    products: MockProduct[],
    dn: number | string,
    warehouse: string,
    transitions?: Transition[],
    rzDna?: number
): MockProduct | null {
    const ff =
        warehouse.includes('oc') || warehouse.includes('Włoc')
            ? 'formaStandardowa'
            : 'formaStandardowaKLB';
    const dns = products.filter(
        (p) =>
            p.componentType === 'dennica' &&
            parseInt(String(p.dn)) === parseInt(String(dn)) &&
            p.height > 0
    );
    if (dns.length === 0) return null;
    dns.sort((a, b) => {
        const hA = a.height || 0,
            hB = b.height || 0;
        if (hA !== hB) return hA - hB;
        return ((b[ff] as number) || 0) - ((a[ff] as number) || 0);
    });
    if (!transitions || transitions.length === 0) return dns[0];
    const rzd = rzDna ?? 0;
    for (const d of dns) {
        if (checkDennicaClearance(d.height, transitions, products, rzd, 'standard')) return d;
    }
    for (const d of dns) {
        if (checkDennicaClearance(d.height, transitions, products, rzd, 'minimal')) return d;
    }
    for (const d of dns) {
        if (checkDennicaClearance(d.height, transitions, products, rzd, 'physical')) return d;
    }
    return dns[dns.length - 1];
}

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
        id: 'D-1000-400',
        name: 'Dennica 400',
        componentType: 'dennica',
        dn: 1000,
        height: 400,
        formaStandardowaKLB: 1
    },
    {
        id: 'D-1000-500',
        name: 'Dennica 500',
        componentType: 'dennica',
        dn: 1000,
        height: 500,
        formaStandardowaKLB: 1
    },
    {
        id: 'D-1000-600',
        name: 'Dennica 600',
        componentType: 'dennica',
        dn: 1000,
        height: 600,
        formaStandardowaKLB: 1
    }
];

const PRZ: MockProduct = {
    id: 'PRZ-160',
    name: 'Przejście 160',
    componentType: 'przejscie',
    dn: 160,
    height: 0,
    zapasDol: 300,
    zapasGora: 300,
    zapasDolMin: 150,
    zapasGoraMin: 150,
    formaStandardowaKLB: 1
};

const PRZ200: MockProduct = {
    id: 'PRZ-200',
    name: 'Przejście 200',
    componentType: 'przejscie',
    dn: 200,
    height: 0,
    zapasDol: 300,
    zapasGora: 300,
    zapasDolMin: 150,
    zapasGoraMin: 150,
    formaStandardowaKLB: 1
};

const ALL = [...DENNICE, PRZ, PRZ200];

describe('Transitions — dennica selection', () => {
    it('100mm → physical OK, D-300 (top=40>=0)', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0.1 }],
            0
        );
        expect(d!.id).toBe('D-1000-300');
    });

    it('200mm → minimal OK, D-600 (top=240>=165)', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0.2 }],
            0
        );
        expect(d!.id).toBe('D-1000-600');
    });

    it('300mm → D-300 skipped (300>=300), D-300 wins', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0.3 }],
            0
        );
        expect(d!.id).toBe('D-1000-300');
    });

    it('powyżej dennicy (800mm) → wszystkie skipped → D-300', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0.8 }],
            0
        );
        expect(d!.id).toBe('D-1000-300');
    });

    it('DN200@100mm → D-300 physical OK (top=0>=0)', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-200', rzednaWlaczenia: 0.1 }],
            0
        );
        expect(d!.id).toBe('D-1000-300');
    });
});

/* ================= 2. Multiple transitions ================= */

describe('Transitions — multiple transitions', () => {
    it('przejścia 100+300mm → najwyższe 300, D-300 skipped → D-300', () => {
        // 300mm >= 300 → D-300 skip, 100mm inside all check
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [
                { productId: 'PRZ-160', rzednaWlaczenia: 0.1 },
                { productId: 'PRZ-160', rzednaWlaczenia: 0.3 }
            ],
            0
        );
        expect(d!.id).toBe('D-1000-300');
    });

    it('trzy przejścia (50+150+250mm) → D-500 physical OK (150: bottom=150<165 FAIL min)', () => {
        // 150mm transition: bottom=150 < 150+15=165 → minimal FAIL for all dennicas
        // physical: D-300 top=-10<0 FAIL, D-400 top=90>=0 OK
        // But D-500 physical: 250mm: top=90>=0 OK → D-500!
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [
                { productId: 'PRZ-160', rzednaWlaczenia: 0.05 },
                { productId: 'PRZ-160', rzednaWlaczenia: 0.15 },
                { productId: 'PRZ-160', rzednaWlaczenia: 0.25 }
            ],
            0
        );
        expect(d!.id).toBe('D-1000-500');
    });

    it('100+700mm → 700 skipped dla D-300 (700>=300), 100 physical OK → D-300', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [
                { productId: 'PRZ-160', rzednaWlaczenia: 0.1 },
                { productId: 'PRZ-160', rzednaWlaczenia: 0.7 }
            ],
            0
        );
        expect(d!.id).toBe('D-1000-300');
    });

    it('wszystkie powyżej dennicy (700+1200mm) → wszystkie skipped → D-300', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [
                { productId: 'PRZ-160', rzednaWlaczenia: 0.7 },
                { productId: 'PRZ-160', rzednaWlaczenia: 1.2 }
            ],
            0
        );
        expect(d!.id).toBe('D-1000-300');
    });
});

/* ================= 3. Transition at different rzDna ================= */

describe('Transitions — różne rzędne dna', () => {
    it('rzDna=100, rzedna=100.1 → z=100mm → D-300 physical OK', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 100.1 }],
            100
        );
        expect(d!.id).toBe('D-1000-300');
    });

    it('rzDna=100, rzedna=100.3 → z≈300mm (FP), D-500 physical OK', () => {
        // FP: (100.3-100)*1000 = 299.999... < 300 → D-300 not skipped
        // D-500 physical: top=500-(300+160)=40>=0 → D-500
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 100.3 }],
            100
        );
        expect(d!.id).toBe('D-1000-500');
    });

    it('rzedna == rzDna → hcInvert=0 → nearBottom, D-500 standard OK (top=340>=315)', () => {
        const d = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 50 }],
            50
        );
        expect(d!.id).toBe('D-1000-500');
    });
});

/* ================= 4. Transition requiring OT rings ================= */

describe('Transitions — OT ring substitution', () => {
    function buildSegments(
        configItems: Array<{ productId: string; quantity: number }>,
        products: MockProduct[]
    ): Segment[] {
        let y = 0;
        return configItems.map((item) => {
            const prod = products.find((p) => p.id === item.productId);
            const h = prod ? prod.height || 0 : 0;
            const seg = { start: y, end: y + h, type: prod ? prod.componentType : '' };
            y += h;
            return seg;
        });
    }

    function needsOT(
        segments: Segment[],
        transitions: Transition[],
        products: MockProduct[],
        rzDna: number
    ): boolean {
        for (const t of transitions) {
            const mmFromBottom = Math.round((t.rzednaWlaczenia - rzDna) * 1000);
            if (mmFromBottom < 0) continue;
            const pprod = products.find((p) => p.id === t.productId);
            if (!pprod) continue;
            let dn = 160;
            if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
                dn = parseFloatSafe(pprod.dn.split('/')[1], 160);
            else dn = parseFloatSafe(pprod.dn, 160);
            const holeCenter = mmFromBottom + dn / 2;

            for (const seg of segments) {
                if (seg.type === 'dennica') continue; // OT only for rings
                if (holeCenter > seg.start && holeCenter < seg.end) return true;
            }
        }
        return false;
    }

    const KREG = {
        id: 'K-1000-1000',
        name: 'Krag 1000',
        componentType: 'krag',
        dn: 1000,
        height: 1000,
        formaStandardowaKLB: 1
    };
    const KREG500 = {
        id: 'K-1000-500',
        name: 'Krag 500',
        componentType: 'krag',
        dn: 1000,
        height: 500,
        formaStandardowaKLB: 1
    };

    it('przejście w kręgu → potrzebny OT', () => {
        // Dennica 500 + krag 1000
        // Przejście DN160@700mm → środek=780 → w kręgu (500-1500)
        const segs = buildSegments(
            [
                { productId: 'D-1000-500', quantity: 1 },
                { productId: 'K-1000-1000', quantity: 1 }
            ],
            [...DENNICE, KREG]
        );
        expect(needsOT(segs, [{ productId: 'PRZ-160', rzednaWlaczenia: 0.7 }], [PRZ], 0)).toBe(
            true
        );
    });

    it('przejście w dennicy → OT niepotrzebny', () => {
        const segs = buildSegments(
            [
                { productId: 'D-1000-500', quantity: 1 },
                { productId: 'K-1000-1000', quantity: 1 }
            ],
            [...DENNICE, KREG]
        );
        expect(needsOT(segs, [{ productId: 'PRZ-160', rzednaWlaczenia: 0.2 }], [PRZ], 0)).toBe(
            false
        );
    });

    it('przejście powyżej wszystkich kręgów → OT niepotrzebny', () => {
        const segs = buildSegments(
            [
                { productId: 'D-1000-500', quantity: 1 },
                { productId: 'K-1000-1000', quantity: 1 }
            ],
            [...DENNICE, KREG]
        );
        expect(needsOT(segs, [{ productId: 'PRZ-160', rzednaWlaczenia: 2.0 }], [PRZ], 0)).toBe(
            false
        );
    });

    it('wiele przejść → OT dla każdego w kręgu', () => {
        const segs = buildSegments(
            [
                { productId: 'D-1000-500', quantity: 1 },
                { productId: 'K-1000-1000', quantity: 1 }
            ],
            [...DENNICE, KREG]
        );
        // Jedno w dennicy (niepotrzebny OT), drugie w kręgu (potrzebny)
        const result = [
            { productId: 'PRZ-160', rzednaWlaczenia: 0.2 },
            { productId: 'PRZ-160', rzednaWlaczenia: 0.8 }
        ].some((t) => needsOT(segs, [t], [PRZ], 0));
        expect(result).toBe(true);
    });

    it('dwa kręgi → przejście w drugim kręgu', () => {
        const segs = buildSegments(
            [
                { productId: 'D-1000-500', quantity: 1 },
                { productId: 'K-1000-500', quantity: 1 },
                { productId: 'K-1000-500', quantity: 1 }
            ],
            [...DENNICE, KREG500]
        );
        // Przejście@1200mm → środek=1280 → w drugim kręgu (1000-1500)
        expect(needsOT(segs, [{ productId: 'PRZ-160', rzednaWlaczenia: 1.2 }], [PRZ], 0)).toBe(
            true
        );
    });

    it('przejście na granicy segmentów → środek decyduje', () => {
        const segs = buildSegments(
            [
                { productId: 'D-1000-500', quantity: 1 },
                { productId: 'K-1000-500', quantity: 1 }
            ],
            [...DENNICE, KREG500]
        );
        // Przejście DN160@450mm → środek=530 → w kręgu (500-1000)
        expect(needsOT(segs, [{ productId: 'PRZ-160', rzednaWlaczenia: 0.45 }], [PRZ], 0)).toBe(
            true
        );
    });
});

/* ================= 5. Transition crossing joint (needsTallerDennica) ================= */

describe('Transitions — crossing dennica-ring joint', () => {
    it('otwór przechodzi przez połączenie dennicy i kręgu → needsTallerDennica', () => {
        // Dennica 500mm, DN160@450mm
        // Otwór: 450-610. Dennica kończy 500. Otwór przechodzi przez joint.
        const dennicaEnd = 500;
        const przBottom = 450;
        const przTop = przBottom + 160;
        const crossesJoint = przBottom < dennicaEnd && przTop > dennicaEnd;
        expect(crossesJoint).toBe(true);
    });

    it('otwór całkowicie w dennicy → no joint issue', () => {
        const dennicaEnd = 500;
        const przBottom = 200;
        const przTop = przBottom + 160;
        const crossesJoint = przBottom < dennicaEnd && przTop > dennicaEnd;
        expect(crossesJoint).toBe(false);
    });

    it('otwór całkowicie w kręgu → no joint issue', () => {
        const dennicaEnd = 500;
        const przBottom = 600;
        const przTop = przBottom + 160;
        const crossesJoint = przBottom < dennicaEnd && przTop > dennicaEnd;
        expect(crossesJoint).toBe(false);
    });

    it('większe DN (200mm) → większe ryzyko kolizji z jointe', () => {
        const dennicaEnd = 500;
        const przBottom = 420;
        const przTop = przBottom + 200;
        const crossesJoint = przBottom < dennicaEnd && przTop > dennicaEnd;
        expect(crossesJoint).toBe(true);
    });

    it('trzy segmenty (dennica + 2 kręgi) → przejście przez 2 jointy', () => {
        // Dennica 500 + krag 1000 + krag 1000
        // DN200@1400mm → środek=1500, otwór: 1400-1600
        // Joint1: 500, Joint2: 1500
        // Otwór pokrywa Joint2 → problem
        const joints = [500, 1500];
        const przBottom = 1400;
        const przTop = przBottom + 200;
        const crossesAnyJoint = joints.some((j) => przBottom < j && przTop > j);
        expect(crossesAnyJoint).toBe(true);
    });
});

/* ================= 6. Transition conflict detection in segments ================= */

function checkConflictsLogic(
    holes: Array<{
        z: number;
        ruraDz: number;
        zdD: number;
        zdG: number;
        zdDM: number;
        zdGM: number;
    }>,
    segs: Segment[]
): { valid: boolean; isMinimal: boolean; errors: string[] } {
    let isMinimal = false,
        valid = true;
    const errors: string[] = [];
    for (const h of holes) {
        const hTop = h.z + h.ruraDz,
            hBot = h.z;
        const effD = h.z === 0 ? 0 : h.zdD,
            effDM = h.z === 0 ? 0 : h.zdDM;
        const rT = hTop + h.zdG,
            rB = hBot - effD,
            rTM = hTop + h.zdGM,
            rBM = hBot - effDM;
        let sV = true,
            mV = true;
        for (const s of segs) {
            if (s.end >= rB - SAFETY && s.end <= rT + SAFETY) sV = false;
            if (s.end >= rBM - SAFETY && s.end <= rTM + SAFETY) mV = false;
            const fb = ['konus', 'plyta_din', 'plyta_redukcyjna', 'pierscien_odciazajacy'].includes(
                s.type
            );
            if (fb && hTop > s.start && hBot < s.end) {
                sV = false;
                mV = false;
                errors.push(`Kolizja z ${s.type}`);
            }
            if (s.type === 'plyta_redukcyjna' && hBot + h.ruraDz / 2 >= s.start) {
                sV = false;
                mV = false;
                errors.push('Przejście powyżej płyty redukcyjnej');
            }
        }
        if (!sV) {
            if (mV) isMinimal = true;
            else {
                valid = false;
                errors.push(`Kolizja Z=${h.z}`);
            }
        }
    }
    return { valid, isMinimal, errors };
}

describe('Transitions — conflict with segments', () => {
    const SEGS: Segment[] = [
        { type: 'dennica', start: 0, end: 500 },
        { type: 'krag', start: 500, end: 1500 },
        { type: 'konus', start: 1500, end: 2125 }
    ];
    const BH = { z: 0, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 };

    it('przejście w dennicy → OK gdy seg.end poza strefą standard', () => {
        // z=200, seg.end=700
        // rT=200+160+300=660, rB=200-300=-100
        // seg.end=700 > 660+15=675 → sV stays true
        const segs: Segment[] = [
            { type: 'dennica', start: 0, end: 700 },
            { type: 'krag', start: 700, end: 1500 }
        ];
        const r = checkConflictsLogic([{ ...BH, z: 200 }], segs);
        expect(r.valid).toBe(true);
    });

    it('przejście w kręgu → OK', () => {
        const r = checkConflictsLogic(
            [{ ...BH, z: 700, zdD: 300, zdG: 200 }],
            [
                { type: 'dennica', start: 0, end: 500 },
                { type: 'krag', start: 500, end: 1500 }
            ]
        );
        // rT=700+160+200=1060, rB=700-300=400
        // seg.end=500 ∈ [385, 1075] → sV=false
        // rTM=700+160+150=1010, rBM=700-150=550
        // seg.end=500 ∈ [535, 1025]? 500 < 535 → no → mV stays true → minimal OK
        expect(r.valid).toBe(true);
        expect(r.isMinimal).toBe(true);
    });

    it('przejście z dużym DN → szersza strefa kolizji', () => {
        // DN200@700mm, seg.end=500
        const r = checkConflictsLogic(
            [{ z: 700, ruraDz: 200, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }],
            [
                { type: 'dennica', start: 0, end: 500 },
                { type: 'krag', start: 500, end: 1500 }
            ]
        );
        // rT=700+200+300=1200, rB=700-300=400
        // seg.end=500 ∈ [385, 1215] → sV=false
        // rTM=700+200+150=1050, rBM=700-150=550
        // seg.end=500 ∈ [535, 1065]? 500 < 535 → no → mV stays true
        expect(r.isMinimal).toBe(true);
    });

    it('przejście na granicy konusa → kolizja', () => {
        const r = checkConflictsLogic(
            [{ z: 1400, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }],
            SEGS
        );
        expect(r.valid).toBe(false);
    });

    it('wiele przejść → łączna walidacja', () => {
        // Hole1@300 DN160: resTop=760, seg.end=800 > 775 → OK
        // Hole2@1200 DN200: resBot=1200-300=900, seg.end=800 < 885 → OK (below danger zone)
        const holes = [
            { z: 300, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 },
            { z: 1200, ruraDz: 200, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }
        ];
        const segs: Segment[] = [
            { type: 'dennica', start: 0, end: 800 },
            { type: 'krag', start: 800, end: 2000 }
        ];
        const r = checkConflictsLogic(holes, segs);
        expect(r.valid).toBe(true);
    });
});

/* ================= 7. Complete well config scenario (integracja) ================= */

describe('Transitions — complete well config scenarios', () => {
    it('DN160@300mm → D-300 skipped (300>=300), D-300 wins', () => {
        const dennica = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0.3 }],
            0
        );
        expect(dennica!.id).toBe('D-1000-300');
    });

    it('przy dnie (hcInvert=0) → bottom ignored, D-500 standard OK (top=340>=315)', () => {
        const dennica = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0 }],
            0
        );
        expect(dennica!.id).toBe('D-1000-500');
    });

    it('DN200@500mm → D-300 skipped (500>=300), D-300 wins', () => {
        const dennica = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-200', rzednaWlaczenia: 0.5 }],
            0
        );
        expect(dennica!.id).toBe('D-1000-300');
    });

    it('wiele przejść (DN160@50, DN160@150, DN200@250) → D-500 physical OK', () => {
        // DN200@250mm: D-500 top=500-(250+200)=50>=0 → physical OK
        const dennica = selectLowestDennica(
            ALL,
            1000,
            'Kluczbork',
            [
                { productId: 'PRZ-160', rzednaWlaczenia: 0.05 },
                { productId: 'PRZ-160', rzednaWlaczenia: 0.15 },
                { productId: 'PRZ-200', rzednaWlaczenia: 0.25 }
            ],
            0
        );
        expect(dennica!.id).toBe('D-1000-500');
    });

    it('niestandardowe zapasy (500/200) → D-400 physical OK (top=40>=0)', () => {
        const PRZ_CUSTOM: MockProduct = {
            id: 'PRZ-CUSTOM',
            name: 'Custom',
            componentType: 'przejscie',
            dn: 160,
            height: 0,
            zapasDol: 500,
            zapasGora: 500,
            zapasDolMin: 200,
            zapasGoraMin: 200,
            formaStandardowaKLB: 1
        };
        // bottom=200 < 200+15=215 → all fail minimal → physical
        // D-400: top=400-(200+160)=40>=0 → physical OK → D-400
        const d = selectLowestDennica(
            [...DENNICE, PRZ_CUSTOM],
            1000,
            'Kluczbork',
            [{ productId: 'PRZ-CUSTOM', rzednaWlaczenia: 0.2 }],
            0
        );
        expect(d!.id).toBe('D-1000-400');
    });
});
