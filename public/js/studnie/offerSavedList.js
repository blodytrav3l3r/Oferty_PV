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
            const progress =
                typeof getOfferOrderProgress === 'function'
                    ? getOfferOrderProgress(oId, o.wells)
                    : { ordered: 0, total: (o.wells || []).length, percent: 0 };

            const hasOrder = progress.ordered > 0;
            const isFullyOrdered = progress.percent >= 100;

            let orderBadge = '';
            if (hasOrder) {
                const badgeColor = isFullyOrdered ? 'var(--success-hover)' : 'var(--blue-hover)';
                const badgeBg = isFullyOrdered
                    ? 'rgba(var(--success-rgb),0.15)'
                    : 'rgba(var(--blue-rgb),0.15)';
                const badgeBorder = isFullyOrdered
                    ? 'rgba(var(--success-rgb),0.4)'
                    : 'rgba(var(--blue-rgb),0.4)';

                orderBadge = `<div style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.6rem; background:${badgeBg}; border:2px solid ${badgeBorder}; border-radius:6px; margin-top:0.3rem;">
                <span style="font-size:0.85rem;"><i data-lucide="${isFullyOrdered ? 'check-circle' : 'package'}"></i></span>
                <span style="font-size:0.68rem; font-weight:800; color:${badgeColor}; text-transform:uppercase; letter-spacing:0.5px;">
                    ${isFullyOrdered ? 'Zrealizowana' : 'W realizacji'} (${progress.ordered}/${progress.total})
                </span>
               </div>`;
            }

            return `
        <div class="offer-list-item" ${hasOrder ? `style="border-left:3px solid ${isFullyOrdered ? 'var(--success-hover)' : 'var(--blue-hover)'};"` : ''}>
            <div class="offer-info" style="min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <h3 style="margin-bottom:0.2rem; word-break:break-all;">${o.number}</h3>
                        ${orderBadge}
                    </div>
                    <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
                        <i data-lucide="banknote" aria-hidden="true"></i> ${fmt(o.totalBrutto)} PLN
                    </div>
                </div>
                <div class="meta" style="margin-top:0.3rem;">
                    <span><i data-lucide="calendar" aria-hidden="true"></i> <strong>${o.date}</strong></span>
                    <span><i data-lucide="folder-open" aria-hidden="true"></i> <strong>${o.wells.length}</strong> studnie</span>
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
                            html += `<span style="color:var(--accent-hover)${isClickable ? '; cursor:pointer' : ''}" ${isClickable ? `onclick="changeOfferUserFromListStudnie('${oId}')"` : ''}><i data-lucide="user" aria-hidden="true"></i> Autor i Opiekun: <strong>${creatorName}</strong></span>`;
                        } else {
                            if (creatorName)
                                html += `<span style="display:inline-block; margin-right:10px; color:#888;"><i data-lucide="pen-tool" aria-hidden="true"></i> Autor: <strong>${creatorName}</strong></span>`;
                            if (assignedName)
                                html += `<span style="color:var(--accent-hover)${isClickable ? '; cursor:pointer' : ''}" ${isClickable ? `onclick="changeOfferUserFromListStudnie('${oId}')"` : ''}><i data-lucide="user" aria-hidden="true"></i> Opiekun: <strong>${assignedName}</strong></span>`;
                        }
                        return html;
                    })()}
                    
                    <div style="display:inline-flex; gap:0.3rem; margin-left:0.5rem; font-size:0.65rem;">
                        <span style="background: rgba(var(--success-hover-rgb), 0.1); color: var(--success-hover); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(var(--success-hover-rgb), 0.3);"><i data-lucide="save"></i> Zapisano</span>
                    </div>
                </div>
                ${
                    o.clientName || o.investName || o.clientContact
                        ? `
                <div class="offer-client-badges">
                    ${o.clientName ? `<div class="badge-client"><i data-lucide="building-2" aria-hidden="true"></i> <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
                    ${o.investName ? `<div class="badge-invest"><i data-lucide="hard-hat" aria-hidden="true"></i> <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
                </div>`
                        : ''
                }
            </div>
            <div class="offer-actions">
                <button class="btn btn-sm btn-primary" onclick="loadSavedOfferStudnie('${oId}')" title="Wczytaj" style="font-size:0.72rem; padding:0.3rem 0.6rem;">Wczytaj</button>
                <button class="btn btn-sm btn-secondary" style="font-size:0.72rem; padding:0.3rem 0.6rem; background: rgba(var(--danger-rgb), 0.15); border: 1px solid rgba(var(--danger-rgb), 0.3); color: var(--danger-hover); font-weight: 700;" onclick="window.showUniversalPrintModal('${oId}')" title="Drukuj ofertę / kartę budowy"><i data-lucide="printer" aria-hidden="true"></i> Drukuj</button>
                <button class="btn btn-sm btn-secondary" onclick="exportJSONStudnie('${oId}')" title="Pobierz plik JSON" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="save" aria-hidden="true"></i> JSON</button>
                ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro') ? `<button class="btn btn-sm btn-secondary" onclick="changeOfferUserFromListStudnie('${oId}')" title="Zmień opiekuna" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="user" aria-hidden="true"></i> Opiekun</button>` : ''}
                ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistoryStudnie('${oId}')" title="Historia zmian" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="hourglass" aria-hidden="true"></i> Historia</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteOfferStudnie('${oId}')" title="Usuń" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="trash-2" aria-hidden="true"></i> Usuń</button>
                ${
                    hasOrder
                        ? (() => {
                              const offerOrders = getOrdersForOffer(oId);
                              let buttonsHtml = '';
                              offerOrders.forEach((order) => {
                                  buttonsHtml += `
                                    <button class="btn btn-sm" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.68rem; font-weight:800; padding:0.25rem 0.5rem;" onclick="window.location.href='studnie.html?order=${order.id}'" title="Otwórz zamówienie ${order.orderNumber || ''}"><i data-lucide="package" aria-hidden="true"></i> Zamówienie ${order.orderNumber || ''}</button>
                                    <button class="btn btn-sm" style="background:rgba(var(--danger-rgb),0.1); border:1px solid rgba(var(--danger-rgb),0.2); color:var(--danger-hover); font-size:0.6rem; padding:0.25rem 0.4rem;" onclick="deleteOrderStudnie('${order.id}')" title="Usuń zamówienie ${order.orderNumber || ''}"><i data-lucide="trash-2"></i></button>
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
