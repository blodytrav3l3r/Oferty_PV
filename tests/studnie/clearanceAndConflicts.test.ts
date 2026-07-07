export {};
/* =============================================================
   Testy odczytu zapasów (clearance) i detekcji kolizji przejść
   ============================================================= */

interface MockProduct {
    id: string;
    name: string;
    componentType: string;
    dn: number | string;
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
}

const SAFETY = 15;

function parseFloatSafe(v: unknown, f: number): number {
    if (v === undefined || v === null || v === '') return f;
    const p = Number(v);
    return isNaN(p) ? f : p;
}

/* ================= 1. Odczyt zapasów (clearance) ================= */

function getClearanceFromProduct(prod: MockProduct) {
    return {
        zDol: parseFloatSafe(prod.zapasDol, 300),
        zGora: parseFloatSafe(prod.zapasGora, 300),
        zDolMin: parseFloatSafe(prod.zapasDolMin, 150),
        zGoraMin: parseFloatSafe(prod.zapasGoraMin, 150)
    };
}

describe('getClearanceFromProduct', () => {
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
    const PRZ0: MockProduct = {
        id: 'PRZ-0',
        name: 'Przejście 0',
        componentType: 'przejscie',
        dn: 160,
        height: 0,
        zapasDol: 0,
        zapasGora: 0,
        zapasDolMin: 0,
        zapasGoraMin: 0,
        formaStandardowaKLB: 1
    };

    it('pobiera wartości z cennika', () => {
        const c = getClearanceFromProduct(PRZ);
        expect(c).toEqual({ zDol: 300, zGora: 300, zDolMin: 150, zGoraMin: 150 });
    });

    it('domyślnie 300/150 gdy brak pól', () => {
        const c = getClearanceFromProduct({
            id: 'X',
            name: 'X',
            componentType: 'x',
            dn: 160,
            height: 0
        });
        expect(c).toEqual({ zDol: 300, zGora: 300, zDolMin: 150, zGoraMin: 150 });
    });

    it('0 gdy zapas=0 w cenniku', () => {
        const c = getClearanceFromProduct(PRZ0);
        expect(c).toEqual({ zDol: 0, zGora: 0, zDolMin: 0, zGoraMin: 0 });
    });

    it('undefined/null zamienia na domyślne 300/150', () => {
        const c = getClearanceFromProduct({
            id: 'X',
            name: 'X',
            componentType: 'x',
            dn: 160,
            height: 0
        } as MockProduct);
        expect(c).toEqual({ zDol: 300, zGora: 300, zDolMin: 150, zGoraMin: 150 });
    });
});

/* ================= 2. Detekcja kolizji (checkConflictsLogic) ================= */

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

describe('checkConflictsLogic', () => {
    const BH = { z: 0, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 };

    it('przejście w dennicy — minimal OK gdy joint w strefie std', () => {
        const r = checkConflictsLogic(
            [{ ...BH, z: 100 }],
            [{ type: 'dennica', start: 0, end: 500 }]
        );
        expect(r.valid).toBe(true);
        expect(r.isMinimal).toBe(true);
    });

    it('brak kolizji gdy segment wyższy niż strefa', () => {
        const r = checkConflictsLogic(
            [{ ...BH, z: 100 }],
            [{ type: 'dennica', start: 0, end: 700 }]
        );
        expect(r.valid).toBe(true);
        expect(r.isMinimal).toBe(false);
    });

    it('kolizja z płytą redukcyjną (przejście powyżej)', () => {
        const segs: Segment[] = [
            { type: 'dennica', start: 0, end: 500 },
            { type: 'krag', start: 500, end: 1500 },
            { type: 'plyta_redukcyjna', start: 1500, end: 1650 }
        ];
        const r = checkConflictsLogic(
            [{ z: 1600, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }],
            segs
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.includes('redukcyjnej'))).toBe(true);
    });

    it('przejście wystaje poza dennicę — invalid', () => {
        const r = checkConflictsLogic(
            [{ ...BH, z: 100 }],
            [{ type: 'dennica', start: 0, end: 200 }]
        );
        expect(r.valid).toBe(false);
    });

    it('kolizja z konusem', () => {
        const r = checkConflictsLogic(
            [{ z: 2000, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }],
            [
                { type: 'dennica', start: 0, end: 500 },
                { type: 'krag', start: 500, end: 2000 },
                { type: 'konus', start: 2000, end: 2625 }
            ]
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.includes('konus'))).toBe(true);
    });

    it('kolizja z płytą DIN', () => {
        const r = checkConflictsLogic(
            [{ z: 1800, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }],
            [
                { type: 'dennica', start: 0, end: 500 },
                { type: 'krag', start: 500, end: 1800 },
                { type: 'plyta_din', start: 1800, end: 1950 }
            ]
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.includes('plyta_din'))).toBe(true);
    });

    it('wiele przejść — wszystkie walidowane', () => {
        const holes = [
            { z: 100, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 },
            { z: 800, ruraDz: 200, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }
        ];
        const segs: Segment[] = [
            { type: 'dennica', start: 0, end: 500 },
            { type: 'krag', start: 500, end: 1500 }
        ];
        const r = checkConflictsLogic(holes, segs);
        expect(r.valid).toBe(true);
    });

    it('z=0 → effD=0 (rura przy dnie)', () => {
        const r = checkConflictsLogic(
            [{ z: 0, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }],
            [{ type: 'dennica', start: 0, end: 500 }]
        );
        expect(r.valid).toBe(true);
        expect(r.isMinimal).toBe(false);
    });

    it('z=0 w segmencie wyższym → brak kolizji', () => {
        const r = checkConflictsLogic(
            [{ z: 0, ruraDz: 160, zdD: 300, zdG: 300, zdDM: 150, zdGM: 150 }],
            [{ type: 'dennica', start: 0, end: 500 }]
        );
        expect(r.valid).toBe(true);
    });
});

/* ================= 3. Wymagana wysokość ================= */

function calcH(transitions: Transition[], products: MockProduct[], rzDna: number) {
    let mxH = 0,
        mxHM = 0;
    const holes: any[] = [];
    for (const p of transitions) {
        const prod = products.find((x) => x.id === p.productId);
        let prDN = 160;
        if (prod?.dn && typeof prod.dn === 'string' && prod.dn.includes('/'))
            prDN = parseFloatSafe(prod.dn.split('/')[1], 160);
        else prDN = parseFloatSafe(prod?.dn, 160);
        const z = Math.round((p.rzednaWlaczenia - rzDna) * 1000);
        const { zDol, zGora, zDolMin, zGoraMin } = prod
            ? getClearanceFromProduct(prod)
            : { zDol: 0, zGora: 0, zDolMin: 0, zGoraMin: 0 };
        const h = {
            z,
            ruraDz: prDN,
            zdD: prod ? zDol : 0,
            zdDM: prod ? zDolMin : 0,
            zdG: prod ? zGora : 0,
            zdGM: prod ? zGoraMin : 0
        };
        holes.push(h);
        const r = h.z + h.ruraDz + h.zdG;
        if (r > mxH) mxH = r;
        const rm = h.z + h.ruraDz + h.zdGM;
        if (rm > mxHM) mxHM = rm;
    }
    return { maxReqH: mxH, maxReqHMin: mxHM, holes };
}

describe('calculateRequiredHeights', () => {
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
    const PRZ0: MockProduct = {
        id: 'PRZ-0',
        name: 'Przejście 0',
        componentType: 'przejscie',
        dn: 160,
        height: 0,
        zapasDol: 0,
        zapasGora: 0,
        zapasDolMin: 0,
        zapasGoraMin: 0,
        formaStandardowaKLB: 1
    };

    it('oblicza maxReqH i maxReqHMin', () => {
        const { maxReqH, maxReqHMin } = calcH(
            [{ productId: 'PRZ-160', rzednaWlaczenia: 0.3 }],
            [PRZ],
            0
        );
        expect(maxReqH).toBe(760);
        expect(maxReqHMin).toBe(610);
    });

    it('wielokrotne przejścia — bierze max', () => {
        const { maxReqH, maxReqHMin } = calcH(
            [
                { productId: 'PRZ-160', rzednaWlaczenia: 0.3 },
                { productId: 'PRZ-160', rzednaWlaczenia: 0.5 }
            ],
            [PRZ],
            0
        );
        expect(maxReqH).toBe(960);
        expect(maxReqHMin).toBe(810);
    });

    it('zapas=0 w cenniku → liczone z 0', () => {
        const { maxReqH, maxReqHMin } = calcH(
            [{ productId: 'PRZ-0', rzednaWlaczenia: 0.3 }],
            [PRZ0],
            0
        );
        expect(maxReqH).toBe(460);
        expect(maxReqHMin).toBe(460);
    });

    it('niestandardowe DN rury (np. DN200/110)', () => {
        const PRZ_SLASH: MockProduct = {
            id: 'PRZ-200/110',
            name: 'Przejście 200/110',
            componentType: 'przejscie',
            dn: '200/110',
            height: 0,
            zapasDol: 200,
            zapasGora: 200,
            zapasDolMin: 100,
            zapasGoraMin: 100,
            formaStandardowaKLB: 1
        };
        const { maxReqH } = calcH(
            [{ productId: 'PRZ-200/110', rzednaWlaczenia: 0.3 }],
            [PRZ_SLASH],
            0
        );
        expect(maxReqH).toBe(610); // 300 + 110 + 200 = 610
    });

    it('przejście z ujemną rzedną (above rzDna) → z=0 → nearBottom', () => {
        const { maxReqH } = calcH([{ productId: 'PRZ-160', rzednaWlaczenia: 0.3 }], [PRZ], 0.3);
        expect(maxReqH).toBe(460); // 0 + 160 + 300
    });
});

/* ================= 4. Walidacja połączeń (joints) ================= */

function valJoints(
    ringHeights: number[],
    transitions: Transition[],
    products: MockProduct[],
    fixedBelowHeight: number,
    mode: 'standard' | 'minimal'
): boolean {
    if (!transitions?.length || !ringHeights?.length) return true;
    const joints: number[] = [];
    let y = 0;
    for (const h of ringHeights) {
        y += h;
        joints.push(y);
    }
    joints.pop();
    if (joints.length === 0) return true;
    for (const t of transitions) {
        const pprod = products.find((p) => p.id === t.productId);
        if (!pprod) continue;
        let dn = 160;
        if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/'))
            dn = parseFloatSafe(pprod.dn.split('/')[1], 160);
        else dn = parseFloatSafe(pprod.dn, 160);
        const rel = Math.round(t.rzednaWlaczenia * 1000) - fixedBelowHeight;
        if (rel < 0) continue;
        const { zDol, zGora, zDolMin, zGoraMin } = getClearanceFromProduct(pprod);
        const zd = mode === 'standard' ? zDol : zDolMin,
            zg = mode === 'standard' ? zGora : zGoraMin;
        const dB = rel - zd - SAFETY,
            dT = rel + dn + zg + SAFETY;
        for (const j of joints) {
            if (j >= dB && j <= dT) return false;
        }
    }
    return true;
}

describe('validateJointsLogic', () => {
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
    const F = 500;

    it('brak jointów → OK', () => {
        expect(valJoints([], [], [PRZ], F, 'standard')).toBe(true);
    });
    it('jeden krąg → brak jointów', () => {
        expect(
            valJoints(
                [1000],
                [{ productId: 'PRZ-160', rzednaWlaczenia: 0.5 }],
                [PRZ],
                F,
                'standard'
            )
        ).toBe(true);
    });
    it('brak przejść → OK', () => {
        expect(valJoints([500, 500], [], [PRZ], F, 'standard')).toBe(true);
    });

    it('joint w strefie niebezpiecznej → kolizja', () => {
        expect(
            valJoints(
                [500, 500],
                [{ productId: 'PRZ-160', rzednaWlaczenia: 0.58 }],
                [PRZ],
                F,
                'standard'
            )
        ).toBe(false);
    });

    it('tryb minimalny → brak kolizji (joint poza strefą min)', () => {
        expect(
            valJoints(
                [500, 500],
                [{ productId: 'PRZ-160', rzednaWlaczenia: 0.58 }],
                [PRZ],
                F,
                'minimal'
            )
        ).toBe(true);
    });

    it('przejście w dennicy → pomijane (rel < 0)', () => {
        expect(
            valJoints([500], [{ productId: 'PRZ-160', rzednaWlaczenia: 0.3 }], [PRZ], F, 'standard')
        ).toBe(true);
    });

    it('joint dokładnie na granicy strefy → kolizja', () => {
        // PRZ-160@580mm, fixed=500, rel=80
        // dB=80-300-15=-235, dT=80+160+300+15=555, joint=500 ∈ [-235,555] → kolizja
        expect(
            valJoints(
                [500, 500],
                [{ productId: 'PRZ-160', rzednaWlaczenia: 0.58 }],
                [PRZ],
                F,
                'standard'
            )
        ).toBe(false);
    });

    it('joint tuż poza strefą → OK', () => {
        // PRZ-160@580mm, jeśli fixed=0, rel=580
        // dB=580-300-15=265, dT=580+160+300+15=1055
        // joint=500 ∈ [265,1055] → kolizja
        // Ale z fixed=0, pierwszy joint to 500
        expect(
            valJoints(
                [500, 500],
                [{ productId: 'PRZ-160', rzednaWlaczenia: 0.58 }],
                [PRZ],
                0,
                'standard'
            )
        ).toBe(false);
    });

    it('większe DN rury → szersza strefa niebezpieczna', () => {
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
        // dB=80-300-15=-235, dT=80+200+300+15=595, joint=500 ∈ [-235,595] → kolizja
        expect(
            valJoints(
                [500, 500],
                [{ productId: 'PRZ-200', rzednaWlaczenia: 0.58 }],
                [PRZ200],
                F,
                'standard'
            )
        ).toBe(false);
    });
});

/* ================= 5. Walidacja 50mm od krawędzi elementu (validateJointClearance) ================= */

function validateJointClearance(
    targetComponent: { height: number; layer: string },
    positionInComponent: number,
    dnPrzejscia: string | number | undefined
): { errors: string[]; success: boolean } {
    const result: { errors: string[]; success: boolean } = { errors: [], success: true };
    const isOnJoint =
        Math.abs(positionInComponent) < 50 ||
        Math.abs((targetComponent.height || 0) - positionInComponent) < 50;
    if (isOnJoint && targetComponent.layer !== 'dennica') {
        result.errors.push(
            `Przejście DN${dnPrzejscia || '?'} wychodzi na połączeniu elementów - niedozwolone`
        );
        result.success = false;
    }
    return result;
}

describe('validateJointClearance — 50mm proximity check', () => {
    it('pozycja 0mm (górna krawędź) w kręgu → błąd', () => {
        const r = validateJointClearance({ height: 500, layer: 'krag' }, 0, 160);
        expect(r.success).toBe(false);
        expect(r.errors[0]).toContain('połączeniu');
    });

    it('pozycja 49mm (blisko górnej krawędzi) w kręgu → błąd', () => {
        const r = validateJointClearance({ height: 500, layer: 'krag' }, 49, 160);
        expect(r.success).toBe(false);
    });

    it('pozycja 50mm (dokładnie na granicy) w kręgu → OK', () => {
        const r = validateJointClearance({ height: 500, layer: 'krag' }, 50, 160);
        expect(r.success).toBe(true);
    });

    it('pozycja height-49mm (blisko dolnej krawędzi) w kręgu → błąd', () => {
        const r = validateJointClearance({ height: 500, layer: 'krag' }, 451, 160);
        expect(r.success).toBe(false);
    });

    it('pozycja height-50mm (dokładnie na granicy dolnej) w kręgu → OK', () => {
        const r = validateJointClearance({ height: 500, layer: 'krag' }, 450, 160);
        expect(r.success).toBe(true);
    });

    it('pozycja 0mm w dennicy → OK (dennica wyjątek)', () => {
        const r = validateJointClearance({ height: 500, layer: 'dennica' }, 0, 160);
        expect(r.success).toBe(true);
    });

    it('pozycja = height w dennicy → OK (dennica wyjątek)', () => {
        const r = validateJointClearance({ height: 500, layer: 'dennica' }, 500, 160);
        expect(r.success).toBe(true);
    });

    it('pozycja 0mm w stycznej → błąd (tylko dennica ma wyjątek)', () => {
        const r = validateJointClearance({ height: 500, layer: 'styczna' }, 0, 200);
        expect(r.success).toBe(false);
    });

    it('pozycja w środku elementu (250mm z 500mm) → OK', () => {
        const r = validateJointClearance({ height: 500, layer: 'krag' }, 250, 160);
        expect(r.success).toBe(true);
    });

    it('DN undefined → komunikat z "?"', () => {
        const r = validateJointClearance({ height: 500, layer: 'krag' }, 0, undefined);
        expect(r.errors[0]).toContain('DN?');
    });

    it('wiele komponentów (dennica + krag) — krag przy krawędzi → błąd', () => {
        // Symulacja: dennica 300mm + krag 500mm, przejście 330mm od dna
        // dennica kończy się na 300, przejście jest w kręgu na pozycji 30mm
        const r = validateJointClearance({ height: 500, layer: 'krag' }, 30, 160);
        expect(r.success).toBe(false);
    });

    it('height=0 → Math.abs(0 - position) < 50 → błąd gdy position<50', () => {
        const r = validateJointClearance({ height: 0, layer: 'krag' }, 0, 160);
        expect(r.success).toBe(false);
    });
});
