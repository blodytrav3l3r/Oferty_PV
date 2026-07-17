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
                showToast('Błąd: Nie znaleziono oferty w bazie.', 'error');
                return;
            }
        }
    }

    if (!offer) return;

    // Normalizacja inline — storageService jest tylko ESM i nie jest dostępny w zasięgu globalnym
    const normalized = normalizeOfferData(offer);

    orderEditMode = null; // wyjdź z trybu zamówienia, jeśli jest aktywny
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
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';

    const tabPayment = document.getElementById('offer-tab-payment-terms');
    if (tabPayment)
        tabPayment.value =
            normalized.paymentTerms ||
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';

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

    // Przelicz uszczelki i zsynchronizuj kinetę dla wszystkich studni
    wells.forEach((w) => {
        if (typeof recalcGaskets === 'function') recalcGaskets(w);
        if (typeof syncKineta === 'function') syncKineta(w);
    });

    // Zawsze sprawdzaj, czy jakieś przejścia już są fizycznie dodane w studniach
    // i automatycznie włącz kategorię do widoku (aby nie trzeba było ich "wczytywać")
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

    // Przywróć domyślne parametry poziomu oferty z wczytanych studni
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

    // Przywróć stan kroku 2 (Ogólne parametry studni) z zapisanego stanu kreatora
    let wizardState = normalized.wizard;
    let wizardGlobalParams = wizardState && wizardState.globalParams;
    if (wizardGlobalParams) {
        // Nowa oferta z zapisanym stanem — pełna restauracja kafelków
        document.querySelectorAll('#wizard-step-2 .param-group').forEach(function (group) {
            let paramName = group.getAttribute('data-param');
            if (!paramName || !wizardGlobalParams.hasOwnProperty(paramName)) return;
            let val = wizardGlobalParams[paramName];
            if (!val) return;
            group.querySelectorAll('.param-tile').forEach(function (b) {
                b.classList.remove('active');
            });
            let targetTile = group.querySelector('.param-tile[data-val="' + val + '"]');
            if (targetTile) targetTile.classList.add('active');
            if (typeof wizardConfirmedParams !== 'undefined') {
                wizardConfirmedParams.add(paramName);
            }
        });
        // Obsługa wkładki PEHD (sub-opcje)
        let wkladkaV = wizardGlobalParams.wkladka;
        let subOpts = document.getElementById('wkladka-sub-options');
        if (wkladkaV && wkladkaV !== 'brak') {
            if (subOpts) subOpts.style.display = 'block';
            let cbDennica = document.getElementById('pehd-dennica');
            let cbNadbudowa = document.getElementById('pehd-nadbudowa');
            let cbZwienczenie = document.getElementById('pehd-zwienczenie');
            if (cbDennica) cbDennica.checked = wizardGlobalParams.wkladkaDennica === wkladkaV;
            if (cbNadbudowa) cbNadbudowa.checked = wizardGlobalParams.wkladkaNadbudowa === wkladkaV;
            if (cbZwienczenie)
                cbZwienczenie.checked = wizardGlobalParams.wkladkaZwienczenie === wkladkaV;
        } else {
            if (subOpts) subOpts.style.display = 'none';
        }
        // Pola tekstowe (powloka, ceny malowania)
        if (document.getElementById('powloka-name-w'))
            document.getElementById('powloka-name-w').value = wizardGlobalParams.powlokaNameW || '';
        if (document.getElementById('malowanie-wew-cena'))
            document.getElementById('malowanie-wew-cena').value =
                wizardGlobalParams.malowanieWewCena || '';
        if (document.getElementById('powloka-name-z'))
            document.getElementById('powloka-name-z').value = wizardGlobalParams.powlokaNameZ || '';
        if (document.getElementById('malowanie-zew-cena'))
            document.getElementById('malowanie-zew-cena').value =
                wizardGlobalParams.malowanieZewCena || '';
    } else {
        // Oferta legacy (bez zapisanego stanu kreatora)
        // Nie przywracamy kafelków z danych studni — byłyby niespójne.
        // wizardConfirmedParams zostanie wypełniony poniżej przez skipWizardToStep3.
        let legacyBanner = document.getElementById('wizard-legacy-banner');
        if (legacyBanner) {
            legacyBanner.style.display = 'flex';
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: legacyBanner });
        }
    }

    if (typeof validateWizardStep2 === 'function') {
        validateWizardStep2();
    }

    // Pomiń kreatora dla wczytanych ofert — przejdź bezpośrednio do widoku oferty (chyba że zablokowano)
    if (!preventStepOverride) {
        if (typeof skipWizardToStep3 === 'function') skipWizardToStep3();
    } else {
        if (typeof wizardConfirmedParams !== 'undefined') {
            wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
        }
    }

    showSection(sectionToShow);
    showToast('Wczytano ofertę: ' + (normalized.number || offer.id), 'info');

    // Aktualizacja UI (nagłówki i przyciski)
    const titleEl = document.getElementById('offer-form-title-studnie');
    if (titleEl)
        titleEl.innerHTML =
            '<i data-lucide="pencil"></i> Edycja Oferty: <span style="font-weight:700">' +
            escapeHtml(normalized.number || offer.id) +
            '</span>';
    const btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = '<i data-lucide="save"></i> Zapisz ofertę';

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        if (editingOfferAssignedUserName) {
            btnChangeUser.innerHTML =
                '<i data-lucide="user"></i> Opiekun: ' + escapeHtml(editingOfferAssignedUserName);
        } else {
            btnChangeUser.innerHTML = '<i data-lucide="user"></i> Zmień opiekuna';
        }
    }

    // Pokaż baner blokady, jeśli oferta ma zamówienie
    if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();
    if (typeof window.updateTransportCostSummary === 'function')
        window.updateTransportCostSummary();
}

// Globalne udostępnienie
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
