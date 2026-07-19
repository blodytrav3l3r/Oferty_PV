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
            'Do uzgodnienia lub wedlug indywidualnych warunkow handlowych.';

    const tabPayment = document.getElementById('offer-tab-payment-terms');
    if (tabPayment)
        tabPayment.value = 'Do uzgodnienia lub wedlug indywidualnych warunkow handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = '7 dni';
    const tabValidity = document.getElementById('offer-tab-validity');
    if (tabValidity) tabValidity.value = '7 dni';
    setVal('transport-km', '100');
    setVal('transport-rate', '10');
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
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('offer-number', normalized.number || '');
    setVal('offer-date', normalized.date || new Date().toISOString().slice(0, 10));
    setVal('client-name', normalized.clientName || '');
    setVal('client-nip', normalized.clientNip || '');
    setVal('client-address', normalized.clientAddress || '');
    setVal('client-contact', normalized.clientContact || '');
    setVal('invest-name', normalized.investName || '');
    setVal('invest-address', normalized.investAddress || '');
    setVal('invest-contractor', normalized.investContractor || '');

    setVal('offer-notes', normalized.notes || '');
    const tabNotes = document.getElementById('offer-tab-notes');
    if (tabNotes) tabNotes.value = normalized.notes || '';

    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            normalized.paymentTerms ||
            'Do uzgodnienia lub wedlug indywidualnych warunkow handlowych.';

    const tabPayment = document.getElementById('offer-tab-payment-terms');
    if (tabPayment)
        tabPayment.value =
            normalized.paymentTerms ||
            'Do uzgodnienia lub wedlug indywidualnych warunkow handlowych.';

    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = normalized.validity || '7 dni';

    const tabValidity = document.getElementById('offer-tab-validity');
    if (tabValidity) tabValidity.value = normalized.validity || '7 dni';
    setVal('transport-km', normalized.transportKm ?? 100);
    setVal('transport-rate', normalized.transportRate ?? 10);
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
