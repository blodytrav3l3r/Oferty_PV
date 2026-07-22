// @ts-check
/* ===== CRUD OFERT (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: zapis, ładowanie, duplikacja, usuwanie, historia ofert */
/* Zależności: offers, currentOfferItems, editingOfferId, editingOfferAssignedUserId/Name, currentUser (globalne) */

window.editingOfferCreatedByUserId = null;
window.editingOfferCreatedByUserName = '';
window.isSavingOffer = false;
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
    if (window.isSavingOffer) return;
    const fields = getOfferFormFields();
    if (!fields.number) {
        showToast('Podaj numer oferty', 'error');
        return;
    }
    if (currentOfferItems.length === 0) {
        showToast('Dodaj przynajmniej jeden produkt', 'error');
        return;
    }
    const transportCostPerTrip = fields.transportKm * fields.transportRate;

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

    const assignedUserRes = await assignOfferSupervisor(
        currentUser,
        !editingOfferId,
        editingOfferId
    );
    if (assignedUserRes === undefined) {
        showToast('Anulowano zapis oferty - brak wybranego opiekuna', 'info');
        return;
    }
    if (assignedUserRes) {
        editingOfferAssignedUserId = assignedUserRes.id;
        editingOfferAssignedUserName = assignedUserRes.displayName || assignedUserRes.username;
        const btnChangeUser = document.getElementById('btn-change-offer-user');
        if (btnChangeUser)
            btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${escapeHtml(editingOfferAssignedUserName)}`;
        if (window.lucide) lucide.createIcons();
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
            buildUserDisplayName(currentUser),
        createdByUserId:
            window.editingOfferCreatedByUserId ||
            existingDoc?.createdByUserId ||
            (currentUser ? currentUser.id : null),
        createdByUserName:
            window.editingOfferCreatedByUserName ||
            existingDoc?.createdByUserName ||
            buildUserDisplayName(currentUser),
        number: fields.number,
        date: fields.date,
        clientName: fields.clientName,
        clientNip: fields.clientNip,
        clientAddress: fields.clientAddress,
        clientContact: fields.clientContact,
        investName: fields.investName,
        investAddress: fields.investAddress,
        investContractor: fields.investContractor,
        notes: fields.notes,
        paymentTerms: fields.paymentTerms,
        validity: fields.validity,
        items: structuredClone(currentOfferItems),
        transportKm: fields.transportKm,
        transportRate: fields.transportRate,
        transportCostPerTrip,
        transportMode: currentRuryTransportMode || 'full',
        transportCount: transportResult.totalTransports,
        transportCost,
        totalNetto,
        totalBrutto: totalNetto * 1.23,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: buildUserDisplayName(currentUser)
    };

    window.isSavingOffer = true;
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
        window.isSavingOffer = false;
    }
}

/* ===== CZYSZCZENIE FORMULARZA ===== */

function clearOfferForm() {
    editingOfferId = null;
    editingOfferAssignedUserId = null;
    editingOfferAssignedUserName = '';
    window.editingOfferCreatedByUserId = null;
    window.editingOfferCreatedByUserName = '';
    clearOfferFormFields(generateOfferNumber);
    if (typeof clearOrderEditState === 'function') clearOrderEditState();
    currentOfferItems = [];

    // Aktualizacja UI
    const titleEl = document.getElementById('offer-form-title');
    if (titleEl)
        titleEl.innerHTML = `<i data-lucide="clipboard-list"></i> Dane klienta i oferty (Nowa)`;
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
    window.editingOfferCreatedByUserId = normalized.createdByUserId || null;
    window.editingOfferCreatedByUserName = normalized.createdByUserName || '';
    const finalNumber =
        normalized.number ||
        normalized.offerNumber ||
        normalized.title ||
        normalized.offerName ||
        '';
    setOfferFormFields({
        number: finalNumber,
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
    currentRuryTransportMode = normalized.transportMode || 'full';
    currentOfferItems = structuredClone(normalized.items || []);

    // Backfill uid dla starych itemów (flagi 'ordered' nie przechowujemy — obliczamy z ordersRury)
    if (typeof loadOrdersRury === 'function' && (!ordersRury || ordersRury.length === 0)) {
        try {
            await loadOrdersRury();
        } catch (e) {
            logger.error('offerCrud', 'Błąd ładowania zamówień rur:', e);
            showToast('Nie udało się załadować zamówień', 'warning');
        }
    }
    currentOfferItems.forEach((item) => {
        if (!item.uid)
            item.uid = 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
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
        titleEl.innerHTML = `<i data-lucide="pencil"></i> Edycja Oferty: <span style="font-weight:700">${escapeHtml(normalized.number || id)}</span>`;
    if (window.lucide) lucide.createIcons();

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        if (editingOfferAssignedUserName) {
            btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${escapeHtml(editingOfferAssignedUserName)}`;
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

function restoreOfferVersion(offerId, historyIndex) {
    const offer = offers.find((o) => o.id === offerId);
    if (!offer || !offer.history || !offer.history[historyIndex]) return;

    const snapshot = offer.history[historyIndex];

    // Wczytaj migawke jako nowa oferte z biezacym ID edycji
    editingOfferId = offer.id;
    setOfferFormFields({
        number: snapshot.number || offer.number,
        date: snapshot.date || offer.date,
        clientName: snapshot.clientName,
        clientNip: snapshot.clientNip,
        clientAddress: snapshot.clientAddress,
        clientContact: snapshot.clientContact,
        investName: snapshot.investName,
        investAddress: snapshot.investAddress,
        investContractor: snapshot.investContractor,
        notes: snapshot.notes,
        paymentTerms: snapshot.paymentTerms,
        validity: snapshot.validity,
        transportKm: snapshot.transportKm,
        transportRate: snapshot.transportRate
    });

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
