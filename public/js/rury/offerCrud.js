/* ===== CRUD OFERT (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: zapis, ładowanie, duplikacja, usuwanie, historia ofert */
/* Zależności: offers, currentOfferItems, editingOfferId, editingOfferAssignedUserId/Name, currentUser (globalne) */
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
    const number = document.getElementById('offer-number').value.trim();
    const date = document.getElementById('offer-date').value;
    const clientName = document.getElementById('client-name').value.trim();
    const clientNip = document.getElementById('client-nip').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const clientContact = document.getElementById('client-contact').value.trim();
    const investName = document.getElementById('invest-name').value.trim();
    const investAddress = document.getElementById('invest-address').value.trim();
    const investContractor = document.getElementById('invest-contractor').value.trim();
    const notes = document.getElementById('offer-notes').value.trim();
    const paymentTermsEl = document.getElementById('offer-payment-terms');
    const paymentTerms = paymentTermsEl
        ? paymentTermsEl.value.trim()
        : 'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    const validityEl = document.getElementById('offer-validity');
    const validity = validityEl ? validityEl.value.trim() : '7 dni';
    const transportKm = Number(document.getElementById('transport-km').value) || 0;
    const transportRate = Number(document.getElementById('transport-rate').value) || 0;
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
                    btnChangeUser.textContent = `👤 Opiekun: ${editingOfferAssignedUserName}`;
            }
        } catch (e) {
            console.error('Błąd wyboru opiekuna:', e);
        }
    }

    const { storageService } = await import('./shared/StorageService.js');

    let existingDoc = null;
    if (editingOfferId) {
        try {
            existingDoc = await storageService.getOfferById(editingOfferId);
        } catch (e) {
            console.warn('[App] Nie udało się pobrać istniejącej oferty do edycji:', e);
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
        items: JSON.parse(JSON.stringify(currentOfferItems)),
        transportKm,
        transportRate,
        transportCostPerTrip,
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

    try {
        if (offerDoc.items.length === 0) {
            showToast('Błąd: Nie można zapisać pustej oferty.', 'error');
            return;
        }
        const result = await storageService.saveOffer(offerDoc);
        showToast('Oferta zapisana ✔', 'success');
        editingOfferId = result.id || offerDoc.id;

        // Update local array for immediate render
        const idx = offers.findIndex((o) => o.id === offerDoc.id);
        if (idx >= 0) offers[idx] = { ...offerDoc, id: offerDoc.id };
        else offers.push({ ...offerDoc, id: offerDoc.id });

        renderSavedOffers();
    } catch (err) {
        console.error('[App] Save error:', err);
        showToast('Błąd zapisu oferty', 'error');
    }
}

/* ===== CZYSZCZENIE FORMULARZA ===== */

function clearOfferForm() {
    editingOfferId = null;
    editingOfferAssignedUserId = null;
    editingOfferAssignedUserName = '';
    document.getElementById('offer-number').value = generateOfferNumber();
    document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('client-name').value = '';
    document.getElementById('client-nip').value = '';
    document.getElementById('client-address').value = '';
    document.getElementById('client-contact').value = '';
    document.getElementById('invest-name').value = '';
    document.getElementById('invest-address').value = '';
    document.getElementById('invest-contractor').value = '';
    document.getElementById('offer-notes').value = '';
    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = '7 dni';
    document.getElementById('transport-km').value = '100';
    document.getElementById('transport-rate').value = '10';
    currentOfferItems = [];

    // Aktualizacja UI
    const titleEl = document.getElementById('offer-form-title');
    if (titleEl) titleEl.innerHTML = `📋 Dane klienta i oferty (Nowa)`;
    const btnEl = document.getElementById('btn-save-offer');
    if (btnEl) btnEl.innerHTML = `💾 Zapisz ofertę`;

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        btnChangeUser.textContent = `👤 Zmień opiekuna`;
    }

    renderOfferItems();
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

    container.innerHTML = offers
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map((o) => {
            const isOwner = currentUser && o.userId === currentUser.id;
            const isSubUserOffer = isPro && subUsers.includes(o.userId);
            const canEdit = isAdmin || isOwner || isSubUserOffer;

            return `
    <div class="offer-list-item">
      <div class="offer-info" style="min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
          <h3 style="margin-bottom:0.2rem; word-break:break-all;">${o.number}</h3>
          <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
            💰 ${fmt(o.totalBrutto)} PLN
          </div>
        </div>
        <div class="meta" style="margin-top:0.3rem;">
          <span>📅 <strong>${o.date}</strong></span>
          <span>📦 <strong>${o.items.length}</strong> poz.</span>
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
                        return `<span style="color:var(--accent-hover)">👤 <strong>${displayUN}</strong></span>`;
                    })()
                  : ''
          }
        </div>
        ${
            o.clientName || o.investName || o.clientContact
                ? `
        <div class="offer-client-badges">
          ${o.clientName ? `<div class="badge-client">🏢 <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
          ${o.investName ? `<div class="badge-invest">🏗️ <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
          ${o.clientContact ? `<div class="badge-contact">📞 <strong>Kontakt:</strong> <span style="font-weight:500">${o.clientContact}</span></div>` : ''}
        </div>`
                : ''
        }
      </div>
      <div class="offer-actions" style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end; align-content:center;">
        <button class="btn btn-sm btn-primary" onclick="loadOffer('${o.id}')" title="Edytuj" ${canEdit ? '' : 'disabled'}>✏️ Edytuj</button>
        <button class="btn btn-sm btn-secondary" onclick="duplicateOffer('${o.id}')" title="Duplikuj">📋 Duplikuj</button>
        ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistory('${o.id}')" title="Historia zmian">⏳ Historia</button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="downloadExistingOffer('${o.id}')" title="Pobierz plik JSON">💾 JSON</button>
        <button class="btn btn-sm btn-secondary" onclick="exportOfferXlsx('${o.id}')" title="Pobierz plik XLSX">📊 XLSX</button>
        <button class="btn btn-sm btn-success" onclick="exportOfferPDF('${o.id}')" title="PDF">📄 PDF</button>
        <button class="btn btn-sm btn-danger" onclick="deleteOffer('${o.id}')" title="Usuń" ${canEdit ? '' : 'disabled'}>🗑️ Usuń</button>
      </div>
    </div>
  `;
        })
        .join('');
}

/* ===== ŁADOWANIE OFERTY ===== */

async function loadOffer(id) {
    let offer = offers.find((o) => o.id === id);
    let srv = null;
    try {
        const { storageService } = await import('./shared/StorageService.js');
        srv = storageService;
    } catch (e) {
        console.warn('Could not import storageService', e);
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

    editingOfferId = id;
    editingOfferAssignedUserId = normalized.userId || null;
    editingOfferAssignedUserName = normalized.userName || '';
    const finalNumber =
        normalized.number ||
        normalized.offerNumber ||
        normalized.title ||
        normalized.offerName ||
        '';
    document.getElementById('offer-number').value = finalNumber;
    document.getElementById('offer-date').value =
        normalized.date || new Date().toISOString().slice(0, 10);
    document.getElementById('client-name').value = normalized.clientName || '';
    document.getElementById('client-nip').value = normalized.clientNip || '';
    document.getElementById('client-address').value = normalized.clientAddress || '';
    document.getElementById('client-contact').value = normalized.clientContact || '';
    document.getElementById('invest-name').value = normalized.investName || '';
    document.getElementById('invest-address').value = normalized.investAddress || '';
    document.getElementById('invest-contractor').value = normalized.investContractor || '';
    document.getElementById('offer-notes').value = normalized.notes || '';
    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            normalized.paymentTerms ||
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = normalized.validity || '7 dni';
    document.getElementById('transport-km').value = normalized.transportKm || 100;
    document.getElementById('transport-rate').value = normalized.transportRate || 10;
    currentOfferItems = JSON.parse(JSON.stringify(normalized.items || []));

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
        titleEl.innerHTML = `✏️ Edycja Oferty: <span style="font-weight:700">${normalized.number || id}</span>`;
    const btnEl = document.getElementById('btn-save-offer');
    if (btnEl) {
        btnEl.innerHTML = `💾 Zapisz zmiany`;
        btnEl.disabled = !canEdit;
        btnEl.title = canEdit ? '' : 'Brak uprawnień do edycji tej oferty';
    }

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
        if (editingOfferAssignedUserName) {
            btnChangeUser.textContent = `👤 Opiekun: ${editingOfferAssignedUserName}`;
        } else {
            btnChangeUser.textContent = `👤 Zmień opiekuna`;
        }
    }

    renderOfferItems();
    showSection('offer');
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
    const newOffer = JSON.parse(JSON.stringify(offer));
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
        console.error('deleteOffer error:', err);
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

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'offer-history-modal';

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
          <strong style="color:var(--text-primary);">${new Date(h.updatedAt).toLocaleString()}</strong>
          <div style="text-align:right;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Zapisana przez: <strong style="color:var(--text-secondary);">${h.lastEditedBy || h.userName || '—'}</strong></div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Nadpisana przez: <strong style="color:var(--accent);">${nextState.lastEditedBy || nextState.userName || '—'}</strong></div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">Wersja przed zmianą</div>
            <div style="font-size:1.1rem; font-weight:700;">💰 ${fmt(h.totalBrutto)} PLN</div>
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

    overlay.innerHTML = `
    <div class="modal" style="max-width:800px; width:95%; border-radius:12px; max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
        <h3 style="font-weight:700;">⏳ Historia zmian oferty: ${offer.number}</h3>
        <button class="btn-icon" onclick="closeModal()">✕</button>
      </div>
      <div style="padding:1rem 0; overflow-y:auto; flex:1;">
        ${historyHtml}
      </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

function restoreOfferVersion(offerId, historyIndex) {
    const offer = offers.find((o) => o.id === offerId);
    if (!offer || !offer.history || !offer.history[historyIndex]) return;

    const snapshot = offer.history[historyIndex];

    // Load snapshot as new offer with current editing id
    editingOfferId = offer.id;
    document.getElementById('offer-number').value = snapshot.number || offer.number;
    document.getElementById('offer-date').value = snapshot.date || offer.date;
    document.getElementById('client-name').value = snapshot.clientName || '';
    document.getElementById('client-nip').value = snapshot.clientNip || '';
    document.getElementById('client-address').value = snapshot.clientAddress || '';
    document.getElementById('client-contact').value = snapshot.clientContact || '';
    document.getElementById('invest-name').value = snapshot.investName || '';
    document.getElementById('invest-address').value = snapshot.investAddress || '';
    document.getElementById('invest-contractor').value = snapshot.investContractor || '';
    document.getElementById('offer-notes').value = snapshot.notes || '';
    if (document.getElementById('offer-payment-terms'))
        document.getElementById('offer-payment-terms').value =
            snapshot.paymentTerms ||
            'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    if (document.getElementById('offer-validity'))
        document.getElementById('offer-validity').value = snapshot.validity || '7 dni';
    document.getElementById('transport-km').value = snapshot.transportKm || 100;
    document.getElementById('transport-rate').value = snapshot.transportRate || 10;

    currentOfferItems = JSON.parse(JSON.stringify(snapshot.items || []));
    renderOfferItems();

    // Switch to the form view
    const navOffer = document.getElementById('nav-offer');
    if (navOffer) navOffer.click();

    if (typeof closeModal === 'function') closeModal();
    if (typeof window.showToast === 'function')
        window.showToast('Wersja z historii wczytana', 'success');
}
