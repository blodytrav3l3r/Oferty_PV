// @ts-check
// Zależności (ładowane przed tym skryptem): shared/auth.js, shared/ui.js

let adminUsers = [];
let editingUserId = null;
let selectedSubUsers = [];
// Sesje: mapa userId -> {sessionCount, lastActivityAt}, źródło kafli i badge'y.
let sessionByUser = {};
// false = odczyt sesji się nie udał; kafel nie może wtedy kłamać „brak sesji".
let sessionsKnown = false;
let adminRefreshSeq = 0;
const revokingUsers = new Set();

function toggleSubUsersList() {
    // Modal może być zamknięty — wtedy pól nie ma w DOM.
    const roleEl = document.getElementById('new-user-role');
    const container = document.getElementById('sub-users-container');
    const listObj = document.getElementById('sub-users-list');
    if (!roleEl || !container || !listObj) return;
    const role = roleEl.value;
    if (role === 'pro') {
        container.classList.remove('hidden');
        const regularUsers = adminUsers.filter((u) => u.role !== 'admin' && u.id !== editingUserId);
        if (regularUsers.length === 0) {
            listObj.innerHTML =
                '<span class="text-muted">Brak innych użytkowników do przypisania</span>';
        } else {
            listObj.innerHTML = regularUsers
                .map(
                    (u) => `
                        <label class="sub-user-checkbox">
                            <input type="checkbox" value="${escapeHtmlAttr(u.id)}" ${selectedSubUsers.includes(u.id) ? 'checked' : ''} data-csp="updateSubUsers" data-csp-args="[&quot;$el&quot;]" data-csp-on="change">
                            ${u.firstName && u.lastName ? escapeHtml(u.firstName + ' ' + u.lastName) : escapeHtml(u.username)}
                        </label>
                    `
                )
                .join('');
        }
    } else {
        container.classList.add('hidden');
        selectedSubUsers = [];
    }
}

function updateSubUsers(checkbox) {
    if (checkbox.checked) {
        if (!selectedSubUsers.includes(checkbox.value)) selectedSubUsers.push(checkbox.value);
    } else {
        selectedSubUsers = selectedSubUsers.filter((id) => id !== checkbox.value);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const html = document.documentElement;
    let authResolved = false;
    const finish = (fn, user) => {
        if (authResolved) return;
        authResolved = true;
        clearTimeout(authTimer);
        html.classList.remove('auth-pending');
        if (user !== undefined) fn(user);
        else fn();
    };
    const authTimer = setTimeout(() => {
        if (authResolved) return;
        // Nie zamykaj sprawy: spozniony (ale wazny) wynik /me ma jeszcze
        // podmienic formularz na panel zamiast zostawiac usera na loginie.
        html.classList.remove('auth-pending');
        showLogin();
    }, 1500);
    // Wariant A: jedyny test sesji to GET /api/auth/me na cookie httpOnly.
    // Brak pre-checku localStorage — cookie jest niewidoczne dla JS.
    // authReady() (shared/auth.js) cache'uje wynik dla modułów startowych,
    // więc carePanel/versionDisplay nie strzelają 401 przed logowaniem.
    try {
        let user = null;
        if (typeof window.authReady === 'function') {
            user = await window.authReady();
        } else {
            const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
            const data = await res.json();
            user = data.user;
        }
        if (user) finish(showLoggedIn, user);
        else finish(showLogin);
    } catch (_e) {
        finish(showLogin);
    }
});

async function loadRecycledNumbers(user) {
    const u = user || currentUser;
    if (!u) return;
    try {
        const res = await fetch('/api/orders-studnie/recycled', {
            credentials: 'same-origin'
        });
        const data = await res.json();
        const container = document.getElementById('recycled-numbers-list');

        if (data.recycled && data.recycled.length > 0) {
            const yearShort = data.yearShort || String(new Date().getFullYear()).slice(-2);
            const yearLetter = data.yearLetter || '?';
            const symbol = data.symbol || u.symbol || '?';
            container.innerHTML = data.recycled
                .map(
                    (num) =>
                        `<span class="recycled-badge">${escapeHtml(symbol)}/${escapeHtml(yearLetter)}/${String(num).padStart(5, '0')}/${escapeHtml(yearShort)}</span>`
                )
                .join('');
        } else {
            container.innerHTML = '<span class="recycled-empty">Brak odzyskanych numerów.</span>';
        }
    } catch (e) {
        logger.error('dashboard', 'Failed to load recycled numbers', e);
    }
}

/**
 * Opieka nad ofertami: TYLKO KPI z analityki. Liczniki fu-stat-* pisze
 * wyłącznie carePanel.js (jeden pisarz — SSoT /api/care/summary).
 */
/* Zakres KPI z presetu opieki (sok-care-range pisze carePanel.js). */
function followUpRangeQuery() {
    try {
        const raw =
            typeof localStorage !== 'undefined' ? localStorage.getItem('sok-care-range') : null;
        const days = raw === '7d' ? 7 : raw === '30d' ? 30 : raw === '90d' ? 90 : 0;
        if (!days) return '';
        const nowMin = Math.floor(Date.now() / 60000) * 60000;
        const to = new Date(nowMin).toISOString();
        const from = new Date(nowMin - days * 86400000).toISOString();
        return '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
    } catch {
        return '';
    }
}

const moneyPln = (v) => (typeof v === 'number' ? v.toFixed(2) + ' PLN' : '–');

/* KPI idą za zakresem panelu opieki (sok-care-* pisze carePanel.js).
 * Bez tego pro/admin widziałby inne liczby niż panel (mine vs team/all). */
function followUpScopeQuery() {
    try {
        const s =
            typeof localStorage !== 'undefined' ? localStorage.getItem('sok-care-scope') : null;
        if (s === 'team' || s === 'all') return '&scope=' + s;
    } catch {
        /* ignore */
    }
    return '&scope=mine';
}

function followUpRepQuery() {
    try {
        const r = typeof localStorage !== 'undefined' ? localStorage.getItem('sok-care-rep') : null;
        if (r) return '&repId=' + encodeURIComponent(r);
    } catch {
        /* ignore */
    }
    return '';
}

async function loadFollowUpWidget() {
    const panel = document.getElementById('followup-panel');
    if (!panel) return;
    const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v);
    };
    try {
        // P3: KPI z endpointu analityki (jeden request, scope roli po stronie BE).
        try {
            const statsRes = await fetch(
                '/api/offers-rury/followups/stats?t=' +
                    Date.now() +
                    followUpRangeQuery() +
                    followUpScopeQuery() +
                    followUpRepQuery(),
                {
                    credentials: 'same-origin'
                }
            );
            if (statsRes.ok) {
                const s = (await statsRes.json()).stats || {};
                const conv =
                    typeof s.conversion === 'number' ? (s.conversion * 100).toFixed(1) + ' %' : '–';
                set('fu-kpi-conversion', conv);
                set(
                    'fu-kpi-lost',
                    typeof s.lostValue === 'number' ? s.lostValue.toFixed(2) + ' PLN' : '–'
                );
                set(
                    'fu-kpi-first',
                    typeof s.avgFirstContactH === 'number'
                        ? s.avgFirstContactH.toFixed(1) + ' h'
                        : '–'
                );
                set('fu-kpi-won-value', moneyPln(s.wonValue));
                set('fu-kpi-open-value', moneyPln(s.openValue));
                set('fu-kpi-total-value', moneyPln(s.totalValue));
                set('fu-kpi-orders-value', moneyPln(s.ordersValue));
            } else {
                // 403 (np. zakres spoza roli) nie może zostawić starych liczb
                // jako świeżych — czyść jawnie.
                set('fu-kpi-conversion', '–');
                set('fu-kpi-lost', '–');
                set('fu-kpi-first', '–');
                set('fu-kpi-won-value', '–');
                set('fu-kpi-open-value', '–');
                set('fu-kpi-total-value', '–');
                set('fu-kpi-orders-value', '–');
            }
        } catch (e) {
            logger.warn('dashboard', 'Failed to load followup KPI', e);
        }

        // Top-5 przeniesione do kolejki opieki (carePanel.js) — brak dublowania.
    } catch (e) {
        logger.error('dashboard', 'Failed to load followup widget', e);
    }
}

/* Preset zakresu w carePanel.js przeładowuje KPI (ten sam zakres, 1 event). */
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('care-range-change', () => {
        loadFollowUpWidget();
    });
}

// Obsluga klawiszy
document.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S: zapisz bieżącą ofertę (rury lub studnie)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        const active = document.activeElement;
        const inForm = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
        if (inForm) {
            return;
        }
        e.preventDefault();
        if (typeof window.saveOfferOrOrder === 'function') {
            window.saveOfferOrOrder();
        } else if (typeof window.saveOfferStudnie === 'function') {
            window.saveOfferStudnie();
        } else if (typeof window.saveCurrentOrder === 'function') {
            window.saveCurrentOrder();
        }
        return;
    }

    // Esc: zamknij górny modal
    if (e.key === 'Escape') {
        const visibleModal = document.querySelector('.modal.show, .modal:not(.hidden)');
        if (visibleModal) {
            const closeBtn = visibleModal.querySelector(
                '[data-bs-dismiss="modal"], .modal-close, .btn-close'
            );
            if (closeBtn) closeBtn.click();
            else visibleModal.classList.add('hidden');
        }
    }
});

function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('user-section').classList.add('hidden');
    document.getElementById('dash-header').classList.remove('visible');
    document.querySelector('.container').classList.remove('logged-in');
}

function showLoggedIn(user) {
    currentUser = user;
    sessionStorage.setItem('user', JSON.stringify(user));
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('user-section').classList.remove('hidden');
    document.querySelector('.container').classList.add('logged-in');
    document.getElementById('user-display-name').textContent =
        user.firstName && user.lastName ? user.firstName + ' ' + user.lastName : user.username;
    document.getElementById('user-avatar-initial').textContent = user.username
        .charAt(0)
        .toUpperCase();
    const roleEl = document.getElementById('user-display-role');
    roleEl.textContent = user.role.toUpperCase();

    // Pokaz naglowek nawigacji pulpitu (jedno źródło prawdy: headerUser.js)
    document.getElementById('dash-header').classList.add('visible');
    if (window.headerUser) {
        window.headerUser.render(user);
    }

    // L1: lokalne drafty do wznowienia (pusta lista = sekcja ukryta).
    if (window.resumeDrafts && typeof window.resumeDrafts.render === 'function') {
        try {
            window.resumeDrafts.render(user);
        } catch (_e) {}
    }

    if (user.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
        refreshAdminSessions();
        loadYearLetter();
        loadMagazynCodes();
        initAiMlToggle();
        if (typeof window.mlHealthRender === 'function') {
            setTimeout(function () {
                window.mlHealthRender('ml-health-container');
            }, 50);
        }
        if (typeof window.aiDashboardRender === 'function') {
            setTimeout(function () {
                window.aiDashboardRender('ai-dashboard-container');
            }, 150);
        }
        // Kafelki cenników: jedno GET /summary, fail-soft (bez toastu).
        (async function loadPricelistTiles() {
            try {
                const res = await fetch('/api/pricelist-versions/summary', {
                    credentials: 'same-origin'
                });
                if (!res.ok) return;
                const data = await res.json();
                const types = data.types || {};
                const setText = (id, text) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = text;
                };
                const fmtDate = (iso) => {
                    const d = new Date(iso);
                    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pl-PL');
                };
                ['rury', 'studnie', 'preco'].forEach((type) => {
                    const entry = types[type] || {};
                    const active = entry.active;
                    const next = entry.nextScheduled;
                    setText(
                        'pv-tile-' + type + '-version',
                        active && active.version ? active.version : '—'
                    );
                    setText(
                        'pv-tile-' + type + '-date',
                        active && active.effectiveFrom
                            ? 'od ' + fmtDate(active.effectiveFrom)
                            : 'brak aktywnej'
                    );
                    setText(
                        'pv-tile-' + type + '-next',
                        next && next.version
                            ? 'Do wdrożenia: ' +
                                  next.version +
                                  (next.effectiveFrom ? ' · ' + fmtDate(next.effectiveFrom) : '')
                            : 'Brak do wdrożenia'
                    );
                });
            } catch (_e) {
                /* fail-soft: kafelki zostają z placeholderem */
            }
        })();
    } else {
        document.getElementById('admin-panel').classList.add('hidden');
    }

    loadRecycledNumbers(user);
    loadFollowUpWidget();
    // Powiadom widgety zależne od roli (np. Operacje): ich init na
    // DOMContentLoaded wyprzedza async GET /api/auth/me, więc synchroniczny
    // odczyt window.currentUser dawał fałszywe "wymaga roli admin".
    try {
        document.dispatchEvent(
            new CustomEvent('sok:user-ready', { detail: { role: user.role, id: user.id } })
        );
    } catch (_e) {}
}

// Podwójny klik „Zaloguj się" tworzył dwie sesje (stara zostawała osierocona
// i liczyła się w panelu admina) — jeden login naraz.
let isLoggingIn = false;

async function doLogin(event) {
    if (event) {
        event.preventDefault();
    }
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!username || !password) {
        errorEl.textContent = 'Podaj login i hasło';
        return;
    }
    if (isLoggingIn) return;
    isLoggingIn = true;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            errorEl.textContent = data.error || 'Błąd logowania';
            return;
        }
        // Wariant A: tokenu NIE zapisujemy (sesja w cookie httpOnly stawianym
        // przez serwer). Odpowiedź może jeszcze zawierać data.token (shim
        // wsteczny backendu) — celowo ignorowane.
        sessionStorage.setItem('user', JSON.stringify(data.user));
        // Cache authReady z fazy "niezalogowany" musi zniknąć, inaczej
        // carePanel/versionDisplay czekają na reload.
        if (typeof window.authReady === 'function') await window.authReady(true);
        showLoggedIn(data.user);
    } catch (_e) {
        errorEl.textContent = 'Błąd połączenia z serwerem';
    } finally {
        isLoggingIn = false;
    }
}

async function doLogout() {
    // Cienki wrapper nad jednym logoutem (appLogout z shared/auth.js) —
    // sesję i cookie czyści serwer. Pola czyszczone PRZED delegacją, bo
    // appLogout kończy nawigacją do index.html.
    try {
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
    } catch {}
    if (typeof window.appLogout === 'function') {
        await window.appLogout();
        return;
    }
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_e) {}
    try {
        localStorage.removeItem('authToken');
    } catch {}
    showLogin();
}

function pluralSessions(n) {
    const abs = Math.abs(Number(n)) % 100;
    const last = abs % 10;
    if (abs === 1) return 'sesja';
    if (last >= 2 && last <= 4 && (abs < 12 || abs > 14)) return 'sesje';
    return 'sesji';
}

function formatRelativeTime(ms) {
    const value = Number(ms);
    const diff = Date.now() - value;
    if (!Number.isFinite(diff) || diff < 60 * 1000) return 'teraz';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' min temu';
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' godz. temu';
    return new Date(value).toLocaleDateString('pl-PL');
}

function showToastSafe(message, type) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function')
        window.showToast(message, type);
}

/** Kafle sesji. `summary === null` = błąd odczytu (placeholdery, bez kłamstwa). */
function renderSessionTiles(summary) {
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    const totalAccounts = adminUsers.length;
    if (!summary) {
        setText('session-tile-users', '—');
        setText('session-tile-users-meta', 'brak danych o sesjach');
        setText('session-tile-count', '—');
        setText('session-tile-last', '—');
        setText('session-tile-last-meta', 'w systemie');
        return;
    }
    setText('session-tile-users', (summary.activeUsers || 0) + ' / ' + totalAccounts);
    setText('session-tile-users-meta', totalAccounts === 1 ? 'konto' : 'kont');
    setText('session-tile-count', String(summary.activeSessions || 0));
    const last = Number(summary.lastActivityAt || 0);
    if (last > 0) {
        setText('session-tile-last', formatRelativeTime(last));
        setText('session-tile-last-meta', new Date(last).toLocaleString('pl-PL'));
    } else {
        setText('session-tile-last', '—');
        setText('session-tile-last-meta', 'brak aktywnych sesji');
    }
}

/**
 * Odświeża sesje i tabelę. Kolejność: sesje → users (badge w wierszach) → kafle
 * (mianownik = liczba kont). Seq-guard: spóźniona odpowiedź nie nadpisze nowszej.
 */
async function refreshAdminSessions() {
    const mySeq = ++adminRefreshSeq;
    let summary = null;
    try {
        const res = await fetch('/api/admin/sessions', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (mySeq !== adminRefreshSeq) return;
        const map = {};
        (json.data || []).forEach((row) => {
            if (row && row.userId) map[row.userId] = row;
        });
        sessionByUser = map;
        sessionsKnown = true;
        summary = json.summary || {};
    } catch (e) {
        if (mySeq !== adminRefreshSeq) return;
        sessionByUser = {};
        sessionsKnown = false;
        if (typeof logger !== 'undefined')
            logger.warn('dashboard', 'sesje: ' + ((e && e.message) || 'błąd'));
    }
    await loadUsers();
    if (mySeq !== adminRefreshSeq) return;
    renderSessionTiles(summary);
}

/** Wymuszone wylogowanie użytkownika. Guard: jedno żądanie na usera. */
async function revokeUserSessions(userId) {
    if (!userId || revokingUsers.has(userId)) return;
    // Destrukcyjna akcja: bez modala potwierdzenia nie działamy (fail-closed).
    if (typeof window.appConfirm !== 'function') {
        if (typeof logger !== 'undefined')
            logger.error('dashboard', 'appConfirm niedostępny — revoke przerwany');
        return;
    }
    // Guard PRZED modalem: drugi klik nie otwiera drugiego modala ani requestu.
    revokingUsers.add(userId);
    try {
        const target = adminUsers.find((u) => u.id === userId);
        const info = sessionByUser[userId];
        const name = target
            ? ((target.firstName || '') + ' ' + (target.lastName || '')).trim() || target.username
            : 'tego użytkownika';
        const countText = info
            ? ' (' + info.sessionCount + ' ' + pluralSessions(info.sessionCount) + ')'
            : '';
        const confirmed = await window.appConfirm(
            'Wylogować wszystkie sesje: ' + name + countText + '?',
            { type: 'danger' }
        );
        if (!confirmed) return;
        const res = await fetch('/api/admin/sessions/' + encodeURIComponent(userId), {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToastSafe(data.error || 'Nie udało się wylogować użytkownika', 'error');
            return;
        }
        showToastSafe(
            data.revoked > 0
                ? 'Wylogowano: ' + data.revoked + ' ' + pluralSessions(data.revoked)
                : 'Brak aktywnych sesji',
            'info'
        );
        await refreshAdminSessions();
    } catch (e) {
        if (typeof logger !== 'undefined') logger.error('dashboard', 'revokeUserSessions:', e);
        showToastSafe('Błąd połączenia z serwerem', 'error');
    } finally {
        revokingUsers.delete(userId);
    }
}

function initialsOf(user) {
    const first = String(user.firstName || '').trim();
    const last = String(user.lastName || '').trim();
    if (first || last) return ((first.charAt(0) || '') + (last.charAt(0) || '')).toUpperCase();
    return String(user.username || '?')
        .charAt(0)
        .toUpperCase();
}

async function loadUsers() {
    try {
        const res = await fetch('/api/users', { credentials: 'same-origin' });
        const data = await res.json();
        adminUsers = data.data || [];

        updateStatsBar();

        const grid = document.getElementById('users-tiles');
        if (!grid) return;

        // Kafel „Nowy użytkownik" jest jedynym CTA — widoczny także przy 0 kont.
        const newUserTile = `
      <article class="admin-user-tile admin-user-tile--new" role="listitem">
        <button type="button" class="admin-new-user-btn" aria-label="Nowy użytkownik — dodaj konto" data-csp="openUserModal">
            <span class="admin-user-avatar admin-user-avatar--new" aria-hidden="true"><i data-lucide="user-plus"></i></span>
            <span class="admin-user-id">
                <span class="user-name">Nowy użytkownik</span>
                <span class="admin-user-login">Dodaj konto</span>
            </span>
        </button>
      </article>`;

        grid.innerHTML =
            newUserTile +
            adminUsers
                .map((u) => {
                    const fullName = ((u.firstName || '') + ' ' + (u.lastName || '')).trim();
                    const label = fullName || u.username;
                    const role = String(u.role || 'user').toLowerCase();
                    const session = sessionByUser[u.id];
                    const isSelf =
                        typeof currentUser !== 'undefined' &&
                        currentUser &&
                        currentUser.id === u.id;
                    const sessionText = !sessionsKnown
                        ? 'Sesje: brak danych'
                        : session
                          ? session.sessionCount +
                            ' ' +
                            pluralSessions(session.sessionCount) +
                            ' · ' +
                            formatRelativeTime(session.lastActivityAt)
                          : 'Brak aktywnej sesji';
                    const sessionCls = !sessionsKnown
                        ? 'is-unknown'
                        : session
                          ? 'is-online'
                          : 'is-offline';
                    const revokeTitle =
                        'Wyloguj wszystkie sesje' +
                        (session ? ' (' + session.sessionCount + ')' : '');
                    // Akcje niedozwolone zostają widoczne (wyblakłe), ale bez data-csp — nie da się ich odpalić.
                    const deleteAttrs =
                        u.username !== 'admin'
                            ? ` data-csp="deleteUser" data-csp-args="${escapeHtmlAttr(JSON.stringify([u.id]))}"`
                            : ' disabled aria-disabled="true" title="Konto systemowe — nie można usunąć"';
                    const revokeAttrs = isSelf
                        ? ' disabled aria-disabled="true" title="Własne konto — użyj Wyloguj w nagłówku"'
                        : ` title="${escapeHtmlAttr(revokeTitle)}" data-csp="revokeUserSessions" data-csp-args="${escapeHtmlAttr(JSON.stringify([u.id]))}"`;
                    let subUsersHtml = '';
                    if (u.role === 'pro' && u.subUsers && u.subUsers.length > 0) {
                        const names = u.subUsers.map((subId) => {
                            const subU = adminUsers.find((x) => x.id === subId);
                            return subU
                                ? subU.firstName && subU.lastName
                                    ? subU.firstName + ' ' + subU.lastName
                                    : subU.username
                                : 'Nieznany';
                        });
                        subUsersHtml = `
        <div class="admin-user-subs">
            <span class="subordinate-label"><i data-lucide="users"></i> Powiązani handlowcy</span>
            <div class="subordinate-badges">
                ${names.map((name) => `<span class="token-badge sub-token">${escapeHtml(name)}</span>`).join('')}
            </div>
        </div>`;
                    }
                    return `
      <article class="admin-user-tile" role="listitem" aria-label="${escapeHtmlAttr(label)}">
        <div class="admin-user-head">
            <div class="admin-user-avatar" aria-hidden="true">${escapeHtml(initialsOf(u))}</div>
            <div class="admin-user-id">
                <div class="user-name">${escapeHtml(label)}</div>
                <div class="admin-user-login">@${escapeHtml(u.username)}</div>
            </div>
            <div class="admin-user-badges">
                <span class="token-badge text-warn">${escapeHtml(u.symbol || '??')}</span>
                <span class="badge-role role-${escapeHtml(role)}">${escapeHtml(role.toUpperCase())}</span>
            </div>
        </div>
        <div class="admin-user-facts">
            <div class="admin-user-fact"><span class="fact-label">Telefon</span><span class="fact-value">${escapeHtml(u.phone || '—')}</span></div>
            <div class="admin-user-fact"><span class="fact-label">E-mail</span><span class="fact-value" title="${escapeHtmlAttr(u.email || '')}">${escapeHtml(u.email || 'brak email')}</span></div>
            <div class="admin-user-fact"><span class="fact-label">Nr zam.</span><span class="fact-value cell-num">${escapeHtml(String(u.orderStartNumber || 1))}</span></div>
            <div class="admin-user-fact"><span class="fact-label">Nr zlec.</span><span class="fact-value cell-num">${escapeHtml(String(u.productionOrderStartNumber || 1))}</span></div>
        </div>
        <div class="admin-user-controls">
            <button class="admin-action-btn edit-btn" aria-label="Edytuj: ${escapeHtmlAttr(label)}" data-csp="startEditUser" data-csp-args="${escapeHtmlAttr(JSON.stringify([u.id]))}"><i data-lucide="pencil"></i></button>
            <button class="admin-action-btn delete-btn" aria-label="Usuń: ${escapeHtmlAttr(label)}"${deleteAttrs}><i data-lucide="trash-2"></i></button>
            <div class="admin-user-session ${sessionCls}">
                <i data-lucide="activity" aria-hidden="true"></i>
                <span>${escapeHtml(sessionText)}</span>
            </div>
            <button class="admin-action-btn revoke-btn" aria-label="Wyloguj: ${escapeHtmlAttr(label)}"${revokeAttrs}><i data-lucide="power"></i></button>
        </div>
        ${subUsersHtml}
      </article>`;
                })
                .join('');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: grid });
        }
    } catch (e) {
        logger.error('dashboard', 'loadUsers error:', e);
    }
}

function updateStatsBar() {
    const counts = { admin: 0, pro: 0, user: 0 };
    adminUsers.forEach((u) => {
        if (Object.prototype.hasOwnProperty.call(counts, u.role)) counts[u.role]++;
    });
    const adminEl = document.getElementById('stat-admin-count');
    const proEl = document.getElementById('stat-pro-count');
    const userEl = document.getElementById('stat-user-count');
    if (adminEl) adminEl.textContent = String(counts.admin);
    if (proEl) proEl.textContent = String(counts.pro);
    if (userEl) userEl.textContent = String(counts.user);
}

/* ── Modal użytkownika: jeden formularz dla dodawania i edycji ───────── */

/** Czyści stan formularza po zamknięciu modala (DOM modala już nie istnieje). */
function resetUserFormState() {
    editingUserId = null;
    selectedSubUsers = [];
}

/**
 * Buduje HTML modala użytkownika. Czysty string → testowalny bez DOM.
 * Każda wartość z API przechodzi przez escapeHtml/escapeHtmlAttr.
 */
function buildUserModalHtml(user) {
    const u = user || {};
    const isEdit = !!user;
    const val = (value, fallback) => {
        const raw = value === undefined || value === null || value === '' ? fallback : value;
        return escapeHtmlAttr(String(raw === undefined || raw === null ? '' : raw));
    };
    const role = String(u.role || 'user').toLowerCase();
    const fullName = ((u.firstName || '') + ' ' + (u.lastName || '')).trim();
    const title = isEdit ? 'Edycja: ' + (fullName || u.username || '') : 'Nowy użytkownik';
    const roleOption = (value, label) =>
        `<option value="${value}"${role === value ? ' selected' : ''}>${label}</option>`;

    return `
<div class="modal modal--lg user-modal">
    <div class="modal-header user-modal-header">
        <h3 id="user-modal-title">
            <i data-lucide="${isEdit ? 'pencil' : 'user-plus'}"></i>
            <span>${escapeHtml(title)}</span>
        </h3>
        <span id="form-mode-label" class="admin-edit-badge${isEdit ? '' : ' hidden'}">
            <i data-lucide="pencil"></i> TRYB EDYCJI
        </span>
        <button type="button" class="admin-action-btn user-modal-close" aria-label="Zamknij okno" data-csp="closeUserModal">
            <i data-lucide="x"></i>
        </button>
    </div>
    <form id="user-form" class="user-modal-form" novalidate>
        <div class="uf-form user-modal-body">
            <div class="uf-section">
                <div class="uf-section-title"><i data-lucide="contact"></i> Dane osobowe</div>
                <div class="uf-grid">
                    <div class="uf-field">
                        <label for="new-user-firstname">Imię</label>
                        <input type="text" id="new-user-firstname" class="form-input" placeholder="Imię" autocomplete="given-name" value="${val(u.firstName)}" />
                    </div>
                    <div class="uf-field">
                        <label for="new-user-lastname">Nazwisko</label>
                        <input type="text" id="new-user-lastname" class="form-input" placeholder="Nazwisko" autocomplete="family-name" value="${val(u.lastName)}" />
                    </div>
                    <div class="uf-field">
                        <label for="new-user-symbol">Symbol</label>
                        <input type="text" id="new-user-symbol" class="form-input" placeholder="Sym." title="Symbol w numeracji" value="${val(u.symbol)}" />
                    </div>
                </div>
            </div>

            <div class="uf-section">
                <div class="uf-section-title"><i data-lucide="key-round"></i> Dostęp</div>
                <div class="uf-grid">
                    <div class="uf-field">
                        <label for="new-user-login">Login</label>
                        <input type="text" id="new-user-login" class="form-input" placeholder="Login" autocomplete="username" aria-required="true" required value="${val(u.username)}" />
                    </div>
                    <div class="uf-field">
                        <label for="new-user-password">Hasło</label>
                        <input type="password" id="new-user-password" class="form-input" placeholder="${isEdit ? 'Nowe hasło (opcjonalnie)' : 'Hasło'}" autocomplete="new-password"${isEdit ? '' : ' aria-required="true" required'} />
                    </div>
                    <div class="uf-field">
                        <label for="new-user-role">Rola</label>
                        <select id="new-user-role" class="form-select" data-csp="toggleSubUsersList" data-csp-on="change">
                            ${roleOption('user', 'USER')}
                            ${roleOption('pro', 'PRO')}
                            ${roleOption('admin', 'ADMIN')}
                        </select>
                    </div>
                </div>
                <div id="sub-users-container" class="hidden sub-users-compact">
                    <span class="sub-users-title"><i data-lucide="link"></i> Przypisani:</span>
                    <div id="sub-users-list" class="sub-users-list-compact"></div>
                </div>
            </div>

            <div class="uf-section">
                <div class="uf-section-title"><i data-lucide="mail"></i> Kontakt</div>
                <div class="uf-grid cols-2">
                    <div class="uf-field">
                        <label for="new-user-email">Email</label>
                        <input type="email" id="new-user-email" class="form-input" placeholder="Email" autocomplete="email" value="${val(u.email)}" />
                    </div>
                    <div class="uf-field">
                        <label for="new-user-phone">Telefon</label>
                        <input type="text" id="new-user-phone" class="form-input" placeholder="Telefon" autocomplete="tel" value="${val(u.phone)}" />
                    </div>
                </div>
            </div>

            <div class="uf-section">
                <div class="uf-section-title"><i data-lucide="hash"></i> Numeracja</div>
                <div class="uf-grid cols-2">
                    <div class="uf-field">
                        <label for="new-user-order-start">Nr Zamówień (start)</label>
                        <input type="number" id="new-user-order-start" class="form-input" min="1" title="Start Zamówień" value="${val(u.orderStartNumber, 1)}" />
                    </div>
                    <div class="uf-field">
                        <label for="new-user-prod-order-start">Nr Zleceń (start)</label>
                        <input type="number" id="new-user-prod-order-start" class="form-input" min="1" title="Start Zleceń" value="${val(u.productionOrderStartNumber, 1)}" />
                    </div>
                </div>
            </div>
        </div>
        <div id="user-form-error" class="login-error user-form-error" role="alert" aria-live="assertive"></div>
        <div class="form-actions-inline">
            <button type="button" class="btn btn-danger btn-sm" data-csp="closeUserModal">Anuluj</button>
            <button type="submit" id="add-user-btn" class="btn btn-primary btn-sm">
                <i data-lucide="${isEdit ? 'save' : 'plus'}"></i> ${isEdit ? 'Zapisz' : 'Dodaj'}
            </button>
        </div>
    </form>
</div>`;
}

/** Otwiera modal: bez id = tryb dodawania, z id = edycja konta. */
function openUserModal(id) {
    if (typeof window.showModal !== 'function') {
        if (typeof logger !== 'undefined') {
            logger.error('dashboard', 'showModal niedostępny — modal użytkownika przerwany');
        }
        return;
    }
    const user = id ? adminUsers.find((x) => x.id === id) || null : null;
    editingUserId = user ? user.id : null;
    selectedSubUsers = user && Array.isArray(user.subUsers) ? [...user.subUsers] : [];

    const overlay = window.showModal({
        id: 'user-modal',
        titleId: 'user-modal-title',
        html: buildUserModalHtml(user),
        onClose: resetUserFormState
    });

    const form = overlay.querySelector('#user-form');
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            createUser();
        });
    }

    toggleSubUsersList();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: overlay });
    }

    const firstField = overlay.querySelector('#new-user-firstname');
    if (firstField) firstField.focus();
}

/** Zamyka i usuwa modal (closeModal(id) tylko ukrywa — ID zostałoby w DOM). */
function closeUserModal() {
    const overlay = document.getElementById('user-modal');
    if (overlay) {
        if (typeof window.untrapFocus === 'function') window.untrapFocus(overlay);
        overlay.remove();
    }
    if (typeof window.restoreBodyScroll === 'function') window.restoreBodyScroll();
    resetUserFormState();
}

function startEditUser(id) {
    openUserModal(id);
}

/** Walidacja klienta = mirror registerSchema; backend waliduje ponownie. */
function validateUserForm(values) {
    if (values.login.length < 3) {
        return { message: 'Login musi mieć co najmniej 3 znaki', fieldId: 'new-user-login' };
    }
    if (!values.isEditing && values.password.length < 8) {
        return { message: 'Hasło musi mieć przynajmniej 8 znaków', fieldId: 'new-user-password' };
    }
    if (values.isEditing && values.password && values.password.length < 8) {
        return {
            message: 'Nowe hasło musi mieć przynajmniej 8 znaków',
            fieldId: 'new-user-password'
        };
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
        return { message: 'Niepoprawny format email', fieldId: 'new-user-email' };
    }
    if (!['admin', 'user', 'pro'].includes(values.role)) {
        return { message: 'Niepoprawna rola', fieldId: 'new-user-role' };
    }
    if (values.orderStart < 1 || values.prodOrderStart < 1) {
        return {
            message: 'Numery startowe muszą być większe od 0',
            fieldId: 'new-user-order-start'
        };
    }
    return null;
}

let isSavingUser = false;

async function createUser() {
    if (isSavingUser) return;
    const g = (id) => {
        const el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    };
    const values = {
        login: g('new-user-login'),
        password: g('new-user-password'),
        email: g('new-user-email'),
        role: g('new-user-role') || 'user',
        isEditing: !!editingUserId,
        orderStart: parseInt(g('new-user-order-start'), 10) || 1,
        prodOrderStart: parseInt(g('new-user-prod-order-start'), 10) || 1
    };
    const errorEl = document.getElementById('user-form-error');
    if (errorEl) errorEl.textContent = '';
    document.querySelectorAll('#user-form [aria-invalid="true"]').forEach((el) => {
        el.removeAttribute('aria-invalid');
    });

    const invalid = validateUserForm(values);
    if (invalid) {
        if (errorEl) errorEl.textContent = invalid.message;
        const field = document.getElementById(invalid.fieldId);
        if (field) {
            field.setAttribute('aria-invalid', 'true');
            field.focus();
        }
        return;
    }

    const submitBtn = document.getElementById('add-user-btn');
    isSavingUser = true;
    if (submitBtn) submitBtn.disabled = true;
    try {
        const payload = {
            username: values.login,
            role: values.role,
            firstName: g('new-user-firstname'),
            lastName: g('new-user-lastname'),
            symbol: g('new-user-symbol'),
            phone: g('new-user-phone'),
            email: values.email,
            subUsers: selectedSubUsers,
            orderStartNumber: values.orderStart,
            productionOrderStartNumber: values.prodOrderStart
        };
        if (values.password) payload.password = values.password;

        const res = await fetch(
            values.isEditing ? '/api/users/' + editingUserId : '/api/auth/register',
            {
                method: values.isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload)
            }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const message =
                data && data.error
                    ? data.error
                    : values.isEditing
                      ? 'Błąd zapisu'
                      : 'Błąd tworzenia konta';
            if (errorEl) errorEl.textContent = message;
            return;
        }
        closeUserModal();
        await refreshAdminSessions();
    } catch (_e) {
        if (errorEl) errorEl.textContent = 'Błąd połączenia';
    } finally {
        isSavingUser = false;
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function deleteUser(id) {
    if (!(await appConfirm('Czy na pewno usunąć tego użytkownika?', { type: 'danger' }))) return;
    try {
        await fetch('/api/users/' + id, { method: 'DELETE', credentials: 'same-origin' });
        refreshAdminSessions();
    } catch (e) {
        logger.error('dashboard', 'deleteUser error:', e);
    }
}

async function showChangePassword() {
    const oldPw = await appPrompt('Podaj stare hasło:', '', {
        inputType: 'password',
        title: 'Zmiana hasła'
    });
    if (!oldPw) return;
    const newPw = await appPrompt('Podaj nowe hasło (min. 4 znaki):', '', {
        inputType: 'password',
        title: 'Zmiana hasła'
    });
    if (!newPw) return;
    if (newPw.length < 4) {
        await appAlert('Hasło musi mieć min. 4 znaki', { type: 'warning' });
        return;
    }

    try {
        const r = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
        });
        const data = await r.json();
        if (data.ok) {
            await appAlert('Hasło zmienione!', { type: 'info' });
        } else {
            await appAlert(data.error || 'Błąd zmiany hasła', { type: 'warning' });
        }
    } catch (_e) {
        await appAlert('Błąd połączenia', { type: 'warning' });
    }
}

/* ===== AI/ML KILL-SWITCH TOGGLE ===== */
function setAiMlToggleState(enabled) {
    const btn = document.getElementById('ai-ml-toggle-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    const label = btn.querySelector('span');
    if (label) label.textContent = enabled ? 'AI: ON' : 'AI: OFF';
    btn.classList.toggle('ai-btn-primary', enabled);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
}

function refreshAiDashboards() {
    if (typeof window.mlHealthRender === 'function') {
        window.mlHealthRender('ml-health-container');
    }
    if (typeof window.aiDashboardRender === 'function') {
        window.aiDashboardRender('ai-dashboard-container');
    }
}

function initAiMlToggle() {
    const btn = document.getElementById('ai-ml-toggle-btn');
    if (!btn || btn.dataset.aiMlBound) return;
    btn.dataset.aiMlBound = '1';
    const getEnabled =
        typeof window.aiMlEnabled === 'function'
            ? window.aiMlEnabled
            : function () {
                  return Promise.resolve(true);
              };
    getEnabled(true).then(setAiMlToggleState);
    btn.addEventListener('click', async function () {
        const currentlyOn = btn.getAttribute('aria-pressed') !== 'false';
        const next = !currentlyOn;
        const msg = next
            ? 'Włączyć moduł AI/ML (predykcje, treningi, operacje na modelach)?'
            : 'Wyłączyć moduł AI/ML? Nowe predykcje, treningi i operacje na modelach będą blokowane (503). Rozpoczęte operacje nie zostaną przerwane.';
        const confirmed = window.appConfirm
            ? await window.appConfirm(msg, {
                  title: 'Moduł AI/ML',
                  okText: next ? 'Włącz' : 'Wyłącz',
                  type: next ? 'info' : 'warning'
              })
            : window.aiUiConfirm
              ? await window.aiUiConfirm(msg, {
                    title: 'Moduł AI/ML',
                    okText: next ? 'Włącz' : 'Wyłącz',
                    type: next ? 'info' : 'warning'
                })
              : window.confirm
                ? window.confirm(msg)
                : true;
        if (!confirmed) return;
        btn.disabled = true;
        try {
            const p = window.fetchJson('/api/feature-flags/ai-ml', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: next })
            });
            const result = p ? await p : null;
            if (!result || result.error) throw new Error('toggle-failed');
            if (typeof window.aiMlInvalidateFlag === 'function') {
                window.aiMlInvalidateFlag();
            }
            setAiMlToggleState(next);
            if (typeof window.showToast === 'function') {
                window.showToast(next ? 'Moduł AI/ML włączony' : 'Moduł AI/ML wyłączony', 'info');
            }
            refreshAiDashboards();
        } catch (_e) {
            if (typeof window.showToast === 'function') {
                window.showToast('Nie udało się przełączyć modułu AI/ML', 'error');
            }
        } finally {
            btn.disabled = false;
        }
    });
}

/* ===== YEAR LETTER MANAGEMENT ===== */
/* SSoT normalizacji kodów w dashboardzie (litera roku + kody magazynów). */
function normUpperCode(v) {
    return (v == null ? '' : String(v)).trim().toUpperCase();
}

async function loadYearLetter() {
    try {
        const res = await fetch('/api/settings/year-letter', {
            credentials: 'same-origin'
        });
        const data = await res.json();
        const input = document.getElementById('year-letter-input');
        const yearEl = document.getElementById('year-letter-year');
        const preview = document.getElementById('year-letter-preview');
        if (input) input.value = data.letter || '';
        if (yearEl) yearEl.textContent = 'Rok: ' + (data.year || '');
        if (preview) preview.textContent = data.letter || '?';
    } catch (e) {
        logger.error('dashboard', 'loadYearLetter:', e);
    }
}

async function saveYearLetter() {
    const letter = normUpperCode(document.getElementById('year-letter-input').value);
    if (!letter || letter.length !== 1) {
        await appAlert('Litera musi być pojedynczym znakiem (A-Z)', { type: 'warning' });
        return;
    }
    try {
        const res = await fetch('/api/settings/year-letter', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ letter })
        });
        const data = await res.json();
        if (data.ok) {
            const preview = document.getElementById('year-letter-preview');
            if (preview) preview.textContent = letter;
            await appAlert('Litera roku zapisana: ' + letter, { type: 'info' });
        } else {
            await appAlert(data.error || 'Błąd zapisu', { type: 'warning' });
        }
    } catch (_e) {
        await appAlert('Błąd połączenia', { type: 'warning' });
    }
}

/* ===== KODY MAGAZYNÓW (słownik MAGAZYN dennica/nadbudowa) ===== */
const MAGAZYN_CODE_IDS = ['mag-den-wl', 'mag-den-klb', 'mag-nad-wl', 'mag-nad-klb'];

function readMagazynCodes() {
    const get = (id) => normUpperCode(document.getElementById(id).value);
    return {
        dennicaWl: get('mag-den-wl'),
        dennicaKlb: get('mag-den-klb'),
        nadbudowaWl: get('mag-nad-wl'),
        nadbudowaKlb: get('mag-nad-klb')
    };
}

function fillMagazynCodes(codes) {
    const map = {
        'mag-den-wl': codes.dennicaWl,
        'mag-den-klb': codes.dennicaKlb,
        'mag-nad-wl': codes.nadbudowaWl,
        'mag-nad-klb': codes.nadbudowaKlb
    };
    for (const id of MAGAZYN_CODE_IDS) {
        const el = document.getElementById(id);
        if (el) el.value = map[id] || '';
    }
    const preview = document.getElementById('mag-codes-preview');
    if (preview)
        preview.textContent =
            'D: ' +
            (codes.dennicaWl || '?') +
            '/' +
            (codes.dennicaKlb || '?') +
            ' N: ' +
            (codes.nadbudowaWl || '?') +
            '/' +
            (codes.nadbudowaKlb || '?');
}

async function loadMagazynCodes() {
    try {
        const res = await fetch('/api/settings/magazyn-codes', {
            credentials: 'same-origin'
        });
        const data = await res.json();
        fillMagazynCodes(data);
    } catch (e) {
        logger.error('dashboard', 'loadMagazynCodes:', e);
    }
}

async function saveMagazynCodes() {
    const codes = readMagazynCodes();
    // Mirror walidacji backendu (offerSchemas: max 20, brak znaków kontrolnych).
    // eslint-disable-next-line no-control-regex
    const hasControl = (c) => /[\u0000-\u001f\u007f-\u009f]/.test(c);
    const validShape = Object.values(codes).every((c) => c.length >= 1 && c.length <= 20);
    if (!validShape || Object.values(codes).some(hasControl)) {
        await appAlert('Kody: 1-20 znaków, bez znaków kontrolnych', { type: 'warning' });
        return;
    }
    if (codes.dennicaWl === codes.dennicaKlb || codes.nadbudowaWl === codes.nadbudowaKlb) {
        await appAlert('Włocławek i Kluczbork muszą mieć różne kody (osobno dennica i nadbudowa)', {
            type: 'warning'
        });
        return;
    }
    try {
        const res = await fetch('/api/settings/magazyn-codes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(codes)
        });
        const data = await res.json();
        if (res.ok && data.dennicaWl) {
            fillMagazynCodes(data);
            await appAlert('Kody magazynów zapisane', { type: 'info' });
        } else {
            await appAlert(data.error || 'Błąd zapisu', { type: 'warning' });
        }
    } catch (_e) {
        await appAlert('Błąd połączenia', { type: 'warning' });
    }
}

/* ===== Enter → akcja (P0/P1) — używa bindEnter z shared/ui.js ===== */
(function _bindDashboardEnter() {
    function tryBind() {
        if (typeof window.bindEnter !== 'function') return false;
        window.bindEnter('login-username', () => window.doLogin && window.doLogin());
        window.bindEnter('login-password', () => window.doLogin && window.doLogin());
        window.bindEnter(
            'year-letter-input',
            () => window.saveYearLetter && window.saveYearLetter()
        );
        MAGAZYN_CODE_IDS.forEach((id) =>
            window.bindEnter(id, () => window.saveMagazynCodes && window.saveMagazynCodes())
        );
        [
            'new-user-firstname',
            'new-user-lastname',
            'new-user-symbol',
            'new-user-login',
            'new-user-password',
            'new-user-email',
            'new-user-phone',
            'new-user-order-start',
            'new-user-prod-order-start'
        ].forEach((id) => window.bindEnter(id, () => window.createUser && window.createUser()));
        return true;
    }
    if (!tryBind()) {
        window.addEventListener('DOMContentLoaded', tryBind);
        // retry after ui.js async load
        setTimeout(tryBind, 500);
    } else if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryBind);
    }
})();

/* ===== Click → akcja (CSP-B) — delegacja data-idx zamiast onclick ===== */
(function _bindDashboardClicks() {
    // Guard: sandboxy testowe (vm) maja okrojony document lub brak document.
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    document.addEventListener('click', (event) => {
        const el = event.target && event.target.closest ? event.target.closest('[data-idx]') : null;
        if (!el) return;
        const a = el.getAttribute('data-idx');
        if (a === 'doLogin') window.doLogin && window.doLogin();
        else if (a === 'doLogout') window.doLogout && window.doLogout();
        else if (a === 'showChangePassword')
            window.showChangePassword && window.showChangePassword();
        else if (a === 'saveYearLetter') window.saveYearLetter && window.saveYearLetter();
        else if (a === 'saveMagazynCodes') window.saveMagazynCodes && window.saveMagazynCodes();
    });
})();

/* ===== Rejestracja globali ===== */
window.updateSubUsers = updateSubUsers;
window.startEditUser = startEditUser;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;

/* ===== Rejestracja globali ===== */
window.doLogout = doLogout;
window.doLogin = doLogin;
window.createUser = createUser;
window.deleteUser = deleteUser;
window.revokeUserSessions = revokeUserSessions;
window.showChangePassword = showChangePassword;
window.saveYearLetter = saveYearLetter;
window.saveMagazynCodes = saveMagazynCodes;
