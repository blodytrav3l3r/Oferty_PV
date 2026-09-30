// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Batch A: kontrakty applyDrilledRings (OT-wiercenie, solverCore.js).
 * Loader: constants + transitionZones + globals + solverCore (prawdziwe pliki).
 * Asortyment przez setter window.studnieProducts (globals.js:31).
 * Geometria fixture: dennica 0-600, krag 600-1100, krag 1100-1600.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

const PRODUCTS = [
    {
        id: 'DDD-1000-600',
        name: 'Dennica 1000/600',
        componentType: 'dennica',
        dn: 1000,
        height: 600
    },
    { id: 'KDB-1000-500-D', name: 'Krag 1000/500', componentType: 'krag', dn: 1000, height: 500 },
    { id: 'KDB-1000-250-D', name: 'Krag 1000/250', componentType: 'krag', dn: 1000, height: 250 },
    { id: 'USZ-1000', name: 'Uszczelka', componentType: 'uszczelka', dn: 1000, height: 20 },
    {
        id: 'KDB-1000-500-OT',
        name: 'Krag wiercony 1000/500',
        componentType: 'krag_ot',
        dn: 1000,
        height: 500
    },
    { id: 'PR-110-160', name: 'Przejscie 110/160', componentType: 'przejscie', dn: '110/160' }
];

const AVAIL = (extra = []) => [
    ...PRODUCTS.filter((p) => p.componentType !== 'przejscie'),
    ...extra
];

function loadSolver() {
    // structuredClone: brak w kontekscie vm i w sandboxie Jesta;
    // fallback JSON wystarcza (items to plain-data).
    const clone =
        (globalThis as any).structuredClone ?? ((o: any) => JSON.parse(JSON.stringify(o)));
    const sandbox: any = { window: {}, console, URL, structuredClone: clone };
    vm.createContext(sandbox);
    for (const f of [
        'shared/constants.js',
        'studnie/transitionZones.js',
        'studnie/globals.js',
        'studnie/solverCore.js'
    ]) {
        vm.runInContext(readJs(f), sandbox, { filename: f });
    }
    sandbox.window.studnieProducts = PRODUCTS.map((p) => ({ ...p }));
    sandbox.buildConfigSegments = sandbox.window.buildConfigSegments;
    sandbox.applyDrilledRings = sandbox.window.applyDrilledRings;
    return sandbox;
}

// Geometria wg matematyki applyDrilledRings (kara dennicy 100 przy reversed-walk):
// currentDennicaEnd ~= 1000 (2-item) / 1500 (3-item). Swap wymaga srodka otworu
// PONIZEJ... powyzej currentDennicaEnd (holeCenter < end → skip).
const KREGI = () => [
    { productId: 'DDD-1000-600', quantity: 1 },
    { productId: 'KDB-1000-500-D', quantity: 1 },
    { productId: 'KDB-1000-500-D', quantity: 1 }
];
const KREGI_QTY2 = () => [
    { productId: 'DDD-1000-600', quantity: 1 },
    { productId: 'KDB-1000-500-D', quantity: 2 }
];
const WELL = (rz: number) => ({
    rzednaDna: 0,
    psiaBuda: false,
    przejscia: [{ productId: 'PR-110-160', rzednaWlaczenia: String(rz) }]
});

function segmentsOf(s: any) {
    return s.buildConfigSegments(KREGI(), false);
}

describe('applyDrilledRings', () => {
    it('brak przejsc → klon bez zmian, needsTallerDennica=false', () => {
        const s = loadSolver();
        const segs = segmentsOf(s);
        const well = { rzednaDna: 0, przejscia: [] };
        const r = s.applyDrilledRings(KREGI(), segs, well, AVAIL());
        expect(r.needsTallerDennica).toBe(false);
        expect(r.items).toEqual(KREGI());
        expect(r.items).not.toBe(KREGI());
    });

    it('otwor 920-1080, srodek 1000 na granicy end=1000 → split qty 2→1+1', () => {
        const s = loadSolver();
        const kregi = KREGI_QTY2();
        const segs = s.buildConfigSegments(kregi, false);
        const r = s.applyDrilledRings(kregi, segs, WELL(0.92), AVAIL());
        const ids = r.items.map((i: any) => [i.productId, i.quantity]);
        // OT PODMIENIA 1. jednostke (qty 2→1, splice OT): suma jednostek bez zmian.
        expect(ids).toEqual([
            ['DDD-1000-600', 1],
            ['KDB-1000-500-D', 1],
            ['KDB-1000-500-OT', 1]
        ]);
    });

    it('qty=1 → podmiana productId w miejscu (bez splitu)', () => {
        const s = loadSolver();
        const kregi = KREGI();
        const segs = s.buildConfigSegments(kregi, false);
        // Otwor 1420-1580 w kregu 1100-1600, srodek 1500 na granicy end=1500.
        const r = s.applyDrilledRings(kregi, segs, WELL(1.42), AVAIL());
        expect(r.items.map((i: any) => i.productId)).toEqual([
            'DDD-1000-600',
            'KDB-1000-500-D',
            'KDB-1000-500-OT'
        ]);
    });

    it('otwor przecina koniec dennicy (1350-1510 vs 1500) → needsTallerDennica', () => {
        const s = loadSolver();
        const segs = segmentsOf(s);
        const r = s.applyDrilledRings(KREGI(), segs, WELL(1.35), AVAIL());
        expect(r.needsTallerDennica).toBe(true);
        // Srodek otworu (1430) ponizej end → brak zamiany kreagu.
        expect(r.items.every((i: any) => i.productId !== 'KDB-1000-500-OT')).toBe(true);
    });

    it('krag H=250 < MIN_OT_HEIGHT → brak zamiany', () => {
        const s = loadSolver();
        const kregi = [
            { productId: 'DDD-1000-600', quantity: 1 },
            { productId: 'KDB-1000-250-D', quantity: 1 }
        ];
        const segs = s.buildConfigSegments(kregi, false);
        // Otwor 670-830 w kregu 600-850, srodek 750 na granicy end=750.
        const r = s.applyDrilledRings(kregi, segs, WELL(0.67), AVAIL());
        expect(r.items.every((i: any) => !String(i.productId).includes('OT'))).toBe(true);
    });

    it('brak OT w availProducts → brak zamiany, brak throw', () => {
        const s = loadSolver();
        const kregi = KREGI_QTY2();
        const segs = s.buildConfigSegments(kregi, false);
        const noOt = AVAIL().filter((p) => p.componentType !== 'krag_ot');
        const r = s.applyDrilledRings(kregi, segs, WELL(0.92), noOt);
        expect(r.items).toEqual(KREGI_QTY2());
    });

    it('nieznany produkt przejscia → skip (continue), brak throw', () => {
        const s = loadSolver();
        const segs = segmentsOf(s);
        const well = { rzednaDna: 0, przejscia: [{ productId: 'nie_ma', rzednaWlaczenia: '0.8' }] };
        const r = s.applyDrilledRings(KREGI(), segs, well, AVAIL());
        expect(r.items).toEqual(KREGI());
        expect(r.needsTallerDennica).toBe(false);
    });

    it('determinizm: dwa runy → identyczny wynik', () => {
        const run = () => {
            const s = loadSolver();
            const r = s.applyDrilledRings(KREGI(), segmentsOf(s), WELL(0.8), AVAIL());
            return JSON.stringify([r.items, r.needsTallerDennica]);
        };
        expect(run()).toBe(run());
    });
});
