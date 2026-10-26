// @ts-check
/**
 * cennik.js — #/cennik hostuje istniejące edytory cenników.
 *
 * Rury → rury.html (sekcja „Cennik"), Studnie/PRECO → studnie.html
 * (sekcja „Cennik", zakładka studnie albo PRECO). Tabele, walidacja, zapis
 * i panel wersji są te same co w modułach — bez zmiany hasha SPA.
 */

(function () {
    'use strict';

    const FRAMES = {
        rury: {
            id: 'cennik-frame-rury',
            src: 'rury.html?tab=pricelist&host=cennik',
            title: 'Cennik rur'
        },
        studnie: {
            id: 'cennik-frame-studnie',
            src: 'studnie.html?tab=pricelist&host=cennik',
            title: 'Cennik studni i PRECO'
        }
    };
    const TYPE_FRAME = { rury: 'rury', studnie: 'studnie', preco: 'studnie' };
    const TYPES = Object.keys(TYPE_FRAME);

    /** @type {{type: string, frames: Record<string, HTMLIFrameElement>, ready: Record<string, boolean>, pending: Record<string, Promise<HTMLIFrameElement | null> | null>, request: number}} */
    const state = {
        type: 'rury',
        frames: {},
        ready: {},
        pending: {},
        request: 0
    };

    function warn(message, error) {
        if (window.logger) window.logger.warn('cennik', message, error);
    }

    /** @param {number} ms */
    function delay(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    function stateElement() {
        return document.getElementById('cennik-state');
    }

    function showState(message) {
        const el = stateElement();
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
    }

    function hideState() {
        const el = stateElement();
        if (el) el.hidden = true;
    }

    /** Ukrywa nagłówek modułu i tło — powłoka SPA ma własny nagłówek. */
    function prepareFrame(frame) {
        try {
            const doc = frame.contentDocument;
            if (!doc) return;
            if (!doc.getElementById('cennik-frame-isolation')) {
                const style = doc.createElement('style');
                style.id = 'cennik-frame-isolation';
                style.textContent =
                    'header.header, .header.header { display: none !important; }' +
                    '#wizard-bottom-nav, #studnie-wizard-bottom-nav { display: none !important; }';
                doc.head.appendChild(style);
            }
            const main = doc.querySelector('main.main');
            if (main && main.style) {
                main.style.paddingTop = 'var(--tile-gap-xs-plus)';
                main.style.paddingBottom = 'var(--tile-gap-sm)';
                main.style.marginTop = '0';
            }
        } catch (e) {
            warn('Nie udało się przygotować osadzonego widoku', e);
        }
    }

    /** @param {string} key */
    function ensureFrame(key) {
        if (state.pending[key]) return state.pending[key];
        const existing = state.frames[key];
        if (existing && state.ready[key]) return Promise.resolve(existing);

        const config = FRAMES[key];
        const frame = existing || document.createElement('iframe');
        if (!existing) {
            frame.id = config.id;
            frame.className = 'cennik-frame';
            frame.title = config.title;
            frame.src = config.src;
            state.frames[key] = frame;
            const container = document.getElementById('cennik-frames');
            if (container) container.appendChild(frame);
        }

        state.pending[key] = new Promise((resolve) => {
            let settled = false;
            const done = (/** @type {HTMLIFrameElement | null} */ value) => {
                if (settled) return;
                settled = true;
                if (value) state.ready[key] = true;
                resolve(value);
            };
            frame.addEventListener(
                'load',
                () => {
                    prepareFrame(frame);
                    done(frame);
                },
                { once: true }
            );
            window.setTimeout(() => done(null), 20000);
        });
        return state.pending[key];
    }

    /**
     * Czeka na API modułu (defer + async init w iframe).
     * @param {Window} win
     * @param {string} name
     */
    function waitForFunction(win, name, attempts = 30, delay = 100) {
        return new Promise((resolve) => {
            let left = attempts;
            const check = () => {
                try {
                    if (win && typeof (/** @type {any} */ (win)[name]) === 'function') {
                        resolve(true);
                        return;
                    }
                } catch (_e) {
                    /* iframe jeszcze się ładuje */
                }
                left -= 1;
                if (left <= 0) {
                    resolve(false);
                    return;
                }
                window.setTimeout(check, delay);
            };
            check();
        });
    }

    /**
     * Czeka na element w iframe (partiale ładowane po load).
     * @param {Document} doc
     * @param {string} id
     */
    function waitForElement(doc, id, attempts = 40, delay = 100) {
        return new Promise((resolve) => {
            let left = attempts;
            const check = () => {
                if (doc.getElementById(id)) {
                    resolve(true);
                    return;
                }
                left -= 1;
                if (left <= 0) {
                    resolve(false);
                    return;
                }
                window.setTimeout(check, delay);
            };
            check();
        });
    }

    /** Wejście z tabów raila: ten sam typ = bez przeładowania modułu. */
    function activateFromRail(type) {
        if (!TYPES.includes(type)) return;
        if (type === state.type && state.ready[TYPE_FRAME[type]]) return;
        void activate(type);
    }

    /**
     * Pokazuje właściwy edytor i ustawia jego sekcję/zakładkę.
     * @param {string} type
     */
    async function activate(type) {
        if (!TYPES.includes(type)) return;
        const token = ++state.request;
        state.type = type;
        showState('Ładowanie cennika...');

        const key = TYPE_FRAME[type];
        const frame = await ensureFrame(key);
        if (token !== state.request) return;
        if (!frame) {
            showState('Nie udało się wczytać cennika. Kliknij zakładkę ponownie.');
            return;
        }

        Object.entries(state.frames).forEach(([frameKey, item]) => {
            item.classList.toggle('active', frameKey === key);
        });

        const win = /** @type {any} */ (frame.contentWindow);
        const hasSection = await waitForFunction(win, 'showSection');
        if (token !== state.request) return;
        const hasPricelist = await waitForElement(frame.contentDocument, 'section-pricelist');
        if (token !== state.request) return;
        if (!hasSection || !hasPricelist) {
            showState('Edytor cennika nie jest gotowy. Kliknij zakładkę ponownie.');
            return;
        }

        // Inicjalizacja modułu (auth + partiale) może nadpisać sekcję po load.
        // Poczekaj i potwierdź „pricelist"; w razie wyścigu ponów.
        await delay(250);
        let active = false;
        for (let attempt = 0; attempt < 4 && !active; attempt += 1) {
            if (token !== state.request) return;
            try {
                const shown = win.showSection('pricelist');
                if (shown && typeof shown.then === 'function') await shown;
            } catch (e) {
                warn('Nie udało się otworzyć sekcji cennika', e);
            }
            await delay(150);
            const section = frame.contentDocument?.getElementById('section-pricelist');
            active = Boolean(section && section.classList.contains('active'));
        }
        if (token !== state.request) return;
        if (!active) {
            showState('Edytor cennika nie jest gotowy. Kliknij zakładkę ponownie.');
            return;
        }

        if (type === 'preco' || type === 'studnie') {
            const hasTabs = await waitForFunction(win, 'selectCennikTab');
            if (token !== state.request) return;
            if (!hasTabs) {
                showState('Zakładki cennika nie są gotowe. Kliknij zakładkę ponownie.');
                return;
            }
            try {
                win.selectCennikTab(type === 'preco' ? 'preco' : 'dn1000');
            } catch (e) {
                warn('Nie udało się przełączyć zakładki cennika', e);
            }
        }

        // Rail jest jedynym lewym panelem #/cennik — otwieramy go zawsze.
        try {
            const pv = win.pricelistVersions;
            if (pv && typeof pv.autoOpenVersionsPanel === 'function') {
                await pv.autoOpenVersionsPanel(type);
            }
        } catch (e) {
            warn('Nie udało się otworzyć panelu zarządzania cennikiem', e);
        }
        if (token !== state.request) return;

        hideState();
    }

    // Mostek dla raila w iframe: typ przełącza moduł w powłoce.
    window.CennikHost = {
        activate: activateFromRail
    };

    async function init() {
        // Jedyne wejście: app.html#/cennik (spójnie z pozostałymi modułami SPA).
        if (window.top === window.self) {
            window.location.replace('/app.html#/cennik');
            return;
        }
        const requested = new URLSearchParams(window.location.search).get('tab') || 'rury';
        void activate(TYPES.includes(requested) ? requested : 'rury');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            void init();
        });
    } else {
        void init();
    }
})();
