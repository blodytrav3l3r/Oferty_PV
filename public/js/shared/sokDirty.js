// @ts-check
/* ===== SOK DIRTY SSoT (SPA-GUARD-PRO P0.1+P0.2) =====
 * Jedno źródło prawdy „czy są niezapisane zmiany".
 * Ładowany w rodzicu SPA i w każdym iframe (rury/studnie/kartoteka/zlecenia).
 * Kolejność ładowania dowolna — wszyscy wołają leniwie przez typeof-guard.
 *
 * Lokalnie: flagi (_excelDirty/_wizardDirty) fast-path + diff draft-vs-SAVED
 * (draftAutosave.hasUnsavedChanges, rozstrzyga ciche edycje rur bez flag).
 * W rodzicu: dodatkowo skan iframe (nowa funkcja albo legacy fallback).
 */

(function () {
    'use strict';

    function _localFlagsDirty() {
        try {
            if (typeof _excelDirty !== 'undefined' && _excelDirty) return true;
        } catch (_e) {}
        try {
            if (typeof window !== 'undefined' && window._excelDirty) return true;
        } catch (_e2) {}
        try {
            if (typeof window !== 'undefined' && window._wizardDirty) return true;
        } catch (_e3) {}
        return false;
    }

    function _localDiffDirty() {
        try {
            if (
                window.draftAutosave &&
                typeof window.draftAutosave.hasUnsavedChanges === 'function'
            )
                return window.draftAutosave.hasUnsavedChanges() === true;
        } catch (_e) {}
        return false;
    }

    function _frameDirty(w) {
        try {
            if (!w) return false;
            if (typeof w.__sokIsDirty === 'function' && w.__sokIsDirty !== __sokIsDirty)
                return w.__sokIsDirty() === true;
        } catch (_e) {}
        try {
            if (w && w._excelDirty) return true;
        } catch (_e2) {}
        try {
            if (w && w.window && w.window._excelDirty) return true;
        } catch (_e3) {}
        try {
            if (w && w._wizardDirty) return true;
        } catch (_e4) {}
        try {
            if (w && w.draftAutosave && typeof w.draftAutosave.hasUnsavedChanges === 'function')
                return w.draftAutosave.hasUnsavedChanges() === true;
        } catch (_e5) {}
        try {
            var _selfDirty = null;
            try {
                _selfDirty = window._isWizardDirty || null;
            } catch (_e6a) {}
            if (w && typeof w._isWizardDirty === 'function' && w._isWizardDirty !== _selfDirty)
                return w._isWizardDirty() === true;
        } catch (_e6) {}
        return false;
    }

    /**
     * Czy gdziekolwiek są niezapisane zmiany (lokalnie + iframe).
     * @returns {boolean}
     */
    function __sokIsDirty() {
        try {
            if (_localFlagsDirty()) return true;
            if (_localDiffDirty()) return true;
            var frames = null;
            try {
                frames =
                    typeof document !== 'undefined'
                        ? document.querySelectorAll('iframe.spa-module-iframe')
                        : null;
            } catch (_e) {
                frames = null;
            }
            if (frames) {
                for (var i = 0; i < frames.length; i++) {
                    try {
                        var _fr = /** @type {HTMLIFrameElement} */ (frames[i]);
                        if (_frameDirty(_fr.contentWindow)) return true;
                    } catch (_e2) {}
                }
            }
        } catch (_e3) {}
        return false;
    }

    /**
     * Pierwszy brudny kontekst do komunikatu guarda (P1.1).
     * @returns {{kind: string, docId: string, number: string, module: string}|null}
     */
    function __sokDescribeDirty() {
        try {
            if (window.draftAutosave && typeof window.draftAutosave.describeDirty === 'function') {
                var local = window.draftAutosave.describeDirty();
                if (local) {
                    local.module = _guessModule();
                    return local;
                }
            }
        } catch (_e) {}
        var frames = null;
        try {
            frames =
                typeof document !== 'undefined'
                    ? document.querySelectorAll('iframe.spa-module-iframe')
                    : null;
        } catch (_e2) {
            frames = null;
        }
        if (frames) {
            for (var i = 0; i < frames.length; i++) {
                try {
                    var _fr2 = /** @type {HTMLIFrameElement} */ (frames[i]);
                    var w = _fr2.contentWindow;
                    if (!w) continue;
                    var mod = '';
                    try {
                        mod = String(_fr2.id || '').replace('spa-iframe-', '');
                    } catch (_e3) {}
                    if (w.draftAutosave && typeof w.draftAutosave.describeDirty === 'function') {
                        var d = w.draftAutosave.describeDirty();
                        if (d) {
                            d.module = mod;
                            return d;
                        }
                    } else if (_frameDirty(w)) {
                        return { kind: '', docId: '', number: '', module: mod };
                    }
                } catch (_e4) {}
            }
        }
        return null;
    }

    function _guessModule() {
        try {
            var p = String((typeof window !== 'undefined' && window.location.pathname) || '');
            if (p.indexOf('studnie') !== -1) return 'studnie';
            if (p.indexOf('rury') !== -1) return 'rury';
            if (p.indexOf('kartoteka') !== -1) return 'kartoteka';
            if (p.indexOf('zlecenia') !== -1) return 'zlecenia';
        } catch (_e) {}
        return '';
    }

    /**
     * Zapisz brudny kontekst w danym oknie. Agnostyczny wobec kontraktu
     * saverów (rury saveOffer zwraca undefined, studnie boolean) — sukces
     * = brak wyjątku + czysto po zapisie.
     * @param {Window} w okno docelowe (iframe contentWindow)
     * @returns {Promise<boolean>} true = zapisano (można nawigować)
     */
    function __sokSaveDirty(w) {
        var fn = null;
        try {
            if (!w) return Promise.resolve(false);
            var oe = null;
            try {
                oe = w.orderEditMode;
            } catch (_e) {}
            if (oe && typeof w.saveCurrentOrder === 'function') fn = w.saveCurrentOrder;
            else if (typeof w.saveOfferStudnie === 'function') fn = w.saveOfferStudnie;
            else if (typeof w.saveOffer === 'function') fn = w.saveOffer;
            if (!fn) return Promise.resolve(false);
            return Promise.resolve()
                .then(function () {
                    return fn.call(w);
                })
                .then(function () {
                    try {
                        if (typeof w.__sokIsDirty === 'function') return !w.__sokIsDirty();
                        if (
                            w.draftAutosave &&
                            typeof w.draftAutosave.hasUnsavedChanges === 'function'
                        )
                            return !w.draftAutosave.hasUnsavedChanges();
                    } catch (_e2) {}
                    return true;
                })
                .catch(function () {
                    return false;
                });
        } catch (_e3) {
            return Promise.resolve(false);
        }
    }

    /** Etykieta rodzaju do komunikatów (P1.1). */
    function __sokKindLabel(kind) {
        if (kind === 'offer_studnie') return 'Oferta (Studnie)';
        if (kind === 'order_studnie') return 'Zamówienie (Studnie)';
        if (kind === 'offer_rury') return 'Oferta (Rury)';
        if (kind === 'order_rury') return 'Zamówienie (Rury)';
        return 'Dokument';
    }

    /**
     * Okno trzymające brudny dokument: najpierw lokalny draft, potem iframe
     * pasujący do podpowiedzi modułu, potem pierwszy brudny iframe.
     * @param {string} [moduleHint] np. 'studnie' z __sokDescribeDirty
     * @returns {Window|null}
     */
    function __sokDirtyWindow(moduleHint) {
        try {
            if (
                window.draftAutosave &&
                typeof window.draftAutosave.describeDirty === 'function' &&
                window.draftAutosave.describeDirty()
            )
                return window;
        } catch (_e) {}
        var frames = null;
        try {
            frames =
                typeof document !== 'undefined'
                    ? document.querySelectorAll('iframe.spa-module-iframe')
                    : null;
        } catch (_e2) {
            frames = null;
        }
        if (!frames) return null;
        var i;
        for (i = 0; i < frames.length; i++) {
            try {
                var fr = /** @type {HTMLIFrameElement} */ (frames[i]);
                var w = fr.contentWindow;
                if (!w) continue;
                var mod = String(fr.id || '').replace('spa-iframe-', '');
                if (moduleHint && mod === moduleHint) return w;
            } catch (_e3) {}
        }
        for (i = 0; i < frames.length; i++) {
            try {
                var w2 = /** @type {HTMLIFrameElement} */ (frames[i]).contentWindow;
                if (!w2) continue;
                if (_frameDirty(w2)) return w2;
            } catch (_e4) {}
        }
        return null;
    }

    /**
     * Liczba lokalnych draftów użytkownika (P1.3, unia po storage współdzielonym
     * same-origin — rodzic liczy przez iframe, moduł lokalnie).
     * @returns {number}
     */
    function __sokCountDrafts() {
        var keys = {};
        function collect(w) {
            try {
                if (!w || !w.draftStore || typeof w.draftStore.listUserDraftKeys !== 'function')
                    return;
                var uid = null;
                try {
                    uid = w.currentUser && w.currentUser.id;
                } catch (_e) {}
                if (uid === undefined || uid === null || String(uid) === '') return;
                var list = w.draftStore.listUserDraftKeys(w.localStorage, String(uid));
                for (var i = 0; i < list.length; i++) keys[list[i]] = 1;
            } catch (_e2) {}
        }
        collect(window);
        try {
            var frames =
                typeof document !== 'undefined'
                    ? document.querySelectorAll('iframe.spa-module-iframe')
                    : null;
            if (frames) {
                for (var i = 0; i < frames.length; i++) {
                    try {
                        collect(/** @type {HTMLIFrameElement} */ (frames[i]).contentWindow);
                    } catch (_e3) {}
                }
            }
        } catch (_e4) {}
        var n = 0;
        for (var k in keys) if (Object.prototype.hasOwnProperty.call(keys, k)) n++;
        return n;
    }

    try {
        window.__sokIsDirty = __sokIsDirty;
        window.__sokDescribeDirty = __sokDescribeDirty;
        window.__sokSaveDirty = __sokSaveDirty;
        window.__sokKindLabel = __sokKindLabel;
        window.__sokDirtyWindow = __sokDirtyWindow;
        window.__sokCountDrafts = __sokCountDrafts;
    } catch (_e) {}
})();
