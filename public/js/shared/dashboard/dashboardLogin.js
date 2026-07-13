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
                            <input type="checkbox" data-action="updateSubUsers" value="${escapeHtml(u.id)}" ${selectedSubUsers.includes(u.id) ? 'checked' : ''}>
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

document.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action="updateSubUsers"]');
    if (!target) return;
    updateSubUsers(target);
});

document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action="startEditUser"],[data-action="deleteUser"]');
    if (!target) return;
    const userId = target.dataset.userId;
    if (target.dataset.action === 'startEditUser') startEditUser(userId);
    else if (target.dataset.action === 'deleteUser') deleteUser(userId);
});

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/auth/me', { headers: authHeaders(), credentials: 'include' });
        const data = await res.json();
        if (data.user) {
            showLoggedIn(data.user);
            return;
        }
    } catch (e) {}
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

document.addEventListener('keydown', (e) => {
    if (
        e.key === 'Enter' &&
        !document.getElementById('login-section').classList.contains('hidden')
    ) {
        doLogin();
        return;
    }

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
        sessionStorage.setItem('user', JSON.stringify(data.user));
        showLoggedIn(data.user);
    } catch (e) {
        errorEl.textContent = 'Błąd połączenia z serwerem';
    }
}

async function doLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'include'
        });
    } catch (e) {}
    showLogin();
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}
