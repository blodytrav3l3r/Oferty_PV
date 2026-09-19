// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('recalculateWellErrors — czyszczenie błędów przy pustym configu', () => {
    let studnieProducts: any[] = [];

    beforeAll(() => {
        studnieProducts = [
            {
                id: 'krag-1000-500',
                componentType: 'krag',
                dn: '1000',
                height: 500,
                name: 'Krąg DN1000 H=500'
            },
            {
                id: 'prz-160',
                componentType: 'przejscie',
                dn: '160',
                name: 'Przejście 160'
            },
            {
                id: 'krag-1000-2000',
                componentType: 'krag',
                dn: '1000',
                height: 2000,
                name: 'Krąg DN1000 H=2000'
            },
            {
                id: 'konus-1000-500',
                componentType: 'konus',
                dn: '1000',
                height: 500,
                name: 'Konus DN1000 H=500'
            }
        ];
        (global as any).studnieProducts = studnieProducts;
        (global as any).logger = { info: () => {}, warn: () => {}, error: () => {} };
    });

    function loadSolver() {
        const context: any = {
            window: {},
            studnieProducts,
            FLOW_TYPES: Object.freeze({ WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' }),
            logger: (global as any).logger,
            wells: []
        };
        const codeGlobals = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/globals.js'),
            'utf8'
        );
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/solverValidation.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(codeGlobals, context);
        context.window.studnieProducts = studnieProducts;
        vm.runInContext(code, context);
        return context;
    }

    test('pusty config: kasuje nie-luzowe błędy solvera i ustawia status OK dla configSource MANUAL', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            configErrors: ['Zastosowana rozszerzona tolerancja - tryb Ratunkowy'],
            configStatus: 'ERROR',
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors).toEqual([]);
        expect(well.configStatus).toBe('OK');
    });

    test('pusty config: kasuje także błędy luzów', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'AUTO',
            configErrors: ['Błąd zapasu w "Krąg" dla przejścia nr 1 (dolot DN160)'],
            configStatus: 'ERROR',
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors).toEqual([]);
    });

    test('niepusty config bez przejść: stale kolizje geometryczne są czyszczone', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'MANUAL',
            configErrors: ['Kolizja otworu przejścia z elementem konstrukcyjnym'],
            configStatus: 'ERROR',
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors).toEqual([]);
        expect(well.configStatus).toBe('OK');
    });

    test('niepusty config: błąd asortymentu (Brak kręgu) jest zachowywany', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'MANUAL',
            configErrors: ['Brak kręgu wierconego DN1000 w cenniku — dodaj ręcznie'],
            configStatus: 'ERROR',
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors).toEqual([
            'Brak kręgu wierconego DN1000 w cenniku — dodaj ręcznie'
        ]);
        expect(well.configStatus).toBe('ERROR');
    });

    test('configStatus LOADING: brak mutacji', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'AUTO',
            configErrors: ['stary błąd'],
            configStatus: 'LOADING',
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors).toEqual(['stary błąd']);
        expect(well.configStatus).toBe('LOADING');
    });

    test('same notki (tolerancja/luzy minimalne): status WARNING zamiast ERROR', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'AUTO_JS',
            configErrors: ['Zastosowana rozszerzona tolerancja - tryb Ratunkowy'],
            configStatus: 'WARNING',
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors).toEqual(['Zastosowana rozszerzona tolerancja - tryb Ratunkowy']);
        expect(well.configStatus).toBe('WARNING');
    });

    test('stale kolizja bez przejść obok notki: zostaje sama notka (WARNING)', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'AUTO_JS',
            configErrors: [
                'Zastosowana rozszerzona tolerancja - tryb Ratunkowy',
                'Kolizja otworu z elementem płyta'
            ],
            configStatus: 'WARNING',
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors).toEqual(['Zastosowana rozszerzona tolerancja - tryb Ratunkowy']);
        expect(well.configStatus).toBe('WARNING');
    });

    test('stale notki luzów (zamiana kręgu) są usuwane przy przeliczeniu', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'MANUAL',
            configErrors: [
                'Przejście nr 3 (wylot DN300, rodzaj: PVC SN8) w "Krąg DN1200/750 z otworami": zastosowano luzy minimalne (dół=200mm, góra=250mm)'
            ],
            configStatus: 'ERROR',
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors).toEqual([]);
        expect(well.configStatus).toBe('OK');
    });

    test('aktualna notka luzów dla obecnego kręgu jest regenerowana', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'MANUAL',
            configErrors: [
                'Przejście nr 1 (wylot DN160, rodzaj: PVC SN8) w "Krąg DN1000/750 z otworami": zastosowano luzy minimalne (dół=120mm, góra=180mm)'
            ],
            configStatus: 'ERROR',
            przejscia: [
                {
                    productId: 'prz-160',
                    rzednaWlaczenia: '0.1',
                    flowType: 'wylot',
                    angle: 0
                }
            ],
            rzednaDna: 0
        };
        ctx.recalculateWellErrors(well);
        const note = well.configErrors.find((e) => e.includes('zastosowano luzy minimalne'));
        expect(note).toBeDefined();
        // Regenerowana notka opisuje BIEŻĄCY krąg (DN1000/500), nie usunięty 750
        expect(note).not.toContain('750');
        expect(note).toContain('Krąg DN1000');
    });

    test('rzednaWlaczenia poniżej rzednaDna: twardy błąd ERROR', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'MANUAL',
            rzednaDna: 100,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: '99.5', flowType: 'wylot', angle: 0 }
            ]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna włączenia przejścia'))).toBe(true);
        expect(well.configStatus).toBe('ERROR');
    });

    test('rzednaWlaczenia poniżej rzednaDna przy pustym config: błąd zachowany', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            rzednaDna: 100,
            przejscia: [{ rzednaWlaczenia: '99.5', angle: 0 }]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna włączenia przejścia'))).toBe(true);
        expect(well.configStatus).toBe('ERROR');
    });

    test('rzednaWlaczenia równa rzednaDna: brak błędu (granica)', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'MANUAL',
            rzednaDna: 100,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: '100.000', flowType: 'wylot', angle: 0 }
            ]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna włączenia przejścia'))).toBe(false);
    });

    test('rzednaWlaczenia powyżej rzednaDna: brak błędu', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'MANUAL',
            rzednaDna: 100,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: '100.500', flowType: 'wylot', angle: 0 }
            ]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna włączenia przejścia'))).toBe(false);
    });

    test('brak rzednaDna (null): pominięcie walidacji', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            rzednaDna: null,
            przejscia: [{ rzednaWlaczenia: '99.5', angle: 0 }]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna włączenia przejścia'))).toBe(false);
    });

    test('rzednaWlaczenia null: pominięcie walidacji', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            rzednaDna: 100,
            przejscia: [{ rzednaWlaczenia: null, angle: 0 }]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna włączenia przejścia'))).toBe(false);
    });

    test('naprawa rzędnej usuwa stary błąd przy przeliczeniu', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            configSource: 'MANUAL',
            rzednaDna: 100,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: '99.5', flowType: 'wylot', angle: 0 }
            ]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna włączenia przejścia'))).toBe(true);
        well.przejscia[0].rzednaWlaczenia = '100.500';
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna włączenia przejścia'))).toBe(false);
    });

    test('rzednaDna równa rzednaWlazu: twardy błąd ERROR', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            rzednaWlazu: 100,
            rzednaDna: 100,
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna dna'))).toBe(true);
        expect(well.configStatus).toBe('ERROR');
    });

    test('rzednaDna większa niż rzednaWlazu: twardy błąd ERROR', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            rzednaWlazu: 90,
            rzednaDna: 100,
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna dna'))).toBe(true);
        expect(well.configStatus).toBe('ERROR');
    });

    test('rzednaDna mniejsza niż rzednaWlazu: brak błędu', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            rzednaWlazu: 100,
            rzednaDna: 90,
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna dna'))).toBe(false);
    });

    test('brak rzednaWlazu (null): pominięcie walidacji rzędnej dna', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            rzednaWlazu: null,
            rzednaDna: 100,
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna dna'))).toBe(false);
    });

    test('naprawa rzędnej dna usuwa stary błąd rzędnej przy przeliczeniu', () => {
        const ctx = loadSolver();
        const well = {
            config: [],
            configSource: 'MANUAL',
            rzednaWlazu: 90,
            rzednaDna: 100,
            przejscia: []
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna dna'))).toBe(true);
        well.rzednaDna = 80;
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Rzędna dna'))).toBe(false);
    });

    test('stale Kolizja Z=2000 znika po ręcznym odsunięciu przejścia od jointa', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-2000', quantity: 1 }],
            configSource: 'MANUAL',
            configErrors: ['Kolizja otworu Z=2000 ze złączami (strefa minimalna)'],
            configStatus: 'ERROR',
            rzednaDna: 0,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: '0.8', flowType: 'wylot', angle: 0 }
            ]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Kolizja otworu'))).toBe(false);
        expect(well.configStatus).toBe('OK');
    });

    test('realna kolizja ze złączami jest wykrywana live (joint w strefie minimalnej)', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-2000', quantity: 1 }],
            configSource: 'MANUAL',
            configErrors: [],
            configStatus: 'OK',
            rzednaDna: 0,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: '1.9', flowType: 'wylot', angle: 0 }
            ]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('strefa minimalna'))).toBe(true);
        expect(well.configStatus).toBe('ERROR');
    });

    test('kolizja z elementem zakazanym (konus) jest wykrywana live', () => {
        const ctx = loadSolver();
        const well = {
            // config top-down: konus na górze, krąg na dole
            config: [
                { productId: 'konus-1000-500', quantity: 1 },
                { productId: 'krag-1000-2000', quantity: 1 }
            ],
            configSource: 'MANUAL',
            configErrors: [],
            configStatus: 'OK',
            rzednaDna: 0,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: '2.1', flowType: 'wylot', angle: 0 }
            ]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('Kolizja otworu z elementem konus'))).toBe(
            true
        );
        expect(well.configStatus).toBe('ERROR');
    });

    test('naprawa geometrii usuwa live kolizję przy kolejnym przeliczeniu', () => {
        const ctx = loadSolver();
        const well = {
            config: [{ productId: 'krag-1000-2000', quantity: 1 }],
            configSource: 'MANUAL',
            configErrors: [],
            configStatus: 'OK',
            rzednaDna: 0,
            przejscia: [
                { productId: 'prz-160', rzednaWlaczenia: '1.9', flowType: 'wylot', angle: 0 }
            ]
        };
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('strefa minimalna'))).toBe(true);
        well.przejscia[0].rzednaWlaczenia = '0.8';
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e) => e.includes('strefa minimalna'))).toBe(false);
        expect(well.configStatus).toBe('OK');
    });
});
