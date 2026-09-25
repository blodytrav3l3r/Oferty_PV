// @ts-nocheck -- wzorzec vm (rzednaClamp.test.ts)
// Regresja PZ 2-klik: switch pól quick-edit (A→B) zapisuje synchronicznie
// BEZ renderów niszczących nowy input. Pełny refresh (zwłaszcza async
// populate modala PZ z fetchem) należy dopiero do blur poza pola QE.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f: string) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function loadQE() {
    class FakeElement {}
    const calls = {
        list: 0,
        modal: [] as any[],
        diagram: 0,
        summary: 0,
        blurOld: 0,
        focusNew: 0
    };
    const timers: Array<{ id: number; fn: () => void; delay: number }> = [];
    let timerSeq = 0;
    const locks = { well: false, offer: false };
    const well: any = {
        rzednaWlazu: 3.0,
        rzednaDna: 1.5,
        przejscia: [{ id: 'prz-1', productId: 'prz-160', rzednaWlaczenia: 2.0, angle: 0 }]
    };
    const bodyEl = { tagName: 'BODY', closest: () => null };
    const context: any = {
        window: {},
        HTMLElement: FakeElement,
        document: {
            activeElement: bodyEl,
            getElementById: () => null,
            addEventListener: () => {}
        },
        getCurrentWell: () => well,
        isWellLocked: () => locks.well,
        isOfferLocked: () => locks.offer,
        resolvePrzejscieIndex: (_w: any, _el: any, fb: number) => fb,
        parseCalcExpression: (v: string) => parseFloat(String(v).replace(',', '.')),
        renderWellDiagram: () => {
            calls.diagram++;
        },
        updateSummary: () => {
            calls.summary++;
        },
        escapeHtml: (s: string) => String(s),
        escapeHtmlAttr: (s: string) => String(s),
        showToast: () => {},
        WELL_LOCKED_MSG: 'well',
        OFFER_LOCKED_MSG: 'offer',
        FLOW_TYPES: Object.freeze({ WYLOT: 'wylot', WLOT: 'wlot' }),
        setTimeout: (fn: () => void, delay?: number) => {
            const id = ++timerSeq;
            timers.push({ id, fn, delay: delay ?? 0 });
            return id;
        },
        clearTimeout: (id: number) => {
            const i = timers.findIndex((t) => t.id === id);
            if (i >= 0) timers.splice(i, 1);
        }
    };
    // window.* spies AFTER load (plik nadpisuje refreshPrzejsciaViews własną).
    vm.createContext(context);
    vm.runInContext(readStudnie('wellTransitions.js'), context);
    // Definicje activateQuickEdit/saveQuickEdit powstają przy wywołaniu
    // renderWellPrzejscia (kontener null → tylko definicje, brak renderu).
    context.window.renderWellPrzejscia();
    context.window.refreshPrzejsciaViews = () => {
        calls.list++;
    };
    context.window.refreshZleceniaModalIfActive = (...args: any[]) => {
        calls.modal.push(args);
        return Promise.resolve();
    };
    const cellA = { id: 'A' };
    const cellB = { id: 'B' };
    const mkInput = (cell: any) =>
        Object.assign(new FakeElement(), {
            tagName: 'INPUT',
            dataset: {} as any,
            value: '45',
            closest: (sel: string) => (sel === '[data-qe-id]' ? cell : null),
            blur: () => {
                calls.blurOld++;
                context.document.activeElement = bodyEl; // jak przeglądarka: fokus spada na body
            }
        });
    return { context, calls, timers, well, bodyEl, cellA, cellB, mkInput, locks };
}

describe('quick-edit switch A→B (PZ 1-klik)', () => {
    it('zapis synchroniczny, cichy: model zmutowany, lista/modal nietknięte, timer brak', () => {
        const { context, calls, timers, well, cellA, cellB, mkInput, bodyEl } = loadQE();
        const inputA = mkInput(cellA);
        const inputB = mkInput(cellB);
        context.document.activeElement = inputB; // fokus już w nowym polu
        context.window.saveQuickEdit(0, 'angle', '45', inputA);
        expect(well.przejscia[0].angle).toBe(45);
        expect(calls.list).toBe(0);
        expect(calls.modal).toEqual([]);
        // Ciężkie rendery odroczone poza task clicka (geometria stabilna).
        expect(calls.diagram).toBe(0);
        expect(calls.summary).toBe(0);
        expect(timers.length).toBe(1);
        expect(timers[0].delay).toBe(0); // odroczone heavy, nie exit-timer
        timers[0].fn(); // fokus dalej w QE → ciężkie rendery lecą async
        expect(calls.diagram).toBe(1);
        expect(calls.summary).toBe(1);
        context.document.activeElement = bodyEl;
        timers[0].fn(); // fokus poza QE → skip (pełny refresh ścieżki wyjścia i tak leci)
        expect(calls.diagram).toBe(1);
        expect(calls.summary).toBe(1);
    });

    it('blur poza pola: zapis leniwy (timer), pełny refresh dopiero po 100ms', () => {
        const { context, calls, timers, well, bodyEl, cellA, mkInput } = loadQE();
        context.document.activeElement = bodyEl;
        const inputA = mkInput(cellA);
        context.window.saveQuickEdit(0, 'angle', '45', inputA);
        expect(well.przejscia[0].angle).toBe(0); // jeszcze nie zapisane
        expect(timers.length).toBe(1);
        expect(timers[0].delay).toBe(100); // exit-timer, nie odroczone heavy
        timers[0].fn();
        expect(well.przejscia[0].angle).toBe(45);
        expect(calls.list).toBe(1);
        expect(calls.modal.length).toBe(1);
        expect(calls.modal[0]).toEqual([]); // full, bez {light:true}
    });

    it('gałąź pending w activateQuickEdit: apply pod __qeNoRender, synchronicznie, nowy input z fokusem', async () => {
        const { context, calls, well, cellA, mkInput } = loadQE();
        let silentSeen: boolean | null = null;
        context.window.__pendingPrzejsciaRefresh = 7;
        context.window.__pendingPrzejsciaApply = () => {
            silentSeen = !!context.window.__qeNoRender;
        };
        const inputA = mkInput(cellA);
        context.document.activeElement = inputA;
        let built = false;
        const fakeInput = {
            focus: () => {
                calls.focusNew++;
            },
            select: () => {}
        };
        const fakeEl: any = {
            querySelector: () => (built ? fakeInput : null),
            closest: () => null,
            contains: () => false,
            getAttribute: (n: string) => (n === 'data-qe-id' ? 'prz-1' : 'angle'),
            isConnected: true,
            offsetWidth: 0
        };
        Object.defineProperty(fakeEl, 'innerHTML', {
            set() {
                built = true;
            },
            get() {
                return '';
            }
        });
        context.window.activateQuickEdit(fakeEl, 0, 'angle');
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        expect(calls.blurOld).toBe(1); // wymuszony blur starego pola
        expect(silentSeen).toBe(true); // pending-apply w trybie cichym
        expect(calls.modal).toEqual([]); // zero refresha modala w switchu (nawet light)
        expect(calls.list).toBe(1); // tylko sync refresh z rebuildInput
        expect(built).toBe(true);
        expect(calls.focusNew).toBe(1); // nowy input otwarty z fokusem = 1-klik
        expect(well.przejscia).toHaveLength(1);
    });

    it('nie pomija nowego pola, gdy przeglądarka trzyma blurnięty input jako activeElement', () => {
        const { context, calls, cellA, mkInput } = loadQE();
        let built = false;
        const nextInput = {
            focus: () => {
                calls.focusNew++;
            },
            select: () => {}
        };
        const nextCell: any = {
            querySelector: () => (built ? nextInput : null),
            closest: () => null,
            contains: () => false,
            getAttribute: (name: string) => (name === 'data-qe-id' ? 'prz-2' : 'angle'),
            isConnected: true,
            offsetWidth: 0
        };
        Object.defineProperty(nextCell, 'innerHTML', {
            set() {
                built = true;
            },
            get() {
                return '';
            }
        });
        const oldInput = mkInput(cellA);
        oldInput.isConnected = true;
        oldInput.blur = () => {
            calls.blurOld++;
            // W Chromium activeElement może przez moment nadal wskazywać
            // poprzednie pole, mimo że kliknięto już nowe.
        };
        context.document.activeElement = oldInput;

        context.window.activateQuickEdit(nextCell, 0, 'angle');

        expect(calls.blurOld).toBe(1);
        expect(built).toBe(true);
        expect(calls.focusNew).toBe(1);
    });

    it('rebuildInput bierze kontener z wejścia, nie z odłączonego elementu', async () => {
        const { context, calls, cellA, mkInput } = loadQE();
        context.window.__pendingPrzejsciaRefresh = 7;
        context.window.__pendingPrzejsciaApply = () => {};
        const inputA = mkInput(cellA);
        context.document.activeElement = inputA;
        const seenIds: string[] = [];
        let builtOnNew = false;
        const fakeInput = {
            focus: () => {
                calls.focusNew++;
            },
            select: () => {}
        };
        const newElFake: any = {
            querySelector: () => (builtOnNew ? fakeInput : null),
            closest: () => null,
            contains: () => false,
            getAttribute: (n: string) => (n === 'data-qe-id' ? 'prz-1' : 'angle'),
            isConnected: true,
            offsetWidth: 0
        };
        Object.defineProperty(newElFake, 'innerHTML', {
            set() {
                builtOnNew = true;
            },
            get() {
                return '';
            }
        });
        // Lista po refreshu: żywy kontener PZ ze świeżą komórką.
        context.document.getElementById = (id: string) => {
            seenIds.push(id);
            if (id === 'zl-przejscia-list') {
                return { querySelector: () => newElFake };
            }
            return null;
        };
        let builtOnOld = false;
        const fakeEl: any = {
            querySelector: () => null,
            // Na wejściu w liście PZ; po refreshu odłączony (closest już nieistotny).
            closest: () => ({ id: 'zl-przejscia-list' }),
            contains: () => false,
            getAttribute: (n: string) => (n === 'data-qe-id' ? 'prz-1' : 'angle'),
            isConnected: false,
            offsetWidth: 0
        };
        Object.defineProperty(fakeEl, 'innerHTML', {
            set() {
                builtOnOld = true;
            },
            get() {
                return '';
            }
        });
        context.window.activateQuickEdit(fakeEl, 0, 'angle');
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        expect(seenIds).toContain('zl-przejscia-list'); // kontener z wejścia, nie fallback tiles
        expect(builtOnNew).toBe(true);
        expect(builtOnOld).toBe(false); // nic w martwym/ukrytym kontenerze
        expect(calls.focusNew).toBe(1);
    });

    it('flush przestarzałego timera w saveQuickEdit też cichy', () => {
        const { context, timers, well, bodyEl, cellA, mkInput } = loadQE();
        let silentSeen: boolean | null = null;
        context.window.__pendingPrzejsciaRefresh = 9;
        context.window.__pendingPrzejsciaApply = () => {
            silentSeen = !!context.window.__qeNoRender;
        };
        context.document.activeElement = bodyEl;
        context.window.saveQuickEdit(0, 'angle', '45', mkInput(cellA));
        expect(silentSeen).toBe(true);
        // Timery: [odroczone ciężkie rendery, świeży timer pełnego zapisu].
        expect(timers.length).toBe(2);
        expect(timers[0].delay).toBe(0);
        expect(timers[1].delay).toBe(100);
        timers[1].fn();
        expect(well.przejscia[0].angle).toBe(45);
    });

    it('odłączony activeElement (stary input po refreshu) nie blokuje buildInput', async () => {
        const { context, calls, cellA } = loadQE();
        // Martwy node: przeglądarka trzyma go jako activeElement do async blur.
        const deadInput = Object.assign(new (context.HTMLElement as any)(), {
            tagName: 'INPUT',
            isConnected: false,
            dataset: {},
            closest: () => cellA,
            blur: () => {
                calls.blurOld++;
            }
        });
        context.document.activeElement = deadInput; // blur nie przenosi fokusu
        let built = false;
        const fakeInput = {
            focus: () => {
                calls.focusNew++;
            },
            select: () => {}
        };
        const fakeEl: any = {
            querySelector: () => (built ? fakeInput : null),
            closest: () => null,
            contains: () => false,
            getAttribute: (n: string) => (n === 'data-qe-id' ? 'prz-1' : 'angle'),
            isConnected: true,
            offsetWidth: 0
        };
        Object.defineProperty(fakeEl, 'innerHTML', {
            set() {
                built = true;
            },
            get() {
                return '';
            }
        });
        context.window.activateQuickEdit(fakeEl, 0, 'angle');
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        expect(built).toBe(true);
        expect(calls.focusNew).toBe(1);
    });
});

function loadSolverValidation() {
    let modalCalls = 0;
    const context: any = {
        window: {
            refreshZleceniaModalIfActive: () => {
                modalCalls++;
            }
        },
        document: {
            activeElement: { tagName: 'BODY', closest: () => null },
            getElementById: () => null
        },
        escapeHtml: (s: string) => String(s),
        showToast: () => {},
        setTimeout: () => 0,
        studnieProducts: []
    };
    vm.createContext(context);
    vm.runInContext(readStudnie('solverValidation.js'), context);
    return { context, modalCalls: () => modalCalls };
}

describe('renderWellConfigErrors (banner) nie niszczy edycji QE', () => {
    it('fokus w polu QE → brak refresha modala PZ', () => {
        const { context, modalCalls } = loadSolverValidation();
        context.document.activeElement = {
            tagName: 'INPUT',
            closest: (sel: string) => (sel === '[data-qe-id]' ? { id: 'x' } : null)
        };
        context.renderWellConfigErrors(null);
        expect(modalCalls()).toBe(0);
    });

    it('fokus poza QE → refresh modala jak dotąd', () => {
        const { context, modalCalls } = loadSolverValidation();
        context.document.activeElement = { tagName: 'BODY', closest: () => null };
        context.renderWellConfigErrors(null);
        expect(modalCalls()).toBe(1);
    });
});

describe('F4: zapis nowego pola nie ginie przez rozliczenie starego', () => {
    it('pending X przy fokusie w Y → późniejszy zapis Y przechodzi (bez stempla na obcym inpucie)', () => {
        const { context, timers, well, cellA, cellB, mkInput, bodyEl } = loadQE();
        well.przejscia.push({
            id: 'prz-2',
            productId: 'prz-160',
            rzednaWlaczenia: 2.5,
            angle: 90
        });
        // Timer X uzbrojony (blur poza pola), fokus przeszedł do Y.
        context.document.activeElement = bodyEl;
        const inputX = mkInput(cellA);
        context.window.saveQuickEdit(0, 'angle', '10', inputX);
        expect(timers.length).toBe(1);
        const inputY = mkInput(cellB);
        inputY.value = '99';
        context.document.activeElement = inputY;
        // Rozliczenie X (jak gałąź pending) nie stempluje Y.
        context.window.saveQuickEdit(1, 'angle', '99', inputY);
        // Y idzie ścieżką switcha: zapis synchroniczny, model zmutowany.
        expect(well.przejscia[1].angle).toBe(99);
        expect(well.przejscia[0].angle).toBe(10);
        // Późniejszy blur Y (fokus poza pola) NIE jest cicho pomijany.
        inputY.value = '100';
        context.document.activeElement = bodyEl;
        const n = timers.length;
        context.window.saveQuickEdit(1, 'angle', '100', inputY);
        expect(timers.length).toBe(n + 1); // zaplanowany pełny zapis, nie early-return
        timers[timers.length - 1].fn();
        expect(well.przejscia[1].angle).toBe(100);
    });

    it('timer odpalony przy fokusie we własnej komórce też jest cichy (klik z powrotem)', () => {
        const { context, calls, timers, well, cellA, mkInput, bodyEl } = loadQE();
        context.document.activeElement = bodyEl;
        const inputA = mkInput(cellA);
        context.window.saveQuickEdit(0, 'angle', '45', inputA);
        expect(timers.length).toBe(1);
        // Użytkownik kliknął z powrotem we własne pole przed ogniem timera.
        const sameInput = mkInput(cellA);
        context.document.activeElement = sameInput;
        timers[0].fn();
        expect(well.przejscia[0].angle).toBe(45); // zapisane…
        expect(calls.list).toBe(0); // …ale bez niszczącego refresha w trakcie pisania
        expect(calls.modal).toEqual([]);
    });
});

describe('F2: lock recheck w momencie wykonania', () => {
    it('lock nałożony po uzbrojeniu timera blokuje zapis', () => {
        const { context, calls, timers, well, locks, bodyEl, cellA, mkInput } = loadQE();
        context.document.activeElement = bodyEl;
        context.window.saveQuickEdit(0, 'angle', '45', mkInput(cellA));
        expect(timers.length).toBe(1);
        locks.well = true; // akcept PZ / lock oferty przed ogniem timera
        timers[0].fn();
        expect(well.przejscia[0].angle).toBe(0);
        expect(calls.list).toBe(0);
        expect(calls.modal).toEqual([]);
        expect(calls.diagram).toBe(0);
    });
});

describe('F3: lifecycle timerów przy zamykaniu modala', () => {
    it('flushQePendingState aplikuje zaległy zapis i czyści stan (schedule→close→callback bez efektu)', () => {
        const { context, calls, timers, well, bodyEl, cellA, mkInput } = loadQE();
        context.document.activeElement = bodyEl;
        context.window.saveQuickEdit(0, 'angle', '45', mkInput(cellA));
        expect(timers.length).toBe(1);
        expect(typeof context.window.__pendingPrzejsciaApply).toBe('function');
        context.flushQePendingState(); // jak closeZleceniaModal na wejściu
        expect(well.przejscia[0].angle).toBe(45); // zaległy zapis w modelu
        expect(context.window.__pendingPrzejsciaRefresh).toBeNull();
        expect(context.window.__pendingPrzejsciaApply).toBeNull();
        expect(context.window.__qeHeavyTimer).toBeFalsy();
        expect(timers.length).toBe(0); // pełny i odroczony timer zdjęte
        expect(calls.list).toBe(0); // flush cichy: zero renderów listy/modala
        expect(calls.modal).toEqual([]);
    });
});

describe('F1: allowlista pól quick-edit', () => {
    it('obce pole nie buduje inputa (rebuild listy i tak się odbył)', async () => {
        const { context, calls, bodyEl } = loadQE();
        context.document.activeElement = bodyEl;
        let built = false;
        const fakeInput = { focus: () => {}, select: () => {} };
        const fakeEl: any = {
            querySelector: () => (built ? fakeInput : null),
            closest: () => null,
            contains: () => false,
            getAttribute: () => 'x',
            isConnected: true,
            offsetWidth: 0
        };
        Object.defineProperty(fakeEl, 'innerHTML', {
            set() {
                built = true;
            },
            get() {
                return '';
            }
        });
        context.window.activateQuickEdit(fakeEl, 0, 'x"onmouseover="alert(1)');
        await new Promise((r) => setImmediate(r));
        expect(built).toBe(false);
        expect(calls.list).toBe(1); // rebuild listy normalnie, blokada dopiero w buildInput
    });
});

describe('koalescencja odroczonych heavy-refreshy', () => {
    it('szybki hopping pól = jeden zaległy timer heavy', () => {
        const { context, timers, cellA, cellB, mkInput } = loadQE();
        const inputA = mkInput(cellA);
        const inputB = mkInput(cellB);
        const cellC = { id: 'C' };
        const inputC = mkInput(cellC);
        context.document.activeElement = inputB;
        context.window.saveQuickEdit(0, 'angle', '10', inputA);
        context.document.activeElement = inputC;
        context.window.saveQuickEdit(0, 'angle', '20', inputB);
        const heavy = timers.filter((t) => t.delay === 0);
        expect(heavy.length).toBe(1);
    });
});
