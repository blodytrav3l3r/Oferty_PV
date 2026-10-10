// @ts-check
/* ===== KARTOTEKA INITIALIZATION ===== */

document.addEventListener('DOMContentLoaded', async () => {
    // Wariant A: sesję potwierdza wyłącznie GET /api/auth/me na cookie httpOnly.
    try {
        const authRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
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

let compactModeEnabled = false;
try {
    const _compactRaw =
        typeof localStorage !== 'undefined' ? localStorage.getItem('kartoteka-compact-mode') : null;
    compactModeEnabled = typeof _compactRaw === 'string' && _compactRaw === 'true';
} catch (_e) {
    compactModeEnabled = false;
}

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
    try {
        localStorage.setItem('kartoteka-compact-mode', String(compactModeEnabled));
    } catch (_e) {}
    applyCompactMode();
};

let compactObserver = null;

document.addEventListener('DOMContentLoaded', () => {
    applyCompactMode();
    bindStaticActions();
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

/* ===== Statyczne akcje CSP-B (data-ka zamiast onclick) ===== */
function bindStaticActions() {
    document.querySelectorAll('.ka-type-filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => filterByType(btn.dataset.typeFilter));
    });
    document.querySelectorAll('.ka-filter-btn[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (window.kartotekaUI) window.kartotekaUI.setFilterLocalOffers(btn.dataset.filter);
        });
    });
    // Opieka nad ofertą (P1): filtr losu oferty.
    document.querySelectorAll('.ka-followup-filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (window.kartotekaUI)
                window.kartotekaUI.setFollowupFilter(btn.dataset.followupFilter);
        });
    });
    // Opieka nad ofertą (P2): ukrywanie wstrzymanych.
    document.querySelectorAll('.ka-hide-paused-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (window.kartotekaUI) window.kartotekaUI.toggleHidePaused();
        });
    });
    document.getElementById('ka-clear-filters')?.addEventListener('click', () => {
        if (window.kartotekaUI) window.kartotekaUI.clearAllFilters();
    });
    document.getElementById('btn-compact-mode')?.addEventListener('click', () => {
        window.toggleCompactMode();
    });
    document.querySelectorAll('[data-ka="reload"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (window.kartotekaUI) window.kartotekaUI.loadLocalOffers();
        });
    });
}

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

    // Synchronizuj stan UI po starcie (m.in. podświetlenie presetu „Dzisiaj" i licznik filtrów).
    if (typeof ui._syncFilterUI === 'function') ui._syncFilterUI();
}

window.initAdvancedFilterEvents = initAdvancedFilterEvents;

/* ===== Rejestracja globali ===== */
window.filterByType = filterByType;
