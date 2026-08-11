// @ts-check
/**
 * Logika Kartoteki Zleceń Produkcyjnych — przewijanie nieskończone.
 * Warstwa renderowania UI znajduje się w zleceniaRender.js (SRP).
 */

const AppZlecenia = (() => {
    let searchResults = null; // { items, totalCount, hasMore, nextCursor, nextCursorId }
    let activeFilter = 'all'; // 'all' | 'draft' | 'accepted'
    const selectedIds = new Set(); // multi-select for batch print
    let selectState = 0; // 0 = nic, 1 = widoczne, 2 = wszystkie
    let autoRefreshInterval = null;
    let isLoading = false;
    let abortController = null;
    let searchDebounceTimer = null;
    let requestSeq = 0;
    let sentinelObserver = null;
    const SEARCH_LIMIT = 500;
    const MAX_LOADED = 1000;

    const {
        fetchTemplate,
        silentPrint,
        applyPrintTokens,
        buildZlecenieFromPO,
        buildEtykietaFromPO,
        buildZlecenieFromPageBlock,
        buildEtykietaPageBlock
    } = window;

    /* ===== RENDER STATE ===== */

    function buildRenderState() {
        const items = searchResults ? searchResults.items : [];
        return {
            items,
            totalCount: searchResults ? searchResults.totalCount : 0,
            hasMore: !!(searchResults && searchResults.hasMore && items.length < MAX_LOADED),
            stats: searchResults ? searchResults.stats : null,
            selectedIds,
            selectState
        };
    }

    /* ===== INIT ===== */

    async function init() {
        const token = getAuthToken();
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        setupSearch();
        setupTableEvents();
        setupSentinel();
        await populateUserFilter();
        await searchOffers(buildSearchParams());
    }

    /* ===== WYSZUKIWANIE I FILTROWANIE ===== */

    function buildSearchParams() {
        const input = document.getElementById('zlecenia-search-input');
        const q = input ? input.value.trim() : '';
        const dateFromInput = document.getElementById('zlecenia-date-from');
        const dateToInput = document.getElementById('zlecenia-date-to');
        const dateFrom = dateFromInput ? dateFromInput.value : '';
        const dateTo = dateToInput ? dateToInput.value : '';
        const userSelect = document.getElementById('zlecenia-user-filter');
        const userId = userSelect ? userSelect.value : '';

        return {
            q,
            status: activeFilter,
            dateFrom,
            dateTo,
            userId,
            limit: SEARCH_LIMIT,
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

        const dateFromInput = document.getElementById('zlecenia-date-from');
        const dateToInput = document.getElementById('zlecenia-date-to');
        if (dateFromInput) {
            dateFromInput.addEventListener('change', () => {
                searchOffers(buildSearchParams());
            });
        }
        if (dateToInput) {
            dateToInput.addEventListener('change', () => {
                searchOffers(buildSearchParams());
            });
        }
        const dateClearBtn = document.getElementById('zlecenia-date-clear');
        if (dateClearBtn) {
            dateClearBtn.addEventListener('click', () => {
                if (dateFromInput) dateFromInput.value = '';
                if (dateToInput) dateToInput.value = '';
                searchOffers(buildSearchParams());
            });
        }
        const userSelect = document.getElementById('zlecenia-user-filter');
        if (userSelect) {
            userSelect.addEventListener('change', () => {
                searchOffers(buildSearchParams());
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

        const gen = ++requestSeq;
        isLoading = true;
        const isLoadMore = !!params.cursor;

        if (!isLoadMore) {
            window.zleceniaRender.showLoadingSpinner(
                !!(searchResults && searchResults.items.length > 0)
            );
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
                    nextCursorId: json.nextCursorId,
                    stats: json.stats || null
                };
            }

            window.zleceniaRender.renderStats(buildRenderState());
            window.zleceniaRender.updateChips(activeFilter);
            if (isLoadMore) {
                const tbody = document.getElementById('zlecenia-table-body');
                if (tbody && json.data && json.data.length > 0) {
                    tbody.insertAdjacentHTML(
                        'beforeend',
                        json.data
                            .map((o) => window.zleceniaRender.renderOrderRow(o, selectedIds))
                            .join('')
                    );
                    lucide.createIcons({ root: tbody });
                }
                window.zleceniaRender.updateAnimationGate(searchResults.items);
                window.zleceniaRender.updateSentinel(buildRenderState());
                selectState = window.zleceniaRender.updateSelectAllState(
                    searchResults.items.length,
                    selectedIds.size
                );
                window.zleceniaRender.updateBatchBar(
                    selectState,
                    searchResults.items.length,
                    selectedIds.size
                );
            } else {
                selectState = window.zleceniaRender.renderTable(buildRenderState());
            }
            startAutoRefresh();
        } catch (error) {
            if (error.name === 'AbortError') return;
            logger.error('zlecenia', 'searchOffers error:', error);
            window.zleceniaRender.showError(error.message);
            if (isLoadMore && searchResults) {
                searchResults.hasMore = false;
            }
            window.zleceniaRender.updateSentinel(buildRenderState());
        } finally {
            if (gen === requestSeq) isLoading = false;
        }
    }

    function loadMore() {
        if (isLoading || !searchResults?.hasMore) return;
        if (searchResults.items.length >= MAX_LOADED) return;
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
        if (sentinelObserver) {
            sentinelObserver.disconnect();
            sentinelObserver = null;
        }
    }

    /* Lokalna korekta agregatów po usunięciu (do następnego search) */
    function decrementStats(removed) {
        if (!searchResults || !searchResults.stats) return;
        const stats = searchResults.stats;
        const today = new Date().toISOString().slice(0, 10);
        removed.forEach((o) => {
            stats.total -= 1;
            if (o.status === 'accepted') {
                stats.accepted -= 1;
            } else {
                stats.draft -= 1;
            }
            if (o.createdAt && o.createdAt.slice(0, 10) === today) {
                stats.today -= 1;
            }
        });
    }

    /* ===== INFINITE SCROLL (SENTINEL) ===== */

    function setupSentinel() {
        const sentinel = document.getElementById('zlecenia-sentinel');
        if (!sentinel || typeof IntersectionObserver === 'undefined') return;
        if (sentinelObserver) {
            sentinelObserver.disconnect();
            sentinelObserver = null;
        }
        sentinelObserver = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    loadMore();
                }
            },
            // Obserwacja względem okna — strona przewija się jako całość
            { root: null, rootMargin: '300px 0px' }
        );
        sentinelObserver.observe(sentinel);
        window.zleceniaRender.updateSentinel(buildRenderState());
    }

    /* ===== FILTRY DODATKOWE ===== */

    async function populateUserFilter() {
        const select = document.getElementById('zlecenia-user-filter');
        if (!select) return;
        try {
            const resp = await fetch('/api/users-for-assignment', {
                headers: authHeaders?.() || {}
            });
            if (!resp.ok) return;
            const json = await resp.json();
            const users = json.data || [];
            users.forEach((u) => {
                const name =
                    u.firstName && u.lastName ? u.firstName + ' ' + u.lastName : u.username || u.id;
                const option = document.createElement('option');
                option.value = u.id;
                option.textContent = name;
                select.appendChild(option);
            });
        } catch (error) {
            logger.error('zlecenia', 'Błąd pobierania użytkowników:', error);
        }
    }

    /* Wyzerowanie wszystkich filtrów naraz */
    function clearAllFilters() {
        const qInput = document.getElementById('zlecenia-search-input');
        if (qInput) qInput.value = '';
        const from = document.getElementById('zlecenia-date-from');
        const to = document.getElementById('zlecenia-date-to');
        if (from) from.value = '';
        if (to) to.value = '';
        const select = document.getElementById('zlecenia-user-filter');
        if (select) select.value = '';
        activeFilter = 'all';
        document.querySelectorAll('.zlecenia-filter-tab').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.filter === 'all');
        });
        searchOffers(buildSearchParams());
    }

    /* ===== ZDARZENIA TABELI (delegacja checkboxów) ===== */

    function setupTableEvents() {
        const tbody = document.getElementById('zlecenia-table-body');
        if (!tbody) return;
        tbody.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.classList.contains('zlecenia-row-cb')) {
                return;
            }
            toggleSelect(target.dataset.id, target);
        });
    }

    /* ===== SELECTION ===== */

    function toggleSelect(id, checkbox) {
        if (checkbox.checked) {
            selectedIds.add(id);
        } else {
            selectedIds.delete(id);
        }
        syncSelectionUI();
    }

    function toggleSelectAll(_masterCheckbox) {
        // Cykl 3-stanowy: 0 (nic) -> 1 (widoczne) -> 2 (wszystkie załadowane) -> 0
        if (selectState === 0) {
            // Stan 1: zaznacz tylko widoczne wiersze (wydruk i delegacja korzystają z identyfikatorów w drzewie strony)
            selectVisibleRows();
        } else if (selectState === 1) {
            // Stan 2: zaznacz wszystkie załadowane zlecenia (limit MAX_LOADED)
            const items = searchResults?.items || [];
            items.forEach((o) => selectedIds.add(o.id));
        } else {
            // Stan 0: wyczyść całą selekcję
            clearAllSelection();
        }
        syncSelectionUI();
    }

    function selectVisibleRows() {
        const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
        checkboxes.forEach((cb) => {
            cb.checked = true;
            selectedIds.add(cb.dataset.id);
        });
    }

    function selectAllRows() {
        if (selectState > 0) {
            // Odznacz wszystko
            clearAllSelection();
            return;
        }
        // Zaznacz wszystkie załadowane zlecenia spełniające filtr (limit MAX_LOADED)
        const items = searchResults?.items || [];
        items.forEach((o) => selectedIds.add(o.id));
        const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
        checkboxes.forEach((cb) => {
            if (selectedIds.has(cb.dataset.id)) cb.checked = true;
        });
        syncSelectionUI();
    }

    function clearAllSelection() {
        selectedIds.clear();
        const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
        checkboxes.forEach((cb) => {
            cb.checked = false;
        });
        syncSelectionUI();
    }

    /* Synchronizacja widoku selekcji z aktualnym stanem */
    function syncSelectionUI() {
        const items = searchResults ? searchResults.items : [];
        selectState = window.zleceniaRender.updateSelectAllState(items.length, selectedIds.size);
        window.zleceniaRender.updateBatchBar(selectState, items.length, selectedIds.size);
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

    function getSelectedOrders() {
        if (selectedIds.size === 0) {
            showToast('Zaznacz zlecenia do wydruku', 'error');
            return null;
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
            return null;
        }

        return orders;
    }

    async function printBatchZlecenia() {
        const orders = getSelectedOrders();
        if (!orders) return;

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

        const headSection = applyPrintTokens(template.substring(0, template.indexOf('</head>')));
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
        const orders = getSelectedOrders();
        if (!orders) return;

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

        const headSection = applyPrintTokens(template.substring(0, template.indexOf('</head>')));
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
                const removed = searchResults.items.filter((o) => o.id === id);
                searchResults.items = searchResults.items.filter((o) => o.id !== id);
                decrementStats(removed);
            }
            selectedIds.delete(id);
            window.zleceniaRender.renderStats(buildRenderState());
            selectState = window.zleceniaRender.renderTable(buildRenderState());
            showToast('Zlecenie usuni\u0119te', 'info');

            if (
                window.parent &&
                window.parent.SpaRouter &&
                typeof window.parent.SpaRouter.refreshModule === 'function'
            ) {
                window.parent.SpaRouter.refreshModule('zlecenia');
            }
        } catch (e) {
            logger.error('zlecenia', 'deleteOrder error:', e);
            showToast(e.message, 'error');
        }
    }

    async function deleteSelectedOrders() {
        if (selectedIds.size === 0) return;

        const selected = [...selectedIds];
        const itemsById = new Map((searchResults ? searchResults.items : []).map((o) => [o.id, o]));
        // Spójnie z pojedynczym deleteOrder: zatwierdzone (accepted) są chronione PZ
        const acceptedSelected = selected.filter((id) => {
            const item = itemsById.get(id);
            return item && item.status === 'accepted';
        });
        if (acceptedSelected.length === selected.length) {
            showToast(
                'Zaznaczone zlecenia są zatwierdzone (ochrona PZ) — nie można ich usunąć.',
                'info'
            );
            return;
        }

        if (
            !(await appConfirm(
                'Usun\u0105\u0107 ' + selected.length + ' zaznaczonych zlece\u0144?',
                {
                    title: 'Usuwanie zlece\u0144',
                    type: 'danger'
                }
            ))
        )
            return;

        try {
            // Podział na paczki ≤200 — serwer limituje 200 ids/request, rate limiter 60/min
            const CHUNK_SIZE = 200;
            let deletedTotal = 0;
            let skippedTotal = 0;
            for (let i = 0; i < selected.length; i += CHUNK_SIZE) {
                const chunk = selected.slice(i, i + CHUNK_SIZE);
                const res = await fetch('/api/orders-studnie/production/batch-delete', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ ids: chunk })
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || 'B\u0142\u0105d serwera');
                }
                const data = await res.json();
                deletedTotal +=
                    data && typeof data.deleted === 'number' ? data.deleted : chunk.length;
                if (data && typeof data.skipped === 'number') {
                    skippedTotal += data.skipped;
                }
            }

            // Usuń z lokalnego cache tylko faktycznie usunięte (accepted zostają)
            const removedIds = new Set(
                selected.filter((id) => {
                    const item = itemsById.get(id);
                    return item && item.status !== 'accepted';
                })
            );
            if (searchResults && removedIds.size > 0) {
                decrementStats(searchResults.items.filter((o) => removedIds.has(o.id)));
                searchResults.items = searchResults.items.filter((o) => !removedIds.has(o.id));
            }
            selectedIds.clear();
            window.zleceniaRender.renderStats(buildRenderState());
            selectState = window.zleceniaRender.renderTable(buildRenderState());
            let toastMsg = 'Usuni\u0119to ' + deletedTotal + ' zlece\u0144';
            if (skippedTotal > 0) {
                toastMsg += ' \u00B7 pomini\u0119to ' + skippedTotal + ' zatwierdzone (ochrona PZ)';
            }
            showToast(toastMsg, 'info');
        } catch (e) {
            logger.error('zlecenia', 'deleteSelectedOrders error:', e);
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
        editOrder,
        deleteOrder,
        setFilter,
        toggleSelectAll,
        selectAllRows,
        printSingleZlecenie,
        printSingleEtykieta,
        printBatchZlecenia,
        printBatchEtykiety,
        deleteSelectedOrders,
        clearAllFilters
    };
})();
window.AppZlecenia = AppZlecenia;

document.addEventListener('DOMContentLoaded', () => {
    AppZlecenia.init();
});
