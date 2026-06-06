/**
 * Shared UI Module — wspólne komponenty interfejsu.
 * Eliminuje duplikat showToast/closeModal/toggleCard/showSection z app.js i app_studnie.js.
 */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}
window.escapeHtml = escapeHtml;

function getUserDisplayName(user) {
  if (!user) return '';
  return user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.username || '';
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function trapFocus(container) {
  const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === 'Escape') closeModal();
  });
}

/**
 * Wyświetla powiadomienie toast.
 * @param {string} msg - treść powiadomienia
 * @param {'success'|'error'|'info'|'warning'} type - typ powiadomienia
 */
function showToast(msg, type = 'info') {
    const container =
        document.getElementById('toast-container') || document.querySelector('.toast-container');
    if (!container) {
        console.warn('showToast: brak #toast-container w HTML');
        return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const text = document.createElement('span');
    text.innerHTML = msg;
    if (window.lucide) lucide.createIcons();
    text.style.flex = '1';
    toast.appendChild(text);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
    if (window.lucide) lucide.createIcons();
    closeBtn.style.cssText =
        'background:none;border:none;color:inherit;cursor:pointer;font-size:1rem;padding:0 0 0 .5rem;opacity:.7;';
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * Zamyka modal (popup) po ID.
 * @param {string} id - ID elementu modala
 */
function closeModal(id) {
    if (id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    } else {
        document.querySelectorAll('.js-modal-overlay').forEach((m) => m.remove());
    }
}

/**
 * Toggle (zwijanie/rozwijanie) karty.
 * @param {HTMLElement} header - kliknięty nagłówek
 */
function toggleCard(header) {
    const card = header.closest('.card');
    if (!card) return;
    const body = card.querySelector('.card-body');
    if (!body) return;
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
    const icon = header.querySelector('.toggle-icon');
    if (icon) icon.textContent = body.style.display === 'none' ? '▸' : '▾';
}

/**
 * Przełącza widoczną sekcję na stronie.
 * @param {string} name - nazwa sekcji
 */
function showSection(name) {
    document.querySelectorAll('.section').forEach((s) => {
        s.style.display = s.id === 'section-' + name ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-link, .nav-btn').forEach((n) => {
        n.classList.toggle('active', n.getAttribute('data-section') === name);
    });
}

/**
 * Wyświetla okno wyboru użytkownika do przypisania oferty/zamówienia.
 * @param {Array} users - lista użytkowników
 * @param {string} defaultUserId - ID domyślnie wybranego użytkownika
 * @returns {Promise<Object|null>}
 */
function showUserSelectionPopup(users, defaultUserId) {
    return new Promise((resolve) => {
        let resolved = false;
        const once = (result) => { if (!resolved) { resolved = true; resolve(result); } };

        let html = `<div id="user-selection-title" style="font-size:1.1rem; font-weight:700; margin-bottom:1rem; color:#f59e0b;"><i data-lucide="user"></i> Przypisz do użytkownika (Opiekun)</div>`;
        html += `<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:1rem;">Wybierz pracownika, do którego ma zostać przypisany ten dokument.</div>`;
        html += `<div style="display:flex; flex-direction:column; gap:0.4rem;">`;

        users.forEach((u) => {
            const displayName =
                u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username;
            const isDefault = u.id === defaultUserId;
            const symbol = u.symbol || '??';
            const roleBadge = u.role === 'admin' ? '<i data-lucide="key"></i>' : u.role === 'pro' ? '⭐' : '<i data-lucide="user"></i>';

            html += `<button class="user-select-btn" data-user-id="${u.id}" style="
                display:flex; align-items:center; gap:0.8rem; padding:0.7rem 1rem;
                background:${isDefault ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
                border:1px solid ${isDefault ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'};
                border-radius:10px; cursor:pointer; color:#e2e8f0; font:500 0.85rem Inter,sans-serif;
                transition:all 0.15s; text-align:left; width:100%;
            " onmouseenter="this.style.borderColor='rgba(99,102,241,0.4)';this.style.background='rgba(99,102,241,0.1)'"
               onmouseleave="if(!this.classList.contains('selected')){this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='rgba(255,255,255,0.03)'}">
                <span style="font-size:1.1rem;">${roleBadge}</span>
                <div style="flex:1;">
                    <div style="font-weight:700;">${displayName}</div>
                    <div style="font-size:0.7rem; color:#94a3b8;">Symbol: ${symbol}</div>
                </div>
                ${isDefault ? '<span style="font-size:0.65rem; color:#818cf8; font-weight:700;">DOMYŚLNY</span>' : ''}
            </button>`;
        });

        html += `</div>`;
        html += `<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.2rem;">`;
        html += `<button id="user-select-cancel" style="padding:0.5rem 1rem; border:1px solid rgba(255,255,255,0.1); border-radius:8px; background:transparent; color:#94a3b8; cursor:pointer; font:500 0.8rem Inter,sans-serif;">Anuluj</button>`;
        html += `</div>`;

        const overlay = showModal({
            id: 'user-selection-overlay',
            titleId: 'user-selection-title',
            html: `<div class="modal" style="background:#1a2536; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:1.5rem; min-width:350px; max-width:500px; max-height:80vh; overflow-y:auto; color:#e2e8f0; font-family:Inter,sans-serif;">${html}</div>`,
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

/**
 * Globalna mapa użytkowników (id/username -> displayName).
 */
window.globalUsersMap = new Map();

/**
 * Globalny fetch z timeoutem — AbortController czyści wiszące połączenia.
 */
window.fetchWithTimeout = async function(url, options, timeoutMs) {
    if (timeoutMs == null) timeoutMs = 10000;
    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, timeoutMs);
    try {
        return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Pobiera listę użytkowników i wypełnia globalUsersMap.
 */
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
        console.log(`[SharedUI] Załadowano ${users.length} użytkowników do globalnej mapy.`);
    } catch (e) {
        console.warn('[SharedUI] fetchGlobalUsers error:', e);
    }
}

/**
 * In-app confirm dialog — zastępuje natywne confirm().
 * Zwraca Promise<boolean> (true = OK, false = Anuluj).
 * Modal jest tworzony dynamicznie przy pierwszym użyciu.
 *
 * @param {string} message - Treść pytania (obsługuje \n jako nową linię)
 * @param {object} [opts] - Opcje
 * @param {string} [opts.title='Potwierdzenie'] - Nagłówek modala
 * @param {string} [opts.okText='OK'] - Tekst przycisku OK
 * @param {string} [opts.cancelText='Anuluj'] - Tekst przycisku Anuluj
 * @param {'info'|'warning'|'danger'} [opts.type='info'] - Typ (ikona + kolor)
 * @returns {Promise<boolean>}
 */
function appConfirm(message, opts = {}) {
    const { title = 'Potwierdzenie', okText = 'OK', cancelText = 'Anuluj', type = 'info' } = opts;

    return new Promise((resolve) => {
        let resolved = false;
        const once = (result) => { if (!resolved) { resolved = true; resolve(result); } };

        _ensureConfirmStyles();

        const iconMap = { info: '<i data-lucide="info" style="width: 32px; height: 32px; color: #6366f1;"></i>', warning: '<i data-lucide="alert-triangle" style="width: 32px; height: 32px; color: #f59e0b;"></i>', danger: '<i data-lucide="trash-2" style="width: 32px; height: 32px; color: #ef4444;"></i>' };
        const accentMap = { info: '#6366f1', warning: '#f59e0b', danger: '#ef4444' };
        const accent = accentMap[type] || accentMap.info;

        const safeTitle = opts.allowHtml ? title : _escapeHtml(title);
        const safeMsg = opts.allowHtml ? message.replace(/\n/g, '<br>') : _escapeHtml(message).replace(/\n/g, '<br>');

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

            okBtn.addEventListener('click', () => { overlay.remove(); once(true); });
            cancelBtn.addEventListener('click', () => { overlay.remove(); once(false); });

            overlay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { overlay.remove(); once(true); }
            });
        }, 50);
    });
}

/** Tworzy style dla modala potwierdzenia jeśli jeszcze nie istnieją */
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
            box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.08);
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
            font-size:0.85rem; color:#94a3b8;
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
        .app-confirm-btn:focus { outline:2px solid #818cf8; outline-offset:2px; }
        #app-confirm-ok { background:#4f46e5; color:white; }
        #app-confirm-ok:hover { filter:brightness(1.15); transform:translateY(-1px); }
        #app-confirm-cancel {
            background:#1e2d42; color:#94a3b8;
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

/**
 * SaveIndicator — wizualny wskaźnik zapisu (saving / saved / error).
 * Sam zarządza własnym elementem DOM i cyklem życia.
 *
 * Użycie:
 *   const indicator = createSaveIndicator(document.getElementById('my-header'));
 *   indicator.setSaving();
 *   await fetch(...);
 *   indicator.setSaved();
 *
 * @param {HTMLElement} parent - element, do którego dopiąć wskaźnik
 * @param {Object} [opts]
 * @param {number} [opts.savedDuration=2000] - ile ms pokazywać "Zapisano" zanim zniknie
 * @returns {{ setSaving, setSaved, setError, destroy }}
 */
function createSaveIndicator(parent, opts = {}) {
    if (!parent) return null;
    const { savedDuration = 2000 } = opts;

    const el = document.createElement('span');
    el.className = 'save-indicator';
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'display:inline-flex; align-items:center; gap:0.35rem; font-size:0.72rem; font-weight:600; color:#94a3b8; margin-left:0.6rem; opacity:0; transition:opacity 0.2s;';
    parent.appendChild(el);

    let savedTimer = null;

    function render(state, text, color) {
        el.style.opacity = '1';
        el.style.color = color;
        const icon =
            state === 'saving' ? "<i data-lucide=\"loader\" style=\"width:14px;height:14px;animation:saveSpin 0.8s linear infinite\"></i>" :
            state === 'saved'  ? '<i data-lucide="check" style="width:14px;height:14px"></i>' :
            state === 'error'  ? '<i data-lucide="alert-circle" style="width:14px;height:14px"></i>' :
                                 '<i data-lucide="circle" style="width:14px;height:14px"></i>';
        el.innerHTML = `${icon}<span>${text}</span>`;
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
            if (savedTimer) { clearTimeout(savedTimer); savedTimer = null; }
            ensureSpinKeyframes();
            render('saving', 'Zapisuję...', '#94a3b8');
        },
        setSaved() {
            if (savedTimer) clearTimeout(savedTimer);
            render('saved', 'Zapisano', '#10b981');
            savedTimer = window.setTimeout(() => {
                el.style.opacity = '0';
                savedTimer = null;
            }, savedDuration);
        },
        setError(message) {
            if (savedTimer) { clearTimeout(savedTimer); savedTimer = null; }
            render('error', message || 'Błąd zapisu', '#ef4444');
        },
        destroy() {
            if (savedTimer) clearTimeout(savedTimer);
            el.remove();
        }
    };
}

window.createSaveIndicator = createSaveIndicator;

/**
 * Create and show a modal overlay with standard ARIA attributes.
 * @param {Object} opts
 * @param {string} opts.id - Overlay element ID
 * @param {string} opts.title - Modal title (for aria-labelledby)
 * @param {string} opts.titleId - Element ID for the title
 * @param {string} opts.html - Modal inner HTML
 * @param {Function} [opts.onOpen] - Called after modal is shown
 * @param {Function} [opts.onClose] - Called when modal is closed
 * @returns {HTMLDivElement} The overlay element
 */
window.showModal = function(opts) {
    const existing = document.getElementById(opts.id);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay js-modal-overlay';
    overlay.id = opts.id;
    overlay.role = 'dialog';
    overlay.ariaModal = 'true';
    if (opts.titleId) overlay.setAttribute('aria-labelledby', opts.titleId);

    overlay.innerHTML = opts.html;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
            if (opts.onClose) opts.onClose();
        }
    });

    overlay.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            if (opts.onClose) opts.onClose();
        }
    });

    trapFocus(overlay);

    const firstBtn = overlay.querySelector('button');
    if (firstBtn) setTimeout(function() { firstBtn.focus(); }, 50);

    if (opts.onOpen) opts.onOpen();
    return overlay;
};
