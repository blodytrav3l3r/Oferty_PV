// @ts-check
/* ===== WSPÓLNY RENDER DANYCH UŻYTKOWNIKA W NAGŁÓWKU =====
   Jedno źródło prawdy dla #header-username i #header-role-badge we
   wszystkich wejściówkach (studnie, rury, kartoteka, app.html).
   Kolory roli pochodzą z klas .role-admin/.role-pro/.role-user
   (style.utilities.css) — nie duplikuj colorMap w inicjalizatorach. */
function renderHeaderUser(user) {
    if (!user) return;
    const displayName =
        user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
    const userEl = document.getElementById('header-username');
    if (userEl) {
        userEl.innerHTML = '<i data-lucide="user"></i> ' + escapeHtml(displayName);
    }
    const roleEl = document.getElementById('header-role-badge');
    if (roleEl) {
        const role = user.role === 'admin' ? 'admin' : user.role === 'pro' ? 'pro' : 'user';
        roleEl.textContent = role.toUpperCase();
        roleEl.classList.remove('role-admin', 'role-pro', 'role-user');
        roleEl.classList.add('role-' + role);
    }
    // Przełącznik motywu jasny/ciemny przy nazwie użytkownika.
    // Inicjalizacja pobiera zapisany motyw z backendu (cache first, bez FOUC).
    if (window.sokTheme && typeof window.sokTheme.init === 'function') {
        window.sokTheme.init(user);
    }
    const userWrap = document.getElementById('header-user-info');
    if (userWrap && !document.getElementById('theme-toggle')) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.id = 'theme-toggle';
        toggle.className = 'header-logout';
        toggle.setAttribute('aria-label', 'Przełącz motyw');
        toggle.setAttribute('aria-pressed', 'false');
        toggle.onclick = function () {
            if (window.sokTheme) window.sokTheme.toggle();
        };
        const logoutBtn = userWrap.querySelector('.header-logout');
        if (logoutBtn) userWrap.insertBefore(toggle, logoutBtn);
        else userWrap.appendChild(toggle);
    }
    if (window.sokTheme && typeof window.sokTheme.refreshToggle === 'function') {
        window.sokTheme.refreshToggle();
    }
}

window.headerUser = { render: renderHeaderUser };
