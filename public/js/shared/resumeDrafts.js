// @ts-check
/**
 * L1: „Wznów pracę" — kafelek pulpitu i popup z lokalnymi szkicami oraz ostatnią trasą.
 *
 * Szkice są per-user i per-przeglądarka (`localStorage`), więc lista pokazuje
 * wyłącznie to, co realnie da się odzyskać na tym urządzeniu. Popup korzysta
 * z `modalCore.js` (Esc, overlay, focus trap). Usunięcie szkicu dotyczy tylko
 * kopii lokalnej — oferta zapisana na serwerze zostaje nietknięta.
 */
(function () {
    'use strict';

    var CONTAINER_ID = 'resume-drafts';
    var MODAL_ID = 'resume-modal';
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
     * Odmiana rzeczownika „szkic" dla licznika (1 szkic / 2 szkice / 5 szkiców).
     * @param {number} n
     * @returns {string}
     */
    function countLabel(n) {
        if (n === 1) return '1 szkic';
        var mod10 = n % 10;
        var mod100 = n % 100;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return n + ' szkice';
        return n + ' szkiców';
    }

    /** @param {object} [user] @returns {string|null} */
    function userIdOf(user) {
        return user && (user.id === 0 || user.id) ? String(user.id) : null;
    }

    /**
     * @param {object} item
     * @returns {string}
     */
    function docLabel(item) {
        return item.docId && item.docId !== 'new' ? '#' + item.docId : 'nowy dokument';
    }

    /**
     * Szkice użytkownika. Kopie konfliktu (L2) nie są dokumentami — nie da się
     * ich wznowić deep-linkiem, więc nie trafiają na listę.
     * @param {object} [user]
     * @returns {Array<any>}
     */
    function listDrafts(user) {
        var userId = userIdOf(user);
        if (!userId) return [];
        try {
            var store = window.draftStore;
            if (!store || typeof store.listUserDrafts !== 'function') return [];
            var items = store.listUserDrafts(window.localStorage, userId) || [];
            return items.filter(function (item) {
                return String(item.docId || '').indexOf('-konflikt-') === -1;
            });
        } catch (_e) {
            return [];
        }
    }

    /** @param {object} [user] @returns {{hash: string, label: string, updatedAt: string}|null} */
    function getRoute(user) {
        try {
            if (!window.lastRoute || typeof window.lastRoute.get !== 'function') return null;
            return window.lastRoute.get(user);
        } catch (_e) {
            return null;
        }
    }

    /** @param {HTMLElement} root */
    function paintIcons(root) {
        try {
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons({ root: root });
            }
        } catch (_e) {}
    }

    /**
     * Kafelek pulpitu. Zawsze widoczny: bez danych jest wyszarzony (disabled).
     * @param {object} [user]
     */
    function render(user) {
        var box = document.getElementById(CONTAINER_ID);
        if (!box) return;
        var drafts = listDrafts(user);
        var route = getRoute(user);
        var hasData = drafts.length > 0 || !!route;
        var sub = drafts.length
            ? 'Kopie lokalne w tej przeglądarce'
            : route
              ? 'Ostatnia trasa: ' + route.label
              : 'Brak szkiców do wznowienia';
        var badge = drafts.length ? countLabel(drafts.length) : route ? 'Ostatnia trasa' : '';
        box.innerHTML =
            '<button type="button" class="launch-card resume" data-resume-action="open"' +
            (hasData ? ' aria-haspopup="dialog"' : ' disabled') +
            '>' +
            '<span class="resume-icon"><i data-lucide="history" aria-hidden="true"></i></span>' +
            '<span class="launch-content">' +
            '<span class="resume-title">Wznów pracę</span>' +
            '<span class="resume-sub">' +
            esc(sub) +
            '</span>' +
            '</span>' +
            (badge ? '<span class="resume-count">' + esc(badge) + '</span>' : '') +
            '<i data-lucide="chevron-right" class="resume-chevron icon-14" aria-hidden="true"></i>' +
            '</button>';
        paintIcons(box);
        if (!hasData) return;
        var btn = box.querySelector('[data-resume-action="open"]');
        if (btn) {
            btn.addEventListener('click', function () {
                openPopup(user);
            });
        }
    }

    /** @param {object} [user] @returns {string} */
    function popupHtml(user) {
        var drafts = listDrafts(user);
        var total = totalKeys(user);
        var route = getRoute(user);
        var rows = drafts.length
            ? drafts
                  .map(function (item) {
                      var cfg = KINDS[item.kind];
                      var label = cfg ? cfg.label : 'Dokument';
                      return (
                          '<li class="resume-row">' +
                          '<span class="resume-row-main">' +
                          '<span class="resume-row-label">' +
                          esc(label) +
                          '</span>' +
                          '<span class="resume-row-meta">' +
                          esc(docLabel(item) + ' · ' + fmtWhen(item.updatedAt)) +
                          '</span>' +
                          '</span>' +
                          '<a class="btn btn-sm btn-primary" href="' +
                          esc(buildHref(item)) +
                          '">Wznów</a>' +
                          '<button type="button" class="btn-icon" aria-label="' +
                          esc('Usuń szkic: ' + label + ' ' + docLabel(item)) +
                          '" data-resume-action="delete" data-key="' +
                          esc(item.key) +
                          '"><i data-lucide="trash-2" class="icon-14" aria-hidden="true"></i></button>' +
                          '</li>'
                      );
                  })
                  .join('')
            : '<li class="resume-row resume-row--empty">Brak szkiców w tej przeglądarce.</li>';
        var routeBlock = route
            ? '<div class="resume-route">' +
              '<span class="resume-route-title">Ostatnia trasa</span>' +
              '<div class="resume-row">' +
              '<span class="resume-row-main">' +
              '<span class="resume-row-label">Wróć do: ' +
              esc(route.label) +
              '</span>' +
              '<span class="resume-row-meta">' +
              esc(fmtWhen(route.updatedAt)) +
              '</span>' +
              '</span>' +
              '<a class="btn btn-sm btn-secondary" href="' +
              esc('app.html' + route.hash) +
              '">Otwórz</a>' +
              '<button type="button" class="btn-icon" aria-label="Usuń zapis ostatniej trasy" ' +
              'data-resume-action="forget-route"><i data-lucide="trash-2" class="icon-14" ' +
              'aria-hidden="true"></i></button>' +
              '</div>' +
              '</div>'
            : '';
        return (
            '<div class="modal modal--md resume-modal">' +
            '<div class="modal-header">' +
            '<h3 id="resume-modal-title">Wznów pracę</h3>' +
            '<button type="button" class="btn-icon" aria-label="Zamknij" ' +
            'data-resume-action="close"><i data-lucide="x" class="icon-14" ' +
            'aria-hidden="true"></i></button>' +
            '</div>' +
            '<p class="resume-modal-hint">Kopie zapisane lokalnie w tej przeglądarce. ' +
            'Usunięcie szkicu nie usuwa zapisanej oferty.</p>' +
            '<ul class="resume-list">' +
            rows +
            '</ul>' +
            routeBlock +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-sm btn-danger" ' +
            'data-resume-action="delete-all"' +
            (total ? '' : ' disabled') +
            '>Usuń wszystkie kopie lokalne' +
            (total ? ' (' + total + ')' : '') +
            '</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" ' +
            'data-resume-action="close">Zamknij</button>' +
            '</div>' +
            '</div>'
        );
    }

    /**
     * @param {string} msg
     * @returns {boolean}
     */
    function ask(msg) {
        if (typeof window.confirm !== 'function') return false;
        try {
            return window.confirm(msg);
        } catch (_e) {
            return false;
        }
    }

    /**
     * @param {string} msg
     * @param {'success'|'error'|'info'|'warning'} [type]
     */
    function toast(msg, type) {
        try {
            if (typeof window.showToast === 'function') window.showToast(msg, type || 'success');
        } catch (_e) {}
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    function removeDraft(key) {
        try {
            var store = window.draftStore;
            if (!store || typeof store.removeDraft !== 'function' || !key) return false;
            store.removeDraft(window.localStorage, key);
            return window.localStorage.getItem(key) === null;
        } catch (_e) {
            return false;
        }
    }

    /**
     * Liczba wszystkich kluczy szkiców użytkownika, także ukrytych kopii
     * konfliktów — „usuń wszystko" czyści cały magazyn lokalny.
     * @param {object} [user]
     * @returns {number}
     */
    function totalKeys(user) {
        var userId = userIdOf(user);
        if (!userId) return 0;
        try {
            var store = window.draftStore;
            if (!store || typeof store.listUserDraftKeys !== 'function') return 0;
            return store.listUserDraftKeys(window.localStorage, userId).length;
        } catch (_e) {
            return 0;
        }
    }

    /**
     * @param {object} [user]
     * @returns {boolean}
     */
    function removeAllDrafts(user) {
        var userId = userIdOf(user);
        if (!userId) return false;
        try {
            var store = window.draftStore;
            if (!store || typeof store.removeUserDrafts !== 'function') return false;
            store.removeUserDrafts(window.localStorage, userId);
            return totalKeys(user) === 0;
        } catch (_e) {
            return false;
        }
    }

    /**
     * Odświeża kafelek i zawartość otwartego popupu; pusty popup zamyka.
     * @param {object} [user]
     */
    function refresh(user) {
        render(user);
        var overlay = document.getElementById(MODAL_ID);
        if (!overlay) return;
        if (!listDrafts(user).length && !getRoute(user)) {
            if (typeof window.closeModal === 'function') window.closeModal(MODAL_ID);
            return;
        }
        // render() podmienia kafelek, więc modalCore traci referencję do elementu
        // sprzed otwarcia — bez tego fokus po zamknięciu nie ma gdzie wrócić.
        var tileBtn = document.querySelector('#resume-drafts [data-resume-action="open"]');
        /** @type {any} */ (overlay)._previousFocus = tileBtn;
        var hadFocus = overlay.contains(document.activeElement);
        overlay.innerHTML = popupHtml(user);
        paintIcons(overlay);
        if (hadFocus) {
            var next = overlay.querySelector('[data-resume-action="close"]');
            if (next) next.focus();
        }
    }

    /** @param {object} [user] */
    function openPopup(user) {
        if (typeof window.showModal !== 'function') {
            try {
                if (window.logger && typeof window.logger.error === 'function') {
                    window.logger.error('ui', 'resumeDrafts: brak window.showModal (modalCore)');
                }
            } catch (_e) {}
            return;
        }
        var overlay = window.showModal({
            id: MODAL_ID,
            titleId: 'resume-modal-title',
            html: popupHtml(user)
        });
        if (!overlay) return;
        paintIcons(overlay);
        overlay.addEventListener('click', function (e) {
            handleAction(e, user);
        });
    }

    /**
     * @param {Event} e
     * @param {object} [user]
     */
    function handleAction(e, user) {
        var target = /** @type {any} */ (e.target);
        if (!target || typeof target.closest !== 'function') return;
        var btn = target.closest('[data-resume-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-resume-action');
        if (action === 'close') {
            if (typeof window.closeModal === 'function') window.closeModal(MODAL_ID);
            return;
        }
        if (action === 'delete') {
            var key = btn.getAttribute('data-key') || '';
            if (!key) return;
            if (!ask('Usunąć ten szkic? Tej operacji nie można cofnąć.')) return;
            if (!removeDraft(key)) {
                toast('Nie udało się usunąć szkicu', 'error');
                return;
            }
            toast('Usunięto szkic');
            refresh(user);
            return;
        }
        if (action === 'delete-all') {
            var count = totalKeys(user);
            if (!count) return;
            if (
                !ask(
                    'Usunąć wszystkie kopie lokalne (' +
                        count +
                        ')? Obejmuje to ukryte kopie konfliktów. Tej operacji nie można cofnąć.'
                )
            )
                return;
            if (!removeAllDrafts(user)) {
                toast('Nie udało się usunąć szkiców', 'error');
                return;
            }
            toast('Usunięto wszystkie kopie lokalne');
            refresh(user);
            return;
        }
        if (action === 'forget-route') {
            if (!ask('Usunąć zapis ostatniej trasy? Tej operacji nie można cofnąć.')) return;
            try {
                if (!window.lastRoute || typeof window.lastRoute.clear !== 'function') {
                    toast('Nie udało się usunąć zapisu trasy', 'error');
                    return;
                }
                window.lastRoute.clear(user);
            } catch (_e) {
                toast('Nie udało się usunąć zapisu trasy', 'error');
                return;
            }
            if (getRoute(user)) {
                toast('Nie udało się usunąć zapisu trasy', 'error');
                return;
            }
            toast('Usunięto zapis trasy');
            refresh(user);
        }
    }

    window.resumeDrafts = { render: render, buildHref: buildHref, openPopup: openPopup };
})();
