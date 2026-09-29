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
    /** Czy bieżący użytkownik widzi pełną listę (admin) per typ. */
    var canManage = {};
    /** Mapa getRows per typ (rury/studnie) — rejestrowana przy otwarciu panelu. */
    var getRowsByType = {};

    /** Domyślny odczyt wierszy z bieżącego window (fallback przy braku getRows). */
    function defaultGetRows(type) {
        if (type === 'rury' && typeof window.products !== 'undefined') return window.products;
        if (type === 'studnie' && typeof window.studnieProducts !== 'undefined')
            return window.studnieProducts;
        var w = null;
        try {
            w = window.parent && window.parent !== window ? window.parent : null;
        } catch (_e) {
            w = null;
        }
        if (w) {
            if (type === 'rury' && typeof w.products !== 'undefined') return w.products;
            if (type === 'studnie' && typeof w.studnieProducts !== 'undefined')
                return w.studnieProducts;
        }
        return [];
    }

    function resolveGetRows(type) {
        if (typeof getRowsByType[type] === 'function') {
            return getRowsByType[type];
        }
        return function () {
            return defaultGetRows(type);
        };
    }

    function esc(s) {
        return typeof window.escapeHtml === 'function' ? window.escapeHtml(s) : String(s ?? '');
    }

    function escAttr(s) {
        return typeof window.escapeHtmlAttr === 'function'
            ? window.escapeHtmlAttr(s)
            : String(s ?? '');
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
            var err = /** @type {Error & { status?: number; code?: unknown }} */ (
                new Error((body && body.error) || 'Błąd HTTP ' + res.status)
            );
            err.status = res.status;
            err.code = body && body.code;
            throw err;
        }
        return body;
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
            return json.versions || [];
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

    /* ===== BADGE „cennik vX" ===== */

    /** Placeholder badge; hydrateBadges() uzupełnia labelkę + tooltip.
     *  Dopisek typu (· Studnie/Rury/Preco) TYLKO na poziomie wyświetlania —
     *  labelki wersji w DB (PricelistVersion.version) niemutowalne. */
    function badgeHtml(versionId, type) {
        if (!versionId) return '';
        var typeAttr = type ? ' data-pv-type="' + escAttr(type) + '"' : '';
        return (
            '<span class="badge-info text-nowrap" data-pv-id="' +
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
            '<span class="badge-info text-nowrap" data-pv-active="' +
            escAttr(type) +
            '" title="Aktywny cennik…">cennik…</span>'
        );
    }

    /** Aktywna = najwyższy seq spośród ACTIVE/BACKDATE z /labels. */
    function pickActiveLabel(labels) {
        var best = null;
        Object.keys(labels || {}).forEach(function (id) {
            var v = labels[id];
            if (!best || (v.seq || 0) > (best.seq || 0)) best = v;
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
        el.textContent = 'cennik ' + v.version + (label ? ' · ' + label : '');
        var local = '';
        try {
            local = new Date(v.effectiveFrom).toLocaleString();
        } catch (_e2) {
            local = v.effectiveFrom;
        }
        el.setAttribute(
            'title',
            'Wersja ' +
                v.version +
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
                var active = pickActiveLabel(labels);
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

    function nextSeq(versions) {
        var max = 0;
        versions.forEach(function (v) {
            if (typeof v.seq === 'number' && v.seq > max) max = v.seq;
        });
        return max + 1;
    }

    /** Podgląd labelki: v{seq}-{RRRRMMDD} z daty (lokalnej lub ISO). */
    function versionLabel(seq, dateValue) {
        var d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return 'v' + seq;
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return 'v' + seq + '-' + y + m + day;
    }

    /** Etykiety statusów po polsku (klasy badge bez zmian). */
    var STATUS_LABELS = {
        ACTIVE: 'Aktywna',
        SCHEDULED: 'Zaplanowana',
        BACKDATE: 'Wsteczna',
        BACKDATE_REQUESTED: 'Do zatwierdzenia',
        DRAFT: 'Robocza',
        ARCHIVED: 'Archiwalna'
    };

    function statusBadge(status) {
        // Osobny badge BACKDATE (szary) vs ACTIVE (zielony) / SCHEDULED (niebieski).
        var label = STATUS_LABELS[status] || status;
        if (status === 'ACTIVE')
            return '<span class="badge-ok text-nowrap">' + esc(label) + '</span>';
        if (status === 'SCHEDULED')
            return '<span class="badge-info text-nowrap">' + esc(label) + '</span>';
        if (status === 'BACKDATE' || status === 'BACKDATE_REQUESTED')
            return '<span class="badge-muted text-nowrap">' + esc(label) + '</span>';
        return '<span class="text-muted">' + esc(label) + '</span>';
    }

    /** Nazwa typu cennika wielką literą do tytułu panelu. */
    function typeLabel(type) {
        if (type === 'studnie') return 'Studnie';
        if (type === 'rury') return 'Rury';
        if (type === 'preco') return 'Preco';
        return type;
    }

    function fmtEff(iso) {
        var local = iso;
        try {
            local = new Date(iso).toLocaleString();
        } catch (_e) {
            /* zostaw ISO */
        }
        return '<span title="' + escAttr(iso) + '">' + esc(local) + '</span>';
    }

    /** Wersję można usunąć tylko zanim zacznie żyć (nigdy nie była aktywna). */
    function isDeletable(status) {
        return status === 'DRAFT' || status === 'SCHEDULED' || status === 'BACKDATE_REQUESTED';
    }

    /** Statusy z edytowalną treścią i notą (jak EDITABLE_STATUSES w BE). */
    function isEditableStatus(status) {
        return status === 'DRAFT' || status === 'SCHEDULED' || status === 'BACKDATE_REQUESTED';
    }

    /** Komórka notatek: tekst + ołówek (tylko edytowalne, tylko admin). */
    function noteCell(v, manageable) {
        var text = esc(v.note || '—');
        if (!manageable || !isEditableStatus(v.status)) return text;
        return (
            '<span class="pv-note-cell"><span class="pv-note-text">' +
            text +
            '</span> <button class="btn-icon btn-icon-sm btn-icon--dim" data-pv-act="edit-note" data-pv-id="' +
            escAttr(v.id) +
            '" data-pv-note="' +
            escAttr(v.note || '') +
            '" title="Edytuj notatki" aria-label="Edytuj notatki"><i data-lucide="pencil" aria-hidden="true"></i></button></span>'
        );
    }

    /** Powód blokady „Usuń" (null = wolno): ACTIVE/BACKDATE zawsze, reszta tylko z użyciem. */
    function deleteReason(v) {
        if (isDeletable(v.status)) return null;
        if (v.status === 'ACTIVE') return 'Wersja aktywna — nieusuwalna';
        if (v.status === 'BACKDATE') return 'Wersja wsteczna — nieusuwalna';
        if (typeof v.usedBy !== 'number') return 'Brak danych o użyciu — nieusuwalna';
        if (v.usedBy > 0) return 'Używana przez ' + v.usedBy + ' ofert/zamówień';
        return null;
    }

    function renderRows(versions, manageable, type) {
        if (versions.length === 0) {
            return '<tr><td colspan="7" class="text-center text-muted">Brak wersji — zapisz pierwszą powyżej.</td></tr>';
        }
        // Wiersz żyje w kontekście taba (typ znany) — bez sufiksu typu w labelce,
        // sam title/tooltip z typem. Badge poza panelem ZAWSZE z typem.
        var typeTitle = type ? ' title="Typ cennika: ' + escAttr(typeLabel(type)) + '"' : '';
        return versions
            .map(function (v) {
                var eff = v.effectiveFrom
                    ? fmtEff(v.effectiveFrom)
                    : '<span class="text-muted">—</span>';
                var activation =
                    v.status === 'SCHEDULED'
                        ? '<button class="btn btn-sm btn-primary" data-pv-act="activate" data-pv-id="' +
                          escAttr(v.id) +
                          '">Aktywuj</button>'
                        : v.status === 'BACKDATE_REQUESTED'
                          ? '<button class="btn btn-sm btn-primary" data-pv-act="backdate" data-pv-id="' +
                            escAttr(v.id) +
                            '">Zatwierdź wstecz</button>'
                          : '';
                // Rollback (Faza B): klon dowolnej wersji do nowej roboczej.
                var cloneBtn =
                    '<button class="btn btn-sm btn-secondary" data-pv-act="clone" data-pv-id="' +
                    escAttr(v.id) +
                    '" title="Utwórz nową wersję roboczą jako kopię wersji ' +
                    escAttr(v.version || '') +
                    ' (aktywna wersja nie zmieni się)">' +
                    '<i data-lucide="history"></i> Przywróć jako roboczą</button>';
                // „Usuń" zawsze widoczny: enabled gdy wolno (allowlist albo
                // archiwalna/nieznana-przyszła bez użycia), inaczej wyszarzony z powodem.
                var reason = deleteReason(v);
                var deleteBtn =
                    '<button class="btn btn-sm btn-danger" data-pv-act="delete" data-pv-id="' +
                    escAttr(v.id) +
                    '" data-pv-version="' +
                    escAttr(v.version || '') +
                    '"' +
                    (reason === null
                        ? ' title="Usuwa wersję i jej pozycje (tylko wersje nigdy nieaktywne)">Usuń</button>'
                        : ' disabled title="' + escAttr(reason) + '">Usuń</button>');
                var actions = manageable
                    ? '<div class="pv-actions">' +
                      '<button class="btn btn-sm btn-secondary" data-pv-act="diff" data-pv-id="' +
                      escAttr(v.id) +
                      '">Porównaj</button>' +
                      '<button class="btn btn-sm btn-secondary" data-pv-act="export" data-pv-id="' +
                      escAttr(v.id) +
                      '">Eksport</button>' +
                      activation +
                      cloneBtn +
                      deleteBtn +
                      '</div>'
                    : '<span class="text-muted">—</span>';
                return (
                    '<tr>' +
                    '<td><strong' +
                    typeTitle +
                    '>' +
                    esc(v.version || '—') +
                    '</strong></td>' +
                    '<td class="text-right">' +
                    esc(String(v.seq ?? '—')) +
                    '</td>' +
                    '<td>' +
                    statusBadge(v.status) +
                    '</td>' +
                    '<td>' +
                    eff +
                    '</td>' +
                    '<td>' +
                    esc(v.createdByName || v.createdBy || '—') +
                    '</td>' +
                    '<td>' +
                    noteCell(v, manageable) +
                    '</td>' +
                    '<td>' +
                    actions +
                    '</td>' +
                    '</tr>'
                );
            })
            .join('');
    }

    function transferHtml(type) {
        var isRury = type === 'rury';
        var importInput =
            '<input type="file" id="pv-import-excel" style="display: none" accept=".xlsx,.xls" onchange="' +
            (isRury ? 'importRuryFromExcel(event)' : 'importStudnieFromExcel(event)') +
            '">';
        if (isRury) {
            return (
                '<div class="pv-row"><span class="pv-row-label">Rury</span><span class="pv-actions">' +
                '<button class="btn btn-sm btn-secondary" data-csp="exportRuryToExcel" data-csp-args="[]" title="Eksportuj cennik do pliku Excel"><i data-lucide="download"></i> Eksportuj</button>' +
                '<button class="btn btn-sm btn-secondary" data-csp="$dom" data-csp-args="[&quot;click&quot;, &quot;#pv-import-excel&quot;]" title="Importuj cennik z pliku Excel"><i data-lucide="upload"></i> Importuj</button>' +
                '</span></div>' +
                importInput
            );
        }
        return (
            '<div class="pv-row"><span class="pv-row-label">Studnie + PRECO</span><span class="pv-actions">' +
            '<button class="btn btn-sm btn-secondary" data-csp="exportStudnieToExcel" data-csp-args="[]" title="Eksportuj cennik do pliku Excel"><i data-lucide="download"></i> Eksportuj</button>' +
            '<button class="btn btn-sm btn-secondary" data-csp="$dom" data-csp-args="[&quot;click&quot;, &quot;#pv-import-excel&quot;]" title="Importuj cennik z pliku Excel (zawiera arkusze PRECO)"><i data-lucide="upload"></i> Importuj</button>' +
            '</span></div>' +
            importInput
        );
    }

    /** Sekcja globalna: widoczna raz, niezależna od taba (te same funkcje). */
    function defaultsHtml() {
        return (
            '<div class="pv-actions">' +
            '<button class="btn btn-sm btn-secondary" id="btn-save-defaults" data-csp="saveAllDefaults" data-csp-scope="parent" data-csp-args="[]" title="Zapisz bieżący stan cenników (rury, studnie, PRECO) jako domyślne"><i data-lucide="bookmark"></i> Zapisz domyślne</button>' +
            '<button class="btn btn-sm btn-secondary" data-csp="resetPriceList" data-csp-args="[]" title="Przywróć domyślne wartości cennika rur (pyta o potwierdzenie)"><i data-lucide="rotate-ccw"></i> Przywróć domyślne (Rury)</button>' +
            '<button class="btn btn-sm btn-secondary" data-csp="resetStudniePriceList" data-csp-args="[]" title="Przywróć domyślne wartości cennika studni (pyta o potwierdzenie)"><i data-lucide="rotate-ccw"></i> Przywróć domyślne (Studnie)</button>' +
            '<button class="btn btn-sm btn-secondary" data-pv-reset="preco" data-csp="loadPrecoDefaults" data-csp-args="[]" title="Przywróć domyślne wartości cennika PRECO (pyta o potwierdzenie)"><i data-lucide="rotate-ccw"></i> Przywróć domyślne (PRECO)</button>' +
            '</div>' +
            '<p class="text-muted">Zapisz domyślne obejmuje wszystkie cenniki (rury, studnie, PRECO); przywrócenie dotyczy wybranego cennika.</p>'
        );
    }

    /** Typy z załadowanym modułem strony (eksport+import istnieją w window).
     *  Drugi typ chowamy zamiast wołać w próżnię (ReferenceError na obcej stronie). */
    function availableTypes() {
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
        var labels = { rury: 'Rury', studnie: 'Studnie' };
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

    function saveFormHtml(next, manageable) {
        if (!manageable) {
            return '<p class="text-muted">Podgląd wersji (zarządzanie wymaga roli admin).</p>';
        }
        return (
            '<form id="pv-save-form">' +
            '<div class="form-group"><label>Nowa wersja (tylko podgląd)</label>' +
            '<input class="form-input" id="pv-next-label" value="' +
            escAttr(versionLabel(next, new Date()) + ' (nr ' + next + ')') +
            '" readonly></div>' +
            '<div class="form-group"><label for="pv-note">Notatki</label>' +
            '<input class="form-input" id="pv-note" maxlength="500" placeholder="Opis zmiany (dla daty wstecznej: min. 10 znaków)"></div>' +
            '<div class="form-group"><label for="pv-eff">Obowiązuje od (czas lokalny → UTC)</label>' +
            '<input class="form-input" type="datetime-local" id="pv-eff"></div>' +
            '<div id="pv-past-warn" class="color-warn" style="display:none">Data w przeszłości — zapis jako wersja wsteczna (nota min. 10 znaków, bez auto-aktywacji).</div>' +
            '<div class="form-group"><button type="submit" class="btn btn-primary w-100" title="Zapisuje bieżący stan cennika jako nową wersję (kopia wszystkich pozycji). Nie zmienia cen w ofertach ani cennika na żywo — nowa wersja czeka na aktywację (data przyszła) albo zapisuje się jako wsteczna (data przeszła, wymagana nota min. 10 znaków)."><i data-lucide="save"></i> Zapisz jako wersję</button></div>' +
            '</form>'
        );
    }

    function panelHtml(type, next, manageable) {
        return (
            '<div class="modal modal--pv"><div class="modal-header"><h3 id="pv-panel-title"><i data-lucide="layers"></i> Zarządzanie cennikami</h3>' +
            '<button class="btn-icon" aria-label="Zamknij" data-pv-act="close"><i data-lucide="x"></i></button></div>' +
            '<div class="modal-body">' +
            '<div id="pv-type-tabs">' +
            tabsHtml(type) +
            '</div>' +
            '<h4 class="pv-section">Wersje</h4>' +
            '<div id="pv-save-wrap">' +
            saveFormHtml(next, manageable) +
            '</div>' +
            '<div class="table-wrap"><table><thead><tr>' +
            '<th scope="col">Wersja</th><th scope="col">Nr</th><th scope="col">Status</th><th scope="col">Obowiązuje od</th>' +
            '<th scope="col">Autor</th><th scope="col">Notatki</th><th scope="col">Akcje</th>' +
            '</tr></thead><tbody id="pv-versions-body"></tbody></table></div>' +
            '<h4 class="pv-section">Transfer plików</h4>' +
            '<div id="pv-transfer">' +
            transferHtml(type) +
            '</div>' +
            '<h4 class="pv-section">Cenniki domyślne</h4>' +
            defaultsHtml() +
            '</div></div>'
        );
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
        var overlay = document.getElementById('pv-versions-modal');
        if (overlay) icons(overlay);
        return versions;
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
        document.getElementById('pv-note-ok').addEventListener('click', function () {
            var note = document.getElementById('pv-note-input').value || '';
            onSubmit(note);
        });
    }

    async function openDiff(id) {
        var diff;
        try {
            diff = await apiJson(API + '/' + encodeURIComponent(id) + '/diff', authed('GET'));
        } catch (e) {
            toast('Błąd porównania: ' + e.message, 'error');
            return;
        }
        var SECTION_LABELS = {
            rury: 'Rury',
            studnie: 'Studnie',
            konfig: 'Konfiguracja',
            kinety: 'Kinety',
            zakresy: 'Zakresy'
        };
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
        window.showModal({
            id: 'pv-diff-modal',
            titleId: 'pv-diff-title',
            html:
                '<div class="modal"><div class="modal-header"><h3 id="pv-diff-title">Porównanie ' +
                esc(diff.version) +
                ' ← ' +
                esc(diff.previousVersion || '∅') +
                '</h3>' +
                '<button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;pv-diff-modal&quot;]"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body"><div class="table-wrap"><table><thead><tr>' +
                '<th scope="col">Sekcja</th><th scope="col">Dodane</th><th scope="col">Usunięte</th><th scope="col">Zmienione</th>' +
                '</tr></thead><tbody>' +
                (rows ||
                    '<tr><td colspan="4" class="text-center text-muted">Brak zmian.</td></tr>') +
                '</tbody></table></div></div></div>'
        });
        icons(document.getElementById('pv-diff-modal'));
    }

    /* Formuła 1:1 z BE versionExportFilename (src/utils/exportFilenames.ts). */
    function versionExportFilename(type, version) {
        var label =
            type === 'rury'
                ? 'Rury'
                : type === 'studnie'
                  ? 'Studnie'
                  : type === 'preco'
                    ? 'Preco'
                    : type;
        return 'Cennik_' + label + '_' + version + '_Export.xlsx';
    }

    async function exportVersion(id, type, version) {
        try {
            var headers = typeof window.authHeaders === 'function' ? window.authHeaders() : {};
            var res = await fetch(API + '/' + encodeURIComponent(id) + '/export', {
                headers: headers
            });
            if (!res.ok) throw new Error('Błąd HTTP ' + res.status);
            var precoIncluded = true;
            try {
                precoIncluded = res.headers.get('X-Preco-Included') !== '0';
            } catch (_h) {
                /* brak nagłówka = stare API, cisza */
            }
            var blob = await res.blob();
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = versionExportFilename(type, version || id);
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                URL.revokeObjectURL(a.href);
                a.remove();
            }, 1000);
            if (!precoIncluded && type === 'studnie') {
                toast(
                    'Wersja PRECO o tym samym numerze nie istnieje — wyeksportowano same studnie',
                    'warning'
                );
            }
        } catch (e) {
            toast('Błąd eksportu: ' + e.message, 'error');
        }
    }

    function initEff(next) {
        var eff = document.getElementById('pv-eff');
        var warn = document.getElementById('pv-past-warn');
        var nextLabel = document.getElementById('pv-next-label');
        if (!eff || !warn) return;
        var check = function () {
            try {
                warn.style.display =
                    eff.value && new Date(eff.value).getTime() < Date.now() - 60000 ? '' : 'none';
                if (nextLabel && eff.value) {
                    nextLabel.value = versionLabel(next, eff.value) + ' (nr ' + next + ')';
                }
            } catch (_e) {
                warn.style.display = 'none';
            }
        };
        eff.addEventListener('change', check);
        // Domyślnie: teraz (lokalnie).
        try {
            var now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
            eff.value = now.toISOString().slice(0, 16);
        } catch (_e2) {
            /* brak prefill */
        }
    }

    /** Przeładowanie formularza (next seq) + transferu + tabeli po zmianie taba. */
    async function switchType(newType, state) {
        state.current = newType;
        var tabs = document.getElementById('pv-type-tabs');
        if (tabs) {
            tabs.innerHTML = tabsHtml(newType);
            icons(tabs);
        }
        var versions = [];
        try {
            versions = await fetchFullList(newType);
        } catch (e) {
            toast('Błąd listy wersji: ' + e.message, 'error');
            return;
        }
        var manageable = canManage[newType] === true;
        var next = nextSeq(versions);
        var saveWrap = document.getElementById('pv-save-wrap');
        if (saveWrap) {
            saveWrap.innerHTML = saveFormHtml(next, manageable);
            icons(saveWrap);
        }
        var transfer = document.getElementById('pv-transfer');
        if (transfer) {
            transfer.innerHTML = transferHtml(newType);
            icons(transfer);
        }
        initEff(next);
        try {
            await refreshTable(newType, manageable);
        } catch (e) {
            toast('Błąd odświeżenia: ' + e.message, 'error');
        }
    }

    /**
     * Globalny panel wersji: jeden panel z tabami [Rury|Studnie].
     * @param {string} type 'rury' | 'studnie' (preselekcja taba)
     * @param {Function|Object} getRows funkcja wierszy aktywnego typu albo mapa {rury, studnie}
     * @param {Function} [getRowsOther] opcjonalna funkcja wierszy drugiego typu
     */
    async function openVersionsPanel(type, getRows, getRowsOther) {
        // Kompatybilność wstecz: getRows jako funkcja (pojedynczy typ) albo mapa.
        if (getRows && typeof getRows !== 'function') {
            if (typeof getRows.rury === 'function') getRowsByType.rury = getRows.rury;
            if (typeof getRows.studnie === 'function') getRowsByType.studnie = getRows.studnie;
        } else if (typeof getRows === 'function') {
            getRowsByType[type] = getRows;
        }
        if (typeof getRowsOther === 'function') {
            getRowsByType[type === 'rury' ? 'studnie' : 'rury'] = getRowsOther;
        }
        // Preselekcja tylko załadowanego modułu — inaczej fallback na pierwszy dostępny.
        if (!isAvailable(type)) type = availableTypes()[0];
        var versions = [];
        try {
            versions = await fetchFullList(type);
        } catch (e) {
            toast('Błąd listy wersji: ' + e.message, 'error');
            return;
        }
        var manageable = canManage[type] === true;
        var next = nextSeq(versions);
        window.showModal({
            id: 'pv-versions-modal',
            titleId: 'pv-panel-title',
            html: panelHtml(type, next, manageable),
            onOpen: function () {
                var overlay = document.getElementById('pv-versions-modal');
                if (overlay) {
                    icons(overlay);
                    wirePanel(overlay, type);
                }
                refreshTable(type, manageable).catch(function (e) {
                    toast('Błąd odświeżenia: ' + e.message, 'error');
                });
                initEff(next);
            }
        });
    }

    function wirePanel(overlay, initialType) {
        var state = { current: initialType };
        // Reset PRECO działa tylko tam, gdzie załadowany jest moduł PRECO (cennik
        // studni); spod rur przycisk chowamy zamiast wołać w próżnię.
        var precoReset = overlay.querySelector('[data-pv-reset="preco"]');
        if (precoReset && typeof window.loadPrecoDefaults !== 'function') {
            precoReset.style.display = 'none';
        }
        overlay.addEventListener('click', function (e) {
            var tab = e.target && e.target.closest ? e.target.closest('[data-pv-tab]') : null;
            if (tab) {
                var next = tab.getAttribute('data-pv-tab');
                if (next && next !== state.current && isAvailable(next)) {
                    switchType(next, state).catch(function (err) {
                        toast('Błąd przełączania typu: ' + err.message, 'error');
                    });
                }
                return;
            }
            var btn = e.target && e.target.closest ? e.target.closest('[data-pv-act]') : null;
            if (!btn) return;
            var type = state.current;
            var act = btn.getAttribute('data-pv-act');
            var id = btn.getAttribute('data-pv-id');
            if (act === 'close') window.closeModal('pv-versions-modal');
            else if (act === 'diff' && id) openDiff(id);
            else if (act === 'export' && id) {
                exportVersion(id, type, null);
            } else if (act === 'activate' && id) {
                openNoteModal(
                    'Aktywuj wersję',
                    'Opcjonalne notatki do aktywacji…',
                    function (note) {
                        var trimmed = (note || '').trim();
                        apiJson(
                            API + '/' + encodeURIComponent(id) + '/activate',
                            authed('POST', trimmed ? { note: note } : undefined)
                        )
                            .then(function () {
                                window.closeModal('pv-note-modal');
                                toast('Wersja aktywowana', 'success');
                                refreshTable(type, true);
                            })
                            .catch(function (err) {
                                toast('Błąd aktywacji: ' + err.message, 'error');
                            });
                    },
                    { required: false, okText: 'Aktywuj' }
                );
            } else if (act === 'edit-note' && id) {
                openNoteModal(
                    'Edytuj notatki',
                    'Notatki (max 500 znaków, pustka czyści)…',
                    function (note) {
                        apiJson(API + '/' + encodeURIComponent(id), authed('PUT', { note: note }))
                            .then(function () {
                                window.closeModal('pv-note-modal');
                                toast('Notatki zapisane', 'success');
                                refreshTable(type, true);
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
            } else if (act === 'backdate' && id) {
                openNoteModal(
                    'Zatwierdź wstecz',
                    'Uzasadnienie zmiany historycznej…',
                    function (note) {
                        apiJson(
                            API + '/' + encodeURIComponent(id) + '/backdate',
                            authed('POST', { note: note })
                        )
                            .then(function () {
                                window.closeModal('pv-note-modal');
                                toast('Wersja wsteczna zatwierdzona', 'success');
                                refreshTable(type, true);
                            })
                            .catch(function (err) {
                                toast('Błąd zatwierdzenia wstecz: ' + err.message, 'error');
                            });
                    }
                );
            } else if (act === 'clone' && id) {
                var doClone = function () {
                    apiJson(API + '/' + encodeURIComponent(id) + '/clone-draft', authed('POST'))
                        .then(function (json) {
                            var v = json.version || {};
                            toast(
                                'Utworzono wersję roboczą ' +
                                    (v.version || '') +
                                    ' jako kopię wersji',
                                'success'
                            );
                            refreshTable(type, true);
                        })
                        .catch(function (err) {
                            toast('Błąd klonowania: ' + err.message, 'error');
                        });
                };
                var cloneMsg =
                    'Utworzyć nową wersję roboczą jako kopię tej wersji? Aktywna wersja nie zmieni się.';
                pvConfirm(cloneMsg, {
                    title: 'Przywróć jako roboczą',
                    okText: 'Klonuj',
                    type: 'warning'
                }).then(function (ok) {
                    if (ok) doClone();
                });
            } else if (act === 'delete' && id) {
                var versionName = btn.getAttribute('data-pv-version') || id;
                var doDelete = function () {
                    apiJson(API + '/' + encodeURIComponent(id), authed('DELETE'))
                        .then(function () {
                            toast('Wersja ' + versionName + ' usunięta', 'success');
                            refreshTable(type, true);
                        })
                        .catch(function (err) {
                            toast('Błąd usuwania: ' + err.message, 'error');
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
        // Delegacja submit (formularz prze-renderowany przy zmianie taba).
        overlay.addEventListener('submit', function (ev) {
            var form = ev.target && ev.target.closest ? ev.target.closest('#pv-save-form') : null;
            if (!form) return;
            ev.preventDefault();
            (function () {
                var type = state.current;
                var note = document.getElementById('pv-note').value || '';
                var effRaw = document.getElementById('pv-eff').value || '';
                var effectiveFrom;
                try {
                    effectiveFrom = effRaw ? toUtcIso(effRaw) : new Date().toISOString();
                } catch (_e) {
                    toast('Nieprawidłowa data „Obowiązuje od"', 'error');
                    return;
                }
                var rows;
                try {
                    rows = resolveGetRows(type)();
                } catch (err) {
                    toast('Błąd odczytu cennika: ' + err.message, 'error');
                    return;
                }
                var isPast = new Date(effectiveFrom).getTime() < Date.now() - 60000;
                var doBackdate = function (draftId, backNote) {
                    apiJson(
                        API + '/' + encodeURIComponent(draftId) + '/backdate',
                        authed('POST', { note: backNote })
                    )
                        .then(function () {
                            toast('Wersja wsteczna zapisana', 'success');
                            refreshTable(type, true);
                        })
                        .catch(function (err) {
                            toast(
                                'Wersja zapisana, zatwierdzenie wstecz nie: ' + err.message,
                                'warning'
                            );
                            refreshTable(type, true);
                        });
                };
                var submitDraft = function (finalNote) {
                    apiJson(
                        API + '/' + encodeURIComponent(type) + '/drafts',
                        authed('POST', {
                            rows: rows,
                            effectiveFrom: effectiveFrom,
                            note: finalNote || undefined
                        })
                    )
                        .then(function (json) {
                            var v = json.version || {};
                            if (isPast || v.status === 'BACKDATE_REQUESTED') {
                                var bn = finalNote || '';
                                if (bn.trim().length < 10) {
                                    openNoteModal(
                                        'Wersja wsteczna — wymagana nota',
                                        'Min. 10 znaków uzasadnienia…',
                                        function (n2) {
                                            doBackdate(v.id, n2);
                                        }
                                    );
                                    refreshTable(type, true);
                                    return;
                                }
                                doBackdate(v.id, bn);
                                return;
                            }
                            toast(
                                'Wersja ' +
                                    (v.version || '') +
                                    ' zapisana (' +
                                    (v.status || '') +
                                    ')',
                                'success'
                            );
                            refreshTable(type, true);
                        })
                        .catch(function (err) {
                            toast('Błąd zapisu wersji: ' + err.message, 'error');
                        });
                };
                if (isPast && note.trim().length < 10) {
                    openNoteModal(
                        'Data w przeszłości — zapis jako wersja wsteczna',
                        'Min. 10 znaków uzasadnienia…',
                        function (n) {
                            submitDraft(n);
                        }
                    );
                    return;
                }
                submitDraft(note);
            })();
        });
    }

    window.pricelistVersions = {
        fetchLabels: fetchLabels,
        fetchLabelsByIds: fetchLabelsByIds,
        fetchFullList: fetchFullList,
        badgeHtml: badgeHtml,
        activeBadgeHtml: activeBadgeHtml,
        hydrateBadges: hydrateBadges,
        hydrateActiveBadges: hydrateActiveBadges,
        openVersionsPanel: openVersionsPanel,
        openDiff: openDiff
    };
})();
