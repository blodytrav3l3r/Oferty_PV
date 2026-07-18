// @ts-check
/* ===== KARTOTEKA INITIALIZATION ===== */
let currentTypeFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
        const authData = await authRes.json();
        if (!authData.user) {
            window.location.href = 'index.html';
            return;
        }

        const user = authData.user;
        sessionStorage.setItem('user', JSON.stringify(user));

        const userEl = document.getElementById('header-username');
        const roleEl = document.getElementById('header-role-badge');
        if (userEl) userEl.innerHTML = '<i data-lucide="user"></i> ' + escapeHtml(user.username);
        if (roleEl) {
            roleEl.textContent =
                user.role === 'admin' ? 'ADMIN' : user.role === 'pro' ? 'PRO' : 'USER';
            const colorMap = {
                admin: {
                    bg: 'rgba(var(--warn-rgb),0.15)',
                    fg: 'var(--warn)',
                    border: 'rgba(var(--warn-rgb),0.3)'
                },
                pro: {
                    bg: 'rgba(var(--success-rgb),0.15)',
                    fg: 'var(--success)',
                    border: 'rgba(var(--success-rgb),0.3)'
                },
                user: {
                    bg: 'rgba(var(--blue-rgb),0.15)',
                    fg: 'var(--blue-hover)',
                    border: 'rgba(var(--blue-rgb),0.3)'
                }
            };
            const c = colorMap[user.role] || colorMap.user;
            roleEl.style.background = c.bg;
            roleEl.style.color = c.fg;
            roleEl.style.border = '1px solid ' + c.border;
        }
    } catch (e) {
        window.location.href = 'index.html';
        return;
    }
});

function filterByType(type) {
    currentTypeFilter = type;

    document.querySelectorAll('.pv-type-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.typeFilter === type);
        if (btn.dataset.typeFilter === type) {
            btn.classList.remove('btn-secondary');
        } else {
            btn.classList.add('btn-secondary');
        }
    });

    if (window.pvSalesUI) {
        window.pvSalesUI.setTypeFilter(type);
    }
}

let compactModeEnabled = localStorage.getItem('kartoteka-compact-mode') === 'true';

function applyCompactMode() {
    const grid = document.getElementById('pv-local-offers-list');
    if (!grid) return;
    if (compactModeEnabled) {
        grid.classList.add('compact-mode');
    } else {
        grid.classList.remove('compact-mode');
    }
    const btn = document.getElementById('btn-compact-mode');
    if (btn) {
        btn.classList.toggle('btn-secondary', !compactModeEnabled);
        btn.classList.toggle('active', compactModeEnabled);
        btn.innerHTML = compactModeEnabled
            ? '<i data-lucide="panel-right-open"></i> Kompakt'
            : '<i data-lucide="panel-right-close"></i> Kompakt';
    }
    if (typeof lucide === 'object' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

window.toggleCompactMode = function () {
    compactModeEnabled = !compactModeEnabled;
    localStorage.setItem('kartoteka-compact-mode', String(compactModeEnabled));
    applyCompactMode();
};

let compactObserver = null;

document.addEventListener('DOMContentLoaded', () => {
    applyCompactMode();
    const grid = document.getElementById('pv-local-offers-list');
    if (grid) {
        compactObserver = new MutationObserver(() => applyCompactMode());
        compactObserver.observe(grid, { childList: true, subtree: true });
    }

    if (window.PvImportExportToolbar) {
        window.PvImportExportToolbar.init('ie-toolbar-host');
    }
});

window.addEventListener('pagehide', () => {
    if (compactObserver) {
        compactObserver.disconnect();
        compactObserver = null;
    }
});

function initAdvancedFilterEvents(ui) {
    if (!ui) return;

    const userSelect = document.getElementById('pv-user-filter');
    if (userSelect) {
        userSelect.addEventListener('change', () => ui.setUserFilter(userSelect.value));
    }

    document
        .getElementById('pv-my-offers-btn')
        ?.addEventListener('click', () => ui.toggleMyOffers());

    document.querySelectorAll('.pv-date-preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => ui.setDatePreset(btn.dataset.dateRange));
    });

    const rangeBtn = document.getElementById('pv-date-range-btn');
    const popover = document.getElementById('pv-date-popover');
    const dateFrom = document.getElementById('pv-date-from');
    const dateTo = document.getElementById('pv-date-to');

    if (rangeBtn && popover) {
        rangeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popover.style.display !== 'none') {
                hideDatePopover(ui, popover, dateFrom, dateTo);
            } else {
                showDatePopover(ui, popover, rangeBtn);
            }
        });

        document.addEventListener('click', (e) => {
            if (popover.style.display === 'none') return;
            if (
                !popover.contains(e.target) &&
                e.target !== rangeBtn &&
                !rangeBtn.contains(e.target)
            ) {
                hideDatePopover(ui, popover, dateFrom, dateTo);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && popover.style.display !== 'none') {
                hideDatePopover(ui, popover, dateFrom, dateTo);
            }
        });
    }

    if (dateFrom)
        dateFrom.addEventListener('change', () =>
            ui.onDateRangeChange(dateFrom.value, dateTo?.value || '')
        );
    if (dateTo)
        dateTo.addEventListener('change', () =>
            ui.onDateRangeChange(dateFrom?.value || '', dateTo.value)
        );

    document
        .getElementById('pv-clear-filters-btn')
        ?.addEventListener('click', () => ui.clearFilters());
}

function showDatePopover(ui, popover, anchor) {
    var rect = anchor.getBoundingClientRect();
    popover.style.display = 'block';
    popover.style.left = rect.left + 'px';
    popover.style.top = rect.bottom + 6 + 'px';
    popover.style.opacity = '0';
    popover.style.transform = 'translateY(-4px)';
    ui.filters.date.mode = 'range';
    ui.filters.date.preset = '';
    ui._syncFilterUI();
    ui.filterLocalOffers();
    requestAnimationFrame(function () {
        popover.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        popover.style.opacity = '1';
        popover.style.transform = 'translateY(0)';
    });
}

function hideDatePopover(ui, popover, dateFrom, dateTo) {
    popover.style.display = 'none';
    popover.style.opacity = '';
    popover.style.transform = '';
    popover.style.transition = '';
    if (dateFrom && dateTo && !dateFrom.value && !dateTo.value) {
        ui.filters.date.mode = 'none';
        ui._syncFilterUI();
        ui.filterLocalOffers();
    }
}

window.initAdvancedFilterEvents = initAdvancedFilterEvents;
