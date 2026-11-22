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
    const winListeners = {};
    const confirmCalls = [];
    const createdIframes = [];
    const elements = new Map();
    const state = {
        hash: '',
        dirty: false,
        nextIframeMode: 'ready'
    };
    // Deferred — popup czeka na decyzję jak prawdziwy użytkownik
    let confirmResolve = null;
    let timerId = 0;
    const pendingTimers = new Map();
    const readinessTimers = new Map();

    const makeClassList = () => {
        const values = new Set();
        return {
            add: (...items) => items.forEach((value) => values.add(value)),
            remove: (...items) => items.forEach((value) => values.delete(value)),
            contains: (value) => values.has(value),
            toggle: (value, force) => {
                if (force === undefined ? !values.has(value) : force) values.add(value);
                else values.delete(value);
                return values.has(value);
            }
        };
    };

    const elStub = () => ({
        id: '',
        appendChild(child) {
            if (child?.id) elements.set(child.id, child);
        },
        focus() {},
        innerHTML: '',
        textContent: '',
        classList: makeClassList(),
        setAttribute() {},
        removeAttribute() {},
        addEventListener(type, handler) {
            this.listeners ||= {};
            (this.listeners[type] ||= []).push(handler);
        },
        removeEventListener(type, handler) {
            this.listeners ||= {};
            this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== handler);
        },
        querySelector(selector) {
            if (this.controls?.[selector]) return this.controls[selector];
            if (selector === '[data-spa-retry]' || selector === '[data-spa-back]') {
                this.controls ||= {};
                this.controls[selector] = elStub();
                return this.controls[selector];
            }
            return null;
        }
    });

    const dispatch = (target, type) => {
        (target.listeners?.[type] || []).forEach((handler) => handler({ type, target }));
    };

    const createIframe = () => {
        const iframe = elStub();
        const mode = state.nextIframeMode;
        state.nextIframeMode = 'ready';
        iframe.dataset = {};
        const documentRoot = { classList: makeClassList() };
        if (mode === 'ready') documentRoot.classList.add('is-loaded');
        iframe.contentDocument = {
            readyState: mode === 'ready' ? 'complete' : 'loading',
            body: {},
            documentElement: mode === 'invalid' ? null : documentRoot,
            querySelector: (selector) => (selector === '#section-cennik' ? {} : null)
        };
        iframe.contentWindow = {
            location: { href: 'about:blank', origin: 'http://localhost' }
        };
        let src = '';
        Object.defineProperty(iframe, 'src', {
            get: () => src,
            set(value) {
                const previousHref = this.contentWindow.location.href;
                src = value;
                const absoluteUrl = new URL(value, 'http://localhost/app.html').href;
                this.contentWindow.location.href = absoluteUrl;
                this.contentWindow.location.origin = new URL(absoluteUrl).origin;
                if (this.behavior === 'ready') {
                    this.contentDocument.readyState = 'complete';
                    this.contentDocument.documentElement.classList.add('is-loaded');
                    dispatch(this, 'load');
                } else if (this.behavior === 'invalid') {
                    this.contentDocument.readyState = 'complete';
                    this.contentDocument.documentElement = null;
                    dispatch(this, 'load');
                } else if (this.behavior === 'error-document') {
                    this.contentDocument.readyState = 'complete';
                    this.contentDocument.documentElement.classList.remove('is-loaded');
                    dispatch(this, 'load');
                } else if (this.behavior === 'delayed-ready') {
                    this.contentDocument.readyState = 'complete';
                    dispatch(this, 'load');
                } else if (this.behavior === 'stale-load') {
                    this.contentWindow.location.href = previousHref;
                    this.contentDocument.readyState = 'complete';
                    dispatch(this, 'load');
                } else if (this.behavior === 'module-tab') {
                    const moduleUrl = new URL(absoluteUrl);
                    moduleUrl.searchParams.set('tab', 'builder');
                    this.contentWindow.location.href = moduleUrl.href;
                    this.contentWindow.location.origin = moduleUrl.origin;
                    this.contentDocument.readyState = 'complete';
                    this.contentDocument.documentElement.classList.add('is-loaded');
                    dispatch(this, 'load');
                } else if (this.behavior === 'invalid-module-tab') {
                    const moduleUrl = new URL(absoluteUrl);
                    moduleUrl.searchParams.set('tab', 'unknown');
                    this.contentWindow.location.href = moduleUrl.href;
                    this.contentWindow.location.origin = moduleUrl.origin;
                    this.contentDocument.readyState = 'complete';
                    this.contentDocument.documentElement.classList.add('is-loaded');
                    dispatch(this, 'load');
                } else {
                    this.contentDocument.readyState = 'loading';
                }
            }
        });
        iframe.behavior = mode;
        iframe.classList = makeClassList();
        iframe.setMode = (nextMode) => {
            iframe.behavior = nextMode;
        };
        iframe.completeLoad = () => {
            const absoluteUrl = new URL(src, 'http://localhost/app.html').href;
            iframe.contentWindow.location.href = absoluteUrl;
            iframe.contentWindow.location.origin = new URL(absoluteUrl).origin;
            iframe.contentDocument.readyState = 'complete';
            iframe.contentDocument.documentElement.classList.add('is-loaded');
            dispatch(iframe, 'load');
        };
        createdIframes.push(iframe);
        return iframe;
    };

    const docStub = {
        getElementById: (id) => {
            if (!elements.has(id)) {
                const el = elStub();
                el.id = id;
                elements.set(id, el);
            }
            return elements.get(id);
        },
        createElement: (tag) => (tag === 'iframe' ? createIframe() : elStub()),
        querySelector: () => null,
        querySelectorAll: (selector) =>
            selector === 'iframe.spa-module-iframe' ? createdIframes : [],
        addEventListener: (t, h) => {
            docListeners[t] = h;
        },
        body: { classList: makeClassList() }
    };

    const context = {
        window: {
            location: {
                origin: 'http://localhost',
                href: 'http://localhost/app.html',
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
            setTimeout: (fn, delay = 0) => {
                const id = ++timerId;
                if (delay >= 1000) pendingTimers.set(id, fn);
                else if (delay === 50) readinessTimers.set(id, fn);
                else fn();
                return id;
            },
            clearTimeout: (id) => {
                pendingTimers.delete(id);
                readinessTimers.delete(id);
            },
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
        URL,
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
        createdIframes,
        elements,
        setNextIframeMode: (mode) => {
            state.nextIframeMode = mode;
        },
        runPendingTimers: () => {
            [...pendingTimers.values()].forEach((callback) => callback());
            pendingTimers.clear();
        },
        runReadinessTimers: () => {
            [...readinessTimers.values()].forEach((callback) => callback());
            readinessTimers.clear();
        },
        resolveConfirm: (val) => {
            const r = confirmResolve;
            confirmResolve = null;
            r(val);
        }
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Pierwsza nawigacja bezpośrednia (jak w init) — ustawia currentModule i _lastCleanHash */
async function bootOnRury(context, state) {
    state.hash = '#/rury';
    await context.window.SpaRouter.navigate();
}

describe('Guard nawigacji SPA — appConfirm przy niezapisanych zmianach', () => {
    test('odświeżenie PZ pobiera aktualny indeks i odświeża widoki istniejącej Studni', async () => {
        const { context, state, createdIframes } = runContext();
        await bootOnRury(context, state);
        state.hash = '#/studnie';
        await context.window.SpaRouter.navigate();

        const studnieWindow = createdIframes[1].contentWindow;
        const events = [];
        studnieWindow.loadProductionOrders = async (...args) => {
            events.push(['load', ...args]);
            return [];
        };
        studnieWindow.auditPzElementKeyMismatch = () => events.push(['audit']);
        studnieWindow.renderZleceniaList = () => events.push(['list']);
        studnieWindow.renderZleceniaWellConfig = () => events.push(['config']);
        studnieWindow.refreshAll = () => events.push(['refresh']);

        await context.window.SpaRouter.refreshProductionOrders();

        expect(events).toEqual([
            ['load', false, true],
            ['audit'],
            ['list'],
            ['config'],
            ['refresh']
        ]);
    });

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

describe('Cykl życia iframe w routerze SPA', () => {
    test('akceptuje sekcję domyślną zapisaną przez moduł Rury, jeśli trasa jej nie określa', async () => {
        const { context, state, setNextIframeMode, elements } = runContext();
        state.hash = '#/pulpit';
        await context.window.SpaRouter.navigate();

        setNextIframeMode('module-tab');
        state.hash = '#/rury';
        await context.window.SpaRouter.navigate();

        expect(elements.get('spa-app-rury').classList.contains('active')).toBe(true);
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(false);
    });

    test('nadal odrzuca inną sekcję Rur niż jawnie wskazana w trasie', async () => {
        const { context, state, setNextIframeMode, elements } = runContext();
        state.hash = '#/pulpit';
        await context.window.SpaRouter.navigate();

        setNextIframeMode('module-tab');
        state.hash = '#/rury?tab=offer';
        await context.window.SpaRouter.navigate();

        expect(elements.get('spa-app-rury').classList.contains('active')).toBe(false);
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(true);
    });

    test('odrzuca nieznaną sekcję dopisaną przez moduł Rury', async () => {
        const { context, state, setNextIframeMode, elements } = runContext();
        state.hash = '#/pulpit';
        await context.window.SpaRouter.navigate();

        setNextIframeMode('invalid-module-tab');
        state.hash = '#/rury';
        await context.window.SpaRouter.navigate();

        expect(elements.get('spa-app-rury').classList.contains('active')).toBe(false);
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(true);
    });

    test('timeout nie przełącza aktywnego widoku i pokazuje ponowienie/powrót', async () => {
        const { context, state, setNextIframeMode, runPendingTimers, elements } = runContext();
        await bootOnRury(context, state);
        setNextIframeMode('timeout');
        state.hash = '#/studnie';
        const pendingNavigation = context.window.SpaRouter.navigate();
        runPendingTimers();
        await pendingNavigation;

        expect(elements.get('spa-app-rury').classList.contains('active')).toBe(true);
        expect(elements.get('spa-app-studnie').classList.contains('active')).toBe(false);
        const layer = elements.get('spa-transition-layer');
        expect(layer.classList.contains('is-error')).toBe(true);
        expect(layer.querySelector('[data-spa-retry]')).toBeTruthy();
        expect(layer.querySelector('[data-spa-back]')).toBeTruthy();
    });

    test('nieprawidłowy dokument jest błędem, a nie gotowym widokiem', async () => {
        const { context, state, setNextIframeMode, elements } = runContext();
        await bootOnRury(context, state);
        setNextIframeMode('invalid');
        state.hash = '#/studnie';
        await context.window.SpaRouter.navigate();

        expect(elements.get('spa-app-rury').classList.contains('active')).toBe(true);
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(true);
    });

    test('pełny dokument błędu pod prawidłowym adresem nie jest gotowym modułem', async () => {
        const { context, state, setNextIframeMode, runPendingTimers, elements } = runContext();
        await bootOnRury(context, state);
        setNextIframeMode('error-document');
        state.hash = '#/studnie';
        const pendingNavigation = context.window.SpaRouter.navigate();
        runPendingTimers();
        await pendingNavigation;

        expect(elements.get('spa-app-rury').classList.contains('active')).toBe(true);
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(true);
    });

    test('pierwsze wejście nie dubluje inicjalizacji Kartoteki, ponowne wejście odświeża dane', async () => {
        const { context, state, createdIframes } = runContext();
        await bootOnRury(context, state);
        state.hash = '#/kartoteka';
        const firstLoad = context.window.SpaRouter.navigate();
        const kartotekaWindow = createdIframes[1].contentWindow;
        const loadLocalOffers = jest.fn();
        kartotekaWindow.kartotekaUI = { initialized: true, loadLocalOffers };
        await firstLoad;

        expect(loadLocalOffers).not.toHaveBeenCalled();

        state.hash = '#/rury';
        await context.window.SpaRouter.navigate();
        state.hash = '#/kartoteka';
        await context.window.SpaRouter.navigate();

        expect(loadLocalOffers).toHaveBeenCalledTimes(1);
    });

    test.each(['rury', 'studnie', 'kartoteka', 'zlecenia', 'cennik', 'pulpit'])(
        'czeka na gotowość modułu %s po zdarzeniu load',
        async (module) => {
            const {
                context,
                state,
                setNextIframeMode,
                runReadinessTimers,
                createdIframes,
                elements
            } = runContext();
            if (module !== 'rury') await bootOnRury(context, state);
            if (module === 'cennik') context.window.currentUser = { role: 'admin' };
            setNextIframeMode('delayed-ready');
            state.hash = `#/${module}`;
            const pendingNavigation = context.window.SpaRouter.navigate();
            const iframe = createdIframes[createdIframes.length - 1];

            iframe.contentDocument.documentElement.classList.add('is-loaded');
            runReadinessTimers();
            await pendingNavigation;

            expect(elements.get(`spa-app-${module}`).classList.contains('active')).toBe(true);
            expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(false);
        }
    );

    test('ponowienie ponownie ładuje nieudany iframe i otwiera moduł po sukcesie', async () => {
        const { context, state, setNextIframeMode, runPendingTimers, createdIframes, elements } =
            runContext();
        await bootOnRury(context, state);
        setNextIframeMode('timeout');
        state.hash = '#/studnie';
        const failedNavigation = context.window.SpaRouter.navigate();
        runPendingTimers();
        await failedNavigation;

        createdIframes[1].setMode('ready');
        elements.get('spa-transition-layer').querySelector('[data-spa-retry]').listeners.click[0]();
        await flush();

        expect(elements.get('spa-app-studnie').classList.contains('active')).toBe(true);
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(false);
    });

    test('spóźniony timeout poprzedniej trasy nie nadpisuje nowszej nawigacji', async () => {
        const { context, state, setNextIframeMode, runPendingTimers, elements } = runContext();
        await bootOnRury(context, state);
        setNextIframeMode('timeout');
        state.hash = '#/studnie';
        const staleNavigation = context.window.SpaRouter.navigate();

        state.hash = '#/kartoteka';
        await context.window.SpaRouter.navigate();
        runPendingTimers();
        await staleNavigation;

        expect(elements.get('spa-app-kartoteka').classList.contains('active')).toBe(true);
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(false);
    });

    test('błąd reloadu edit/order pozwala wrócić do poprzedniego dokumentu', async () => {
        const { context, state, createdIframes, runPendingTimers, elements } = runContext();
        await bootOnRury(context, state);
        createdIframes[0].setMode('timeout');
        state.hash = '#/rury?order=order-1';
        const pendingNavigation = context.window.SpaRouter.navigate();
        runPendingTimers();
        await pendingNavigation;

        createdIframes[0].setMode('ready');
        elements.get('spa-transition-layer').querySelector('[data-spa-back]').listeners.click[0]();
        await context.window.SpaRouter.navigate();
        await flush();

        expect(state.hash).toBe('#/rury');
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(false);
    });

    test('szybka zmiana edit/order kończy na najnowszym dokumencie', async () => {
        const { context, state, createdIframes, runPendingTimers } = runContext();
        await bootOnRury(context, state);
        const iframe = createdIframes[0];
        iframe.setMode('timeout');
        state.hash = '#/rury?order=order-a';
        const staleNavigation = context.window.SpaRouter.navigate();

        iframe.setMode('ready');
        state.hash = '#/rury?order=order-b';
        await context.window.SpaRouter.navigate();
        runPendingTimers();
        await staleNavigation;

        expect(new URL(iframe.contentWindow.location.href).searchParams.get('order')).toBe(
            'order-b'
        );
    });

    test('ignoruje pośredni load starego dokumentu podczas reloadu edit/order', async () => {
        const { context, state, createdIframes, elements } = runContext();
        await bootOnRury(context, state);
        const iframe = createdIframes[0];
        iframe.setMode('stale-load');
        state.hash = '#/rury?order=order-next';

        const pendingNavigation = context.window.SpaRouter.navigate();
        await flush();

        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(false);
        iframe.completeLoad();
        await pendingNavigation;

        expect(elements.get('spa-app-rury').classList.contains('active')).toBe(true);
        expect(elements.get('spa-transition-layer').classList.contains('is-error')).toBe(false);
    });
});

/** Kontekst z appConfirm3 (3-btn) i SSoT dirty — ścieżki P0.3/P1.1/P1.2 */
function runContext3(opts = {}) {
    const base = runContext();
    const { context, state } = base;
    const calls3 = [];
    let choiceResolve = null;
    context.window.appConfirm3 = (message, cOpts) => {
        calls3.push({ message, opts: cOpts });
        return new Promise((resolve) => {
            choiceResolve = resolve;
        });
    };
    context.window.__sokIsDirty = () => state.dirty;
    context.window.__sokSaveDirty =
        opts.saveFn ||
        (async () => {
            state.dirty = false;
            return true;
        });
    context.window.__sokDescribeDirty = () =>
        state.dirty ? { kind: 'offer_rury', docId: 'new', number: '', module: 'rury' } : null;
    context.window.__sokKindLabel = (k) => (k === 'offer_rury' ? 'Oferta (Rury)' : 'Dokument');
    // showToast do ścieżki nieudanego zapisu
    context.window.showToast = () => {};
    return {
        ...base,
        calls3,
        resolveChoice: (val) => {
            const r = choiceResolve;
            choiceResolve = null;
            r(val);
        }
    };
}

describe('Guard SPA — 3-btn i A-vs-B (P0.3/P1.1/P1.2)', () => {
    test('TEST 5: A-vs-B — ?edit=X nad brudną edycją pyta i nazywa cel', async () => {
        const { context, state, calls3, resolveChoice } = runContext3();
        await bootOnRury(context, state);
        state.dirty = true;
        state.hash = '#/rury?edit=E2E_X1';
        const navPromise = context.window.SpaRouter.navigate();
        await flush();
        expect(state.hash).toBe('#/rury');
        expect(calls3).toHaveLength(1);
        expect(calls3[0].message).toMatch(/wczyta.*E2E_X1/);
        expect(calls3[0].message).toMatch(/Oferta \(Rury\)/);
        resolveChoice('stay');
        await navPromise;
        expect(state.hash).toBe('#/rury');
    });

    test('TEST 6: save — zapis czysci dirty i nawigacja przechodzi', async () => {
        const { context, state, calls3, resolveChoice } = runContext3();
        await bootOnRury(context, state);
        state.dirty = true;
        state.hash = '#/studnie';
        const navPromise = context.window.SpaRouter.navigate();
        await flush();
        expect(calls3).toHaveLength(1);
        expect(calls3[0].message).toMatch(/Oferta \(Rury\)/);
        resolveChoice('save');
        await navPromise;
        expect(state.hash).toBe('#/studnie');
        expect(state.dirty).toBe(false);
    });

    test('TEST 7: save nieudany — zostaje, bez nawigacji', async () => {
        const { context, state, calls3, resolveChoice } = runContext3({
            saveFn: async () => false
        });
        await bootOnRury(context, state);
        state.dirty = true;
        state.hash = '#/studnie';
        const navPromise = context.window.SpaRouter.navigate();
        await flush();
        expect(calls3).toHaveLength(1);
        resolveChoice('save');
        await navPromise;
        expect(state.hash).toBe('#/rury');
        expect(state.dirty).toBe(true);
    });
});
