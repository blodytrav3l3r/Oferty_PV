// @ts-check
/* ===== HELPERY CRUD OFERT (RURY) ===== */
/* renderSavedOffers, showOfferHistory — generowanie HTML listy ofert i historii */
/* Zależności: offers, currentUser, escapeHtml, fmt, lucide, showToast, showModal, closeModal (globalne) */

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
        <button class="btn btn-sm btn-primary" onclick="loadOffer('${o.id}')" title="Edytuj" ${canEdit ? '' : 'disabled'}><i data-lucide="pencil" aria-hidden="true"></i> Edytuj</button>
        <button class="btn btn-sm btn-secondary" onclick="duplicateOffer('${o.id}')" title="Duplikuj"><i data-lucide="clipboard-list" aria-hidden="true"></i> Duplikuj</button>
        ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistory('${o.id}')" title="Historia zmian"><i data-lucide="hourglass" aria-hidden="true"></i> Historia</button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="downloadExistingOffer('${o.id}')" title="Pobierz plik JSON"><i data-lucide="save" aria-hidden="true"></i> JSON</button>
        <button class="btn btn-sm btn-secondary" onclick="exportOfferXlsx('${o.id}')" title="Pobierz plik XLSX"><i data-lucide="bar-chart-2" aria-hidden="true"></i> XLSX</button>
        <button class="btn btn-sm btn-success" onclick="exportOfferPDF('${o.id}')" title="PDF"><i data-lucide="file-text" aria-hidden="true"></i> PDF</button>
        ${
            _hasOrder
                ? _orderList
                      .map(
                          (ord) => `
            <button class="btn btn-sm" onclick="window.location.href='rury.html?order=${ord.id}'" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Edytuj zamówienie">
                <i data-lucide="package"></i> Zam. ${escapeHtml(ord.orderNumber || ord.offerNumber || ord.id.substring(0, 8))}
            </button>
            <button class="btn btn-sm" onclick="exportKartaDirectRury_action('${ord.id}', 'pdf')" style="background:rgba(var(--danger-rgb),0.15); border:1px solid rgba(var(--danger-rgb),0.3); color:var(--danger-hover); font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Karta budowy PDF">
                <i data-lucide="file-text"></i> Karta PDF
            </button>
            <button class="btn btn-sm" onclick="exportKartaDirectRury_action('${ord.id}', 'docx')" style="background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:#93c5fd; font-size:0.72rem; padding:0.3rem 0.6rem; font-weight:700;" title="Karta budowy Word">
                <i data-lucide="edit"></i> Karta Word
            </button>
        `
                      )
                      .join('')
                : ''
        }
        <button class="btn btn-sm btn-danger" onclick="deleteOffer('${o.id}')" title="Usuń" ${canEdit ? '' : 'disabled'}><i data-lucide="trash-2" aria-hidden="true"></i> Usuń</button>
      </div>
    </div>
  `;
        })
        .join('');
    container.innerHTML = renderedList;
    if (window.lucide) lucide.createIcons();
}

/* ===== HISTORIA ZMIAN OFERTY ===== */

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
        <h3 id="offer-history-title" style="font-weight:700;"><i data-lucide="hourglass" aria-hidden="true"></i> Historia zmian oferty: ${escapeHtml(offer.number)}</h3>
        <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div style="padding:1rem 0; overflow-y:auto; flex:1;">
        ${historyHtml}
      </div>
    </div>`
    });
    if (window.lucide) lucide.createIcons();
}

window.renderSavedOffers = renderSavedOffers;
window.showOfferHistory = showOfferHistory;
