/* ===== OFERTY STUDNIE — LISTA I TELEMETRIA ===== */

/**
 * Pasywne uczenie — wysyła konfiguracje studni do Express (/api/telemetry/ai/config).
 * Fire-and-forget: nie blokuje UI, nie wymaga interakcji użytkownika.
 * @param {Array} wellsArr - tablica studni
 * @param {string} signalType - 'OFFER_SAVE' lub 'ORDER_CONFIRM'
 */
function _sendAcceptanceTelemetry(wellsArr, signalType) {
    if (!Array.isArray(wellsArr) || wellsArr.length === 0) return;
    if (typeof window.telemetryRecordConfig !== 'function') return;
    wellsArr.forEach(function (w) {
        if (!w.config || w.config.length === 0) return;
        try {
            window.telemetryRecordConfig({
                well: w,
                configItems: w.config || [],
                solverSource: w.configSource || 'MANUAL',
                wasAccepted: signalType === 'ORDER_CONFIRM',
                computationMs: 0,
                iterationCount: 0,
                checkedVariants: 0
            });
        } catch (e) {
            // silent
        }
    });
}

function renderSavedOffersStudnie() {
    const container = document.getElementById('saved-offers-list');
    if (!container) return;

    if (offersStudnie.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <h3>Brak zapisanych ofert</h3><p>Utwórz nową ofertę w zakładce "Oferta"</p></div>`;
        return;
    }

    container.innerHTML = offersStudnie
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((o) => {
            const oId = normalizeId(o.id);
            // Oblicz postęp zamówień częściowych
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
                            html += `<span style="color:var(--accent-hover)${isClickable ? '; cursor:pointer' : ''}" ${isClickable ? `data-action="changeOfferUserFromListStudnie" data-offer-id="${oId}"` : ''}><i data-lucide="user" aria-hidden="true"></i> Autor i Opiekun: <strong>${creatorName}</strong></span>`;
                        } else {
                            if (creatorName)
                                html += `<span style="display:inline-block; margin-right:10px; color:#888;"><i data-lucide="pen-tool" aria-hidden="true"></i> Autor: <strong>${creatorName}</strong></span>`;
                            if (assignedName)
                                html += `<span style="color:var(--accent-hover)${isClickable ? '; cursor:pointer' : ''}" ${isClickable ? `data-action="changeOfferUserFromListStudnie" data-offer-id="${oId}"` : ''}><i data-lucide="user" aria-hidden="true"></i> Opiekun: <strong>${assignedName}</strong></span>`;
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
                <button class="btn btn-sm btn-primary" data-action="loadSavedOfferStudnie" data-offer-id="${oId}" title="Wczytaj" style="font-size:0.72rem; padding:0.3rem 0.6rem;">Wczytaj</button>
                <button class="btn btn-sm btn-secondary" style="font-size:0.72rem; padding:0.3rem 0.6rem; background: rgba(var(--danger-rgb), 0.15); border: 1px solid rgba(var(--danger-rgb), 0.3); color: var(--danger-hover); font-weight: 700;" data-action="showUniversalPrintModal" data-offer-id="${oId}" title="Drukuj ofertę / kartę budowy"><i data-lucide="printer" aria-hidden="true"></i> Drukuj</button>
                <button class="btn btn-sm btn-secondary" data-action="exportJSONStudnie" data-offer-id="${oId}" title="Pobierz plik JSON" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="save" aria-hidden="true"></i> JSON</button>
                ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro') ? `<button class="btn btn-sm btn-secondary" data-action="changeOfferUserFromListStudnie" data-offer-id="${oId}" title="Zmień opiekuna" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="user" aria-hidden="true"></i> Opiekun</button>` : ''}
                ${o.history && o.history.length > 0 ? `<button class="btn btn-sm btn-secondary" data-action="showOfferHistoryStudnie" data-offer-id="${oId}" title="Historia zmian" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="hourglass" aria-hidden="true"></i> Historia</button>` : ''}
                <button class="btn btn-sm btn-danger" data-action="deleteOfferStudnie" data-offer-id="${oId}" title="Usuń" style="font-size:0.72rem; padding:0.3rem 0.6rem;"><i data-lucide="trash-2" aria-hidden="true"></i> Usuń</button>
                ${
                    hasOrder
                        ? (() => {
                              const offerOrders = getOrdersForOffer(oId);
                              let buttonsHtml = '';
                              offerOrders.forEach((order) => {
                                  buttonsHtml += `
                                    <button class="btn btn-sm" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.68rem; font-weight:800; padding:0.25rem 0.5rem;" data-action="navigateToOrder" data-order-id="${order.id}" title="Otwórz zamówienie ${order.orderNumber || ''}"><i data-lucide="package" aria-hidden="true"></i> Zamówienie ${order.orderNumber || ''}</button>
                                    <button class="btn btn-sm" style="background:rgba(var(--danger-rgb),0.1); border:1px solid rgba(var(--danger-rgb),0.2); color:var(--danger-hover); font-size:0.6rem; padding:0.25rem 0.4rem;" data-action="deleteOrderStudnie" data-order-id="${order.id}" title="Usuń zamówienie ${order.orderNumber || ''}"><i data-lucide="trash-2"></i></button>
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
                const { storageService } = await import('../../shared/StorageService.js');
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
    var wizardState = normalized.wizard;
    var wizardGlobalParams = wizardState && wizardState.globalParams;
    if (wizardGlobalParams) {
        // Nowa oferta z zapisanym stanem — pełna restauracja kafelków
        document.querySelectorAll('#wizard-step-2 .param-group').forEach(function (group) {
            var paramName = group.getAttribute('data-param');
            if (!paramName || !wizardGlobalParams.hasOwnProperty(paramName)) return;
            var val = wizardGlobalParams[paramName];
            if (!val) return;
            group.querySelectorAll('.param-tile').forEach(function (b) {
                b.classList.remove('active');
            });
            var targetTile = group.querySelector('.param-tile[data-val="' + val + '"]');
            if (targetTile) targetTile.classList.add('active');
            if (typeof wizardConfirmedParams !== 'undefined') {
                wizardConfirmedParams.add(paramName);
            }
        });
        // Obsługa wkładki PEHD (sub-opcje)
        var wkladkaV = wizardGlobalParams.wkladka;
        var subOpts = document.getElementById('wkladka-sub-options');
        if (wkladkaV && wkladkaV !== 'brak') {
            if (subOpts) subOpts.style.display = 'block';
            var cbDennica = document.getElementById('pehd-dennica');
            var cbNadbudowa = document.getElementById('pehd-nadbudowa');
            var cbZwienczenie = document.getElementById('pehd-zwienczenie');
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
        var legacyBanner = document.getElementById('wizard-legacy-banner');
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

async function deleteOfferStudnie(id) {
    if (
        !(await appConfirm('Czy na pewno usunąć tę ofertę?', {
            title: 'Usuwanie oferty',
            type: 'danger'
        }))
    )
        return;
    try {
        const res = await fetch(`/api/offers-studnie/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Błąd usuwania', 'error');
            return;
        }
        offersStudnie = offersStudnie.filter((o) => o.id !== id);
        renderSavedOffersStudnie();
        showToast('Oferta usunięta', 'info');
    } catch (err) {
        logger.error('offerManager', 'deleteOfferStudnie error:', err);
        showToast('Błąd połączenia z serwerem', 'error');
    }
}

window.loadSavedOfferStudnie = loadSavedOfferStudnie;
window.deleteOfferStudnie = deleteOfferStudnie;
