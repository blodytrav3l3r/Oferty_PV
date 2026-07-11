// @ts-check
/* ============================
   WITROS — Kalkulator Studni
   app_studnie.js  (Orchestrator - Entry Point)
   ============================ */

window.__STUDNIE_APP_ORCHESTRATOR__ = true;

/**
 * Rejestruje wszystkie akcje CSP (data-action dispatcher).
 * Wyodrębniona do osobnej funkcji, by zapewnić rejestrację przed
 * każdym wczesnym returnem — zwłaszcza w ścieżce "nowa oferta".
 */
function registerCspActions() {
    if (typeof registerCspAction !== 'function') return;
    registerCspAction('logout', appLogout);
    registerCspAction('show-section', {
        handler: function (p) {
            showSection(p.section);
        },
        params: ['section']
    });
    registerCspAction('wizard-nav', {
        handler: function (p) {
            wizardNavStep(Number(p.step));
        },
        params: ['step']
    });
    registerCspAction('wizard-next', wizardNext);
    registerCspAction('wizard-prev', wizardPrev);
    registerCspAction('goto-wizard-step', {
        handler: function (p) {
            goToWizardStep(Number(p.step));
        },
        params: ['step']
    });
    registerCspAction('select-dn', {
        handler: function (p) {
            selectDN(p.dn);
        },
        params: ['dn']
    });
    registerCspAction('input-select', function (t) {
        _cspInputSelect(t);
    });
    registerCspAction('toggle-auto-lock', toggleAutoLock);
    registerCspAction('toggle-redukcja', toggleRedukcja);
    registerCspAction('toggle-psia-buda', togglePsiaBuda);
    registerCspAction('toggle-styczna-1200', toggleStyczna1200);
    registerCspAction('toggle-card', {
        handler: function (p) {
            toggleCard(p.id);
        },
        params: ['id']
    });
    registerCspAction('switch-builder-tab', {
        handler: function (p) {
            switchBuilderTab(p.tab);
        },
        params: ['tab']
    });
    registerCspAction('cennik-tab', {
        handler: function (p) {
            selectCennikTab(p.tab);
        },
        params: ['tab']
    });
    registerCspAction('auto-select-components', function () {
        autoSelectComponents(true);
    });
    registerCspAction('clear-well-config', function () {
        clearWellConfig();
    });
    registerCspAction('copy-karta-budowy', function () {
        copyKartaBudowyFromOrder();
    });
    registerCspAction('remove-well', function () {
        removeCurrentWell();
    });
    registerCspAction('add-custom-przejscie', function () {
        addCustomPrzejscieRow();
    });
    registerCspAction('show-add-studnie-product-modal', function () {
        showAddStudnieProductModal();
    });
    registerCspAction('save-studnie-price-list', function () {
        saveStudniePriceList();
    });
    registerCspAction('export-studnie-excel', function () {
        exportStudnieToExcel();
    });
    registerCspAction('import-studnie-excel', function () {
        document.getElementById('import-studnie-excel').click();
    });
    registerCspAction('apply-global-params', function () {
        applyGlobalParamsToAllWells();
    });
    registerCspAction('save-offer-studnie', function () {
        saveOfferStudnie();
    });
    registerCspAction('save-current-order', function () {
        saveCurrentOrder();
    });
    registerCspAction('handle-print-click', function () {
        handlePrintClick();
    });
    registerCspAction('create-order-from-offer', function () {
        createOrderFromOffer();
    });
    registerCspAction('open-zlecenia-produkcyjne', function () {
        openZleceniaProdukcyjne();
    });
    registerCspAction('add-new-well', {
        handler: function (p) {
            addNewWell(p.dn === 'styczna' ? 'styczna' : Number(p.dn));
        },
        params: ['dn']
    });
    registerCspAction('switch-sidebar-tab', {
        handler: function (p) {
            switchSidebarTab(p.tab);
        },
        params: ['tab']
    });
    registerCspAction('generate-offer-notes', function () {
        generateOfferNotes();
    });
    registerCspAction('open-transport-popup', function () {
        openTransportPopup();
    });
    registerCspAction('open-offer-discounts-popup', function () {
        openOfferDiscountsPopup();
    });
    registerCspAction('show-offer-export-choice', function () {
        showOfferExportChoice();
    });
    registerCspAction('reset-studnie-price-list', function () {
        resetStudniePriceList();
    });
    registerCspAction('close-offer-discounts-popup', function () {
        closeOfferDiscountsPopup();
    });
    registerCspAction('handle-offer-discounts-cancel', function () {
        handleOfferDiscountsCancel();
    });
    registerCspAction('handle-offer-discounts-save', function () {
        handleOfferDiscountsSave();
    });
    registerCspAction('handle-offer-transport-cancel', function () {
        handleOfferTransportCancel();
    });
    registerCspAction('handle-offer-transport-save', function () {
        handleOfferTransportSave();
    });
    registerCspAction('toggle-transport-mode', function () {
        toggleTransportMode();
    });
    registerCspAction('open-bulk-order-sequence-popup', function () {
        openBulkOrderSequencePopup();
    });
    registerCspAction('accept-production-order', function () {
        acceptProductionOrder();
    });
    registerCspAction('revoke-production-order', function () {
        revokeProductionOrder();
    });
    registerCspAction('delete-selected-production-order', function () {
        deleteSelectedProductionOrder();
    });
    registerCspAction('save-production-order', function () {
        saveProductionOrder();
    });
    registerCspAction('print-zlecenie', function () {
        printZlecenie();
    });
    registerCspAction('print-etykieta', function () {
        printEtykieta();
    });
    registerCspAction('close-zlecenia-modal', function () {
        closeZleceniaModal();
    });
    registerCspAction('set-zlecenia-filter', {
        handler: function (p) {
            setZleceniaFilter(p.filter);
        },
        params: ['filter']
    });
    registerCspAction('open-excel-table-modal', function () {
        openExcelTableModal();
    });
    registerCspAction('open-global-recalc-modal', function () {
        openGlobalRecalcModal();
    });
    registerCspAction('open-transition-manager-modal', function () {
        openTransitionManagerModal();
    });
    registerCspAction('sanitize-numeric', function (t) {
        t.value = t.value.replace(/[^0-9]/g, '');
    });
    registerCspAction('validate-wizard-step2', function () {
        validateWizardStep2();
    });
    registerCspAction('update-param-input', function (t) {
        var param = t.dataset.param;
        if (param) updateParamInput(param, t.value);
    });
    registerCspAction('handle-przejscia-zamowione-change', function (t) {
        handlePrzejsciaZamowioneChange(t);
    });
    registerCspAction('import-studnie-from-excel', function (t) {
        importStudnieFromExcel(t);
    });
    registerCspAction('render-wells-list', function () {
        renderWellsList();
    });
    registerCspAction('toggle-inne-display', function (t) {
        var id = t.dataset.inneId || t.closest('[data-inne-id]')?.dataset.inneId;
        if (id) toggleInneDisplay(id);
    });
    registerCspAction('sync-transport-from-modal', function () {
        if (typeof syncTransportFromModal === 'function') syncTransportFromModal();
    });
    registerCspAction('filter-zlecenia-list', function () {
        filterZleceniaList();
    });
    registerCspAction('redukcja-min-change', function (t) {
        onRedukcjaMinChange(t.value);
    });
    registerCspAction('drag-drop-well', function (t, p, ev) {
        if (ev.type === 'dragover') {
            ev.preventDefault();
            allowDropWellComponent(ev);
        } else if (ev.type === 'dragleave') dragLeaveWellComponent(ev);
        else if (ev.type === 'drop') {
            ev.preventDefault();
            dropWellComponent(ev);
        }
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
}

/**
 * Zdarzenie DOMContentLoaded do inicjalizacji całej aplikacji.
 * UWAGA: Logika i główne zmienne znajdują się teraz w osobnych plikach w `public/js/studnie/`
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Sprawdzenie autoryzacji
    try {
        const authRes = await fetchWithTimeout('/api/auth/me', { headers: authHeaders() });
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
    if (userEl) userEl.innerHTML = '<i data-lucide="user"></i> ' + escapeHtml(displayName);
    if (roleEl) {
        roleEl.textContent =
            currentUser.role === 'admin' ? 'ADMIN' : currentUser.role === 'pro' ? 'PRO' : 'USER';
        if (currentUser.role === 'admin') {
            roleEl.classList.add('role-admin');
        } else if (currentUser.role === 'pro') {
            roleEl.classList.add('role-pro');
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

    // URL params
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    const orderId = urlParams.get('order');
    const tab = urlParams.get('tab');

    // CSP actions MUST be registered before any early return.
    // New-offer path below also depends on data-action handlers.
    registerCspActions();

    // NOWA OFERTA: twórz studnię i UI NATYCHMIAST, dane ładuj w tle
    if (!editId && !orderId) {
        showSection(tab || 'builder');

        // Inicjalizacja UI (bez danych — będą gotowe za chwilę)
        if (typeof renderStudniePriceList === 'function') renderStudniePriceList();
        if (typeof renderSavedOffersStudnie === 'function') renderSavedOffersStudnie();

        // Auto-uzupełnienie daty i numeru oferty w kroku 1
        const dateEl = document.getElementById('offer-date');
        if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
        const nrEl = document.getElementById('offer-number');
        if (nrEl && typeof generateOfferNumberStudnie === 'function')
            nrEl.value = generateOfferNumberStudnie();

        createNewWell(null, 1000);
        renderWellsList();
        selectWell(0);
        goToWizardStep(1);
        if (typeof setupParamTiles === 'function') setupParamTiles();
        document.documentElement.classList.remove('wizard-loading-state');

        // Dane ładuj w tle — nie blokuje UI
        loadDataInBackground();
        return;
    }

    // EDYCJA / ZAMÓWIENIE: najpierw dane, potem UI
    showSection(tab || 'builder');
    await loadDataInBackground();
    document.documentElement.classList.remove('wizard-loading-state');

    if (orderId) {
        if (ordersStudnie.length === 0) {
            logger.warn(
                'appStudnie',
                '[AppStudnie] Zamówienia nie załadowały się za pierwszym razem, ponawiam...'
            );
            ordersStudnie = await loadOrdersStudnie();
        }
        if (typeof enterOrderEditMode === 'function') {
            await enterOrderEditMode(orderId);
            if (urlParams.get('autoopen') === 'zlecenia') {
                const targetWellId = urlParams.get('wellId') || null;
                const targetElementIndex = urlParams.get('elementIndex') || null;
                if (typeof openZleceniaProdukcyjne === 'function') {
                    await waitForWellsAndOpen(targetWellId, targetElementIndex);
                }
            }
        } else {
            logger.error('appStudnie', '[AppStudnie] enterOrderEditMode nie jest dostępna');
            showToast('Błąd: nie można otworzyć zamówienia', 'error');
        }
    } else if (editId) {
        let doc = offersStudnie.find((o) => String(o.id) === String(editId));
        if (!doc && offersStudnie.length === 0) {
            logger.warn(
                'appStudnie',
                '[AppStudnie] Oferty nie załadowały się za pierwszym razem, ponawiam...'
            );
            offersStudnie = await loadOffersStudnie();
            doc = offersStudnie.find((o) => String(o.id) === String(editId));
        }
        const restoreIdx = urlParams.get('restore');

        if (!doc) {
            logger.error(
                'appStudnie',
                '[AppStudnie] Nie znaleziono oferty o ID:',
                editId,
                'w',
                offersStudnie.length,
                'ofertach'
            );
            showToast('Nie znaleziono oferty do edycji.', 'error');
            showSection('builder');
        } else {
            if (restoreIdx !== null && doc.history && doc.history[restoreIdx]) {
                window.loadSavedOfferStudnie(doc.history[restoreIdx], editId, 'builder');
                showToast('Wersja historyczna Studni załadowana');
            } else if (typeof window.loadSavedOfferStudnie === 'function') {
                window.loadSavedOfferStudnie(doc, editId, 'builder');
                showToast('Oferta Studni załadowana');
                if (urlParams.get('autoopen') === 'zlecenia') {
                    const targetWellId = urlParams.get('wellId') || null;
                    const targetElementIndex = urlParams.get('elementIndex') || null;
                    if (typeof openZleceniaProdukcyjne === 'function') {
                        await waitForWellsAndOpen(targetWellId, targetElementIndex);
                    }
                }
            }
        }
    }

    // Direct event listeners for well input fields (CSP-safe, no inline handlers)
    var _el;
    _el = document.getElementById('input-well-numer');
    if (_el) _el.addEventListener('input', updateWellNumer);

    _el = document.getElementById('input-rzedna-wlazu');
    if (_el) {
        _el.addEventListener('focusout', function () {
            resolveFieldValue(this);
            updateElevations();
        });
        _el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') this.blur();
        });
    }

    _el = document.getElementById('input-rzedna-dna');
    if (_el) {
        _el.addEventListener('focusout', function () {
            resolveFieldValue(this);
            updateElevations();
        });
        _el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') this.blur();
        });
    }

    _el = document.getElementById('input-doplata');
    if (_el) {
        _el.addEventListener('focusout', function () {
            resolveFieldValue(this);
            updateDoplata();
        });
        _el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') this.blur();
        });
    }

    // svg-trash drag-feedback hover (mouseenter/mouseleave not dispatched by cspActions)
    _el = document.getElementById('svg-trash');
    if (_el) {
        _el.addEventListener('mouseenter', function () {
            if (window.svgDragStartIndex >= 0) {
                this.style.background = 'rgba(239,68,68,0.3)';
                this.style.borderColor = '#ef4444';
            }
        });
        _el.addEventListener('mouseleave', function () {
            this.style.background = 'rgba(239,68,68,0.1)';
            this.style.borderColor = 'rgba(239,68,68,0.4)';
        });
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
                logger.error(
                    'appStudnie',
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

/**
 * Ładuje dane w tle (produkty, oferty, zamówienia, klienci, cennik).
 * Każde load* ma wewnątrz fetchWithTimeout + fallback — ZAWSZE zwraca dane, nigdy nie wisi.
 */
async function loadDataInBackground() {
    const [productsP, offersP, ordersP, prodOrdersP, clientsP, precoP] = await Promise.allSettled([
        loadStudnieProducts(),
        loadOffersStudnie(),
        loadOrdersStudnie(),
        loadProductionOrders(),
        loadClientsDb(),
        loadPrecoPricing()
    ]);

    if (productsP.status === 'fulfilled') {
        studnieProducts = productsP.value;
    } else {
        logger.error('appStudnie', '[AppStudnie] Błąd produktów:', productsP.reason);
    }

    if (offersP.status === 'fulfilled') {
        offersStudnie = offersP.value;
    } else {
        logger.error('appStudnie', '[AppStudnie] Błąd ofert:', offersP.reason);
    }

    if (ordersP.status === 'fulfilled') {
        ordersStudnie = ordersP.value;
    } else {
        logger.error('appStudnie', '[AppStudnie] Błąd zamówień:', ordersP.reason);
    }

    if (prodOrdersP.status === 'fulfilled') {
        productionOrders = prodOrdersP.value;
    } else {
        logger.warn('appStudnie', '[AppStudnie] Błąd zleceń produkcyjnych:', prodOrdersP.reason);
    }

    if (clientsP.status === 'fulfilled') {
        AppState.clientsDb = clientsP.value;
    } else {
        logger.warn('appStudnie', '[AppStudnie] Błąd klientów:', clientsP.reason);
    }

    if (precoP.status === 'fulfilled') {
        /* ustawione wewnątrz loadPrecoPricing */
    } else {
        logger.warn('appStudnie', '[AppStudnie] Błąd cennika PRECO:', precoP.reason);
    }

    // Odśwież UI z nowymi danymi
    if (typeof renderStudniePriceList === 'function') renderStudniePriceList();
    if (typeof renderSavedOffersStudnie === 'function') renderSavedOffersStudnie();

    // Aktualizuj numer oferty po załadowaniu rzeczywistej liczby ofert
    if (typeof generateOfferNumberStudnie === 'function') {
        const nrEl = document.getElementById('offer-number');
        if (nrEl) nrEl.value = generateOfferNumberStudnie();
    }

    // Jeśli studnia ma już ustawione rzędne, ale config jest pusty → auto-dobór
    if (typeof getCurrentWell === 'function') {
        const w = getCurrentWell();
        if (
            w &&
            w.rzednaWlazu != null &&
            w.rzednaDna != null &&
            (!w.config || w.config.length === 0) &&
            studnieProducts.length > 0
        ) {
            logger.info(
                'appStudnie',
                '[AppStudnie] Dane załadowane — uruchamiam auto-dobór dla istniejącej studni.'
            );
            if (typeof autoSelectComponents === 'function') autoSelectComponents(true);
        }
    }
    if (typeof refreshAll === 'function') refreshAll();
    if (typeof buildZleceniaWellList === 'function') buildZleceniaWellList();
    logger.info('appStudnie', '[AppStudnie] Dane załadowane, UI odświeżone.');
}
