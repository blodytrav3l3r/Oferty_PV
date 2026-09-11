// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/* =============================================================
   P1: OT = containment korpusu (segmentContainsBody),
   joint = walidacja strefa (jointInZone), brak bypassu krag_ot.
   Macierz A-E z planu docs/plans/2026-09-11-auto-dobor-przejscia-na-laczeniach.md
   ============================================================= */

function loadTransitionZones() {
    const context: any = {
        window: {},
        structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj))
    };
    vm.createContext(context);
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/transitionZones.js'),
        'utf8'
    );
    vm.runInContext(code, context);
    return context;
}

describe('transitionZones SSoT', () => {
    let ctx: any;
    beforeAll(() => {
        ctx = loadTransitionZones();
    });

    describe('getTransitionDn', () => {
        it('plain DN', () => {
            expect(ctx.getTransitionDn({ dn: '160' })).toBe(160);
            expect(ctx.getTransitionDn({ dn: 200 })).toBe(200);
        });
        it('format ułamkowy bierze drugi człon', () => {
            expect(ctx.getTransitionDn({ dn: '110/160' })).toBe(160);
        });
        it('brak produktu → legacy 160', () => {
            expect(ctx.getTransitionDn(null)).toBe(160);
            expect(ctx.getTransitionDn({})).toBe(160);
        });
    });

    describe('getTransitionBody', () => {
        it('liczy dół/górę/środek w mm od dna', () => {
            expect(ctx.getTransitionBody(1.4, 0, 160)).toEqual({
                bottomMm: 1400,
                topMm: 1560,
                centerMm: 1480,
                dnMm: 160
            });
        });
        it('brak rzędnej → null', () => {
            expect(ctx.getTransitionBody(null, 0, 160)).toBeNull();
            expect(ctx.getTransitionBody('', 0, 160)).toBeNull();
            expect(ctx.getTransitionBody(undefined, 0, 160)).toBeNull();
        });
    });

    describe('segmentContainsBody — granice domknięte', () => {
        it('korpus równo na granicach segmentu → true (przypadek C)', () => {
            expect(
                ctx.segmentContainsBody({ start: 0, end: 500 }, { bottomMm: 0, topMm: 500 })
            ).toBe(true);
        });
        it('korpus wystaje dołem/górą → false', () => {
            expect(
                ctx.segmentContainsBody({ start: 0, end: 500 }, { bottomMm: -1, topMm: 400 })
            ).toBe(false);
            expect(
                ctx.segmentContainsBody({ start: 0, end: 500 }, { bottomMm: 100, topMm: 501 })
            ).toBe(false);
        });
        it('null-safety', () => {
            expect(ctx.segmentContainsBody(null, { bottomMm: 0, topMm: 1 })).toBe(false);
            expect(ctx.segmentContainsBody({ start: 0, end: 1 }, null)).toBe(false);
        });
    });

    describe('macierz A-E', () => {
        it('A: korpus w całości w segmencie → OT tak', () => {
            const body = ctx.getTransitionBody(0.1, 0, 160); // 100..260
            expect(ctx.segmentContainsBody({ start: 0, end: 500 }, body)).toBe(true);
        });
        it('B (regresja): środek w segmencie, korpus wystaje → OT NIE', () => {
            // Stary warunek center∈[start,end) przepuszczał; nowy musi odrzucić.
            const body = ctx.getTransitionBody(0.37, 0, 160); // 370..530, środek 450
            expect(body.centerMm).toBeGreaterThanOrEqual(0);
            expect(body.centerMm).toBeLessThan(500);
            expect(ctx.segmentContainsBody({ start: 0, end: 500 }, body)).toBe(false);
        });
        it('D: korpus tnie joint → żaden segment go nie zawiera', () => {
            const body = ctx.getTransitionBody(1.4, 0, 160); // 1400..1560, joint 1500
            expect(ctx.segmentContainsBody({ start: 1000, end: 1500 }, body)).toBe(false);
            expect(ctx.segmentContainsBody({ start: 1500, end: 2000 }, body)).toBe(false);
        });
        it('D: joint 1500 w strefie std i minimalnej → FAIL obu', () => {
            const body = ctx.getTransitionBody(1.4, 0, 160);
            const zone = ctx.getTransitionZone(
                body,
                { dolStd: 300, goraStd: 300, dolMin: 150, goraMin: 150 },
                15
            );
            expect(zone.std).toEqual({ bottomMm: 1085, topMm: 1875 });
            expect(zone.min).toEqual({ bottomMm: 1235, topMm: 1725 });
            expect(ctx.jointInZone(1500, zone.std)).toBe(true);
            expect(ctx.jointInZone(1500, zone.min)).toBe(true);
            expect(ctx.jointInZone(1000, zone.std)).toBe(false);
        });
        it('E (anty-bypass): joint w strefie FAIL niezależnie od typu sąsiada', () => {
            // Predykat nie zna typu segmentu — krag_ot nad jointem nic nie zmienia.
            const body = ctx.getTransitionBody(1.4, 0, 160);
            const zone = ctx.getTransitionZone(
                body,
                { dolStd: 300, goraStd: 300, dolMin: 150, goraMin: 150 },
                15
            );
            expect(ctx.jointInZone(1500, zone.min)).toBe(true);
        });
    });

    describe('kontrakt źródłowy (P1.2b/P1.3)', () => {
        const solverPath = path.join(__dirname, '../../public/js/studnie/solverAutoSelect.js');
        it('brak bypassu hasOTAbove w solverze', () => {
            const src = fs.readFileSync(solverPath, 'utf8');
            expect(src).not.toContain('hasOTAbove');
            expect(src).not.toContain('jointInBody');
        });
        it('osobny komunikat strefy minimalnej', () => {
            const src = fs.readFileSync(solverPath, 'utf8');
            expect(src).toContain('strefa minimalna');
        });
    });
});

describe('P2: excelOnPrzejscieChange kontrakt AUTO/MANUAL', () => {
    function loadHandlers() {
        const calls: { manual: number[]; auto: number[]; renders: number } = {
            manual: [],
            auto: [],
            renders: 0
        };
        const wells: any[] = [];
        const context: any = {
            window: {},
            wells,
            currentWellIndex: 0,
            _excelActiveTab: '1000',
            _excelAutoSelectEnabled: true,
            _excelPasteInProgress: false,
            studnieProducts: [],
            _excelGuardWellLocked: () => true,
            _excelSaveUndoSnapshot: () => {},
            _excelCreatePrzejscie: () => ({ productId: '', rzednaWlaczenia: null, angle: 0 }),
            _excelMarkAsManual: (wIdx: number) => {
                calls.manual.push(wIdx);
                wells[wIdx].autoSelect = false;
            },
            _excelAutoSelectForWell: (wIdx: number) => {
                calls.auto.push(wIdx);
            },
            _excelUpdateLeftPreview: () => {},
            _excelImmediatePreview: () => {},
            _excelDebouncedRefresh: () => {},
            _excelRenderTable: () => {
                calls.renders++;
            },
            autoSelectComponents: () => {},
            structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj))
        };
        vm.createContext(context);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelChangeHandlers.js'),
            'utf8'
        );
        vm.runInContext(code, context);
        return { context, calls, wells };
    }

    function autoWell() {
        return {
            autoSelect: true,
            autoLocked: false,
            configSource: 'AUTO',
            rzednaWlazu: 2.5,
            rzednaDna: 0,
            przejscia: [{ productId: 'prz-160', rzednaWlaczenia: 1.0, angle: 0 }]
        };
    }

    it('AUTO + rzednaWlaczenia → re-solve, bez markAsManual', () => {
        const { context, calls, wells } = loadHandlers();
        wells.push(autoWell());
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '1.2');
        expect(calls.auto).toEqual([0]);
        expect(calls.manual).toEqual([]);
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(1.2);
    });
    it('AUTO + productId → re-solve', () => {
        const { context, calls, wells } = loadHandlers();
        wells.push(autoWell());
        context.excelOnPrzejscieChange(0, 0, 'productId', 'prz-200');
        expect(calls.auto).toEqual([0]);
        expect(calls.manual).toEqual([]);
    });
    it('MANUAL + geometria → solver NIE startuje (invariant)', () => {
        const { context, calls, wells } = loadHandlers();
        const w = autoWell();
        w.autoSelect = false;
        w.autoLocked = true;
        wells.push(w);
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '1.2');
        expect(calls.auto).toEqual([]);
        expect(calls.manual).toEqual([0]);
    });
    it('AUTO + sam angle → solver NIE startuje', () => {
        const { context, calls, wells } = loadHandlers();
        wells.push(autoWell());
        context.excelOnPrzejscieChange(0, 0, 'angle', '45');
        expect(calls.auto).toEqual([]);
        expect(calls.manual).toEqual([0]);
    });
    it('TypeChange AUTO + kompletne przejście → re-solve; niekompletne → sam refresh', () => {
        const h1 = loadHandlers();
        h1.wells.push(autoWell());
        h1.context.excelOnPrzejscieTypeChange(0, 0, 'inne');
        // productId wyczyszczone (kategoria nie pasuje) → brak solve, jest render
        expect(h1.calls.auto).toEqual([]);
        expect(h1.calls.renders).toBe(1);

        const h2 = loadHandlers();
        const w2 = autoWell();
        w2.przejscia = [{ productId: 'prz-160', rzednaWlaczenia: 1.0, angle: 0 }];
        h2.wells.push(w2);
        h2.context.studnieProducts = [{ id: 'prz-160', category: 'A' }];
        h2.context.excelOnPrzejscieTypeChange(0, 0, 'A');
        expect(h2.calls.auto).toEqual([0]);
    });
});
