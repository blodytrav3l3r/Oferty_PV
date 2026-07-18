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

    /* ===== HELPERS ===== */

    function formatDate(isoString) {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function paramLabel(val) {
        const map = {
            tak: 'Tak',
            nie: 'Nie',
            linia_dolna: 'Linia dolna',
            linia_gorna: 'Linia górna',
            w_osi: 'W osi',
            patrz_uwagi: 'Patrz uwagi',
            brak: 'Brak',
            beton: 'Beton',
            beton_gfk: 'Beton z GFK',
            klinkier: 'Klinkier',
            preco: 'Preco',
            precotop: 'PrecoTop',
            unolith: 'UnoLith',
            predl: 'Predl',
            kamionka: 'Kamionka',
            zelbet: 'Żelbet',
            drabinka_a_stalowa: 'Drabinka Typ A/stalowa',
            drabinka_a_szlachetna: 'Drabinka Typ A/stal szlachetna',
            drabinka_b_stalowa: 'Drabinka Typ B/stalowa',
            drabinka_b_szlachetna: 'Drabinka Typ B/stal szlachetna',
            inne: 'Inne',
            '1/2': '1/2',
            '2/3': '2/3',
            '3/4': '3/4',
            '1/1': '1/1'
        };
        return map[val] || val || '';
    }

    /** Escape for HTML body content */
    function escapeHtml(str) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
    if (typeof window.escapeHtml !== 'function') window.escapeHtml = escapeHtml;

    /** Escape for JS single-quoted strings inside onclick attributes */
    function escapeJsStr(str) {
        return String(str ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");
    }

    /** Prosta interpolacja szablonu: zastępuje {{KEY}} wartościami z dataObj */
    function renderTemplate(template, dataObj) {
        return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
            return dataObj[key] !== undefined ? dataObj[key] : '';
        });
    }

    /** Pobiera szablon HTML, używa cache-busting dla dewelopmentu */
    async function fetchTemplate(path) {
        try {
            const res = await fetch(path + '?v=' + Date.now());
            if (!res.ok) throw new Error('Nie znaleziono szablonu: ' + path);
            return await res.text();
        } catch (err) {
            showToast('Błąd szablonu: ' + err.message, 'error');
            return null;
        }
    }

    /** Print HTML silently using a hidden iframe */
    function silentPrint(htmlString) {
        const iframe = document.createElement('iframe');
        iframe.style.cssText =
            'position:fixed;right:0;bottom:0;width:1200px;height:1200px;border:0;opacity:0;z-index:-9999;';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlString);
        doc.close();

        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => {
                    if (document.body.contains(iframe)) document.body.removeChild(iframe);
                }, 60000);
            }, 500);
        };
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

    /* ===== PRINTING (from registry — uses stored PO data) ===== */

    /**
     * Build przejscia rows from the stored PO snapshot.
     * This is a simplified version that doesn't require studnieProducts/buildConfigMap.
     */
    function ensureDisplayIndices(przejscia) {
        if (!przejscia || przejscia.length === 0) return;

        const sorted = [...przejscia].sort((a, b) => {
            return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
        });

        sorted.forEach((p, idx) => {
            p.displayIndex = idx;
        });
    }

    /**
     * Buduje wiersze przejść z zapisanego PO.
     * Iteruje po displayIndex od 0 do max, zostawiając puste wiersze dla luk.
     * Etykiety (Wlot/Wylot) odpowiadają rzeczywistemu flowType przejścia.
     */
    function buildPrzejsciaRowsFromPO(po) {
        const przejscia = po.przejscia || [];
        const rzDna = parseFloat(po.rzednaDna) || 0;

        ensureDisplayIndices(przejscia);

        function formatRow(label, p) {
            const spadekK = p.spadekKineta || '';
            const spadekM = p.spadekMufa || '';
            const angle = parseFloat(p.angle) || 0;

            let pel = parseFloat(p.rzednaWlaczenia);
            if (isNaN(pel)) pel = rzDna || 0;
            const wysokoscMm = Math.round((pel - (rzDna || 0)) * 1000);

            const katGon = p.angleGony || ((angle * 400) / 360).toFixed(2);
            const katWyk = p.angleExecution !== undefined ? p.angleExecution : 360 - angle;

            return {
                label,
                rodzaj: p.productCategory || '',
                srednica: p.productDn || '',
                spadekKineta: spadekK ? Math.round(parseFloat(spadekK)) + ' %' : '',
                spadekMufa: spadekM ? Math.round(parseFloat(spadekM)) + ' %' : '',
                katStopien: angle + '°',
                uwagi: '+ ' + wysokoscMm + ' mm',
                katGon,
                katWykonania: katWyk + '°'
            };
        }

        const totalSlots = Math.max(przejscia.length, 4);

        // Mapuj unikalne kąty do numerów etykiet dla grupowania wizualnego
        const uniqueAngles = [...new Set(przejscia.map((p) => parseFloat(p.angle) || 0))].sort(
            (a, b) => a - b
        );
        const angleToLabelNum = {};
        uniqueAngles.forEach((a, idx) => {
            angleToLabelNum[a] = idx;
        });

        const rows = [];
        for (let i = 0; i < totalSlots; i++) {
            const p = przejscia[i];
            if (p) {
                const prefix = p.flowType === 'wylot' ? 'Wylot' : 'Wlot';
                const angleNum = angleToLabelNum[parseFloat(p.angle) || 0];
                rows.push(formatRow(prefix + ' ' + angleNum, p));
            } else {
                const label = i === 0 ? 'Wylot 0' : 'Wlot ';
                rows.push({
                    label,
                    rodzaj: '',
                    srednica: '',
                    spadekKineta: '',
                    spadekMufa: '',
                    katStopien: '',
                    uwagi: '',
                    katGon: '',
                    katWykonania: ''
                });
            }
        }
        return rows;
    }
    function generateSvgFromPO(po) {
        const przejscia = po.przejscia || [];
        if (przejscia.length === 0) return '';
        const rzDna = parseFloat(po.rzednaDna) || 0;

        const size = 400;
        const center = size / 2;
        const radius = 55;
        const labelFontSize = 11;
        const angleFontSize = 9;
        const lineHeight = 10;

        const svgParts = [];
        svgParts.push(
            '<circle cx="' +
                center +
                '" cy="' +
                center +
                '" r="' +
                radius +
                '" fill="none" stroke="#222" stroke-width="2.5" />'
        );
        svgParts.push(
            '<line x1="' +
                center +
                '" y1="' +
                (center - 5) +
                '" x2="' +
                center +
                '" y2="' +
                (center + 5) +
                '" stroke="#999" stroke-width="0.8" />'
        );
        svgParts.push(
            '<line x1="' +
                (center - 5) +
                '" y1="' +
                center +
                '" x2="' +
                (center + 5) +
                '" y2="' +
                center +
                '" stroke="#999" stroke-width="0.8" />'
        );

        const labels = [];

        const wylot = przejscia.find((p) => p.flowType === 'wylot' || parseFloat(p.angle) === 0);

        // Etykiety z displayIndex — zgodne z tabelą i rzeczywistym flowType
        ensureDisplayIndices(przejscia);
        const labelsMap = new Map();
        przejscia.forEach((p) => {
            const prefix = p.flowType === 'wylot' ? 'Wylot' : 'Wlot';
            labelsMap.set(p, prefix + ' ' + p.displayIndex);
        });

        przejscia.forEach((p) => {
            const angle = parseFloat(p.angle) || 0;
            const rad = (angle * Math.PI) / 180;
            const x = center + radius * Math.sin(rad);
            const y = center + radius * Math.cos(rad);
            const isWylot = p === wylot;

            svgParts.push(
                '<line x1="' +
                    center +
                    '" y1="' +
                    center +
                    '" x2="' +
                    x +
                    '" y2="' +
                    y +
                    '" stroke="' +
                    (isWylot ? '#000' : '#444') +
                    '" stroke-width="' +
                    (isWylot ? 3.5 : 1.8) +
                    '" />'
            );

            const labelRadius = radius + 40;
            const lx = center + labelRadius * Math.sin(rad);
            const ly = center + labelRadius * Math.cos(rad);

            let anchor = 'middle';
            let offsetX = 0;
            if (lx < center - 15) {
                anchor = 'end';
                offsetX = -4;
            } else if (lx > center + 15) {
                anchor = 'start';
                offsetX = 4;
            }

            const pel = parseFloat(p.rzednaWlaczenia) || rzDna;
            const hMm = Math.round((pel - rzDna) * 1000);
            const hText = hMm > 0 ? ' (+' + hMm + 'mm)' : '';

            const rodzaj = (p.productCategory || '').toUpperCase();
            const dn = p.productDn || '';
            const prefix = labelsMap.get(p) || 'Wlot';

            const fullName = prefix + (rodzaj ? ' ' + rodzaj : '') + (dn ? ' DN' + dn : '');
            const maxLineLen = 16;
            const words = fullName.split(' ');
            const lines = [];
            let currentLine = '';
            for (const word of words) {
                if (currentLine.length + word.length + 1 > maxLineLen && currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = currentLine ? currentLine + ' ' + word : word;
                }
            }
            if (currentLine) lines.push(currentLine);

            labels.push({
                origX: lx,
                origY: ly,
                lx,
                ly,
                anchor,
                offsetX,
                isRight: lx >= center,
                lines,
                textAngle: angle + '°' + hText
            });
        });

        // Anti-overlap pass
        const leftLabels = labels.filter((l) => !l.isRight).sort((a, b) => a.ly - b.ly);
        const rightLabels = labels.filter((l) => l.isRight).sort((a, b) => a.ly - b.ly);

        function spreadLabels(arr) {
            const requiredGapBase = 8 + lineHeight;
            for (let loops = 0; loops < 15; loops++) {
                for (let i = 0; i < arr.length - 1; i++) {
                    const aLines = arr[i].lines.length;
                    const requiredGap = requiredGapBase + aLines * lineHeight;
                    const diff = arr[i + 1].ly - arr[i].ly;
                    if (diff < requiredGap) {
                        const push = (requiredGap - diff) / 2;
                        arr[i].ly -= push;
                        arr[i + 1].ly += push;
                    }
                }
            }
        }
        spreadLabels(leftLabels);
        spreadLabels(rightLabels);

        // Oblicz pełny bounding box z zawartości (okrąg + etykiety)
        let minX = center - radius - 5;
        let maxX = center + radius + 5;
        let minY = center - radius - 5;
        let maxY = center + radius + 5;

        labels.forEach((l) => {
            const textHeight = (l.lines.length + 1) * lineHeight;
            if (l.ly - 5 < minY) minY = l.ly - 5;
            if (l.ly + textHeight > maxY) maxY = l.ly + textHeight;

            // Szerokość tekstu szacunkowo ~8px na literę
            const svgTexts = [...l.lines, l.textAngle];
            const maxTextLen = Math.max(...svgTexts.map((t) => t.length));
            const textW = maxTextLen * 8;

            if (l.anchor === 'end') {
                if (l.lx + l.offsetX - textW - 10 < minX) minX = l.lx + l.offsetX - textW - 10;
            } else if (l.anchor === 'start') {
                if (l.lx + l.offsetX + textW + 10 > maxX) maxX = l.lx + l.offsetX + textW + 10;
            } else {
                if (l.lx + l.offsetX - textW / 2 - 10 < minX)
                    minX = l.lx + l.offsetX - textW / 2 - 10;
                if (l.lx + l.offsetX + textW / 2 + 10 > maxX)
                    maxX = l.lx + l.offsetX + textW / 2 + 10;
            }

            // Linia prowadząca (leader line)
            if (Math.abs(l.origY - l.ly) > 2) {
                const lineDist = l.ly > l.origY ? -8 : 8;
                svgParts.push(
                    '<line x1="' +
                        l.origX +
                        '" y1="' +
                        l.origY +
                        '" x2="' +
                        l.lx +
                        '" y2="' +
                        (l.ly + lineDist) +
                        '" stroke="#ccc" stroke-dasharray="2,2" stroke-width="0.8" />'
                );
            }
            let textSvg =
                '<text x="' +
                (l.lx + l.offsetX) +
                '" y="' +
                l.ly +
                '" text-anchor="' +
                l.anchor +
                '" font-family="Arial, sans-serif" font-size="' +
                labelFontSize +
                '" font-weight="bold" fill="#000">';
            l.lines.forEach((line, li) => {
                textSvg +=
                    '<tspan x="' +
                    (l.lx + l.offsetX) +
                    '" dy="' +
                    (li === 0 ? '0' : '1.1em') +
                    '" fill="#000">' +
                    line +
                    '</tspan>';
            });
            textSvg +=
                '<tspan x="' +
                (l.lx + l.offsetX) +
                '" dy="1.1em" font-size="' +
                angleFontSize +
                '" font-weight="normal" fill="#444">' +
                l.textAngle +
                '</tspan>';
            textSvg += '</text>';
            svgParts.push(textSvg);
        });

        // Dynamiczny viewBox — przycięty do pełnej zawartości
        const pad = 12;
        const vbX = Math.floor(minX - pad);
        const vbY = Math.floor(minY - pad);
        const vbW = Math.ceil(maxX - minX + pad * 2);
        const vbH = Math.ceil(maxY - minY + pad * 2);
        const svgW = 200;
        const svgH = Math.round(svgW * (vbH / vbW));

        let svg =
            '<svg viewBox="' +
            vbX +
            ' ' +
            vbY +
            ' ' +
            vbW +
            ' ' +
            vbH +
            '" width="' +
            svgW +
            '" height="' +
            svgH +
            '" style="background:transparent;">';
        svg += svgParts.join('');
        svg += '</svg>';
        return svg;
    }

    /** Buduje pełny HTML zlecenia z danych PO + szablonu */
    function buildZlecenieFromPO(template, po) {
        const przejsciaRows = buildPrzejsciaRowsFromPO(po);

        function getPowloka() {
            const parts = [];
            if (po.malowanieW && po.malowanieW !== 'brak') {
                let desc = '';
                if (po.malowanieW === 'kineta') desc = 'Kineta';
                else if (po.malowanieW === 'kineta_dennica') desc = 'Kineta+denn.';
                else if (po.malowanieW === 'cale') desc = 'Całość';
                if (desc) {
                    let p = 'Wew: ' + desc;
                    if (po.powlokaNameW) p += ' (' + po.powlokaNameW + ')';
                    parts.push(p);
                }
            }
            if (po.malowanieZ === 'zewnatrz') {
                let p = 'Zew:';
                if (po.powlokaNameZ) p += ' (' + po.powlokaNameZ + ')';
                parts.push(p);
            }
            return parts.length > 0 ? parts.join('<br>') : 'Brak';
        }

        const payload = {
            NR_ZLECENIA: po.productionOrderNumber || '',
            OBIEKT: po.obiekt || '',
            ADRES: po.adres || '',
            WYKONAWCA: po.wykonawca || '',
            FAKTUROWANE: po.fakturowane || '',
            DATA_PRODUKCJI: po.dataProdukcji || '',
            SNR: po.snr || po.wellName || '',
            SREDNICA: po.srednica || po.dn || '',
            WYSOKOSC: po.wysokosc || '',
            GLEBOKOSC: po.glebokosc || '',
            DNO_KINETA: po.dnoKineta || '',
            UWAGI: po.uwagi || '',
            DATA: po.data || '',
            NAZWISKO: po.nazwisko || '',
            RED_KINETY: paramLabel(po.redukcjaKinety) || 'Brak',
            SPOCZNIK_H: paramLabel(po.spocznikH) || 'Brak',
            USYTUOWANIE: paramLabel(po.usytuowanie) || 'Brak',
            DIN: po.din || 'Brak',
            KINETA: paramLabel(po.kineta) || 'Brak',
            SPOCZNIK: paramLabel(po.spocznik) || 'Brak',
            RODZAJ_STOPNI:
                paramLabel(po.rodzajStopni) + (po.stopnieInne ? ' — ' + po.stopnieInne : '') ||
                'Brak',
            KLASA_BETONU: po.klasaBetonu || 'Brak',
            KAT_STOPNI: po.katStopni ? po.katStopni + '°' : 'Brak',
            WYKONANIE: po.wykonanie || 'Brak',
            POWLOKA: getPowloka(),
            GRAFIKA_KATOW: generateSvgFromPO(po)
        };

        // Wiersze przejść 0-3 (zgodnie z konfiguratorem: renderuj wszystkie wiersze, także puste)
        for (let i = 0; i < 4; i++) {
            if (przejsciaRows[i]) {
                payload['PRZEJSCIA_ROW_' + i] =
                    '<td>' +
                    przejsciaRows[i].label +
                    '</td>' +
                    '<td>' +
                    przejsciaRows[i].rodzaj +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].srednica +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].spadekKineta +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].spadekMufa +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].katStopien +
                    '</td>' +
                    '<td>' +
                    przejsciaRows[i].uwagi +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].katGon +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].katWykonania +
                    '</td>';
            } else {
                payload['PRZEJSCIA_ROW_' + i] = '<td colspan="9"></td>';
            }
        }

        // Pozostałe wiersze (zgodnie z konfiguratorem: renderuj WSZYSTKIE wiersze, także puste)
        payload['PRZEJSCIA_ROWS_REST'] = przejsciaRows
            .slice(4)
            .map(
                (r) =>
                    '<tr>' +
                    '<td colspan="2"></td>' +
                    '<td>' +
                    r.label +
                    '</td>' +
                    '<td>' +
                    r.rodzaj +
                    '</td>' +
                    '<td class="center">' +
                    r.srednica +
                    '</td>' +
                    '<td class="center">' +
                    r.spadekKineta +
                    '</td>' +
                    '<td class="center">' +
                    r.spadekMufa +
                    '</td>' +
                    '<td class="center">' +
                    r.katStopien +
                    '</td>' +
                    '<td>' +
                    r.uwagi +
                    '</td>' +
                    '<td class="center">' +
                    r.katGon +
                    '</td>' +
                    '<td class="center">' +
                    r.katWykonania +
                    '</td>' +
                    '</tr>'
            )
            .join('');

        return renderTemplate(template, payload);
    }

    /** Build Etykieta HTML from PO data, with unique SVG IDs for batch mode */
    function buildEtykietaFromPO(template, po, pageIndex) {
        if (pageIndex === undefined) pageIndex = 0;

        function getCertData(dn) {
            const dnStr = String(dn || '');
            const match = dnStr.match(/(\d{3,4})/);
            const numDn = match ? parseInt(match[1]) : 0;
            if ([1000, 1200].includes(numDn)) {
                return { img: 'images/ce-mark.png', alt: 'CE', text: 'AT/2009-03-1733' };
            }
            return {
                img: 'images/b-mark.png',
                alt: 'B',
                text: 'IBDIM KOT 2018/0195 WYD.2<br>KDWU B/73/2023'
            };
        }

        const cert = getCertData(po.srednica || po.dn);

        // Zbuduj wiersze elementów z zapisanego migawki
        const elementy = po.etykietaElementy || [];
        const elementRows = elementy
            .map(
                (e) =>
                    '<tr>' +
                    '<td class="el-qty">' +
                    e.ilosc +
                    '</td>' +
                    '<td class="el-idx">' +
                    e.indeks +
                    '</td>' +
                    '<td class="el-name">' +
                    e.nazwa +
                    '</td>' +
                    '</tr>'
            )
            .join('');

        // Użyj unikalnych ID SVG dla każdej strony przy drukowaniu wsadowym
        const snrSvgId = 'snr-svg-' + pageIndex;
        const orderSvgId = 'order-svg-' + pageIndex;

        const payload = {
            SNR: po.snr || po.wellName || '',
            MAIN_ELEMENT: po.productName || '',
            NR_ZLECENIA: po.productionOrderNumber || '',
            ELEMENTY_ROWS: elementRows,
            CERT_IMG: cert.img,
            CERT_ALT: cert.alt,
            CERT_TEXT: cert.text
        };

        // Zastąp ID SVG w szablonie unikalnymi dla każdej strony
        let html = renderTemplate(template, payload);
        html = html.replaceAll('id="snr-svg"', 'id="' + snrSvgId + '"');
        html = html.replaceAll('id="order-svg"', 'id="' + orderSvgId + '"');
        html = html.replaceAll("fitSvgText('snr-svg')", "fitSvgText('" + snrSvgId + "')");
        html = html.replaceAll("fitSvgText('order-svg')", "fitSvgText('" + orderSvgId + "')");

        return html;
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

    /** Buduje pojedynczy blok strony zlecenia (bez <html>/<head>/<body>) */
    function buildZlecenieFromPageBlock(pageTemplate, po) {
        const przejsciaRows = buildPrzejsciaRowsFromPO(po);

        function getPowloka() {
            const parts = [];
            if (po.malowanieW && po.malowanieW !== 'brak') {
                let desc = '';
                if (po.malowanieW === 'kineta') desc = 'Kineta';
                else if (po.malowanieW === 'kineta_dennica') desc = 'Kineta+denn.';
                else if (po.malowanieW === 'cale') desc = 'Całość';
                if (desc) {
                    let p = 'Wew: ' + desc;
                    if (po.powlokaNameW) p += ' (' + po.powlokaNameW + ')';
                    parts.push(p);
                }
            }
            if (po.malowanieZ === 'zewnatrz') {
                let p = 'Zew:';
                if (po.powlokaNameZ) p += ' (' + po.powlokaNameZ + ')';
                parts.push(p);
            }
            return parts.length > 0 ? parts.join('<br>') : 'Brak';
        }

        const payload = {
            NR_ZLECENIA: po.productionOrderNumber || '',
            OBIEKT: po.obiekt || '',
            ADRES: po.adres || '',
            WYKONAWCA: po.wykonawca || '',
            FAKTUROWANE: po.fakturowane || '',
            DATA_PRODUKCJI: po.dataProdukcji || '',
            SNR: po.snr || po.wellName || '',
            SREDNICA: po.srednica || po.dn || '',
            WYSOKOSC: po.wysokosc || '',
            GLEBOKOSC: po.glebokosc || '',
            DNO_KINETA: po.dnoKineta || '',
            UWAGI: po.uwagi || '',
            DATA: po.data || '',
            NAZWISKO: po.nazwisko || '',
            RED_KINETY: paramLabel(po.redukcjaKinety) || 'Brak',
            SPOCZNIK_H: paramLabel(po.spocznikH) || 'Brak',
            USYTUOWANIE: paramLabel(po.usytuowanie) || 'Brak',
            DIN: po.din || 'Brak',
            KINETA: paramLabel(po.kineta) || 'Brak',
            SPOCZNIK: paramLabel(po.spocznik) || 'Brak',
            RODZAJ_STOPNI:
                paramLabel(po.rodzajStopni) + (po.stopnieInne ? ' — ' + po.stopnieInne : '') ||
                'Brak',
            KLASA_BETONU: po.klasaBetonu || 'Brak',
            KAT_STOPNI: po.katStopni ? po.katStopni + '°' : 'Brak',
            WYKONANIE: po.wykonanie || 'Brak',
            POWLOKA: getPowloka(),
            GRAFIKA_KATOW: generateSvgFromPO(po)
        };

        for (let i = 0; i < 4; i++) {
            if (przejsciaRows[i]) {
                payload['PRZEJSCIA_ROW_' + i] =
                    '<td>' +
                    przejsciaRows[i].label +
                    '</td>' +
                    '<td>' +
                    przejsciaRows[i].rodzaj +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].srednica +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].spadekKineta +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].spadekMufa +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].katStopien +
                    '</td>' +
                    '<td>' +
                    przejsciaRows[i].uwagi +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].katGon +
                    '</td>' +
                    '<td class="center">' +
                    przejsciaRows[i].katWykonania +
                    '</td>';
            } else {
                payload['PRZEJSCIA_ROW_' + i] = '<td colspan="9"></td>';
            }
        }

        payload['PRZEJSCIA_ROWS_REST'] = przejsciaRows
            .slice(4)
            .map(
                (r) =>
                    '<tr>' +
                    '<td colspan="2"></td>' +
                    '<td>' +
                    r.label +
                    '</td>' +
                    '<td>' +
                    r.rodzaj +
                    '</td>' +
                    '<td class="center">' +
                    r.srednica +
                    '</td>' +
                    '<td class="center">' +
                    r.spadekKineta +
                    '</td>' +
                    '<td class="center">' +
                    r.spadekMufa +
                    '</td>' +
                    '<td class="center">' +
                    r.katStopien +
                    '</td>' +
                    '<td>' +
                    r.uwagi +
                    '</td>' +
                    '<td class="center">' +
                    r.katGon +
                    '</td>' +
                    '<td class="center">' +
                    r.katWykonania +
                    '</td>' +
                    '</tr>'
            )
            .join('');

        return renderTemplate(pageTemplate, payload);
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

    /** Buduje pojedynczy blok strony etykiety z unikalnymi ID SVG */
    function buildEtykietaPageBlock(pageTemplate, po, pageIndex) {
        function getCertData(dn) {
            const dnStr = String(dn || '');
            const match = dnStr.match(/(\d{3,4})/);
            const numDn = match ? parseInt(match[1]) : 0;
            if ([1000, 1200].includes(numDn)) {
                return { img: 'images/ce-mark.png', alt: 'CE', text: 'AT/2009-03-1733' };
            }
            return {
                img: 'images/b-mark.png',
                alt: 'B',
                text: 'IBDIM KOT 2018/0195 WYD.2<br>KDWU B/73/2023'
            };
        }

        const cert = getCertData(po.srednica || po.dn);
        const elementy = po.etykietaElementy || [];
        const elementRows = elementy
            .map(
                (e) =>
                    '<tr>' +
                    '<td class="el-qty">' +
                    e.ilosc +
                    '</td>' +
                    '<td class="el-idx">' +
                    e.indeks +
                    '</td>' +
                    '<td class="el-name">' +
                    e.nazwa +
                    '</td>' +
                    '</tr>'
            )
            .join('');

        const payload = {
            SNR: po.snr || po.wellName || '',
            MAIN_ELEMENT: po.productName || '',
            NR_ZLECENIA: po.productionOrderNumber || '',
            ELEMENTY_ROWS: elementRows,
            CERT_IMG: cert.img,
            CERT_ALT: cert.alt,
            CERT_TEXT: cert.text
        };

        let html = renderTemplate(pageTemplate, payload);

        // Zastąp ID SVG unikalnymi ID dla każdej strony
        html = html.replaceAll('id="snr-svg"', 'id="snr-svg-' + pageIndex + '"');
        html = html.replaceAll('id="order-svg"', 'id="order-svg-' + pageIndex + '"');

        return html;
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
