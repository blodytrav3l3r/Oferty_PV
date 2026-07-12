function clearOfferForm() {
    editingOfferIdStudnie = null;
    editingOfferAssignedUserId = null;
    editingOfferAssignedUserName = '';
    editingOfferCreatedByUserId = null;
    editingOfferCreatedByUserName = '';
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('offer-number', generateOfferNumberStudnie());
    setVal('offer-date', new Date().toISOString().slice(0, 10));
    setVal('client-name', '');
    setVal('client-nip', '');
    setVal('client-address', '');
    setVal('client-contact', '');
    setVal('invest-name', '');
    setVal('invest-address', '');
    setVal('invest-contractor', '');
    setVal('offer-notes', '');
    const tabNotes = document.getElementById('offer-tab-notes');
    if (tabNotes) tabNotes.value = '';

    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';

    const tabPayment = document.getElementById('offer-tab-payment-terms');
    if (tabPayment)
        tabPayment.value = 'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = '7 dni';
    const tabValidity = document.getElementById('offer-tab-validity');
    if (tabValidity) tabValidity.value = '7 dni';
    setVal('transport-km', '100');
    setVal('transport-rate', '10');
    wells = [];
    wellCounter = 1;
    currentWellIndex = 0;
    wellDiscounts = {}; // Reset rabatów

    offerDefaultZakonczenie = null;
    offerDefaultRedukcja = false;
    offerDefaultRedukcjaMinH = 2500;
    offerDefaultRedukcjaZak = null;

    // Aktualizacja UI
    const titleEl = document.getElementById('offer-form-title-studnie');
    if (titleEl)
        titleEl.innerHTML = '<i data-lucide="clipboard-list"></i> Dane klienta i oferty (Nowa)';
    const btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = '<i data-lucide="save"></i> Zapisz ofertę';

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        btnChangeUser.innerHTML = '<i data-lucide="user"></i> Zmień opiekuna';
    }

    refreshAll();
    showSection('builder');
    renderOfferSummary();
    if (typeof window.updateTransportCostSummary === 'function')
        window.updateTransportCostSummary();
    // Reset kreatora do kroku 1
    wizardConfirmedParams = new Set();
    goToWizardStep(1);
}

/** Migruj stare dane studni (material -> nadbudowa/dennicaMaterial) */
function migrateWellData(wellsArr) {
    if (!wellsArr) return wellsArr;
    wellsArr.forEach((w) => {
        // Migruj stare pole 'material' do nowych 'nadbudowa' + 'dennicaMaterial'
        if (w.material && !w.nadbudowa) {
            w.nadbudowa = w.material;
        }
        if (w.material && !w.dennicaMaterial) {
            w.dennicaMaterial = w.material;
        }
        // Zapewnij wartości domyślne
        if (!w.nadbudowa) w.nadbudowa = 'betonowa';
        if (!w.dennicaMaterial) w.dennicaMaterial = 'betonowa';
        if (!w.klasaNosnosci_korpus) w.klasaNosnosci_korpus = 'D400';
        if (!w.klasaNosnosci_zwienczenie) w.klasaNosnosci_zwienczenie = 'D400';
        // Zapewnij istnienie tablic config i przejscia
        if (!Array.isArray(w.config)) w.config = [];
        if (!Array.isArray(w.przejscia)) w.przejscia = [];
    });
    return wellsArr;
}

// Nasłuchiwanie zmian statusu synchronizacji dla odświeżenia listy
window.addEventListener('pv-sync-status-changed', () => {
    // Jeśli widżet zapisu ofert jest widoczny, odświeżamy go
    const container = document.getElementById('saved-offers-list');
    if (container && container.offsetParent !== null) {
        renderSavedOffersStudnie();
    }
});

/* ===== WYBÓR STUDNI DO ZAMÓWIENIA ===== */

/** Zaznacza/odznacza wszystkie dostępne studnie w tabeli podsumowania */
function toggleAllWellsForOrder(checked) {
    const checkboxes = document.querySelectorAll('.well-order-checkbox');
    checkboxes.forEach((cb) => {
        cb.checked = checked;
    });
    updateOrderSelectionCount();
}

/** Aktualizuje licznik zaznaczonych studni (opcjonalnie do logiki UI w przyszłości) */
function updateOrderSelectionCount() {
    const count = document.querySelectorAll('.well-order-checkbox:checked').length;
    const total = document.querySelectorAll('.well-order-checkbox').length;

    // Zaktualizuj stan nagłówkowego checkboxa
    const headerCheckbox = document.getElementById('select-all-wells-for-order');
    if (headerCheckbox) {
        headerCheckbox.checked = count > 0 && count === total;
        headerCheckbox.indeterminate = count > 0 && count < total;
    }
}

window.toggleAllWellsForOrder = toggleAllWellsForOrder;
window.updateOrderSelectionCount = updateOrderSelectionCount;

document.addEventListener('DOMContentLoaded', function () {
    let _syncingValidity = false;
    let _syncingPaymentTerms = false;

    function syncValidity(src, dst) {
        if (_syncingValidity) return;
        _syncingValidity = true;
        dst.value = normalizeValidityValue(src.value);
        _syncingValidity = false;
    }

    function syncPaymentTerms(src, dst) {
        if (_syncingPaymentTerms) return;
        _syncingPaymentTerms = true;
        dst.value = src.value;
        _syncingPaymentTerms = false;
    }

    const wizardValidity = document.getElementById('offer-validity');
    const tabValidity = document.getElementById('offer-tab-validity');

    if (wizardValidity && tabValidity) {
        wizardValidity.addEventListener('input', function () {
            syncValidity(this, tabValidity);
        });
        tabValidity.addEventListener('input', function () {
            syncValidity(this, wizardValidity);
        });
        wizardValidity.addEventListener('blur', function () {
            this.value = normalizeValidityValue(this.value);
        });
        tabValidity.addEventListener('blur', function () {
            this.value = normalizeValidityValue(this.value);
        });
    }

    const wizardPayment = document.getElementById('offer-payment-terms');
    const tabPayment = document.getElementById('offer-tab-payment-terms');

    if (wizardPayment && tabPayment) {
        wizardPayment.addEventListener('input', function () {
            syncPaymentTerms(this, tabPayment);
        });
        tabPayment.addEventListener('input', function () {
            syncPaymentTerms(this, wizardPayment);
        });
    }

    // Enter → blur for offer-discount-input (CSP-safe, inline handler replacement)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.matches('.offer-discount-input')) {
            e.target.blur();
        }
    });

    // Focus → dataset backup + clear for offer-discount-input (CSP-safe)
    document.addEventListener('focusin', function (e) {
        if (e.target.matches('.offer-discount-input')) {
            e.target.dataset.oldValue = e.target.value;
            e.target.value = '';
        }
    });

    // focusin/focusout dla wrappera rabatu (CSP-safe)
    document.addEventListener('focusin', function (e) {
        var w = e.target.closest('[data-discount-wrapper]');
        if (w) {
            w.style.borderColor = w.dataset.accent;
            w.style.boxShadow = '0 0 10px ' + w.dataset.border;
        }
    });
    document.addEventListener('focusout', function (e) {
        var w = e.target.closest('[data-discount-wrapper]');
        if (w) {
            w.style.borderColor = w.dataset.border;
            w.style.boxShadow = 'none';
        }
    });

    // CSS hover dla kart oferty
    (function () {
        var s = document.createElement('style');
        s.textContent =
            '.offer-card-hover:hover{border-color:rgba(var(--accent-rgb),0.2)!important}';
        document.head.appendChild(s);
    })();
});

/* CSP Actions registrations */
if (typeof registerCspAction === 'function') {
    registerCspAction('changeOfferUserFromListStudnie', {
        handler: function ({ offerId }) {
            changeOfferUserFromListStudnie(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('loadSavedOfferStudnie', {
        handler: function ({ offerId }) {
            loadSavedOfferStudnie(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('deleteOfferStudnie', {
        handler: function ({ offerId }) {
            deleteOfferStudnie(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('exportJSONStudnie', {
        handler: function ({ offerId }) {
            exportJSONStudnie(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('showOfferHistoryStudnie', {
        handler: function ({ offerId }) {
            showOfferHistoryStudnie(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('restoreHistorySnapshot', {
        handler: function ({ logId }) {
            restoreHistorySnapshot(logId);
        },
        params: ['logId']
    });
    registerCspAction('viewHistorySnapshot', {
        handler: function ({ logId }) {
            viewHistorySnapshot(logId);
        },
        params: ['logId']
    });
    registerCspAction('toggleAllWellsForOrder', function (t) {
        toggleAllWellsForOrder(t.checked);
    });
    registerCspAction('updateOrderSelectionCount', function (t) {
        updateOrderSelectionCount();
    });
    registerCspAction('handleOfferPehdDiscountChange', function (t) {
        handleOfferPehdDiscountChange(t.value);
    });
    registerCspAction('handlePaintingCostChange', function (t) {
        handleOfferPaintingCostChange(t.dataset.field, t.value);
    });
    registerCspAction('saveOrderOrOfferStudnie', function () {
        if (orderEditMode) {
            if (typeof saveCurrentOrder === 'function') saveCurrentOrder();
        } else {
            if (typeof saveOrderStudnie === 'function') saveOrderStudnie();
        }
    });
    registerCspAction('toggleWellExpansion', {
        handler: function (params, target, e) {
            var idx = parseInt(params.wellIndex, 10);
            if (!isNaN(idx)) toggleWellExpansion(idx, e);
        },
        params: ['wellIndex']
    });
    registerCspAction('stopPropagation', function () {});
    registerCspAction('editWell', function (t) {
        var idx = parseInt(t.dataset.wellIndex, 10);
        if (!isNaN(idx)) {
            showSection('builder');
            selectWell(idx);
        }
    });
    registerCspAction('navigateToOrder', function (t) {
        var orderId = t.dataset.orderId;
        if (orderId) window.location.href = 'studnie.html?order=' + orderId;
    });
    registerCspAction('showUniversalPrintModal', function (t) {
        var offerId = t.dataset.offerId;
        if (offerId && window.showUniversalPrintModal) window.showUniversalPrintModal(offerId);
    });
    registerCspAction('handleOfferDiscountBlur', function (t) {
        if (t.value === '') {
            t.value = t.dataset.oldValue || '';
        } else {
            handleOfferDiscountChange(t.dataset.dn, t.dataset.type, t.value);
        }
    });
    registerCspAction('loadMoreAuditLogs', {
        handler: function ({ entityType, entityId, limit }) {
            loadMoreAuditLogs(entityType, entityId, parseInt(limit, 10) || 20);
        },
        params: ['entityType', 'entityId', 'limit']
    });
}
