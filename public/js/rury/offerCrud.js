// @ts-check
/* ===== CRUD OFERT (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: zapis, ładowanie, duplikacja, usuwanie, historia ofert */
/* Zależności: offers, currentOfferItems, editingOfferId, editingOfferAssignedUserId/Name, currentUser (globalne) */

var editingOfferCreatedByUserId = null;
var editingOfferCreatedByUserName = '';
var isSavingOffer = false;
/* calculateTransports, calculateTransportDistributionStandalone z transport.js */
/* renderOfferItems, generateOfferNumber z offerItems.js */
/* showToast, appConfirm, closeModal z shared/ui.js; authHeaders z shared/auth.js; fmt z shared/formatters.js */

/* ===== POBIERANIE PLIKU OFERTY ===== */

function downloadOfferFile(offer) {
    const json = JSON.stringify(offer, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeNumber = offer.number.replace(/[/\\:*?"<>|]/g, '_');
    a.href = url;
    a.download = `Oferta_${safeNumber}_${offer.date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ===== ZAPIS OFERTY ===== */

async function saveOffer() {
    if (window.orderEditMode) {
        showToast('Edycja oferty zablokowana w trybie edycji zamówienia', 'warning');
        return;
    }
    if (isSavingOffer) return;
    const numEl = document.getElementById('offer-number');
    const number = numEl ? numEl.value.trim() : '';
    const dateEl = document.getElementById('offer-date');
    const date = dateEl ? dateEl.value : '';
    const cnEl = document.getElementById('client-name');
    const clientName = cnEl ? cnEl.value.trim() : '';
    const nipEl = document.getElementById('client-nip');
    const clientNip = nipEl ? nipEl.value.trim() : '';
    const caEl = document.getElementById('client-address');
    const clientAddress = caEl ? caEl.value.trim() : '';
    const ccEl = document.getElementById('client-contact');
    const clientContact = ccEl ? ccEl.value.trim() : '';
    const inEl = document.getElementById('invest-name');
    const investName = inEl ? inEl.value.trim() : '';
    const iaEl = document.getElementById('invest-address');
    const investAddress = iaEl ? iaEl.value.trim() : '';
    const icEl = document.getElementById('invest-contractor');
    const investContractor = icEl ? icEl.value.trim() : '';
    const tabNotesEl = document.getElementById('offer-tab-notes');
    const notes = tabNotesEl && tabNotesEl.value.trim() !== '' ? tabNotesEl.value.trim() : (() => { const nEl = document.getElementById('offer-notes'); return nEl ? nEl.value.trim() : ''; })();
    
    const tabPaymentEl = document.getElementById('offer-tab-payment-terms');
    const paymentTermsEl = document.getElementById('offer-payment-terms');
    const paymentTerms = tabPaymentEl && tabPaymentEl.value.trim() !== '' 
        ? tabPaymentEl.value.trim() 
        : (paymentTermsEl ? paymentTermsEl.value.trim() : 'Do uzgodnienia lub według indywidualnych warunków handlowych.');
    
    const tabValidityEl = document.getElementById('offer-tab-validity');
    const validityEl = document.getElementById('offer-validity');
    const validity = tabValidityEl && tabValidityEl.value.trim() !== '' 
        ? tabValidityEl.value.trim() 
        : (validityEl ? validityEl.value.trim() : '7 dni');
        
    const tkEl = document.getElementById('transport-km');
    const transportKm = Number(tkEl ? tkEl.value : 0) || 0;
    const trEl = document.getElementById('transport-rate');
    const transportRate = Number(trEl ? trEl.value : 0) || 0;
    const transportCostPerTrip = transportKm * transportRate;

    if (!number) {
        showToast('Podaj numer oferty', 'error');
        return;
    }
    if (currentOfferItems.length === 0) {
        showToast('Dodaj przynajmniej jeden produkt', 'error');
        return;
    }

    const transportResult = calculateTransports(currentOfferItems);
    const transportCost = transportResult.totalTransports * transportCostPerTrip;
    const transportDist = calculateTransportDistributionStandalone(
        currentOfferItems,
        transportCostPerTrip
    );

    let totalNetto = 0;
    currentOfferItems.forEach((item) => {
        const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const transportPerUnit = transportDist[item.productId] || 0;
        totalNetto += (priceAfterDiscount + transportPerUnit) * item.quantity;
    });

    // Automatyczny wybór opiekuna dla nowych ofert (tylko admin / pro)
    if (
        !editingOfferId &&
        currentUser &&
        (currentUser.role === 'admin' || currentUser.role === 'pro') &&
        !editingOfferAssignedUserId
    ) {
        try {
            const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
            const usersData = await usersResp.json();
            const allUsers = usersData.data || [];

            if (allUsers.length > 0) {
                const currentId = currentUser.id;
                const selectedUser = await showUserSelectionPopup(allUsers, currentId);
                if (selectedUser === null) {
                    showToast('Anulowano zapis oferty - brak wybranego opiekuna', 'info');
                    return;
                }
                editingOfferAssignedUserId = selectedUser.id;
                editingOfferAssignedUserName = selectedUser.displayName || selectedUser.username;

                const btnChangeUser = document.getElementById('btn-change-offer-user');
                if (btnChangeUser)
                    btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${editingOfferAssignedUserName}`;
                if (window.lucide) lucide.createIcons();
            }
        } catch (e) {
            logger.error('offerCrud', 'Błąd wyboru opiekuna:', e);
        }
    }

    let storageService;
    try {
        const mod = await import('../shared/StorageService.js');
        storageService = mod.storageService;
    } catch (e) {
        logger.error('offerCrud', '[App] Błąd importu StorageService:', e);
        showToast('Błąd ładowania modułu zapisu oferty', 'error');
        return;
    }

    let existingDoc = null;
    if (editingOfferId) {
        try {
            existingDoc = await storageService.getOfferById(editingOfferId);
        } catch (e) {
            logger.warn('offerCrud', '[App] Nie udało się pobrać istniejącej oferty do edycji:', e);
        }
    }

    const offerDoc = {
        id: editingOfferId || 'offer_' + Date.now(),
        type: 'offer',
        userId:
            editingOfferAssignedUserId ||
            existingDoc?.userId ||
            (currentUser ? currentUser.id : null),
        userName:
            editingOfferAssignedUserName ||
            existingDoc?.userName ||
            (currentUser
                ? currentUser.firstName && currentUser.lastName
                    ? `${currentUser.firstName} ${currentUser.lastName}`
                    : currentUser.username
                : ''),
        createdByUserId:
            editingOfferCreatedByUserId ||
            existingDoc?.createdByUserId ||
            (currentUser ? currentUser.id : null),
        createdByUserName:
            editingOfferCreatedByUserName ||
            existingDoc?.createdByUserName ||
            (currentUser
                ? currentUser.firstName && currentUser.lastName
                    ? `${currentUser.firstName} ${currentUser.lastName}`
                    : currentUser.username
                : ''),
        number,
        date,
        clientName,
        clientNip,
        clientAddress,
        clientContact,
        investName,
        investAddress,
        investContractor,
        notes,
        paymentTerms,
        validity,
        items: structuredClone(currentOfferItems),
        transportKm,
        transportRate,
        transportCostPerTrip,
        transportMode: currentRuryTransportMode || 'full',
        transportCount: transportResult.totalTransports,
        transportCost,
        totalNetto,
        totalBrutto: totalNetto * 1.23,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: currentUser
            ? currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username
            : ''
    };

    isSavingOffer = true;
    try {
        if (offerDoc.items.length === 0) {
            showToast('Błąd: Nie można zapisać pustej oferty.', 'error');
            return;
        }
        const result = await storageService.saveOffer(offerDoc);
        showToast('Oferta zapisana <i data-lucide="check"></i>', 'success');
        editingOfferId = result.id || offerDoc.id;

        // Aktualizuj lokalna tablice do natychmiastowego renderowania
        const idx = offers.findIndex((o) => o.id === offerDoc.id);
        if (idx >= 0) offers[idx] = { ...offerDoc, id: offerDoc.id };
        else offers.push({ ...offerDoc, id: offerDoc.id });

        renderSavedOffers();
    } catch (err) {
        logger.error('offerCrud', '[App] Save error:', err);
        showToast('Błąd zapisu oferty', 'error');
    } finally {
        isSavingOffer = false;
    }
}

/* ===== CZYSZCZENIE FORMULARZA ===== */

function clearOfferForm() {
    editingOfferId = null;
    editingOfferAssignedUserId = null;
    editingOfferAssignedUserName = '';
    editingOfferCreatedByUserId = null;
    editingOfferCreatedByUserName = '';
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('offer-number', generateOfferNumber());
    setVal('offer-date', new Date().toISOString().slice(0, 10));
    setVal('client-name', '');
    setVal('client-nip', '');
    setVal('client-address', '');
    setVal('client-contact', '');
    setVal('invest-name', '');
    setVal('invest-address', '');
    setVal('invest-contractor', '');
    setVal('offer-notes', '');
    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = '7 dni';
    setVal('transport-km', '100');
    setVal('transport-rate', '10');
    if (typeof clearOrderEditState === 'function') clearOrderEditState();
    currentOfferItems = [];

    // Aktualizacja UI
    const titleEl = document.getElementById('offer-form-title');
    if (titleEl) titleEl.innerHTML = `<i data-lucide="clipboard-list"></i> Dane klienta i oferty (Nowa)`;
    if (window.lucide) lucide.createIcons();

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        btnChangeUser.innerHTML = `<i data-lucide="user"></i> Zmień opiekuna`;
        if (window.lucide) lucide.createIcons();
    }

    const btnSaveOffer = document.getElementById('btn-save-offer');
    if (btnSaveOffer) {
        btnSaveOffer.innerHTML = '<i data-lucide="save"></i> Zapisz ofertę';
        if (window.lucide) lucide.createIcons();
    }

    syncTransportSecurity();
    renderOfferItems();
    if (typeof goToPhase === 'function') goToPhase(1);
}

/* ===== LISTA ZAPISANYCH OFERT ===== */

function renderSavedOffers() {
    const container = document.getElementById('saved-offers-list');
    if (!container) {
        if (window.pvSalesUI) window.pvSalesUI.loadLocalOffers();
        return;
    }
    if (offers.length === 0) {
        container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
      <h3>Brak zapisanych ofert</h3><p>Utwórz nową ofertę w zakładce "Nowa Oferta"</p></div>`;
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const isPro = currentUser && currentUser.role === 'pro';
    const subUsers = (currentUser && currentUser.subUsers) || [];

    const renderedList = offers
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((o) => {
            const isOwner = currentUser && o.userId === currentUser.id;
            const isSubUserOffer = isPro && subUsers.includes(o.userId);
            const canEdit = isAdmin || isOwner || isSubUserOffer;
            const _orderList = typeof getOrdersForOffer === 'function' ? getOrdersForOffer(o.id) : [];
            const _hasOrder = _orderList.length > 0;

            return `
    <div class="offer-list-item"${_hasOrder ? ' style="border-left:3px solid var(--success-hover);"' : ''}>
      <div class="offer-info" style="min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
          <h3 style="margin-bottom:0.2rem; word-break:break-all;">${o.number}</h3>
          <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
            <i data-lucide="banknote"></i> ${fmt(o.totalBrutto)} PLN
          </div>
        </div>
        <div class="meta" style="margin-top:0.3rem;">
          <span><i data-lucide="calendar"></i> <strong>${o.date}</strong></span>
          <span><i data-lucide="package"></i> <strong>${o.items.length}</strong> poz.</span>
          ${
              isAdmin && o.userName
                  ? (() => {
                        const rawUN = o.userName || '';
                        let displayUN = rawUN;
                        // 1. Sprawdź mapę globalną
                        if (window.globalUsersMap && window.globalUsersMap.has(rawUN)) {
                            displayUN = window.globalUsersMap.get(rawUN);
                        }
                        // 2. Fallback dla aktualnie zalogowanego
                        else if (
                            typeof currentUser !== 'undefined' &&
                            currentUser &&
                            (rawUN === currentUser.username || rawUN === currentUser.id)
                        ) {
                            displayUN = currentUser.displayName || currentUser.username || rawUN;
                        }
                        return `<span style="color:var(--accent-hover)"><i data-lucide="user"></i> <strong>${displayUN}</strong></span>`;
                    })()
                  : ''
          }
        </div>
        ${
            o.clientName || o.investName || o.clientContact
                ? `
        <div class="offer-client-badges">
          ${o.clientName ? `<div class="badge-client"><i data-lucide="building-2"></i> <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
          ${o.investName ? `<div class="badge-invest"><i data-lucide="hard-hat"></i> <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
          ${o.clientContact ? `<div class="badge-contact"><i data-lucide="phone"></i> <strong>Kontakt:</strong> <span style="font-weight:500">${o.clientContact}</span></div>` : ''}
        </div>`
                : ''
        }
        ${_hasOrder ? `<div style="margin-top:0.5rem; display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${_orderList.map(ord => {
                const label = ord.orderNumber || ord.offerNumber || (ord.id ? ord.id.substring(0, 8) : '—');
                return `<span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.5rem; background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.4); border-radius:6px; font-size:0.68rem; font-weight:800; color:var(--success-hover);">
                    <i data-lucide="package" class="icon-xxs"></i> Zamówienie ${label}
                </span>`;
            }).join('')}
        </div>` : ''}
      </div>
      <div class="offer-actions" style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end; align-content:center;">
        <button class="btn btn-sm btn-primary" onclick="loadOffer('${o.id}')" title="Edytuj" ${canEdit ? '' : 'disabled'}><i data-lucide="pencil" aria-hidden="true"></i> Edytuj</button>
        <button class="btn btn-sm btn-secondary" onclick="duplicateOffer('${o.id}')" title="Duplikuj"><i data-lucide="clipboard-list" aria-hidden="true"></i> Duplikuj</button>
        ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistory('${o.id}')" title="Historia zmian"><i data-lucide="hourglass" aria-hidden="true"></i> Historia</button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="downloadExistingOffer('${o.id}')" title="Pobierz plik JSON"><i data-lucide="save" aria-hidden="true"></i> JSON</button>
        <button class="btn btn-sm btn-secondary" onclick="exportOfferXlsx('${o.id}')" title="Pobierz plik XLSX"><i data-lucide="bar-chart-2" aria-hidden="true"></i> XLSX</button>
        <button class="btn btn-sm btn-success" onclick="exportOfferPDF('${o.id}')" title="PDF"><i data-lucide="file-text" aria-hidden="true"></i> PDF</button>
        ${_hasOrder ? _orderList.map(ord => `
            <button class="btn btn-sm" onclick="window.location.href='rury.html?order=${ord.id}'" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Edytuj zamówienie">
                <i data-lucide="package"></i> Zam. ${ord.orderNumber || ord.offerNumber || ord.id.substring(0, 8)}
            </button>
            <button class="btn btn-sm" onclick="exportKartaDirectRury_action('${ord.id}', 'pdf')" style="background:rgba(var(--danger-rgb),0.15); border:1px solid rgba(var(--danger-rgb),0.3); color:var(--danger-hover); font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Karta budowy PDF">
                <i data-lucide="file-text"></i> Karta PDF
            </button>
            <button class="btn btn-sm" onclick="exportKartaDirectRury_action('${ord.id}', 'docx')" style="background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:#93c5fd; font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Karta budowy Word">
                <i data-lucide="edit"></i> Karta Word
            </button>
        `).join('') : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteOffer('${o.id}')" title="Usuń" ${canEdit ? '' : 'disabled'}><i data-lucide="trash-2" aria-hidden="true"></i> Usuń</button>
      </div>
    </div>
  `;
        })
        .join('');
    container.innerHTML = renderedList;
    if (window.lucide) lucide.createIcons();
}

/* ===== ŁADOWANIE OFERTY ===== */

async function loadOffer(id) {
    let offer = offers.find((o) => o.id === id);
    let srv = null;
    try {
        const { storageService } = await import('../shared/StorageService.js');
        srv = storageService;
    } catch (e) {
        logger.warn('offerCrud', 'Could not import storageService', e);
    }

    if (!offer) {
        try {
            if (srv) offer = await srv.getOfferById(id);
        } catch (e) {
            showToast('Błąd: Nie znaleziono oferty w bazie.', 'error');
            return;
        }
    }
    if (!offer) return;

    // Normalizuj, jeśli są to dane archiwalne
    const normalized = srv && srv.normalizeOffer ? srv.normalizeOffer(offer) : offer;

    if (typeof clearOrderEditState === 'function') clearOrderEditState();
    editingOfferId = id;
    editingOfferAssignedUserId = normalized.userId || null;
    editingOfferAssignedUserName = normalized.userName || '';
    editingOfferCreatedByUserId = normalized.createdByUserId || null;
    editingOfferCreatedByUserName = normalized.createdByUserName || '';
    const finalNumber =
        normalized.number ||
        normalized.offerNumber ||
        normalized.title ||
        normalized.offerName ||
        '';
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('offer-number', finalNumber);
    setVal('offer-date', normalized.date || new Date().toISOString().slice(0, 10));
    setVal('client-name', normalized.clientName || '');
    setVal('client-nip', normalized.clientNip || '');
    setVal('client-address', normalized.clientAddress || '');
    setVal('client-contact', normalized.clientContact || '');
    setVal('invest-name', normalized.investName || '');
    setVal('invest-address', normalized.investAddress || '');
    setVal('invest-contractor', normalized.investContractor || '');
    setVal('offer-notes', normalized.notes || '');
    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            normalized.paymentTerms ||
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = normalized.validity || '7 dni';
    setVal('transport-km', normalized.transportKm || 100);
    setVal('transport-rate', normalized.transportRate || 10);
    currentRuryTransportMode = normalized.transportMode || 'full';
    currentOfferItems = structuredClone(normalized.items || []);

    // Backfill uid dla starych itemów (flagi 'ordered' nie przechowujemy — obliczamy z ordersRury)
    if (typeof loadOrdersRury === 'function' && (!ordersRury || ordersRury.length === 0)) {
        try { await loadOrdersRury(); } catch (e) { logger.error('offerCrud', 'Błąd ładowania zamówień rur:', e); showToast('Nie udało się załadować zamówień', 'warning'); }
    }
    currentOfferItems.forEach(item => {
        if (!item.uid) item.uid = 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    });

    // Uprawnienia
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isOwner =
        currentUser &&
        (normalized.userId === currentUser.id || normalized.creatorId === currentUser.id);
    const subUsers = (currentUser && currentUser.subUsers) || [];
    const isPro = currentUser && currentUser.role === 'pro';
    const isSubUserOffer = isPro && subUsers.includes(normalized.userId);
    const canEdit = isAdmin || isOwner || isSubUserOffer;

    // Aktualizacja UI
    const titleEl = document.getElementById('offer-form-title');
    if (titleEl)
        titleEl.innerHTML = `<i data-lucide="pencil"></i> Edycja Oferty: <span style="font-weight:700">${normalized.number || id}</span>`;
    if (window.lucide) lucide.createIcons();

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        if (editingOfferAssignedUserName) {
            btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${editingOfferAssignedUserName}`;
        } else {
            btnChangeUser.innerHTML = `<i data-lucide="user"></i> Zmień opiekuna`;
        }
        if (window.lucide) lucide.createIcons();
    }

    const btnSaveOffer = document.getElementById('btn-save-offer');
    if (btnSaveOffer) {
        btnSaveOffer.innerHTML = '<i data-lucide="save"></i> Zapisz zmiany';
        btnSaveOffer.disabled = !canEdit;
        btnSaveOffer.title = canEdit ? 'Zapisz zmiany' : 'Brak uprawnień do edycji';
        if (window.lucide) lucide.createIcons();
    }

    window.zabezpieczenieTransportuEnabled = true;
    if (typeof updateZabezpieczenieTransportuUI === 'function') updateZabezpieczenieTransportuUI();
    syncTransportSecurity();
    renderOfferItems();
    showSection('builder');
    if (typeof goToPhase === 'function') goToPhase(3);
    showToast('Wczytano ofertę: ' + (normalized.number || 'bez numeru'), 'info');
}

// Kompatybilność z PVSalesUI
window.loadSavedOfferData = function (doc, id) {
    offers = offers.filter((o) => o.id !== id);
    offers.push({ ...doc, id: id });
    loadOffer(id);
};

/* ===== DUPLIKACJA ===== */

function duplicateOffer(id) {
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;
    const newOffer = structuredClone(offer);
    newOffer.id = 'offer_' + Date.now();
    newOffer.number = offer.number + ' (kopia)';
    newOffer.userId = currentUser ? currentUser.id : null;
    newOffer.userName = currentUser
        ? currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser.username
        : '';
    newOffer.createdAt = new Date().toISOString();
    newOffer.updatedAt = new Date().toISOString();
    offers.push(newOffer);
    saveOffersData(offers);
    renderSavedOffers();
    showToast('Zduplikowano ofertę', 'success');
}

/* ===== USUWANIE ===== */

async function deleteOffer(id) {
    if (
        !(await appConfirm('Czy na pewno usunąć tę ofertę?', {
            title: 'Usuwanie oferty',
            type: 'danger'
        }))
    )
        return;
    try {
        const res = await fetch(`/api/offers-rury/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Błąd usuwania', 'error');
            return;
        }
        offers = offers.filter((o) => o.id !== id);
        renderSavedOffers();
        showToast('Oferta usunięta', 'info');
    } catch (err) {
        logger.error('offerCrud', 'deleteOffer error:', err);
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

function downloadExistingOffer(id) {
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;
    downloadOfferFile(offer);
    showToast('Pobrano plik oferty', 'success');
}

/* ===== HISTORIA OFERTY ===== */

function showOfferHistory(id) {
    const offer = offers.find((o) => o.id === id);
    if (!offer || !offer.history || offer.history.length === 0) {
        showToast('Brak historii dla tej oferty', 'info');
        return;
    }

    let historyHtml = offer.history
        .map((h, i) => {
            // Znajdź następny stan (albo następny element historii, albo bieżąca oferta)
            const nextState = i === offer.history.length - 1 ? offer : offer.history[i + 1];
            const priceDiff = nextState.totalBrutto - h.totalBrutto;

            let diffHtml = '';
            if (Math.abs(priceDiff) > 0.01) {
                if (priceDiff > 0) {
                    diffHtml = `<span style="color:var(--danger); font-size:0.8rem; font-weight:700;">+${fmt(priceDiff)} PLN</span>`;
                } else {
                    diffHtml = `<span style="color:var(--success); font-size:0.8rem; font-weight:700;">${fmt(priceDiff)} PLN</span>`;
                }
            } else {
                diffHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Bez zmian</span>`;
            }

            return `
      <div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:8px; padding:1rem; margin-bottom:0.8rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; border-bottom:1px dashed var(--border-glass); padding-bottom:0.4rem;">
          <strong class="text-primary">${new Date(h.updatedAt).toLocaleString()}</strong>
          <div style="text-align:right;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Zapisana przez: <strong style="color:var(--text-secondary);">${h.lastEditedBy || h.userName || '—'}</strong></div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Nadpisana przez: <strong style="color:var(--accent);">${nextState.lastEditedBy || nextState.userName || '—'}</strong></div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">Wersja przed zmianą</div>
            <div style="font-size:1.1rem; font-weight:700;"><i data-lucide="banknote"></i> ${fmt(h.totalBrutto)} PLN</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">Pozycji: ${h.items ? h.items.length : 0}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.2rem;">Różnica do kolejnej wersji:</div>
            ${diffHtml}
            <div style="margin-top:0.6rem;">
              <button class="btn btn-sm btn-secondary" onclick="restoreOfferVersion('${id}', ${i})">Pobierz do edycji</button>
            </div>
          </div>
        </div>
      </div>
    `;
        })
        .reverse()
        .join('');

    showModal({
        id: 'offer-history-modal',
        titleId: 'offer-history-title',
        html: `
    <div class="modal" style="max-width:800px; width:95%; border-radius:12px; max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
        <h3 id="offer-history-title" style="font-weight:700;"><i data-lucide="hourglass" aria-hidden="true"></i> Historia zmian oferty: ${offer.number}</h3>
        <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div style="padding:1rem 0; overflow-y:auto; flex:1;">
        ${historyHtml}
      </div>
    </div>`
    });
    if (window.lucide) lucide.createIcons();
}

function restoreOfferVersion(offerId, historyIndex) {
    const offer = offers.find((o) => o.id === offerId);
    if (!offer || !offer.history || !offer.history[historyIndex]) return;

    const snapshot = offer.history[historyIndex];

    // Wczytaj migawke jako nowa oferte z biezacym ID edycji
    editingOfferId = offer.id;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('offer-number', snapshot.number || offer.number);
    setVal('offer-date', snapshot.date || offer.date);
    setVal('client-name', snapshot.clientName || '');
    setVal('client-nip', snapshot.clientNip || '');
    setVal('client-address', snapshot.clientAddress || '');
    setVal('client-contact', snapshot.clientContact || '');
    setVal('invest-name', snapshot.investName || '');
    setVal('invest-address', snapshot.investAddress || '');
    setVal('invest-contractor', snapshot.investContractor || '');
    setVal('offer-notes', snapshot.notes || '');
    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            snapshot.paymentTerms ||
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = snapshot.validity || '7 dni';
    setVal('transport-km', snapshot.transportKm || 100);
    setVal('transport-rate', snapshot.transportRate || 10);

    currentOfferItems = structuredClone(snapshot.items || []);
    window.zabezpieczenieTransportuEnabled = true;
    if (typeof updateZabezpieczenieTransportuUI === 'function') updateZabezpieczenieTransportuUI();
    syncTransportSecurity();
    renderOfferItems();

    // Przełącz na widok formularza
    const navOffer = document.getElementById('nav-offer');
    if (navOffer) navOffer.click();

    if (typeof closeModal === 'function') closeModal();
    if (typeof window.showToast === 'function')
        window.showToast('Wersja z historii wczytana', 'success');
}
