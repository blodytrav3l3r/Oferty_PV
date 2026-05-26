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
        if (userEl) userEl.innerHTML = '<i data-lucide="user"></i> ' + user.username;
        if (roleEl) {
            roleEl.textContent =
                user.role === 'admin' ? 'ADMIN' : user.role === 'pro' ? 'PRO' : 'USER';
            const colorMap = {
                admin: {
                    bg: 'rgba(245,158,11,0.15)',
                    fg: '#f59e0b',
                    border: 'rgba(245,158,11,0.3)'
                },
                pro: {
                    bg: 'rgba(16,185,129,0.15)',
                    fg: '#10b981',
                    border: 'rgba(16,185,129,0.3)'
                },
                user: {
                    bg: 'rgba(59,130,246,0.15)',
                    fg: '#60a5fa',
                    border: 'rgba(59,130,246,0.3)'
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
    localStorage.setItem('kartoteka-compact-mode', compactModeEnabled);
    applyCompactMode();
};

document.addEventListener('DOMContentLoaded', () => {
    applyCompactMode();
    const observer = new MutationObserver(() => applyCompactMode());
    const grid = document.getElementById('pv-local-offers-list');
    if (grid) observer.observe(grid, { childList: true, subtree: true });
});

function showSection() {}
