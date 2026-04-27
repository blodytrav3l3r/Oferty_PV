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
        sessionStorage.setItem('user', JSON.stringify(currentUser));

        // Pobierz mapę wszystkich użytkowników dla list
        await fetchGlobalUsers();
    } catch (e) {
        window.location.href = 'index.html';
        return;
    }

    // Wyświetlenie danych w nagłówku
    const userEl = document.getElementById('header-username');
    const roleEl = document.getElementById('header-role-badge');
    const displayName =
        currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser.username;
    if (userEl) userEl.innerHTML = '<i data-lucide="user"></i> ' + displayName;
    if (roleEl) {
        roleEl.textContent =
            currentUser.role === 'admin' ? 'ADMIN' : currentUser.role === 'pro' ? 'PRO' : 'USER';
        if (currentUser.role === 'admin') {
            roleEl.style.background = 'rgba(245,158,11,0.15)';
            roleEl.style.color = '#f59e0b';
            roleEl.style.borderColor = 'rgba(245,158,11,0.3)';
        } else if (currentUser.role === 'pro') {
            roleEl.style.background = 'rgba(16,185,129,0.15)';
            roleEl.style.color = '#10b981';
            roleEl.style.borderColor = 'rgba(16,185,129,0.3)';
        }
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

    // Załadowanie danych z backendu
    try {
        studnieProducts = await loadStudnieProducts();
        offersStudnie = await loadOffersStudnie();
        ordersStudnie = await loadOrdersStudnie();
        try {
            productionOrders = await loadProductionOrders();
        } catch (e) {
            console.warn('Błąd ładowania zleceń:', e);
        }
        clientsDb = await loadClientsDb();
    } catch (err) {
        console.error('[AppStudnie] Krytyczny błąd ładowania danych:', err);
        showToast('Błąd inicjalizacji modułu.', 'error');
    }

    // Inicjalizacja UI
    if (typeof renderStudniePriceList === 'function') renderStudniePriceList();
    if (typeof renderSavedOffersStudnie === 'function') renderSavedOffersStudnie();
    checkBackendStatus();

    // Twórz domyślną studnię tylko gdy NIE edytujemy istniejącej oferty
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    const orderId = urlParams.get('order');

    if (!editId && !orderId) {
        createNewWell(1000);
        renderWellsList();
        selectWell(0);
    }

    // Nawigacja i Auto-ładowanie
    const tab = urlParams.get('tab');

    if (tab) {
        showSection(tab);
    } else if (orderId) {
        showSection('builder');
        // Wczytaj zamówienie do edycji
        if (typeof enterOrderEditMode === 'function') {
            await enterOrderEditMode(orderId);

            // Auto-otwarcie Zlecenia Produkcyjne po wczytaniu zamówienia
            if (urlParams.get('autoopen') === 'zlecenia') {
                const targetWellId = urlParams.get('wellId') || null;
                const targetElementIndex = urlParams.get('elementIndex') || null;
                if (typeof openZleceniaProdukcyjne === 'function') {
                    // enterOrderEditMode jest await — dane wells[] są już załadowane
                    // Czekamy tylko na DOM settle (requestAnimationFrame)
                    await waitForWellsAndOpen(targetWellId, targetElementIndex);
                }
            }
        } else {
            console.error('[AppStudnie] enterOrderEditMode nie jest dostępna');
            showToast('Błąd: nie można otworzyć zamówienia', 'error');
        }
    } else if (editId) {
        // offersStudnie is already loaded above — find the offer directly
        console.log('[AppStudnie] Szukanie oferty:', { editId, offersCount: offersStudnie.length, offersIds: offersStudnie.map(o => o.id) });
        const doc = offersStudnie.find((o) => String(o.id) === String(editId));
        const restoreIdx = urlParams.get('restore');

        if (!doc) {
            console.error('[AppStudnie] Nie znaleziono oferty o ID:', editId, 'w', offersStudnie.length, 'ofertach');
            showToast('Nie znaleziono oferty do edycji.', 'error');
            showSection('builder');
        } else {
            if (restoreIdx !== null && doc.history && doc.history[restoreIdx]) {
                console.log('[AppStudnie] Przywracanie wersji historycznej:', restoreIdx);
                window.loadSavedOfferStudnie(doc.history[restoreIdx], editId, 'builder');
                showToast('Wersja historyczna Studni załadowana');
            } else if (typeof window.loadSavedOfferStudnie === 'function') {
                window.loadSavedOfferStudnie(doc, editId, 'builder');
                showToast('Oferta Studni załadowana');

                if (urlParams.get('autoopen') === 'zlecenia') {
                    const targetWellId = urlParams.get('wellId') || null;
                    const targetElementIndex = urlParams.get('elementIndex') || null;
                    if (typeof openZleceniaProdukcyjne === 'function') {
                        // loadSavedOfferStudnie jest synchroniczne — wells[] jest gotowe
                        await waitForWellsAndOpen(targetWellId, targetElementIndex);
                    }
                }
            }
        }
    } else {
        showSection('builder');
    }
});

/**
 * Czeka aż tablica wells[] będzie załadowana, następnie otwiera modal zleceń.
 * Rozwiązuje problem race condition na wolnych serwerach (onrender.com cold start).
 * Zamiast sztywnego setTimeout(600ms), polling co 200ms z limitem 15 sekund.
 */
function waitForWellsAndOpen(targetWellId, targetElementIndex) {
    return new Promise((resolve) => {
        const MAX_WAIT_MS = 15000;
        const POLL_INTERVAL = 200;
        let elapsed = 0;

        function tryOpen() {
            if (wells.length > 0) {
                // Dodatkowe opóźnienie na DOM settle
                requestAnimationFrame(() => {
                    openZleceniaProdukcyjne(targetWellId, targetElementIndex);
                    resolve();
                });
                return;
            }

            elapsed += POLL_INTERVAL;
            if (elapsed >= MAX_WAIT_MS) {
                console.error(
                    '[waitForWellsAndOpen] Timeout — wells[] puste po',
                    MAX_WAIT_MS,
                    'ms'
                );
                showToast('Nie udało się załadować studni. Spróbuj odświeżyć stronę.', 'error');
                resolve();
                return;
            }

            setTimeout(tryOpen, POLL_INTERVAL);
        }

        tryOpen();
    });
}
