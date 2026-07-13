// @ts-check
/**
 * Shared UI Module — Część 2: okna dialogowe i zaawansowane komponenty.
 * showUserSelectionPopup, appConfirm, createSaveIndicator, fetchGlobalUsers.
 */

function showUserSelectionPopup(users, defaultUserId) {
    return new Promise((resolve) => {
        let resolved = false;
        const once = (result) => {
            if (!resolved) {
                resolved = true;
                resolve(result);
            }
        };

        let html = `<div id="user-selection-title" style="font-size:1.1rem; font-weight:700; margin-bottom:1rem; color:var(--warn);"><i data-lucide="user"></i> Przypisz do użytkownika (Opiekun)</div>`;
        html += `<div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:1rem;">Wybierz pracownika, do którego ma zostać przypisany ten dokument.</div>`;
        html += `<div style="display:flex; flex-direction:column; gap:0.4rem;">`;

        users.forEach((u) => {
            const displayName =
                u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username;
            const isDefault = u.id === defaultUserId;
            const symbol = u.symbol || '??';
            const roleBadge =
                u.role === 'admin'
                    ? '<i data-lucide="key"></i>'
                    : u.role === 'pro'
                      ? '⭐'
                      : '<i data-lucide="user"></i>';

            html += `<button class="user-select-btn${isDefault ? ' is-default' : ''}" data-user-id="${u.id}">
                <span style="font-size:1.1rem;">${roleBadge}</span>
                <div class="flex-1">
                    <div style="font-weight:700;">${displayName}</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary);">Symbol: ${symbol}</div>
                </div>
                ${isDefault ? '<span style="font-size:0.65rem; color:var(--accent-hover); font-weight:700;">DOMYŚLNY</span>' : ''}
            </button>`;
        });

        html += `</div>`;
        html += `<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.2rem;">`;
        html += `<button id="user-select-cancel" style="padding:0.5rem 1rem; border:1px solid rgba(255,255,255,0.1); border-radius:8px; background:transparent; color:var(--text-secondary); cursor:pointer; font:500 0.8rem Inter,sans-serif;">Anuluj</button>`;
        html += `</div>`;

        const overlay = showModal({
            id: 'user-selection-overlay',
            titleId: 'user-selection-title',
            html: `<div class="modal" style="background:#1a2536; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:1.5rem; min-width:350px; max-width:500px; max-height:80vh; overflow-y:auto; color:var(--text-primary); font-family:Inter,sans-serif;">${html}</div>`,
            onClose: () => once(null)
        });
        if (window.lucide) lucide.createIcons();

        overlay.querySelectorAll('.user-select-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-user-id');
                const selectedUser = users.find((u) => u.id === userId);
                if (selectedUser) {
                    selectedUser.displayName =
                        selectedUser.firstName && selectedUser.lastName
                            ? `${selectedUser.firstName} ${selectedUser.lastName}`
                            : selectedUser.username;
                }
                overlay.remove();
                once(selectedUser);
            });
        });

        overlay.querySelector('#user-select-cancel').addEventListener('click', () => {
            overlay.remove();
            once(null);
        });
    });
}

window.globalUsersMap = new Map();

window.fetchWithTimeout = async function (url, options, timeoutMs) {
    if (timeoutMs == null) timeoutMs = 10000;
    const controller = new AbortController();
    const timer = setTimeout(function () {
        controller.abort();
    }, timeoutMs);
    try {
        return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
        clearTimeout(timer);
    }
};

async function fetchGlobalUsers() {
    try {
        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        const response = await fetchWithTimeout('/api/users-for-assignment', { headers });
        if (!response.ok) return;
        const json = await response.json();
        const users = json.data || [];
        window.globalUsersMap.clear();
        users.forEach((u) => {
            const displayName =
                u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username;
            window.globalUsersMap.set(u.id, displayName);
            window.globalUsersMap.set(u.username, displayName);
        });
        logger.info('ui', `[SharedUI] Załadowano ${users.length} użytkowników do globalnej mapy.`);
    } catch (e) {
        logger.warn('ui', '[SharedUI] fetchGlobalUsers error:', e);
    }
}

function appConfirm(message, opts = {}) {
    const { title = 'Potwierdzenie', okText = 'OK', cancelText = 'Anuluj', type = 'info' } = opts;

    return new Promise((resolve) => {
        let resolved = false;
        const once = (result) => {
            if (!resolved) {
                resolved = true;
                resolve(result);
            }
        };

        _ensureConfirmStyles();

        const iconMap = {
            info: '<i data-lucide="info" style="width: 32px; height: 32px; color: var(--accent);"></i>',
            warning:
                '<i data-lucide="alert-triangle" style="width: 32px; height: 32px; color: var(--warn);"></i>',
            danger: '<i data-lucide="trash-2" style="width: 32px; height: 32px; color: var(--danger);"></i>'
        };
        const accentMap = {
            info: 'var(--accent)',
            warning: 'var(--warn)',
            danger: 'var(--danger)'
        };
        const accent = accentMap[type] || accentMap.info;

        const safeTitle = opts.allowHtml ? title : _escapeHtml(title);
        const safeMsg = opts.allowHtml
            ? message.replace(/\n/g, '<br>')
            : _escapeHtml(message).replace(/\n/g, '<br>');

        const html = `
            <div class="app-confirm-modal">
                <div class="app-confirm-icon" id="app-confirm-icon">${iconMap[type] || iconMap.info}</div>
                <div class="app-confirm-title" id="app-confirm-title">${safeTitle}</div>
                <div class="app-confirm-message" id="app-confirm-message">${safeMsg}</div>
                <div class="app-confirm-actions">
                    <button class="app-confirm-btn" id="app-confirm-cancel">${cancelText}</button>
                    <button class="app-confirm-btn" id="app-confirm-ok" style="background:${accent}">${okText}</button>
                </div>
            </div>`;

        const overlay = showModal({
            id: 'app-confirm-overlay',
            titleId: 'app-confirm-title',
            html: html,
            onClose: () => once(false)
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            setTimeout(() => window.lucide.createIcons({ root: overlay }), 10);
        }

        setTimeout(() => {
            const okBtn = document.getElementById('app-confirm-ok');
            const cancelBtn = document.getElementById('app-confirm-cancel');
            if (!okBtn || !cancelBtn) return;

            okBtn.focus();

            okBtn.addEventListener('click', () => {
                overlay.remove();
                once(true);
            });
            cancelBtn.addEventListener('click', () => {
                overlay.remove();
                once(false);
            });

            overlay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    overlay.remove();
                    once(true);
                }
            });
        }, 50);
    });
}

function _ensureConfirmStyles() {
    if (document.getElementById('app-confirm-styles')) return;

    const style = document.createElement('style');
    style.id = 'app-confirm-styles';
    style.textContent = `
        .app-confirm-modal {
            background:#0d1520;
            border:1px solid #2e2e75;
            border-radius:16px;
            width:100%; max-width:800px;
            padding:1.5rem 3rem;
            box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(var(--accent-rgb),0.08);
            text-align:center;
            animation:appConfirmIn 0.2s ease-out;
        }
        @keyframes appConfirmIn {
            from { opacity:0; transform:scale(0.95) translateY(10px); }
            to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .app-confirm-icon { font-size:2rem; margin-bottom:0.6rem; }
        .app-confirm-title {
            font-size:1.05rem; font-weight:700; color:#fff;
            margin-bottom:0.6rem;
        }
        .app-confirm-message {
            font-size:0.85rem; color:var(--text-secondary);
            margin-bottom:1.5rem; line-height:1.55;
        }
        .app-confirm-actions {
            display:flex; gap:0.75rem; justify-content:center;
        }
        .app-confirm-btn {
            flex:1; padding:0.6rem 1rem; border-radius:8px;
            font:600 0.85rem 'Inter',sans-serif;
            cursor:pointer; transition:all 0.15s; border:none;
        }
        .app-confirm-btn:focus { outline:2px solid var(--accent-hover); outline-offset:2px; }
        #app-confirm-ok { background:#4f46e5; color:white; }
        #app-confirm-ok:hover { filter:brightness(1.15); transform:translateY(-1px); }
        #app-confirm-cancel {
            background:#1e2d42; color:var(--text-secondary);
            border:1px solid rgba(255,255,255,0.08);
        }
        #app-confirm-cancel:hover { color:#fff; background:#2d3e5a; }
    `;
    document.head.appendChild(style);
}

function _escapeHtml(str) {
    return escapeHtml(str);
}

window.appConfirm = appConfirm;

function createSaveIndicator(parent, opts = {}) {
    if (!parent) return null;
    const { savedDuration = 2000 } = opts;

    const el = document.createElement('span');
    el.className = 'save-indicator';
    el.setAttribute('aria-live', 'polite');
    el.style.cssText =
        'display:inline-flex; align-items:center; gap:0.35rem; font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-left:0.6rem; opacity:0; transition:opacity 0.2s;';
    parent.appendChild(el);

    let savedTimer = null;

    function render(state, text, color) {
        el.style.opacity = '1';
        el.style.color = color;
        el.textContent = '';
        const iconName =
            state === 'saving'
                ? 'loader'
                : state === 'saved'
                  ? 'check'
                  : state === 'error'
                    ? 'alert-circle'
                    : 'circle';
        const iconEl = document.createElement('i');
        iconEl.setAttribute('data-lucide', iconName);
        iconEl.style.cssText =
            'width:14px;height:14px;' +
            (state === 'saving' ? 'animation:saveSpin 0.8s linear infinite;' : '');
        el.appendChild(iconEl);
        const span = document.createElement('span');
        span.textContent = text;
        el.appendChild(span);
        if (window.lucide) window.lucide.createIcons({ root: el });
    }

    function ensureSpinKeyframes() {
        if (document.getElementById('save-indicator-spin')) return;
        const s = document.createElement('style');
        s.id = 'save-indicator-spin';
        s.textContent = '@keyframes saveSpin { to { transform: rotate(360deg); } }';
        document.head.appendChild(s);
    }

    return {
        setSaving() {
            if (savedTimer) {
                clearTimeout(savedTimer);
                savedTimer = null;
            }
            ensureSpinKeyframes();
            render('saving', 'Zapisuję...', 'var(--text-secondary)');
        },
        setSaved() {
            if (savedTimer) clearTimeout(savedTimer);
            render('saved', 'Zapisano', 'var(--success)');
            savedTimer = window.setTimeout(() => {
                el.style.opacity = '0';
                savedTimer = null;
            }, savedDuration);
        },
        setError(message) {
            if (savedTimer) {
                clearTimeout(savedTimer);
                savedTimer = null;
            }
            render('error', message || 'Błąd zapisu', 'var(--danger)');
        },
        destroy() {
            if (savedTimer) clearTimeout(savedTimer);
            el.remove();
        }
    };
}

window.createSaveIndicator = createSaveIndicator;
