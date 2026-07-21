// @ts-check
/* ===== OPERACJE OFERTY — CRUD ===== */

/* Renderowanie oferty przeniesione do offerRendering.js */
/* Zapis oferty przeniesiony do offerSave.js */

function clearOfferForm() {
    editingOfferIdStudnie = null;
    editingOfferAssignedUserId = null;
    editingOfferAssignedUserName = '';
    editingOfferCreatedByUserId = null;
    editingOfferCreatedByUserName = '';
    clearOfferFormFields(generateOfferNumberStudnie);
    wells = [];
    wellCounter = 1;
    currentWellIndex = 0;
    wellDiscounts = {}; // Reset rabatow

    offerDefaultZakonczenie = null;
    offerDefaultRedukcja = false;
    offerDefaultRedukcjaMinH = 2500;
    offerDefaultRedukcjaZak = null;

    // Aktualizacja UI
    const titleEl = document.getElementById('offer-form-title-studnie');
    if (titleEl)
        titleEl.innerHTML = '<i data-lucide="clipboard-list"></i> Dane klienta i oferty (Nowa)';
    const btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = '<i data-lucide="save"></i> Zapisz oferte';

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        btnChangeUser.innerHTML = '<i data-lucide="user"></i> Zmien opiekuna';
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
async function loadSavedOfferStudnie(id_or_doc, optionalId, targetSection, preventStepOverride) {
    const sectionToShow = targetSection || 'offer';
    let offer;
    if (typeof id_or_doc === 'object') {
        offer = id_or_doc;
        if (optionalId && !offer.id) offer.id = optionalId;
    } else {
        offer = offersStudnie.find((o) => o.id === id_or_doc);
        if (!offer) {
            try {
                const { storageService } = await import('../shared/StorageService.js');
                offer = await storageService.getOfferById(id_or_doc);
            } catch (e) {
                showToast('Blad: Nie znaleziono oferty w bazie.', 'error');
                return;
            }
        }
    }

    if (!offer) return;

    // Normalizacja inline — storageService jest tylko ESM i nie jest dostepny w zasięgu globalnym
    const normalized = normalizeOfferData(offer);

    orderEditMode = null; // wyjdz z trybu zamowienia, jesli jest aktywny
    editingOfferIdStudnie = normalized.id || '';
    editingOfferAssignedUserId = normalized.userId || null;
    editingOfferAssignedUserName = normalized.userName || '';
    editingOfferCreatedByUserId = normalized.createdByUserId || null;
    editingOfferCreatedByUserName = normalized.createdByUserName || '';
    setOfferFormFields({
        number: normalized.number,
        date: normalized.date,
        clientName: normalized.clientName,
        clientNip: normalized.clientNip,
        clientAddress: normalized.clientAddress,
        clientContact: normalized.clientContact,
        investName: normalized.investName,
        investAddress: normalized.investAddress,
        investContractor: normalized.investContractor,
        notes: normalized.notes,
        paymentTerms: normalized.paymentTerms,
        validity: normalized.validity,
        transportKm: normalized.transportKm,
        transportRate: normalized.transportRate
    });
    currentTransportMode = normalized.transportMode || 'full';

    wellDiscounts = normalized.wellDiscounts ? structuredClone(normalized.wellDiscounts) : {};
    visiblePrzejsciaTypes = new Set(normalized.visiblePrzejsciaTypes || []);

    wells = structuredClone(normalized.wells || []);
    migrateWellData(wells);

    // Przelicz uszczelki i zsynchronizuj kinete dla wszystkich studni
    wells.forEach((w) => {
        if (typeof recalcGaskets === 'function') recalcGaskets(w);
        if (typeof syncKineta === 'function') syncKineta(w);
    });

    // Zawsze sprawdzaj, czy jakies przejscia juz sa fizycznie dodane w studniach
    // i automatycznie wlacz kategorie do widoku (aby nie trzeba bylo ich "wczytywac")
    wells.forEach((w) => {
        if (w.przejscia) {
            w.przejscia.forEach((pr) => {
                const prod = studnieProducts.find((p) => p.id === pr.productId);
                if (prod && prod.category) {
                    visiblePrzejsciaTypes.add(prod.category);
                }
            });
        }
    });

    currentWellIndex = 0;

    // Przywroc domyslne parametry poziomu oferty z wczytanych studni
    if (wells.length > 0) {
        const lastWell = wells[wells.length - 1];
        offerDefaultZakonczenie = lastWell.zakonczenie || null;
        offerDefaultRedukcja = lastWell.redukcjaDN1000 || false;
        offerDefaultRedukcjaMinH = lastWell.redukcjaMinH || 2500;
        offerDefaultRedukcjaZak = lastWell.redukcjaZakonczenie || null;
    } else {
        offerDefaultZakonczenie = null;
        offerDefaultRedukcja = false;
        offerDefaultRedukcjaMinH = 2500;
        offerDefaultRedukcjaZak = null;
    }

    refreshAll();

    restoreWizardState(normalized.wizard, preventStepOverride);

    showSection(sectionToShow);
    showToast('Wczytano oferte: ' + (normalized.number || offer.id), 'info');

    updateOfferFormHeader(normalized.number || offer.id, offer.id);
}

// Globalne udostepnienie
window.loadSavedOfferStudnie = loadSavedOfferStudnie;

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
});
