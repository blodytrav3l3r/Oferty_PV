// @ts-nocheck -- wzorzec vm (recalculateWellErrors.test.ts)
/* =============================================================
   Clamp rzędnej włączenia do zakresu dno–właz + gate zapisu.
   Wzorzec vm: recalculateWellErrors.test.ts + transitionZoneJoints.test.ts.
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f: string) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function loadValidation() {
    const toasts: string[] = [];
    const modals: any[] = [];
    const closes: string[] = [];
    const context: any = {
        window: {
            showModal: (opts: any) => {
                modals.push(opts);
                return opts;
            }
        },
        escapeHtml: (s: string) => String(s),
        showToast: (msg: string) => {
            toasts.push(String(msg));
        },
        closeModal: (id: string) => {
            closes.push(id);
        },
        document: { getElementById: () => ({}) },
        // vm nie ma timerów: mostek do (mockowanego) globalnego setTimeout
        setTimeout: (...args: any[]) => (setTimeout as any)(...args),
        studnieProducts: [],
        FLOW_TYPES: Object.freeze({ WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' }),
        wells: []
    };
    vm.createContext(context);
    vm.runInContext(readStudnie('globals.js'), context);
    vm.runInContext(readStudnie('solverValidation.js'), context);
    return { context, toasts, modals, closes };
}

function loadHandlers(extra: any = {}) {
    const toasts: string[] = [];
    const modals: any[] = [];
    const calls: { manual: number[]; auto: number[] } = { manual: [], auto: [] };
    const wells: any[] = [];
    const context: any = {
        window: {
            showModal: (opts: any) => {
                modals.push(opts);
                return opts;
            }
        },
        escapeHtml: (s: string) => String(s),
        closeModal: () => {},
        document: { getElementById: () => ({}) },
        // no-op: auto-close testowane w loadValidation (fake timers); tu liczy się showModal
        setTimeout: () => 0,
        wells,
        currentWellIndex: 0,
        _excelActiveTab: '1000',
        _excelAutoSelectEnabled: true,
        _excelPasteInProgress: false,
        studnieProducts: [],
        showToast: (msg: string) => {
            toasts.push(String(msg));
        },
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
        _excelClearResCache: () => {},
        _excelMarkDirty: () => {},
        _excelRefreshAutoCells: () => {},
        _excelUpdateLeftPreview: () => {},
        _excelImmediatePreview: () => {},
        _excelDebouncedRefresh: () => {},
        _excelRenderTable: () => {},
        autoSelectComponents: () => {},
        ...extra
    };
    vm.createContext(context);
    // BEZ globals.js: jego `let wells` shadowowałby tablicę wells z kontekstu
    // (wzorzec P2 z transitionZoneJoints.test.ts).
    vm.runInContext(readStudnie('solverValidation.js'), context);
    vm.runInContext(readStudnie('excelChangeHandlers.js'), context);
    return { context, calls, wells, toasts, modals };
}

describe('clampRzednaWlaczenia (helper SSoT)', () => {
    it('poniżej dna → dno + flaga', () => {
        const { context: ctx } = loadValidation();
        const r = ctx.clampRzednaWlaczenia(1.2, { rzednaDna: 1.5, rzednaWlazu: 3 });
        expect(r).toEqual({ value: 1.5, clampedLow: true, clampedHigh: false });
    });
    it('powyżej włazu → właz + flaga', () => {
        const { context: ctx } = loadValidation();
        const r = ctx.clampRzednaWlaczenia(3.5, { rzednaDna: 1.5, rzednaWlazu: 3 });
        expect(r).toEqual({ value: 3, clampedLow: false, clampedHigh: true });
    });
    it('w zakresie → bez zmian', () => {
        const { context: ctx } = loadValidation();
        const r = ctx.clampRzednaWlaczenia(2, { rzednaDna: 1.5, rzednaWlazu: 3 });
        expect(r).toEqual({ value: 2, clampedLow: false, clampedHigh: false });
    });
    it('null/NaN/brak well → bez zmian', () => {
        const { context: ctx } = loadValidation();
        expect(ctx.clampRzednaWlaczenia(null, { rzednaDna: 1 }).value).toBe(null);
        expect(ctx.clampRzednaWlaczenia(1.2, null).clampedLow).toBe(false);
        expect(ctx.clampRzednaWlaczenia(1.2, { rzednaDna: null, rzednaWlazu: null })).toEqual({
            value: 1.2,
            clampedLow: false,
            clampedHigh: false
        });
    });
});

describe('listPrzejsciaBelowDna (format listy)', () => {
    it('format: nr + wartości z przecinkiem', () => {
        const { context: ctx } = loadValidation();
        const well = {
            rzednaDna: 1.5,
            przejscia: [
                { rzednaWlaczenia: 2.0 },
                { rzednaWlaczenia: 1.2 },
                { rzednaWlaczenia: null }
            ]
        };
        expect(ctx.listPrzejsciaBelowDna(well)).toEqual(['nr 2 (1,200 m < dno 1,500 m)']);
    });
    it('pusto / brak dna → []', () => {
        const { context: ctx } = loadValidation();
        expect(ctx.listPrzejsciaBelowDna({ rzednaDna: 1, przejscia: [] })).toEqual([]);
        expect(
            ctx.listPrzejsciaBelowDna({ rzednaDna: null, przejscia: [{ rzednaWlaczenia: 1 }] })
        ).toEqual([]);
    });
});

describe('validatePrzejsciaForSave (gate zapisu)', () => {
    it('przejście poniżej dna → invalid', () => {
        const { context: ctx } = loadValidation();
        // `let studnieProducts` z globals.js: przypisanie przez runInContext,
        // inaczej cień leksykalny (nie właściwość kontekstu).
        vm.runInContext(`studnieProducts = [{ id: 'prz-160', category: 'A' }];`, ctx);
        const v = ctx.validatePrzejsciaForSave([
            {
                name: 'S1',
                rzednaDna: 1.5,
                przejscia: [{ productId: 'prz-160', rzednaWlaczenia: 1.2, angle: 0 }]
            }
        ]);
        expect(v.valid).toBe(false);
        expect(v.errors[0]).toContain('poniżej rzędnej dna');
        expect(v.errors[0]).toContain('#1');
    });
    it('przejście w zakresie → valid', () => {
        const { context: ctx } = loadValidation();
        vm.runInContext(`studnieProducts = [{ id: 'prz-160', category: 'A' }];`, ctx);
        const v = ctx.validatePrzejsciaForSave([
            {
                name: 'S1',
                rzednaDna: 1.0,
                przejscia: [{ productId: 'prz-160', rzednaWlaczenia: 1.2, angle: 0 }]
            }
        ]);
        expect(v.valid).toBe(true);
    });
});

describe('excelOnPrzejscieChange (clamp + toast)', () => {
    function manualWell() {
        return {
            autoSelect: false,
            autoLocked: true,
            rzednaWlazu: 3.0,
            rzednaDna: 1.5,
            przejscia: [{ productId: 'prz-160', rzednaWlaczenia: 2.0, angle: 0 }]
        };
    }
    it('poniżej dna → clamp + dokładnie 1 toast', () => {
        const { context, wells, toasts } = loadHandlers();
        wells.push(manualWell());
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '1.2');
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(1.5);
        expect(toasts).toHaveLength(1);
        expect(toasts[0]).toContain('niższa niż rzędna dna');
    });
    it('powyżej włazu → clamp + dokładnie 1 toast', () => {
        const { context, wells, toasts } = loadHandlers();
        wells.push(manualWell());
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '3.8');
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(3.0);
        expect(toasts).toHaveLength(1);
        expect(toasts[0]).toContain('wyższa niż rzędna włazu');
    });
    it('w zakresie → bez zmian, bez toastu', () => {
        const { context, wells, toasts } = loadHandlers();
        wells.push(manualWell());
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '2.2');
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(2.2);
        expect(toasts).toHaveLength(0);
    });
    it('quiet (fill/paste) → clamp cicho, bez toastu', () => {
        const { context, wells, toasts } = loadHandlers();
        wells.push(manualWell());
        context._excelPasteInProgress = true;
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '1.2');
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(1.5);
        expect(toasts).toHaveLength(0);
    });
    it('pusto → null, bez toastu', () => {
        const { context, wells, toasts } = loadHandlers();
        wells.push(manualWell());
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '');
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(null);
        expect(toasts).toHaveLength(0);
    });
});

describe('excelOnRzednaChange (dno powyżej przejść)', () => {
    it('jeden toast z listą, wartość dna zapisana', () => {
        const wlazInput = { value: '2.5', classList: { add: () => {}, remove: () => {} } };
        const dnaInput = { value: '1.6', classList: { add: () => {}, remove: () => {} } };
        const row = {
            querySelector: (sel: string) =>
                String(sel).includes('rzednaWlazu') ? wlazInput : dnaInput
        };
        const { context, wells, toasts } = loadHandlers({
            document: { querySelector: () => row }
        });
        const w: any = {
            autoSelect: false,
            rzednaWlazu: 2.5,
            rzednaDna: 1.0,
            przejscia: [{ productId: 'prz-160', rzednaWlaczenia: 1.2, angle: 0 }]
        };
        wells.push(w);
        context.excelOnRzednaChange(0);
        expect(w.rzednaDna).toBe(1.6);
        expect(toasts).toHaveLength(1);
        expect(toasts[0]).toContain('nr 1');
        expect(toasts[0]).toContain('1,200 m < dno 1,600 m');
    });
});

describe('announceRzednaClamp (toast + modal równocześnie)', () => {
    it('clamp w dół → toast + modal z poprawioną wartością', () => {
        jest.useFakeTimers();
        try {
            const { context: ctx, toasts, modals } = loadValidation();
            const msg = ctx.announceRzednaClamp({
                value: 1.5,
                clampedLow: true,
                clampedHigh: false
            });
            expect(msg).toContain('niższa niż rzędna dna');
            expect(toasts).toHaveLength(1);
            expect(modals).toHaveLength(1);
            expect(modals[0].id).toBe('rzedna-clamp-popup');
            expect(modals[0].html).toContain('1,500');
            expect(modals[0].html).toContain('Rozumiem');
            jest.advanceTimersByTime(2000);
        } finally {
            jest.useRealTimers();
        }
    });
    it('brak clampowania → cisza (null, bez toastu i modala)', () => {
        const { context: ctx, toasts, modals } = loadValidation();
        expect(ctx.announceRzednaClamp({ value: 2, clampedLow: false, clampedHigh: false })).toBe(
            null
        );
        expect(toasts).toHaveLength(0);
        expect(modals).toHaveLength(0);
    });
    it('fallback: brak showModal → sam toast', () => {
        const { context: ctx, toasts, modals } = loadValidation();
        ctx.window.showModal = undefined;
        ctx.showRzednaClampPopup('Rzędna nie może być niższa niż rzędna dna!', 1.5);
        expect(modals).toHaveLength(0);
        expect(toasts).toHaveLength(1);
    });
});

describe('showRzednaClampPopup (auto-close 2 s)', () => {
    afterEach(() => {
        jest.useRealTimers();
    });
    it('zamyka modal po 2 s', () => {
        jest.useFakeTimers();
        const { context: ctx, closes } = loadValidation();
        ctx.showRzednaClampPopup('Rzędna nie może być niższa niż rzędna dna!', 1.5);
        expect(closes).toHaveLength(0);
        jest.advanceTimersByTime(2000);
        expect(closes).toEqual(['rzedna-clamp-popup']);
    });
    it('starszy timer nie zamyka nowszego modala', () => {
        jest.useFakeTimers();
        const { context: ctx, closes } = loadValidation();
        ctx.showRzednaClampPopup('msg1', 1.5);
        jest.advanceTimersByTime(1000);
        ctx.showRzednaClampPopup('msg2', 1.6);
        jest.advanceTimersByTime(1000);
        expect(closes).toHaveLength(0);
        jest.advanceTimersByTime(1000);
        expect(closes).toEqual(['rzedna-clamp-popup']);
    });
    it('ręcznie zamknięty (brak elementu) → bez close', () => {
        jest.useFakeTimers();
        const { context: ctx, closes } = loadValidation();
        ctx.document.getElementById = () => null;
        ctx.showRzednaClampPopup('msg', 1.5);
        jest.advanceTimersByTime(2000);
        expect(closes).toHaveLength(0);
    });
    it('brak document → bez błędu, bez close', () => {
        jest.useFakeTimers();
        const { context: ctx, closes } = loadValidation();
        ctx.document = undefined;
        expect(() => {
            ctx.showRzednaClampPopup('msg', 1.5);
            jest.advanceTimersByTime(2000);
        }).not.toThrow();
        expect(closes).toHaveLength(0);
    });
});

describe('excelOnPrzejscieChange (modal)', () => {
    function manualWell() {
        return {
            autoSelect: false,
            autoLocked: true,
            rzednaWlazu: 3.0,
            rzednaDna: 1.5,
            przejscia: [{ productId: 'prz-160', rzednaWlaczenia: 2.0, angle: 0 }]
        };
    }
    it('clamp na żywo → toast + modal', () => {
        const { context, wells, toasts, modals } = loadHandlers();
        wells.push(manualWell());
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '1.2');
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(1.5);
        expect(toasts).toHaveLength(1);
        expect(modals).toHaveLength(1);
        expect(modals[0].id).toBe('rzedna-clamp-popup');
    });
    it('quiet (fill/paste) → brak toastu i modala', () => {
        const { context, wells, toasts, modals } = loadHandlers();
        wells.push(manualWell());
        context._excelPasteInProgress = true;
        context.excelOnPrzejscieChange(0, 0, 'rzednaWlaczenia', '1.2');
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(1.5);
        expect(toasts).toHaveLength(0);
        expect(modals).toHaveLength(0);
    });
});

describe('savePrzejscieEdit (kafelkowy Zapisz w konfiguratorze)', () => {
    function loadCrud() {
        const toasts: string[] = [];
        const modals: any[] = [];
        const well: any = {
            rzednaWlazu: 3.0,
            rzednaDna: 1.5,
            przejscia: [{ productId: 'prz-160', rzednaWlaczenia: 2.0, angle: 0 }]
        };
        const context: any = {
            window: {
                showModal: (opts: any) => {
                    modals.push(opts);
                    return opts;
                },
                refreshZleceniaModalIfActive: () => {}
            },
            escapeHtml: (s: string) => String(s),
            showToast: (msg: string) => {
                toasts.push(String(msg));
            },
            closeModal: () => {},
            document: { getElementById: () => ({}) },
            setTimeout: () => 0,
            isOfferLocked: () => false,
            isWellLocked: () => false,
            getCurrentWell: () => well,
            syncEditState: () => {},
            parseCalcExpression: (v: string) => {
                const n = parseFloat(String(v).replace(',', '.'));
                return isNaN(n) ? null : n;
            },
            refreshAll: () => {},
            autoSelectComponents: () => {},
            renderWellPrzejscia: () => {}
        };
        vm.createContext(context);
        vm.runInContext(readStudnie('solverValidation.js'), context);
        vm.runInContext(readStudnie('wellTransitionsState.js'), context);
        vm.runInContext(readStudnie('wellTransitionsCrud.js'), context);
        return { context, well, toasts, modals };
    }
    function setEditState(context: any, rzedna: string) {
        // `let` w wellTransitionsState.js: przypisanie przez runInContext
        vm.runInContext(
            `editPrzejscieState = { dnId: 'prz-160', rzedna: '${rzedna}', angle: 0, spadekKineta: '', spadekMufa: '' };`,
            context
        );
    }
    it('poniżej dna → clamp + toast + modal', () => {
        const { context, well, toasts, modals } = loadCrud();
        setEditState(context, '1.2');
        context.savePrzejscieEdit(0);
        expect(well.przejscia[0].rzednaWlaczenia).toBe('1.500');
        expect(toasts).toHaveLength(2); // clamp + 'Zapisano zmiany przejścia'
        expect(toasts[0]).toContain('niższa niż rzędna dna');
        expect(modals).toHaveLength(1);
        expect(modals[0].id).toBe('rzedna-clamp-popup');
    });
    it('w zakresie → bez zmian, cisza', () => {
        const { context, well, toasts, modals } = loadCrud();
        setEditState(context, '2.2');
        context.savePrzejscieEdit(0);
        expect(well.przejscia[0].rzednaWlaczenia).toBe('2.200');
        expect(toasts).toHaveLength(1); // 'Zapisano zmiany przejścia'
        expect(toasts[0]).toContain('Zapisano');
        expect(modals).toHaveLength(0);
    });
    it('pusto → null, bez modala', () => {
        const { context, well, modals } = loadCrud();
        setEditState(context, '');
        context.savePrzejscieEdit(0);
        expect(well.przejscia[0].rzednaWlaczenia).toBe(null);
        expect(modals).toHaveLength(0);
    });
});

describe('_excelSetModelCellValue (paste F1: cichy clamp)', () => {
    function loadPaste() {
        const wells: any[] = [
            {
                rzednaWlazu: 3.0,
                rzednaDna: 1.5,
                przejscia: [{ productId: '', rzednaWlaczenia: null, angle: 0 }]
            }
        ];
        const context: any = {
            window: {
                showModal: () => ({}),
                degToGon: (d: number) => ((d * 400) / 360).toFixed(2)
            },
            wells,
            _excelActiveTab: '1000',
            _excelIsWellLocked: () => false,
            _excelCreatePrzejscie: () => ({ productId: '', rzednaWlaczenia: null, angle: 0 }),
            _excelModelLogicalIsPrzejscie: (l: number) => l >= 7,
            autoUpdateWellName: () => {}
        };
        vm.createContext(context);
        vm.runInContext(readStudnie('solverValidation.js'), context);
        vm.runInContext(readStudnie('excelPasteSeq.js'), context);
        vm.runInContext(readStudnie('excelPasteMismatch.js'), context);
        vm.runInContext(readStudnie('excelCopyPaste.js'), context);
        return { context, wells };
    }
    it('rzędna poniżej dna → cichy clamp do dna', () => {
        const { context, wells } = loadPaste();
        const r = context._excelSetModelCellValue(0, 7, '1.2', null, null);
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(1.5);
        expect(r).not.toBe('locked');
    });
    it('rzędna w zakresie → bez zmian', () => {
        const { context, wells } = loadPaste();
        context._excelSetModelCellValue(0, 7, '2.2', null, null);
        expect(wells[0].przejscia[0].rzednaWlaczenia).toBe(2.2);
    });
});

describe('kontrakt źródłowy (panel woła helpery)', () => {
    it('saveQuickEdit deleguje clamp', () => {
        expect(readStudnie('wellTransitions.js')).toContain('clampRzednaWlaczenia');
    });
    it('inlineFinish clampuje przed push', () => {
        const src = readStudnie('wellTransitionsInline.js');
        expect(src).toContain('clampRzednaWlaczenia');
        expect(src.indexOf('clampRzednaWlaczenia')).toBeLessThan(src.indexOf('przejscia.push'));
    });
    it('updateElevations listuje przejścia poniżej dna', () => {
        expect(readStudnie('actionsElevation.js')).toContain('listPrzejsciaBelowDna');
    });
    it('clampy wołają announceRzednaClamp (toast + modal)', () => {
        expect(readStudnie('wellTransitions.js')).toContain('announceRzednaClamp');
        expect(readStudnie('wellTransitionsInline.js')).toContain('announceRzednaClamp');
        expect(readStudnie('excelChangeHandlers.js')).toContain('announceRzednaClamp');
    });
});
