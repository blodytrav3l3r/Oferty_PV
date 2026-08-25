// @ts-check
/**
 * Shared UI Module — wspólne komponenty interfejsu.
 * Eliminuje duplikat closeModal/toggleCard/showSection z app.js i app_studnie.js.
 * showToast przeniesiony do shared/toast.js (ESM, TASK-047 etap 3).
 * fetchJson przeniesiony do shared/fetchJson.js (ESM, TASK-047 etap 4).
 * debounce przeniesiony do shared/debounce.js (ESM, TASK-047 etap 5).
 */

function setText(el, value) {
    if (el) el.textContent = String(value ?? '');
}
window.setText = setText;

function _restoreBodyScroll() {
    if (window.restoreBodyScroll) {
        window.restoreBodyScroll();
        return;
    }
    if (!document.querySelector('.js-modal-overlay')) document.body.style.overflow = '';
}

function getUserDisplayName(user) {
    if (!user) return '';
    return user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username || '';
}

/**
 * Toggle (zwijanie/rozwijanie) karty.
 * Obsługuje 2 sygnatury:
 * 1. (header: HTMLElement) — kliknięty nagłówek (szukamy .card w DOM)
 * 2. (contentId: string, iconId?: string) — ID elementów
 * @param {HTMLElement|string} contentIdOrHeader
 * @param {string} [iconId]
 */
function toggleCard(contentIdOrHeader, iconId) {
    if (contentIdOrHeader instanceof HTMLElement) {
        // Sygnatura 1: header HTMLElement
        const header = contentIdOrHeader;
        const card = header.closest('.card');
        if (!card) return;
        const body = card.querySelector('.card-body');
        if (!body) return;
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
        const icon = header.querySelector('.toggle-icon');
        if (icon) icon.textContent = body.style.display === 'none' ? '▸' : '▾';
    } else if (typeof contentIdOrHeader === 'string') {
        // Sygnatura 2: contentId i iconId (string)
        const content = document.getElementById(contentIdOrHeader);
        const icon = iconId ? document.getElementById(iconId) : null;
        if (content) {
            content.classList.toggle('hidden');
            if (icon) {
                const isHidden = content.classList.contains('hidden');
                icon.innerHTML = isHidden
                    ? '<i data-lucide="chevron-down"></i>'
                    : '<i data-lucide="chevron-up"></i>';
            }
        }
    }
}

/**
 * Przełącza widoczną sekcję na stronie.
 * @param {string} name - nazwa sekcji
 */
function showSection(name) {
    document.querySelectorAll('.section').forEach((s) => {
        const isTarget = s.id === 'section-' + name;
        s.style.display = isTarget ? 'block' : 'none';
        s.classList.toggle('active', isTarget);
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
        const once = (result) => {
            if (!resolved) {
                resolved = true;
                resolve(result);
            }
        };

        let html = `<div id="user-selection-title" style="font-size: var(--fs-3xl); font-weight: var(--fw-bold); margin-bottom:1rem; color:var(--warn);"><i data-lucide="user"></i> Przypisz do użytkownika (Opiekun)</div>`;
        html += `<div style="font-size: var(--fs-base); color:var(--text-secondary); margin-bottom:1rem;">Wybierz pracownika, do którego ma zostać przypisany ten dokument.</div>`;
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

            html += `<button class="user-select-btn" data-user-id="${u.id}" style="
                display:flex; align-items:center; gap:0.8rem; padding:0.7rem 1rem;
                background:${isDefault ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(var(--white-rgb), 0.05)'};
                border:1px solid ${isDefault ? 'rgba(var(--accent-rgb), 0.5)' : 'rgba(var(--white-rgb), 0.05)'};
                border-radius: var(--radius-sm); cursor:pointer; color:var(--text-primary); font:var(--fw-medium) var(--fs-lg) Inter,sans-serif;
                transition:all 0.15s; text-align:left; width:100%;
            " onmouseenter="this.style.borderColor='rgba(var(--accent-rgb), 0.5)';this.style.background='rgba(var(--accent-rgb), 0.1)'"
               onmouseleave="if(!this.classList.contains('selected')){this.style.borderColor='rgba(var(--white-rgb), 0.05)';this.style.background='rgba(var(--white-rgb), 0.05)'}">
                <span class="fs-3xl">${roleBadge}</span>
                <div class="flex-1">
                    <div class="fw-bold">${escapeHtml(displayName)}</div>
                    <div style="font-size: var(--fs-sm); color:var(--text-secondary);">Symbol: ${escapeHtml(symbol)}</div>
                </div>
                ${isDefault ? '<span style="font-size: var(--fs-xs); color:var(--accent-hover); font-weight: var(--fw-bold);">DOMYŚLNY</span>' : ''}
            </button>`;
        });

        html += `</div>`;
        html += `<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.2rem;">`;
        html += `<button id="user-select-cancel" style="padding:0.5rem 1rem; border:1px solid rgba(var(--white-rgb), 0.1); border-radius: var(--radius-sm); background:transparent; color:var(--text-secondary); cursor:pointer; font:var(--fw-medium) var(--fs-md) Inter,sans-serif;">Anuluj</button>`;
        html += `</div>`;

        const overlay = showModal({
            id: 'user-selection-overlay',
            titleId: 'user-selection-title',
            html: `<div class="modal">${html}</div>`,
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
                untrapFocus(overlay);
                overlay.remove();
                _restoreBodyScroll();
                once(selectedUser);
            });
        });

        overlay.querySelector('#user-select-cancel').addEventListener('click', () => {
            untrapFocus(overlay);
            overlay.remove();
            _restoreBodyScroll();
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
        logger.info('ui', `[SharedUI] Załadowano ${users.length} użytkowników do globalnej mapy.`);
    } catch (e) {
        logger.warn('ui', '[SharedUI] fetchGlobalUsers error:', e);
    }
}

/**
 * In-app confirm dialog — zastępuje natywne confirm().
 * Zwraca Promise<boolean> (true = OK, false = Anuluj).
 * Modal jest tworzony dynamicznie przy pierwszym użyciu.
 *
 * @param {string} message - Treść pytania (obsługuje \n jako nową linię)
 * @param {object} [opts] - Opcje
 * @param {string} [opts.title='Potwierdzenie'] - Tytuł
 * @param {string} [opts.okText='OK'] - Tekst OK
 * @param {string} [opts.cancelText='Anuluj'] - Tekst Anuluj
 * @param {'info'|'warning'|'danger'} [opts.type='info'] - Typ (ikona + kolor)
 * @param {boolean} [opts.allowHtml=false] - Czy zezwolić na HTML w tytule/treści
 * @param {boolean} [opts.hideCancel=false] - Ukryj przycisk Anuluj (tylko OK)
 * @returns {Promise<boolean>}
 */
function appConfirm(message, opts = {}) {
    const {
        title = 'Potwierdzenie',
        okText = 'OK',
        cancelText = 'Anuluj',
        type = 'info',
        hideCancel = false
    } = opts;

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
            info: '<i data-lucide="info" class="icon-32-accent"></i>',
            warning: '<i data-lucide="alert-triangle" class="icon-32-warn"></i>',
            danger: '<i data-lucide="trash-2" class="icon-32-danger"></i>'
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
                    <button class="app-confirm-btn" id="app-confirm-cancel" style="${hideCancel ? 'display:none;' : ''}">${cancelText}</button>
                    <button class="app-confirm-btn" id="app-confirm-ok" style="background:${accent}${hideCancel ? ';flex:1' : ''}">${okText}</button>
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
                untrapFocus(overlay);
                overlay.remove();
                _restoreBodyScroll();
                once(true);
            });
            cancelBtn.addEventListener('click', () => {
                untrapFocus(overlay);
                overlay.remove();
                _restoreBodyScroll();
                once(false);
            });

            overlay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    untrapFocus(overlay);
                    overlay.remove();
                    _restoreBodyScroll();
                    once(true);
                }
            });
        }, 50);
    });
}

/**
 * In-app alert — zastępuje natywny alert().
 * Modal z pojedynczym przyciskiem OK. Zwraca Promise<void>.
 *
 * @param {string} message - Treść komunikatu (obsługuje \n jako nową linię)
 * @param {object} [opts] - Opcje (title, okText, type)
 * @returns {Promise<void>}
 */
// @ts-ignore — duplicate identifier po merge (appAlert już zadeklarowany w innym module legacy)
function appAlert(message, opts = {}) {
    return appConfirm(message, Object.assign({}, opts, { okText: 'OK', hideCancel: true })).then(
        () => {}
    );
}

/**
 * In-app prompt — zastępuje natywny prompt().
 * Modal z polem tekstowym. Zwraca Promise<string|null> (null = Anuluj/Escape).
 *
 * @param {string} message - Treść pytania
 * @param {string} [defaultValue=''] - Wartość początkowa
 * @param {object} [opts] - Opcje
 * @param {string} [opts.title='Wprowadź dane'] - Tytuł
 * @param {string} [opts.okText='OK'] - Tekst OK
 * @param {string} [opts.cancelText='Anuluj'] - Tekst Anuluj
 * @param {'info'|'warning'|'danger'} [opts.type='info'] - Typ (ikona + kolor)
 * @param {string} [opts.inputType='text'] - Typ inputa (np. 'text', 'password', 'number')
 * @returns {Promise<string|null>}
 */
function appPrompt(message, defaultValue = '', opts = {}) {
    const {
        title = 'Wprowadź dane',
        okText = 'OK',
        cancelText = 'Anuluj',
        type = 'info',
        inputType = 'text'
    } = opts;

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
            info: '<i data-lucide="info" class="icon-32-accent"></i>',
            warning: '<i data-lucide="alert-triangle" class="icon-32-warn"></i>',
            danger: '<i data-lucide="trash-2" class="icon-32-danger"></i>'
        };
        const accentMap = {
            info: 'var(--accent)',
            warning: 'var(--warn)',
            danger: 'var(--danger)'
        };
        const accent = accentMap[type] || accentMap.info;

        const safeTitle = _escapeHtml(title);
        const safeMsg = _escapeHtml(message).replace(/\n/g, '<br>');
        const safeDefault = _escapeHtml(defaultValue);
        const inputName = `app-prompt-${Math.random().toString(36).slice(2, 9)}`;

        const html = `
            <div class="app-confirm-modal">
                <div class="app-confirm-icon">${iconMap[type] || iconMap.info}</div>
                <div class="app-confirm-title">${safeTitle}</div>
                <div class="app-confirm-message">${safeMsg}</div>
                <input id="${inputName}" class="app-prompt-input" type="${_escapeHtml(inputType)}" value="${safeDefault}" autocomplete="off" />
                <div class="app-confirm-actions">
                    <button class="app-confirm-btn" id="app-prompt-cancel">${cancelText}</button>
                    <button class="app-confirm-btn" id="app-prompt-ok" style="background:${accent}">${okText}</button>
                </div>
            </div>`;

        const overlay = showModal({
            id: 'app-prompt-overlay',
            html: html,
            onClose: () => once(null)
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            setTimeout(() => window.lucide.createIcons({ root: overlay }), 10);
        }

        setTimeout(() => {
            const input = /** @type {HTMLInputElement|null} */ (document.getElementById(inputName));
            const okBtn = document.getElementById('app-prompt-ok');
            const cancelBtn = document.getElementById('app-prompt-cancel');
            if (!input || !okBtn || !cancelBtn) return;

            input.focus();
            const len = input.value.length;
            if (input.setSelectionRange) input.setSelectionRange(len, len);

            const submit = () => {
                untrapFocus(overlay);
                overlay.remove();
                _restoreBodyScroll();
                once(input.value);
            };

            okBtn.addEventListener('click', submit);
            cancelBtn.addEventListener('click', () => {
                untrapFocus(overlay);
                overlay.remove();
                _restoreBodyScroll();
                once(null);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') submit();
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
            background:var(--slate-950);
            border:1px solid var(--accent-border-dim);
            border-radius: var(--radius-md);
            width:100%; max-width:800px;
            padding:1.5rem 3rem;
            box-shadow:0 25px 50px -12px rgba(var(--black-rgb), 0.5), 0 0 40px rgba(var(--accent-rgb), 0.1);
            text-align:center;
            animation:appConfirmIn 0.2s ease-out;
        }
        @keyframes appConfirmIn {
            from { opacity:0; transform:scale(0.95) translateY(10px); }
            to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .app-confirm-icon { font-size: var(--fs-7xl); margin-bottom:0.6rem; }
        .app-confirm-title {
            font-size: var(--fs-2xl); font-weight: var(--fw-bold); color:var(--white);
            margin-bottom:0.6rem;
        }
        .app-confirm-message {
            font-size: var(--fs-lg); color:var(--text-secondary);
            margin-bottom:1.5rem; line-height:1.55;
        }
        .app-confirm-actions {
            display:flex; gap:0.75rem; justify-content:center;
        }
        .app-confirm-btn {
            flex:1; padding:0.6rem 1rem; border-radius: var(--radius-sm);
            font:var(--fw-semibold) var(--fs-lg) 'Inter',sans-serif;
            cursor:pointer; transition:all 0.15s; border:none;
        }
        .app-confirm-btn:focus { outline:2px solid var(--accent-hover); outline-offset:2px; }
        #app-confirm-ok { background:var(--accent); color:var(--white); }
        #app-confirm-ok:hover { filter:brightness(1.15); transform:translateY(-1px); }
        #app-confirm-cancel {
            background:var(--slate-800); color:var(--text-secondary);
            border:1px solid rgba(var(--white-rgb), 0.1);
        }
        #app-confirm-cancel:hover { color:var(--white); background:var(--slate-700); }
        .app-prompt-input {
            width:100%; padding:0.6rem 0.8rem; margin-bottom:1.25rem;
            border-radius: var(--radius-sm); border:1px solid rgba(var(--white-rgb), 0.15);
            background:var(--slate-900); color:var(--white);
            font:var(--fw-medium) var(--fs-xl) 'Inter',sans-serif; text-align:center;
            box-sizing:border-box; outline:none;
        }
        .app-prompt-input:focus { border-color:var(--accent); box-shadow:0 0 0 2px rgba(var(--accent-rgb), 0.25); }
    `;
    document.head.appendChild(style);
}

function _escapeHtml(str) {
    return escapeHtml(str);
}

window.appConfirm = appConfirm;
window.appAlert = appAlert;
window.appPrompt = appPrompt;

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
    el.style.cssText =
        'display:inline-flex; align-items:center; gap:0.35rem; font-size: var(--fs-sm); font-weight: var(--fw-semibold); color:var(--text-secondary); margin-left:0.6rem; opacity:0; transition:opacity 0.2s;';
    parent.appendChild(el);

    let savedTimer = null;

    function render(state, text, color) {
        el.style.opacity = '1';
        el.style.color = color;
        const icon =
            state === 'saving'
                ? '<i data-lucide="loader" style="width:14px;height:14px;animation:saveSpin 0.8s linear infinite"></i>'
                : state === 'saved'
                  ? '<i data-lucide="check" class="icon-14"></i>'
                  : state === 'error'
                    ? '<i data-lucide="alert-circle" class="icon-14"></i>'
                    : '<i data-lucide="circle" class="icon-14"></i>';
        el.innerHTML = `${icon}<span>${escapeHtml(text)}</span>`;
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

/**
 * Auto-zaznaczenie zawartości pola number po wejściu w nie (focus).
 * Pozwala od razu wpisać nową wartość bez ręcznego kasowania poprzedniej.
 * Delegacja na document obejmuje także pola generowane dynamicznie.
 */
document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'number') return;
    if (target.disabled || target.readOnly) return;
    target.select();
});

/* ===== Ochrona przed utratą danych — beforeunload/pagehide (Z-30) ===== */
// @ts-ignore — legacy global, duplikat w innym skrypcie
let _bypassBeforeUnload = false;
// @ts-ignore — legacy global, duplikat w innym skrypcie
let _confirmLock = false;
// @ts-ignore
window._bypassBeforeUnload = false;
try {
    // @ts-ignore — legacy global defineProperty
    Object.defineProperty(window, '_bypassBeforeUnload', {
        get() {
            return _bypassBeforeUnload;
        },
        set(v) {
            _bypassBeforeUnload = !!v;
        },
        configurable: true
    });
} catch {}
function _isWizardDirty() {
    try {
        if (typeof _excelDirty !== 'undefined' && _excelDirty) return true;
        if (typeof window._excelDirty !== 'undefined' && window._excelDirty) return true;
        if (typeof window._wizardDirty !== 'undefined' && window._wizardDirty) return true;
        const spaIframes = document.querySelectorAll('iframe.spa-module-iframe');
        for (const iframe of spaIframes) {
            try {
                const w = /** @type {HTMLIFrameElement} */ (iframe).contentWindow;
                if (!w) continue;
                if (w._excelDirty) return true;
                if (w.window && w.window._excelDirty) return true;
                if (w._wizardDirty) return true;
                if (w.window && w.window._wizardDirty) return true;
                if (typeof w._isWizardDirty === 'function' && w._isWizardDirty !== _isWizardDirty) {
                    if (w._isWizardDirty()) return true;
                }
            } catch {}
        }
    } catch {}
    return false;
}
window._isWizardDirty = _isWizardDirty;
// @ts-ignore — legacy global, duplikat
window._confirmLock = false;
try {
    // @ts-ignore — legacy global defineProperty
    Object.defineProperty(window, '_confirmLock', {
        get() {
            return _confirmLock;
        },
        set(v) {
            _confirmLock = !!v;
        },
        configurable: true
    });
} catch {}
window.addEventListener('beforeunload', (e) => {
    if (_bypassBeforeUnload) return;
    if (_isWizardDirty()) {
        e.preventDefault();
        e.returnValue = '';
    }
});
window.addEventListener('pagehide', () => {
    if (_isWizardDirty()) {
        // Mobile Safari: pagehide zamiast beforeunload — log dla audytu
        try {
            if (window.logger && typeof window.logger.warn === 'function')
                window.logger.warn('ui', 'pagehide z niezapisanymi zmianami');
        } catch {}
    }
});

/* ===== Custom popup przy opuszczeniu strony — styl projektu (modalCore) =====
   Custom appConfirm dla linków i reload; native beforeunload zostaje safety-net
   dla X / Reload z UI przeglądarki. Jedno źródło _isWizardDirty(), jeden lock. */
// @ts-ignore — e typed as any in legacy JS
document.addEventListener('click', async (e) => {
    const _t = /** @type {any} */ (e).target;
    const anchor = /** @type {HTMLAnchorElement|null} */ (
        _t instanceof Element ? _t.closest('a[href]') : null
    );
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (/^(tel:|mailto:|#)/.test(href)) return;
    if (anchor.hasAttribute('download')) return;
    if (anchor.target === '_blank') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
    if (!_isWizardDirty()) return;
    if (href.startsWith('#/')) return;
    if (_confirmLock) return;
    e.preventDefault();
    _confirmLock = true;
    window._confirmLock = true;
    try {
        const ok = await window.appConfirm('Wprowadzone zmiany mogą nie zostać zapisane.', {
            title: 'Niezapisane zmiany',
            type: 'warning',
            okText: 'Opuść bez zapisu',
            cancelText: 'Zostań'
        });
        if (!ok) return;
        _bypassBeforeUnload = true;
        window._bypassBeforeUnload = true;
        window.location.href = /** @type {HTMLAnchorElement} */ (anchor).href;
    } finally {
        _confirmLock = false;
        window._confirmLock = false;
    }
});

// F5 / Ctrl+R / Cmd+R — przechwyć odświeżenie i pokaż custom popup
document.addEventListener('keydown', async (e) => {
    const key = e.key || '';
    const code = e.code || '';
    const keyCode = e.keyCode || e.which || 0;
    const isF5 = key === 'F5' || code === 'F5' || keyCode === 116;
    const isR = key.toLowerCase() === 'r' || code.toLowerCase() === 'keyr';
    const isCtrlR = (e.ctrlKey || e.metaKey) && isR;
    if (!isF5 && !isCtrlR) return;
    if (!_isWizardDirty()) return;
    if (_confirmLock) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    _confirmLock = true;
    window._confirmLock = true;
    try {
        const ok = await window.appConfirm(
            'Wprowadzone zmiany mogą nie zostać zapisane. Czy chcesz odświeżyć stronę?',
            {
                title: 'Niezapisane zmiany',
                type: 'warning',
                okText: 'Odśwież',
                cancelText: 'Anuluj'
            }
        );
        if (!ok) return;
        _bypassBeforeUnload = true;
        window._bypassBeforeUnload = true;
        window.location.reload();
    } finally {
        _confirmLock = false;
        window._confirmLock = false;
    }
});

/* ===== Rejestracja globali ===== */
window.getUserDisplayName = getUserDisplayName;
window.toggleCard = toggleCard;
window.showSection = showSection;
window.showUserSelectionPopup = showUserSelectionPopup;

/* ===== Rejestracja globali ===== */
window.fetchGlobalUsers = fetchGlobalUsers;
