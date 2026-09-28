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

    /** Placeholder badge; hydrateBadges() uzupełnia labelkę + tooltip. */
    function badgeHtml(versionId) {
        if (!versionId) return '';
        return (
            '<span class="badge-info text-nowrap" data-pv-id="' +
            escAttr(versionId) +
            '" title="Wersja cennika…">cennik…</span>'
        );
    }

    /** Uzupełnia badge w danym kontenerze (labelka + tooltip effectiveFrom). */
    async function hydrateBadges(root, type) {
        var scope = root || document;
        var spots = scope.querySelectorAll ? scope.querySelectorAll('span[data-pv-id]') : [];
        if (spots.length === 0) return;
        var labels;
        try {
            labels = await fetchLabels(type);
        } catch (_e) {
            return;
        }
        spots.forEach(function (el) {
            var v = labels[el.getAttribute('data-pv-id')];
            if (!v) {
                el.textContent = 'cennik legacy';
                el.setAttribute('title', 'Oferta sprzed wersjonowania (legacy)');
                return;
            }
            el.textContent = 'cennik ' + v.version;
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
                    ') • obowiązuje od: ' +
                    local +
                    ' • UTC: ' +
                    v.effectiveFrom
            );
        });
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

    function renderRows(versions, manageable) {
        if (versions.length === 0) {
            return '<tr><td colspan="7" class="text-center text-muted">Brak wersji — zapisz pierwszą powyżej.</td></tr>';
        }
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
                var deleteBtn = isDeletable(v.status)
                    ? '<button class="btn btn-sm btn-danger" data-pv-act="delete" data-pv-id="' +
                      escAttr(v.id) +
                      '" data-pv-version="' +
                      escAttr(v.version || '') +
                      '" title="Usuwa wersję i jej pozycje (tylko wersje nigdy nieaktywne)">Usuń</button>'
                    : '';
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
                    '<td><strong>' +
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
                    esc(v.createdBy || '—') +
                    '</td>' +
                    '<td>' +
                    esc(v.note || '—') +
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
                '<button class="btn btn-sm btn-secondary" onclick="exportRuryToExcel()" title="Eksportuj cennik do pliku Excel"><i data-lucide="download"></i> Eksportuj</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="document.getElementById(\'pv-import-excel\').click()" title="Importuj cennik z pliku Excel"><i data-lucide="upload"></i> Importuj</button>' +
                '</span></div>' +
                importInput
            );
        }
        return (
            '<div class="pv-row"><span class="pv-row-label">Studnie + PRECO</span><span class="pv-actions">' +
            '<button class="btn btn-sm btn-secondary" onclick="exportStudnieToExcel()" title="Eksportuj cennik do pliku Excel"><i data-lucide="download"></i> Eksportuj</button>' +
            '<button class="btn btn-sm btn-secondary" onclick="document.getElementById(\'pv-import-excel\').click()" title="Importuj cennik z pliku Excel (zawiera arkusze PRECO)"><i data-lucide="upload"></i> Importuj</button>' +
            '</span></div>' +
            '<div class="pv-row"><span class="pv-row-label">PRECO</span><span class="pv-actions">' +
            '<button class="btn btn-sm btn-secondary" onclick="exportPrecoToExcel()" title="Eksportuj cennik PRECO do pliku Excel"><i data-lucide="download"></i> Eksportuj</button>' +
            '</span></div>' +
            importInput
        );
    }

    function defaultsHtml(type) {
        return (
            '<div class="pv-actions">' +
            '<button class="btn btn-sm btn-secondary" id="btn-save-defaults" onclick="window.parent.saveAllDefaults()" title="Zapisz bieżący stan cenników (rury, studnie, PRECO) jako domyślne"><i data-lucide="bookmark"></i> Zapisz domyślne</button>' +
            '<button class="btn btn-sm btn-secondary" onclick="' +
            (type === 'rury' ? 'resetPriceList()' : 'resetStudniePriceList()') +
            '" title="Przywróć domyślne wartości cennika (pyta o potwierdzenie)"><i data-lucide="rotate-ccw"></i> Przywróć domyślne</button>' +
            '</div>' +
            '<p class="text-muted">Zapisz domyślne obejmuje wszystkie cenniki (rury, studnie, PRECO); przywrócenie dotyczy cennika ' +
            esc(typeLabel(type)) +
            '.</p>'
        );
    }

    function panelHtml(type, next, manageable) {
        var saveForm = manageable
            ? '<form id="pv-save-form">' +
              '<div class="form-group"><label>Nowa wersja (tylko podgląd)</label>' +
              '<input class="form-input" id="pv-next-label" value="' +
              escAttr(versionLabel(next, new Date()) + ' (nr ' + next + ')') +
              '" readonly></div>' +
              '<div class="form-group"><label for="pv-note">Nota</label>' +
              '<input class="form-input" id="pv-note" maxlength="500" placeholder="Opis zmiany (dla daty wstecznej: min. 10 znaków)"></div>' +
              '<div class="form-group"><label for="pv-eff">Obowiązuje od (czas lokalny → UTC)</label>' +
              '<input class="form-input" type="datetime-local" id="pv-eff"></div>' +
              '<div id="pv-past-warn" class="color-warn" style="display:none">Data w przeszłości — zapis jako wersja wsteczna (nota min. 10 znaków, bez auto-aktywacji).</div>' +
              '<div class="form-group"><button type="submit" class="btn btn-primary w-100" title="Zapisuje bieżący stan cennika jako nową wersję (kopia wszystkich pozycji). Nie zmienia cen w ofertach ani cennika na żywo — nowa wersja czeka na aktywację (data przyszła) albo zapisuje się jako wsteczna (data przeszła, wymagana nota min. 10 znaków)."><i data-lucide="save"></i> Zapisz jako wersję</button></div>' +
              '</form>'
            : '<p class="text-muted">Podgląd wersji (zarządzanie wymaga roli admin).</p>';
        return (
            '<div class="modal modal--pv"><div class="modal-header"><h3 id="pv-panel-title"><i data-lucide="layers"></i> Zarządzanie cennikiem (' +
            esc(typeLabel(type)) +
            ')</h3>' +
            '<button class="btn-icon" aria-label="Zamknij" data-pv-act="close"><i data-lucide="x"></i></button></div>' +
            '<div class="modal-body">' +
            '<h4 class="pv-section">Wersje</h4>' +
            saveForm +
            '<div class="table-wrap"><table><thead><tr>' +
            '<th scope="col">Wersja</th><th scope="col">Nr</th><th scope="col">Status</th><th scope="col">Obowiązuje od</th>' +
            '<th scope="col">Autor</th><th scope="col">Nota</th><th scope="col">Akcje</th>' +
            '</tr></thead><tbody id="pv-versions-body"></tbody></table></div>' +
            '<h4 class="pv-section">Transfer plików</h4>' +
            transferHtml(type) +
            '<h4 class="pv-section">Cenniki domyślne</h4>' +
            defaultsHtml(type) +
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
        if (body) body.innerHTML = renderRows(versions, manageable);
        var overlay = document.getElementById('pv-versions-modal');
        if (overlay) icons(overlay);
        return versions;
    }

    function openNoteModal(title, placeholder, onSubmit) {
        window.showModal({
            id: 'pv-note-modal',
            titleId: 'pv-note-title',
            html:
                '<div class="modal"><div class="modal-header"><h3 id="pv-note-title">' +
                esc(title) +
                '</h3>' +
                '<button class="btn-icon" aria-label="Zamknij" onclick="window.closeModal(\'pv-note-modal\')"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body"><div class="form-group"><label for="pv-note-input">Nota (min. 10 znaków)</label>' +
                '<input class="form-input" id="pv-note-input" maxlength="500" placeholder="' +
                escAttr(placeholder) +
                '"></div>' +
                '<div class="form-group"><button class="btn btn-primary" id="pv-note-ok">Zatwierdź</button></div></div></div>'
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
                '<button class="btn-icon" aria-label="Zamknij" onclick="window.closeModal(\'pv-diff-modal\')"><i data-lucide="x"></i></button></div>' +
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
        } catch (e) {
            toast('Błąd eksportu: ' + e.message, 'error');
        }
    }

    /**
     * Panel wersji cennika: formularz „Zapisz jako wersję" + tabela.
     * @param {string} type 'rury' | 'studnie'
     * @param {Function} getRows funkcja zwracająca bieżące wiersze cennika
     */
    async function openVersionsPanel(type, getRows) {
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
                    wirePanel(overlay, type, getRows);
                }
                refreshTable(type, manageable).catch(function (e) {
                    toast('Błąd odświeżenia: ' + e.message, 'error');
                });
                var eff = document.getElementById('pv-eff');
                var warn = document.getElementById('pv-past-warn');
                var nextLabel = document.getElementById('pv-next-label');
                if (eff && warn) {
                    var check = function () {
                        try {
                            warn.style.display =
                                eff.value && new Date(eff.value).getTime() < Date.now() - 60000
                                    ? ''
                                    : 'none';
                            if (nextLabel && eff.value) {
                                nextLabel.value =
                                    versionLabel(next, eff.value) + ' (nr ' + next + ')';
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
            }
        });
    }

    function wirePanel(overlay, type, getRows) {
        overlay.addEventListener('click', function (e) {
            var btn = e.target && e.target.closest ? e.target.closest('[data-pv-act]') : null;
            if (!btn) return;
            var act = btn.getAttribute('data-pv-act');
            var id = btn.getAttribute('data-pv-id');
            if (act === 'close') window.closeModal('pv-versions-modal');
            else if (act === 'diff' && id) openDiff(id);
            else if (act === 'export' && id) {
                exportVersion(id, type, null);
            } else if (act === 'activate' && id) {
                apiJson(API + '/' + encodeURIComponent(id) + '/activate', authed('POST'))
                    .then(function () {
                        toast('Wersja aktywowana', 'success');
                        refreshTable(type, true);
                    })
                    .catch(function (err) {
                        toast('Błąd aktywacji: ' + err.message, 'error');
                    });
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
                if (typeof window.appConfirm === 'function') {
                    window
                        .appConfirm(cloneMsg, {
                            title: 'Przywróć jako roboczą',
                            okText: 'Klonuj',
                            type: 'warning'
                        })
                        .then(function (ok) {
                            if (ok) doClone();
                        });
                } else if (window.confirm(cloneMsg)) {
                    doClone();
                }
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
                if (typeof window.appConfirm === 'function') {
                    window
                        .appConfirm(deleteMsg, {
                            title: 'Usuń wersję',
                            okText: 'Usuń',
                            type: 'danger'
                        })
                        .then(function (ok) {
                            if (ok) doDelete();
                        });
                } else if (window.confirm(deleteMsg)) {
                    doDelete();
                }
            }
        });
        var form = overlay.querySelector('#pv-save-form');
        if (form) {
            form.addEventListener('submit', function (ev) {
                ev.preventDefault();
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
                    rows = getRows();
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
            });
        }
    }

    window.pricelistVersions = {
        fetchLabels: fetchLabels,
        fetchFullList: fetchFullList,
        badgeHtml: badgeHtml,
        hydrateBadges: hydrateBadges,
        openVersionsPanel: openVersionsPanel,
        openDiff: openDiff
    };
})();
