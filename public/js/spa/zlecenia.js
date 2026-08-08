// @ts-check
/**
 * Logika Kartoteki Zleceń Produkcyjnych — przewijanie nieskończone
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
    const userMap = new Map(); // nazwy użytkowników dla chipsów
    const SEARCH_LIMIT = 500;
    const MAX_LOADED = 1000;

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
        setupTableEvents();
        setupSentinel();
        await populateUserFilter();
        await searchOffers(buildSearchParams());
    }

    function showLoadingSpinner() {
        const tbody = document.getElementById('zlecenia-table-body');
        if (!tbody) return;
        if (searchResults && searchResults.items.length > 0) return; // nie kasuj podczas loadMore
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
        const chipsContainer = document.getElementById('zlecenia-chips');
        if (chipsContainer) {
            chipsContainer.addEventListener('click', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const removeEl = target.closest('.chip-remove');
                if (!removeEl) return;
                const chipEl = removeEl.closest('.zlecenia-chip');
                if (!chipEl) return;
                removeChip(chipEl.dataset.chipType);
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
                    nextCursorId: json.nextCursorId,
                    stats: json.stats || null
                };
            }

            renderStats();
            updateChips();
            if (isLoadMore) {
                const tbody = document.getElementById('zlecenia-table-body');
                if (tbody && json.data && json.data.length > 0) {
                    tbody.insertAdjacentHTML('beforeend', json.data.map(renderOrderRow).join(''));
                    lucide.createIcons({ root: tbody });
                }
                updateAnimationGate(searchResults.items);
                updateSentinel();
                updateSelectAllState();
                updateBatchBar();
            } else {
                renderTable();
            }
            renderFooter();
            startAutoRefresh();
        } catch (error) {
            if (error.name === 'AbortError') return;
            logger.error('zlecenia', 'searchOffers error:', error);
            showError(error.message);
            if (isLoadMore && searchResults) {
                searchResults.hasMore = false;
            }
            updateSentinel();
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

    /* ===== STATYSTYKI ===== */

    function renderStats() {
        const container = document.getElementById('zlecenia-stats');
        if (!container) return;

        const items = searchResults ? searchResults.items : [];
        const stats = searchResults ? searchResults.stats : null;

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
            total = searchResults ? searchResults.totalCount || items.length : 0;
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

    /* ===== STOPKA + STATYSTYKI (Wyświetlono X z Y) ===== */

    function renderFooter() {
        const container = document.getElementById('zlecenia-footer');
        if (!container) return;
        const shown = searchResults ? searchResults.items.length : 0;
        const total =
            searchResults && searchResults.totalCount != null ? searchResults.totalCount : null;
        const hitLimit = searchResults ? searchResults.items.length >= MAX_LOADED : false;
        let html =
            total != null
                ? 'Wy\u015Bwietlono <strong>' + shown + '</strong> z <strong>' + total + '</strong>'
                : 'Wy\u015Bwietlono <strong>' + shown + '</strong>';
        if (hitLimit && total != null && shown < total) {
            html +=
                ' &middot; <span class="zlecenia-footer-hint">doprecyzuj filtry, aby zobaczy\u0107 wi\u0119cej</span>';
        }
        container.innerHTML = html;
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
        updateSentinel();
    }

    function updateSentinel() {
        const sentinel = document.getElementById('zlecenia-sentinel');
        if (!sentinel) return;
        const items = searchResults ? searchResults.items : [];
        if (!searchResults || items.length === 0) {
            sentinel.classList.add('hidden');
            return;
        }
        const hasMore = !!(searchResults.hasMore && searchResults.items.length < MAX_LOADED);
        sentinel.classList.remove('hidden');
        const total = searchResults.totalCount != null ? searchResults.totalCount : items.length;
        sentinel.innerHTML = hasMore
            ? '<div class="zlecenia-sentinel-spin"></div><span>Wczytuję kolejne…</span>'
            : '<span>Koniec listy — ' + items.length + '/' + total + '</span>';
    }

    /* ===== FILTRY DODATKOWE: UżYTKOWNIK I CHIPSY ===== */

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
            userMap.clear();
            users.forEach((u) => {
                const name =
                    u.firstName && u.lastName ? u.firstName + ' ' + u.lastName : u.username || u.id;
                userMap.set(u.id, name);
                const option = document.createElement('option');
                option.value = u.id;
                option.textContent = name;
                select.appendChild(option);
            });
        } catch (error) {
            logger.error('zlecenia', 'Błąd pobierania użytkowników:', error);
        }
    }

    /* Chipsy odzwierciedlają aktywne filtry; licznik przy przycisku czyszczenia */
    function updateChips() {
        const container = document.getElementById('zlecenia-chips');
        if (!container) return;
        const qInput = document.getElementById('zlecenia-search-input');
        const fromInput = document.getElementById('zlecenia-date-from');
        const toInput = document.getElementById('zlecenia-date-to');
        const userSelect = document.getElementById('zlecenia-user-filter');
        const q = qInput ? qInput.value.trim() : '';
        const dateFrom = fromInput ? fromInput.value : '';
        const dateTo = toInput ? toInput.value : '';
        const userId = userSelect ? userSelect.value : '';

        const chips = [];
        if (dateFrom || dateTo) {
            let label = 'Data:';
            if (dateFrom) label += ' od ' + dateFrom;
            if (dateTo) label += ' do ' + dateTo;
            chips.push(['date', label]);
        }
        if (userId) {
            chips.push(['user', 'Użytkownik: ' + (userMap.get(userId) || userId)]);
        }
        if (q) {
            chips.push(['q', 'Szukanie: ' + q]);
        }
        if (activeFilter !== 'all') {
            chips.push([
                'status',
                'Status: ' + (activeFilter === 'accepted' ? 'Zatwierdzone' : 'Oczekujące')
            ]);
        }

        container.innerHTML = chips
            .map(
                ([type, label]) =>
                    '<span class="zlecenia-chip" data-chip-type="' +
                    type +
                    '"><span class="chip-label">' +
                    escapeHtml(label) +
                    '</span><i data-lucide="x" class="chip-remove" title="Usuń filtr" role="button" aria-label="Usuń filtr"></i></span>'
            )
            .join('');

        const clearBtn = document.getElementById('zlecenia-clear-filters');
        if (clearBtn) {
            clearBtn.textContent = 'Wyczyść filtry (' + chips.length + ')';
        }
        lucide.createIcons({ root: container });
    }

    /* Usunięcie pojedynczego filtra z chipsa */
    function removeChip(type) {
        if (type === 'q') {
            const input = document.getElementById('zlecenia-search-input');
            if (input) input.value = '';
        } else if (type === 'date') {
            const from = document.getElementById('zlecenia-date-from');
            const to = document.getElementById('zlecenia-date-to');
            if (from) from.value = '';
            if (to) to.value = '';
        } else if (type === 'user') {
            const select = document.getElementById('zlecenia-user-filter');
            if (select) select.value = '';
        } else if (type === 'status') {
            activeFilter = 'all';
            document.querySelectorAll('.zlecenia-filter-tab').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.filter === 'all');
            });
        }
        searchOffers(buildSearchParams());
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

    /* Gate animacji: wyłącz pulse-draft przy dużej liczbie oczekujących (jank scroll) */
    function updateAnimationGate(items) {
        const table = document.getElementById('zlecenia-table');
        if (!table) return;
        const draftCount = items.filter((o) => o.status !== 'accepted').length;
        table.classList.toggle('zlecenia-table--flat', draftCount > 200);
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
        updateSelectAllState();
        updateBatchBar();
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
        updateSelectAllState();
        updateBatchBar();
    }

    function selectVisibleRows() {
        const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
        checkboxes.forEach((cb) => {
            cb.checked = true;
            selectedIds.add(cb.dataset.id);
        });
    }

    function updateSelectAllState() {
        const master = document.getElementById('zlecenia-select-all');
        if (!master) return;
        const items = searchResults?.items || [];
        const count = selectedIds.size;

        if (count === 0) {
            selectState = 0;
            master.checked = false;
            master.indeterminate = false;
        } else if (items.length > 0 && count >= items.length) {
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
    }

    function updateBatchBar() {
        const bar = document.getElementById('zlecenia-batch-bar');
        if (!bar) return;

        const batchCountEl = bar.querySelector('.batch-count');
        const scopeEl = bar.querySelector('.batch-scope');

        if (selectState === 2) {
            // Wszystkie załadowane spełniające filtr
            if (batchCountEl) batchCountEl.textContent = String(searchResults?.items?.length || 0);
            if (scopeEl) scopeEl.textContent = '— wszystkie spełniające filtr';
        } else {
            if (batchCountEl) batchCountEl.textContent = String(selectedIds.size);
            if (scopeEl) scopeEl.textContent = selectedIds.size > 0 ? '— widoczne' : '';
        }
    }

    function clearVisibleSelection() {
        // Odznacz tylko identyfikatory z widocznego okna; załadowane poza widokiem zostają zaznaczone
        const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
        checkboxes.forEach((cb) => {
            cb.checked = false;
            selectedIds.delete(cb.dataset.id);
        });
        updateSelectAllState();
        updateBatchBar();
    }

    function clearAllSelection() {
        selectedIds.clear();
        const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
        checkboxes.forEach((cb) => {
            cb.checked = false;
        });
        updateSelectAllState();
        updateBatchBar();
    }

    /* ===== RENDEROWANIE TABELI ===== */

    function renderTable() {
        const tbody = document.getElementById('zlecenia-table-body');
        if (!tbody) return;

        const items = searchResults?.items || [];

        if (items.length === 0) {
            tbody.innerHTML =
                '<tr class="zlecenia-empty"><td colspan="10">Brak zlece\u0144 spe\u0142niaj\u0105cych kryteria.</td></tr>';
            updateSentinel();
            updateSelectAllState();
            updateBatchBar();
            return;
        }

        const html = items.map(renderOrderRow).join('');

        tbody.innerHTML = html;
        lucide.createIcons({ root: tbody });
        updateAnimationGate(items);

        updateSentinel();

        updateSelectAllState();
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
            renderStats();
            renderTable();
            renderFooter();
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
            renderStats();
            renderTable();
            renderFooter();
            updateSentinel();
            updateBatchBar();
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
        clearVisibleSelection,
        clearAllSelection,
        printSingleZlecenie,
        printSingleEtykieta,
        printBatchZlecenia,
        printBatchEtykiety,
        deleteSelectedOrders,
        clearAllFilters,
        removeChip
    };
})();
window.AppZlecenia = AppZlecenia;

document.addEventListener('DOMContentLoaded', () => {
    AppZlecenia.init();
});
