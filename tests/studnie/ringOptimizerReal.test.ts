// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * ringOptimizerReal.test.ts — regresja F3 (P0-1, osobny commit).
 *
 * Laduje PRAWDZIWY public/js/studnie/ringOptimizer.js do vm (poprzedni
 * ringOptimizer.test.ts testuje lokalna replike dpRings, nie modul).
 * Przypadki:
 *  1. Bez przejsc — bezposrednie DP.
 *  2. Kolizja best-DP bez poprawnej alternatywy — fallback do best + warn
 *     (dowodzi, ze sciezka findAlternativeDPSolution sie wykonala).
 *  3. Kolizja z poprawna alternatywa — wybor alternatywy (500 zamiast 750).
 *  4. Determinizm: dwa przebiegi kanonicznie identyczne.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

function canonical(v: any): string {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v !== null && typeof v === 'object') {
        return (
            '{' +
            Object.keys(v)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
                .join(',') +
            '}'
        );
    }
    return JSON.stringify(v);
}

function makeCtx() {
    const warns: string[] = [];
    const sb: any = {
        console,
        logger: {
            debug() {},
            info() {},
            warn(...a: any[]) {
                warns.push(a.join(' '));
            },
            error() {}
        }
    };
    sb.window = sb;
    sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'ringOptimizer.js'), 'utf8'), sb, {
        filename: 'ringOptimizer.js'
    });
    return { sb, warns };
}

const RINGS = [
    { id: 'K-250', componentType: 'krag', dn: '1000', height: 250 },
    { id: 'K-500', componentType: 'krag', dn: '1000', height: 500 },
    { id: 'K-1000', componentType: 'krag', dn: '1000', height: 1000 }
];

function transAt(relMm: number, dn = 160) {
    return {
        productId: 'T',
        height_from_bottom_mm: relMm,
        __dn: dn
    };
}

const AVAIL = [
    { id: 'T', dn: '160', zapasDol: 300, zapasGora: 300, zapasDolMin: 150, zapasGoraMin: 150 }
];

const total = (res: any) =>
    (res.selectedRings || []).reduce((s: number, r: any) => s + Number(r.height), 0);

describe('ringOptimizer (realny modul, F3)', () => {
    test('bez przejsc: DP 1500 w [1450,1520]', () => {
        const { sb } = makeCtx();
        const r = sb.optimizeRingsForDistance(1500, RINGS, 260, 20, null, null, 0);
        expect(r.success).toBe(true);
        const t = total(r);
        expect(t).toBeGreaterThanOrEqual(1450);
        expect(t).toBeLessThanOrEqual(1520);
    });

    test('kolizja bez poprawnej alternatywy: fallback do best DP + warn', () => {
        const { sb, warns } = makeCtx();
        // joints kandydata 500+500: [500]; rura rel 100, DN160 → danger [-215,575] → kolizja.
        // Zadna kombinacja nie omija strefy → null → fallback.
        const rings = RINGS.filter((r) => r.height !== 1000);
        const r = sb.optimizeRingsForDistance(1000, rings, 260, 20, [transAt(100)], AVAIL, 0);
        expect(r.success).toBe(true);
        const t = total(r);
        expect(t).toBeGreaterThanOrEqual(740);
        expect(t).toBeLessThanOrEqual(1020);
        expect(warns.some((w) => w.includes('walidacji przejść'))).toBe(true);
    });

    test('kolizja z poprawna alternatywa: wybor 500 zamiast 750', () => {
        const { sb } = makeCtx();
        const rings = RINGS.filter((r) => r.height !== 1000);
        // Best 500+250=750 (joint 500 w danger [-215,575]) → alt: pojedynczy 500 (brak jointow).
        const r = sb.optimizeRingsForDistance(750, rings, 260, 20, [transAt(100)], AVAIL, 0);
        expect(r.success).toBe(true);
        expect(total(r)).toBe(500);
        expect(r.selectedRings).toHaveLength(1);
    });

    test('determinizm: dwa przebiegi identyczne kanonicznie', () => {
        const { sb } = makeCtx();
        const rings = RINGS.filter((r) => r.height !== 1000);
        const a = sb.optimizeRingsForDistance(750, rings, 260, 20, [transAt(100)], AVAIL, 0);
        const b = sb.optimizeRingsForDistance(750, rings, 260, 20, [transAt(100)], AVAIL, 0);
        expect(canonical(a)).toBe(canonical(b));
    });
});
