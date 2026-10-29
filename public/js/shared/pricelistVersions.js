// @ts-check
/* ===== WERSJE CENNIKÓW (F3, współdzielone: rury + studnie) ===== */
/* Modal „Zapisz jako wersję" + tabela wersji + badge „cennik vX" w ofertach. */
/* Zależności (globalne): authHeaders, escapeHtml/escapeHtmlAttr/escapeJsStr, */
/* showToast, showModal/closeModal z shared/modalCore.js, lucide. */

(function () {
    'use strict';

    var API = '/api/pricelist-versions';
    /** Cache etykiet per typ: id -> {version, seq, effectiveFrom}. */
    var labelCache = {};
    /** Id wersji obowiązującej per typ z BE (pin admina + data) — SSoT badge. */
    var activeIdsByType = {};
    /** Czy bieżący użytkownik widzi pełną listę (admin) per typ. */
    var canManage = {};
    /** Id raila — jeden na stronę; brak = strona bez sekcji cennika (kartoteka). */
    var DOCK_ID = 'pv-dock';
    var DOCK_BACKDROP_ID = 'pv-dock-backdrop';
    /** Stan raila: ostatnio wyświetlony typ. */
    var dockState = { type: null };
    /** Wybrana karta per typ — akcje w pasku działają na tym zaznaczeniu. */
    var selectedVersionId = {};
    /** Ostatnio pobrane wersje per typ — źródło danych dla paska akcji. */
    var versionsByType = {};
    /** Zzwinięte grupy lat na osi wersji: `<typ>:<rok>` → true. */
    var collapsedYears = {};
    /** Tytuł osi w nagłówku prawej kolumny (studnie i PRECO dzielą stronę). */
    var HEADER_TITLES = {
        rury: 'Cennik Rur',
        studnie: 'Cennik elementów studni',
        preco: 'Cennik wkładek PRECO'
    };
    /** Oś opisana przez nagłówek — chroni przed spóźnionym fetch/fetchem innej osi. */
    var headerAxis = null;

    /** Fail-closed fallback: brak globalnego escapera nie może wstrzyknąć HTML. */
    function escRaw(s) {
        return String(s ?? '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function esc(s) {
        return typeof window.escapeHtml === 'function' ? window.escapeHtml(s) : escRaw(s);
    }

    function escAttr(s) {
        return typeof window.escapeHtmlAttr === 'function' ? window.escapeHtmlAttr(s) : escRaw(s);
    }

    /**
     * Etykieta wyświetlana: ręczna korekta (labelOverride) ma pierwszeństwo nad
     * etykietą pochodną. Kanoniczna etykieta zostaje w `version` (referencja).
     */
    function labelOf(v) {
        var manual = v && typeof v.labelOverride === 'string' ? v.labelOverride.trim() : '';
        return manual !== '' ? manual : (v && v.version) || '';
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') window.showToast(msg, type || 'info');
    }

    /** appConfirm z natywnym fallbackiem (jedno miejsce, styl/dark-light z ui.js). */
    function pvConfirm(msg, opts) {
        if (typeof window.appConfirm === 'function') return window.appConfirm(msg, opts);
        if (typeof window.confirm === 'function') return Promise.resolve(window.confirm(msg));
        return Promise.resolve(true);
    }

    function icons(root) {
        if (window.lucide) window.lucide.createIcons(root ? { root: root } : undefined);
    }

    async function apiJson(url, opts) {
        var res = await fetch(url, opts);
        var body = null;
        try {
            body = await res.json();
        } catch (_e) {
            body = null;
        }
        if (!res.ok) {
            var err =
                /** @type {Error & { status?: number; code?: unknown; details?: unknown }} */ (
                    new Error((body && body.error) || 'Błąd HTTP ' + res.status)
                );
            err.status = res.status;
            err.code = body && body.code;
            // Import XLSX pokazuje błędy per komórka z `details`.
            err.details = body && body.details;
            throw err;
        }
        return body;
    }

    /**
     * Nazwa pliku z `Content-Disposition` odpowiedzi (serwer zna numer cennika),
     * z fallbackiem dla starszego BE — inaczej przeglądarka zapisze generyk.
     */
    function downloadNameFrom(res, fallback) {
        try {
            var cd =
                (res && res.headers && typeof res.headers.get === 'function'
                    ? res.headers.get('Content-Disposition')
                    : '') || '';
            var m = /filename="?([^";]+)"?/i.exec(cd);
            if (m && m[1]) return m[1];
        } catch (_e) {
            /* brak nagłówka → fallback */
        }
        return fallback;
    }

    function authed(method, data) {
        var headers = typeof window.authHeaders === 'function' ? window.authHeaders() : {};
        var opts = { method: method || 'GET', headers: headers };
        if (data !== undefined) {
            opts.headers = Object.assign({}, headers, { 'Content-Type': 'application/json' });
            opts.body = JSON.stringify(data);
        }
        return opts;
    }

    /** Etykiety wersji na oś czasu (bez cen) — działa też dla nie-admina. */
    async function fetchLabels(type, force) {
        if (!force && labelCache[type]) return labelCache[type];
        var json = await apiJson(API + '/labels?type=' + encodeURIComponent(type), authed('GET'));
        var map = {};
        (json.versions || []).forEach(function (v) {
            map[v.id] = v;
        });
        // BE wie, co realnie liczy ofertę (pin admina + data) — nie zgadujemy z seq.
        if (json.activeIds && Object.prototype.hasOwnProperty.call(json.activeIds, type)) {
            activeIdsByType[type] = json.activeIds[type] || null;
        }
        labelCache[type] = map;
        return map;
    }

    /** Etykiety wersji po id (bez filtra statusu — też archiwalne);
     *  dopisuje do cache per id. */
    async function fetchLabelsByIds(type, ids) {
        var json = await apiJson(
            API +
                '/labels?type=' +
                encodeURIComponent(type) +
                '&ids=' +
                encodeURIComponent(ids.join(',')),
            authed('GET')
        );
        var map = labelCache[type] || (labelCache[type] = {});
        (json.versions || []).forEach(function (v) {
            map[v.id] = v;
        });
        return map;
    }

    /** Pełna lista wersji (tylko admin; 403 → fallback do etykiet). */
    async function fetchFullList(type) {
        try {
            var json = await apiJson(API + '?type=' + encodeURIComponent(type), authed('GET'));
            canManage[type] = true;
            if (json && json.activeOverrides) activeOverrideIds = json.activeOverrides;
            return applyActiveOverride(type, json.versions || []);
        } catch (e) {
            if (e && e.status === 403) {
                canManage[type] = false;
                var labels = await fetchLabels(type, true);
                return Object.keys(labels).map(function (id) {
                    return labels[id];
                });
            }
            throw e;
        }
    }

    /** Ręcznie ustawiony obowiązujący cennik per oś (id albo null). */
    var activeOverrideIds = {};

    /**
     * Ręczny wybór zmienia stan kafelków: wskazana wersja = ACTIVE,
     * dotychczasowa „najnowsza z daty" = ARCHIVED (nie jest już w użyciu).
     */
    function applyActiveOverride(type, list) {
        var pinned = activeOverrideIds[type];
        if (!pinned) return list;
        var exists = list.some(function (v) {
            return v.id === pinned;
        });
        if (!exists) return list;
        return list.map(function (v) {
            if (v.id === pinned) return Object.assign({}, v, { state: 'ACTIVE', pinned: true });
            if (stateOf(v) === 'ACTIVE') return Object.assign({}, v, { state: 'ARCHIVED' });
            return v;
        });
    }

    /* ===== BADGE „cennik vX" ===== */

    /** Placeholder badge; hydrateBadges() uzupełnia labelkę + tooltip.
     *  Dopisek typu (· Studnie/Rury/Preco) TYLKO na poziomie wyświetlania —
     *  labelki wersji w DB (PricelistVersion.version) niemutowalne. */
    function badgeHtml(versionId, type) {
        if (!versionId) return '';
        var typeAttr = type ? ' data-pv-type="' + escAttr(type) + '"' : '';
        return (
            '<span class="pv-offer-badge badge-info" data-pv-id="' +
            escAttr(versionId) +
            '"' +
            typeAttr +
            ' title="Wersja cennika…">cennik…</span>'
        );
    }

    /** Placeholder badge aktywnej wersji per typ (gdy wiersz nie niesie
     *  versionId, np. lista kartoteki); hydrateActiveBadges() uzupełnia.
     *  Bez fetchy per karta — 1× fetchLabels per typ (cache). */
    function activeBadgeHtml(type) {
        return (
            '<span class="pv-offer-badge badge-info" data-pv-active="' +
            escAttr(type) +
            '" title="Aktywny cennik…">cennik…</span>'
        );
    }

    /** Aktywna = wskazana przez BE (`activeIds`, pin admina) albo najnowszy
     *  effectiveFrom spośród APPROVED z /labels.
     *  SSoT osi czasu: resolver BE wybiera max effectiveFrom, nie max seq
     *  (backdated approve może mieć wyższy seq i starszą datę). */
    function pickActiveLabel(labels, type) {
        var pinned = type ? activeIdsByType[type] : null;
        if (pinned && labels && labels[pinned]) return labels[pinned];
        var best = null;
        Object.keys(labels || {}).forEach(function (id) {
            var v = labels[id];
            if (!best || (v.effectiveFrom || '') > (best.effectiveFrom || '')) best = v;
        });
        return best;
    }

    /** Maluje pojedynczy badge: „cennik {version} · {Typ}" + tooltip z typem. */
    function paintVersionBadge(el, v, type) {
        var label = typeLabel(type || (v && v.type) || '');
        if (!v) {
            el.textContent = 'cennik legacy';
            el.setAttribute(
                'title',
                'Oferta sprzed wersjonowania (legacy)' + (label ? ' • Typ: ' + label : '')
            );
            return;
        }
        el.textContent = 'cennik ' + labelOf(v) + (label ? ' · ' + label : '');
        var local = '';
        try {
            local = new Date(v.effectiveFrom).toLocaleString();
        } catch (_e2) {
            local = v.effectiveFrom;
        }
        el.setAttribute(
            'title',
            'Wersja ' +
                labelOf(v) +
                (v.labelOverride ? ' (kanoniczna: ' + v.version + ')' : '') +
                ' (seq ' +
                v.seq +
                ')' +
                (label ? ' • Typ: ' + label : '') +
                ' • obowiązuje od: ' +
                local +
                ' • UTC: ' +
                v.effectiveFrom
        );
    }

    /** Grupuje spany per typ (data-pv-* albo fallback) — 1 fetch per typ. */
    function groupSpotsByType(spots, attr, fallbackType) {
        var byType = {};
        spots.forEach(function (el) {
            var t = el.getAttribute(attr) || fallbackType || 'rury';
            (byType[t] = byType[t] || []).push(el);
        });
        return byType;
    }

    /** Uzupełnia badge w danym kontenerze (labelka + tooltip effectiveFrom).
     *  Typ per badge z data-pv-type, fallback: parametr type albo v.type. */
    async function hydrateBadges(root, type) {
        var scope = root || document;
        var spots = scope.querySelectorAll ? scope.querySelectorAll('span[data-pv-id]') : [];
        if (spots.length === 0) return;
        var byType = groupSpotsByType(spots, 'data-pv-type', type);
        await Promise.all(
            Object.keys(byType).map(async function (t) {
                var labels;
                try {
                    labels = await fetchLabels(t);
                } catch (_e) {
                    return;
                }
                // Pieczątka archiwalna nie ma w cache /labels (tylko
                // ACTIVE/BACKDATE) — dopytaj batch ?ids= raz per typ.
                var missing = [];
                byType[t].forEach(function (el) {
                    var id = el.getAttribute('data-pv-id');
                    if (id && !labels[id] && missing.indexOf(id) === -1) missing.push(id);
                });
                if (missing.length > 0) {
                    try {
                        labels = await fetchLabelsByIds(t, missing);
                    } catch (_e2) {
                        /* cisza — nieznane id spadnie do legacy */
                    }
                }
                byType[t].forEach(function (el) {
                    paintVersionBadge(el, labels[el.getAttribute('data-pv-id')], t);
                });
            })
        );
    }

    /** Uzupełnia badge aktywnych wersji (data-pv-active); pusty typ → muted. */
    async function hydrateActiveBadges(root) {
        var scope = root || document;
        var spots = scope.querySelectorAll ? scope.querySelectorAll('span[data-pv-active]') : [];
        if (spots.length === 0) return;
        var byType = groupSpotsByType(spots, 'data-pv-active', null);
        await Promise.all(
            Object.keys(byType).map(async function (t) {
                var labels;
                try {
                    labels = await fetchLabels(t);
                } catch (_e) {
                    return;
                }
                var active = pickActiveLabel(labels, t);
                var label = typeLabel(t);
                byType[t].forEach(function (el) {
                    if (!active) {
                        el.className = 'text-muted';
                        el.textContent = 'brak aktywnego cennika';
                        el.setAttribute('title', 'Brak aktywnego cennika (' + label + ')');
                        return;
                    }
                    paintVersionBadge(el, active, t);
                    // Fallback dla ofert bez pieczątki: widać, że to bieżący
                    // cennik, nie wersja z oferty.
                    el.textContent += ' (bieżący)';
                    el.setAttribute(
                        'title',
                        el.getAttribute('title') +
                            ' • Oferta bez pieczątki — pokazano bieżący aktywny cennik'
                    );
                });
            })
        );
    }

    /* ===== MODAL: ZAPISZ JAKO WERSJĘ + TABELA ===== */

    /** Prefiks etykiety per oś (S=studnie, R=rury, P=preco) — SSoT BE lifecycle.versionLabel. */
    var TYPE_PREFIX = { rury: 'R', studnie: 'S', preco: 'P' };

    /** Podgląd labelki: {Prefiks}v{seq}-{RRRRMMDD} z daty (lokalnej lub ISO). */
    function versionLabel(type, seq, dateValue) {
        var prefix = TYPE_PREFIX[type] || '';
        var d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return prefix + 'v' + seq;
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return prefix + 'v' + seq + '-' + y + m + day;
    }

    /** Etykiety stanów (BE `state`, wyliczany z `effectiveFrom`) — SSoT UI.
     *  4 stany widoczne dla admina: Obowiązuje / Do wdrożenia / W przygotowaniu /
     *  Historyczny. `APPROVED` to surowy status zapisany (nie stan) — tylko fallback. */
    var STATUS_LABELS = {
        ACTIVE: 'Obowiązuje',
        SCHEDULED: 'Do wdrożenia',
        DRAFT: 'W przygotowaniu',
        ARCHIVED: 'Historyczny',
        APPROVED: 'Zatwierdzona'
    };

    /** Statusy sprzed migracji 20261021000000 (bazy bez migracji) — tylko odczyt.
     *  Po migracji w bazie ich nie ma (ACTIVE/SCHEDULED/ARCHIVED/BACKDATE → APPROVED,
     *  BACKDATE_REQUESTED → DRAFT). */
    var LEGACY_STATUS_LABELS = {
        BACKDATE: 'Obowiązuje (korekta)',
        BACKDATE_REQUESTED: 'Szkic (korekta)'
    };

    /** Stan z API (`state`) z fallbackiem na raw status (starsze odpowiedzi). */
    function stateOf(v) {
        return (v && (v.state || v.status)) || '';
    }

    function displayStatus(v) {
        var state = stateOf(v);
        return STATUS_LABELS[state] || LEGACY_STATUS_LABELS[state] || state;
    }

    function canPublish(state) {
        return state === 'DRAFT';
    }

    function canDelete(state) {
        return isDeletable(state);
    }

    /** Kody kolizji daty (BE): PERIOD_OVERLAP (activate) i EFFECTIVE_COLLISION
     *  (backdate) oznaczają to samo — zajęty effectiveFrom. Jeden komunikat. */
    function dateConflictMessage(err) {
        if (err && (err.code === 'PERIOD_OVERLAP' || err.code === 'EFFECTIVE_COLLISION')) {
            return (
                'Kolizja daty obowiązywania: ' +
                (err.message || '') +
                ' Użyj innej daty albo ścieżki wstecznej (backdate).'
            );
        }
        if (err && err.code === 'LOCK_BUSY') {
            return 'Zapis w toku, spróbuj ponownie za chwilę.';
        }
        return null;
    }

    function friendlyError(prefix, err) {
        var mapped = dateConflictMessage(err);
        return prefix + ': ' + (mapped || (err && err.message) || 'nieznany błąd');
    }

    /** true gdy effectiveFrom jest w przeszłości (korekta wsteczna → nota ≥ 10 znaków). */
    function isPastDate(iso) {
        if (!iso) return false;
        var t = Date.parse(iso);
        if (Number.isNaN(t)) return false;
        return t < Date.now() - 60000;
    }

    /**
     * Kontrola przed publikacją (advisory, read-only). Fail-soft: brak kontroli
     * nie blokuje publikacji — walidacja krytycznych warunków jest w tx (BE).
     */
    async function fetchChecks(id) {
        try {
            var json = await apiJson(API + '/' + encodeURIComponent(id) + '/checks', authed('GET'));
            return json || null;
        } catch (_e) {
            return null;
        }
    }

    /**
     * Publikacja: kanoniczny POST /:id/approve (aliasy publish/activate/backdate są
     * deprecated). checksCheckedAt przekazujemy, żeby BE mógł odpowiedzieć
     * checksStale=true (200, ostrzeżenie) gdy wersja zmieniła się po kontroli.
     */
    /**
     * Publikacja: `noteOrOpts` = nota (stary wariant) albo { note, effectiveFrom }.
     * effectiveFrom = data, od której wersja obowiązuje (datetime-local → UTC ISO).
     */
    async function approveVersion(id, noteOrOpts) {
        var opts = noteOrOpts && typeof noteOrOpts === 'object' ? noteOrOpts : { note: noteOrOpts };
        var checks = await fetchChecks(id);
        var body = {};
        if (checks && checks.checkedAt) body.checksCheckedAt = checks.checkedAt;
        if (opts.note && String(opts.note).trim()) body.note = opts.note;
        if (opts.effectiveFrom) body.effectiveFrom = opts.effectiveFrom;
        return apiJson(API + '/' + encodeURIComponent(id) + '/approve', authed('POST', body));
    }

    /** Ikony Lucide inline SVG — badge statusu wersji cennika. */
    var STATUS_ICONS = {
        ACTIVE: '<svg class="badge-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
        SCHEDULED:
            '<svg class="badge-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
        BACKDATE_REQUESTED:
            '<svg class="badge-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/></svg>',
        BACKDATE:
            '<svg class="badge-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
        DRAFT: '<svg class="badge-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.17 6.83a2.83 2.83 0 0 0-4-4L3.5 16.5 2 22l5.5-1.5Z"/><path d="m15 5 4 4"/></svg>',
        APPROVED:
            '<svg class="badge-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        ARCHIVED:
            '<svg class="badge-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>'
    };

    function statusBadge(status) {
        // Stany wyliczane: ACTIVE zielony, SCHEDULED niebieski, DRAFT/ARCHIVED szare.
        // BACKDATE_REQUESTED (legacy) bursztyn — czeka na decyzję.
        var label = STATUS_LABELS[status] || LEGACY_STATUS_LABELS[status] || status;
        var icon = STATUS_ICONS[status] || '';
        var iconHtml = icon
            ? '<span style="display:inline-flex;align-items:center;gap:3px">' +
              icon +
              esc(label) +
              '</span>'
            : esc(label);
        if (status === 'ACTIVE')
            return (
                '<span class="badge-ok text-nowrap" style="display:inline-flex;align-items:center;gap:4px" title="Obowiązuje — wybrana przez resolver dla nowych ofert">' +
                iconHtml +
                '</span>'
            );
        if (status === 'SCHEDULED')
            return (
                '<span class="badge-info text-nowrap" style="display:inline-flex;align-items:center;gap:4px" title="Zatwierdzona, wejdzie w życie w dacie Obowiązuje od">' +
                iconHtml +
                '</span>'
            );
        if (status === 'BACKDATE_REQUESTED')
            return (
                '<span class="badge-warn text-nowrap" style="display:inline-flex;align-items:center;gap:4px" title="Szkic z datą wsteczną — wymaga uzasadnienia (korekta wsteczna)">' +
                iconHtml +
                '</span>'
            );
        if (status === 'BACKDATE')
            return (
                '<span class="badge-muted text-nowrap" style="display:inline-flex;align-items:center;gap:4px" title="Zatwierdzona korekta historyczna (tylko odczyt)">' +
                iconHtml +
                '</span>'
            );
        if (status === 'DRAFT')
            return (
                '<span class="badge-muted text-nowrap" style="display:inline-flex;align-items:center;gap:4px" title="Wersja robocza — opublikuj, aby weszła na oś czasu">' +
                iconHtml +
                '</span>'
            );
        if (status === 'ARCHIVED')
            return (
                '<span class="badge-muted text-nowrap" style="display:inline-flex;align-items:center;gap:4px" title="Poprzednia obowiązująca w archiwum (tylko odczyt)">' +
                iconHtml +
                '</span>'
            );
        return (
            '<span class="text-muted" style="display:inline-flex;align-items:center;gap:4px">' +
            iconHtml +
            '</span>'
        );
    }

    /** Nazwa typu cennika wielką literą do tytułu panelu. */
    function typeLabel(type) {
        if (type === 'studnie') return 'Studnie';
        if (type === 'rury') return 'Rury';
        if (type === 'preco') return 'Preco';
        return type;
    }

    /** Hash SPA z edytorem cennika danego typu (PRECO to zakładka w module studnie). */
    function editorHash(type) {
        if (type === 'rury') return '#/rury?tab=pricelist';
        if (type === 'preco') return '#/studnie?tab=pricelist&pvtype=preco';
        return '#/studnie?tab=pricelist';
    }

    /**
     * „Edytuj”: szkic → normalny edytor szkicu; opublikowana → edycja w miejscu.
     * Ostrzeżenie mówi wprost, co zmienia zapis (ceny tej wersji, historia ofert bez zmian).
     * Jedno źródło dla kafelka w sekcji wersji i w pasku trybu edycji.
     */
    async function openVersionOrDraft(type) {
        var v = selectedVersion(type);
        if (v) return startVersionEdit(type, v);
        // Pasek trybu działa też bez otwartego panelu (brak zaznaczenia) —
        // celuje dokładnie w to, co kafelek w panelu: szkic, a bez szkicu ACTIVE.
        var json = await fetchSummary();
        var data = (json && json.types && json.types[type]) || {};
        var target = data.draft || data.active;
        if (!target) {
            toast('Brak wersji do edycji — najpierw zapisz cennik', 'warning');
            return;
        }
        return startVersionEdit(type, target);
    }

    /** Właściwa akcja kafelka „Edytuj" dla konkretnej wersji. */
    function startVersionEdit(type, v) {
        if (isEditableStatus(stateOf(v))) {
            openEditorFor(type, labelOf(v));
            return;
        }
        var state = stateOf(v);
        var kind =
            state === 'ACTIVE'
                ? 'obowiązującą'
                : state === 'SCHEDULED'
                  ? 'zaplanowaną'
                  : 'historyczną';
        var effect =
            state === 'ACTIVE'
                ? 'Nowe oferty policzą się z nowych cen od razu.'
                : 'Wpłynie na podgląd, eksport i przyszłe użycie tej wersji.';
        pvConfirm(
            'Edytujesz opublikowaną wersję ' +
                labelOf(v) +
                ' (' +
                kind +
                '). Zapis podmieni jej ceny w miejscu — ' +
                effect +
                ' Istniejące oferty zachowają swoje ceny (mają własne pieczątki). Kontynuować?',
            {
                title: 'Edycja wersji ' + labelOf(v),
                okText: 'Edytuj wersję',
                type: 'warning'
            }
        ).then(function (ok) {
            if (ok) openVersionEditor(type, v);
        });
    }

    /**
     * Zamyka panel wersji i wchodzi w edycję szkicu: grid czyta DRAFT i zapisuje
     * do niego (nie do LIVE). Toast leci w oknie rodzica, bo iframe modułu może
     * zostać przeładowany przy zmianie Rury ↔ Studnie.
     */
    function openEditorFor(type, label, created) {
        var msg =
            (created ? 'Utworzono szkic ' : 'Edytujesz szkic ') +
            (label || '') +
            ' — „Zapisz" trafia do szkicu, LIVE bez zmian';
        // Podgląd wersji nie może zasłaniać edytora, do którego właśnie wchodzimy.
        closeEditorPreview(type);
        // #/cennik: edycja w miejscu — bez zmiany hasha SPA na #/rury / #/studnie.
        if (isCennikHost()) {
            if (type === 'preco' && typeof window.selectCennikTab === 'function') {
                window.selectCennikTab('preco');
            }
            setEditing(type, true);
            reloadEditorGrid(type);
            syncEditor(type);
            refreshTable(type, canManage[type] === true).catch(function () {
                /* lista odświeży się przy następnym otwarciu */
            });
            renderStatusStrip('pv-dock-status', type).catch(function () {
                /* pasek jest dodatkiem */
            });
            toast(msg, 'info');
            return;
        }
        /** @type {any} */
        var host = window;
        try {
            if (window.parent && window.parent !== window) host = window.parent;
        } catch (_e) {
            host = window;
        }
        var hash = editorHash(type);
        var current = '';
        try {
            current = host.location.hash;
        } catch (_e2) {
            current = '';
        }
        if (current === hash) {
            // Ten sam widok → router nie dostanie hashchange, zakładkę przełączamy lokalnie.
            if (type === 'preco' && typeof window.selectCennikTab === 'function') {
                window.selectCennikTab('preco');
            }
        } else {
            try {
                host.location.hash = hash;
            } catch (_e3) {
                /* brak dostępu do rodzica — zostaje bieżący widok */
            }
        }
        var notify = typeof host.showToast === 'function' ? host.showToast : window.showToast;
        if (typeof notify === 'function') notify(msg, 'info');
    }

    /** Data obowiązywania: czytelny zapis lokalny; ISO (UTC) zostaje w tooltipie. */
    function fmtEff(iso) {
        var local = iso;
        try {
            local = new Date(iso).toLocaleString();
        } catch (_e) {
            /* zostaw ISO */
        }
        return '<span title="' + escAttr(iso) + '">' + esc(local) + '</span>';
    }

    /** Komórka użycia: ile ofert/zamówień albo wersji studni trzyma pieczątkę. */
    function usedByCell(v) {
        if (typeof v.usedBy !== 'number') return '<span class="text-muted">—</span>';
        if (v.usedBy === 0) return '<span class="text-muted">0</span>';
        var kind = v.usedByKind === 'studnieVersions' ? 'wersji studni' : 'ofert/zamówień';
        return (
            '<span title="Tyle ' +
            kind +
            ' trzyma pieczątkę tej wersji — zmiana/aktywacja ich nie ruszy (snapshot w ofercie)">' +
            '<strong>' +
            esc(String(v.usedBy)) +
            '</strong></span>'
        );
    }

    /**
     * Usunąć można wersję, która nie jest obowiązująca i nic jej nie używa:
     * szkic, zaplanowana oraz historyczna (ofert zero).
     */
    function isDeletable(state) {
        return state === 'DRAFT' || state === 'SCHEDULED' || state === 'ARCHIVED';
    }

    /** Statusy z edytowalną treścią i notą (jak EDITABLE_STATUSES w BE). */
    function isEditableStatus(state) {
        return state === 'DRAFT';
    }

    /** Notatki wersji; edycja idzie przez akcję „Notatki” w pasku nad listą. */
    function noteCell(v) {
        return (
            '<span class="pv-note-cell"><span class="pv-note-text">' +
            esc(v.note || '—') +
            '</span></span>'
        );
    }

    /** Powód blokady „Usuń" (null = wolno): PRECO z referencjami, obowiązująca, użycie. */
    function deleteReason(v) {
        var state = stateOf(v);
        if (v.usedByKind === 'studnieVersions' && typeof v.usedBy === 'number' && v.usedBy > 0) {
            return 'Używana przez ' + v.usedBy + ' wersji studni';
        }
        if (state === 'DRAFT') return null;
        if (state === 'ACTIVE') return 'Wersja obowiązująca — najpierw ustaw inną jako aktywną';
        // SCHEDULED i ARCHIVED: usuwalne tylko bez pieczątek ofert/zamówień.
        if (typeof v.usedBy !== 'number') return 'Brak danych o użyciu — nieusuwalna';
        if (v.usedBy > 0) return 'Używana przez ' + v.usedBy + ' ofert/zamówień';
        return null;
    }

    /** Rok podkategorii: effectiveFrom, fallback data utworzenia. */
    function yearOf(v) {
        var m = /^(\d{4})/.exec(String(v.effectiveFrom || v.createdAt || ''));
        return m ? m[1] : 'Bez daty';
    }

    /** Podkategorie rok → wersje (najnowszy rok pierwszy, „Bez daty” na końcu). */
    function groupByYear(versions) {
        var groups = {};
        var order = [];
        versions.forEach(function (v) {
            var year = yearOf(v);
            if (!groups[year]) {
                groups[year] = [];
                order.push(year);
            }
            groups[year].push(v);
        });
        order.sort(function (a, b) {
            if (a === 'Bez daty') return 1;
            if (b === 'Bez daty') return -1;
            return Number(b) - Number(a);
        });
        return order.map(function (year) {
            return { year: year, versions: groups[year] };
        });
    }

    /** Zaznaczenie: trzymaj wybór użytkownika, inaczej domyślnie wersja obowiązująca. */
    function resolveSelection(type, versions) {
        var id = selectedVersionId[type];
        /** @type {any} */
        var hit = null;
        versions.forEach(function (v) {
            if (v.id === id) hit = v;
        });
        if (!hit) {
            versions.forEach(function (v) {
                if (!hit && stateOf(v) === 'ACTIVE') hit = v;
            });
        }
        selectedVersionId[type] = hit ? hit.id : null;
        return selectedVersionId[type];
    }

    function selectedVersion(type) {
        var list = versionsByType[type] || [];
        var id = selectedVersionId[type];
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) return list[i];
        }
        return null;
    }

    /* ===== Nagłówek prawej kolumny: nazwa osi + numer cennika ===== */

    function syncHeaderTitle(type) {
        var title = document.getElementById('pv-title-text');
        if (title && HEADER_TITLES[type]) title.textContent = HEADER_TITLES[type];
    }

    function syncHeaderVersion(text) {
        var badge = document.getElementById('pv-title-version');
        if (!badge) return;
        badge.textContent = text || '';
        badge.hidden = !text;
    }

    /** Etykieta wersji obowiązującej osi ('' = brak listy w pamięci). */
    function activeVersionLabel(type) {
        var act = null;
        (versionsByType[type] || []).forEach(function (v) {
            if (!act && stateOf(v) === 'ACTIVE') act = v;
        });
        return act ? labelOf(act) : '';
    }

    /** Nagłówek wg zakładki studni: Wkładki to osobna oś PRECO. */
    function syncHeaderForTab(type) {
        headerAxis = type;
        syncHeaderTitle(type);
        // Siatka pokazuje wersję — numer w nagłówku należy do niej, nie do ACTIVE.
        if (versionAxis()) return;
        if (versionsByType[type]) {
            syncHeaderVersion(activeVersionLabel(type));
            return;
        }
        syncHeaderVersion('');
        fetchFullList(type)
            .then(function (list) {
                versionsByType[type] = list;
                if (headerAxis === type) syncHeaderVersion(activeVersionLabel(type));
            })
            .catch(function () {
                /* brak listy = zostaje sam tytuł */
            });
    }

    /** Wróć do edycji: przywraca dane siatki i nagłówek osi. */
    function closeEditorPreview(type) {
        if (type) restoreGrid(type);
    }

    /** Klik w kartę: zaznaczenie + ta wersja w prawdziwej siatce edytora. */
    function openSelectedPreview(type) {
        var v = selectedVersion(type);
        if (!v) return;
        // Wybór innej wersji kończy ewentualną edycję wersji (dane live ze snapshotu).
        if (versionEditMode(type)) {
            clearVersionEdit();
            setEditing(type, false);
        }
        showVersionInGrid(type, v);
    }

    /* ===== Wersja w siatce edytora (ta sama tabela, tylko odczyt) ===== */

    /** Odczyt danych osi z window (bez literału `window.X =` — gate kolizji globali). */
    function readAxisData(name) {
        return window[name];
    }

    /** Zapis danych osi: setter z globals.js, inaczej zwykłe przypisanie. */
    function writeAxisData(name, rows) {
        var desc = Object.getOwnPropertyDescriptor(window, name);
        if (desc && typeof desc.set === 'function') {
            desc.set(rows);
            return;
        }
        window[name] = rows;
    }

    /** Odczyt/zapis danych siatki per oś + funkcja renderu (te same co edycja). */
    var GRID_STATE = {
        rury: {
            read: function () {
                return readAxisData('products');
            },
            write: function (rows) {
                writeAxisData('products', rows);
            },
            render: 'renderPriceList'
        },
        studnie: {
            read: function () {
                return readAxisData('studnieProducts');
            },
            write: function (rows) {
                writeAxisData('studnieProducts', rows);
            },
            render: 'renderStudniePriceList'
        },
        preco: {
            read: function () {
                return readAxisData('precoPricing');
            },
            write: function (rows) {
                writeAxisData('precoPricing', rows);
            },
            render: 'renderPrecoPriceList'
        }
    };

    /** Snapshot danych siatki — powrót nie gubi niezapisanych zmian. */
    var gridSnapshot = {};

    /**
     * Tryb edycji OPUBLIKOWANEJ wersji („Edytuj” na kafelku active/historycznej):
     * zapis idzie do tej wersji, nie do szkicu. null = brak trybu.
     */
    var versionEdit = null;

    function versionEditMode(type) {
        return versionEdit && versionEdit.type === type ? versionEdit : null;
    }

    /** Po zapisie wersji serwer zwraca nowy sha — bez tego drugi zapis = 409. */
    function noteVersionSaved(type, json) {
        var mode = versionEditMode(type);
        if (mode && json && json.sha256) mode.sha256 = json.sha256;
    }

    function clearVersionEdit() {
        versionEdit = null;
    }

    /** Przywraca dane osi bez renderu — gdy siatka należy do innej zakładki. */
    function restoreGridDataOnly(type) {
        var cfg = GRID_STATE[type];
        if (!cfg || !Object.prototype.hasOwnProperty.call(gridSnapshot, type)) return;
        cfg.write(gridSnapshot[type]);
        delete gridSnapshot[type];
    }

    /** Zamyka podgląd wersji na pozostałych osiach (PRECO i studnie dzielą kontener). */
    function restoreOtherAxes(type) {
        Object.keys(GRID_STATE).forEach(function (axis) {
            if (axis !== type) restoreGridDataOnly(axis);
        });
    }

    function versionBar(type) {
        var grid = document.getElementById(EDITOR_GRID[type] || '');
        if (!grid) return null;
        var bar = document.getElementById('pv-version-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'pv-version-bar';
            bar.className = 'pv-version-bar';
            grid.parentNode.insertBefore(bar, grid);
        }
        return bar;
    }

    /** Pasek kontekstu nad siatką: która wersja, tryb i wyjście. */
    function showVersionBar(type, v, editing) {
        var bar = versionBar(type);
        if (!bar) return;
        bar.setAttribute('data-axis', type);
        var label =
            '<span class="pv-version-bar__label">' +
            (editing ? 'Edycja wersji <strong>' : 'Wersja <strong>') +
            esc(labelOf(v)) +
            '</strong> ' +
            statusBadge(stateOf(v)) +
            (editing ? ' — zapis podmienia ceny tej wersji' : ' — tylko odczyt') +
            '</span>';
        bar.innerHTML =
            label +
            '<button type="button" class="btn btn-secondary btn-sm" id="pv-version-bar-back" title="' +
            escAttr(
                editing
                    ? 'Wyjdź z edycji wersji i wróć do danych cennika na żywo'
                    : 'Wróć do edycji cennika na żywo'
            ) +
            '"><i data-lucide="pencil"></i> ' +
            (editing ? 'Zakończ edycję' : 'Wróć do edycji') +
            '</button>';
        bar.hidden = false;
        icons(bar);
        var back = bar.querySelector('#pv-version-bar-back');
        if (back) {
            back.addEventListener('click', function () {
                if (editing) exitVersionEdit(type);
                else restoreGrid(type);
            });
        }
    }

    /** Wyjście z edycji wersji: dane live wracają ze snapshotu, tryb znika. */
    function exitVersionEdit(type) {
        clearVersionEdit();
        setEditing(type, false);
        restoreGrid(type);
        syncEditor(type);
        toast('Zakończono edycję wersji', 'info');
    }

    /** Otwiera OPUBLIKOWANĄ wersję do edycji w miejscu (po ostrzeżeniu w UI). */
    async function openVersionEditor(type, v) {
        if (!document.getElementById(EDITOR_GRID[type] || '')) return;
        if (type === 'preco' && typeof window.selectCennikTab === 'function') {
            var activeTab = document.querySelector('.cennik-tab.active');
            if (!activeTab || activeTab.getAttribute('data-tab') !== 'preco') {
                window.selectCennikTab('preco');
            }
        }
        await showVersionInGrid(type, v);
        if (!Object.prototype.hasOwnProperty.call(gridSnapshot, type)) return;
        versionEdit = { type: type, id: v.id, sha256: v.sha256 || '', label: labelOf(v) };
        setEditing(type, true);
        applyEditorLock(type);
        showVersionBar(type, v, true);
        syncHeaderVersion(labelOf(v));
        syncEditor(type);
        toast('Edytujesz wersję ' + labelOf(v) + ' — zapis zmienia jej ceny', 'warning');
    }

    /** Wersja → dane siatki: ten sam plik i parser co import XLSX. */
    async function fetchVersionRows(type, id) {
        var res = await fetch(API + '/' + encodeURIComponent(id) + '/export', {
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var buffer = await res.arrayBuffer();
        if (typeof window.ensureXlsx === 'function') await window.ensureXlsx();
        var workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        var parsed = window.pricelistXlsx.parseWorkbookToJson(XLSX, workbook, {
            firstSheetOnly: type === 'rury',
            includePreco: type !== 'rury'
        });
        if (type === 'rury') {
            var ruryRows = window.pricelistXlsx.normalizeRows(
                parsed.rows,
                window.ruryImportOptions([])
            );
            GRID_STATE.rury.write(ruryRows);
            return;
        }
        var split = window.pricelistXlsx.splitStudnieImport(parsed);
        if (type === 'preco') {
            GRID_STATE.preco.write(split.precoDataMap || {});
            return;
        }
        GRID_STATE.studnie.write(
            window.pricelistXlsx.normalizeRows(split.products, window.studnieImportOptions([]))
        );
    }

    /** Pokazuje wersję w siatce edytora (bez modala i bez osobnej tabeli). */
    async function showVersionInGrid(type, v) {
        var cfg = GRID_STATE[type];
        if (!cfg || !document.getElementById(EDITOR_GRID[type] || '')) return;
        // PRECO dzieli kontener ze studniami — najpierw przełącz widoczną zakładkę.
        if (type === 'preco' && typeof window.selectCennikTab === 'function') {
            var activeTab = document.querySelector('.cennik-tab.active');
            if (!activeTab || activeTab.getAttribute('data-tab') !== 'preco') {
                window.selectCennikTab('preco');
            }
        }
        // Druga oś wraca do danych live, inaczej jej snapshot trzymałby dane wersji.
        restoreOtherAxes(type);
        if (!Object.prototype.hasOwnProperty.call(gridSnapshot, type)) {
            gridSnapshot[type] = cfg.read();
        }
        setEditing(type, false);
        try {
            await fetchVersionRows(type, v.id);
        } catch (err) {
            toast('Błąd wczytania wersji: ' + err.message, 'error');
            restoreGrid(type);
            return;
        }
        var render = /** @type {any} */ (window)[cfg.render];
        if (typeof render === 'function') render();
        applyEditorLock(type);
        showVersionBar(type, v);
        syncHeaderVersion(labelOf(v));
        watchVersionLock(type);
    }

    /* ===== Blokada siatki w trybie wersji ===== */

    var lockObserver = null;

    /** Oś aktualnie pokazywana w siatce (null = dane edytora). */
    function versionAxis() {
        var bar = document.getElementById('pv-version-bar');
        return bar && !bar.hidden ? bar.getAttribute('data-axis') : null;
    }

    function stopVersionLock() {
        if (lockObserver) {
            lockObserver.disconnect();
            lockObserver = null;
        }
    }

    /**
     * Renderer podmienia wnętrze kontenera (zmiana DN, szukajka), więc blokadę
     * trzeba nakładać po każdym renderze — stąd obserwator zamiast haków w każdym
     * rendererze. `inert` to atrybut, nie dziecko, więc nie ma pętli.
     */
    function watchVersionLock(type) {
        stopVersionLock();
        var grid = document.getElementById(EDITOR_GRID[type] || '');
        if (!grid || typeof MutationObserver !== 'function') return;
        lockObserver = new MutationObserver(function () {
            var axis = versionAxis();
            if (axis) applyEditorLock(axis);
        });
        lockObserver.observe(grid, { childList: true });
    }

    /** Zwalnia wersję osi bez renderu — gdy siatkę zaraz przejmie druga oś. */
    function releaseEditorVersion(type) {
        if (!type) return;
        stopVersionLock();
        restoreGridDataOnly(type);
        var bar = document.getElementById('pv-version-bar');
        if (bar) {
            bar.hidden = true;
            bar.innerHTML = '';
        }
        applyEditorLock(type);
    }

    /** Powrót do danych edytora (snapshot) + odblokowanie wg trybu osi. */
    function restoreGrid(type) {
        var hadSnapshot = Object.prototype.hasOwnProperty.call(gridSnapshot, type);
        clearVersionEdit();
        stopVersionLock();
        restoreGridDataOnly(type);
        if (hadSnapshot) {
            var cfg = GRID_STATE[type];
            var render = cfg ? /** @type {any} */ (window)[cfg.render] : null;
            if (typeof render === 'function') render();
        }
        var bar = document.getElementById('pv-version-bar');
        if (bar) {
            bar.hidden = true;
            bar.innerHTML = '';
            bar.removeAttribute('data-axis');
        }
        applyEditorLock(type);
        syncHeaderVersion(activeVersionLabel(type));
    }

    /** Karta = wybór wersji; akcje żyją w jednym pasku nad listą. */
    function versionCardHtml(v, type, selected) {
        var state = stateOf(v);
        var eff = v.effectiveFrom ? fmtEff(v.effectiveFrom) : '<span class="text-muted">—</span>';
        // Wiersz żyje w kontekście taba (typ znany) — bez sufiksu typu w labelce,
        // sam title/tooltip z typem. Badge poza panelem ZAWSZE z typem.
        var typeTitle = type ? ' title="Typ cennika: ' + escAttr(typeLabel(type)) + '"' : '';
        return (
            '<article class="pv-vcard' +
            (selected ? ' is-selected' : '') +
            '" data-pv-state="' +
            escAttr(state) +
            '" data-pv-select="' +
            escAttr(v.id) +
            '" role="button" tabindex="0" aria-pressed="' +
            (selected ? 'true' : 'false') +
            '">' +
            '<div class="pv-vcard__head">' +
            '<strong class="pv-vcard__label"' +
            typeTitle +
            '>' +
            esc(labelOf(v) || '—') +
            (v.labelOverride
                ? ' <span class="text-muted" title="Ręczna korekta etykiety (kanoniczna: ' +
                  escAttr(v.version || '') +
                  ')">(ręczna)</span>'
                : '') +
            '</strong>' +
            statusBadge(state) +
            '</div>' +
            '<dl class="pv-vcard__meta">' +
            '<div><dt>Obowiązuje od</dt><dd>' +
            eff +
            '</dd></div>' +
            '<div><dt>Autor</dt><dd>' +
            esc(v.createdByName || v.createdBy || '—') +
            '</dd></div>' +
            '<div><dt>Użycie</dt><dd>' +
            usedByCell(v) +
            '</dd></div>' +
            '</dl>' +
            '<div class="pv-vcard__note">' +
            noteCell(v) +
            '</div>' +
            '</article>'
        );
    }

    /** Pasek akcji: jeden komplet, aktywny dopiero po zaznaczeniu karty. */
    function actionsBarHtml(v, manageable) {
        var has = Boolean(v) && manageable === true;
        var isDraft = v ? isEditableStatus(stateOf(v)) : false;
        var canEdit = has && Boolean(v);
        var reason = v ? deleteReason(v) : null;
        var canActivate = has && Boolean(v) && stateOf(v) === 'ARCHIVED';
        var idAttr = v ? ' data-pv-id="' + escAttr(v.id) + '"' : '';
        var version = escAttr(v ? v.version || '' : '');
        var label = escAttr(v ? labelOf(v) : '');
        var note = escAttr(v ? v.note || '' : '');
        var eff = escAttr(v ? v.effectiveFrom || '' : '');
        var noSelectionHint = 'Zaznacz wersję na liście, aby użyć akcji';
        var off = function (ok) {
            return ok ? '' : ' disabled';
        };
        var tip = function (ok, okTitle, blockedTitle) {
            return escAttr(ok ? okTitle : blockedTitle || noSelectionHint);
        };
        var canOpen = has && Boolean(v);
        var canDraft = canOpen && isDraft;
        var canClone = canOpen && !isDraft;
        var canDelete = canOpen && reason === null;
        var canCancelSchedule = canOpen && stateOf(v) === 'SCHEDULED';
        return (
            '<div class="pv-version-actions__grid" role="group" aria-label="Akcje wybranej wersji">' +
            editTileHtml({
                act: true,
                idAttr: idAttr,
                version: label,
                disabled: !canEdit,
                title: canEdit
                    ? isDraft
                        ? EDIT_TILE_TITLE
                        : 'Edytuj tę opublikowaną wersję w miejscu (ostrzeżenie; zmienia jej ceny)'
                    : noSelectionHint
            }) +
            '<button type="button" class="btn btn-sm btn-secondary" data-pv-act="clone"' +
            idAttr +
            off(canClone) +
            ' title="' +
            tip(
                canClone,
                'Utwórz szkic jako kopię wybranej wersji i przejdź do edycji (obowiązująca wersja nie zmieni się)',
                'Dostępne dla wersji opublikowanej'
            ) +
            '"><i data-lucide="history"></i> Kopia jako szkic</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-pv-act="publish"' +
            idAttr +
            ' data-pv-eff="' +
            eff +
            '"' +
            off(canDraft) +
            ' title="' +
            tip(
                canDraft,
                'Wyślij roboczą na oś czasu (data przyszła = Do wdrożenia, data przeszła = korekta wsteczna z uzasadnieniem)',
                'Dostępne dla wersji roboczej (szkicu)'
            ) +
            '">Opublikuj roboczą</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-pv-act="cancel-schedule"' +
            idAttr +
            ' data-pv-version="' +
            label +
            '"' +
            off(canCancelSchedule) +
            ' title="' +
            tip(
                canCancelSchedule,
                'Anuluj zaplanowane wdrożenie — wersja wróci do szkicu i nie wejdzie w życie w zaplanowanej dacie',
                'Dostępne dla wersji zaplanowanej (Do wdrożenia)'
            ) +
            '"><i data-lucide="undo-2"></i> Anuluj wdrożenie</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-pv-act="activate"' +
            idAttr +
            ' data-pv-version="' +
            label +
            '"' +
            off(canActivate) +
            ' title="' +
            tip(
                canActivate,
                'Nowe oferty liczą ceny z tej wersji (historia i pieczątki ofert bez zmian)',
                'Dostępne dla opublikowanej wersji, która nie obowiązuje'
            ) +
            '"><i data-lucide="check-circle"></i> Ustaw jako aktywny</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-pv-act="diff"' +
            idAttr +
            off(canOpen) +
            ' title="' +
            tip(canOpen, 'Porównaj z dowolną wersją (domyślnie poprzednia)') +
            '">Porównaj</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-pv-act="label"' +
            idAttr +
            ' data-pv-label="' +
            label +
            '" data-pv-canonical="' +
            version +
            '"' +
            off(canOpen) +
            ' title="' +
            tip(
                canOpen,
                'Ręczna korekta etykiety wersji (z ostrzeżeniem; nie zmienia cen, daty obowiązywania ani pieczątek ofert)'
            ) +
            '"><i data-lucide="tag"></i> Etykieta</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-pv-act="edit-note"' +
            idAttr +
            ' data-pv-note="' +
            note +
            '"' +
            off(canDraft) +
            ' title="' +
            tip(canDraft, 'Edytuj notatki', 'Notatki edytujesz w wersji roboczej (szkicu)') +
            '"><i data-lucide="pencil"></i> Notatki</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-pv-act="delete"' +
            idAttr +
            ' data-pv-version="' +
            label +
            '"' +
            off(canDelete) +
            ' title="' +
            escAttr(
                canDelete
                    ? 'Usuwa wersję i jej pozycje (tylko wersje bez ofert i nieobowiązujące)'
                    : reason || noSelectionHint
            ) +
            '">Usuń</button>' +
            '</div>'
        );
    }

    function renderActions(type, manageable) {
        var box = document.getElementById('pv-version-actions');
        if (!box) return;
        box.innerHTML = actionsBarHtml(selectedVersion(type), manageable);
        icons(box);
    }

    function renderRows(versions, manageable, type) {
        versionsByType[type] = versions;
        if (versions.length === 0) {
            selectedVersionId[type] = null;
            return '<p class="pv-vcard-empty text-muted">Brak wersji — zapisz pierwszą powyżej.</p>';
        }
        var selectedId = resolveSelection(type, versions);
        return groupByYear(versions)
            .map(function (group) {
                var collapsed = collapsedYears[type + ':' + group.year] === true;
                return (
                    '<section class="pv-year' +
                    (collapsed ? ' is-collapsed' : '') +
                    '" data-pv-year="' +
                    escAttr(group.year) +
                    '">' +
                    '<h5 class="pv-year__title">' +
                    '<button type="button" class="pv-year__toggle" data-pv-year-toggle="' +
                    escAttr(group.year) +
                    '" aria-expanded="' +
                    (collapsed ? 'false' : 'true') +
                    '">' +
                    '<i data-lucide="chevron-down" class="pv-year__chev" aria-hidden="true"></i>' +
                    '<span>' +
                    esc(group.year) +
                    ' <span class="text-muted">(' +
                    group.versions.length +
                    ')</span></span></button></h5>' +
                    '<div class="pv-year__list">' +
                    group.versions
                        .map(function (v) {
                            return versionCardHtml(v, type, v.id === selectedId);
                        })
                        .join('') +
                    '</div>' +
                    '</section>'
                );
            })
            .join('');
    }

    function transferHtml(type) {
        var row = function (label, actions) {
            return (
                '<div class="pv-row pv-transfer-row">' +
                '<h5 class="pv-row-label">' +
                label +
                '</h5>' +
                '<div class="pv-actions">' +
                actions +
                '</div></div>'
            );
        };
        if (type === 'preco') {
            return (
                '<p class="text-muted">Import i eksport dotyczą wersji ZAZNACZONEJ na osi (a bez zaznaczenia — bieżącego szkicu). Popup pokaże numer cennika, którego dotyczy plik. Dotyczy cennika: PRECO.</p>' +
                row(
                    'PRECO (wersja z osi)',
                    '<button class="btn btn-sm btn-secondary" data-csp="exportPrecoToExcel" data-csp-args="[]" title="Eksportuj zaznaczoną wersję cennika PRECO do osobnego pliku Excel"><i data-lucide="download"></i> Eksportuj PRECO</button>' +
                        '<button class="btn btn-sm btn-secondary" data-csp="$dom" data-csp-args="[&quot;click&quot;, &quot;#pv-import-preco&quot;]" title="Importuj plik do zaznaczonej wersji cennika PRECO"><i data-lucide="upload"></i> Importuj PRECO</button>'
                ) +
                '<input type="file" id="pv-import-preco" style="display: none" accept=".xlsx,.xls" data-csp-on="change" data-csp="importPrecoFromExcel" data-csp-args="[&quot;$event&quot;]">'
            );
        }
        var isRury = type === 'rury';
        var importInput =
            '<input type="file" id="pv-import-excel" style="display: none" accept=".xlsx,.xls" data-csp-on="change" data-csp="' +
            (isRury ? 'importRuryFromExcel' : 'importStudnieProductsFromExcel') +
            '" data-csp-args="[&quot;$event&quot;]"">';
        if (isRury) {
            return (
                '<p class="text-muted">Import i eksport dotyczą wersji ZAZNACZONEJ na osi (a bez zaznaczenia — bieżącego szkicu). Popup pokaże numer cennika, którego dotyczy plik. Dotyczy cennika: Rury.</p>' +
                row(
                    'Rury (wersja z osi)',
                    '<button class="btn btn-sm btn-secondary" data-csp="exportRuryToExcel" data-csp-args="[]" title="Eksportuj zaznaczoną wersję cennika Rury do pliku Excel"><i data-lucide="download"></i> Eksportuj Rury</button>' +
                        '<button class="btn btn-sm btn-secondary" data-csp="$dom" data-csp-args="[&quot;click&quot;, &quot;#pv-import-excel&quot;]" title="Importuj plik do zaznaczonej wersji cennika Rury"><i data-lucide="upload"></i> Importuj Rury</button>'
                ) +
                importInput
            );
        }
        return (
            '<p class="text-muted">Import i eksport dotyczą wersji ZAZNACZONEJ na osi (a bez zaznaczenia — bieżącego szkicu). Popup pokaże numer cennika, którego dotyczy plik. Dotyczy cennika: Studnie.</p>' +
            row(
                'Studnie (wersja z osi)',
                '<button class="btn btn-sm btn-secondary" data-csp="exportStudnieToExcel" data-csp-args="[]" title="Eksportuj zaznaczoną wersję cennika Studnie do osobnego pliku Excel"><i data-lucide="download"></i> Eksportuj Studnie</button>' +
                    '<button class="btn btn-sm btn-secondary" data-csp="$dom" data-csp-args="[&quot;click&quot;, &quot;#pv-import-excel&quot;]" title="Importuj plik do zaznaczonej wersji cennika Studnie"><i data-lucide="upload"></i> Importuj Studnie</button>'
            ) +
            importInput
        );
    }

    /** Sekcja globalna: widoczna raz, niezależna od taba (te same funkcje). */
    function defaultsHtml() {
        return (
            '<div class="pv-actions pv-defaults-actions">' +
            '<button class="btn btn-sm btn-secondary" id="btn-save-defaults" data-csp="saveAllDefaults" data-csp-scope="parent" data-csp-args="[]" title="Zapisz bieżący stan cenników (rury, studnie, PRECO) jako domyślne"><i data-lucide="bookmark"></i> Zapisz domyślne</button>' +
            '<button class="btn btn-sm btn-secondary" data-pv-reset="rury" title="Przywróć domyślne wartości tylko cennika rur (pyta o potwierdzenie)"><i data-lucide="rotate-ccw"></i> Przywróć domyślne (Rury)</button>' +
            '<button class="btn btn-sm btn-secondary" data-pv-reset="studnie" title="Przywróć domyślne wartości tylko cennika studni (pyta o potwierdzenie)"><i data-lucide="rotate-ccw"></i> Przywróć domyślne (Studnie)</button>' +
            '<button class="btn btn-sm btn-secondary" data-pv-reset="preco" title="Przywróć domyślne wartości tylko cennika PRECO (pyta o potwierdzenie)"><i data-lucide="rotate-ccw"></i> Przywróć domyślne (PRECO)</button>' +
            '</div>' +
            '<p class="text-muted">Zapisz domyślne obejmuje wszystkie cenniki (rury, studnie, PRECO); przywrócenie dotyczy wybranego cennika.</p>'
        );
    }

    /** Typy z załadowanym modułem strony (eksport+import istnieją w window).
     *  Drugi typ chowamy zamiast wołać w próżnię (ReferenceError na obcej stronie).
     *  W #/cennik wszystkie trzy typy są osiągalne przez powłokę. */
    function availableTypes() {
        if (isCennikHost()) return ['rury', 'studnie', 'preco'];
        var out = [];
        if (
            typeof window.exportRuryToExcel === 'function' &&
            typeof window.importRuryFromExcel === 'function'
        ) {
            out.push('rury');
        }
        if (
            typeof window.exportStudnieToExcel === 'function' &&
            typeof window.importStudnieFromExcel === 'function'
        ) {
            out.push('studnie');
        }
        if (
            typeof window.collectPrecoFromUI === 'function' &&
            window.pricelistXlsx &&
            typeof window.pricelistXlsx.precoNestedToFlat === 'function'
        ) {
            out.push('preco');
        }
        if (out.length === 0) out.push('rury', 'studnie');
        return out;
    }

    function isAvailable(type) {
        return availableTypes().indexOf(type) !== -1;
    }

    /** Przełącznik typu: taby tylko dla załadowanych modułów (btn-primary, aria-pressed). */
    function tabsHtml(activeType) {
        var types = availableTypes();
        if (types.length < 2) return '';
        var labels = { rury: 'Rury', studnie: 'Studnie', preco: 'PRECO' };
        return (
            '<div class="pv-actions" role="tablist" aria-label="Typ cennika">' +
            types
                .map(function (t) {
                    var active = t === activeType;
                    return (
                        '<button type="button" role="tab" class="btn btn-sm ' +
                        (active ? 'btn-primary' : 'btn-secondary') +
                        '" data-pv-tab="' +
                        t +
                        '" aria-pressed="' +
                        (active ? 'true' : 'false') +
                        '">' +
                        labels[t] +
                        '</button>'
                    );
                })
                .join('') +
            '</div>'
        );
    }

    /** Strona hostowana przez #/cennik (iframe z ?host=cennik). */
    function isCennikHost() {
        try {
            return new URLSearchParams(window.location.search).get('host') === 'cennik';
        } catch (_e) {
            return false;
        }
    }

    /** Taby typów: w #/cennik przełączają moduł w powłoce, w modułach — lokalny typ. */
    function typeTabsHtml(activeType) {
        return tabsHtml(activeType);
    }

    /** #/cennik: przełączenie typu = zmiana iframe w powłoce SPA (parent). */
    function switchCennikType(type) {
        try {
            var w = window.parent;
            if (w && w !== window && w.CennikHost && typeof w.CennikHost.activate === 'function') {
                w.CennikHost.activate(type);
                return true;
            }
        } catch (_e) {
            /* brak dostępu do rodzica */
        }
        return false;
    }

    /** Reset domyślnych per oś — funkcje żyją w module danej osi. */
    var DEFAULTS_RESET_FNS = {
        rury: 'resetPriceList',
        studnie: 'resetStudniePriceList',
        preco: 'loadPrecoDefaults'
    };
    var DEFAULTS_RESET_LABELS = { rury: 'Rury', studnie: 'Studnie', preco: 'PRECO' };
    var DEFAULTS_RESET_TTL_MS = 15000;

    /** Przywraca domyślne tylko wybranej osi; poza jej modułem przełącza tab. */
    function requestDefaultsReset(type) {
        var fn = DEFAULTS_RESET_FNS[type];
        if (!fn) return;
        var callable = /** @type {any} */ (window)[fn];
        if (typeof callable === 'function') {
            callable();
            return;
        }
        if (isCennikHost() && switchCennikType(type)) {
            try {
                window.parent.__pvPendingDefaultsReset = { type: type, ts: Date.now() };
            } catch (_e) {
                /* brak dostępu do rodzica */
            }
            return;
        }
        toast(
            'Otwórz cennik ' +
                (DEFAULTS_RESET_LABELS[type] || type) +
                ', aby przywrócić jego domyślne',
            'info'
        );
    }

    /** Po przełączeniu osi w #/cennik dokańcza reset zlecony z innego modułu. */
    function consumePendingDefaultsReset(type) {
        try {
            var w = window.parent;
            if (!w || w === window || !w.__pvPendingDefaultsReset) return;
            var pending = w.__pvPendingDefaultsReset;
            w.__pvPendingDefaultsReset = null;
            if (pending.type !== type) return;
            if (Date.now() - (pending.ts || 0) > DEFAULTS_RESET_TTL_MS) return;
            var fn = DEFAULTS_RESET_FNS[type];
            if (!fn) return;
            var callable = /** @type {any} */ (window)[fn];
            if (typeof callable === 'function') callable();
        } catch (_e) {
            /* brak dostępu do rodzica */
        }
    }

    function dockHtml(type) {
        return (
            '<details class="pv-dock__section" open>' +
            '<summary><h4 class="pv-section">Wersje</h4></summary>' +
            '<div class="pv-dock__section-body">' +
            '<div id="pv-version-actions" class="pv-version-actions"></div>' +
            '<div id="pv-versions-body" class="pv-version-list"></div>' +
            '</div>' +
            '</details>' +
            '<details class="pv-dock__section">' +
            '<summary><h4 class="pv-section">Transfer plików</h4></summary>' +
            '<div class="pv-dock__section-body" id="pv-transfer">' +
            transferHtml(type) +
            '</div>' +
            '</details>' +
            '<details class="pv-dock__section">' +
            '<summary><h4 class="pv-section">Cenniki domyślne</h4></summary>' +
            '<div class="pv-dock__section-body">' +
            defaultsHtml() +
            '</div>' +
            '</details>' +
            '<details class="pv-dock__section" open>' +
            '<summary><h4 class="pv-section">Jak to działa</h4></summary>' +
            '<div class="pv-dock__section-body">' +
            '<button type="button" class="pv-help-tile" data-pv-act="show-help">' +
            '<i data-lucide="book-open" aria-hidden="true"></i>' +
            '<span><strong>Jak to działa — pełna instrukcja</strong>' +
            '<small>Edycja, tworzenie nowych cenników, publikacja, daty i anulowanie wdrożenia</small></span>' +
            '</button>' +
            '</div>' +
            '</details>'
        );
    }

    /**
     * Przenosi akcje siatki (Edycja/Opublikuj/Dodaj/Zapisz) z sekcji cennika
     * do stałego slotu raila. Slot żyje poza `#pv-dock-content`, więc
     * ponowny render listy wersji nie kasuje przycisków.
     */
    function mountGridActions() {
        var slot = document.querySelector('.pv-dock__pinned');
        var source = document.getElementById('pv-grid-actions');
        if (!slot || !source || slot.contains(source)) return;
        source.hidden = false;
        slot.appendChild(source);
    }

    /** Tworzy rail + backdrop raz na stronę; brak sekcji cennika = brak raila. */
    function ensureDock() {
        var dock = document.getElementById(DOCK_ID);
        if (dock) {
            mountGridActions();
            return dock;
        }
        if (!document.getElementById('section-pricelist')) return null;
        if (isCennikHost()) document.body.classList.add('pv-cennik-host');
        dock = document.createElement('aside');
        dock.id = DOCK_ID;
        dock.className = 'pv-dock';
        dock.setAttribute('role', 'complementary');
        dock.setAttribute('aria-label', 'Zarządzanie cennikami');
        dock.hidden = true;
        dock.innerHTML =
            '<div class="pv-dock__head">' +
            '<div class="pv-dock__title">' +
            '<h3 id="pv-panel-title"><i data-lucide="layers"></i> Cenniki</h3>' +
            '<p class="pv-dock__subtitle">Wersje · publikacja · pliki</p>' +
            '</div>' +
            '<button type="button" class="btn-icon pv-dock__close" aria-label="Zamknij panel" title="Zamknij panel" data-pv-act="close"><i data-lucide="x"></i></button>' +
            '</div>' +
            '<div class="pv-dock__pinned">' +
            '<div id="pv-type-tabs"></div>' +
            '<div id="pv-dock-status" class="pv-status-strip" aria-live="polite"></div>' +
            '</div>' +
            '<div id="pv-dock-content" class="pv-dock__body"></div>';
        document.body.appendChild(dock);
        mountGridActions();
        var backdrop = document.createElement('div');
        backdrop.id = DOCK_BACKDROP_ID;
        backdrop.className = 'pv-dock-backdrop';
        backdrop.hidden = true;
        backdrop.addEventListener('click', function () {
            closeVersionsPanel();
        });
        document.body.appendChild(backdrop);
        return dock;
    }

    /** Spójny stan: widoczność, klasa body, aria-expanded na przyciskach. */
    function setDockExpanded(open) {
        var dock = document.getElementById(DOCK_ID);
        var backdrop = document.getElementById(DOCK_BACKDROP_ID);
        if (dock) dock.hidden = !open;
        if (backdrop) backdrop.hidden = !open;
        document.body.classList.toggle('pv-dock-open', open);
        var buttons = document.querySelectorAll('[data-pv-dock-toggle]');
        Array.prototype.forEach.call(buttons, function (btn) {
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.classList.toggle('active', open);
        });
    }

    function closeVersionsPanel() {
        setDockExpanded(false);
    }

    function isVersionsPanelOpen() {
        var dock = document.getElementById(DOCK_ID);
        return Boolean(dock && !dock.hidden);
    }

    /** Toggle dla przycisku „Panel" (moduł i #/cennik). */
    function toggleVersionsPanel(type) {
        if (isVersionsPanelOpen()) {
            closeVersionsPanel();
            return Promise.resolve();
        }
        return openVersionsPanel(type);
    }

    /** Auto-otwarcie w #/cennik — rail jest tam jedynym lewym panelem. */
    function autoOpenVersionsPanel(type) {
        if (!isCennikHost()) return Promise.resolve();
        return openVersionsPanel(type).then(function () {
            consumePendingDefaultsReset(type);
        });
    }

    function toUtcIso(localValue) {
        // datetime-local → UTC ISO (jak guard pricelist_defaults_updated_at).
        var d = new Date(localValue);
        if (Number.isNaN(d.getTime())) throw new Error('Nieprawidłowa data');
        return d.toISOString();
    }

    async function refreshTable(type, manageable) {
        var versions = await fetchFullList(type);
        versions.sort(function (a, b) {
            return (b.seq || 0) - (a.seq || 0);
        });
        var body = document.getElementById('pv-versions-body');
        if (body) body.innerHTML = renderRows(versions, manageable, type);
        renderActions(type, manageable);
        var bar = document.getElementById('pv-version-bar');
        var previewing = bar && !bar.hidden;
        if (!previewing && (headerAxis === null || headerAxis === type)) {
            headerAxis = type;
            syncHeaderVersion(activeVersionLabel(type));
        }
        var dock = document.getElementById(DOCK_ID);
        if (dock) icons(dock);
        return versions;
    }

    /**
     * Wspólne odświeżenie po akcji na wersji: lista w railu + oba paski stanu.
     * `reloadGrid` tylko wtedy, gdy zmiana dotyczy siatki (usunięcie szkicu,
     * publikacja) — inaczej nie ruszamy niezapisanych zmian użytkownika.
     * @param {string} type
     * @param {{reloadGrid?: boolean}} [opts]
     */
    async function afterVersionChange(type, opts) {
        var o = opts || {};
        clearSummaryCache();
        broadcastActiveChange();
        // Siatka pokazywała wersję — po akcji wracamy do danych edytora.
        var bar = document.getElementById('pv-version-bar');
        if (bar && !bar.hidden) restoreGrid(type);
        try {
            await refreshTable(type, canManage[type] === true);
        } catch (e) {
            toast('Błąd odświeżenia listy: ' + e.message, 'error');
        }
        var json = await fetchSummary();
        var draft = json && json.types && json.types[type] && json.types[type].draft;
        if (!draft && isEditing(type)) setEditing(type, false);
        if (o.reloadGrid) reloadEditorGrid(type);
        await refreshStatusStrip(type);
    }

    /**
     * Modal notatek (wspólny): backdate (wymagana, min. 10), edycja notatek
     * i aktywacja (opcjonalne). opts: { required?: boolean (domyślnie true),
     * initial?: string, okText?: string }.
     */
    function openNoteModal(title, placeholder, onSubmit, opts) {
        var o = opts || {};
        var required = o.required !== false;
        var initial = typeof o.initial === 'string' ? o.initial : '';
        var okText = o.okText || 'Zatwierdź';
        window.showModal({
            id: 'pv-note-modal',
            titleId: 'pv-note-title',
            html:
                '<div class="modal"><div class="modal-header"><h3 id="pv-note-title">' +
                esc(title) +
                '</h3>' +
                '<button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;pv-note-modal&quot;]"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body"><div class="form-group"><label for="pv-note-input">Notatki ' +
                (required ? '(min. 10 znaków)' : '(opcjonalna)') +
                '</label>' +
                '<input class="form-input" id="pv-note-input" maxlength="500" placeholder="' +
                escAttr(placeholder) +
                '" value="' +
                escAttr(initial) +
                '"></div>' +
                '<div class="form-group"><button class="btn btn-primary" id="pv-note-ok">' +
                esc(okText) +
                '</button></div></div></div>'
        });
        icons(document.getElementById('pv-note-modal'));
        var input = document.getElementById('pv-note-input');
        if (required && input) {
            var counter = document.createElement('p');
            counter.className = 'text-muted';
            counter.id = 'pv-note-counter';
            input.insertAdjacentElement('afterend', counter);
            var okBtn = document.getElementById('pv-note-ok');
            var update = function () {
                var len = (input.value || '').trim().length;
                counter.textContent = len + '/10 znaków (uzasadnienie zmiany historycznej)';
                if (okBtn) okBtn.disabled = len < 10;
            };
            input.addEventListener('input', update);
            update();
        }
        document.getElementById('pv-note-ok').addEventListener('click', function () {
            var note = document.getElementById('pv-note-input').value || '';
            onSubmit(note);
        });
    }

    /** PATCH /:id/label — ręczna etykieta (null = powrót do pochodnej). */
    async function saveLabelOverride(id, label) {
        var json = await apiJson(
            API + '/' + encodeURIComponent(id) + '/label',
            authed('PATCH', { label: label })
        );
        // Badge w ofertach czytają cache etykiet — po korekcie musi się odświeżyć.
        labelCache = {};
        return json;
    }

    /**
     * Ręczna korekta etykiety wersji (admin) — jawne ostrzeżenie przed zapisem.
     * Puste pole (albo wartość równa etykiecie automatycznej) = powrót do niej.
     * Nie zmienia cen, daty obowiązywania ani pieczątek ofert.
     */
    function openLabelModal(v, type) {
        var canonical = (v && v.version) || '';
        var current = labelOf(v);
        window.showModal({
            id: 'pv-label-modal',
            titleId: 'pv-label-title',
            html:
                '<div class="modal modal--publish modal--label">' +
                '<div class="modal-header"><h3 id="pv-label-title"><i data-lucide="tag" class="icon-16-accent"></i> Ręczna korekta etykiety wersji</h3>' +
                '<button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;pv-label-modal&quot;]"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body pv-publish-body">' +
                '<p class="pv-label-warn"><strong>Uwaga:</strong> etykieta jest widoczna w ofertach, historii i eksportach. ' +
                'Korekta nie zmienia cen, daty obowiązywania ani pieczątek ofert (te trzymają id wersji), ' +
                'ale zmienia to, co widzą użytkownicy. Każda zmiana trafia do audytu.</p>' +
                '<p class="pv-publish-hint">Etykieta automatyczna: <code>' +
                esc(canonical) +
                '</code></p>' +
                '<div class="pv-publish-field"><label class="form-label" for="pv-label-input">Nowa etykieta (puste = automatyczna)</label>' +
                '<input class="pv-publish-input" id="pv-label-input" maxlength="64" value="' +
                escAttr(current) +
                '"></div>' +
                '<p class="pv-publish-hint">Dozwolone: litery, cyfry, spacja oraz znaki . _ - / (max 64 znaki).</p>' +
                '</div>' +
                '<div class="modal-footer">' +
                '<button class="btn btn-secondary" data-csp="closeModal" data-csp-args="[&quot;pv-label-modal&quot;]">Anuluj</button>' +
                '<button class="btn btn-primary" id="pv-label-ok">Zapisz etykietę</button></div>' +
                '</div>'
        });
        icons(document.getElementById('pv-label-modal'));
        var input = document.getElementById('pv-label-input');
        var ok = document.getElementById('pv-label-ok');
        if (!input || !ok) return;
        input.focus();
        input.select();
        ok.addEventListener('click', function () {
            var raw = (input.value || '').trim();
            var next = raw === '' || raw === canonical ? null : raw;
            ok.disabled = true;
            saveLabelOverride(v.id, next)
                .then(function () {
                    window.closeModal('pv-label-modal');
                    toast(
                        next === null
                            ? 'Przywrócono etykietę automatyczną (' + canonical + ')'
                            : 'Zapisano etykietę: ' + next,
                        'success'
                    );
                    return afterVersionChange(type);
                })
                .catch(function (err) {
                    ok.disabled = false;
                    toast('Błąd korekty etykiety: ' + err.message, 'error');
                });
        });
    }

    function fmtPrice(v) {
        if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
        return v.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
    }

    function diffKindLabel(c) {
        if (c.field === 'height') return (c.kind || '') + ' · prosta';
        if (c.field === 'cena') return (c.kind || '') + ' · cena';
        return c.kind || '';
    }

    function diffChangesHtml(diff) {
        var list = (diff && diff.changes) || [];
        var total = diff && typeof diff.totalChanges === 'number' ? diff.totalChanges : list.length;
        var countLine =
            '<p class="text-muted pv-diff-count">Pokazano ' +
            list.length +
            ' z ' +
            total +
            ' zmian — pełny diff dostępny w eksporcie XLSX</p>';
        if (list.length === 0) return countLine;
        var rows = list
            .map(function (c) {
                var delta =
                    c.deltaPct === null || c.deltaPct === undefined
                        ? '—'
                        : (c.deltaPct > 0 ? '+' : '') + c.deltaPct + ' %';
                return (
                    '<tr><td>' +
                    esc(c.section || '') +
                    '</td><td>' +
                    esc(c.id || '') +
                    (c.name ? '<br><span class="text-muted">' + esc(c.name) + '</span>' : '') +
                    '</td><td>' +
                    esc(diffKindLabel(c)) +
                    '</td><td class="text-right">' +
                    esc(fmtPrice(c.before)) +
                    '</td><td class="text-right">' +
                    esc(fmtPrice(c.after)) +
                    '</td><td class="text-right">' +
                    esc(delta) +
                    '</td></tr>'
                );
            })
            .join('');
        return (
            '<h4 class="pv-section">Top zmian cen (max 100, sort po |Δ%|)' +
            '</h4>' +
            countLine +
            '<div class="table-wrap"><table><thead><tr>' +
            '<th scope="col">Sekcja</th><th scope="col">Pozycja</th><th scope="col">Typ</th>' +
            '<th scope="col">Przed</th><th scope="col">Po</th><th scope="col">Δ</th>' +
            '</tr></thead><tbody>' +
            rows +
            '</tbody></table></div>'
        );
    }

    async function fetchDiff(id, againstId) {
        var url = API + '/' + encodeURIComponent(id) + '/diff';
        if (againstId) url += '?against=' + encodeURIComponent(againstId);
        return apiJson(url, authed('GET'));
    }

    function sortVersions(versions) {
        return [...versions].sort(function (a, b) {
            return (b.seq || 0) - (a.seq || 0);
        });
    }

    function diffVersionOptions(versions, selectedId, excludeId) {
        var found = false;
        var html = sortVersions(versions)
            .map(function (v) {
                if (v.id === excludeId) return '';
                var selected = v.id === selectedId;
                if (selected) found = true;
                var label =
                    (v.version || v.id) +
                    (v.status ? ' · ' + v.status : '') +
                    ' (nr ' +
                    (v.seq ?? '?') +
                    ')';
                return (
                    '<option value="' +
                    escAttr(v.id) +
                    '"' +
                    (selected ? ' selected' : '') +
                    '>' +
                    esc(label) +
                    '</option>'
                );
            })
            .join('');
        if (!found && selectedId) {
            html =
                '<option value="' +
                escAttr(selectedId) +
                '" selected>' +
                esc(selectedId) +
                '</option>' +
                html;
        }
        return html;
    }

    function diffControlsHtml(versions, currentId, againstId) {
        return (
            '<div class="pv-diff-controls" id="pv-diff-controls">' +
            '<label class="pv-diff-field"><span>Wersja</span>' +
            '<select class="form-input" data-pv-diff-select="current">' +
            diffVersionOptions(versions, currentId, null) +
            '</select></label>' +
            '<label class="pv-diff-field"><span>Porównaj z</span>' +
            '<select class="form-input" data-pv-diff-select="against">' +
            '<option value=""' +
            (againstId ? '' : ' selected') +
            '>Poprzednia (auto)</option>' +
            diffVersionOptions(versions, againstId, currentId) +
            '</select></label>' +
            '</div>'
        );
    }

    function diffBodyHtml(diff) {
        var SECTION_LABELS = {
            rury: 'Rury',
            studnie: 'Studnie',
            konfig: 'Konfiguracja',
            kinety: 'Kinety',
            zakresy: 'Zakresy'
        };
        var fromLabel = diff.from ? diff.from.version : null;
        var toLabel = diff.to ? diff.to.version : diff.version;
        var rows = Object.keys(diff.sections || {})
            .map(function (k) {
                var s = diff.sections[k];
                return (
                    '<tr><td>' +
                    esc(SECTION_LABELS[k] || k) +
                    '</td><td class="text-right">' +
                    s.added +
                    '</td><td class="text-right">' +
                    s.removed +
                    '</td><td class="text-right">' +
                    s.changed +
                    '</td></tr>'
                );
            })
            .join('');
        return (
            '<p class="text-muted pv-diff-direction">' +
            (fromLabel
                ? 'Od ' + esc(fromLabel) + ' do ' + esc(toLabel)
                : 'Brak wersji bazowej — wszystko liczone jako dodane (do ' + esc(toLabel) + ')') +
            '</p>' +
            '<div class="table-wrap"><table><thead><tr>' +
            '<th scope="col">Sekcja</th><th scope="col">Dodane</th><th scope="col">Usunięte</th><th scope="col">Zmienione</th>' +
            '</tr></thead><tbody>' +
            (rows || '<tr><td colspan="4" class="text-center text-muted">Brak zmian.</td></tr>') +
            '</tbody></table></div>' +
            diffChangesHtml(diff)
        );
    }

    function setDiffBusy(overlay, busy) {
        overlay.querySelectorAll('[data-pv-diff-select]').forEach(function (el) {
            el.disabled = busy;
        });
        var body = overlay.querySelector('#pv-diff-body');
        if (body) body.setAttribute('aria-busy', busy ? 'true' : 'false');
    }

    async function resolveVersionsForDiff(id, type) {
        if (type) {
            try {
                return await fetchFullList(type);
            } catch (e) {
                console.warn('[pricelistVersions] lista wersji do diff:', e);
                return [];
            }
        }
        var types = ['rury', 'studnie', 'preco'];
        for (var i = 0; i < types.length; i += 1) {
            try {
                var list = await fetchFullList(types[i]);
                if (
                    list.some(function (v) {
                        return v.id === id;
                    })
                ) {
                    return list;
                }
            } catch (e2) {
                console.warn('[pricelistVersions] lista wersji do diff (' + types[i] + '):', e2);
            }
        }
        return [];
    }

    async function openDiff(id, againstId, type) {
        var diff;
        try {
            diff = await fetchDiff(id, againstId);
        } catch (e) {
            toast('Błąd porównania: ' + e.message, 'error');
            return;
        }
        var versions = await resolveVersionsForDiff(id, type);
        if (versions.length === 0) {
            versions = [diff.to, diff.from].filter(Boolean);
        }
        var selectedAgainst = againstId && againstId !== id ? againstId : '';
        window.showModal({
            id: 'pv-diff-modal',
            titleId: 'pv-diff-title',
            html:
                '<div class="modal modal--pv-diff"><div class="modal-header"><h3 id="pv-diff-title"><i data-lucide="arrow-right-left"></i> Porównanie wersji cennika</h3>' +
                '<button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;pv-diff-modal&quot;]"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body">' +
                diffControlsHtml(versions, id, selectedAgainst) +
                '<div id="pv-diff-body">' +
                diffBodyHtml(diff) +
                '</div></div></div>'
        });
        var overlay = document.getElementById('pv-diff-modal');
        icons(overlay);
        if (!overlay) return;
        overlay.addEventListener('change', function (ev) {
            var select =
                ev.target && ev.target.closest ? ev.target.closest('[data-pv-diff-select]') : null;
            if (!select || !overlay.contains(select)) return;
            var currentSelect = overlay.querySelector('[data-pv-diff-select="current"]');
            var againstSelect = overlay.querySelector('[data-pv-diff-select="against"]');
            if (!currentSelect || !againstSelect) return;
            var nextId = currentSelect.value;
            var nextAgainst = againstSelect.value;
            if (nextAgainst === nextId) nextAgainst = '';
            var controls = overlay.querySelector('#pv-diff-controls');
            if (controls) {
                controls.innerHTML = diffControlsHtml(versions, nextId, nextAgainst);
                icons(controls);
            }
            var body = overlay.querySelector('#pv-diff-body');
            if (body) {
                body.innerHTML =
                    '<p class="text-muted pv-diff-direction">Ładowanie porównania…</p>';
            }
            setDiffBusy(overlay, true);
            fetchDiff(nextId, nextAgainst)
                .then(function (nextDiff) {
                    var target = overlay.querySelector('#pv-diff-body');
                    if (target) {
                        target.innerHTML = diffBodyHtml(nextDiff);
                        icons(target);
                    }
                })
                .catch(function (err) {
                    toast('Błąd porównania: ' + err.message, 'error');
                    var target = overlay.querySelector('#pv-diff-body');
                    if (target) {
                        target.innerHTML =
                            '<p class="color-warn">Nie udało się wczytać porównania.</p>';
                    }
                })
                .finally(function () {
                    if (document.getElementById('pv-diff-modal')) setDiffBusy(overlay, false);
                });
        });
    }

    /** Przeładowanie formularza (next seq) + transferu + tabeli po zmianie taba. */
    async function switchType(newType, state) {
        state.current = newType;
        var tabs = document.getElementById('pv-type-tabs');
        if (tabs) {
            tabs.innerHTML = typeTabsHtml(newType);
            icons(tabs);
        }
        var manageable = canManage[newType] === true;
        var transfer = document.getElementById('pv-transfer');
        if (transfer) {
            transfer.innerHTML = transferHtml(newType);
            icons(transfer);
        }
        try {
            await refreshTable(newType, manageable);
        } catch (e) {
            toast('Błąd odświeżenia: ' + e.message, 'error');
        }
        // Pasek w railu opisuje typ wybrany w railu (bez przestawiania osi siatki).
        if (document.getElementById('pv-dock-status')) {
            renderStatusStrip('pv-dock-status', newType).catch(function () {
                /* pasek jest dodatkiem */
            });
        }
    }

    /**
     * Globalny panel wersji: jeden panel z tabami [Rury|Studnie|PRECO].
     * @param {string} type 'rury' | 'studnie' | 'preco' (preselekcja taba)
     */
    async function openVersionsPanel(type) {
        // Preselekcja tylko załadowanego modułu — inaczej fallback na pierwszy dostępny.
        if (!isAvailable(type)) type = availableTypes()[0];
        var dock = ensureDock();
        if (!dock) return;
        var manageable = canManage[type] === true;
        dockState.type = type;
        var tabs = document.getElementById('pv-type-tabs');
        if (tabs) {
            tabs.innerHTML = typeTabsHtml(type);
            icons(tabs);
        }
        var content = document.getElementById('pv-dock-content');
        if (content) content.innerHTML = dockHtml(type);
        setDockExpanded(true);
        icons(dock);
        wirePanel(dock, type);
        refreshTable(type, manageable).catch(function (e) {
            toast('Błąd odświeżenia: ' + e.message, 'error');
        });
        renderStatusStrip('pv-dock-status', type).catch(function () {
            /* pasek jest dodatkiem — brak /summary nie blokuje panelu */
        });
        return dock;
    }

    /** Zmiana zaznaczenia bez refetchu: karty + pasek akcji. */
    function rerenderCards(type) {
        var manageable = canManage[type] === true;
        var body = document.getElementById('pv-versions-body');
        if (body) body.innerHTML = renderRows(versionsByType[type] || [], manageable, type);
        renderActions(type, manageable);
        var dock = document.getElementById(DOCK_ID);
        if (dock) icons(dock);
    }

    function wirePanel(overlay, initialType) {
        var host = /** @type {any} */ (overlay);
        if (!host.__pvState) host.__pvState = { current: initialType };
        var state = host.__pvState;
        state.current = initialType;
        // Rail jest trwały — listenery wieszamy raz, nie po każdym renderze.
        if (host.__pvWired) return;
        host.__pvWired = true;
        overlay.addEventListener('click', function (e) {
            var yearToggle =
                e.target && e.target.closest ? e.target.closest('[data-pv-year-toggle]') : null;
            if (yearToggle) {
                var year = yearToggle.getAttribute('data-pv-year-toggle');
                var group = yearToggle.closest('.pv-year');
                if (year && group) {
                    var key = state.current + ':' + year;
                    var nextCollapsed = !group.classList.contains('is-collapsed');
                    collapsedYears[key] = nextCollapsed;
                    group.classList.toggle('is-collapsed', nextCollapsed);
                    yearToggle.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
                }
                return;
            }
            var resetBtn =
                e.target && e.target.closest ? e.target.closest('[data-pv-reset]') : null;
            if (resetBtn) {
                requestDefaultsReset(resetBtn.getAttribute('data-pv-reset'));
                return;
            }
            var tab = e.target && e.target.closest ? e.target.closest('[data-pv-tab]') : null;
            if (tab) {
                var next = tab.getAttribute('data-pv-tab');
                if (next && next !== state.current && isAvailable(next)) {
                    // #/cennik: typ = inny moduł w powłoce, nie lokalny render.
                    if (isCennikHost() && switchCennikType(next)) return;
                    switchType(next, state).catch(function (err) {
                        toast('Błąd przełączania typu: ' + err.message, 'error');
                    });
                }
                return;
            }
            var card = e.target && e.target.closest ? e.target.closest('[data-pv-select]') : null;
            if (card) {
                var picked = card.getAttribute('data-pv-select');
                if (!picked) return;
                // Klik w już zaznaczony kafelek też pokazuje wersję — inaczej jedyna
                // wersja na osi (np. PRECO z samym ACTIVE) nie da się obejrzeć.
                if (picked !== selectedVersionId[state.current]) {
                    selectedVersionId[state.current] = picked;
                    rerenderCards(state.current);
                }
                openSelectedPreview(state.current);
                return;
            }
            var btn = e.target && e.target.closest ? e.target.closest('[data-pv-act]') : null;
            if (!btn) return;
            var type = state.current;
            var act = btn.getAttribute('data-pv-act');
            var id = btn.getAttribute('data-pv-id');
            if (act === 'close') closeVersionsPanel();
            else if (act === 'show-help') openHelpDialog();
            else if (act === 'edit') openVersionOrDraft(type);
            else if (act === 'diff' && id) openDiff(id, null, type);
            else if (act === 'label' && id) {
                var canonical = btn.getAttribute('data-pv-canonical') || '';
                var shown = btn.getAttribute('data-pv-label') || canonical;
                openLabelModal(
                    {
                        id: id,
                        version: canonical,
                        labelOverride: shown === canonical ? null : shown
                    },
                    type
                );
            } else if (act === 'publish' && id) {
                openPublishDialog(type, id);
            } else if (act === 'cancel-schedule' && id) {
                var scheduledName = btn.getAttribute('data-pv-version') || id;
                pvConfirm(
                    'Anulować wdrożenie wersji ' +
                        scheduledName +
                        '? Wersja wróci do szkicu i nie wejdzie w życie w zaplanowanej dacie.',
                    { title: 'Anuluj wdrożenie', okText: 'Anuluj wdrożenie', type: 'warning' }
                ).then(function (ok) {
                    if (!ok) return;
                    apiJson(API + '/' + encodeURIComponent(id) + '/cancel-schedule', authed('POST'))
                        .then(function () {
                            toast('Anulowano wdrożenie ' + scheduledName, 'success');
                            afterVersionChange(type, { reloadGrid: true });
                        })
                        .catch(function (err) {
                            toast(friendlyError('Błąd anulowania wdrożenia', err), 'error');
                        });
                });
            } else if (act === 'edit-note' && id) {
                openNoteModal(
                    'Edytuj notatki',
                    'Notatki (max 500 znaków, pustka czyści)…',
                    function (note) {
                        apiJson(API + '/' + encodeURIComponent(id), authed('PUT', { note: note }))
                            .then(function () {
                                window.closeModal('pv-note-modal');
                                toast('Notatki zapisane', 'success');
                                afterVersionChange(type);
                            })
                            .catch(function (err) {
                                toast('Błąd zapisu notatek: ' + err.message, 'error');
                            });
                    },
                    {
                        required: false,
                        initial: btn.getAttribute('data-pv-note') || '',
                        okText: 'Zapisz'
                    }
                );
            } else if (act === 'clone' && id) {
                var doClone = function () {
                    apiJson(API + '/' + encodeURIComponent(id) + '/clone-draft', authed('POST'))
                        .then(function (json) {
                            var v = json.version || {};
                            openEditorFor(type, v.version, true);
                        })
                        .catch(function (err) {
                            toast(friendlyError('Błąd klonowania', err), 'error');
                        });
                };
                var cloneMsg =
                    'Utworzyć wersję roboczą jako kopię tej wersji i przejść do jej edycji? Aktywna wersja nie zmieni się.';
                pvConfirm(cloneMsg, {
                    title: 'Utwórz kopię jako szkic',
                    okText: 'Utwórz i edytuj',
                    type: 'warning'
                }).then(function (ok) {
                    if (ok) doClone();
                });
            } else if (act === 'activate' && id) {
                var activateMsg =
                    'Ustawić ' +
                    (btn.getAttribute('data-pv-version') || id) +
                    ' jako obowiązujący cennik? Nowe oferty będą liczyć ceny z tej wersji, a dotychczasowe oferty zachowają swoje ceny.';
                pvConfirm(activateMsg, {
                    title: 'Ustaw jako aktywny',
                    okText: 'Ustaw',
                    type: 'warning'
                }).then(function (ok) {
                    if (!ok) return;
                    apiJson(API + '/' + encodeURIComponent(id) + '/active', authed('POST'))
                        .then(function () {
                            toast('Cennik obowiązujący zmieniony', 'success');
                            afterVersionChange(type, { reloadGrid: true });
                        })
                        .catch(function (err) {
                            toast(friendlyError('Błąd zmiany cennika', err), 'error');
                        });
                });
            } else if (act === 'delete' && id) {
                var versionName = btn.getAttribute('data-pv-version') || id;
                var doDelete = function () {
                    var wasEdited = false;
                    Promise.resolve(draftRef(type))
                        .then(function (ref) {
                            wasEdited = Boolean(ref && ref.id === id);
                            return apiJson(API + '/' + encodeURIComponent(id), authed('DELETE'));
                        })
                        .then(function () {
                            toast('Wersja ' + versionName + ' usunięta', 'success');
                            if (wasEdited) setEditing(type, false);
                            return afterVersionChange(type, { reloadGrid: wasEdited });
                        })
                        .catch(function (err) {
                            toast(friendlyError('Błąd usuwania', err), 'error');
                        });
                };
                var deleteMsg =
                    'Usunąć wersję ' +
                    versionName +
                    ' wraz z jej pozycjami? Usunięcie jest trwałe.';
                pvConfirm(deleteMsg, {
                    title: 'Usuń wersję',
                    okText: 'Usuń',
                    type: 'danger'
                }).then(function (ok) {
                    if (ok) doDelete();
                });
            }
        });
        // Karta to role="button" — Enter/Spacja zaznaczają jak klik.
        overlay.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var card = e.target && e.target.closest ? e.target.closest('[data-pv-select]') : null;
            if (!card) return;
            e.preventDefault();
            card.click();
        });
    }

    /**
     * Pasek stanu w edytorze cennika (rury/studnie/preco): co admin edytuje
     * (szkic) vs co liczy oferta (wersja obowiązująca) + tryb edycji.
     * Read-only; dla nie-admina (403) pasek zostaje pusty. Jeden fetch /summary
     * na kilka wywołań — akcje unieważniają cache (clearSummaryCache).
     */
    var summaryCache = null;

    /** Referencja szkicu per typ (id + sha256) — `If-Match` i cel importu XLSX. */
    var draftRefs = {};

    function trackDraftRefs(json) {
        var types = (json && json.types) || {};
        Object.keys(TYPE_PREFIX).forEach(function (t) {
            draftRefs[t] = (types[t] && types[t].draft) || null;
        });
    }

    /** Po klonie/publikacji zmienia się summary i etykiety - czyścimy oba cache. */
    function clearSummaryCache() {
        summaryCache = null;
        labelCache = {};
        activeIdsByType = {};
        draftRefs = {};
    }

    /** Klucz sygnału „zmieniono obowiązujący cennik” między oknami/iframe. */
    var ACTIVE_PING_KEY = 'pv-active-changed';

    /** Rozgłoś zmianę aktywnego cennika — inne okna mają własny cache etykiet. */
    function broadcastActiveChange() {
        try {
            window.localStorage.setItem(ACTIVE_PING_KEY, String(Date.now()));
        } catch (_e) {
            // Brak storage (tryb prywatny) — inne okna odświeżą się po reloadzie.
        }
    }

    // Zmiana pinu w #/cennik nie unieważnia cache modułu rury/studnie (osobny
    // window). Bez tego banner proponuje nieaktualny cennik, a zapis bije 409.
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', function (e) {
            if (!e || e.key !== ACTIVE_PING_KEY) return;
            clearSummaryCache();
        });
    }

    function fetchSummary() {
        if (!summaryCache) {
            summaryCache = apiJson('/api/pricelist-versions/summary', authed('GET'))
                .then(function (json) {
                    trackDraftRefs(json);
                    return json;
                })
                .catch(function () {
                    summaryCache = null;
                    return null;
                });
        }
        return summaryCache;
    }

    /** Szkic typu z summary albo null (brak szkicu / brak sieci). */
    async function draftRef(type) {
        var t = type || editorType;
        if (!(t in draftRefs)) await fetchSummary();
        return draftRefs[t] || null;
    }

    /**
     * Nagłówki warunkowego zapisu szkicu. Brak znanego sha = brak `If-Match`
     * (serwer przyjmie zapis — starszy klient nie jest blokowany).
     */
    async function draftHeaders(type) {
        var mode = versionEditMode(type);
        if (mode) {
            // Jawna edycja opublikowanej wersji: serwer podmienia jej wiersze.
            return {
                'If-Match': '"' + mode.sha256 + '"',
                'X-Pricelist-Version-Id': mode.id
            };
        }
        var ref = await draftRef(type);
        return ref && ref.sha256 ? { 'If-Match': '"' + ref.sha256 + '"' } : {};
    }

    function stripDate(iso) {
        try {
            return new Date(iso).toLocaleDateString('pl-PL');
        } catch (_e) {
            return iso || '';
        }
    }

    function stripDateTime(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleString('pl-PL', {
                dateStyle: 'short',
                timeStyle: 'short'
            });
        } catch (_e) {
            return iso;
        }
    }

    /** ` · zmiana 22.10.2026, 14:03` — adnotacja „kiedy ostatnio edytowany". */
    function lastChange(ref) {
        return ref && ref.updatedAt ? ' · zmiana ' + stripDateTime(ref.updatedAt) : '';
    }

    /* ===== TRYB EDYCJI (podgląd ↔ edycja szkicu) ===== */

    var STRIP_HOST_ID = 'pricelist-status-strip';
    /** Oś aktualnie wyświetlana w cenniku (PRECO dzieli kontener ze studniami). */
    var editorType = 'rury';
    /** Tryb edycji per oś: false = podgląd (siatka zablokowana), true = edycja szkicu. */
    var editModes = { rury: false, studnie: false, preco: false };
    var EDITOR_GRID = {
        rury: 'pricelist-body',
        studnie: 'studnie-pricelist-body',
        preco: 'studnie-pricelist-body'
    };
    var EDITOR_SAVE = {
        rury: 'btn-save-pricelist',
        studnie: 'btn-save-studnie-pricelist',
        preco: 'btn-save-preco'
    };

    function isEditing(type) {
        return editModes[type] === true;
    }

    function setEditing(type, on) {
        var next = on === true;
        if (editModes[type] === next) return;
        editModes[type] = next;
        // Pasek stanu pokazuje „TRYB EDYCJI" + oś — musi się przerysować od razu,
        // także przy wejściu/wyjściu z edycji opublikowanej wersji.
        refreshStatusStrip(type);
    }

    /** Etykieta wersji edytowanej w miejscu (null = szkic/podgląd). */
    function versionEditLabel(type) {
        var mode = versionEditMode(type);
        return mode ? mode.label : null;
    }

    /** Krótka nazwa osi w pasku stanu — użytkownik ma widzieć, KTÓRY cennik edytuje. */
    var TYPE_SHORT = { rury: 'Rury', studnie: 'Studnie', preco: 'PRECO' };

    /**
     * Cel importu/eksportu = wersja ZAZNACZONA na osi; bez zaznaczenia bieżący
     * szkic, a bez szkicu wersja obowiązująca. Null = brak jakiejkolwiek wersji.
     */
    async function transferVersion(type) {
        var picked = selectedVersion(type);
        if (picked) return picked;
        var json = await fetchSummary();
        var data = (json && json.types && json.types[type]) || {};
        return data.draft || data.active || null;
    }

    /** Popup przed transferem: JAKI cennik i co dokładnie się z nim stanie. */
    function transferConfirm(kind, type, v) {
        var axis = TYPE_SHORT[type] || type;
        var label = labelOf(v);
        var state = stateOf(v);
        var what =
            state === 'DRAFT'
                ? 'szkic'
                : state === 'ACTIVE'
                  ? 'wersję obowiązującą'
                  : state === 'SCHEDULED'
                    ? 'wersję zaplanowaną'
                    : 'wersję historyczną';
        var msg =
            kind === 'export'
                ? 'Eksport cennika ' +
                  axis +
                  ' — ' +
                  what +
                  ' ' +
                  label +
                  '. Plik XLSX będzie zawierał pozycje tej wersji wraz z jej numerem.'
                : 'Import do cennika ' +
                  axis +
                  ' — ' +
                  what +
                  ' ' +
                  label +
                  '. Wiersze z pliku trafią do siatki tej wersji, a „Zapisz” podmieni jej ceny.';
        if (kind !== 'export' && state !== 'DRAFT') {
            msg += ' To zmienia OPUBLIKOWANĄ wersję — istniejące oferty zachowają swoje pieczątki.';
        }
        return pvConfirm(msg, {
            title: (kind === 'export' ? 'Eksport cennika ' : 'Import do cennika ') + label,
            okText: kind === 'export' ? 'Eksportuj' : 'Importuj',
            type: kind === 'export' ? undefined : 'warning'
        });
    }

    /** Pobranie XLSX konkretnej wersji (serwer nazywa plik numerem cennika). */
    async function exportVersionXlsx(type, v) {
        var res = await fetch(API + '/' + encodeURIComponent(v.id) + '/export', {
            headers: typeof window.authHeaders === 'function' ? window.authHeaders() : {}
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var blob = await res.blob();
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = downloadNameFrom(
            res,
            'Cennik_' + (TYPE_SHORT[type] || type) + '_' + labelOf(v) + '.xlsx'
        );
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 1000);
        return a.download;
    }

    /**
     * Wejście w edycję KONKRETNEJ wersji bez podmiany siatki — import z pliku
     * sam wypełnia siatkę, a „Zapisz” trafia do tej wersji (X-Pricelist-Version-Id).
     * Szkic nie idzie przez nagłówek wersji (serwer podmienia tylko opublikowane).
     */
    function enterVersionEditForImport(type, v) {
        if (!document.getElementById(EDITOR_GRID[type] || '')) return false;
        restoreOtherAxes(type);
        var cfg = GRID_STATE[type];
        if (cfg && !Object.prototype.hasOwnProperty.call(gridSnapshot, type)) {
            gridSnapshot[type] = cfg.read();
        }
        versionEdit = isEditableStatus(stateOf(v))
            ? null
            : { type: type, id: v.id, sha256: v.sha256 || '', label: labelOf(v) };
        setEditing(type, true);
        applyEditorLock(type);
        showVersionBar(type, v, true);
        syncHeaderVersion(labelOf(v));
        syncEditor(type);
        return true;
    }

    /** Wspólny stan przycisku zapisu osi: cel, etykieta i tooltip. */
    function saveButtonMeta(type) {
        var editing = isEditing(type);
        var versionLabel = versionEditLabel(type);
        var isDraft = window.__pricelistWriteTarget === 'draft';
        // Etykieta zawsze „Zapisz" — cel (szkic/wersja) wynika z tooltipa i badge.
        var label = 'Zapisz';
        var title;
        if (!editing) {
            title = 'Najpierw wejdź w edycję: „Edytuj” w panelu wersji';
        } else if (versionLabel) {
            title = 'Zapis podmienia ceny wersji ' + versionLabel + ' — bez tworzenia nowej wersji';
        } else if (isDraft) {
            title = 'Zapis tworzy lub aktualizuje szkic; publikacja w panelu wersji';
        } else {
            title = 'Zapisz zmiany w cenniku';
        }
        return { editing: editing, versionLabel: versionLabel, label: label, title: title };
    }

    /**
     * Podgląd = siatka `inert` (blokuje mysz, fokus i Tab), wyłączony „Zapisz"
     * i „Dodaj". Przycisk zapisu zostaje widoczny, żeby zawsze było jasne,
     * gdzie zapisać edytowany cennik — w podglądzie jest tylko wyszarzony.
     * PRECO: `inert` idzie na rozwinięcia accordionów, nie na całą siatkę —
     * inaczej nie da się rozwinąć DN i podejrzeć cen w podglądzie.
     */
    function applyEditorLock(type) {
        var editing = isEditing(type);
        var grid = document.getElementById(EDITOR_GRID[type] || '');
        if (grid) {
            var sections = grid.querySelectorAll('.preco-accordion-body');
            Array.prototype.forEach.call(sections, function (el) {
                el.inert = !editing;
            });
            grid.inert = !editing && sections.length === 0;
            // Obrys siatki = ten sam sygnał co pasek „TRYB EDYCJI".
            grid.setAttribute('data-pv-editing', editing ? '1' : '0');
        }
        var saveBtn = document.getElementById(EDITOR_SAVE[type] || '');
        if (saveBtn) {
            saveBtn.classList.remove('hidden');
            saveBtn.disabled = !editing;
        }
        var actions = document.getElementById('pv-grid-actions');
        if (actions) actions.setAttribute('data-axis', type);
        // Etykieta zależy od celu zapisu (szkic / opublikowana wersja) — helper osi.
        if (type === 'preco') {
            if (typeof window.updatePrecoSaveBtn === 'function') window.updatePrecoSaveBtn();
        } else if (type === 'studnie') {
            if (typeof window.updateStudnieSaveBtn === 'function') window.updateStudnieSaveBtn();
        } else if (typeof window.updateSaveBtn === 'function') {
            window.updateSaveBtn();
        }
    }

    function modeBtn(act, label, title) {
        return (
            '<button type="button" class="btn btn-secondary" data-pv-mode="' +
            act +
            '" title="' +
            escAttr(title) +
            '">' +
            esc(label) +
            '</button>'
        );
    }

    /**
     * Kafelek „Edytuj" — JEDEN builder dla sekcji wersji i paska trybu edycji.
     * Ten sam markup, ikona i etykieta; różni się tylko atrybutem akcji
     * (`data-pv-act` w panelu, `data-pv-mode` w edytorze) i stanem disabled.
     * @param {{act?: boolean, idAttr?: string, version?: string, disabled?: boolean, title: string}} o
     */
    function editTileHtml(o) {
        return (
            '<button type="button" class="btn btn-sm btn-secondary" ' +
            (o.act ? 'data-pv-act="edit"' : 'data-pv-mode="edit"') +
            (o.idAttr || '') +
            (o.version ? ' data-pv-version="' + escAttr(o.version) + '"' : '') +
            (o.disabled ? ' disabled' : '') +
            ' title="' +
            escAttr(o.title) +
            '"><i data-lucide="pencil"></i> Edytuj</button>'
        );
    }

    /** Tooltip kafelka „Edytuj" — wspólny dla panelu i paska trybu. */
    var EDIT_TILE_TITLE =
        'Przejdź do edytora cennika — zapis trafia do tego szkicu (LIVE bez zmian)';

    /** Pasek akcji cennika: kopia → edycja (publikacja jest w akcjach wersji na osi). */
    function editorActionsHtml(type, data) {
        var draft = data.draft || null;
        var active = data.active || null;
        var out = [];
        if (isEditing(type)) {
            out.push(
                modeBtn(
                    'cancel',
                    'Anuluj edycję',
                    'Wyjdź z edycji szkicu; niezapisane zmiany zostaną odrzucone'
                )
            );
        } else if (draft) {
            // Kopia kafelka z sekcji wersji — ten sam builder i ta sama akcja.
            out.push(editTileHtml({ title: EDIT_TILE_TITLE }));
        } else if (active) {
            out.push(
                modeBtn(
                    'copy',
                    'Utwórz kopię jako szkic',
                    'Utwórz szkic z obowiązującego cennika; wersja obowiązująca bez zmian'
                )
            );
        }
        return out.join(' ');
    }

    /**
     * Odświeża pasek akcji + blokadę siatki dla osi. Wołane po wejściu w cennik,
     * po zmianie zakładki i po każdej akcji (zapis/klon/publikacja/anulowanie).
     */
    async function syncEditor(type, json) {
        var t = type || editorType;
        editorType = t;
        var data;
        if (json) {
            data = (json.types || {})[t] || {};
        } else {
            var fetched = await fetchSummary();
            data = fetched ? (fetched.types || {})[t] || {} : {};
        }
        var host = document.getElementById('pv-mode-actions');
        if (host) {
            host.innerHTML = editorActionsHtml(t, data);
            icons(host);
        }
        applyEditorLock(t);
        return data;
    }

    /** Ponowne wczytanie siatki z serwera (anulowanie edycji bez zapisu). */
    function reloadEditorGrid(type) {
        if (type === 'rury') {
            // Pełne odświeżenie sekcji cennika (dane + render) — jedno źródło prawdy.
            if (typeof window.showSection === 'function') {
                window.showSection('pricelist');
                return;
            }
            if (typeof window.loadProducts === 'function') window.loadProducts();
            return;
        }
        if (type === 'preco') {
            if (typeof window.loadPrecoPricing === 'function') {
                window.loadPrecoPricing({ source: 'draft' }).then(function () {
                    if (typeof window.renderPrecoPriceList === 'function') {
                        window.renderPrecoPriceList();
                    }
                });
            }
            return;
        }
        if (typeof window.refreshStudnieData === 'function') window.refreshStudnieData();
    }

    async function renderStatusStrip(hostId, type) {
        var host = document.getElementById(hostId);
        var stripType = type || editorType;
        // Pasek w module opisuje siatkę; pasek raila w #/cennik jest jedynym
        // źródłem stanu i steruje blokadą. W module nie przestawia osi siatki.
        var drivesEditor = hostId !== 'pv-dock-status' || isCennikHost();
        if (drivesEditor) editorType = stripType;
        var json = await fetchSummary();
        if (host) {
            if (!json) {
                host.innerHTML = '';
                host.setAttribute('data-editing', '0');
            } else {
                var data = (json.types || {})[stripType] || {};
                var axis = TYPE_SHORT[stripType] || stripType;
                var editing = isEditing(stripType);
                // Oś zawsze widoczna — pasek musi mówić, KTÓREGO cennika dotyczy.
                host.setAttribute('data-editing', editing ? '1' : '0');
                var parts = [
                    '<span class="badge badge-muted" title="Oś cennika w tym edytorze">' +
                        esc(axis) +
                        '</span>'
                ];
                // Tryb edycji: wyraźny pasek, bo zapis idzie do wersji/szkicu,
                // a nie do ofert. Podgląd nie dostaje tego banera.
                if (editing) {
                    var editMode = versionEditMode(stripType);
                    var target = editMode
                        ? 'zapis podmienia ceny wersji <strong>' +
                          esc(editMode.label) +
                          '</strong> (bez tworzenia nowej wersji)'
                        : data.draft
                          ? 'zmiany idą do szkicu <strong>' +
                            esc(data.draft.version) +
                            '</strong> — oferty liczą z obowiązującego cennika'
                          : 'zapis utworzy szkic obowiązujący po publikacji';
                    parts.push(
                        '<div class="pv-edit-banner" role="status">✎ TRYB EDYCJI · ' +
                            esc(axis) +
                            ' — ' +
                            target +
                            '</div>'
                    );
                }
                // A5: siatka pokazuje szkic, nie cennik obowiązujący — musi to być widoczne.
                if (data.draft) {
                    parts.push(
                        '<div class="pv-draft-banner">⚠ Siatka pokazuje szkic <strong>' +
                            esc(data.draft.version) +
                            '</strong>' +
                            (data.active
                                ? ' — oferty liczą z obowiązującej ' + esc(data.active.version)
                                : ' — brak wersji obowiązującej') +
                            '</div>'
                    );
                }
                // Rollback PRICELIST_WRITE_TARGET=live: zapis omija wersje (split-brain).
                if (window.__pricelistWriteTarget === 'live') {
                    parts.push(
                        '<span class="badge badge-warn" title="PRICELIST_WRITE_TARGET=live — zapis idzie do tabel LIVE, oferty czytają wersję obowiązującą.">⚠ Tryb zapisu LIVE</span>'
                    );
                }
                if (data.draft) {
                    parts.push(
                        '<span class="badge badge-muted" title="Szkic nie trafia do ofert do publikacji.">✎ Szkic ' +
                            esc(data.draft.version) +
                            esc(lastChange(data.draft)) +
                            '</span>'
                    );
                }
                if (data.active) {
                    parts.push(
                        '<span class="badge badge-ok" title="Obowiązuje oferty; zmiany w edytorze nie ruszają ofert do publikacji.">✓ Obowiązuje ' +
                            esc(data.active.version) +
                            ' (od ' +
                            esc(stripDate(data.active.effectiveFrom)) +
                            ')' +
                            esc(lastChange(data.active)) +
                            '</span>'
                    );
                } else {
                    parts.push('<span class="badge badge-muted">brak wersji obowiązującej</span>');
                }
                if (data.nextScheduled) {
                    parts.push(
                        '<span class="badge badge-info">◷ Do wdrożenia ' +
                            esc(data.nextScheduled.version) +
                            ' (od ' +
                            esc(stripDate(data.nextScheduled.effectiveFrom)) +
                            ')</span>'
                    );
                }
                host.innerHTML = parts.join(' ');
            }
        }
        return drivesEditor ? syncEditor(stripType, json) : undefined;
    }

    /** Odświeżenie paska + akcji po zapisie (bez przeładowania strony). */
    function refreshStatusStrip(type) {
        clearSummaryCache();
        var gridType = editorType;
        var dockType = type || gridType;
        var jobs = [renderStatusStrip(STRIP_HOST_ID, gridType)];
        if (document.getElementById('pv-dock-status')) {
            jobs.push(renderStatusStrip('pv-dock-status', dockType));
        }
        return Promise.all(jobs);
    }

    /* ===== AKCJE: kopia → edycja → publikacja ===== */

    var PAST_NOTE_MIN = 10;

    function toLocalInput(date) {
        var d = date || new Date();
        var pad = function (n) {
            return String(n).padStart(2, '0');
        };
        return (
            d.getFullYear() +
            '-' +
            pad(d.getMonth() + 1) +
            '-' +
            pad(d.getDate()) +
            'T' +
            pad(d.getHours()) +
            ':' +
            pad(d.getMinutes())
        );
    }

    /** „Utwórz kopię jako szkic" — kopia ACTIVE; nie tworzy drugiego szkicu. */
    async function createDraftCopy(type) {
        var t = type || editorType;
        var json = await fetchSummary();
        var data = json ? (json.types || {})[t] || {} : {};
        if (data.draft) {
            setEditing(t, true);
            await syncEditor(t, json);
            toast('Szkic ' + data.draft.version + ' już istnieje — edytujesz go', 'info');
            return;
        }
        if (!data.active) {
            toast('Brak wersji obowiązującej — najpierw zapisz cennik', 'warning');
            return;
        }
        try {
            var res = await apiJson(
                API + '/' + encodeURIComponent(data.active.id) + '/clone-draft',
                authed('POST')
            );
            var created = (res && res.version) || {};
            setEditing(t, true);
            // Ta sama ścieżka co inne akcje na wersjach: lista w railu + siatka
            // z DRAFT. Bez tego karta nowego szkicu pojawiała się dopiero po F5.
            await afterVersionChange(t, { reloadGrid: true });
            toast(
                'Utworzono szkic ' + (created.version || '') + ' z ' + data.active.version,
                'success'
            );
        } catch (err) {
            toast(friendlyError('Błąd tworzenia szkicu', err), 'error');
        }
    }

    /** Dialog publikacji: data obowiązywania + nota + podgląd etykiety. */
    /**
     * Popup publikacji szkicu: wybór daty i godziny, od której cennik obowiązuje.
     * `versionId` = wersja kliknięta w pasku akcji (bez niego: bieżący szkic osi).
     */
    async function openPublishDialog(type, versionId) {
        var t = type || editorType;
        var draft = null;
        if (versionId) {
            var list = versionsByType[t];
            if (!list) {
                try {
                    list = await fetchFullList(t);
                } catch (e) {
                    toast('Błąd listy wersji: ' + e.message, 'error');
                    return;
                }
            }
            draft = list.filter(function (v) {
                return v.id === versionId;
            })[0];
            if (draft && !isEditableStatus(stateOf(draft))) {
                toast('Opublikować można tylko wersję roboczą', 'warning');
                return;
            }
        } else {
            var json = await fetchSummary();
            draft = ((json && json.types) || {})[t] && json.types[t].draft;
        }
        if (!draft) {
            toast('Brak szkicu do opublikowania', 'warning');
            return;
        }
        window.showModal({
            id: 'pv-publish-modal',
            titleId: 'pv-publish-title',
            html:
                '<div class="modal modal--publish">' +
                '<div class="modal-header"><h3 id="pv-publish-title"><i data-lucide="rocket" class="icon-16-accent"></i> Opublikuj szkic ' +
                esc(labelOf(draft) || draft.version) +
                '</h3>' +
                '<button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;pv-publish-modal&quot;]"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body pv-publish-body">' +
                '<p class="pv-publish-lead">Wybierz datę i godzinę, od której ten cennik ma obowiązywać. Dotychczasowa wersja obowiązująca zostaje w historii.</p>' +
                '<div class="pv-publish-field"><label class="form-label" for="pv-publish-date">Obowiązuje od</label>' +
                '<input class="pv-publish-input" id="pv-publish-date" type="datetime-local">' +
                '<p class="pv-publish-hint" id="pv-publish-hint"></p></div>' +
                '<div class="pv-publish-field"><label class="form-label" for="pv-publish-note">Nota (opcjonalna)</label>' +
                '<input class="pv-publish-input" id="pv-publish-note" maxlength="500" placeholder="Opis zmiany (dla daty wstecznej: min. 10 znaków)"></div>' +
                '<p class="pv-publish-error color-danger" id="pv-publish-error" role="alert"></p>' +
                '</div>' +
                '<div class="modal-footer"><button type="button" class="btn btn-secondary" id="pv-publish-cancel">Anuluj</button>' +
                '<button type="button" class="btn btn-primary" id="pv-publish-ok"><i data-lucide="rocket"></i> Opublikuj</button></div>' +
                '</div>'
        });
        var overlay = document.getElementById('pv-publish-modal');
        icons(overlay);
        var dateInput = document.getElementById('pv-publish-date');
        var noteInput = document.getElementById('pv-publish-note');
        var hint = document.getElementById('pv-publish-hint');
        var errBox = document.getElementById('pv-publish-error');
        var okBtn = document.getElementById('pv-publish-ok');
        var cancelBtn = document.getElementById('pv-publish-cancel');

        function showErr(msg) {
            if (errBox) errBox.textContent = msg || '';
        }

        function updateHint() {
            showErr('');
            if (!hint || !dateInput) return;
            var iso;
            try {
                iso = toUtcIso(dateInput.value);
            } catch (_e) {
                hint.textContent = 'Podaj datę i godzinę.';
                return;
            }
            var label = versionLabel(t, draft.seq, iso);
            hint.textContent = isPastDate(iso)
                ? 'Data w przeszłości — korekta wsteczna; uzasadnienie min. ' +
                  PAST_NOTE_MIN +
                  ' znaków. Etykieta po publikacji: ' +
                  label +
                  '.'
                : 'Status: do wdrożenia od ' +
                  stripDateTime(iso) +
                  '. Etykieta po publikacji: ' +
                  label +
                  '.';
        }

        if (dateInput) {
            dateInput.value = toLocalInput(new Date());
            dateInput.addEventListener('input', updateHint);
        }
        updateHint();
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                if (typeof window.closeModal === 'function') window.closeModal('pv-publish-modal');
            });
        }
        if (okBtn) {
            okBtn.addEventListener('click', async function () {
                var iso;
                try {
                    iso = toUtcIso(dateInput ? dateInput.value : '');
                } catch (_e) {
                    showErr('Podaj prawidłową datę.');
                    return;
                }
                var note = noteInput ? String(noteInput.value || '').trim() : '';
                if (isPastDate(iso) && note.length < PAST_NOTE_MIN) {
                    showErr('Data w przeszłości — podaj uzasadnienie (min. 10 znaków).');
                    return;
                }
                okBtn.disabled = true;
                try {
                    var res = await approveVersion(draft.id, { effectiveFrom: iso, note: note });
                    var published = (res && res.version) || {};
                    if (typeof window.closeModal === 'function')
                        window.closeModal('pv-publish-modal');
                    await afterVersionChange(t, { reloadGrid: true });
                    toast(
                        'Opublikowano ' +
                            (published.version || draft.version) +
                            ' — obowiązuje od ' +
                            stripDateTime(iso) +
                            (res && res.checksStale
                                ? ' — kontrola nieaktualna, sprawdź różnice'
                                : ''),
                        res && res.checksStale ? 'warning' : 'success'
                    );
                } catch (err) {
                    showErr(friendlyError('Błąd publikacji', err));
                    okBtn.disabled = false;
                }
            });
        }
    }

    /** Popup z pełną instrukcją cenników (kafelek w sekcji „Jak to działa”). */
    function openHelpDialog() {
        window.showModal({
            id: 'pv-help-modal',
            titleId: 'pv-help-title',
            html:
                '<div class="modal pv-help-modal">' +
                '<div class="modal-header"><h3 id="pv-help-title"><i data-lucide="book-open"></i> Jak działają cenniki</h3>' +
                '<button type="button" class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;pv-help-modal&quot;]"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body">' +
                '<section><h4>Oś czasu wersji</h4>' +
                '<p class="text-muted">Statusy wersji na osi czasu:</p>' +
                '<div class="pv-actions pv-legend" aria-label="Legenda statusów">' +
                statusBadge('ACTIVE') +
                statusBadge('SCHEDULED') +
                statusBadge('DRAFT') +
                statusBadge('ARCHIVED') +
                '</div>' +
                '<ul>' +
                '<li><strong>Obowiązuje</strong> — najnowsza opublikowana wersja, której data wejścia już minęła. Z niej liczą nowe oferty. Starszą wersję możesz wskazać ręcznie przyciskiem <strong>Ustaw jako aktywny</strong> — wtedy ona liczy oferty, choć na osi nadal ma etykietę <em>Historyczny</em>.</li>' +
                '<li><strong>Do wdrożenia</strong> — opublikowana wersja z datą przyszłą. Zaczyna obowiązywać sama w tej dacie: status wynika z daty, nie z zadania w tle.</li>' +
                '<li><strong>W przygotowaniu</strong> — szkic, dokładnie jeden na oś. Nie wpływa na oferty ani na obowiązujący cennik.</li>' +
                '<li><strong>Historyczny</strong> — opublikowana, wyparta przez nowszą. Służy do podglądu, porównania, eksportu i ewentualnego wskazania jako aktywna.</li>' +
                '</ul></section>' +
                '<section><h4>Jak edytować cennik</h4><ol>' +
                '<li>Otwórz <strong>Panel</strong> i zaznacz wersję na liście.</li>' +
                '<li>Kliknij <strong>Edytuj</strong> — szkic edytujesz normalnie, wersję opublikowaną edytujesz w miejscu (zmienia jej ceny).</li>' +
                '<li>Zmień ceny w siatce i kliknij <strong>Zapisz</strong> — tooltip przycisku pokazuje, do której wersji trafi zapis.</li>' +
                '<li>Szkic publikujesz przyciskiem <strong>Opublikuj roboczą</strong>, wybierając datę i godzinę wejścia w życie.</li>' +
                '</ol></section>' +
                '<section><h4>Jak utworzyć nowy cennik</h4><ul>' +
                '<li><strong>Kopia jako szkic</strong> — kopia dowolnej opublikowanej wersji do swobodnej edycji; obowiązujący cennik się nie zmienia.</li>' +
                '<li><strong>Transfer plików</strong> — eksport i import XLSX działają na wersji zaznaczonej na osi (bez zaznaczenia: szkic, a gdy szkicu nie ma — obowiązująca). Plik zawiera numer wersji; import wczytuje ceny do tej wersji i podmienia je po kliknięciu <strong>Zapisz</strong>.</li>' +
                '<li><strong>Cenniki domyślne</strong> — zapis obejmuje wszystkie osie naraz; przywrócenie domyślnych działa na jednej wybranej osi (Rury / Studnie / PRECO).</li>' +
                '</ul></section>' +
                '<section><h4>Daty publikacji</h4><ul>' +
                '<li><strong>Data przyszła</strong> — wersja trafia do <em>Do wdrożenia</em> i obowiązuje od tej daty.</li>' +
                '<li><strong>Data przeszła</strong> — korekta wsteczna: wymagane uzasadnienie (min. 10 znaków) i potwierdzenie.</li>' +
                '<li><strong>Teraz</strong> — wersja obowiązuje od razu dla nowych ofert.</li>' +
                '<li>Ta sama data i godzina na jednej osi = kolizja („Kolizja daty obowiązywania”) — zmień termin.</li>' +
                '</ul></section>' +
                '<section><h4>Anulowanie i wycofanie</h4><ul>' +
                '<li><strong>Anuluj wdrożenie</strong> — tylko dla wersji <em>Do wdrożenia</em>: wraca do szkicu i nie wejdzie w zaplanowanej dacie.</li>' +
                '<li><strong>Ustaw jako aktywny</strong> — tylko wersja historyczna (opublikowana, data miniona); wymaga potwierdzenia.</li>' +
                '<li>Wersji obowiązującej nie usuniesz ani nie wycofasz — opublikuj nowszą albo wskaż inną jako aktywną. Nowa publikacja z datą bieżącą zdejmuje ręczne wskazanie.</li>' +
                '<li><strong>Usuń</strong> — szkic zawsze; <em>Do wdrożenia</em> i <em>Historyczny</em> tylko wtedy, gdy nie używa ich żadna oferta ani zamówienie.</li>' +
                '</ul></section>' +
                '<section><h4>Oferty a cennik</h4><p>Nowa oferta dostaje pieczęć obowiązującej wersji. Zamówienie dziedziczy pieczęć z powiązanej oferty, a bez oferty bierze wersję obowiązującą. Istniejące oferty i zamówienia nie przeliczają się po zmianie cennika — przeliczenie na aktywną wersję jest osobną, jawną akcją („Przelicz do aktywnego”).</p></section>' +
                '<section><h4>Bezpieczeństwo zapisu</h4><ul>' +
                '<li>Zapis jest chroniony sumą kontrolną SHA-256 wczytanej treści — równoległa zmiana kończy się komunikatem, że szkic lub wersja zmieniły się od czasu wczytania; odśwież dane i zapisz ponownie.</li>' +
                '<li>Może istnieć tylko jeden szkic na oś (Rury / Studnie / PRECO).</li>' +
                '<li>Wersji PRECO używanej przez wersję studni nie da się usunąć.</li>' +
                '<li>Zarządzanie wersjami wymaga roli administratora.</li>' +
                '</ul></section>' +
                '<p class="text-muted">Pełna instrukcja: <code>docs/CENNIKI-INSTRUKCJA-ADMINA.md</code></p>' +
                '<div class="pv-actions"><button type="button" class="btn btn-primary" data-csp="closeModal" data-csp-args="[&quot;pv-help-modal&quot;]">Zamknij</button></div>' +
                '</div></div>'
        });
        icons(document.getElementById('pv-help-modal'));
    }

    /** Jedna delegacja dla przycisków trybu (CSP-E: bez inline handlerów). */
    document.addEventListener('click', async function (event) {
        // Rail należy do sekcji „Cennik" — zmiana sekcji go zamyka.
        var navBtn =
            event.target && event.target.closest
                ? event.target.closest('.nav-btn[data-section]')
                : null;
        if (navBtn && navBtn.getAttribute('data-section') !== 'pricelist') {
            closeVersionsPanel();
        }
        var btn =
            event.target && event.target.closest ? event.target.closest('[data-pv-mode]') : null;
        if (!btn) return;
        var act = btn.getAttribute('data-pv-mode');
        var type = editorType;
        if (act === 'edit') {
            // Ta sama akcja co kafelek w sekcji wersji — bez własnej logiki.
            await openVersionOrDraft(type);
            return;
        }
        if (act === 'cancel') {
            var discard = function () {
                if (versionEditMode(type)) {
                    exitVersionEdit(type);
                    return;
                }
                setEditing(type, false);
                reloadEditorGrid(type);
                renderStatusStrip(STRIP_HOST_ID, type);
            };
            if (typeof window.appConfirm === 'function') {
                pvConfirm('Odrzucić niezapisane zmiany w szkicu?', {
                    okText: 'Odrzuć i wyjdź',
                    danger: true
                }).then(function (ok) {
                    if (ok) discard();
                });
            } else {
                discard();
            }
            return;
        }
        if (act === 'copy') {
            createDraftCopy(type);
            return;
        }
    });

    window.pricelistVersions = {
        fetchLabels: fetchLabels,
        fetchLabelsByIds: fetchLabelsByIds,
        pickActiveLabel: pickActiveLabel,
        fetchFullList: fetchFullList,
        badgeHtml: badgeHtml,
        activeBadgeHtml: activeBadgeHtml,
        hydrateBadges: hydrateBadges,
        hydrateActiveBadges: hydrateActiveBadges,
        openVersionsPanel: openVersionsPanel,
        toggleVersionsPanel: toggleVersionsPanel,
        autoOpenVersionsPanel: autoOpenVersionsPanel,
        closeVersionsPanel: closeVersionsPanel,
        isVersionsPanelOpen: isVersionsPanelOpen,
        isCennikHost: isCennikHost,
        afterVersionChange: afterVersionChange,
        openDiff: openDiff,
        statusBadge: statusBadge,
        stateOf: stateOf,
        displayStatus: displayStatus,
        canPublish: canPublish,
        canDelete: canDelete,
        syncHeaderForTab: syncHeaderForTab,
        closeEditorPreview: closeEditorPreview,
        releaseEditorVersion: releaseEditorVersion,
        noteVersionSaved: noteVersionSaved,
        approveVersion: approveVersion,
        fetchChecks: fetchChecks,
        isPastDate: isPastDate,
        renderStatusStrip: renderStatusStrip,
        refreshStatusStrip: refreshStatusStrip,
        syncEditor: syncEditor,
        isEditing: isEditing,
        setEditing: setEditing,
        versionEditLabel: versionEditLabel,
        saveButtonMeta: saveButtonMeta,
        applyEditorLock: applyEditorLock,
        openPublishDialog: openPublishDialog,
        createDraftCopy: createDraftCopy,
        draftHeaders: draftHeaders,
        draftRef: draftRef,
        clearSummaryCache: clearSummaryCache,
        downloadNameFrom: downloadNameFrom,
        transferVersion: transferVersion,
        transferConfirm: transferConfirm,
        exportVersionXlsx: exportVersionXlsx,
        enterVersionEditForImport: enterVersionEditForImport,
        _apiJson: apiJson,
        _authed: authed
    };
})();
