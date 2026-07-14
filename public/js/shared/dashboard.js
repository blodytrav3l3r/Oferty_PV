// Zależności (ładowane przed tym skryptem): shared/auth.js, shared/ui.js

let adminUsers = [];
let editingUserId = null;
let selectedSubUsers = [];

function toggleSubUsersList() {
    const role = document.getElementById('new-user-role').value;
    const container = document.getElementById('sub-users-container');
    const listObj = document.getElementById('sub-users-list');
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
                            <input type="checkbox" value="${escapeHtml(u.id)}" ${selectedSubUsers.includes(u.id) ? 'checked' : ''} onchange="updateSubUsers(this)">
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
    const token = getAuthToken();
    if (token) {
        try {
            const res = await fetch('/api/auth/me', { headers: authHeaders() });
            const data = await res.json();
            if (data.user) {
                showLoggedIn(data.user);
                return;
            }
        } catch (e) {}
    }
    showLogin();
});

async function loadRecycledNumbers(user) {
    const u = user || currentUser;
    if (!u) return;
    try {
        const res = await fetch('/api/orders-studnie/recycled', {
            headers: authHeaders()
        });
        const data = await res.json();
        const container = document.getElementById('recycled-numbers-list');

        if (data.recycled && data.recycled.length > 0) {
            const yearShort = String(new Date().getFullYear()).slice(-2);
            container.innerHTML = data.recycled
                .map(
                    (num) =>
                        `<span class="recycled-badge">${escapeHtml(u.symbol || '?')}/.../${String(num).padStart(5, '0')}/${yearShort}</span>`
                )
                .join('');
        } else {
            container.innerHTML = '<span class="recycled-empty">Brak odzyskanych numerów.</span>';
        }
    } catch (e) {
        logger.error('dashboard', 'Failed to load recycled numbers', e);
    }
}

// Obsluga klawiszy
document.addEventListener('keydown', (e) => {
    if (
        e.key === 'Enter' &&
        !document.getElementById('login-section').classList.contains('hidden')
    ) {
        doLogin();
        return;
    }

    // Ctrl+S / Cmd+S: zapisz bieżącą ofertę (rury lub studnie)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        const active = document.activeElement;
        const inForm = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
        if (inForm) {
            return;
        }
        e.preventDefault();
        if (typeof window.saveOfferRury === 'function') {
            window.saveOfferRury();
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

    // Pokaz naglowek nawigacji pulpitu
    document.getElementById('dash-header').classList.add('visible');
    const dashUser = document.getElementById('dash-username');
    const dashRole = document.getElementById('dash-role');
    if (dashUser) {
        dashUser.textContent = '';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'user');
        dashUser.appendChild(icon);
        dashUser.appendChild(document.createTextNode(' ' + user.username));
    }
    if (dashRole) {
        dashRole.textContent = user.role === 'admin' ? 'ADMIN' : 'USER';
        dashRole.classList.add(user.role === 'admin' ? 'role-admin' : 'role-user');
    }

    if (user.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
        loadUsers();
        loadYearLetter();
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
    } else {
        document.getElementById('admin-panel').classList.add('hidden');
    }

    loadRecycledNumbers(user);
}

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!username || !password) {
        errorEl.textContent = 'Podaj login i hasło';
        return;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            errorEl.textContent = data.error || 'Błąd logowania';
            return;
        }
        localStorage.setItem('authToken', data.token);
        sessionStorage.setItem('user', JSON.stringify(data.user));
        showLoggedIn(data.user);
    } catch (e) {
        errorEl.textContent = 'Błąd połączenia z serwerem';
    }
}

async function doLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
    } catch (e) {}
    localStorage.removeItem('authToken');
    showLogin();
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}

async function loadUsers() {
    try {
        const res = await fetch('/api/users', { headers: authHeaders() });
        const data = await res.json();
        adminUsers = data.data || [];

        updateStatsBar();

        const tbody = document.getElementById('users-table-body');
        const emptyState = document.getElementById('admin-empty-state');

        if (adminUsers.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        tbody.innerHTML = adminUsers
            .map((u) => {
                let html = `
      <tr>
        <td>
            <div class="user-name">${escapeHtml((u.firstName || '') + ' ' + (u.lastName || ''))}</div>
            <div class="user-email">${escapeHtml(u.email || 'brak email')}</div>
        </td>
        <td><span class="token-badge text-warn">${escapeHtml(u.symbol || '??')}</span></td>
        <td class="cell-mono">${escapeHtml(u.username)}</td>
        <td class="cell-phone">${escapeHtml(u.phone || '—')}</td>
        <td><span class="badge-role ${escapeHtml(u.role)}">${escapeHtml(u.role.toUpperCase())}</span></td>
        <td class="cell-num">${escapeHtml(String(u.orderStartNumber || 1))}</td>
        <td class="cell-num">${escapeHtml(String(u.productionOrderStartNumber || 1))}</td>
        <td>
          <div class="admin-actions-cell">
            <button class="admin-action-btn edit-btn" aria-label="Edytuj użytkownika" onclick="startEditUser('${escapeHtml(u.id)}')"><i data-lucide="pencil"></i></button>
            ${u.username !== 'admin' ? `<button class="admin-action-btn delete-btn" aria-label="Usuń użytkownika" onclick="deleteUser('${escapeHtml(u.id)}')"><i data-lucide="trash-2"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
                if (u.role === 'pro' && u.subUsers && u.subUsers.length > 0) {
                    const subUsersNames = u.subUsers.map((subId) => {
                        const subU = adminUsers.find((x) => x.id === subId);
                        return subU
                            ? subU.firstName && subU.lastName
                                ? subU.firstName + ' ' + subU.lastName
                                : subU.username
                            : 'Nieznany';
                    });
                    html += `
      <tr class="subordinate-row">
        <td colspan="8">
            <div class="subordinate-list">
                <span class="subordinate-label"><i data-lucide="users"></i> POWIĄZANI HANDLOWCY:</span>
                <div class="subordinate-badges">
                    ${subUsersNames.map((name) => `<span class="token-badge sub-token">${escapeHtml(name)}</span>`).join('')}
                </div>
            </div>
        </td>
      </tr>`;
                }
                return html;
            })
            .join('');

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: tbody });
        }
    } catch (e) {
        logger.error('dashboard', 'loadUsers error:', e);
    }
}

function updateStatsBar() {
    const counts = { admin: 0, pro: 0, user: 0 };
    adminUsers.forEach((u) => {
        if (counts.hasOwnProperty(u.role)) counts[u.role]++;
    });
    const adminEl = document.getElementById('stat-admin-count');
    const proEl = document.getElementById('stat-pro-count');
    const userEl = document.getElementById('stat-user-count');
    if (adminEl) adminEl.textContent = counts.admin;
    if (proEl) proEl.textContent = counts.pro;
    if (userEl) userEl.textContent = counts.user;
}

function startEditUser(id) {
    const u = adminUsers.find((x) => x.id === id);
    if (!u) return;
    editingUserId = id;
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('new-user-firstname', u.firstName || '');
    setVal('new-user-lastname', u.lastName || '');
    setVal('new-user-symbol', u.symbol || '');
    setVal('new-user-login', u.username);
    const pwd = document.getElementById('new-user-password');
    if (pwd) {
        pwd.value = '';
        pwd.placeholder = 'Nowe hasło (opcjonalnie)';
    }
    setVal('new-user-email', u.email || '');
    setVal('new-user-phone', u.phone || '');
    setVal('new-user-order-start', u.orderStartNumber || 1);
    setVal('new-user-prod-order-start', u.productionOrderStartNumber || 1);
    setVal('new-user-role', u.role);
    selectedSubUsers = [...(u.subUsers || [])];
    toggleSubUsersList();

    const modeLabel = document.getElementById('form-mode-label');
    if (modeLabel) {
        modeLabel.classList.remove('hidden');
        modeLabel.innerHTML =
            '<i data-lucide="pencil"></i> EDYCJA: ' + escapeHtml(u.firstName || u.username);
    }
    const formHeading = document.getElementById('form-heading');
    if (formHeading) formHeading.textContent = 'Edycja użytkownika';
    const addBtn = document.getElementById('add-user-btn');
    if (addBtn) addBtn.innerHTML = '<i data-lucide="save"></i> Zapisz';
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: modeLabel });
    }
}

function cancelEditUser() {
    editingUserId = null;
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    const modeLabel = document.getElementById('form-mode-label');
    if (modeLabel) modeLabel.classList.add('hidden');
    const formHeading = document.getElementById('form-heading');
    if (formHeading) formHeading.textContent = 'Nowy użytkownik';
    setVal('new-user-firstname', '');
    setVal('new-user-lastname', '');
    setVal('new-user-symbol', '');
    setVal('new-user-login', '');
    const pwd = document.getElementById('new-user-password');
    if (pwd) {
        pwd.value = '';
        pwd.placeholder = 'Hasło';
    }
    setVal('new-user-email', '');
    setVal('new-user-phone', '');
    setVal('new-user-order-start', 1);
    setVal('new-user-prod-order-start', 1);
    setVal('new-user-role', 'user');

    const addBtn = document.getElementById('add-user-btn');
    if (addBtn) addBtn.innerHTML = '<i data-lucide="plus"></i> Dodaj';
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');

    selectedSubUsers = [];
    toggleSubUsersList();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: document.getElementById('user-form-container') });
    }
}

async function createUser() {
    const g = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };
    const firstName = g('new-user-firstname');
    const lastName = g('new-user-lastname');
    const symbol = g('new-user-symbol');
    const login = g('new-user-login');
    const password = g('new-user-password');
    const email = g('new-user-email');
    const phone = g('new-user-phone');
    const role = g('new-user-role');
    const errorEl = document.getElementById('admin-error');
    if (errorEl) errorEl.textContent = '';

    if (!login) {
        errorEl.textContent = 'Podaj login';
        return;
    }
    // Dla nowych uzytkownikow haslo jest wymagane
    if (!editingUserId && !password) {
        errorEl.textContent = 'Podaj hasło dla nowego użytkownika';
        return;
    }

    try {
        const isEditing = !!editingUserId;
        const url = isEditing ? `/api/users/${editingUserId}` : '/api/auth/register';
        const method = isEditing ? 'PUT' : 'POST';
        const payload = {
            username: login,
            role,
            firstName,
            lastName,
            symbol,
            phone,
            email,
            subUsers: selectedSubUsers,
            orderStartNumber: parseInt(g('new-user-order-start')) || 1,
            productionOrderStartNumber: parseInt(g('new-user-prod-order-start')) || 1
        };
        if (password) payload.password = password;

        const res = await fetch(url, {
            method: method,
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            errorEl.textContent =
                data.error || (isEditing ? 'Błąd zapisu' : 'Błąd tworzenia konta');
            return;
        }
        cancelEditUser(); // Clears form and resets state
        loadUsers();
    } catch (e) {
        errorEl.textContent = 'Błąd połączenia';
    }
}

async function deleteUser(id) {
    if (!confirm('Czy na pewno usunąć tego użytkownika?')) return;
    try {
        await fetch('/api/users/' + id, { method: 'DELETE', headers: authHeaders() });
        loadUsers();
    } catch (e) {
        logger.error('dashboard', 'deleteUser error:', e);
    }
}

function showChangePassword() {
    const oldPw = prompt('Podaj stare hasło:');
    if (!oldPw) return;
    const newPw = prompt('Podaj nowe hasło (min. 4 znaki):');
    if (!newPw) return;
    if (newPw.length < 4) {
        alert('Hasło musi mieć min. 4 znaki');
        return;
    }

    fetch('/api/auth/change-password', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.ok) {
                alert('Hasło zmienione!');
            } else {
                alert(data.error || 'Błąd zmiany hasła');
            }
        })
        .catch(() => alert('Błąd połączenia'));
}

/* ===== YEAR LETTER MANAGEMENT ===== */
async function loadYearLetter() {
    try {
        const res = await fetch('/api/settings/year-letter', {
            headers: authHeaders()
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
    const letter = (document.getElementById('year-letter-input').value || '').trim().toUpperCase();
    if (!letter || letter.length !== 1) {
        alert('Litera musi być pojedynczym znakiem (A-Z)');
        return;
    }
    try {
        const res = await fetch('/api/settings/year-letter', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ letter })
        });
        const data = await res.json();
        if (data.ok) {
            const preview = document.getElementById('year-letter-preview');
            if (preview) preview.textContent = letter;
            alert('Litera roku zapisana: ' + letter);
        } else {
            alert(data.error || 'Błąd zapisu');
        }
    } catch (e) {
        alert('Błąd połączenia');
    }
}
