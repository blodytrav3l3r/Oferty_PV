// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- wzorzec vm (transitionsModals)
// @ts-nocheck
/* =============================================================
   Testy guarda nawigacji SPA — popup aplikacji (appConfirm) przy
   zmianie modułu z niezapisanymi zmianami zamiast cichej utraty
   stanu wizarda. Natywny beforeunload pozostaje poza tym testem.
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readSpa = (f) => fs.readFileSync(path.join(__dirname, '../../public/js/spa/' + f), 'utf8');

function runContext() {
    const docListeners = {};
    const confirmCalls = [];
    const state = {
        hash: '',
        dirty: false
    };
    // Deferred — popup czeka na decyzję jak prawdziwy użytkownik
    let confirmResolve = null;

    const elStub = () => ({
        appendChild() {},
        focus() {},
        innerHTML: '',
        textContent: '',
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {},
        removeAttribute() {},
        addEventListener() {},
        removeEventListener() {}
    });

    const docStub = {
        getElementById: () => elStub(),
        createElement: () => ({ ...elStub(), contentDocument: null, src: '' }),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: (t, h) => {
            docListeners[t] = h;
        },
        body: { classList: { add() {}, remove() {}, toggle() {} } }
    };

    const context = {
        window: {
            location: {
                get hash() {
                    return state.hash;
                },
                set hash(v) {
                    state.hash = v;
                }
            },
            addEventListener: (t, h) => {
                winListeners[t] = h;
            },
            setTimeout: (fn) => fn(),
            clearTimeout: () => {},
            appConfirm: (message, opts) => {
                confirmCalls.push({ message, opts });
                return new Promise((resolve) => {
                    confirmResolve = resolve;
                });
            },
            _isWizardDirty: () => state.dirty
        },
        document: docStub,
        logger: { warn() {}, info() {}, error() {} },
        escapeHtml: (s) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        escapeHtmlAttr: (s) =>
            String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
        URLSearchParams,
        Promise,
        Object,
        Array,
        String,
        Number,
        Boolean,
        Date,
        JSON,
        Math
    };

    vm.createContext(context);
    vm.runInContext(readSpa('router.js'), context);
    return {
        context,
        state,
        confirmCalls,
        resolveConfirm: (val) => {
            const r = confirmResolve;
            confirmResolve = null;
            r(val);
        }
    };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Pierwsza nawigacja bezpośrednia (jak w init) — ustawia currentModule i _lastCleanHash */
async function bootOnRury(context, state) {
    state.hash = '#/rury';
    await context.window.SpaRouter.navigate();
}

describe('Guard nawigacji SPA — appConfirm przy niezapisanych zmianach', () => {
    test('TEST 1: czysty stan — zmiana modułu bez popupu', async () => {
        const { context, state, confirmCalls } = runContext();
        await bootOnRury(context, state);
        state.dirty = false;
        state.hash = '#/studnie';
        await context.window.SpaRouter.navigate();
        expect(confirmCalls).toHaveLength(0);
    });

    test('TEST 2: dirty + zmiana modułu → cofnięcie hasha + popup aplikacji', async () => {
        const { context, state, confirmCalls, resolveConfirm } = runContext();
        await bootOnRury(context, state);
        state.dirty = true;

        // Zmiana hasha przez użytkownika → hashchange → navigate (guard pyta)
        state.hash = '#/studnie';
        const navPromise = context.window.SpaRouter.navigate();
        await flush();

        // Hash cofnięty do czystego, popup pokazany raz, w stylu aplikacji
        expect(state.hash).toBe('#/rury');
        expect(confirmCalls).toHaveLength(1);
        expect(confirmCalls[0].opts.type).toBe('warning');
        expect(confirmCalls[0].opts.cancelText).toBe('Zostań');

        // Anuluj → brak nawigacji na cel
        resolveConfirm(false);
        await navPromise;
        expect(state.hash).toBe('#/rury');
        expect(confirmCalls).toHaveLength(1);

        // Echo hashchange po cofnięciu przechodzi bez kolejnego pytania
        await context.window.SpaRouter.navigate();
        expect(confirmCalls).toHaveLength(1);
    });

    test('TEST 3: potwierdzenie → nawigacja przechodzi bez ponownego pytania', async () => {
        const { context, state, confirmCalls, resolveConfirm } = runContext();
        await bootOnRury(context, state);
        state.dirty = true;

        state.hash = '#/studnie';
        const navPromise = context.window.SpaRouter.navigate();
        await flush();
        expect(state.hash).toBe('#/rury');
        expect(confirmCalls).toHaveLength(1);

        resolveConfirm(true); // OK
        await navPromise;
        expect(state.hash).toBe('#/studnie');
        expect(confirmCalls).toHaveLength(1);

        // Nawigacja potwierdzona (_navForceOnce) — przełączenie bez pytania
        await context.window.SpaRouter.navigate();
        expect(confirmCalls).toHaveLength(1);

        // Dowód udanego przełączenia: nowy czysty hash to '#/studnie' —
        // próba powrotu do rury przy dirty cofa do '#/studnie'
        state.hash = '#/rury';
        const backPromise = context.window.SpaRouter.navigate();
        await flush();
        expect(state.hash).toBe('#/studnie');
        expect(confirmCalls).toHaveLength(2);
        resolveConfirm(false);
        await backPromise;
    });

    test('TEST 4: zmiana zakładki w ramach tego samego modułu — bez popupu', async () => {
        const { context, state, confirmCalls } = runContext();
        await bootOnRury(context, state);
        state.dirty = true;
        state.hash = '#/rury?tab=offer';
        await context.window.SpaRouter.navigate();
        expect(confirmCalls).toHaveLength(0);
    });
});
