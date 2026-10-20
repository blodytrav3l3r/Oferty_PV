// @ts-check
/* ===== PODGLĄD WERSJI CENNIKA (admin, tylko odczyt) ===== */
/* Modal z arkuszami wersji + porównanie z dowolną wersją (openDiff). */
/* Zależności: window.pricelistVersions (fetch + api helpery), showModal, lucide. */

(function () {
    'use strict';

    var API = '/api/pricelist-versions';
    // ponytail: render max 1000 wierszy/arkusz; serwer capuje 5000, pełnia w eksporcie.
    var RENDER_LIMIT = 1000;
    var SHEET_LABELS = {
        PRECO_Kinety: 'Kinety',
        PRECO_Zakresy: 'Zakresy',
        PRECO_Dodatki: 'Dodatki'
    };

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

    function apiJson() {
        var pv = window.pricelistVersions;
        if (!pv || typeof pv._apiJson !== 'function') {
            return Promise.reject(new Error('Moduł wersji cennika nie jest załadowany'));
        }
        return pv._apiJson.apply(null, arguments);
    }

    function authed() {
        var pv = window.pricelistVersions;
        if (!pv || typeof pv._authed !== 'function') return { method: 'GET', headers: {} };
        return pv._authed.apply(null, arguments);
    }

    function fmtDate(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString();
        } catch (_e) {
            return String(iso);
        }
    }

    function cellText(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch (_e) {
                return '[obiekt]';
            }
        }
        return String(value);
    }

    function sheetLabel(name) {
        return SHEET_LABELS[name] || name;
    }

    function rowsFor(preview, sheet) {
        return (preview.sheets && preview.sheets[sheet]) || [];
    }

    function filterRows(rows, query) {
        var q = String(query || '')
            .trim()
            .toLowerCase();
        if (!q) return rows;
        return rows.filter(function (row) {
            return Object.keys(row).some(function (key) {
                return cellText(row[key]).toLowerCase().indexOf(q) !== -1;
            });
        });
    }

    function tableHtml(rows) {
        if (rows.length === 0) {
            return '<p class="text-muted pv-preview-empty">Brak wierszy w tym arkuszu.</p>';
        }
        var columns = Object.keys(rows[0]);
        var shown = rows.slice(0, RENDER_LIMIT);
        var head = columns
            .map(function (col) {
                return '<th scope="col">' + esc(col) + '</th>';
            })
            .join('');
        var body = shown
            .map(function (row) {
                return (
                    '<tr>' +
                    columns
                        .map(function (col) {
                            return '<td>' + esc(cellText(row[col])) + '</td>';
                        })
                        .join('') +
                    '</tr>'
                );
            })
            .join('');
        return (
            '<div class="table-wrap pv-preview-scroll" tabindex="0" role="region" aria-label="Wiersze wersji">' +
            '<table><thead><tr>' +
            head +
            '</tr></thead><tbody>' +
            body +
            '</tbody></table></div>' +
            (rows.length > RENDER_LIMIT
                ? '<p class="text-muted">Pokazano pierwsze ' +
                  RENDER_LIMIT +
                  ' z ' +
                  rows.length +
                  ' wierszy — zawęź wyszukiwaniem albo użyj eksportu.</p>'
                : '')
        );
    }

    function tabsHtml(sheetNames, active) {
        if (sheetNames.length < 2) return '';
        return (
            '<div class="pv-preview-tabs" role="tablist" aria-label="Arkusze wersji">' +
            sheetNames
                .map(function (name) {
                    var isActive = name === active;
                    return (
                        '<button type="button" role="tab" class="btn btn-sm ' +
                        (isActive ? 'btn-primary' : 'btn-secondary') +
                        '" data-pv-preview-sheet="' +
                        escAttr(name) +
                        '" aria-selected="' +
                        (isActive ? 'true' : 'false') +
                        '">' +
                        esc(sheetLabel(name)) +
                        '</button>'
                    );
                })
                .join('') +
            '</div>'
        );
    }

    function metaHtml(preview) {
        var version = preview.version || {};
        var sheetCount = Object.keys(preview.sheets || {}).length;
        var bits = [
            '<span><strong>Typ:</strong> ' + esc(version.type || '—') + '</span>',
            '<span><strong>Status:</strong> ' + esc(version.status || '—') + '</span>',
            '<span><strong>Obowiązuje od:</strong> ' +
                esc(fmtDate(version.effectiveFrom)) +
                '</span>',
            '<span><strong>Wiersze:</strong> ' + esc(String(preview.totalRows ?? 0)) + '</span>',
            '<span><strong>Arkusze:</strong> ' + esc(String(sheetCount)) + '</span>'
        ];
        var extra = '';
        if (preview.truncated) {
            extra +=
                '<p class="color-warn">Podgląd ucięty do 5000 wierszy na arkusz — pełne dane w eksporcie XLSX.</p>';
        }
        if (preview.precoVersion) {
            extra +=
                '<p class="text-muted">Do wersji dołączona PRECO ' +
                esc(preview.precoVersion.version) +
                ' (nr ' +
                esc(String(preview.precoVersion.seq)) +
                ').</p>';
        } else if (preview.precoIncluded === false) {
            extra +=
                '<p class="text-muted">Brak kwalifikującej się wersji PRECO — eksport obejmie tylko studnie.</p>';
        }
        return '<div class="pv-preview-meta text-muted">' + bits.join('') + '</div>' + extra;
    }

    function renderPreview(overlay, state) {
        var preview = state.preview;
        var sheetNames = Object.keys(preview.sheets || {});
        if (state.sheet && sheetNames.indexOf(state.sheet) === -1) state.sheet = sheetNames[0];
        if (!state.sheet) state.sheet = sheetNames[0];
        var meta = overlay.querySelector('#pv-preview-meta');
        if (meta) meta.innerHTML = metaHtml(preview);
        var tabs = overlay.querySelector('#pv-preview-tabs');
        if (tabs) tabs.innerHTML = tabsHtml(sheetNames, state.sheet);
        var body = overlay.querySelector('#pv-preview-body');
        if (body)
            body.innerHTML = state.sheet
                ? tableHtml(filterRows(rowsFor(preview, state.sheet), state.query))
                : '<p class="text-muted pv-preview-empty">Wersja nie ma zapisanych wierszy.</p>';
        var counter = overlay.querySelector('#pv-preview-count');
        if (counter) {
            var total = state.sheet ? rowsFor(preview, state.sheet).length : 0;
            var visible = state.sheet
                ? filterRows(rowsFor(preview, state.sheet), state.query).length
                : 0;
            counter.textContent =
                'Widoczne: ' +
                visible +
                ' / ' +
                total +
                ' w arkuszu · łącznie ' +
                (preview.totalRows ?? 0) +
                ' w wersji';
        }
        icons(overlay);
    }

    function openPreview(id, type) {
        var state = { preview: null, sheet: null, query: '' };
        window.showModal({
            id: 'pv-preview-modal',
            titleId: 'pv-preview-title',
            html:
                '<div class="modal modal--pv-preview"><div class="modal-header"><h3 id="pv-preview-title"><i data-lucide="eye"></i> Podgląd wersji cennika</h3>' +
                '<button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;pv-preview-modal&quot;]"><i data-lucide="x"></i></button></div>' +
                '<div class="modal-body"><div id="pv-preview-meta"><p class="text-muted">Ładowanie…</p></div>' +
                '<div class="pv-preview-toolbar">' +
                '<label class="pv-preview-search"><span class="sr-only">Szukaj w wersji</span>' +
                '<input type="search" class="form-input" id="pv-preview-search" placeholder="Szukaj w wersji (indeks, nazwa, cena)…" aria-label="Szukaj w wersji"></label>' +
                '<span class="text-muted" id="pv-preview-count" aria-live="polite"></span>' +
                '</div>' +
                '<div id="pv-preview-tabs" role="tablist" aria-label="Arkusze wersji"></div>' +
                '<div id="pv-preview-body" aria-live="polite"></div>' +
                '</div></div>'
        });
        var overlay = document.getElementById('pv-preview-modal');
        icons(overlay);
        if (!overlay) return;
        overlay.addEventListener('click', function (ev) {
            var tab =
                ev.target && ev.target.closest
                    ? ev.target.closest('[data-pv-preview-sheet]')
                    : null;
            if (!tab || !state.preview) return;
            state.sheet = tab.getAttribute('data-pv-preview-sheet');
            renderPreview(overlay, state);
        });
        var search = overlay.querySelector('#pv-preview-search');
        if (search) {
            var timer = null;
            search.addEventListener('input', function () {
                state.query = search.value || '';
                if (timer) clearTimeout(timer);
                timer = setTimeout(function () {
                    renderPreview(overlay, state);
                }, 120);
            });
        }
        apiJson(API + '/' + encodeURIComponent(id) + '/preview', authed('GET'))
            .then(function (preview) {
                state.preview = preview;
                state.sheet = Object.keys(preview.sheets || {})[0] || null;
                var title = overlay.querySelector('#pv-preview-title');
                if (title) {
                    title.innerHTML =
                        '<i data-lucide="eye"></i> Podgląd ' +
                        esc((preview.version && preview.version.version) || id) +
                        (type ? ' · ' + esc(type) : '');
                }
                renderPreview(overlay, state);
            })
            .catch(function (err) {
                var body = overlay.querySelector('#pv-preview-body');
                if (body) {
                    body.innerHTML = '<p class="color-warn">Nie udało się wczytać podglądu.</p>';
                }
                toast('Błąd podglądu wersji: ' + err.message, 'error');
            });
    }

    function normalizeType(type) {
        return type === 'rury' || type === 'studnie' || type === 'preco' ? type : null;
    }

    function openFromDeepLink(opts) {
        var o = opts || {};
        var type = normalizeType(o.type);
        if (!o.versionId) return false;
        if (o.againstId && window.pricelistVersions) {
            window.pricelistVersions.openDiff(o.versionId, o.againstId, type);
            return true;
        }
        openPreview(o.versionId, type);
        return true;
    }

    if (!window.pricelistVersions) return;
    window.pricelistVersions.openPreview = openPreview;
    window.pricelistVersions.openCompare = function (id, againstId, type) {
        return window.pricelistVersions.openDiff(id, againstId, type);
    };
    window.pricelistVersions.openFromDeepLink = openFromDeepLink;
})();
