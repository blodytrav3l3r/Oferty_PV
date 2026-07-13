// @ts-check
/* ===== CRUD OFERT — ZAPIS ===== */
/* Wydzielone z offerCrud.js */
/* Zależności: offers, currentOfferItems, editingOfferId, editingOfferAssignedUserId/Name, currentUser (globalne) */
/* calculateTransports, calculateTransportDistributionStandalone z transport.js */
/* renderSavedOffers z offerCrudLoad.js */
/* showToast, showUserSelectionPopup z shared/ui.js; authHeaders z shared/auth.js */

var editingOfferCreatedByUserId = null;
var editingOfferCreatedByUserName = '';
var isSavingOffer = false;

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
    const notes =
        tabNotesEl && tabNotesEl.value.trim() !== ''
            ? tabNotesEl.value.trim()
            : (() => {
                  const nEl = document.getElementById('offer-notes');
                  return nEl ? nEl.value.trim() : '';
              })();

    const tabPaymentEl = document.getElementById('offer-tab-payment-terms');
    const paymentTermsEl = document.getElementById('offer-payment-terms');
    const paymentTerms =
        tabPaymentEl && tabPaymentEl.value.trim() !== ''
            ? tabPaymentEl.value.trim()
            : paymentTermsEl
              ? paymentTermsEl.value.trim()
              : 'Do uzgodnienia lub według indywidualnych warunków handlowych.';

    const tabValidityEl = document.getElementById('offer-tab-validity');
    const validityEl = document.getElementById('offer-validity');
    const validity =
        tabValidityEl && tabValidityEl.value.trim() !== ''
            ? tabValidityEl.value.trim()
            : validityEl
              ? validityEl.value.trim()
              : '7 dni';

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
                    btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${escapeHtml(editingOfferAssignedUserName)}`;
                if (window.lucide) lucide.createIcons();
            }
        } catch (e) {
            logger.error('offerCrud', 'Błąd wyboru opiekuna:', e);
        }
    }

    let storageService;
    try {
        const mod = await import('../../shared/StorageService.js');
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
