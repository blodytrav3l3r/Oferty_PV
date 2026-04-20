/**
 * Shared UI Module — wspólne komponenty interfejsu.
 * Eliminuje duplikat showToast/closeModal/toggleCard/showSection z app.js i app_studnie.js.
 */

/**
 * Wyświetla powiadomienie toast.
 * @param {string} msg - treść powiadomienia
 * @param {'success'|'error'|'info'} type - typ powiadomienia
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

    const text = document.createElement('span');
    text.innerHTML = msg;
    text.style.flex = '1';
    toast.appendChild(text);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i data-lucide="x"></i>';
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
        document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
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
        const overlay = document.createElement('div');
        overlay.style.cssText =
            'position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:99999; display:flex; align-items:center; justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText =
            'background:#1a2536; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:1.5rem; min-width:350px; max-width:500px; max-height:80vh; overflow-y:auto; color:#e2e8f0; font-family:Inter,sans-serif;';

        let html = `<div style="font-size:1.1rem; font-weight:700; margin-bottom:1rem; color:#f59e0b;"><i data-lucide="user"></i> Przypisz do użytkownika (Opiekun)</div>`;
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

        modal.innerHTML = html;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.querySelectorAll('.user-select-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-user-id');
                const selectedUser = users.find((u) => u.id === userId);
                if (selectedUser) {
                    selectedUser.displayName =
                        selectedUser.firstName && selectedUser.lastName
                            ? `${selectedUser.firstName} ${selectedUser.lastName}`
                            : selectedUser.username;
                }
                document.body.removeChild(overlay);
                resolve(selectedUser);
            });
        });

        modal.querySelector('#user-select-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });
    });
}

/**
 * Globalna mapa użytkowników (id/username -> displayName).
 */
window.globalUsersMap = new Map();

/**
 * Pobiera listę użytkowników i wypełnia globalUsersMap.
 */
async function fetchGlobalUsers() {
    try {
        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        const response = await fetch('/api/users-for-assignment', { headers });
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
        _ensureConfirmDOM();

        const overlay = document.getElementById('app-confirm-overlay');
        const titleEl = document.getElementById('app-confirm-title');
        const msgEl = document.getElementById('app-confirm-message');
        const okBtn = document.getElementById('app-confirm-ok');
        const cancelBtn = document.getElementById('app-confirm-cancel');
        const iconEl = document.getElementById('app-confirm-icon');

        const iconMap = { info: '<i data-lucide="info" style="width: 32px; height: 32px; color: #6366f1;"></i>', warning: '<i data-lucide="alert-triangle" style="width: 32px; height: 32px; color: #f59e0b;"></i>', danger: '<i data-lucide="trash-2" style="width: 32px; height: 32px; color: #ef4444;"></i>' };
        const accentMap = { info: '#6366f1', warning: '#f59e0b', danger: '#ef4444' };
        const accent = accentMap[type] || accentMap.info;

        if (iconEl) iconEl.innerHTML = iconMap[type] || iconMap.info;
        if (titleEl) {
            if (opts.allowHtml) {
                titleEl.innerHTML = title;
            } else {
                titleEl.textContent = title;
            }
        }
        if (msgEl) {
            msgEl.innerHTML = opts.allowHtml ? message.replace(/\n/g, '<br>') : _escapeHtml(message).replace(/\n/g, '<br>');
        }

        okBtn.innerHTML = okText;
        okBtn.style.background = accent;
        cancelBtn.innerHTML = cancelText;

        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
        setTimeout(() => okBtn.focus(), 50);

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            setTimeout(() => window.lucide.createIcons({ root: overlay }), 10);
        }

        const cleanup = (result) => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 150);
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            overlay.removeEventListener('keydown', onKey);
            resolve(result);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onKey = (e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onOk();
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        overlay.addEventListener('keydown', onKey);
    });
}

/** Tworzy DOM modala potwierdzenia jeśli jeszcze nie istnieje */
function _ensureConfirmDOM() {
    if (document.getElementById('app-confirm-overlay')) return;

    const style = document.createElement('style');
    style.textContent = `
        #app-confirm-overlay {
            position:fixed; inset:0;
            background:rgba(0,0,0,0.75);
            backdrop-filter:blur(4px);
            z-index:99999;
            display:none;
            align-items:center;
            justify-content:center;
            transition:opacity 0.15s ease;
        }
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

    const overlay = document.createElement('div');
    overlay.id = 'app-confirm-overlay';
    overlay.tabIndex = -1;
    overlay.innerHTML = `
        <div class="app-confirm-modal">
            <div class="app-confirm-icon" id="app-confirm-icon"></div>
            <div class="app-confirm-title" id="app-confirm-title">Potwierdzenie</div>
            <div class="app-confirm-message" id="app-confirm-message"></div>
            <div class="app-confirm-actions">
                <button class="app-confirm-btn" id="app-confirm-cancel">Anuluj</button>
                <button class="app-confirm-btn" id="app-confirm-ok">OK</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

window.appConfirm = appConfirm;
