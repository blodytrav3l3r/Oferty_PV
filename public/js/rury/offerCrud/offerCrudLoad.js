// @ts-check
/* ===== CRUD OFERT — ŁADOWANIE I LISTA ===== */
/* Wydzielone z offerCrud.js */
/* Zależności: offers, currentOfferItems, editingOfferId, editingOfferAssignedUserId/Name, currentUser (globalne) */
/* syncTransportSecurity z offerItemAdd.js; renderOfferItems, showSection z offerItemOrder.js */
/* updateZabezpieczenieTransportuUI z offerItemAdd.js */
/* showToast z shared/ui.js; fmt, escapeHtml z shared/formatters.js */

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

    const renderedList = [...offers]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((o) => {
            const isOwner = currentUser && o.userId === currentUser.id;
            const isSubUserOffer = isPro && subUsers.includes(o.userId);
            const canEdit = isAdmin || isOwner || isSubUserOffer;
            const _orderList =
                typeof getOrdersForOffer === 'function' ? getOrdersForOffer(o.id) : [];
            const _hasOrder = _orderList.length > 0;

            return `
    <div class="offer-list-item"${_hasOrder ? ' style="border-left:3px solid var(--success-hover);"' : ''}>
      <div class="offer-info" style="min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
          <h3 style="margin-bottom:0.2rem; word-break:break-all;">${escapeHtml(o.number)}</h3>
          <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
            <i data-lucide="banknote"></i> ${fmt(o.totalBrutto)} PLN
          </div>
        </div>
        <div class="meta" style="margin-top:0.3rem;">
          <span><i data-lucide="calendar"></i> <strong>${escapeHtml(o.date)}</strong></span>
          <span><i data-lucide="package"></i> <strong>${o.items.length}</strong> poz.</span>
          ${
              isAdmin && o.userName
                  ? (() => {
                        const rawUN = o.userName || '';
                        let displayUN = rawUN;
                        if (window.globalUsersMap && window.globalUsersMap.has(rawUN)) {
                            displayUN = window.globalUsersMap.get(rawUN);
                        } else if (
                            typeof currentUser !== 'undefined' &&
                            currentUser &&
                            (rawUN === currentUser.username || rawUN === currentUser.id)
                        ) {
                            displayUN = currentUser.displayName || currentUser.username || rawUN;
                        }
                        return `<span style="color:var(--accent-hover)"><i data-lucide="user"></i> <strong>${escapeHtml(displayUN)}</strong></span>`;
                    })()
                  : ''
          }
        </div>
        ${
            o.clientName || o.investName || o.clientContact
                ? `
        <div class="offer-client-badges">
          ${o.clientName ? `<div class="badge-client"><i data-lucide="building-2"></i> <strong>Klient:</strong> <span style="font-weight:500">${escapeHtml(o.clientName)}</span></div>` : ''}
          ${o.investName ? `<div class="badge-invest"><i data-lucide="hard-hat"></i> <strong>Budowa:</strong> <span style="font-weight:500">${escapeHtml(o.investName)}</span></div>` : ''}
          ${o.clientContact ? `<div class="badge-contact"><i data-lucide="phone"></i> <strong>Kontakt:</strong> <span style="font-weight:500">${escapeHtml(o.clientContact)}</span></div>` : ''}
        </div>`
                : ''
        }
        ${
            _hasOrder
                ? `<div style="margin-top:0.5rem; display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${_orderList
                .map((ord) => {
                    const label =
                        ord.orderNumber ||
                        ord.offerNumber ||
                        (ord.id ? ord.id.substring(0, 8) : '—');
                    return `<span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.5rem; background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.4); border-radius:6px; font-size:0.68rem; font-weight:800; color:var(--success-hover);">
                    <i data-lucide="package" class="icon-xxs"></i> Zamówienie ${escapeHtml(label)}
                </span>`;
                })
                .join('')}
        </div>`
                : ''
        }
      </div>
      <div class="offer-actions" style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end; align-content:center;">
        <button class="btn btn-sm btn-primary" data-action="loadOffer" data-offer-id="${o.id}" title="Edytuj" ${canEdit ? '' : 'disabled'}><i data-lucide="pencil" aria-hidden="true"></i> Edytuj</button>
        <button class="btn btn-sm btn-secondary" data-action="duplicateOffer" data-offer-id="${o.id}" title="Duplikuj"><i data-lucide="clipboard-list" aria-hidden="true"></i> Duplikuj</button>
        ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary" data-action="showOfferHistory" data-offer-id="${o.id}" title="Historia zmian"><i data-lucide="hourglass" aria-hidden="true"></i> Historia</button>` : ''}
        <button class="btn btn-sm btn-secondary" data-action="downloadExistingOffer" data-offer-id="${o.id}" title="Pobierz plik JSON"><i data-lucide="save" aria-hidden="true"></i> JSON</button>
        <button class="btn btn-sm btn-secondary" data-action="exportOfferXlsx" data-offer-id="${o.id}" title="Pobierz plik XLSX"><i data-lucide="bar-chart-2" aria-hidden="true"></i> XLSX</button>
        <button class="btn btn-sm btn-success" data-action="exportOfferPDF" data-offer-id="${o.id}" title="PDF"><i data-lucide="file-text" aria-hidden="true"></i> PDF</button>
        ${
            _hasOrder
                ? _orderList
                      .map(
                          (ord) => `
            <button class="btn btn-sm" data-action="navigateToOrder" data-order-id="${ord.id}" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Edytuj zamówienie">
                <i data-lucide="package"></i> Zam. ${escapeHtml(ord.orderNumber || ord.offerNumber || ord.id.substring(0, 8))}
            </button>
            <button class="btn btn-sm" data-action="exportKartaRury" data-order-id="${ord.id}" data-format="pdf" style="background:rgba(var(--danger-rgb),0.15); border:1px solid rgba(var(--danger-rgb),0.3); color:var(--danger-hover); font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Karta budowy PDF">
                <i data-lucide="file-text"></i> Karta PDF
            </button>
            <button class="btn btn-sm" data-action="exportKartaRury" data-order-id="${ord.id}" data-format="docx" style="background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:#93c5fd; font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Karta budowy Word">
                <i data-lucide="edit"></i> Karta Word
            </button>
        `
                      )
                      .join('')
                : ''
        }
        <button class="btn btn-sm btn-danger" data-action="deleteOffer" data-offer-id="${o.id}" title="Usuń" ${canEdit ? '' : 'disabled'}><i data-lucide="trash-2" aria-hidden="true"></i> Usuń</button>
      </div>
    </div>
  `;
        })
        .join('');
    container.innerHTML = renderedList;
    if (window.lucide) lucide.createIcons();
}

async function loadOffer(id) {
    let offer = offers.find((o) => o.id === id);
    let srv = null;
    try {
        const { storageService } = await import('../../shared/StorageService.js');
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
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
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
    setVal('transport-km', normalized.transportKm ?? 100);
    setVal('transport-rate', normalized.transportRate ?? 10);
    currentRuryTransportMode = normalized.transportMode || 'full';
    currentOfferItems = structuredClone(normalized.items || []);

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

    const isAdmin = currentUser && currentUser.role === 'admin';
    const isOwner =
        currentUser &&
        (normalized.userId === currentUser.id || normalized.creatorId === currentUser.id);
    const subUsers = (currentUser && currentUser.subUsers) || [];
    const isPro = currentUser && currentUser.role === 'pro';
    const isSubUserOffer = isPro && subUsers.includes(normalized.userId);
    const canEdit = isAdmin || isOwner || isSubUserOffer;

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

window.loadSavedOfferData = function (doc, id) {
    offers = offers.filter((o) => o.id !== id);
    offers.push({ ...doc, id: id });
    loadOffer(id);
};
