// @ts-check
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
                    btnChangeUser.innerHTML =
                        '<i data-lucide="user"></i> Opiekun: ' +
                        escapeHtml(editingOfferAssignedUserName);

                if (editingOfferId) {
                    if (typeof window.saveOfferRury === 'function') {
                        await window.saveOfferRury();
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
    if (userEl)
        userEl.innerHTML =
            '<i data-lucide="user"></i> ' +
            escapeHtml(currentUser.displayName || currentUser.username);

    const roleEl = document.getElementById('header-role-badge');
    if (roleEl) {
        roleEl.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'USER';
        roleEl.classList.add(currentUser.role === 'admin' ? 'role-admin' : 'role-user');
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

    // CSP actions registration (data-action dispatcher)
    if (typeof registerCspAction === 'function') {
        registerCspAction('logout', appLogout);
        registerCspAction('phase-nav', {
            handler: function (p) {
                goToPhase(Number(p.phase));
            },
            params: ['phase']
        });
        registerCspAction('phase-next', phaseNext);
        registerCspAction('phase-prev', phasePrev);
        registerCspAction('show-section', {
            handler: function (p) {
                showSection(p.section);
            },
            params: ['section']
        });
        registerCspAction('transport-protection', {
            handler: function (p) {
                window.setZabezpieczenieTransportu(p.value === 'true');
            },
            params: ['value']
        });
        registerCspAction('input-select', function (t) {
            t.select();
        });
        registerCspAction('toggle-catalog', function () {
            toggleCatalog();
        });
        registerCspAction('toggle-rury-transport-mode', function () {
            toggleRuryTransportMode();
        });
        registerCspAction('show-add-product-modal', function () {
            showAddProductModal();
        });
        registerCspAction('save-price-list', function () {
            savePriceList();
        });
        registerCspAction('export-rury-excel', function () {
            exportRuryToExcel();
        });
        registerCspAction('import-rury-excel', function () {
            document.getElementById('import-rury-excel').click();
        });
        registerCspAction('show-item-discount-modal', function () {
            showItemDiscountModal();
        });
        registerCspAction('show-universal-print-modal', function () {
            showUniversalPrintModalRury(editingOfferId);
        });
        registerCspAction('save-offer-or-order', function () {
            saveOfferOrOrder();
        });
        registerCspAction('create-order-from-offer', function () {
            createOrderFromOffer();
        });
        registerCspAction('show-clients-db', function () {
            showClientsDb();
        });
        registerCspAction('save-client-to-db', function () {
            saveClientToDb();
        });
        registerCspAction('change-offer-user', function () {
            changeOfferUser();
        });
        registerCspAction('copy-karta-budowy', function () {
            copyKartaBudowyFromOrder();
        });
        registerCspAction('add-custom-przejscie', function () {
            addCustomPrzejscieRow();
        });
        registerCspAction('open-rury-transport-popup', function () {
            openRuryTransportPopup();
        });
        registerCspAction('handle-rury-transport-cancel', function () {
            handleRuryTransportCancel();
        });
        registerCspAction('handle-rury-transport-save', function () {
            handleRuryTransportSave();
        });
        registerCspAction('sanitize-numeric', function (t) {
            t.value = t.value.replace(/[^0-9]/g, '');
        });
        registerCspAction('rury-transport-form-change', function () {
            onRuryTransportFormChange();
        });
        registerCspAction('toggle-all-items-for-order', function (t) {
            toggleAllItemsForOrder(t.checked);
        });
        registerCspAction('toggle-inne-display', function (t) {
            var id = t.dataset.targetId;
            var el = document.getElementById(id);
            if (el) el.style.display = t.value === 'Inne' ? 'block' : 'none';
        });
        registerCspAction('handle-przejscia-zamowione-change', function (t) {
            handlePrzejsciaZamowioneChange(t);
        });
        registerCspAction('import-rury-from-excel', function (t) {
            var ev = new Event('change');
            Object.defineProperty(ev, 'target', { value: t });
            importRuryFromExcel(ev);
        });
        registerCspAction('sync-rury-transport-from-modal', function () {
            if (typeof syncRuryTransportFromModal === 'function') syncRuryTransportFromModal();
        });
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
