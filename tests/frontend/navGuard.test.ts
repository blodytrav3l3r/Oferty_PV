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
        insertAdjacentHTML(_position, html) {
            this.innerHTML += html;
        },
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
                this.srcAssignments = (this.srcAssignments || 0) + 1;
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
            history: {
                replaceState(_data, _title, url) {
                    state.hash = new URL(url, 'http://localhost/app.html').hash;
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
    test('adapter odświeża zlecenia przez istniejące AppZlecenia API', async () => {
        const { context, state, createdIframes } = runContext();
        await bootOnRury(context, state);
        state.hash = '#/zlecenia';
        await context.window.SpaRouter.navigate();

        const calls = [];
        const childWindow = createdIframes[1].contentWindow;
        childWindow.showSection = (sectionId) => calls.push(`section:${sectionId}`);
        childWindow.AppZlecenia = {
            loadOrders: () => calls.push('orders')
        };
        context.window.SpaRouter.showSection('orders');
        context.window.SpaRouter.refreshModule('zlecenia');

        expect(calls).toEqual(['section:orders', 'orders']);
    });

    test('adapter zachowuje fallback kartoteki, gdy AppKartoteka API nie istnieje', async () => {
        const { context, state, createdIframes } = runContext();
        await bootOnRury(context, state);
        state.hash = '#/kartoteka';
        await context.window.SpaRouter.navigate();

        const calls = [];
        createdIframes[1].contentWindow.kartotekaUI = {
            initialized: true,
            loadLocalOffers: () => calls.push('local-offers')
        };
        context.window.SpaRouter.refreshModule('kartoteka');

        expect(calls).toEqual(['local-offers']);
    });

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

describe('Rozpoczynanie nowej oferty z aktywnego modułu', () => {
    test.each(['rury', 'studnie'])('moduł %s pokazuje jawną akcję Nowa oferta', async (module) => {
        const { context, state, elements } = runContext();
        state.hash = `#/${module}`;
        await context.window.SpaRouter.navigate();

        expect(elements.get('spa-section-nav').innerHTML).toContain('Nowa oferta');
        expect(elements.get('spa-section-nav').innerHTML).toContain('data-csp="startNewOffer"');
    });

    test('pulpit nie pokazuje akcji Nowa oferta', async () => {
        const { context, state, elements } = runContext();
        state.hash = '#/pulpit';
        await context.window.SpaRouter.navigate();

        expect(elements.get('spa-section-nav').innerHTML).not.toContain('startNewOffer');
    });

    test('kafelki ofert na Pulpicie jawnie rozpoczynają nowy dokument', () => {
        const dashboard = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');

        expect(dashboard).toContain('href="app.html#/rury?newOffer=1"');
        expect(dashboard).toContain('href="app.html#/studnie?newOffer=1"');
    });

    test.each([
        ['studnie', 'edit', 'offer-1'],
        ['rury', 'edit', 'offer-1'],
        ['studnie', 'order', 'order-1'],
        ['rury', 'order', 'order-1']
    ])(
        'po rozpoczęciu nowej oferty ponownie wczytuje ten sam dokument: %s/%s',
        async (module, param, documentId) => {
            const { context, state, createdIframes } = runContext();
            state.hash = `#/${module}?${param}=${documentId}`;
            await context.window.SpaRouter.navigate();

            const iframe = createdIframes[0];
            const frameWindow = iframe.contentWindow;
            frameWindow.clearOfferForm = jest.fn();
            if (param === 'order') {
                frameWindow.orderEditMode = { orderId: documentId };
                const exitMode = async () => {
                    frameWindow.orderEditMode = null;
                };
                frameWindow.exitOrderEditMode = exitMode;
                frameWindow.exitWizardOrderMode = exitMode;
            }

            state.hash = '#/pulpit';
            await context.window.SpaRouter.navigate();
            state.hash = `#/${module}?newOffer=1`;
            await context.window.SpaRouter.navigate();

            expect(frameWindow.clearOfferForm).toHaveBeenCalledTimes(1);
            expect(state.hash).toBe(`#/${module}`);
            expect(iframe.dataset.spaLogicalSrc).toBe(`${module}.html`);

            const loadsBeforeReopen = iframe.srcAssignments;
            state.hash = '#/kartoteka';
            await context.window.SpaRouter.navigate();
            state.hash = `#/${module}?${param}=${documentId}`;
            await context.window.SpaRouter.navigate();

            expect(iframe.srcAssignments).toBe(loadsBeforeReopen + 1);
            expect(new URL(iframe.contentWindow.location.href).searchParams.get(param)).toBe(
                documentId
            );
        }
    );

    test('ręczne rozpoczęcie nowej oferty zapisuje czystą trasę do wznowienia pracy', async () => {
        const { context, state, createdIframes } = runContext();
        state.hash = '#/studnie?order=order-1';
        await context.window.SpaRouter.navigate();

        const frameWindow = createdIframes[0].contentWindow;
        frameWindow.orderEditMode = { orderId: 'order-1' };
        frameWindow.exitWizardOrderMode = async () => {
            frameWindow.orderEditMode = null;
        };
        frameWindow.clearOfferForm = jest.fn();
        const saveRoute = jest.fn();
        context.window.lastRoute = { save: saveRoute };

        expect(await context.window.SpaRouter.startNewOffer()).toBe(true);
        expect(state.hash).toBe('#/studnie');
        expect(saveRoute).toHaveBeenCalledWith('#/studnie');
    });

    test('kafel Pulpitu zamienia zachowane zamówienie na nową ofertę', async () => {
        const { context, state, createdIframes } = runContext();
        state.hash = '#/studnie?order=order-1';
        const openOrder = context.window.SpaRouter.navigate();
        const frameWindow = createdIframes[0].contentWindow;
        frameWindow.orderEditMode = { orderId: 'order-1' };
        frameWindow.exitWizardOrderMode = jest.fn(async () => {
            frameWindow.orderEditMode = null;
        });
        frameWindow.clearOfferForm = jest.fn();
        await openOrder;

        state.hash = '#/pulpit';
        await context.window.SpaRouter.navigate();

        state.hash = '#/studnie?newOffer=1';
        await context.window.SpaRouter.navigate();

        expect(createdIframes).toHaveLength(2);
        expect(createdIframes[0].src).toContain('order=order-1');
        expect(createdIframes[0].src).not.toContain('newOffer');
        expect(createdIframes[0].dataset.spaLogicalSrc).toBe('studnie.html');
        expect(frameWindow.exitWizardOrderMode).toHaveBeenCalledWith(0, { silent: true });
        expect(frameWindow.clearOfferForm).toHaveBeenCalledTimes(1);
        expect(state.hash).toBe('#/studnie');
    });

    test.each([
        ['rury', (frameWindow) => (frameWindow.orderEditMode = true), 'exitOrderEditMode'],
        [
            'studnie',
            (frameWindow) => (frameWindow.orderEditMode = { orderId: 'order-1' }),
            'exitWizardOrderMode'
        ]
    ])(
        'nowa oferta bezpiecznie wychodzi z trybu zamówienia (%s)',
        async (module, setMode, exitName) => {
            const { context, state, createdIframes } = runContext();
            state.hash = `#/${module}`;
            await context.window.SpaRouter.navigate();
            const frameWindow = createdIframes[0].contentWindow;
            const calls = [];
            setMode(frameWindow);
            frameWindow[exitName] = jest.fn(async () => {
                calls.push('exit');
                frameWindow.orderEditMode = null;
            });
            frameWindow.clearOfferForm = jest.fn(() => calls.push('clear'));

            expect(await context.window.SpaRouter.startNewOffer()).toBe(true);
            expect(frameWindow[exitName]).toHaveBeenCalledTimes(1);
            expect(calls).toEqual(['exit', 'clear']);
        }
    );

    test('niezapisane zamówienie można zapisać przed przejściem do nowej oferty', async () => {
        const { context, state, createdIframes, calls3, resolveChoice } = runContext3();
        state.hash = '#/studnie';
        await context.window.SpaRouter.navigate();
        const frameWindow = createdIframes[0].contentWindow;
        state.dirty = true;
        frameWindow.orderEditMode = { orderId: 'order-1' };
        frameWindow.exitWizardOrderMode = jest.fn(async () => {
            frameWindow.orderEditMode = null;
        });
        frameWindow.clearOfferForm = jest.fn();

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();

        expect(calls3[0].message).toMatch(/Bieżące zamówienie ma niezapisane zmiany/);
        expect(calls3[0].opts.saveText).toBe('Zapisz zamówienie i rozpocznij nową');
        resolveChoice('save');

        expect(await startPromise).toBe(true);
        expect(frameWindow.exitWizardOrderMode).toHaveBeenCalledWith(0, { silent: true });
        expect(frameWindow.clearOfferForm).toHaveBeenCalledTimes(1);
    });

    test('porzucenie zamówienia usuwa jego lokalny szkic przed resetem', async () => {
        const { context, state, createdIframes, resolveChoice } = runContext3();
        state.hash = '#/studnie';
        await context.window.SpaRouter.navigate();
        const frameWindow = createdIframes[0].contentWindow;
        const calls = [];
        state.dirty = true;
        frameWindow.orderEditMode = { orderId: 'order-1' };
        frameWindow.draftAutosave = {
            clearContext: jest.fn((kind, orderId) => calls.push(['discard-draft', kind, orderId]))
        };
        frameWindow.exitWizardOrderMode = jest.fn(async () => {
            calls.push(['exit-order']);
            frameWindow.orderEditMode = null;
        });
        frameWindow.clearOfferForm = jest.fn(() => calls.push(['reset-offer']));
        context.window.__sokCanSave = () => true;
        context.window.__sokAbandonCurrent = jest.fn(() => calls.push(['abandon-dirty-state']));

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();
        resolveChoice('leave');

        expect(await startPromise).toBe(true);
        expect(frameWindow.draftAutosave.clearContext).toHaveBeenCalledWith(
            'order_studnie',
            'order-1'
        );
        expect(calls.map((call) => call[0])).toEqual([
            'discard-draft',
            'abandon-dirty-state',
            'exit-order',
            'reset-offer'
        ]);
    });

    test('błąd usuwania szkicu zamówienia zatrzymuje reset', async () => {
        const { context, state, createdIframes, resolveChoice } = runContext3();
        state.hash = '#/studnie';
        await context.window.SpaRouter.navigate();
        const frameWindow = createdIframes[0].contentWindow;
        state.dirty = true;
        frameWindow.orderEditMode = { orderId: 'order-1' };
        frameWindow.draftAutosave = {
            clearContext: jest.fn(() => {
                throw new Error('clear failed');
            })
        };
        frameWindow.exitWizardOrderMode = jest.fn();
        frameWindow.clearOfferForm = jest.fn();
        context.window.__sokCanSave = () => true;
        context.window.__sokAbandonCurrent = jest.fn();
        context.window.showToast = jest.fn();

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();
        resolveChoice('leave');

        expect(await startPromise).toBe(false);
        expect(context.window.__sokAbandonCurrent).not.toHaveBeenCalled();
        expect(frameWindow.exitWizardOrderMode).not.toHaveBeenCalled();
        expect(frameWindow.clearOfferForm).not.toHaveBeenCalled();
        expect(context.window.showToast).toHaveBeenCalledWith(
            'Nie udało się usunąć szkicu zamówienia. Bieżący dokument pozostał otwarty.',
            'error'
        );
    });

    test('brak bezpiecznego wyjścia z zamówienia zatrzymuje reset', async () => {
        const { context, state, createdIframes } = runContext();
        state.hash = '#/studnie';
        await context.window.SpaRouter.navigate();
        const frameWindow = createdIframes[0].contentWindow;
        frameWindow.orderEditMode = { orderId: 'order-1' };
        frameWindow.clearOfferForm = jest.fn();
        context.window.showToast = jest.fn();

        expect(await context.window.SpaRouter.startNewOffer()).toBe(false);
        expect(frameWindow.clearOfferForm).not.toHaveBeenCalled();
        expect(context.window.showToast).toHaveBeenCalledWith(
            'Nie udało się bezpiecznie zakończyć zamówienia. Bieżący dokument pozostał otwarty.',
            'error'
        );
    });

    test('czysty formularz resetuje się bez pytania i wraca do Konfiguracji', async () => {
        const { context, state, createdIframes, confirmCalls } = runContext();
        await bootOnRury(context, state);
        const clearOfferForm = jest.fn();
        createdIframes[0].contentWindow.clearOfferForm = clearOfferForm;

        const started = await context.window.SpaRouter.startNewOffer();

        expect(started).toBe(true);
        expect(clearOfferForm).toHaveBeenCalledTimes(1);
        expect(confirmCalls).toHaveLength(0);
    });

    test('zmiany wymagają wyboru, a Zostań nie resetuje edycji', async () => {
        const { context, state, createdIframes, calls3, resolveChoice } = runContext3();
        await bootOnRury(context, state);
        state.dirty = true;
        context.window.__sokCanSave = () => true;
        const clearOfferForm = jest.fn();
        createdIframes[0].contentWindow.clearOfferForm = clearOfferForm;

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();

        expect(calls3).toHaveLength(1);
        expect(calls3[0].opts.saveText).toBe('Zapisz i rozpocznij nową');
        expect(calls3[0].opts.okText).toBe('Usuń zmiany i rozpocznij nową');
        expect(clearOfferForm).not.toHaveBeenCalled();
        resolveChoice('stay');

        expect(await startPromise).toBe(false);
        expect(clearOfferForm).not.toHaveBeenCalled();
    });

    test('zapis nieudany pozostawia bieżącą ofertę bez resetu', async () => {
        const { context, state, createdIframes, resolveChoice } = runContext3({
            saveFn: async () => false
        });
        await bootOnRury(context, state);
        state.dirty = true;
        context.window.__sokCanSave = () => true;
        const clearOfferForm = jest.fn();
        createdIframes[0].contentWindow.clearOfferForm = clearOfferForm;

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();
        resolveChoice('save');

        expect(await startPromise).toBe(false);
        expect(clearOfferForm).not.toHaveBeenCalled();
        expect(state.dirty).toBe(true);
    });

    test('udany zapis czyści stary kontekst dopiero po zakończeniu zapisu', async () => {
        const { context, state, createdIframes, calls3, resolveChoice } = runContext3();
        await bootOnRury(context, state);
        state.dirty = true;
        context.window.__sokCanSave = () => true;
        const clearOfferForm = jest.fn();
        createdIframes[0].contentWindow.clearOfferForm = clearOfferForm;

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();
        resolveChoice('save');

        expect(await startPromise).toBe(true);
        expect(calls3).toHaveLength(1);
        expect(state.dirty).toBe(false);
        expect(clearOfferForm).toHaveBeenCalledTimes(1);
    });

    test('jawne usunięcie zmian odblokowuje rozpoczęcie nowej oferty', async () => {
        const { context, state, createdIframes, resolveChoice } = runContext3();
        await bootOnRury(context, state);
        state.dirty = true;
        context.window.__sokCanSave = () => true;
        const abandonCurrent = jest.fn();
        const clearOfferForm = jest.fn();
        context.window.__sokAbandonCurrent = abandonCurrent;
        createdIframes[0].contentWindow.clearOfferForm = clearOfferForm;

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();
        resolveChoice('leave');

        expect(await startPromise).toBe(true);
        expect(abandonCurrent).toHaveBeenCalledTimes(1);
        expect(clearOfferForm).toHaveBeenCalledTimes(1);
    });

    test('błąd oznaczenia zmian do usunięcia zatrzymuje reset formularza', async () => {
        const { context, state, createdIframes, resolveChoice } = runContext3();
        await bootOnRury(context, state);
        state.dirty = true;
        context.window.__sokCanSave = () => true;
        context.window.__sokAbandonCurrent = () => {
            throw new Error('abandon failed');
        };
        context.window.showToast = jest.fn();
        const clearOfferForm = jest.fn();
        createdIframes[0].contentWindow.clearOfferForm = clearOfferForm;

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();
        resolveChoice('leave');

        expect(await startPromise).toBe(false);
        expect(clearOfferForm).not.toHaveBeenCalled();
        expect(context.window.showToast).toHaveBeenCalledWith(
            'Nie udało się bezpiecznie odrzucić zmian. Bieżący dokument pozostał otwarty.',
            'error'
        );
    });

    test('oferta bez możliwości zapisu wymaga jawnego usunięcia zmian', async () => {
        const { context, state, createdIframes, confirmCalls, resolveConfirm } = runContext3();
        await bootOnRury(context, state);
        state.dirty = true;
        context.window.__sokCanSave = () => false;
        context.window.__sokAbandonCurrent = jest.fn();
        const clearOfferForm = jest.fn();
        createdIframes[0].contentWindow.clearOfferForm = clearOfferForm;

        const startPromise = context.window.SpaRouter.startNewOffer();
        await flush();

        expect(confirmCalls).toHaveLength(1);
        expect(confirmCalls[0].opts.okText).toBe('Usuń zmiany i rozpocznij nową');
        resolveConfirm(true);

        expect(await startPromise).toBe(true);
        expect(clearOfferForm).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['studnie', (frameWindow) => (frameWindow.isPreviewMode = true)],
        [
            'rury',
            (frameWindow) => {
                frameWindow.pricelistVersions = { isPricelistEditing: () => true };
            }
        ]
    ])('chroniony kontekst %s blokuje reset formularza oferty', async (module, setMode) => {
        const { context, state, createdIframes } = runContext();
        state.hash = `#/${module}`;
        await context.window.SpaRouter.navigate();
        const frameWindow = createdIframes[0].contentWindow;
        const clearOfferForm = jest.fn();
        frameWindow.clearOfferForm = clearOfferForm;
        setMode(frameWindow);

        expect(await context.window.SpaRouter.startNewOffer()).toBe(false);
        expect(clearOfferForm).not.toHaveBeenCalled();
    });
});
