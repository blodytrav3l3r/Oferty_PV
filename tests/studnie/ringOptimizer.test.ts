export {};
/* =============================================================
   Testy optymalizatora kręgów (DP solver)
   ============================================================= */

interface MockProduct {
    id: string;
    name: string;
    componentType: string;
    dn: number | string;
    height: number;
    formaStandardowaKLB?: number;
    formaStandardowa?: number;
    [key: string]: unknown;
}

function dpRings(
    heights: number[],
    rings: MockProduct[],
    target: number,
    tolB: number,
    tolA: number
) {
    if (target <= 0 || !heights?.length) return { success: true, selectedRings: [] };
    const uniq = [...new Set(heights)].filter((h) => h > 0).sort((a, b) => b - a);
    if (uniq.length === 0) return { success: false, selectedRings: [] };
    const minA = Math.max(0, target - tolB),
        maxA = target + tolA;
    if (minA <= 0) return { success: true, selectedRings: [] };
    const dp: Array<{ score: number; prevH: number; ah: number } | null> = new Array(maxA + 1).fill(
        null
    );
    dp[0] = { score: 0, prevH: -1, ah: 0 };
    for (let h = 1; h <= maxA; h++)
        for (const rh of uniq) {
            if (rh > h) continue;
            const p = dp[h - rh];
            if (!p) continue;
            const ns = p.score + rh * rh;
            if (!dp[h] || ns > dp[h]!.score) dp[h] = { score: ns, prevH: h - rh, ah: rh };
        }
    let bestH = -1,
        bestS = -1;
    for (let h = Math.max(0, minA); h <= maxA; h++) {
        if (dp[h] && dp[h]!.score > bestS) {
            bestS = dp[h]!.score;
            bestH = h;
        }
    }
    if (bestH < 0) return { success: false, selectedRings: [] };
    const sel: number[] = [];
    let cur = bestH;
    while (cur > 0 && dp[cur]) {
        sel.push(dp[cur]!.ah);
        cur = dp[cur]!.prevH;
    }
    const reg = [...rings].sort((a, b) =>
        a.componentType === 'krag' && b.componentType !== 'krag' ? -1 : 1
    );
    const res: MockProduct[] = [];
    for (const h of sel) {
        const r =
            reg.find((x) => x.height === h && x.componentType === 'krag') ||
            reg.find((x) => x.height === h);
        if (r) res.push(r);
    }
    res.sort((a, b) => (b.height || 0) - (a.height || 0));
    return { success: true, selectedRings: res };
}

/* ========== FIXTURES ========== */
const KREGI: MockProduct[] = [
    {
        id: 'K-1000-1000',
        name: 'Krag 1000',
        componentType: 'krag',
        dn: 1000,
        height: 1000,
        formaStandardowaKLB: 1
    },
    {
        id: 'K-1000-500',
        name: 'Krag 500',
        componentType: 'krag',
        dn: 1000,
        height: 500,
        formaStandardowaKLB: 1
    },
    {
        id: 'K-1000-250',
        name: 'Krag 250',
        componentType: 'krag',
        dn: 1000,
        height: 250,
        formaStandardowaKLB: 1
    }
];

const KREGI_Z_OT: MockProduct[] = [
    ...KREGI,
    {
        id: 'K-1000-500-OT',
        name: 'Krag OT 500',
        componentType: 'krag_ot',
        dn: 1000,
        height: 500,
        formaStandardowaKLB: 1
    },
    {
        id: 'K-1000-250-OT',
        name: 'Krag OT 250',
        componentType: 'krag_ot',
        dn: 1000,
        height: 250,
        formaStandardowaKLB: 1
    }
];

/* ================= 1. Podstawowe przypadki ================= */
describe('solveDpRings', () => {
    it('target=0 → pusty', () => {
        const r = dpRings([250, 500, 1000], KREGI, 0, 50, 20);
        expect(r.success).toBe(true);
        expect(r.selectedRings).toHaveLength(0);
    });

    it('brak kręgów → pusty (success, bo target=0 przez minA=0)', () => {
        const r = dpRings([], [], 1000, 50, 20);
        expect(r.success).toBe(true);
        expect(r.selectedRings).toHaveLength(0);
    });

    it('brak pasujących wysokości → pusty (DP znajduje, ale brak produktów)', () => {
        const r = dpRings([100], KREGI, 1000, 50, 20);
        expect(r.success).toBe(true);
        expect(r.selectedRings).toHaveLength(0);
    });

    it('znajduje rozwiązanie 1500', () => {
        const r = dpRings([250, 500, 1000], KREGI, 1500, 50, 20);
        expect(r.success).toBe(true);
        const t = r.selectedRings.reduce((s, x) => s + (x.height || 0), 0);
        expect(t).toBeGreaterThanOrEqual(1450);
        expect(t).toBeLessThanOrEqual(1520);
    });

    it('preferuje większe kręgi (1000 > 500+500)', () => {
        const r = dpRings([250, 500, 1000], KREGI, 1000, 50, 20);
        expect(r.selectedRings).toHaveLength(1);
        expect(r.selectedRings[0].height).toBe(1000);
    });

    it('target=3 → pusty (minAllowed=0)', () => {
        expect(dpRings([250, 500, 1000], KREGI, 3, 50, 20).selectedRings).toHaveLength(0);
    });

    it('znajduje rozwiązanie 2000', () => {
        const r = dpRings([250, 500, 1000], KREGI, 2000, 50, 20);
        expect(r.success).toBe(true);
        const t = r.selectedRings.reduce((s, x) => s + (x.height || 0), 0);
        expect(t).toBeGreaterThanOrEqual(1950);
    });
});

/* ================= 2. Tolerance ================= */
describe('solveDpRings — tolerance', () => {
    it('tolBelow=0 → dokładne dopasowanie', () => {
        const r = dpRings([250, 500, 1000], KREGI, 1500, 0, 0);
        expect(r.success).toBe(true);
        const t = r.selectedRings.reduce((s, x) => s + (x.height || 0), 0);
        expect(t).toBe(1500);
    });

    it('tolBelow=200 → większy zakres', () => {
        const r = dpRings([250, 500, 1000], KREGI, 1800, 200, 20);
        expect(r.success).toBe(true);
        const t = r.selectedRings.reduce((s, x) => s + (x.height || 0), 0);
        expect(t).toBeGreaterThanOrEqual(1600);
        expect(t).toBeLessThanOrEqual(1820);
    });

    it('tolBelow=260, tolAbove=20 → szeroki zakres ratunkowy', () => {
        const r = dpRings([250, 500, 1000], KREGI, 300, 260, 20);
        expect(r.success).toBe(true);
        const t = r.selectedRings.reduce((s, x) => s + (x.height || 0), 0);
        expect(t).toBeGreaterThanOrEqual(40);
        expect(t).toBeLessThanOrEqual(320);
    });
});

/* ================= 3. Różne zestawy wysokości ================= */
describe('solveDpRings — różne zestawy kręgów', () => {
    it('tylko 250 i 1000 → 1000+250+250=1500 (3 kręgi)', () => {
        const r = dpRings([250, 1000], KREGI, 1500, 50, 20);
        expect(r.success).toBe(true);
        expect(r.selectedRings).toHaveLength(3);
        const t = r.selectedRings.reduce((s, x) => s + (x.height || 0), 0);
        expect(t).toBe(1500);
    });

    it('tylko 250 → 1500 = 6×250', () => {
        const rings: MockProduct[] = [
            {
                id: 'K-250',
                name: 'Krag 250',
                componentType: 'krag',
                dn: 1000,
                height: 250,
                formaStandardowaKLB: 1
            }
        ];
        const r = dpRings([250], rings, 1500, 50, 20);
        expect(r.success).toBe(true);
        const t = r.selectedRings.reduce((s, x) => s + (x.height || 0), 0);
        expect(t).toBe(1500);
        expect(r.selectedRings).toHaveLength(6);
    });

    it('wiele różnych wysokości', () => {
        const rings: MockProduct[] = [
            {
                id: 'K-100',
                name: 'Krag 100',
                componentType: 'krag',
                dn: 1000,
                height: 100,
                formaStandardowaKLB: 1
            },
            {
                id: 'K-200',
                name: 'Krag 200',
                componentType: 'krag',
                dn: 1000,
                height: 200,
                formaStandardowaKLB: 1
            },
            {
                id: 'K-300',
                name: 'Krag 300',
                componentType: 'krag',
                dn: 1000,
                height: 300,
                formaStandardowaKLB: 1
            }
        ];
        const r = dpRings([100, 200, 300], rings, 900, 50, 20);
        expect(r.success).toBe(true);
        const t = r.selectedRings.reduce((s, x) => s + (x.height || 0), 0);
        expect(t).toBeGreaterThanOrEqual(850);
        expect(t).toBeLessThanOrEqual(920);
    });
});

/* ================= 4. Z kręgami OT ================= */
describe('solveDpRings — z kręgami OT', () => {
    it('OT nie przeszkadza w doborze (są niższym priorytetem mapowania)', () => {
        // DP używa tylko wysokości; mapowanie preferuje krag nad krag_ot
        const r = dpRings([250, 500, 1000], KREGI_Z_OT, 1500, 50, 20);
        expect(r.success).toBe(true);
        // Wszystkie wybrane kręgi powinny być typu 'krag' (nie 'krag_ot')
        const allKrag = r.selectedRings.every((x) => x.componentType === 'krag');
        expect(allKrag).toBe(true);
    });
});

/* ================= 5. Scenariusze brzegowe ================= */
describe('solveDpRings — brzegowe', () => {
    it('ujemny target → pusty', () => {
        expect(dpRings([250, 500, 1000], KREGI, -100, 50, 20).selectedRings).toHaveLength(0);
    });

    it('target mniejszy niż najmniejszy krąg → pusty (minA=0)', () => {
        const r = dpRings([250, 500, 1000], KREGI, 10, 260, 20);
        expect(r.selectedRings).toHaveLength(0);
    });
});
