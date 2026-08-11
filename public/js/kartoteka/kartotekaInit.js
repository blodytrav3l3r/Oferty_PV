// @ts-check
/* ===== KARTOTEKA INITIALIZATION ===== */

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

        if (window.headerUser) {
            window.headerUser.render(user);
        }
    } catch (_e) {
        window.location.href = 'index.html';
        return;
    }
});

function filterByType(type) {
    document.querySelectorAll('.ka-type-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.typeFilter === type);
        if (btn.dataset.typeFilter === type) {
            btn.classList.remove('btn-secondary');
        } else {
            btn.classList.add('btn-secondary');
        }
    });

    if (window.kartotekaUI) {
        window.kartotekaUI.setTypeFilter(type);
    }
}

let compactModeEnabled = localStorage.getItem('kartoteka-compact-mode') === 'true';

function applyCompactMode() {
    const grid = document.getElementById('ka-offers-list');
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
    const grid = document.getElementById('ka-offers-list');
    if (grid) {
        compactObserver = new MutationObserver(() => applyCompactMode());
        compactObserver.observe(grid, { childList: true, subtree: true });
    }

    if (window.importExportToolbar) {
        window.importExportToolbar.init('ie-toolbar-host');
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

    const userSelect = document.getElementById('ka-user-filter');
    if (userSelect) {
        userSelect.addEventListener('change', () => ui.setUserFilter(userSelect.value));
    }

    document.querySelectorAll('.ka-date-preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => ui.setDatePreset(btn.dataset.dateRange));
    });

    const dateFrom = document.getElementById('ka-date-from');
    const dateTo = document.getElementById('ka-date-to');

    document.getElementById('ka-date-clear')?.addEventListener('click', () => {
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        ui.onDateRangeChange('', '');
    });

    if (dateFrom)
        dateFrom.addEventListener('change', () =>
            ui.onDateRangeChange(dateFrom.value, dateTo?.value || '')
        );
    if (dateTo)
        dateTo.addEventListener('change', () =>
            ui.onDateRangeChange(dateFrom?.value || '', dateTo.value)
        );
}

window.initAdvancedFilterEvents = initAdvancedFilterEvents;

/* ===== Rejestracja globali ===== */
window.filterByType = filterByType;
