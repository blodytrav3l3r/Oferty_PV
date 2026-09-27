import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * P1.4: inwarianty solvera (właściwości, nie snapshoty) na PRAWDZIWYM
 * recalculateWellErrors z solverValidation.js (vm, wzorzec aiSelection.test.ts).
 * Brak fast-check w zależnościach — deterministyczny LCG zamiast losowości
 * (powtarzalne, zero flaky, zero nowych deps; seed w nazwie testu).
 * resolveStudnieProduct stubbed -> null (reguły rzędnych nie wymagają katalogu).
 */
function loadValidator() {
    const sandbox: any = {
        window: {},
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        resolveStudnieProduct: () => null
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/solverValidation.js'),
        'utf8'
    );
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    const fn = sandbox.recalculateWellErrors || sandbox.window.recalculateWellErrors;
    expect(typeof fn).toBe('function');
    return fn;
}

// Deterministyczny LCG (seed 20260927) — ta sama sekwencja na każdym runie.
function lcg(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const hasDnaError = (w: any) =>
    (w.configErrors || []).some((e: string) => e.includes('Rzędna dna'));
const hasPrzError = (w: any, n: number) =>
    (w.configErrors || []).some((e: string) => e.includes(`przejścia nr ${n}`));

describe('P1.4 solver invariants (seed 20260927, 200 prób/właściwość)', () => {
    const recalc = loadValidator();

    test('rzednaDna >= rzednaWlazu => zawsze błąd dna', () => {
        const rnd = lcg(20260927);
        for (let i = 0; i < 200; i++) {
            const wlazu = +(100 + rnd() * 5).toFixed(3);
            const dna = +(wlazu + rnd() * 2).toFixed(3); // dna >= wlazu
            const w: any = { rzednaWlazu: wlazu, rzednaDna: dna, config: [], configErrors: [] };
            recalc(w);
            expect(hasDnaError(w)).toBe(true);
        }
    });

    test('rzednaDna < rzednaWlazu => brak błędu dna', () => {
        const rnd = lcg(20260928);
        for (let i = 0; i < 200; i++) {
            const wlazu = +(100 + rnd() * 5).toFixed(3);
            const dna = +(wlazu - 0.001 - rnd() * 3).toFixed(3);
            const w: any = { rzednaWlazu: wlazu, rzednaDna: dna, config: [], configErrors: [] };
            recalc(w);
            expect(hasDnaError(w)).toBe(false);
        }
    });

    test('przejście poniżej dna => zawsze błąd tego przejścia', () => {
        const rnd = lcg(20260929);
        for (let i = 0; i < 200; i++) {
            const dna = +(100 + rnd() * 3).toFixed(3);
            const n = 1 + Math.floor(rnd() * 3);
            const przejscia = Array.from({ length: n }, (_, k) => ({
                rzednaWlaczenia:
                    k === 0 ? +(dna - 0.001 - rnd()).toFixed(3) : +(dna + 0.5 + rnd()).toFixed(3)
            }));
            const w: any = {
                rzednaWlazu: dna + 5,
                rzednaDna: dna,
                przejscia,
                config: [],
                configErrors: []
            };
            recalc(w);
            expect(hasPrzError(w, 1)).toBe(true);
        }
    });

    test('idempotencja: podwójny recalc nie duplikuje błędów', () => {
        const rnd = lcg(20260930);
        for (let i = 0; i < 200; i++) {
            const wlazu = 102.5;
            const dna = +(wlazu + rnd() * 2).toFixed(3);
            const w: any = { rzednaWlazu: wlazu, rzednaDna: dna, config: [], configErrors: [] };
            recalc(w);
            const afterFirst = [...(w.configErrors || [])];
            recalc(w);
            expect(w.configErrors).toEqual(afterFirst);
        }
    });

    test('configStatus LOADING => no-op', () => {
        const rnd = lcg(20260931);
        for (let i = 0; i < 200; i++) {
            const w: any = {
                configStatus: 'LOADING',
                rzednaWlazu: 100,
                rzednaDna: 100 + rnd(),
                config: [],
                configErrors: ['zachowane']
            };
            recalc(w);
            expect(w.configErrors).toEqual(['zachowane']);
        }
    });
});
