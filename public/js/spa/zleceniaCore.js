// @ts-check
/* ===== STATE + HELPERS + UI + CRUD (Zlecenia) ===== */

let zleceniaOrdersCache = [];
let zleceniaActiveFilter = 'all';
let zleceniaSelectedIds = new Set();
let zleceniaAutoRefreshInterval = null;

const zleceniaStatusMap = {
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

function escapeHtml(str) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
if (typeof window.escapeHtml !== 'function') window.escapeHtml = escapeHtml;

function escapeJsStr(str) {
    return String(str ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function renderTemplate(template, dataObj) {
    return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
        return dataObj[key] !== undefined ? dataObj[key] : '';
    });
}

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

function setupSearch() {
    const input = document.getElementById('zlecenia-search-input');
    if (input) {
        input.addEventListener('input', () => renderTable(input.value.toLowerCase().trim()));
    }
}

function setFilter(filter) {
    zleceniaActiveFilter = filter;
    document.querySelectorAll('.zlecenia-filter-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    const searchInput = document.getElementById('zlecenia-search-input');
    renderTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
}

async function loadOrders() {
    const tbody = document.getElementById('zlecenia-table-body');
    if (tbody) {
        tbody.innerHTML =
            '<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted); font-style:italic;">Ładowanie danych z serwera...</td></tr>';
    }

    try {
        const res = await fetch('/api/orders-studnie/production/registry', {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Nie udało się pobrać zleceń: ' + res.status);

        const data = await res.json();
        zleceniaOrdersCache = data.data || [];
        zleceniaSelectedIds.clear();

        renderStats();
        const searchInput = document.getElementById('zlecenia-search-input');
        renderTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
        startAutoRefresh();
    } catch (err) {
        logger.error('zlecenia', err);
        showToast('<i data-lucide="x-circle"></i> Błąd pobierania zleceń', 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--danger);">Wystąpił błąd: ${escapeHtml(err.message)}</td></tr>`;
        }
    }
}

function startAutoRefresh() {
    stopAutoRefresh();
    zleceniaAutoRefreshInterval = setInterval(() => {
        if (!document.hidden && zleceniaSelectedIds.size === 0) loadOrders();
    }, 60000);
}

function stopAutoRefresh() {
    if (zleceniaAutoRefreshInterval) {
        clearInterval(zleceniaAutoRefreshInterval);
        zleceniaAutoRefreshInterval = null;
    }
}

function renderStats() {
    const container = document.getElementById('zlecenia-stats');
    if (!container) return;

    const total = zleceniaOrdersCache.length;
    const accepted = zleceniaOrdersCache.filter((o) => o.status === 'accepted').length;
    const draft = zleceniaOrdersCache.filter((o) => o.status !== 'accepted').length;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = zleceniaOrdersCache.filter(
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

function toggleSelect(id, checkbox) {
    if (checkbox.checked) {
        zleceniaSelectedIds.add(id);
    } else {
        zleceniaSelectedIds.delete(id);
    }
    updateBatchBar();
}

function toggleSelectAll(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
    checkboxes.forEach((cb) => {
        cb.checked = masterCheckbox.checked;
        const id = cb.dataset.id;
        if (masterCheckbox.checked) {
            zleceniaSelectedIds.add(id);
        } else {
            zleceniaSelectedIds.delete(id);
        }
    });
    updateBatchBar();
}

function updateBatchBar() {
    const bar = document.getElementById('zlecenia-batch-bar');
    if (!bar) return;

    if (zleceniaSelectedIds.size > 0) {
        bar.style.display = 'flex';
        const batchCountEl = bar.querySelector('.batch-count');
        if (batchCountEl) batchCountEl.textContent = String(zleceniaSelectedIds.size);
    } else {
        bar.style.display = 'none';
    }
}

function getFilteredOrders(searchTerm = '') {
    let filtered = zleceniaOrdersCache;

    if (zleceniaActiveFilter === 'draft') {
        filtered = filtered.filter((o) => o.status !== 'accepted');
    } else if (zleceniaActiveFilter === 'accepted') {
        filtered = filtered.filter((o) => o.status === 'accepted');
    }

    if (searchTerm) {
        filtered = filtered.filter((o) => {
            const fields = [
                o.productionOrderNumber,
                o.handlerName,
                o.creatorName,
                o.wellName,
                o.projectName,
                o.obiekt,
                o.salesOrderNumber,
                o.dbSalesOrderNumber,
                o.elementName,
                o.productName
            ].map((f) => (f || '').toLowerCase());
            return fields.some((f) => f.includes(searchTerm));
        });
    }

    return filtered;
}

function renderTable(searchTerm = '') {
    const tbody = document.getElementById('zlecenia-table-body');
    if (!tbody) return;

    const filtered = getFilteredOrders(searchTerm);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2.5rem; color:var(--text-muted); font-style:italic;">Brak zleceń spełniających kryteria.</td></tr>`;
        updateBatchBar();
        return;
    }

    const html = filtered
        .map((o) => {
            const statusConfig = zleceniaStatusMap[o.status] || {
                label: o.status || 'Nieznany',
                class: '',
                icon: '<i data-lucide="help-circle"></i>'
            };

            const orderNum = o.productionOrderNumber
                ? `<span class="order-num">${escapeHtml(o.productionOrderNumber)}</span>`
                : `<span class="order-num-missing">— brak —</span>`;

            const safeSalesOrder = o.dbSalesOrderNumber || o.salesOrderNumber;
            const salesOrderLabel = safeSalesOrder
                ? `<span class="sales-order-badge">${escapeHtml(safeSalesOrder)}</span>`
                : '<span style="color:var(--text-muted); font-size:0.75rem;">—</span>';

            const wellName = escapeHtml(o.wellName || '—');
            const projectName = escapeHtml(o.projectName || o.obiekt || '');
            const elementInfo = escapeHtml(
                o.elementName ||
                    o.productName ||
                    (o.elementIndex !== undefined ? `Element #${o.elementIndex}` : '—')
            );

            const isAccepted = o.status === 'accepted';
            const isDraft = !isAccepted && o.id;
            const isChecked = zleceniaSelectedIds.has(o.id);

            let actions = '';
            const safeOfferId = escapeJsStr(o.offerId || '');
            const safeWellId = escapeJsStr(o.wellId || '');
            const safeElementIdx = escapeJsStr(o.elementIndex !== undefined ? o.elementIndex : '');
            const safeSalesOrderId = escapeJsStr(o.dbSalesOrderId || '');
            const safeId = escapeJsStr(o.id);
            if (o.offerId) {
                actions += `<button class="action-btn action-btn-edit" data-action="editProductionOrder" data-offer-id="${safeOfferId}" data-well-id="${safeWellId}" data-element-idx="${safeElementIdx}" data-sales-order-id="${safeSalesOrderId}" title="Edytuj" aria-label="Edytuj"><i data-lucide="pencil" aria-hidden="true"></i></button>`;
            }
            actions += `<button class="action-btn" aria-label="Drukuj zlecenie" data-action="printSingleZlecenie" data-safe-id="${safeId}" title="Drukuj zlecenie"><i data-lucide="printer" aria-hidden="true"></i></button>`;
            actions += `<button class="action-btn" aria-label="Drukuj etykietę" data-action="printSingleEtykieta" data-safe-id="${safeId}" title="Drukuj etykietę"><i data-lucide="tag" aria-hidden="true"></i></button>`;
            if (isDraft) {
                actions += `<button class="action-btn action-btn-delete" aria-label="Usuń zlecenie" data-action="deleteOrder" data-safe-id="${safeId}" title="Usuń zlecenie"><i data-lucide="trash-2" aria-hidden="true"></i></button>`;
            }

            const safeStatusClass = escapeHtml(statusConfig.class);
            const safeStatusLabel = escapeHtml(statusConfig.label);

            return `
            <tr>
                <td style="width:40px; text-align:center;">
                    <input type="checkbox" class="zlecenia-row-cb" data-action="toggleSelectZlecenie" data-id="${safeId}" ${isChecked ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color:var(--accent-hover);">
                </td>
                <td>${orderNum}</td>
                <td class="date-cell">${formatDate(o.createdAt)}</td>
                <td>
                    <div class="well-cell-name">${wellName}</div>
                    ${projectName ? `<div class="well-cell-project">${projectName}</div>` : ''}
                </td>
                <td>${salesOrderLabel}</td>
                <td class="element-cell">${elementInfo}</td>
                <td><span class="person-badge person-handler"><i data-lucide="user" aria-hidden="true"></i> ${escapeHtml(o.handlerName || '—')}</span></td>
                <td><span class="person-badge person-creator"><i data-lucide="settings" aria-hidden="true"></i> ${escapeHtml(o.creatorName || '—')}</span></td>
                <td><span class="status-badge ${safeStatusClass}">${statusConfig.icon} ${safeStatusLabel}</span></td>
                <td style="text-align:right">
                    <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
                        ${actions}
                    </div>
                </td>
            </tr>
        `;
        })
        .join('');

    tbody.innerHTML = html;
    updateBatchBar();
}

async function deleteOrder(id) {
    const order = zleceniaOrdersCache.find((o) => o.id === id);
    if (!order) return;

    if (order.status === 'accepted') {
        showToast('Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.', 'error');
        return;
    }

    if (
        !(await appConfirm('Usunąć zlecenie ' + (order.productionOrderNumber || '') + '?', {
            title: 'Usuwanie zlecenia',
            type: 'danger'
        }))
    )
        return;

    try {
        const res = await fetch('/api/orders-studnie/production/' + id, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Błąd serwera');
        }

        zleceniaOrdersCache = zleceniaOrdersCache.filter((o) => o.id !== id);
        zleceniaSelectedIds.delete(id);
        renderStats();
        const searchInput = document.getElementById('zlecenia-search-input');
        renderTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
        showToast('Zlecenie usunięte', 'info');

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

function editOrder(offerId, wellId = '', elementIndex = '', salesOrderId = '') {
    if (!offerId) return;

    let extraParams = '&autoopen=zlecenia';
    if (wellId) extraParams += `&wellId=${wellId}`;
    if (elementIndex !== '') extraParams += `&elementIndex=${elementIndex}`;

    const useOrderMode =
        salesOrderId &&
        salesOrderId !== '' &&
        salesOrderId !== 'null' &&
        salesOrderId !== 'undefined';
    const mainParam = useOrderMode ? `order=${salesOrderId}` : `edit=${offerId}`;

    if (window.parent && window.parent.SpaRouter) {
        window.parent.location.hash = `#/studnie?${mainParam}${extraParams}`;
    } else {
        window.location.href = `studnie.html?${mainParam}${extraParams}`;
    }
}
