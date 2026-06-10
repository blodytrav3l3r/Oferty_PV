/* ===== WITROS PRECISION OS — APP.JS (RDZEŃ) ===== */
/* Zredukowany z 3108 linii do rdzenia: stan globalny, nawigacja, inicjalizacja DOM */
/* Logika wydzielona do modułów w js/rury/: */
/*   productHelpers.js — helpery wymiarów produktu */
/*   dataService.js    — komunikacja REST API */
/*   transport.js      — kalkulacja transportu */
/*   offerItems.js     — formularz oferty, katalog, pozycje */
/*   offerCrud.js      — CRUD ofert (zapis, ładowanie, historia) */
/*   offerExports.js   — PDF/XLSX/JSON eksport, modal rabatów */
/*   pricelistUi.js    — cennik CRUD, import/eksport Excel */

/* ===== ZMIENNE GLOBALNE ===== */
/* Zarządzane przez AppState singleton (shared/appState.js). */
/* Dostępne globalnie przez window.products, window.offers itp. */
/* dzięki Object.defineProperty — pełna kompatybilność wsteczna. */
// getAuthToken(), authHeaders(), appLogout() — dostępne z shared/auth.js

/* ===== ZMIANA OPIEKUNA ===== */

async function changeOfferUser() {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'pro')) {
        showToast('Brak uprawnień do zmiany opiekuna', 'error');
        return;
    }
    try {
        const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
        const usersData = await usersResp.json();
        const allUsers = usersData.data || [];

        if (allUsers.length > 0) {
            const currentId = editingOfferAssignedUserId || currentUser.id;
            const selectedUser = await showUserSelectionPopup(allUsers, currentId);
            if (selectedUser !== null) {
                editingOfferAssignedUserId = selectedUser.id;
                editingOfferAssignedUserName = selectedUser.displayName || selectedUser.username;
                showToast(`Opiekun zmieniony na: ${editingOfferAssignedUserName}`, 'success');

                const btnChangeUser = document.getElementById('btn-change-offer-user');
                if (btnChangeUser)
                    btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${editingOfferAssignedUserName}`;

                if (editingOfferId) {
                    saveOffer();
                }
            }
        }
    } catch (e) {
        logger.error('app', 'Błąd pobierania użytkowników:', e);
        showToast('Błąd pobierania listy użytkowników', 'error');
    }
}

/* ===== TOGGLE HELPERS ===== */

window.toggleTransportBreakdown = function () {
    isTransportBreakdownExpanded = !isTransportBreakdownExpanded;
    const contents = document.querySelectorAll('#transport-breakdown-content, #order-transport-breakdown-content');
    const icons = document.querySelectorAll('#transport-toggle-icon, #order-transport-toggle-icon');
    contents.forEach(c => { c.style.display = isTransportBreakdownExpanded ? 'block' : 'none'; });
    icons.forEach(i => {
        i.innerHTML = isTransportBreakdownExpanded
            ? '<i data-lucide="chevron-up"></i>'
            : '<i data-lucide="chevron-down"></i>';
    });
    if (window.lucide) window.lucide.createIcons();
};

window.toggleOrderTransportBreakdown = function () {
    window.toggleTransportBreakdown();
};

window.toggleCard = function (contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (content && icon) {
        content.classList.toggle('hidden');
        const isHidden = content.classList.contains('hidden');
        icon.innerHTML = isHidden ? '<i data-lucide="chevron-down"></i>' : '<i data-lucide="chevron-up"></i>';

        // Jawnie ukryj elementy sticky wewnątrz, które mogą wychodzić poza granice overflow
        const stickyEls = content.querySelectorAll('.offer-search-row, .catalog-tabs');
        stickyEls.forEach((el) => {
            if (isHidden) el.classList.add('hidden');
            else el.classList.remove('hidden');
        });
    }
};

/* ===== NAWIGACJA ===== */

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });
}

function showSection(id) {
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

    const targetSection = document.getElementById('section-' + id);
    if (targetSection) targetSection.classList.add('active');

    const targetBtn = document.querySelector(`.nav-btn[data-section="${id}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    if (id === 'pricelist') renderPriceList();

    // Wspólna belka podsumowania dla builder i oferta
    const summaryBar = document.getElementById('rury-summary-bar');
    if (id === 'offer') {
        if (summaryBar) summaryBar.style.display = 'block';
        if (typeof updateOfferSummary === 'function') updateOfferSummary();

        // Baner kontekstu
        const ctxBanner = document.getElementById('offer-context-banner');
        const ctxBadge = document.getElementById('offer-context-badge');
        const ctxText = document.getElementById('offer-context-text');
        if (ctxBanner && ctxBadge && ctxText) {
            ctxBanner.style.display = 'block';
            if (window.orderEditMode) {
                ctxBadge.innerHTML = '<i data-lucide="package" style="width:14px;height:14px;"></i> Zamówienie (krok 5)';
                ctxBadge.style.background = 'rgba(52,211,153,0.15)';
                ctxBadge.style.color = '#34d399';
                ctxBadge.style.border = '1px solid rgba(52,211,153,0.3)';
                ctxText.textContent = 'Podgląd zamówienia — dane pochodzą z zatwierdzonego zamówienia.';
            } else if (window.editingOfferId) {
                ctxBadge.innerHTML = '<i data-lucide="edit" style="width:14px;height:14px;"></i> Oferta (krok 3)';
                ctxBadge.style.background = 'rgba(59,130,246,0.15)';
                ctxBadge.style.color = '#3b82f6';
                ctxBadge.style.border = '1px solid rgba(59,130,246,0.3)';
                ctxText.textContent = 'Podgląd oferty — edytuj pozycje w zakładce Konfiguracja.';
            } else {
                ctxBadge.innerHTML = '<i data-lucide="file-text" style="width:14px;height:14px;"></i> Nowa oferta';
                ctxBadge.style.background = 'rgba(156,163,175,0.15)';
                ctxBadge.style.color = '#9ca3af';
                ctxBadge.style.border = '1px solid rgba(156,163,175,0.3)';
                ctxText.textContent = 'Dodaj produkty w zakładce Konfiguracja.';
            }
            if (window.lucide) lucide.createIcons();
        }
    } else if (id === 'builder') {
        const activeStep = document.querySelector('.wizard-step.active');
        const step = activeStep ? parseInt(activeStep.id.replace('wizard-step-', '')) : 1;
        if (summaryBar) summaryBar.style.display = (step === 3 || step === 5) ? 'block' : 'none';
    } else {
        if (summaryBar) summaryBar.style.display = 'none';
    }

    // Aktualizuj URL, aby przeładowanie nie powodowało utraty stanu
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('tab', id);
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
}

/* closeModal — przeniesione do shared/ui.js */
/* showToast() — dostępne z shared/ui.js */
/* fmt(), fmtInt() — dostępne z shared/formatters.js */

/* ===== INICJALIZACJA DOM ===== */

document.addEventListener('DOMContentLoaded', async () => {
    // Sprawdź autoryzację
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
        currentUser = authData.user;
        // Wygeneruj displayName dla UI
        currentUser.displayName =
            currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username;
        sessionStorage.setItem('user', JSON.stringify(currentUser));

        // Pobierz mapę wszystkich użytkowników dla list
        await fetchGlobalUsers();
    } catch (e) {
        window.location.href = 'index.html';
        return;
    }

    // Wyświetl info o użytkowniku w nagłówku
    const userEl = document.getElementById('header-username');
    if (userEl) userEl.innerHTML = '<i data-lucide="user"></i> ' + (currentUser.displayName || currentUser.username);

    const roleEl = document.getElementById('header-role-badge');
    if (roleEl) {
        roleEl.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'USER';
        roleEl.style.background =
            currentUser.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)';
        roleEl.style.color = currentUser.role === 'admin' ? '#f59e0b' : '#60a5fa';
        roleEl.style.border =
            currentUser.role === 'admin'
                ? '1px solid rgba(245,158,11,0.3)'
                : '1px solid rgba(59,130,246,0.3)';
    }

    // Pokaż przycisk „Zmień opiekuna" dla admin/pro
    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (
        btnChangeUser &&
        currentUser &&
        (currentUser.role === 'admin' || currentUser.role === 'pro')
    ) {
        btnChangeUser.style.display = 'inline-block';
    }

    products = await loadProducts();
    offers = await loadOffers();
    AppState.clientsDb = await loadClientsDb();
    if (typeof loadOrdersRury === 'function') await loadOrdersRury();

    setupNavigation();
    renderPriceList();
    renderSavedOffers();
    setupOfferForm();

    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const editId = urlParams.get('edit');
    const orderId = urlParams.get('order');

    initWizard();

    if (editId) {
        showSection('builder');
        loadOffer(editId);
    } else if (orderId) {
        showSection('builder');
        if (typeof enterRuryOrderEditMode === 'function') {
            enterRuryOrderEditMode(orderId);
        }
    } else if (tab) {
        showSection(tab);
    } else {
        showSection('builder');
    }
});

/* ===== AUTO-LOAD Z URL ===== */

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');

    if (editId) {
        // Czekaj na inicjalizację pvSalesUI
        const checkInit = setInterval(async () => {
            if (window.pvSalesUI && window.pvSalesUI.marketplaceManager) {
                clearInterval(checkInit);
                try {
                    const doc = await window.pvSalesUI.marketplaceManager.localOffers.get(editId);
                    const restoreIdx = params.get('restore');

                    if (restoreIdx !== null && doc.history && doc.history[restoreIdx]) {
                        logger.info('app', '[App] Przywracanie wersji historycznej:', restoreIdx);
                        window.loadSavedOfferData(doc.history[restoreIdx], editId);
                        showToast('Wersja historyczna oferty załadowana', 'success');
                    } else if (typeof window.loadSavedOfferData === 'function') {
                        window.loadSavedOfferData(doc, editId);
                        showToast('Oferta załadowana do edycji', 'success');
                    }
                } catch (err) {
                    logger.error('app', '[App] Błąd auto-ładowania oferty:', err);
                }
            }
        }, 100);
    }
});
