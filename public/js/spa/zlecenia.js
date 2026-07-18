// @ts-check
/**
 * Logic for Kartoteka Zleceń Produkcyjnych — wersja z paginacją
 */

const AppZlecenia = (() => {
    let searchResults = null; // { items, totalCount, hasMore, nextCursor, nextCursorId }
    let activeFilter = 'all'; // 'all' | 'draft' | 'accepted'
    let selectedIds = new Set(); // multi-select for batch print
    let autoRefreshInterval = null;
    let isLoading = false;
    let abortController = null;
    let searchDebounceTimer = null;

    const {
        formatDate,
        escapeHtml,
        escapeJsStr,
        fetchTemplate,
        silentPrint,
        buildZlecenieFromPO,
        buildEtykietaFromPO,
        buildZlecenieFromPageBlock,
        buildEtykietaPageBlock
    } = window;

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

    /* ===== INIT ===== */

    async function init() {
        const token = getAuthToken();
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        setupSearch();
        await searchOffers(buildSearchParams());
    }

    function showLoadingSpinner() {
        const tbody = document.getElementById('zlecenia-table-body');
        if (!tbody) return;
        if (searchResults && searchResults.items.length > 0) return; // nie kasuj podczas loadMore
        tbody.innerHTML =
            '<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted); font-style:italic;">Ładowanie danych z serwera...</td></tr>';
    }

    function showError(message) {
        const tbody = document.getElementById('zlecenia-table-body');
        if (tbody) {
            tbody.innerHTML =
                '<tr><td colspan="10" style="text-align:center; padding:2.5rem; color:var(--danger);">Wystąpił błąd: ' +
                escapeHtml(message) +
                '</td></tr>';
        }
    }

    /* ===== WYSZUKIWANIE I FILTROWANIE ===== */

    function buildSearchParams() {
        const input = document.getElementById('zlecenia-search-input');
        const q = input ? input.value.trim() : '';

        return {
            q,
            status: activeFilter,
            dateFrom: '',
            dateTo: '',
            userId: '',
            limit: 50,
            sort: 'createdAt',
            order: 'desc'
        };
    }

    function setupSearch() {
        const input = document.getElementById('zlecenia-search-input');
        if (input) {
            input.addEventListener('input', () => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    searchOffers(buildSearchParams());
                }, 300);
            });
        }
    }

    function setFilter(filter) {
        activeFilter = filter;
        document.querySelectorAll('.zlecenia-filter-tab').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        searchOffers(buildSearchParams());
    }

    /* ===== DATA LOADING ===== */

    async function searchOffers(params) {
        if (abortController) {
            abortController.abort();
        }
        abortController = new AbortController();

        isLoading = true;
        const isLoadMore = !!params.cursor;

        if (!isLoadMore) {
            showLoadingSpinner();
        }

        const headers = authHeaders?.() || { 'Content-Type': 'application/json' };

        const qs = new URLSearchParams({
            q: params.q || '',
            status: params.status || 'all',
            dateFrom: params.dateFrom || '',
            dateTo: params.dateTo || '',
            userId: params.userId || '',
            limit: String(params.limit || 50),
            sort: params.sort || 'createdAt',
            order: params.order || 'desc',
            cursor: params.cursor || '',
            cursorId: params.cursorId || '',
            t: String(Date.now())
        }).toString();

        try {
            const resp = await fetch('/api/orders-studnie/production/search?' + qs, {
                headers,
                signal: abortController.signal
            });

            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const json = await resp.json();

            if (isLoadMore) {
                searchResults.items = [...searchResults.items, ...(json.data || [])];
                searchResults.hasMore = json.hasMore;
                searchResults.nextCursor = json.nextCursor;
                searchResults.nextCursorId = json.nextCursorId;
            } else {
                selectedIds.clear();
                searchResults = {
                    items: json.data || [],
                    totalCount: json.totalCount || 0,
                    hasMore: json.hasMore,
                    nextCursor: json.nextCursor,
                    nextCursorId: json.nextCursorId
                };
            }

            renderStats();
            renderTable();
            startAutoRefresh();
        } catch (error) {
            if (error.name === 'AbortError') return;
            logger.error('zlecenia', 'searchOffers error:', error);
            showError(error.message);
        } finally {
            isLoading = false;
        }
    }

    function loadMore() {
        if (isLoading || !searchResults?.hasMore) return;
        const params = buildSearchParams();
        params.cursor = searchResults.nextCursor;
        params.cursorId = searchResults.nextCursorId;
        searchOffers(params);
    }

    async function loadOrders() {
        // Zachowane dla kompatybilności — zewnętrzne wywołania (np. router.refreshModule)
        await searchOffers(buildSearchParams());
    }

    function startAutoRefresh() {
        stopAutoRefresh();
        autoRefreshInterval = setInterval(() => {
            if (!document.hidden && selectedIds.size === 0) {
                searchOffers(buildSearchParams());
            }
        }, 60000);
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    /* ===== STATYSTYKI ===== */

    function renderStats() {
        const container = document.getElementById('zlecenia-stats');
        if (!container) return;

        const total = searchResults ? searchResults.totalCount || searchResults.items.length : 0;
        const items = searchResults ? searchResults.items : [];
        const accepted = items.filter((o) => o.status === 'accepted').length;
        const draft = items.filter((o) => o.status !== 'accepted').length;
        const today = new Date().toISOString().slice(0, 10);
        const todayCount = items.filter(
            (o) => o.createdAt && o.createdAt.slice(0, 10) === today
        ).length;

        container.innerHTML = `
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon" style="background:rgba(var(--accent-hover-rgb),0.1); color:var(--accent-hover);"><i data-lucide="layers" aria-hidden="true"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${total}</div>
                    <div class="zlecenia-stat-label">Wszystkie zlecenia</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon" style="background:rgba(var(--success-rgb),0.1); color:var(--success-hover);"><i data-lucide="check-check" aria-hidden="true"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${accepted}</div>
                    <div class="zlecenia-stat-label">Zatwierdzone</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon" style="background:rgba(var(--warn-rgb),0.1); color:var(--warn-hover);"><i data-lucide="hourglass-2" aria-hidden="true"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${draft}</div>
                    <div class="zlecenia-stat-label">Oczekujące</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon" style="background:rgba(168,85,247,0.1); color:#c084fc;"><i data-lucide="zap" aria-hidden="true"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${todayCount}</div>
                    <div class="zlecenia-stat-label">Dodane dziś</div>
                </div>
            </div>
        `;
    }

    /* ===== SELECTION ===== */

    function toggleSelect(id, checkbox) {
        if (checkbox.checked) {
            selectedIds.add(id);
        } else {
            selectedIds.delete(id);
        }
        updateBatchBar();
    }

    function toggleSelectAll(masterCheckbox) {
        const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
        checkboxes.forEach((cb) => {
            cb.checked = masterCheckbox.checked;
            const id = cb.dataset.id;
            if (masterCheckbox.checked) {
                selectedIds.add(id);
            } else {
                selectedIds.delete(id);
            }
        });
        updateBatchBar();
    }

    function updateBatchBar() {
        const bar = document.getElementById('zlecenia-batch-bar');
        if (!bar) return;

        if (selectedIds.size > 0) {
            bar.style.display = 'flex';
            const batchCountEl = bar.querySelector('.batch-count');
            if (batchCountEl) batchCountEl.textContent = String(selectedIds.size);
        } else {
            bar.style.display = 'none';
        }
    }

    /* ===== RENDEROWANIE TABELI ===== */

    function renderTable() {
        const tbody = document.getElementById('zlecenia-table-body');
        if (!tbody) return;

        const items = searchResults?.items || [];

        if (items.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="10" style="text-align:center; padding:2.5rem; color:var(--text-muted); font-style:italic;">Brak zlece\u0144 spe\u0142niaj\u0105cych kryteria.</td></tr>';
            updateBatchBar();
            return;
        }

        const html = items.map(renderOrderRow).join('');

        tbody.innerHTML = html;

        // Load more button
        if (searchResults && searchResults.hasMore) {
            const shown = searchResults.items.length;
            const total = searchResults.totalCount;
            const label =
                total != null
                    ? 'Poka\u017C wi\u0119cej (' + shown + ' z ' + total + ')'
                    : 'Poka\u017C wi\u0119cej';
            const tr = document.createElement('tr');
            tr.innerHTML =
                '<td colspan="10" style="text-align:center;padding:1rem;">' +
                '<button class="btn btn-sm btn-secondary" id="zlecenia-load-more-btn">' +
                label +
                '</button></td>';
            tbody.appendChild(tr);
            document
                .getElementById('zlecenia-load-more-btn')
                ?.addEventListener('click', () => loadMore());
        }

        updateBatchBar();
    }

    function renderOrderRow(o) {
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
                : '<span style="color:var(--text-muted); font-size:0.75rem;">\u2014</span>';

        const wellName = o.wellName || '\u2014';
        const projectName = o.projectName || o.obiekt || '';
        const elementInfo =
            o.elementName ||
            o.productName ||
            (o.elementIndex !== undefined ? 'Element #' + o.elementIndex : '\u2014');

        const isAccepted = o.status === 'accepted';
        const isDraft = !isAccepted && o.id;
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
            ' onclick="AppZlecenia.toggleSelect(\'' +
            escapeJsStr(o.id) +
            '\', this)" style="cursor:pointer; width:16px; height:16px; accent-color:var(--accent-hover);">\n' +
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
            statusConfig.label +
            '</span></td>\n' +
            '<td style="text-align:right">\n' +
            '<div style="display:flex; gap:0.25rem; justify-content:flex-end;">\n' +
            actions +
            '\n</div>\n</td>\n</tr>'
        );
    }

    /* ===== PRINT ACTIONS ===== */

    function findOrderById(orderId) {
        if (!searchResults) return null;
        return searchResults.items.find((o) => o.id === orderId) || null;
    }

    async function printSingleZlecenie(orderId) {
        const po = findOrderById(orderId);
        if (!po) {
            showToast('Nie znaleziono zlecenia', 'error');
            return;
        }

        showToast('Generowanie zlecenia...', 'info');

        const template = await fetchTemplate('templates/zlecenie.html');
        if (!template) return;

        const html = buildZlecenieFromPO(template, po);
        silentPrint(html);
    }

    async function printSingleEtykieta(orderId) {
        const po = findOrderById(orderId);
        if (!po) {
            showToast('Nie znaleziono zlecenia', 'error');
            return;
        }

        showToast('Generowanie etykiety...', 'info');

        const template = await fetchTemplate('templates/etykieta.html');
        if (!template) return;

        const html = buildEtykietaFromPO(template, po);
        silentPrint(html);
    }

    async function printBatchZlecenia() {
        if (selectedIds.size === 0) {
            showToast('Zaznacz zlecenia do wydruku', 'error');
            return;
        }

        const orders = [];
        if (searchResults) {
            selectedIds.forEach((id) => {
                const o = searchResults.items.find((item) => item.id === id);
                if (o) orders.push(o);
            });
        }

        if (orders.length === 0) {
            showToast('Brak zlece\u0144 do wydruku', 'error');
            return;
        }

        showToast('Generowanie ' + orders.length + ' zlece\u0144...', 'info');

        const template = await fetchTemplate('templates/zlecenie.html');
        if (!template) return;

        // Wyodrębnij blok strony wielokrotnego użytku z surowego szablonu
        const pageStartIdx = template.indexOf('<div class="page">');
        const bodyEndIdx = template.lastIndexOf('</body>');
        if (pageStartIdx < 0 || bodyEndIdx < 0) {
            showToast('B\u0142\u0105d szablonu zlecenia \u2014 brak bloku .page', 'error');
            return;
        }

        const headSection = template.substring(0, template.indexOf('</head>'));
        const pageTemplate = template.substring(pageStartIdx, bodyEndIdx).trim();
        const batchPageStyle =
            '<style>.page { page-break-after: always; } .page:last-child { page-break-after: auto; }</style>';

        // Wypełnij szablon strony dla każdego zamówienia
        let allPages = '';
        orders.forEach((po) => {
            allPages += buildZlecenieFromPageBlock(pageTemplate, po) + '\n';
        });

        const finalHTML =
            headSection + batchPageStyle + '</head>\n<body>\n' + allPages + '</body></html>';
        silentPrint(finalHTML);
    }

    async function printBatchEtykiety() {
        if (selectedIds.size === 0) {
            showToast('Zaznacz zlecenia do wydruku', 'error');
            return;
        }

        const orders = [];
        if (searchResults) {
            selectedIds.forEach((id) => {
                const o = searchResults.items.find((item) => item.id === id);
                if (o) orders.push(o);
            });
        }

        if (orders.length === 0) {
            showToast('Brak zlece\u0144 do wydruku', 'error');
            return;
        }

        showToast('Generowanie ' + orders.length + ' etykiet...', 'info');

        const template = await fetchTemplate('templates/etykieta.html');
        if (!template) return;

        // Wyodrębnij wielokrotnego użytku blok strony i funkcję fitSvgText z szablonu
        const pageStartIdx = template.indexOf('<div class="page">');
        const pageEndComment = template.indexOf('<!-- KONIEC BLOKU "page" -->');
        if (pageStartIdx < 0 || pageEndComment < 0) {
            showToast('B\u0142\u0105d szablonu etykiety \u2014 brak bloku .page', 'error');
            return;
        }

        const headSection = template.substring(0, template.indexOf('</head>'));
        const pageTemplate = template
            .substring(pageStartIdx, pageEndComment + '<!-- KONIEC BLOKU "page" -->'.length)
            .trim();
        const batchPageStyle =
            '<style>.page { page-break-after: always; } .page:last-child { page-break-after: auto; }</style>';

        // Zbuduj każdą stronę z unikalnymi ID SVG
        let allPages = '';
        let allFitCalls = '';

        orders.forEach((po, i) => {
            const populatedPage = buildEtykietaPageBlock(pageTemplate, po, i);
            allPages += populatedPage + '\n';
            allFitCalls += "fitSvgText('snr-svg-" + i + "'); fitSvgText('order-svg-" + i + "');\n";
        });

        // Zbuduj końcowy dokument ze skryptem dopasowania SVG
        const fitScript =
            '\n<script>\nfunction runAllFit() {\n' +
            allFitCalls +
            '}\nif (document.fonts && document.fonts.ready) {\n    document.fonts.ready.then(runAllFit);\n} else {\n    setTimeout(runAllFit, 200);\n}\nsetTimeout(runAllFit, 400);\n</script>';

        const finalHTML =
            headSection +
            batchPageStyle +
            '</head>\n<body>\n' +
            allPages +
            fitScript +
            '\n</body></html>';
        silentPrint(finalHTML);
    }

    /* ===== USUWANIE ===== */

    async function deleteOrder(id) {
        const order = findOrderById(id);
        if (!order) return;

        if (order.status === 'accepted') {
            showToast(
                'Nie mo\u017Cna usun\u0105\u0107 zatwierdzonego zlecenia. Najpierw je cofnij.',
                'error'
            );
            return;
        }

        if (
            !(await appConfirm(
                'Usun\u0105\u0107 zlecenie ' + (order.productionOrderNumber || '') + '?',
                {
                    title: 'Usuwanie zlecenia',
                    type: 'danger'
                }
            ))
        )
            return;

        try {
            const res = await fetch('/api/orders-studnie/production/' + id, {
                method: 'DELETE',
                headers: authHeaders()
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'B\u0142\u0105d serwera');
            }

            // Usuń z lokalnego cache
            if (searchResults) {
                searchResults.items = searchResults.items.filter((o) => o.id !== id);
            }
            selectedIds.delete(id);
            renderStats();
            renderTable();
            showToast('Zlecenie usuni\u0119te', 'info');

            try {
                if (
                    window.parent &&
                    window.parent.SpaRouter &&
                    typeof window.parent.SpaRouter.refreshModule === 'function'
                ) {
                    window.parent.SpaRouter.refreshModule('zlecenia');
                }
            } catch (e) {
                /* ignore */
            }
        } catch (e) {
            logger.error('zlecenia', 'deleteOrder error:', e);
            showToast(e.message, 'error');
        }
    }

    /* ===== NAWIGACJA ===== */

    function editOrder(offerId, wellId, elementIndex, salesOrderId) {
        if (wellId === undefined) wellId = '';
        if (elementIndex === undefined) elementIndex = '';
        if (salesOrderId === undefined) salesOrderId = '';
        if (!offerId) return;

        let extraParams = '&autoopen=zlecenia';
        if (wellId) extraParams += '&wellId=' + wellId;
        if (elementIndex !== '') extraParams += '&elementIndex=' + elementIndex;

        const useOrderMode =
            salesOrderId &&
            salesOrderId !== '' &&
            salesOrderId !== 'null' &&
            salesOrderId !== 'undefined';
        const mainParam = useOrderMode ? 'order=' + salesOrderId : 'edit=' + offerId;

        if (window.parent && window.parent.SpaRouter) {
            window.parent.location.hash = '#/studnie?' + mainParam + extraParams;
        } else {
            window.location.href = 'studnie.html?' + mainParam + extraParams;
        }
    }

    /* ===== PUBLIC API ===== */

    return {
        init,
        loadOrders,
        stopAutoRefresh,
        editOrder,
        deleteOrder,
        setFilter,
        toggleSelect,
        toggleSelectAll,
        printSingleZlecenie,
        printSingleEtykieta,
        printBatchZlecenia,
        printBatchEtykiety
    };
})();
window.AppZlecenia = AppZlecenia;

document.addEventListener('DOMContentLoaded', () => {
    AppZlecenia.init();
});
