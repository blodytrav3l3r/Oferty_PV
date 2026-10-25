// @ts-check
/**
 * Ctrl+S / Cmd+S → realny zapis aktywnego dokumentu modułu.
 *
 * Wcześniej skrót był martwy: handler w `shared/dashboard.js` żyje na pulpicie
 * (index.html), gdzie funkcje zapisu modułów nie istnieją, i robił early return
 * przy fokusie w polu formularza — czyli dokładnie podczas pisania.
 *
 * Ten plik ładują strony modułów (rury.html, studnie.html). Nie pokazuje własnych
 * toastów: komunikat pochodzi z faktycznej operacji zapisu.
 */
(function () {
    'use strict';

    /**
     * Funkcja zapisu aktywnego dokumentu (null gdy brak kontekstu).
     * @returns {Function|null}
     */
    function resolveSave() {
        try {
            // rury: dispatcher oferta/zamówienie.
            if (typeof window.saveOfferOrOrder === 'function') return window.saveOfferOrOrder;
            // studnie: tryb edycji zamówienia ma pierwszeństwo.
            if (window.orderEditMode && typeof window.saveCurrentOrder === 'function')
                return window.saveCurrentOrder;
            if (typeof window.saveOfferStudnie === 'function') return window.saveOfferStudnie;
            if (typeof window.saveCurrentOrder === 'function') return window.saveCurrentOrder;
        } catch (_e) {}
        return null;
    }

    /**
     * @param {KeyboardEvent} e
     */
    function onKeyDown(e) {
        if (!e || (!e.ctrlKey && !e.metaKey)) return;
        if (e.key !== 's' && e.key !== 'S') return;
        var save = resolveSave();
        if (typeof save !== 'function') return;
        e.preventDefault();
        try {
            Promise.resolve(save()).catch(function () {});
        } catch (_e2) {}
    }

    document.addEventListener('keydown', onKeyDown);

    window.saveShortcut = { resolveSave: resolveSave, onKeyDown: onKeyDown };
})();
