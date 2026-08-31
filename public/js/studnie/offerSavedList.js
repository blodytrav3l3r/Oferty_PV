/* ===== LISTA ZAPISANYCH OFERT ===== */

function renderSavedOffersStudnie() {
    const container = document.getElementById('saved-offers-list');
    if (!container) return;

    if (offersStudnie.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <h3>Brak zapisanych ofert</h3><p>Utwórz nową ofertę w zakładce "Oferta"</p></div>`;
        return;
    }

    container.innerHTML = [...offersStudnie]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((o) => {
            const oId = normalizeId(o.id);
            const wellsForProgress = Array.isArray(o.wells)
                ? o.wells
                : typeof o.wellCount === 'number'
                  ? Array(o.wellCount).fill({})
                  : [];
            const progress =
                typeof getOfferOrderProgress === 'function'
                    ? getOfferOrderProgress(oId, wellsForProgress)
                    : { ordered: 0, total: (o.wells || []).length, percent: 0 };

            const hasOrder = progress.ordered > 0;
            const isFullyOrdered = progress.percent >= 100;

            let orderBadge = '';
            if (hasOrder) {
                const badgeColor = isFullyOrdered ? 'var(--success-hover)' : 'var(--blue-hover)';
                const badgeBg = isFullyOrdered
                    ? 'rgba(var(--success-rgb), 0.15)'
                    : 'rgba(var(--blue-rgb), 0.15)';
                const badgeBorder = isFullyOrdered
                    ? 'rgba(var(--success-rgb), 0.5)'
                    : 'rgba(var(--blue-rgb), 0.5)';

                orderBadge = `<div style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.6rem; background:${badgeBg}; border:2px solid ${badgeBorder}; border-radius: var(--radius-sm); margin-top:0.3rem;">
                <span style="font-size: var(--fs-lg);"><i data-lucide="${isFullyOrdered ? 'check-circle' : 'package'}"></i></span>
                <span style="font-size: var(--fs-xs); font-weight: var(--fw-extrabold); color:${badgeColor}; text-transform:uppercase; letter-spacing:0.5px;">
                    ${isFullyOrdered ? 'Zrealizowana' : 'W realizacji'} (${progress.ordered}/${progress.total})
                </span>
               </div>`;
            }

            return `
        <div class="offer-list-item" ${hasOrder ? `style="border-left:3px solid ${isFullyOrdered ? 'var(--success-hover)' : 'var(--blue-hover)'};"` : ''}>
            <div class="offer-info min-w-0" >
                <div class="flex-between-wrap">
                    <div class="flex-gap-5-wrap2">
                        <h3 class="mb-02-wb">${escapeHtml(o.number)}</h3>
                        ${orderBadge}
                    </div>
                    <div class="fw-bold-xl-primary-nowrap">
                        <i data-lucide="banknote" aria-hidden="true"></i> ${fmt(o.totalBrutto ?? o.price ?? o.totalPrice ?? 0)} PLN
                    </div>
                </div>
                <div class="meta mt-3" >
                    <span><i data-lucide="calendar" aria-hidden="true"></i> <strong>${escapeHtml(o.date)}</strong></span>
                    <span><i data-lucide="folder-open" aria-hidden="true"></i> <strong>${typeof o.wellCount === 'number' ? o.wellCount : o.wells ? o.wells.length : 0}</strong> studnie</span>
                    ${(() => {
                        const resolveName = (rawName) => {
                            if (!rawName) return '';
                            if (window.globalUsersMap && window.globalUsersMap.has(rawName))
                                return window.globalUsersMap.get(rawName);
                            if (
                                typeof currentUser !== 'undefined' &&
                                currentUser &&
                                (rawName === currentUser.username || rawName === currentUser.id)
                            )
                                return currentUser.displayName || currentUser.username || rawName;
                            return rawName;
                        };
                        const creatorName = resolveName(o.createdByUserName || o.userName);
                        const assignedName = resolveName(o.userName);

                        let html = '';
                        const isClickable =
                            currentUser &&
                            (currentUser.role === 'admin' || currentUser.role === 'pro');
                        if (creatorName === assignedName && creatorName) {
                            html += `<span style="color:var(--accent-hover)${isClickable ? '; cursor:pointer' : ''}" ${isClickable ? `data-action="changeOfferUserFromListStudnie" data-id="${escapeJsStr(oId)}"` : ''}><i data-lucide="user" aria-hidden="true"></i> Autor i Opiekun: <strong>${escapeHtml(creatorName)}</strong></span>`;
                        } else {
                            if (creatorName)
                                html += `<span style="display:inline-block; margin-right:10px; color:var(--slate-500);"><i data-lucide="pen-tool" aria-hidden="true"></i> Autor: <strong>${escapeHtml(creatorName)}</strong></span>`;
                            if (assignedName)
                                html += `<span style="color:var(--accent-hover)${isClickable ? '; cursor:pointer' : ''}" ${isClickable ? `data-action="changeOfferUserFromListStudnie" data-id="${escapeJsStr(oId)}"` : ''}><i data-lucide="user" aria-hidden="true"></i> Opiekun: <strong>${escapeHtml(assignedName)}</strong></span>`;
                        }
                        return html;
                    })()}
                    
                    <div style="display:inline-flex; gap:0.3rem; margin-left:0.5rem; font-size: var(--fs-xs);">
                        <span style="background: rgba(var(--success-rgb), 0.2); color: var(--success-hover); padding: 1px 5px; border-radius: var(--radius-2xs); border: 1px solid rgba(var(--success-rgb), 0.5);"><i data-lucide="save"></i> Zapisano</span>
                    </div>
                </div>
                ${
                    o.clientName || o.investName || o.clientContact
                        ? `
                <div class="offer-client-badges">
                    ${o.clientName ? `<div class="badge-client"><i data-lucide="building-2" aria-hidden="true"></i> <strong>Klient:</strong> <span class="fw-500">${escapeHtml(o.clientName)}</span></div>` : ''}
                    ${o.investName ? `<div class="badge-invest"><i data-lucide="hard-hat" aria-hidden="true"></i> <strong>Budowa:</strong> <span class="fw-500">${escapeHtml(o.investName)}</span></div>` : ''}
                </div>`
                        : ''
                }
            </div>
            <div class="offer-actions">
                <button class="btn btn-sm btn-primary fs-sm-036" data-action="loadSavedOfferStudnie" data-id="${escapeJsStr(oId)}" title="Wczytaj" >Wczytaj</button>
                <button class="btn btn-sm btn-secondary" style="font-size: var(--fs-sm); padding:0.3rem 0.6rem; background: rgba(var(--danger-rgb), 0.15); border: 1px solid rgba(var(--danger-rgb), 0.3); color: var(--danger-hover); font-weight: var(--fw-bold);" data-action="showUniversalPrintModal" data-id="${escapeJsStr(oId)}" title="Drukuj ofertę / kartę budowy"><i data-lucide="printer" aria-hidden="true"></i> Drukuj</button>
                <button class="btn btn-sm btn-secondary fs-sm-036" data-action="exportJSONStudnie" data-id="${escapeJsStr(oId)}" title="Pobierz plik JSON" ><i data-lucide="save" aria-hidden="true"></i> JSON</button>
                ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro') ? `<button class="btn btn-sm btn-secondary fs-sm-036" data-action="changeOfferUserFromListStudnie" data-id="${escapeJsStr(oId)}" title="Zmień opiekuna" ><i data-lucide="user" aria-hidden="true"></i> Opiekun</button>` : ''}
                ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary fs-sm-036" data-action="showOfferHistoryStudnie" data-id="${escapeJsStr(oId)}" title="Historia zmian" ><i data-lucide="hourglass" aria-hidden="true"></i> Historia</button>` : ''}
                <button class="btn btn-sm btn-secondary fs-sm-036" data-action="shareOfferStudnie" data-id="${escapeJsStr(oId)}" title="Udostępnij" aria-label="Udostępnij"><i data-lucide="share-2" aria-hidden="true"></i> Udostępnij</button>
                <button class="btn btn-sm btn-danger fs-sm-036" data-action="deleteOfferStudnie" data-id="${escapeJsStr(oId)}" title="Usuń" ><i data-lucide="trash-2" aria-hidden="true"></i> Usuń</button>
                ${
                    hasOrder
                        ? (() => {
                              const offerOrders = getOrdersForOffer(oId);
                              let buttonsHtml = '';
                              offerOrders.forEach((order) => {
                                  buttonsHtml += `
                                    <button class="btn btn-sm" style="background:rgba(var(--success-rgb), 0.15); border:1px solid rgba(var(--success-rgb), 0.3); color:var(--success-hover); font-size: var(--fs-xs); font-weight: var(--fw-extrabold); padding:0.25rem 0.5rem;" data-action="openOrderStudnie" data-id="${escapeJsStr(order.id)}" title="Otwórz zamówienie ${escapeHtmlAttr(order.orderNumber || '')}"><i data-lucide="package" aria-hidden="true"></i> Zamówienie ${escapeHtml(order.orderNumber || '')}</button>
                                    <button class="btn btn-sm" style="background:rgba(var(--danger-rgb), 0.1); border:1px solid rgba(var(--danger-rgb), 0.2); color:var(--danger-hover); font-size: var(--fs-2xs); padding:0.25rem 0.4rem;" data-action="deleteOrderStudnie" data-id="${escapeJsStr(order.id)}" title="Usuń zamówienie ${escapeHtmlAttr(order.orderNumber || '')}"><i data-lucide="trash-2"></i></button>
                                `;
                              });
                              return buttonsHtml;
                          })()
                        : ''
                }
            </div>
        </div>
        `;
        })
        .join('');
}

/* ===== Delegacja kliknięć (data-action) — TASK-036 ===== */
if (typeof document !== 'undefined' && !window.__oslDelegated) {
    window.__oslDelegated = true;
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action') || '';
        const id = el.getAttribute('data-id');
        if (action === 'changeOfferUserFromListStudnie') {
            window.changeOfferUserFromListStudnie(id);
        } else if (action === 'loadSavedOfferStudnie') {
            window.loadSavedOfferStudnie(id);
        } else if (action === 'showUniversalPrintModal') {
            window.showUniversalPrintModal(id);
        } else if (action === 'exportJSONStudnie') {
            window.exportJSONStudnie(id);
        } else if (action === 'showOfferHistoryStudnie') {
            window.showOfferHistoryStudnie(id);
        } else if (action === 'deleteOfferStudnie') {
            window.deleteOfferStudnie(id);
        } else if (action === 'openOrderStudnie') {
            window.location.href = 'studnie.html?order=' + id;
        } else if (action === 'shareOfferStudnie') {
            if (window.openShareModal) window.openShareModal('offer_studnie', id);
        } else if (action === 'deleteOrderStudnie') {
            window.deleteOrderStudnie(id);
        }
    });
}

/* ===== Rejestracja globali ===== */
window.renderSavedOffersStudnie = renderSavedOffersStudnie;
