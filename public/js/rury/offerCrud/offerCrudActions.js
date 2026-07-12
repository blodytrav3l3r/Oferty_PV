// @ts-check
/* ===== CRUD OFERT — AKCJE (CZYSZCZENIE, DUPLIKACJA, USUWANIE, HISTORIA) ===== */
/* Wydzielone z offerCrud.js */
/* Zależności: offers, currentOfferItems, editingOfferId, editingOfferAssignedUserId/Name (globalne) */
/* syncTransportSecurity z offerItemAdd.js; renderOfferItems z offerItemRender.js */
/* renderSavedOffers z offerCrudLoad.js; downloadOfferFile z offerCrudSave.js */
/* saveOffersData z dataService.js; generateOfferNumber z offerItemForm.js */
/* showToast, appConfirm, showModal, closeModal z shared/ui.js; authHeaders z shared/auth.js; fmt, escapeHtml z shared/formatters.js */

function clearOfferForm() {
    editingOfferId = null;
    editingOfferAssignedUserId = null;
    editingOfferAssignedUserName = '';
    editingOfferCreatedByUserId = null;
    editingOfferCreatedByUserName = '';
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
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

function showOfferHistory(id) {
    const offer = offers.find((o) => o.id === id);
    if (!offer || !offer.history || offer.history.length === 0) {
        showToast('Brak historii dla tej oferty', 'info');
        return;
    }

    const historyHtml = offer.history
        .map((h, i) => {
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
            <div style="font-size:0.75rem; color:var(--text-muted);">Zapisana przez: <strong style="color:var(--text-secondary);">${escapeHtml(h.lastEditedBy || h.userName || '—')}</strong></div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Nadpisana przez: <strong style="color:var(--accent);">${escapeHtml(nextState.lastEditedBy || nextState.userName || '—')}</strong></div>
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
              <button class="btn btn-sm btn-secondary" data-action="restoreOfferVersion" data-offer-id="${id}" data-history-index="${i}">Pobierz do edycji</button>
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
        <h3 id="offer-history-title" style="font-weight:700;"><i data-lucide="hourglass" aria-hidden="true"></i> Historia zmian oferty: ${escapeHtml(offer.number)}</h3>
        <button class="btn-icon" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
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

    editingOfferId = offer.id;
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
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
    setVal('transport-km', snapshot.transportKm ?? 100);
    setVal('transport-rate', snapshot.transportRate ?? 10);

    currentOfferItems = structuredClone(snapshot.items || []);
    window.zabezpieczenieTransportuEnabled = true;
    if (typeof updateZabezpieczenieTransportuUI === 'function') updateZabezpieczenieTransportuUI();
    syncTransportSecurity();
    renderOfferItems();

    const navOffer = document.getElementById('nav-offer');
    if (navOffer) navOffer.click();

    if (typeof closeModal === 'function') closeModal();
    if (typeof window.showToast === 'function')
        window.showToast('Wersja z historii wczytana', 'success');
}

if (typeof registerCspAction === 'function') {
    registerCspAction('loadOffer', {
        handler: function ({ offerId }) {
            loadOffer(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('duplicateOffer', {
        handler: function ({ offerId }) {
            duplicateOffer(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('showOfferHistory', {
        handler: function ({ offerId }) {
            showOfferHistory(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('downloadExistingOffer', {
        handler: function ({ offerId }) {
            downloadExistingOffer(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('deleteOffer', {
        handler: function ({ offerId }) {
            deleteOffer(offerId);
        },
        params: ['offerId']
    });
    registerCspAction('navigateToOrder', {
        handler: function ({ orderId }) {
            window.location.href = 'rury.html?order=' + orderId;
        },
        params: ['orderId']
    });
    registerCspAction('exportKartaRury', {
        handler: function ({ orderId, format }) {
            if (typeof exportKartaDirectRury_action === 'function') {
                exportKartaDirectRury_action(orderId, format);
            }
        },
        params: ['orderId', 'format']
    });
    registerCspAction('restoreOfferVersion', {
        handler: function ({ offerId, historyIndex }) {
            restoreOfferVersion(offerId, parseInt(historyIndex, 10));
        },
        params: ['offerId', 'historyIndex']
    });
}
