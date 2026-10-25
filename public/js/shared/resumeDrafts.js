// @ts-check
/**
 * L1: „Wznów pracę" na pulpicie — lista lokalnych draftów użytkownika.
 *
 * Drafty są per-user i per-przeglądarka (`localStorage`), więc lista pokazuje
 * wyłącznie to, co realnie da się odzyskać na tym urządzeniu. Otwarcie prowadzi
 * deep-linkiem do modułu; sam draft przywraca istniejący banner odzysku modułu.
 * Nic nie jest przywracane automatycznie — wymagany klik użytkownika.
 */
(function () {
    'use strict';

    var CONTAINER_ID = 'resume-drafts';
    var KINDS = {
        offer_rury: { label: 'Oferta (Rury)', module: 'rury', param: 'edit' },
        order_rury: { label: 'Zamówienie (Rury)', module: 'rury', param: 'order' },
        offer_studnie: { label: 'Oferta (Studnie)', module: 'studnie', param: 'edit' },
        order_studnie: { label: 'Zamówienie (Studnie)', module: 'studnie', param: 'order' }
    };

    /** @param {string} s @returns {string} */
    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** @param {string} iso @returns {string} */
    function fmtWhen(iso) {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return 'nieznany czas';
        var pad = function (n) {
            return n < 10 ? '0' + n : String(n);
        };
        return (
            pad(d.getDate()) +
            '.' +
            pad(d.getMonth() + 1) +
            '.' +
            d.getFullYear() +
            ' ' +
            pad(d.getHours()) +
            ':' +
            pad(d.getMinutes())
        );
    }

    /**
     * Deep link do modułu. Draft nowego dokumentu nie ma docId → sam moduł.
     * @param {object} item
     * @returns {string}
     */
    function buildHref(item) {
        var cfg = KINDS[item.kind];
        if (!cfg) return 'app.html';
        var base = 'app.html#/' + cfg.module;
        var docId = item.docId ? String(item.docId) : '';
        if (!docId || docId === 'new') return base;
        return base + '?' + cfg.param + '=' + encodeURIComponent(docId);
    }

    /**
     * Renderuje listę. Pusta lista / brak magazynu / uszkodzone dane → kontener
     * ukryty, bez wyjątku.
     * @param {{id: string|number}} [user]
     */
    function render(user) {
        var box = document.getElementById(CONTAINER_ID);
        if (!box) return;
        var items = [];
        try {
            var store = window.draftStore;
            var userId = user && (user.id === 0 || user.id) ? String(user.id) : null;
            if (store && userId && typeof store.listUserDrafts === 'function') {
                items = store.listUserDrafts(window.localStorage, userId) || [];
            }
        } catch (_e) {
            items = [];
        }
        if (!items.length) {
            box.classList.add('hidden');
            box.innerHTML = '';
            return;
        }
        var rows = items
            .map(function (item) {
                var cfg = KINDS[item.kind];
                var label = cfg ? cfg.label : 'Dokument';
                return (
                    '<li class="resume-drafts-item">' +
                    '<span class="resume-drafts-label">' +
                    esc(label) +
                    '</span>' +
                    '<span class="resume-drafts-when">' +
                    esc(fmtWhen(item.updatedAt)) +
                    '</span>' +
                    '<a class="btn btn-sm btn-secondary" href="' +
                    esc(buildHref(item)) +
                    '">Wznów</a>' +
                    '</li>'
                );
            })
            .join('');
        box.innerHTML =
            '<h3 class="resume-drafts-title">Wznów pracę</h3>' +
            '<ul class="resume-drafts-list">' +
            rows +
            '</ul>';
        box.classList.remove('hidden');
        try {
            if (window.lucide && typeof window.lucide.createIcons === 'function')
                window.lucide.createIcons({ root: box });
        } catch (_e2) {}
    }

    window.resumeDrafts = { render: render, buildHref: buildHref };
})();
