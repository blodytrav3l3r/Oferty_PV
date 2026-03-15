/* ============================
   WITROS — Kalkulator Studni
   app_studnie.js  (Orchestrator - Entry Point)
   ============================ */

/**
 * Zdarzenie DOMContentLoaded do inicjalizacji całej aplikacji.
 * UWAGA: Logika i główne zmienne znajdują się teraz w osobnych plikach w `public/js/studnie/`
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Sprawdzenie autoryzacji
    const token = getAuthToken();
    if (!token) { window.location.href = 'index.html'; return; }
    try {
        const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
        const authData = await authRes.json();
        if (!authData.user) { window.location.href = 'index.html'; return; }
        currentUser = authData.user;
        sessionStorage.setItem('user', JSON.stringify(currentUser));
    } catch (e) { window.location.href = 'index.html'; return; }

    // Wyświetlenie danych w nagłówku
    const userEl = document.getElementById('header-username');
    const roleEl = document.getElementById('header-role-badge');
    if (userEl) userEl.textContent = '👤 ' + currentUser.username;
    if (roleEl) {
        roleEl.textContent = currentUser.role === 'admin' ? 'ADMIN' : (currentUser.role === 'pro' ? 'PRO' : 'USER');
        if (currentUser.role === 'admin') {
            roleEl.style.background = 'rgba(245,158,11,0.15)'; roleEl.style.color = '#f59e0b'; roleEl.style.borderColor = 'rgba(245,158,11,0.3)';
        } else if (currentUser.role === 'pro') {
            roleEl.style.background = 'rgba(16,185,129,0.15)'; roleEl.style.color = '#10b981'; roleEl.style.borderColor = 'rgba(16,185,129,0.3)';
        }
    }

    // Załadowanie danych z backendu
    studnieProducts = await loadStudnieProducts();
    offersStudnie = await loadOffersStudnie();
    ordersStudnie = await loadOrdersStudnie();
    try {
        productionOrders = await loadProductionOrders();
    } catch(e) { console.warn('Błąd ładowania zleceń:', e) }
    clientsDb = await loadClientsDb();

    // Inicjalizacja UI
    setupNavigation();
    renderStudniePriceList();
    renderSavedOffersStudnie();
    checkBackendStatus();

    // Inicjalizacja pierwszej domyślnej studni
    createNewWell(1000); // domyślnie tworzymy studnię DN1000
    renderWellsList();
    selectWell(0);

    // Nawigacja i Auto-ładowanie
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const editId = urlParams.get('edit');

    if (tab) {
        showSection(tab);
    } else if (editId) {
        showSection('builder');
        // Wait for pvSalesUI
        const checkInit = setInterval(async () => {
            if (window.pvSalesUI && window.pvSalesUI.marketplaceManager) {
                clearInterval(checkInit);
                try {
                    const doc = await window.pvSalesUI.marketplaceManager.localOffers.get(editId);
                    const restoreIdx = urlParams.get('restore');
                    
                    if (restoreIdx !== null && doc.history && doc.history[restoreIdx]) {
                        console.log('[AppStudnie] Przywracanie wersji historycznej:', restoreIdx);
                        window.loadSavedOfferStudnie(doc.history[restoreIdx], editId);
                        if(typeof window.showToast === 'function') window.showToast('Wersja historyczna Studni załadowana');
                    } else if (typeof window.loadSavedOfferStudnie === 'function') {
                        window.loadSavedOfferStudnie(doc, editId);
                        if(typeof window.showToast === 'function') window.showToast('Oferta Studni załadowana');
                    }
                } catch (err) {
                    console.error('[AppStudnie] Błąd auto-ładowania:', err);
                }
            }
        }, 100);
    } else {
        showSection('builder');
    }
});
