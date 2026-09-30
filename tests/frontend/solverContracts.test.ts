// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * P1.4: kontrakty regresji solvera studni (F-004).
 * Zakres: czyste funkcje solverCore.js + solverValidation.js.
 * Poza zakresem: runJsAutoSelection (closure) i applyDrilledRings
 * (wymaga SSoT transitionZones + asortymentu — osobny temat).
 * FLOW_TYPES ladowane z PRAWDZIWEGO shared/constants.js.
 * Stuby produktowe wierne globals.js:181-191 (isDennicaLikeProduct,
 * dennicaHeightPenalty 100/0).
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

const PRODUCTS = [
    { id: 'den1', name: 'Dennica 1000', componentType: 'dennica', dn: '1000', height: 600 },
    { id: 'kr500', name: 'Krag 1000/500', componentType: 'krag', dn: '1000', height: 500 },
    { id: 'kr250', name: 'Krag 1000/250', componentType: 'krag', dn: '1000', height: 250 },
    { id: 'usz', name: 'Uszczelka', componentType: 'uszczelka', dn: '1000', height: 20 },
    {
        id: 'pr160',
        name: 'Przejscie 160',
        componentType: 'przejscie',
        dn: '110/160',
        zapasDol: '300',
        zapasDolMin: '150',
        zapasGora: '300',
        zapasGoraMin: '150'
    }
];

function loadSolver() {
    const sandbox: any = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/constants.js'), sandbox, { filename: 'constants.js' });
    // W przegladarce window.* jest globalem; w vm dopinamy recznie (ta sama wartosc).
    sandbox.FLOW_TYPES = sandbox.window.FLOW_TYPES;
    // Wierny stub globals.js:181-191 + lookup (ta sama kolejnosc co prod).
    sandbox.getStudnieProductById = (id: string) => PRODUCTS.find((p) => p.id === id) || null;
    sandbox.resolveStudnieProduct = (id: string) => PRODUCTS.find((p) => p.id === id) || null;
    sandbox.studnieProducts = PRODUCTS;
    sandbox.isDennicaLikeProduct = (p: any) =>
        !!p && (p.componentType === 'dennica' || p.componentType === 'styczna');
    sandbox.dennicaHeightPenalty = (p: any, belowType: string | null) =>
        sandbox.isDennicaLikeProduct(p) &&
        new Set(['dennica', 'styczna', 'krag', 'krag_ot', 'plyta_redukcyjna']).has(
            belowType as string
        )
            ? 100
            : 0;
    vm.runInContext(readJs('studnie/solverCore.js'), sandbox, { filename: 'solverCore.js' });
    vm.runInContext(readJs('studnie/solverValidation.js'), sandbox, {
        filename: 'solverValidation.js'
    });
    return sandbox;
}

describe('P1.4 clampRzednaWlaczenia — normal/boundary', () => {
    it('wartosc w zakresie przechodzi bez zmian', () => {
        const s = loadSolver();
        expect(s.clampRzednaWlaczenia(1.5, { rzednaDna: '1.0', rzednaWlazu: '2.0' })).toEqual({
            value: 1.5,
            clampedLow: false,
            clampedHigh: false
        });
    });

    it('ponizej dna → clamp do dna; powyzej wlazu → clamp do wlazu', () => {
        const s = loadSolver();
        expect(s.clampRzednaWlaczenia(0.5, { rzednaDna: '1.0', rzednaWlazu: '2.0' })).toEqual({
            value: 1.0,
            clampedLow: true,
            clampedHigh: false
        });
        expect(s.clampRzednaWlaczenia(2.5, { rzednaDna: '1.0', rzednaWlazu: '2.0' })).toEqual({
            value: 2.0,
            clampedLow: false,
            clampedHigh: true
        });
    });

    it('granice wlacznie: rowne dnu/wlazowi nie clampuje', () => {
        const s = loadSolver();
        const w = { rzednaDna: '1.0', rzednaWlazu: '2.0' };
        expect(s.clampRzednaWlaczenia(1.0, w).clampedLow).toBe(false);
        expect(s.clampRzednaWlaczenia(2.0, w).clampedHigh).toBe(false);
    });
});

describe('P1.4 clampRzednaWlaczenia — non-finite/braki', () => {
    it('null/undefined/NaN przechodza bez zmian (brak cichej zamiany na 0)', () => {
        const s = loadSolver();
        const w = { rzednaDna: '1.0', rzednaWlazu: '2.0' };
        expect(s.clampRzednaWlaczenia(null, w)).toEqual({
            value: null,
            clampedLow: false,
            clampedHigh: false
        });
        expect(s.clampRzednaWlaczenia(undefined, w).value).toBeUndefined();
        expect(s.clampRzednaWlaczenia(NaN, w).value).toBeNaN();
    });

    it('brak well i NaN w rzednych → passthrough', () => {
        const s = loadSolver();
        expect(s.clampRzednaWlaczenia(5, null).clampedLow).toBe(false);
        expect(s.clampRzednaWlaczenia(5, { rzednaDna: 'xx', rzednaWlazu: 'yy' }).clampedLow).toBe(
            false
        );
    });
});

describe('P1.4 formatRzednaShort + listPrzejsciaBelowDna', () => {
    it('format polski przecinek, 3 miejsca', () => {
        const s = loadSolver();
        expect(s.formatRzednaShort(1.2)).toBe('1,200');
        expect(s.formatRzednaShort('2')).toBe('2,000');
    });

    it('nieliczbowy input wraca jako string (brak throw)', () => {
        const s = loadSolver();
        expect(s.formatRzednaShort('xx')).toBe('xx');
        expect(s.formatRzednaShort(NaN)).toBe('NaN');
    });

    it('ponizej dna → wpis "nr i (x m < dno y m)"; puste/NaN → []', () => {
        const s = loadSolver();
        const well = {
            rzednaDna: '1.500',
            przejscia: [{ rzednaWlaczenia: '1.200' }, { rzednaWlaczenia: '1.600' }]
        };
        expect(s.listPrzejsciaBelowDna(well)).toEqual(['nr 1 (1,200 m < dno 1,500 m)']);
        expect(s.listPrzejsciaBelowDna({ rzednaDna: '1.5', przejscia: [] })).toEqual([]);
        expect(s.listPrzejsciaBelowDna({ rzednaDna: 'xx', przejscia: well.przejscia })).toEqual([]);
        expect(s.listPrzejsciaBelowDna(null)).toEqual([]);
    });
});

describe('P1.4 validatePrzejsciaForSave — gate zapisu', () => {
    it('puste wejscie → valid (brak falszywych blokad)', () => {
        const s = loadSolver();
        expect(s.validatePrzejsciaForSave([])).toEqual({ valid: true, errors: [] });
        expect(s.validatePrzejsciaForSave(null).valid).toBe(true);
    });

    it('rzedna ponizej dna blokuje zapis z komunikatem', () => {
        const s = loadSolver();
        const r = s.validatePrzejsciaForSave([
            {
                name: 'S1',
                rzednaDna: '1.500',
                przejscia: [{ rzednaWlaczenia: '1.200', productId: 'pr160', angle: '90' }]
            }
        ]);
        expect(r.valid).toBe(false);
        expect(r.errors.length).toBeGreaterThan(0);
        expect(r.errors[0]).toMatch(/poniżej rzędnej dna/);
    });

    it('rodzaj bez srednicy i srednica bez rodzaju → invalid', () => {
        const s = loadSolver();
        const mk = (p: any) => ({
            name: 'S1',
            rzednaDna: '1.0',
            przejscia: [{ rzednaWlaczenia: '1.5', angle: '90', ...p }]
        });
        expect(s.validatePrzejsciaForSave([mk({ tempCategory: 'PCV' })]).valid).toBe(false);
        expect(s.validatePrzejsciaForSave([mk({ productId: 'pr160' })]).valid).toBe(false);
    });

    it('pelne poprawne przejscie → valid', () => {
        const s = loadSolver();
        const r = s.validatePrzejsciaForSave([
            {
                name: 'S1',
                rzednaDna: '1.0',
                przejscia: [
                    {
                        rzednaWlaczenia: '1.5',
                        angle: '90',
                        productId: 'pr160',
                        tempCategory: 'PCV'
                    }
                ]
            }
        ]);
        expect(r).toEqual({ valid: true, errors: [] });
    });
});

describe('P1.4 buildConfigSegments — geometria + determinizm', () => {
    it('pusty config → []', () => {
        const s = loadSolver();
        expect(s.buildConfigSegments([], false)).toEqual([]);
    });

    it('segmenty sumuja wysokosci: dennica 600 + uszczelka 20 + krag 500', () => {
        const s = loadSolver();
        const segs = s.buildConfigSegments(
            [
                { productId: 'den1', quantity: 1 },
                { productId: 'usz', quantity: 1 },
                { productId: 'kr500', quantity: 1 }
            ],
            false
        );
        expect(segs.map((g: any) => [g.start, g.end])).toEqual([
            [0, 600],
            [600, 620],
            [620, 1120]
        ]);
        expect(segs.map((g: any) => g.type)).toEqual(['dennica', 'uszczelka', 'krag']);
    });

    it('nieznany produkt → wysokosc 0, brak throw', () => {
        const s = loadSolver();
        const segs = s.buildConfigSegments([{ productId: 'nie_ma', quantity: 1 }], false);
        expect(segs).toHaveLength(1);
        expect(segs[0].end - segs[0].start).toBe(0);
    });

    it('determinizm: dwa przebiegi daja identyczny wynik', () => {
        const s = loadSolver();
        const cfg = [
            { productId: 'den1', quantity: 1 },
            { productId: 'kr500', quantity: 2 },
            { productId: 'kr250', quantity: 1 }
        ];
        expect(s.buildConfigSegments(cfg, true)).toEqual(s.buildConfigSegments(cfg, true));
    });

    it('terminacja: 10k pozycji konczy sie szybko (brak petli niezaleznej od inputu)', () => {
        const s = loadSolver();
        const big = Array.from({ length: 10000 }, (_, i) => ({
            productId: i % 2 ? 'kr500' : 'kr250',
            quantity: 1
        }));
        const t0 = Date.now();
        const segs = s.buildConfigSegments(big, false);
        expect(Date.now() - t0).toBeLessThan(2000);
        expect(segs).toHaveLength(10000);
        expect(segs[9999].end).toBe(5000 * 500 + 5000 * 250);
    });
});

describe('P1.4 recalculateWellErrors — inwarianty biznesowe', () => {
    it('LOADING → early return bez dotykania bledow', () => {
        const s = loadSolver();
        const well: any = { configStatus: 'LOADING', configErrors: ['stare'] };
        s.recalculateWellErrors(well);
        expect(well.configErrors).toEqual(['stare']);
    });

    it('rzedna dna >= rzednej wlazu → twardy blad ERROR', () => {
        const s = loadSolver();
        const well: any = { rzednaDna: '2.0', rzednaWlazu: '1.5', config: [], configErrors: [] };
        s.recalculateWellErrors(well);
        expect(well.configStatus).toBe('ERROR');
        expect(well.configErrors.some((e: string) => e.includes('nie może być większa'))).toBe(
            true
        );
    });

    it('determinizm: ten sam well → ten sam zestaw bledow', () => {
        const s = loadSolver();
        const mk = (): any => ({
            rzednaDna: '1.0',
            rzednaWlazu: '2.5',
            config: [{ productId: 'kr500', quantity: 1 }],
            configErrors: [],
            przejscia: [{ rzednaWlaczenia: '0.5', productId: 'pr160', angle: '0' }]
        });
        const a: any = mk();
        const b: any = mk();
        s.recalculateWellErrors(a);
        s.recalculateWellErrors(b);
        expect(a.configErrors).toEqual(b.configErrors);
    });
});

describe('P1.4 validateCollisionsLive — fallback bez SSoT', () => {
    it('brak przejsc / NaN rzedna → []', () => {
        const s = loadSolver();
        expect(s.validateCollisionsLive({ przejscia: [] }, [])).toEqual([]);
        expect(s.validateCollisionsLive(null, [])).toEqual([]);
        expect(
            s.validateCollisionsLive(
                { rzednaDna: 'xx', przejscia: [{ rzednaWlaczenia: '1.0', productId: 'pr160' }] },
                []
            )
        ).toEqual([]);
    });

    it('kolizja z konusem → blad; czysty krag → brak bledow', () => {
        const s = loadSolver();
        const well = {
            rzednaDna: '0',
            przejscia: [{ rzednaWlaczenia: '0.3', productId: 'pr160', angle: '0' }]
        };
        // otwor 300-460mm; konus 0-1000 → kolizja
        const col = s.validateCollisionsLive(well, [{ start: 0, end: 1000, type: 'konus' }]);
        expect(col.some((e: string) => e.includes('Kolizja otworu z elementem konus'))).toBe(true);
        // krag 1000-2000 daleko od otworu → czysto
        expect(s.validateCollisionsLive(well, [{ start: 1000, end: 2000, type: 'krag' }])).toEqual(
            []
        );
    });
});
