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
}

window.headerUser = { render: renderHeaderUser };
