// @ts-check
/**
 * Warstwa renderowania UI Kartoteki Zleceń Produkcyjnych.
 * Wyodrębniona z zlecenia.js (zasada SRP) — wyłącznie budowa HTML
 * i aktualizacja widoku. Stan przekazywany jest jawnie przez zlecenia.js.
 */

const ZleceniaRender = (() => {
    const { formatDate, escapeHtml, escapeJsStr } = window;

    const statusMap = {
        draft: {
            label: 'Oczekujące',
            class: 'status-draft',
            icon: '<i data-lucide="hourglass-2"></i>'
        },
        accepted: {
            label: 'Zatwierdzone',
            class: 'status-accepted',
            icon: '<i data-lucide="check-check"></i>'
        }
    };

    function showLoadingSpinner(hasItems) {
        if (hasItems) return; // nie kasuj podczas loadMore
        const tbody = document.getElementById('zlecenia-table-body');
        if (!tbody) return;
        tbody.innerHTML =
            '<tr class="zlecenia-empty"><td colspan="10">Ładowanie danych z serwera...</td></tr>';
    }

    function showError(message) {
        const tbody = document.getElementById('zlecenia-table-body');
        if (tbody) {
            tbody.innerHTML =
                '<tr class="zlecenia-empty"><td class="is-error" colspan="10">Wystąpił błąd: ' +
                escapeHtml(message) +
                '</td></tr>';
        }
    }

    /* ===== STATYSTYKI ===== */

    function renderStats(state) {
        const container = document.getElementById('zlecenia-stats');
        if (!container) return;

        const items = state ? state.items : [];
        const stats = state ? state.stats : null;

        let total;
        let accepted;
        let draft;
        let todayCount;
        if (stats) {
            // Agregaty całego zbioru (rola użytkownika + aktywne filtry) z odpowiedzi search
            total = stats.total;
            accepted = stats.accepted;
            draft = stats.draft;
            todayCount = stats.today;
        } else {
            // Fallback: odpowiedź bez agregatów — liczby z załadowanego okna
            total = state && state.totalCount ? state.totalCount : items.length;
            accepted = items.filter((o) => o.status === 'accepted').length;
            draft = items.filter((o) => o.status !== 'accepted').length;
            const today = new Date().toISOString().slice(0, 10);
            todayCount = items.filter(
                (o) => o.createdAt && o.createdAt.slice(0, 10) === today
            ).length;
        }

        const sourceLabel = stats ? 'z całego zbioru' : 'z załadowanych';

        container.innerHTML = `
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon zlecenia-stat-icon--accent"><i data-lucide="layers" aria-hidden="true"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${total}</div>
                    <div class="zlecenia-stat-label">Wszystkie zlecenia</div>
                    <div class="zlecenia-stat-source">${sourceLabel}</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon zlecenia-stat-icon--success"><i data-lucide="check-check" aria-hidden="true"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${accepted}</div>
                    <div class="zlecenia-stat-label">Zatwierdzone</div>
                    <div class="zlecenia-stat-source">${sourceLabel}</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon zlecenia-stat-icon--warn"><i data-lucide="hourglass-2" aria-hidden="true"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${draft}</div>
                    <div class="zlecenia-stat-label">Oczekujące</div>
                    <div class="zlecenia-stat-source">${sourceLabel}</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon zlecenia-stat-icon--purple"><i data-lucide="zap" aria-hidden="true"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${todayCount}</div>
                    <div class="zlecenia-stat-label">Dodane dziś</div>
                    <div class="zlecenia-stat-source">${sourceLabel}</div>
                </div>
            </div>
        `;
        lucide.createIcons({ root: container });
    }

    /* ===== RENDEROWANIE TABELI ===== */

    function renderTable(state) {
        const tbody = document.getElementById('zlecenia-table-body');
        if (!tbody) return 0;

        const items = state.items;
        const selectedIds = state.selectedIds;

        if (items.length === 0) {
            tbody.innerHTML =
                '<tr class="zlecenia-empty"><td colspan="10">Brak zlece\u0144 spe\u0142niaj\u0105cych kryteria.</td></tr>';
            updateSentinel(state);
            const emptyState = updateSelectAllState(0, selectedIds.size);
            updateBatchBar(emptyState, 0, selectedIds.size);
            return emptyState;
        }

        const html = items.map((o) => renderOrderRow(o, selectedIds)).join('');

        tbody.innerHTML = html;
        // Z-40: title dla komórek z ellipsis (a11y + tooltip)
        tbody.querySelectorAll('td').forEach((td) => {
            const txt = td.textContent ? td.textContent.trim() : '';
            if (txt) td.title = txt;
        });
        lucide.createIcons({ root: tbody });
        updateAnimationGate(items);

        updateSentinel(state);

        const nextState = updateSelectAllState(items.length, selectedIds.size);
        updateBatchBar(nextState, items.length, selectedIds.size);
        return nextState;
    }

    function renderOrderRow(o, selectedIds) {
        const statusConfig = statusMap[o.status] || {
            label: o.status || 'Nieznany',
            class: '',
            icon: '<i data-lucide="help-circle"></i>'
        };

        const orderNum = o.productionOrderNumber
            ? '<span class="order-num">' + escapeHtml(o.productionOrderNumber) + '</span>'
            : '<span class="order-num-missing">\u2014 brak \u2014</span>';

        const salesOrderLabel =
            o.dbSalesOrderNumber || o.salesOrderNumber
                ? '<span class="sales-order-badge">' +
                  escapeHtml(o.dbSalesOrderNumber || o.salesOrderNumber) +
                  '</span>'
                : '<span style="color:var(--text-muted); font-size: var(--fs-base);">\u2014</span>';

        const wellName = o.wellName || '\u2014';
        const projectName = o.projectName || o.obiekt || '';
        const elementInfo =
            o.elementName ||
            o.productName ||
            (o.elementIndex !== undefined ? 'Element #' + o.elementIndex : '\u2014');

        const isDraft = o.status !== 'accepted' && Boolean(o.id);
        const isChecked = selectedIds.has(o.id);

        // Przyciski akcji
        let actions = '';
        if (o.offerId) {
            actions +=
                '<button class="action-btn action-btn-edit" onclick="AppZlecenia.editOrder(\'' +
                escapeJsStr(o.offerId) +
                "', '" +
                escapeJsStr(o.wellId || '') +
                "', '" +
                escapeJsStr(o.elementIndex !== undefined ? o.elementIndex : '') +
                "', '" +
                escapeJsStr(o.dbSalesOrderId || '') +
                '\')" title="Edytuj" aria-label="Edytuj"><i data-lucide="pencil" aria-hidden="true"></i></button>';
        }
        actions +=
            '<button class="action-btn" aria-label="Drukuj zlecenie" onclick="AppZlecenia.printSingleZlecenie(\'' +
            escapeJsStr(o.id) +
            '\')" title="Drukuj zlecenie"><i data-lucide="printer" aria-hidden="true"></i></button>';
        actions +=
            '<button class="action-btn" aria-label="Drukuj etykiet\u0119" onclick="AppZlecenia.printSingleEtykieta(\'' +
            escapeJsStr(o.id) +
            '\')" title="Drukuj etykiet\u0119"><i data-lucide="tag" aria-hidden="true"></i></button>';
        if (isDraft) {
            actions +=
                '<button class="action-btn action-btn-delete" aria-label="Usu\u0144 zlecenie" onclick="AppZlecenia.deleteOrder(\'' +
                escapeJsStr(o.id) +
                '\')" title="Usu\u0144 zlecenie"><i data-lucide="trash-2" aria-hidden="true"></i></button>';
        }

        return (
            '<tr>\n' +
            '<td style="width:40px; text-align:center;">\n' +
            '<input type="checkbox" class="zlecenia-row-cb" data-id="' +
            escapeJsStr(o.id) +
            '" ' +
            (isChecked ? 'checked' : '') +
            ' aria-label="Zaznacz zlecenie ' +
            escapeJsStr(o.productionOrderNumber || o.id) +
            '">\n' +
            '</td>\n' +
            '<td>' +
            orderNum +
            '</td>\n' +
            '<td class="date-cell">' +
            formatDate(o.createdAt) +
            '</td>\n' +
            '<td>\n' +
            '<div class="well-cell-name">' +
            escapeHtml(wellName) +
            '</div>\n' +
            (projectName
                ? '<div class="well-cell-project">' + escapeHtml(projectName) + '</div>\n'
                : '') +
            '</td>\n' +
            '<td>' +
            salesOrderLabel +
            '</td>\n' +
            '<td class="element-cell">' +
            escapeHtml(elementInfo) +
            '</td>\n' +
            '<td><span class="person-badge person-handler"><i data-lucide="user" aria-hidden="true"></i> ' +
            escapeHtml(o.handlerName || '\u2014') +
            '</span></td>\n' +
            '<td><span class="person-badge person-creator"><i data-lucide="settings" aria-hidden="true"></i> ' +
            escapeHtml(o.creatorName || '\u2014') +
            '</span></td>\n' +
            '<td><span class="status-badge ' +
            statusConfig.class +
            '">' +
            statusConfig.icon +
            ' ' +
            escapeHtml(statusConfig.label) +
            '</span></td>\n' +
            '<td class="text-right">\n' +
            '<div style="display:flex; gap:0.25rem; justify-content:flex-end;">\n' +
            actions +
            '\n</div>\n</td>\n</tr>'
        );
    }

    /* ===== INFINITE SCROLL (SENTINEL) ===== */

    function updateSentinel(state) {
        const sentinel = document.getElementById('zlecenia-sentinel');
        if (!sentinel) return;
        const loaded = state.items.length;
        if (loaded === 0) {
            sentinel.classList.add('hidden');
            sentinel.setAttribute('aria-busy', 'false');
            return;
        }
        sentinel.classList.remove('hidden');
        sentinel.setAttribute('aria-busy', state.hasMore ? 'true' : 'false');
        const total = state.totalCount != null ? state.totalCount : loaded;
        sentinel.innerHTML = state.hasMore
            ? '<div class="zlecenia-sentinel-spin"></div><span>Wczytuję kolejne…</span>'
            : '<span>Koniec listy — ' + loaded + '/' + total + '</span>';
    }

    /* ===== FILTRY / GATE ANIMACJI ===== */

    /* Licznik aktywnych filtrów przy przycisku czyszczenia */
    function updateChips(activeFilter) {
        const qInput = document.getElementById('zlecenia-search-input');
        const fromInput = document.getElementById('zlecenia-date-from');
        const toInput = document.getElementById('zlecenia-date-to');
        const userSelect = document.getElementById('zlecenia-user-filter');
        const q = qInput ? qInput.value.trim() : '';
        const dateFrom = fromInput ? fromInput.value : '';
        const dateTo = toInput ? toInput.value : '';
        const userId = userSelect ? userSelect.value : '';

        const count =
            (dateFrom || dateTo ? 1 : 0) +
            (userId ? 1 : 0) +
            (q ? 1 : 0) +
            (activeFilter !== 'all' ? 1 : 0);
        const clearBtn = document.getElementById('zlecenia-clear-filters');
        if (clearBtn) {
            clearBtn.textContent = 'Wyczyść filtry (' + count + ')';
        }
    }

    /* Gate animacji: wyłącz pulse-draft przy dużej liczbie oczekujących (jank scroll) */
    function updateAnimationGate(items) {
        const table = document.getElementById('zlecenia-table');
        if (!table) return;
        const draftCount = items.filter((o) => o.status !== 'accepted').length;
        table.classList.toggle('zlecenia-table--flat', draftCount > 200);
    }

    /* ===== SELECTION (widok) ===== */

    function updateSelectAllState(loaded, selected) {
        const master = document.getElementById('zlecenia-select-all');
        if (!master) return 0;
        let selectState;
        if (selected === 0) {
            selectState = 0;
            master.checked = false;
            master.indeterminate = false;
        } else if (loaded > 0 && selected >= loaded) {
            selectState = 2;
            master.checked = true;
            master.indeterminate = false;
        } else {
            selectState = 1;
            master.checked = false;
            master.indeterminate = true;
        }
        master.setAttribute(
            'aria-checked',
            master.indeterminate ? 'mixed' : master.checked ? 'true' : 'false'
        );
        return selectState;
    }

    function updateBatchBar(selectState, loaded, selected) {
        const bar = document.getElementById('zlecenia-batch-bar');
        if (!bar) return;

        const batchCountEl = bar.querySelector('.batch-count');
        const scopeEl = bar.querySelector('.batch-scope');

        if (selectState === 2) {
            // Wszystkie załadowane spełniające filtr
            if (batchCountEl) batchCountEl.textContent = String(loaded);
            if (scopeEl) scopeEl.textContent = '— wszystkie spełniające filtr';
        } else {
            if (batchCountEl) batchCountEl.textContent = String(selected);
            if (scopeEl) scopeEl.textContent = selected > 0 ? '— widoczne' : '';
        }
        updateSelectAllButton(selectState);
    }

    function updateSelectAllButton(selectState) {
        const btn = document.getElementById('zlecenia-select-all-btn');
        if (!btn) return;
        const hasSelection = selectState > 0;
        const icon = btn.querySelector('i');
        if (icon) icon.setAttribute('data-lucide', hasSelection ? 'x-square' : 'check-check');
        btn.lastChild.textContent = hasSelection ? ' Odznacz wszystkie' : ' Zaznacz wszystkie';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons({ root: btn });
        }
    }

    return {
        showLoadingSpinner,
        showError,
        renderStats,
        renderTable,
        renderOrderRow,
        updateSentinel,
        updateChips,
        updateAnimationGate,
        updateSelectAllState,
        updateBatchBar,
        updateSelectAllButton
    };
})();
window.zleceniaRender = ZleceniaRender;
