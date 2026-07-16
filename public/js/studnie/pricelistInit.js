/* ===== INICJALIZACJA ===== */
document.addEventListener('DOMContentLoaded', async () => {
    if (window.__STUDNIE_APP_ORCHESTRATOR__) {
        return;
    }

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
    } catch {
        window.location.href = 'index.html';
        return;
    }

    const userEl = document.getElementById('header-username');
    const roleEl = document.getElementById('header-role-badge');
    if (userEl)
        userEl.textContent = currentUser.firstName
            ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
            : currentUser.username;
    if (roleEl) {
        roleEl.textContent = currentUser.role;
        roleEl.classList.add(currentUser.role === 'admin' ? 'role-admin' : 'role-user');
    }

    document.querySelectorAll('.nav-btn').forEach((/** @type {HTMLElement} */ btn) => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('offer-number').value = generateOfferNumberStudnie();

    wizardConfirmedParams = new Set();
    goToWizardStep(1);

    try {
        studnieProducts = await loadStudnieProducts();

        if (!studnieProducts.some((p) => p.componentType === 'kineta')) {
            logger.warn('pricelistManager', '[Studnie] Brak kinet w cenniku');
        }

        wells = [];
        wellCounter = 0;
        currentWellIndex = 0;
        offerDefaultZakonczenie = null;
        offerDefaultRedukcja = false;
        offerDefaultRedukcjaMinH = 2500;
        offerDefaultRedukcjaZak = null;

        refreshAll();

        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        const orderParam = urlParams.get('order');

        offersStudnie = await loadOffersStudnie();
        ordersStudnie = await loadOrdersStudnie();
        clientsDb = await loadClientsDb();
        renderSavedOffersStudnie();

        if (orderParam) {
            await enterOrderEditMode(orderParam);
        } else if (tab) {
            showSection(tab);
        }

        if (!orderEditMode) {
            document.getElementById('offer-number').value = generateOfferNumberStudnie();
        }
    } catch (err) {
        logger.error('pricelistManager', 'Błąd podczas inicjalizacji danych:', err);
        showToast('Wystąpił błąd podczas ładowania danych. Nawigacja jest dostępna.', 'error');
        if (!orderEditMode) {
            document.getElementById('offer-number').value = generateOfferNumberStudnie();
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document
        .getElementById('studnie-pricelist-search')
        ?.addEventListener('input', renderStudniePriceList);
});
