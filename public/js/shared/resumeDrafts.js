// @ts-check
/**
 * L1: „Wznów pracę" — kafelek pulpitu i popup z lokalnymi szkicami oraz ostatnią trasą.
 *
 * Szkice są per-user i per-przeglądarka (`localStorage`), więc lista pokazuje
 * wyłącznie to, co realnie da się odzyskać na tym urządzeniu. Popup korzysta
 * z `modalCore.js` (Esc, overlay, focus trap). Usunięcie szkicu dotyczy tylko
 * kopii lokalnej — oferta zapisana na serwerze zostaje nietknięta.
 *
 * Nazwy firmy i obiektu są celowo wycięte z draftu (inwariant PII w
 * `draftStore.js`), więc popup dociąga je z API po `docId`. Wynik trzymamy
 * tylko w pamięci — do `localStorage` nigdy nie trafia nic osobowego.
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
    /** Przyczyna przerwania pracy zapisana w kopercie draftu (`exit.trigger`). */
    var EXIT_LABELS = {
        pagehide: 'zamknięcie karty',
        unload: 'zamknięcie lub przeładowanie karty',
        hidden: 'przełączono kartę lub okno',
        route: 'przejście do innego modułu'
    };
    /** Prefiks klucza draftu (musi być zgodny z `draftStore.KEY_PREFIX`). */
    var DRAFT_KEY_PREFIX = 'sok_draft_v1_';
    /** Prefiks meta serwerowej wersji draftu (format z `draftSync.js`). */
    var SYNC_META_PREFIX = 'sok_draft_srv_v1_';
    /** Maksymalna strona listy ofert rur (`paginationQuerySchema.limit`). */
    var LIST_LIMIT = 200;
    var DETAILS_TIMEOUT_MS = 5000;

    /**
     * Nazwy z serwera: `map[kind|docId]` + flaga zakończonego pobierania.
     * Trzymane w pamięci, czyszczone przy każdym otwarciu popupu.
     */
    var detailsState = { map: Object.create(null), loaded: false, token: 0 };

    /**
     * Ostatnia pełna lista szkiców (localStorage + IndexedDB) — źródło dla
     * popupu przy przemalowaniu, gdy duże drafty nie są w localStorage.
     * @type {Array<any>}
     */
    var draftsCache = [];

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
     * Odmiana rzeczownika po liczbie (1 studnia / 2 studnie / 5 studni).
     * @param {number} n
     * @param {string} one
     * @param {string} few
     * @param {string} many
     * @returns {string}
     */
    function plural(n, one, few, many) {
        if (n === 1) return one;
        var mod10 = n % 10;
        var mod100 = n % 100;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
    }

    /**
     * Wiek szkicu w ludzkiej formie („3 dni temu").
     * @param {string} iso
     * @returns {string}
     */
    function ageLabel(iso) {
        var t = Date.parse(iso);
        if (isNaN(t)) return '';
        var diff = Date.now() - t;
        if (diff < 0) diff = 0;
        var minutes = Math.floor(diff / 60000);
        if (minutes < 2) return 'przed chwilą';
        if (minutes < 60) return minutes + ' min temu';
        var hours = Math.floor(minutes / 60);
        if (hours < 24)
            return hours + ' ' + plural(hours, 'godzinę', 'godziny', 'godzin') + ' temu';
        var days = Math.floor(hours / 24);
        if (days < 30) return days + ' ' + plural(days, 'dzień', 'dni', 'dni') + ' temu';
        var months = Math.floor(days / 30);
        return months + ' ' + plural(months, 'miesiąc', 'miesiące', 'miesięcy') + ' temu';
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
        return n + ' ' + plural(n, 'szkic', 'szkice', 'szkiców');
    }

    /** @param {object} [user] @returns {string|null} */
    function userIdOf(user) {
        return user && (user.id === 0 || user.id) ? String(user.id) : null;
    }

    /**
     * Identyfikator dokumentu do nagłówka wiersza. Numer oferty z draftu jest
     * nietożsamościowy (nie jest PII), więc wolno go pokazać.
     * @param {object} item
     * @returns {string}
     */
    function docRef(item) {
        var draft = item.draft || {};
        var fields = (draft.payload && draft.payload.fields) || {};
        var number = fields.number ? String(fields.number).trim() : '';
        if (number) return 'nr ' + number;
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

    /**
     * Szkice z obu backendów: localStorage + IndexedDB (duże drafty). Fallback
     * zawsze do kopii lokalnej, żeby awaria IndexedDB nie gasiła listy.
     * @param {object} [user]
     * @returns {Promise<Array<any>>}
     */
    function listDraftsAuto(user) {
        var local = listDrafts(user);
        var userId = userIdOf(user);
        var store = window.draftStore;
        if (!userId || !store || typeof store.listUserDraftsAuto !== 'function')
            return Promise.resolve(local);
        return Promise.resolve(store.listUserDraftsAuto(window.localStorage, userId)).then(
            function (items) {
                var out = (items || []).filter(function (item) {
                    return String(item.docId || '').indexOf('-konflikt-') === -1;
                });
                return out;
            },
            function () {
                return local;
            }
        );
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

    /* ── Nazwy firmy/obiektu z serwera (bez PII w localStorage) ── */

    /**
     * @param {string} url
     * @returns {Promise<any>}
     */
    function requestJson(url) {
        if (typeof fetch !== 'function') return Promise.reject(new Error('no-fetch'));
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = null;
        /** @type {RequestInit} */
        var opts = { credentials: 'same-origin' };
        if (ctrl) {
            opts.signal = ctrl.signal;
            timer = setTimeout(function () {
                try {
                    ctrl.abort();
                } catch (_e) {}
            }, DETAILS_TIMEOUT_MS);
        }
        var stopTimer = function () {
            if (timer) clearTimeout(timer);
            timer = null;
        };
        return fetch(url, opts).then(
            function (res) {
                if (!res || !res.ok) {
                    stopTimer();
                    throw new Error('HTTP ' + (res ? res.status : '?'));
                }
                return res.json().then(
                    function (json) {
                        stopTimer();
                        return json;
                    },
                    function (err) {
                        stopTimer();
                        throw err;
                    }
                );
            },
            function (err) {
                stopTimer();
                throw err;
            }
        );
    }

    /**
     * @param {*} row
     * @returns {{clientName: string, investName: string, version: number|null}}
     */
    function pickRemote(row) {
        var r = row && typeof row === 'object' ? row : {};
        return {
            clientName: typeof r.clientName === 'string' ? r.clientName : '',
            investName: typeof r.investName === 'string' ? r.investName : '',
            version: typeof r.version === 'number' ? r.version : null
        };
    }

    /**
     * @param {string} kind
     * @param {Array<any>} rows
     * @param {Record<string, any>} out
     */
    function storeRows(kind, rows, out) {
        if (!Array.isArray(rows)) return;
        rows.forEach(function (row) {
            if (!row || !row.id) return;
            out[kind + '|' + String(row.id)] = pickRemote(row);
        });
    }

    /**
     * Pobiera nazwy dla jednego rodzaju. Oferty studni nie mają nazw w liście,
     * więc idą po jednym zapytaniu na szkic; reszta to jedna lista.
     * @param {string} kind
     * @param {Array<string>} ids
     * @param {Record<string, any>} out
     * @returns {Promise<any>}
     */
    function loadKind(kind, ids, out) {
        if (kind === 'offer_studnie') {
            return Promise.allSettled(
                ids.map(function (id) {
                    return requestJson('/api/offers-studnie/' + encodeURIComponent(id)).then(
                        function (json) {
                            var doc = json && json.data;
                            var blob =
                                doc && doc.data && typeof doc.data === 'object' ? doc.data : {};
                            out[kind + '|' + id] = pickRemote(blob);
                        }
                    );
                })
            );
        }
        var urls = {
            offer_rury: '/api/offers-rury?limit=' + LIST_LIMIT + '&sort=updatedAt&order=desc',
            order_rury: '/api/orders-rury',
            order_studnie: '/api/orders-studnie'
        };
        var url = urls[kind];
        if (!url) return Promise.resolve();
        return requestJson(url).then(function (json) {
            storeRows(kind, json && json.data, out);
        });
    }

    /**
     * @param {Array<any>} items
     * @returns {Record<string, Array<string>>}
     */
    function groupIds(items) {
        var byKind = Object.create(null);
        items.forEach(function (item) {
            if (!item.docId || item.docId === 'new') return;
            if (!KINDS[item.kind]) return;
            (byKind[item.kind] = byKind[item.kind] || []).push(String(item.docId));
        });
        return byKind;
    }

    /**
     * @param {Array<any>} items
     * @returns {Promise<Record<string, any>>}
     */
    function fetchDetails(items) {
        var byKind = groupIds(items);
        var kinds = Object.keys(byKind);
        if (!kinds.length || typeof fetch !== 'function') return Promise.resolve({});
        var out = Object.create(null);
        return Promise.all(
            kinds.map(function (kind) {
                return loadKind(kind, byKind[kind], out).catch(function () {});
            })
        ).then(function () {
            return out;
        });
    }

    /**
     * Dociąga nazwy po otwarciu popupu i przemalowuje wiersze. Odpowiedź
     * spóźniona (popup zamknięty / otwarty ponownie) jest ignorowana.
     * @param {object} [user]
     */
    function hydrate(user) {
        var token = ++detailsState.token;
        listDraftsAuto(user).then(function (all) {
            if (token !== detailsState.token) return;
            if (!all.length) return;
            fetchDetails(all).then(function (map) {
                if (token !== detailsState.token) return;
                Object.keys(map).forEach(function (key) {
                    detailsState.map[key] = map[key];
                });
                detailsState.loaded = true;
                var overlay = document.getElementById(MODAL_ID);
                if (!overlay) return;
                rerenderOverlay(user, overlay);
            });
        });
    }

    /* ── Opis wiersza ── */

    /**
     * Nazwy firmy i obiektu: z pamięci, w trakcie pobierania, albo jawnie brak.
     * @param {object} item
     * @returns {string}
     */
    function factsLine(item) {
        var remote = detailsState.map[item.kind + '|' + item.docId] || null;
        var parts = [];
        if (remote && remote.clientName) parts.push('Firma: ' + remote.clientName);
        if (remote && remote.investName) parts.push('Obiekt: ' + remote.investName);
        if (parts.length) return parts.join(' · ');
        if (!item.docId || item.docId === 'new') return 'Dokument jeszcze nie zapisany na serwerze';
        if (!detailsState.loaded) return 'Wczytywanie nazw…';
        return 'Nazwa firmy i obiektu niedostępne';
    }

    /**
     * Co jest w szkicu: studnie ze średnicami albo pozycje cennika.
     * @param {object} item
     * @returns {string}
     */
    function buildSummary(item) {
        var draft = item.draft || {};
        var payload = draft.payload || {};
        var parts = [];
        if (Array.isArray(payload.wells) && payload.wells.length) {
            var dns = [];
            payload.wells.forEach(function (well) {
                var dn = well && well.dn;
                if (!dn) return;
                var label = String(dn) === 'styczna' ? 'styczna' : 'DN' + String(dn);
                if (dns.indexOf(label) === -1) dns.push(label);
            });
            var wells = payload.wells.length;
            var head = wells + ' ' + plural(wells, 'studnia', 'studnie', 'studni');
            if (dns.length) {
                head += ' (' + dns.slice(0, 3).join(', ') + (dns.length > 3 ? ', …' : '') + ')';
            }
            parts.push(head);
        }
        if (Array.isArray(payload.items) && payload.items.length) {
            var items = payload.items.length;
            parts.push(items + ' ' + plural(items, 'pozycja', 'pozycje', 'pozycji'));
        }
        return parts.join(' · ');
    }

    /**
     * Czy dla dokumentu istnieje ukryta kopia konfliktu (L2, `docId-konflikt-*`).
     * @param {object|undefined} user
     * @param {object} item
     * @returns {boolean}
     */
    function conflictExists(user, item) {
        var userId = userIdOf(user);
        if (!userId || !item.docId) return false;
        var prefix = DRAFT_KEY_PREFIX + userId + '_' + item.kind + '_' + item.docId + '-konflikt-';
        try {
            var storage = window.localStorage;
            for (var i = 0; i < storage.length; i++) {
                var key = storage.key(i);
                if (key && key.indexOf(prefix) === 0) return true;
            }
        } catch (_e) {}
        return false;
    }

    /**
     * Wersja dokumentu na serwerze z meta draftSync (bez zapytania).
     * shortcut: format klucza `sok_draft_srv_v1_*` z draftSync.js, który nie jest
     * ładowany na pulpicie; zmiana formatu wymaga aktualizacji obu miejsc.
     * @param {object|undefined} user
     * @param {object} item
     * @returns {number|null}
     */
    function serverVersionOf(user, item) {
        var userId = userIdOf(user);
        if (!userId || !item.docId || item.docId === 'new') return null;
        try {
            var raw = window.localStorage.getItem(
                SYNC_META_PREFIX + userId + '_' + item.kind + '_' + item.docId
            );
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed.version === 'number' ? parsed.version : null;
        } catch (_e) {
            return null;
        }
    }

    /**
     * Przyczyna przerwania — od najbardziej pewnej do najmniej pewnej.
     * @param {object|undefined} user
     * @param {object} item
     * @returns {string} '' = brak danych
     */
    function reasonFor(user, item) {
        if (conflictExists(user, item)) return 'konflikt wersji — jest kopia lokalna';
        var draft = item.draft || {};
        var serverVersion = serverVersionOf(user, item);
        if (
            serverVersion !== null &&
            typeof draft.baseVersion === 'number' &&
            serverVersion > draft.baseVersion
        ) {
            return 'na serwerze nowsza wersja';
        }
        var trigger = draft.exit && draft.exit.trigger;
        if (trigger && EXIT_LABELS[trigger]) return EXIT_LABELS[trigger];
        if (!item.docId || item.docId === 'new') return 'szkic nigdy nie zapisany';
        return '';
    }

    /**
     * @param {object|undefined} user
     * @param {object} item
     * @returns {string}
     */
    function renderRow(user, item) {
        var cfg = KINDS[item.kind];
        var label = cfg ? cfg.label : 'Dokument';
        var ref = docRef(item);
        var summary = buildSummary(item);
        var reason = reasonFor(user, item);
        var reasonLine = 'Przerwano: ' + (reason || 'brak zapisu przyczyny');
        var age = ageLabel(item.updatedAt);
        if (age) reasonLine += ' · ' + age;
        return (
            '<li class="resume-row">' +
            '<span class="resume-row-main">' +
            '<span class="resume-row-label">' +
            esc(label) +
            ' · ' +
            esc(ref) +
            '</span>' +
            '<span class="resume-row-facts">' +
            esc(factsLine(item)) +
            '</span>' +
            (summary ? '<span class="resume-row-facts">' + esc(summary) + '</span>' : '') +
            '<span class="resume-row-reason">' +
            esc(reasonLine) +
            '</span>' +
            '</span>' +
            '<a class="btn btn-sm btn-primary" href="' +
            esc(buildHref(item)) +
            '">Wznów</a>' +
            '<button type="button" class="btn-icon" aria-label="' +
            esc('Usuń szkic: ' + label + ' ' + ref) +
            '" data-resume-action="delete" data-key="' +
            esc(item.key) +
            '"><i data-lucide="trash-2" class="icon-14" aria-hidden="true"></i></button>' +
            '</li>'
        );
    }

    /**
     * Kafelek pulpitu. Zawsze widoczny: bez danych jest wyszarzony (disabled).
     * Najpierw kopia lokalna (natychmiast), potem lista z IndexedDB.
     * @param {object} [user]
     */
    function render(user) {
        var box = document.getElementById(CONTAINER_ID);
        if (!box) return;
        draftsCache = listDrafts(user);
        paintTile(box, user, draftsCache);
        listDraftsAuto(user).then(function (drafts) {
            // Kafelek mógł zniknąć (zmiana widoku) — wtedy nie ma czego malować.
            if (document.getElementById(CONTAINER_ID) !== box) return;
            draftsCache = drafts;
            paintTile(box, user, drafts);
        });
    }

    /**
     * @param {HTMLElement} box
     * @param {object} [user]
     * @param {Array<any>} [drafts]
     */
    function paintTile(box, user, drafts) {
        var list = drafts || [];
        var route = getRoute(user);
        var hasData = list.length > 0 || !!route;
        var sub = list.length
            ? 'Kopie lokalne w tej przeglądarce'
            : route
              ? 'Ostatnia trasa: ' + route.label
              : 'Brak szkiców do wznowienia';
        var badge = list.length ? countLabel(list.length) : route ? 'Ostatnia trasa' : '';
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

    /**
     * @param {object} [user]
     * @param {Array<any>} [items] lista z listDraftsAuto; brak = pamięć/lokalna
     * @returns {string}
     */
    function popupHtml(user, items) {
        var drafts = items || (draftsCache.length ? draftsCache : listDrafts(user));
        var total = totalKeys(user);
        var route = getRoute(user);
        var rows = drafts.length
            ? drafts
                  .map(function (item) {
                      return renderRow(user, item);
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
            'Nazwy firmy i obiektu są pobierane z serwera tylko na czas wyświetlenia. ' +
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
            draftsCache = draftsCache.filter(function (item) {
                return item.key !== key;
            });
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
            draftsCache = [];
            return totalKeys(user) === 0;
        } catch (_e) {
            return false;
        }
    }

    /**
     * Przemalowuje otwarty popup, zachowując fokus wewnątrz modala.
     * @param {object|undefined} user
     * @param {HTMLElement} overlay
     * @param {Array<any>} [items]
     */
    function rerenderOverlay(user, overlay, items) {
        // render() podmienia kafelek, więc modalCore traci referencję do elementu
        // sprzed otwarcia — bez tego fokus po zamknięciu nie ma gdzie wrócić.
        var tileBtn = document.querySelector('#resume-drafts [data-resume-action="open"]');
        /** @type {any} */ (overlay)._previousFocus = tileBtn;
        var hadFocus =
            typeof overlay.contains === 'function' && overlay.contains(document.activeElement);
        overlay.innerHTML = popupHtml(user, items);
        paintIcons(overlay);
        if (!hadFocus) return;
        var next = overlay.querySelector('[data-resume-action="close"]');
        if (next && typeof next.focus === 'function') next.focus();
    }

    /**
     * Odświeża kafelek i zawartość otwartego popupu; pusty popup zamyka.
     * @param {object} [user]
     */
    function refresh(user) {
        render(user);
        var overlay = document.getElementById(MODAL_ID);
        if (!overlay) return;
        // Zamknięcie zostaje synchroniczne, gdy nic nie zostało (localStorage
        // pusty i brak kopii z IndexedDB w pamięci) — bez migotania pustego modala.
        var local = listDrafts(user);
        if (!local.length && !draftsCache.length && !getRoute(user)) {
            if (typeof window.closeModal === 'function') window.closeModal(MODAL_ID);
            return;
        }
        // Najpierw stan z pamięci (bez migotania), potem pełna lista z IndexedDB.
        rerenderOverlay(user, overlay, draftsCache.length ? draftsCache : local);
        listDraftsAuto(user).then(function (items) {
            if (document.getElementById(MODAL_ID) !== overlay) return;
            if (!items.length && !getRoute(user)) {
                if (typeof window.closeModal === 'function') window.closeModal(MODAL_ID);
                return;
            }
            rerenderOverlay(user, overlay, items);
        });
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
        detailsState = { map: Object.create(null), loaded: false, token: 0 };
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
        hydrate(user);
        // Duże drafty żyją w IndexedDB: modal otwiera się od razu, a pełna lista
        // (localStorage + IndexedDB) dochodzi chwilę później i przemalowuje wiersze.
        listDraftsAuto(user).then(function (items) {
            if (document.getElementById(MODAL_ID) !== overlay) return;
            draftsCache = items;
            rerenderOverlay(user, overlay, items);
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
            // Duże szkice żyją w IndexedDB (poza licznikiem kluczy localStorage).
            var count = Math.max(draftsCache.length, totalKeys(user));
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
