// @ts-check
/* ===== S.O.K. — APP.JS (RDZEŃ) ===== */
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
/* products, offers, clientsDb, currentOfferItems, editingOfferId itp. */
/* to zmienne globalne (window.*) dostępne we wszystkich modułach. */
/* dzięki Object.defineProperty — pełna kompatybilność wsteczna. */
var editingOfferId = null;
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
                    btnChangeUser.innerHTML =
                        '<i data-lucide="user"></i> Opiekun: ' +
                        escapeHtml(editingOfferAssignedUserName);

                if (editingOfferId) {
                    if (typeof window.saveOfferOrOrder === 'function') {
                        await window.saveOfferOrOrder();
                    } else if (typeof window.saveOfferStudnie === 'function') {
                        await window.saveOfferStudnie();
                    }
                }
            }
        }
    } catch (e) {
        logger.error('app', 'Błąd pobierania użytkowników:', e);
        showToast('Błąd pobierania listy użytkowników', 'error');
    }
}

/**
 * Toggle (zwijanie/rozwijanie) karty.
 * Działa z 2 sygnaturami:
 * 1. (header: HTMLElement) — kliknięty nagłówek (karta DOM, shared/ui.js)
 * 2. (contentId: string, iconId: string) — ID elementów
 * @type {(...args: any[]) => void}
 */
window.toggleCard = function (contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (content && icon) {
        content.classList.toggle('hidden');
        const isHidden = content.classList.contains('hidden');
        icon.innerHTML = isHidden
            ? '<i data-lucide="chevron-down"></i>'
            : '<i data-lucide="chevron-up"></i>';

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
    if (window.headerUser) {
        window.headerUser.render(currentUser);
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
    clientsDb = await loadClientsDb();
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
