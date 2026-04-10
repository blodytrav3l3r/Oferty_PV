/* ===== ORDERS STUDNIE (Zamówienia) ===== */
async function loadOrdersStudnie() {
    try {
        const res = await fetch('/api/orders-studnie', { headers: authHeaders() });
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        console.error('Błąd ładowania zamówień studni:', err);
        return [];
    }
}

async function saveOrdersDataStudnie(data) {
    try {
        await fetch('/api/orders-studnie', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
    } catch (err) {
        console.error('Błąd zapisu zamówień studni:', err);
    }
}

async function createOrderFromOffer() {
    // Prevent UI race conditions if user double clicked or clicked Zamówienie while Save was running
    if (isSavingOffer) {
        showToast('Trwa zapisywanie...', 'info');
        while (isSavingOffer) {
            await new Promise((r) => setTimeout(r, 200));
        }
    } else {
        // Auto-save the offer to ensure latest state is pushed to SQLite and state is refreshed
        const saveOk = await saveOfferStudnie();
        if (!saveOk) return; // Save failed or locked
    }

    const number = document.getElementById('offer-number').value.trim();
    if (!number) {
        showToast('Błąd: Brak numeru oferty', 'error');
        return;
    }
    if (!editingOfferIdStudnie) {
        showToast('Błąd krytyczny: Brak ID oferty po zapisie', 'error');
        return;
    }

    // Ostrzeżenie że oferta zostanie zablokowana
    if (
        !(await appConfirm(
            'Po utworzeniu zamówienia oferta zostanie zablokowana do edycji.\nDalsze zmiany będą możliwe tylko w zamówieniu.\n\nKontynuować?',
            { title: 'Tworzenie zamówienia', type: 'warning' }
        ))
    )
        return;

    console.log('[createOrderFromOffer] editingOfferIdStudnie =', editingOfferIdStudnie);
    console.log('[createOrderFromOffer] offersStudnie count =', offersStudnie.length);
    const offer = offersStudnie.find((o) => o.id === editingOfferIdStudnie);
    console.log('[createOrderFromOffer] offer found =', !!offer);

    if (!offer) {
        showToast(
            'Nie znaleziono oferty (ID: ' +
                editingOfferIdStudnie +
                ', total: ' +
                offersStudnie.length +
                ')',
            'error'
        );
        return;
    }

    const oId = normalizeId(offer.id);
    // Check if order already exists
    const existingOrder = ordersStudnie
        ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId)
        : null;
    if (existingOrder) {
        if (
            !(await appConfirm(
                'Zamówienie dla tej oferty już istnieje. Czy chcesz utworzyć nowe (nadpisze poprzednie)?',
                { title: 'Nadpisanie zamówienia', type: 'warning' }
            ))
        )
            return;
        ordersStudnie = ordersStudnie
            ? ordersStudnie.filter((o) => normalizeId(o.offerId) !== oId)
            : [];
    }

    // Determine assigned user for order numbering — default to offer's opiekun
    let assignedUserId = offer.userId || (currentUser ? currentUser.id : null);
    let assignedUserName =
        offer.userName ||
        (currentUser
            ? currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username
            : '');

    // If pro or admin — ask which user to assign the order to
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')) {
        try {
            const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
            const usersData = await usersResp.json();
            const allUsers = usersData.data || [];

            if (allUsers.length > 0) {
                const selectedUser = await showUserSelectionPopup(allUsers, assignedUserId);
                if (selectedUser === null) {
                    showToast('Anulowano tworzenie zamówienia', 'info');
                    return;
                }
                assignedUserId = selectedUser.id;
                assignedUserName =
                    selectedUser.firstName && selectedUser.lastName
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.displayName || selectedUser.username;
            }
        } catch (e) {
            console.error('Błąd pobierania użytkowników:', e);
        }
    }

    // Claim order number from server
    let orderNumber = '';
    try {
        const claimResp = await fetch('/api/orders-studnie/claim-number/' + assignedUserId, {
            method: 'POST',
            headers: authHeaders()
        });
        const claimData = await claimResp.json();
        if (claimResp.ok && claimData.number) {
            orderNumber = claimData.number;
        } else {
            showToast('Błąd generowania numeru zamówienia: ' + (claimData.error || ''), 'error');
            return;
        }
    } catch (e) {
        showToast('Błąd połączenia przy generowaniu numeru zamówienia', 'error');
        return;
    }

    // Create order from offer — deep copy everything, save original snapshot
    const order = {
        id: 'order_studnie_' + Date.now(),
        offerId: offer.id,
        offerNumber: offer.number,
        userId: assignedUserId,
        userName: assignedUserName,
        number: offer.number,
        orderNumber: orderNumber,
        date: offer.date,
        clientName: offer.clientName,
        clientNip: offer.clientNip,
        clientAddress: offer.clientAddress,
        clientContact: offer.clientContact,
        investName: offer.investName,
        investAddress: offer.investAddress,
        investContractor: offer.investContractor,
        notes: offer.notes,
        wells: JSON.parse(JSON.stringify(offer.wells)),
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        originalSnapshot: JSON.parse(JSON.stringify(offer.wells)), // frozen copy for diff
        transportKm: offer.transportKm,
        transportRate: offer.transportRate,
        totalWeight: offer.totalWeight,
        totalNetto: offer.totalNetto,
        totalBrutto: offer.totalBrutto,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser ? currentUser.username : ''
    };

    // Freeze prices on the order wells at the moment of creation
    freezeWellPrices(order.wells);

    // Mark the offer as having an order
    offer.hasOrder = true;
    offer.orderId = order.id;
    await saveOffersDataStudnie(offersStudnie);

    if (!ordersStudnie) ordersStudnie = [];
    ordersStudnie.push(order);
    await saveOrdersDataStudnie(ordersStudnie);
    renderSavedOffersStudnie();

    showToast(`📦 Zamówienie ${orderNumber} utworzone z oferty ${offer.number}`, 'success');

    // Open order in the same window (uses main studnie editor in order mode)
    window.location.href = '/studnie?order=' + order.id;
}

function saveOrderStudnie() {
    if (!editingOfferIdStudnie) return;
    const offer = offersStudnie.find((o) => o.id === editingOfferIdStudnie);
    if (!offer) return;
    const oId = normalizeId(offer.id);
    const order = ordersStudnie ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId) : null;
    if (!order) return;

    // Freeze prices on all elements before saving
    freezeWellPrices(wells);

    // Update order wells with current wells state (prices already frozen)
    order.wells = JSON.parse(JSON.stringify(wells));
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    // Recalculate totals
    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;
    order.totalNetto = totalNetto;
    order.totalBrutto = totalNetto * 1.23;

    saveOrdersDataStudnie(ordersStudnie);
    showToast('📦 Zamówienie zaktualizowane', 'success');
}

/** Freeze current prices on all config items and przejscia in every well */
function freezeWellPrices(wellsArr) {
    (wellsArr || []).forEach((well) => {
        // Freeze config items (kręgi, dennicy, konusy, etc.)
        (well.config || []).forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;
            item.frozenPrice = getItemAssessedPrice(well, p, true);
            item.frozenPriceBase = getItemAssessedPrice(well, p, false);
            item.frozenName = p.name;
        });

        // Freeze przejscia prices
        let discNadbudowa = 0;
        if (well.dn && wellDiscounts[well.dn]) {
            discNadbudowa = wellDiscounts[well.dn].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        (well.przejscia || []).forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;
            const bP = p.price || 0;
            item.frozenPrice = bP * mult;
            item.frozenPriceBase = bP;
            item.frozenName = p.name || p.category;
        });
    });
}

async function deleteOrderStudnie(orderId) {
    // Sprawdź, czy zamówienie ma zaakceptowane zlecenia produkcyjne
    const order = ordersStudnie ? ordersStudnie.find((o) => o.id === orderId) : null;
    if (order) {
        const acceptedPOs = (productionOrders || []).filter(
            (po) => po.offerId === order.offerId && po.status === 'accepted'
        );
        if (acceptedPOs.length > 0) {
            showToast(
                '❌ Nie można usunąć zamówienia — zawiera zaakceptowane zlecenia produkcyjne. Najpierw cofnij ich akceptację.',
                'error'
            );
            return;
        }
    }

    if (
        !(await appConfirm('Czy na pewno usunąć to zamówienie?', {
            title: 'Usuwanie zamówienia',
            type: 'danger'
        }))
    )
        return;

    // API Call to delete order physically
    try {
        const res = await fetch(`/api/orders-studnie/${orderId}`, {
            method: 'DELETE',
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.error || 'Błąd usuwania zamówienia', 'error');
            return;
        }
    } catch (e) {
        console.error('Błąd usuwania zamówienia przez API:', e);
        showToast('Błąd połączenia z serwerem', 'error');
        return;
    }

    let affectedOfferId = null;
    if (order) {
        affectedOfferId = normalizeId(order.offerId);
        // Remove hasOrder flag from offer
        const offer = offersStudnie.find((o) => normalizeId(o.id) === affectedOfferId);
        if (offer) {
            offer.hasOrder = false;
            delete offer.orderId;
            saveOffersDataStudnie(offersStudnie);
        }
    }
    if (ordersStudnie) {
        ordersStudnie = ordersStudnie.filter((o) => o.id !== orderId);
        saveOrdersDataStudnie(ordersStudnie);
    }
    renderSavedOffersStudnie();
    showToast('Zamówienie usunięte. Oferta odblokowana.', 'info');

    // Refresh main config if open
    if (typeof renderWellConfig === 'function') renderWellConfig();

    // Jeśli usunięte zamówienie dotyczy aktualnie otwartej oferty w edytorze, odśwież widok
    if (affectedOfferId && editingOfferIdStudnie === affectedOfferId) {
        refreshAll();
    }

    // Refresh UI list globally
    if (window.pvSalesUI) {
        window.pvSalesUI.loadOrdersMap().then(() => window.pvSalesUI.filterLocalOffers());
    }
}

/** Compare current order wells vs originalSnapshot, return changes map */
function getOrderChanges(order) {
    if (!order || !order.originalSnapshot) return {};
    const changes = {}; // { wellIndex: { type: 'modified'|'added'|'removed', fields: [...] } }
    const orig = order.originalSnapshot;
    const curr = order.wells;

    const maxLen = Math.max(orig.length, curr.length);
    for (let i = 0; i < maxLen; i++) {
        if (i >= orig.length) {
            changes[i] = { type: 'added' };
            continue;
        }
        if (i >= curr.length) {
            changes[i] = { type: 'removed', name: orig[i].name };
            continue;
        }
        const o = orig[i],
            c = curr[i];
        const diffs = [];

        // Compare config (components) - order doesn't matter, only productId and total quantity
        const getConfigCounts = (conf) => {
            const counts = {};
            (conf || []).forEach((item) => {
                if (!item.productId) return;
                counts[item.productId] = (counts[item.productId] || 0) + (item.quantity || 1);
            });
            return counts;
        };
        const oCounts = getConfigCounts(o.config);
        const cCounts = getConfigCounts(c.config);

        // Compare objects by keys and values
        const oKeys = Object.keys(oCounts).sort();
        const cKeys = Object.keys(cCounts).sort();

        let configDiff = oKeys.length !== cKeys.length;
        if (!configDiff) {
            for (let k of oKeys) {
                if (oCounts[k] !== cCounts[k]) {
                    configDiff = true;
                    break;
                }
            }
        }
        if (configDiff) diffs.push('config');

        // Compare przejscia (ignoring angle, angleExecution, angleGony)
        const cleanPrzejscia = (arr) =>
            (arr || []).map((p) => ({
                productId: p.productId,
                rzednaWlaczenia: p.rzednaWlaczenia,
                notes: p.notes
            }));
        if (
            JSON.stringify(cleanPrzejscia(o.przejscia)) !==
            JSON.stringify(cleanPrzejscia(c.przejscia))
        ) {
            diffs.push('przejscia');
        }

        // Compare params
        const paramKeys = [
            'nadbudowa',
            'dennicaMaterial',
            'wkladka',
            'klasaBetonu',
            'agresjaChemiczna',
            'agresjaMrozowa',
            'malowanieW',
            'malowanieZ',
            'kineta',
            'redukcjaKinety',
            'stopnie',
            'spocznikH',
            'usytuowanie'
        ];
        paramKeys.forEach((key) => {
            if ((o[key] || '') !== (c[key] || '')) diffs.push(key);
        });

        // Compare basic fields & elevations
        if ((o.dn || 0) !== (c.dn || 0)) diffs.push('dn');
        if ((o.name || '') !== (c.name || '')) diffs.push('name');
        if (
            (o.rzednaWlazu == null ? '' : o.rzednaWlazu) !==
            (c.rzednaWlazu == null ? '' : c.rzednaWlazu)
        )
            diffs.push('rzednaWlazu');
        if ((o.rzednaDna == null ? '' : o.rzednaDna) !== (c.rzednaDna == null ? '' : c.rzednaDna))
            diffs.push('rzednaDna');

        if (diffs.length > 0) {
            changes[i] = { type: 'modified', fields: diffs };
        }
    }
    return changes;
}

/** Check if current offer has an active order */
function getCurrentOfferOrder() {
    if (orderEditMode) return orderEditMode.order;
    if (!editingOfferIdStudnie) return null;
    return ordersStudnie
        ? ordersStudnie.find((o) => o.offerId === editingOfferIdStudnie) || null
        : null;
}

/** Enter order editing mode — loads order into main editor */
async function enterOrderEditMode(orderId) {
    try {
        console.log('[enterOrderEditMode] START orderId=', orderId);
        const res = await fetch(`/api/orders-studnie/${orderId}`, { headers: authHeaders() });
        if (!res.ok) {
            showToast('Zamówienie nie znalezione', 'error');
            return;
        }
        const json = await res.json();
        const order = json.data;
        if (!order) {
            showToast('Zamówienie nie znalezione', 'error');
            return;
        }

        console.log(
            '[enterOrderEditMode] order loaded, wells count:',
            order.wells ? order.wells.length : 'NO WELLS'
        );

        orderEditMode = { orderId: order.id, order: order };
        editingOfferIdStudnie = order.offerId || null;

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        // Load wells from order — ensure wells is always an array
        wells = Array.isArray(order.wells) ? JSON.parse(JSON.stringify(order.wells)) : [];
        migrateWellData(wells);

        // Double-ensure every well has config and przejscia arrays
        wells.forEach((w) => {
            if (!Array.isArray(w.config)) w.config = [];
            if (!Array.isArray(w.przejscia)) w.przejscia = [];
        });

        console.log('[enterOrderEditMode] wells migrated, count:', wells.length);

        // Automatyczne odblokowanie widoku kategorii dla użytych przejść
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

        wellCounter = wells.length;
        currentWellIndex = 0;

        // Fill client/offer fields
        document.getElementById('offer-number').value = order.number || '';
        document.getElementById('offer-date').value =
            order.date || new Date().toISOString().slice(0, 10);
        document.getElementById('client-name').value = order.clientName || '';
        document.getElementById('client-nip').value = order.clientNip || '';
        document.getElementById('client-address').value = order.clientAddress || '';
        document.getElementById('client-contact').value = order.clientContact || '';
        document.getElementById('invest-name').value = order.investName || '';
        document.getElementById('invest-address').value = order.investAddress || '';
        document.getElementById('invest-contractor').value = order.investContractor || '';

        console.log('[enterOrderEditMode] fields filled, calling skipWizardToStep3...');

        // Skip wizard → go to step 3 (config)
        skipWizardToStep3();
        showSection('builder');

        console.log('[enterOrderEditMode] calling refreshAll...');
        // Update UI
        refreshAll();

        console.log('[enterOrderEditMode] calling renderOrderModeBanner...');
        // Show order mode banner
        renderOrderModeBanner();

        // Update page title
        document.title = `📦 Zamówienie: ${order.number || orderId}`;

        console.log('[enterOrderEditMode] DONE');
        showToast('📦 Zamówienie wczytane do edycji', 'success');
    } catch (err) {
        console.error('Błąd ładowania zamówienia:', err);
        console.error('Stack:', err.stack);
        showToast('Błąd ładowania zamówienia: ' + err.message, 'error');
    }
}

window.isPreviewMode = false;

window.applyPreviewLockUI = function () {
    let banner = document.getElementById('preview-lock-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'preview-lock-banner';
        banner.innerHTML = `
            <div style="position:fixed; top:2rem; left:50%; transform:translateX(-50%); background:rgba(15, 23, 42, 0.95); border:2px solid #fbbf24; color:#fbbf24; padding:0.8rem 2.5rem; border-radius:40px; z-index:99999; box-shadow:0 20px 40px rgba(0,0,0,0.6); font-weight:800; display:flex; align-items:center; gap:1.5rem; backdrop-filter:blur(10px);">
                <span style="font-size:1.2rem;">👁️ HISTORIA — TYLKO DO ODCZYTU</span>
                <button onclick="window.exitPreviewMode()" class="btn btn-sm" style="background:#fbbf24; color:#000; border:none; padding:0.4rem 1rem; border-radius:20px; font-weight:700;">ZAMKNIJ PODGLĄD</button>
            </div>
        `;
        document.body.appendChild(banner);
    }

    // Zablokuj edycje elementow drag & drop formularza studni
    document
        .querySelectorAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar')
        .forEach((el) => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.7';
        });

    // Podmień funkcje zapisu by zablokować i pokazać toast
    const originalSaveOrder = window.saveCurrentOrder;
    window.saveCurrentOrder = async () => {
        if (window.isPreviewMode)
            showToast('Zapisywanie w trybie podglądu jest zablokowane', 'error');
        else if (originalSaveOrder) await originalSaveOrder();
    };
    const originalSaveOffer = window.saveOfferStudnie;
    window.saveOfferStudnie = async () => {
        if (window.isPreviewMode) {
            showToast('Zapisywanie w trybie podglądu jest zablokowane', 'error');
            return false;
        } else if (originalSaveOffer) return await originalSaveOffer();
    };

    window.isPreviewMode = true;
};

window.exitPreviewMode = function () {
    window.location.reload(); // Najszybszy i najbezpieczniejszy powrót po przeglądaniu JSONów z historii
};

async function loadOrderSnapshot(rebuiltData, orderId) {
    try {
        const order = rebuiltData;
        orderEditMode = { orderId: orderId, order: order };
        editingOfferIdStudnie = order.offerId || null;

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        wells = Array.isArray(order.wells) ? JSON.parse(JSON.stringify(order.wells)) : [];
        if (typeof migrateWellData === 'function') migrateWellData(wells);
        wells.forEach((w) => {
            if (!Array.isArray(w.config)) w.config = [];
            if (!Array.isArray(w.przejscia)) w.przejscia = [];

            if (w.przejscia) {
                w.przejscia.forEach((pr) => {
                    const prod =
                        typeof studnieProducts !== 'undefined'
                            ? studnieProducts.find((p) => p.id === pr.productId)
                            : null;
                    if (prod && prod.category) visiblePrzejsciaTypes.add(prod.category);
                });
            }
        });

        wellCounter = wells.length > 0 ? wells.length : 1;
        currentWellIndex = 0;

        document.getElementById('offer-number').value = order.number || '';
        document.getElementById('offer-date').value =
            order.date || new Date().toISOString().slice(0, 10);
        document.getElementById('client-name').value = order.clientName || '';
        document.getElementById('client-nip').value = order.clientNip || '';
        document.getElementById('client-address').value = order.clientAddress || '';
        document.getElementById('client-contact').value = order.clientContact || '';
        document.getElementById('invest-name').value = order.investName || '';
        document.getElementById('invest-address').value = order.investAddress || '';
        document.getElementById('invest-contractor').value = order.investContractor || '';

        if (typeof skipWizardToStep3 === 'function') skipWizardToStep3();
        if (typeof showSection === 'function') showSection('builder');
        if (typeof refreshAll === 'function') refreshAll();

        renderOrderModeBanner();
        document.title = `👁️ PODGLĄD Zamówienia: ${order.number || orderId}`;

        window.applyPreviewLockUI();
    } catch (err) {
        window.isPreviewMode = false;
        console.error('Błąd ładowania podglądu zamówienia:', err);
        showToast('Błąd ładowania podglądu zamówienia', 'error');
    }
}
window.loadOrderSnapshot = loadOrderSnapshot;

function renderOrderModeBanner() {
    let banner = document.getElementById('order-mode-banner');
    if (!banner) {
        // Create banner div at the top of the center column
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        banner = document.createElement('div');
        banner.id = 'order-mode-banner';
        centerCol.insertBefore(banner, centerCol.firstChild);
    }

    if (!orderEditMode) {
        banner.style.display = 'none';
        return;
    }

    const order = orderEditMode.order;
    // Compute changes vs current wells
    const tempOrder = { ...order, wells: wells };
    const changes = getOrderChanges({ ...order, wells: wells });
    const changeCount = Object.keys(changes).length;
    const hasChanges = changeCount > 0;

    banner.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
        padding:0.6rem 1rem; margin-bottom:0.6rem; border-radius:10px;
        background: ${hasChanges ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))' : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.06))'};
        border: 1px solid ${hasChanges ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'};
    `;

    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:1.2rem;">📦</span>
            <div>
                <div style="font-size:0.78rem; font-weight:800; color:${hasChanges ? '#f87171' : '#34d399'};">
                    TRYB ZAMÓWIENIA — ${order.number || ''}
                </div>
                <div style="font-size:0.62rem; color:var(--text-muted);">
                    ${hasChanges ? `⚠️ ${changeCount} studni zmienionych od oryginału` : '✅ Bez zmian od oryginału'}
                    • Utworzono: ${new Date(order.createdAt).toLocaleString('pl-PL')}
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
            <button class="btn btn-sm" onclick="saveCurrentOrder()" style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.7rem; font-weight:700; padding:0.3rem 0.7rem;">
                💾 Zapisz zamówienie
            </button>
        </div>
    `;
}

async function saveCurrentOrder() {
    if (!orderEditMode) {
        showToast('Brak trybu zamówienia', 'error');
        return;
    }

    const order = orderEditMode.order;

    // Freeze prices on all elements before saving
    freezeWellPrices(wells);

    // Update order with current wells (prices already frozen)
    order.wells = JSON.parse(JSON.stringify(wells));
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    // Recalculate totals
    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;
    order.totalNetto = totalNetto;
    order.totalBrutto = totalNetto * 1.23;

    // Save via PATCH
    try {
        await fetch(`/api/orders-studnie/${order.id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({
                wells: order.wells,
                updatedAt: order.updatedAt,
                totalWeight: order.totalWeight,
                totalNetto: order.totalNetto,
                totalBrutto: order.totalBrutto
            })
        });
        showToast('📦 Zamówienie zapisane', 'success');
        renderOrderModeBanner();
    } catch (err) {
        console.error('Błąd zapisu zamówienia:', err);
        showToast('Błąd zapisu zamówienia', 'error');
    }
}

window.createOrderFromOffer = createOrderFromOffer;
window.saveOrderStudnie = saveOrderStudnie;
window.saveCurrentOrder = saveCurrentOrder;
window.deleteOrderStudnie = deleteOrderStudnie;

/** Synchronizuje zmiany z ofertą lub zamówieniem w zależności od trybu edycji */
async function syncSourceData() {
    let synced = '';
    try {
        if (typeof window.saveOfferStudnie === 'function') {
            const offerSaved = await window.saveOfferStudnie();
            if (offerSaved) synced += 'Oferta';
        }
        if (typeof orderEditMode !== 'undefined' && orderEditMode) {
            if (typeof window.saveCurrentOrder === 'function') {
                await window.saveCurrentOrder();
                synced += (synced ? ' + ' : '') + 'Zamówienie';
            }
        }
    } catch (err) {
        console.error('syncSourceData error:', err);
    }
    return synced;
}
window.syncSourceData = syncSourceData;

/* ===== ZLECENIA PRODUKCYJNE (Production Orders) ===== */
let productionOrders = [];
let zleceniaElementsList = []; // [{wellIndex, elementIndex, well, product, configItem}]
let zleceniaSelectedIdx = -1;
let zleceniaActiveFilter = 'all'; // 'all' | 'saved' | 'accepted'

/** Returns element status: 'accepted', 'saved', or 'open' */
function getElementStatus(el) {
    const savedOrder = (productionOrders || []).find(
        (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
    );
    if (savedOrder && savedOrder.status === 'accepted') return 'accepted';
    if (savedOrder) return 'saved';
    return 'open';
}

/** Set active filter for zlecenia elements list */
function setZleceniaFilter(filter) {
    zleceniaActiveFilter = filter;
    document.querySelectorAll('.zlecenia-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderZleceniaList();
}

async function loadProductionOrders() {
    try {
        const resp = await fetch('/api/orders-studnie/production', { headers: authHeaders() });
        if (resp.ok) {
            const json = await resp.json();
            productionOrders = json.data || [];
        }
    } catch (e) {
        console.error('loadProductionOrders error:', e);
    }
}

async function saveProductionOrdersData(data) {
    const results = [];
    for (const po of data) {
        try {
            const res = await fetch('/api/orders-studnie/production', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(po)
            });
            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error || 'Server error');
            results.push(resData);
        } catch (e) {
            console.error('saveProductionOrdersData error:', e);
            throw e; // Rethrow to handle in caller
        }
    }
    return results;
}

function parseWysokoscGlebokosc(productName) {
    // Parse "H=450/300" from product name like "Dennica DN1000 H=450/300"
    const m = productName && productName.match(/H\s*=\s*(\d+)\s*\/\s*(\d+)/i);
    if (m) return { wysokosc: parseInt(m[1]), glebokosc: parseInt(m[2]) };
    return { wysokosc: 0, glebokosc: 0 };
}

function getStudniaDIN(dn) {
    if ([1000, 1200].includes(dn)) return 'AT/2009-03-1733';
    if ([1500, 2000, 2500].includes(dn)) return 'PN-EN 1917:2004';
    return 'AT/2009-03-1733'; // default for krag_ot
}

function calcStopnieExecution(angle) {
    const a = parseFloat(angle) || 0;
    return a > 0 ? 360 - a : 0;
}

/**
 * Build a snapshot of etykieta elements from well config.
 * Stored with the PO so the registry can print labels without studnieProducts context.
 */
function buildEtykietaElementsSnapshot(well) {
    const config = well.config || [];
    const findProduct = (id) =>
        typeof studnieProducts !== 'undefined' ? studnieProducts.find((p) => p.id === id) : null;
    const countMap = new Map();

    config.forEach((item) => {
        const productId = item.productId || item.id;
        const product = findProduct(productId);
        if (!product) return;
        if (product.componentType === 'kineta' || product.componentType === 'wlaz') return;

        if (countMap.has(product.id)) {
            countMap.get(product.id).count++;
        } else {
            countMap.set(product.id, {
                count: 1,
                indeks: product.id || '',
                nazwa: product.name || ''
            });
        }
    });

    // Add uszczelka if applicable
    if (typeof studnieProducts !== 'undefined') {
        const uszczelka = studnieProducts.find(
            (p) =>
                p.category === 'uszczelka' &&
                (String(p.dn) === String(well.dn) ||
                    p.name?.includes('DN ' + well.dn) ||
                    p.name?.includes('DN' + well.dn))
        );
        if (uszczelka && config.length > 1) {
            countMap.set('_seal_' + uszczelka.id, {
                count: config.length,
                indeks: uszczelka.id || '',
                nazwa: uszczelka.name || `USZCZELKI DO STUDNI DN ${well.dn}MM`
            });
        }
    }

    const items = [];
    countMap.forEach((val) =>
        items.push({ ilosc: val.count + ' szt.', indeks: val.indeks, nazwa: val.nazwa })
    );
    return items;
}

function openZleceniaProdukcyjne(targetWellId = null, targetElementIndex = null) {
    console.log('[openZleceniaProdukcyjne] Initializing modal...', {
        targetWellId,
        targetElementIndex,
        wellsCount: wells.length,
        productsCount: studnieProducts.length
    });

    if (wells.length === 0) {
        showToast('Najpierw dodaj studnie lub wczytaj ofertę/zamówienie!', 'error');
        return;
    }
    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.add('active');

    // MOVEMENT OF MAIN SVG DIAGRAM TO MODAL
    const zwp = document.querySelector('.zlecenia-left');
    const dz = document.getElementById('drop-zone-diagram');
    if (zwp && dz) {
        zwp.innerHTML = ''; // clear original preview container
        zwp.appendChild(dz);
        dz.style.flex = '1';
        dz.style.border = 'none'; // remove outer border if any
        dz.style.background = 'transparent';
        dz.style.padding = '0.8rem 1.2rem'; // Match modal side-padding
    }

    buildZleceniaWellList();

    // Auto select target element if provided, otherwise first element
    if (zleceniaElementsList.length > 0) {
        let idxToSelect = 0;
        let foundIdx = -1;

        if (targetWellId) {
            foundIdx = zleceniaElementsList.findIndex(
                (el) =>
                    String(el.well.id) === String(targetWellId) &&
                    String(el.elementIndex) === String(targetElementIndex)
            );
            if (foundIdx === -1) {
                foundIdx = zleceniaElementsList.findIndex(
                    (el) => String(el.well.id) === String(targetWellId)
                );
            }
        } else if (targetElementIndex !== null) {
            foundIdx = zleceniaElementsList.findIndex(
                (el) => String(el.elementIndex) === String(targetElementIndex)
            );
        }

        if (foundIdx !== -1) {
            idxToSelect = foundIdx;
        }

        selectZleceniaElement(idxToSelect);
    }
}

async function closeZleceniaModal() {
    // Zapytaj użytkownika czy zapisać zmiany przed zamknięciem
    if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
        const shouldSave = await appConfirm('Czy zapisać zmiany przed zamknięciem?', {
            title: 'Zamknięcie zlecenia',
            type: 'warning',
            okText: '💾 Zapisz i zamknij',
            cancelText: 'Zamknij bez zapisu'
        });
        if (shouldSave) {
            await saveProductionOrder();
        }
    }

    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.remove('active');

    // RESTORE MAIN SVG DIAGRAM TO MAIN LAYOUT
    const mainLayout = document.querySelector('.well-app-layout');
    const dz = document.getElementById('drop-zone-diagram');
    if (mainLayout && dz) {
        dz.style.flex = '';
        dz.style.border = '';
        dz.style.background = '';
        dz.style.padding = ''; // Reset inline padding
        mainLayout.insertBefore(dz, mainLayout.firstChild);
    }
}

function buildZleceniaWellList() {
    console.log('[buildZleceniaWellList] Building list from', wells.length, 'wells');
    zleceniaElementsList = [];
    wells.forEach((well, wIdx) => {
        if (!well.config) return;
        for (let eIdx = well.config.length - 1; eIdx >= 0; eIdx--) {
            const item = well.config[eIdx];
            let p = studnieProducts.find((pr) => pr.id === item.productId);

            // Fallback for missing products on different servers
            if (!p && item.productId) {
                console.warn(
                    `[buildZleceniaWellList] Produkt o ID ${item.productId} nie został znaleziony w bazie! Próbuję dopasować po nazwie...`
                );
                // If it's saved in order mode, maybe we have temporary product stored?
                // For now, let's create a dummy product object so the UI doesn't break
                p = {
                    id: item.productId,
                    name: 'Produkt nieznany (ID: ' + item.productId + ')',
                    componentType: 'dennica',
                    height: 0
                };
            }

            if (!p) continue;

            const realBaseIdx = findRealBaseIndex(well);
            const isBaseOfTangential = well.dn === 'styczna' && eIdx === realBaseIdx;

            if (
                p.componentType === 'dennica' ||
                p.componentType === 'krag_ot' ||
                isBaseOfTangential
            ) {
                zleceniaElementsList.push({
                    wellIndex: wIdx,
                    elementIndex: eIdx,
                    well: well,
                    product: p,
                    configItem: item
                });
            }
        }
    });

    console.log('[buildZleceniaWellList] Done. Elements found:', zleceniaElementsList.length);
    renderZleceniaList();
}

/** Helper to find the last physical element (ignoring gaskets) for tangential check */
function findRealBaseIndex(well) {
    if (!well || !well.config) return -1;
    for (let i = well.config.length - 1; i >= 0; i--) {
        const item = well.config[i];
        const tmpP = studnieProducts.find((pr) => pr.id === item.productId);
        if (tmpP && tmpP.componentType !== 'uszczelka') {
            return i;
        }
    }
    return -1;
}

function renderZleceniaList() {
    const container = document.getElementById('zlecenia-elements-list');
    const countEl = document.getElementById('zlecenia-el-count');
    if (!container) return;

    const search = (document.getElementById('zlecenia-search')?.value || '').toLowerCase();

    const groupedElements = {};
    let visibleCount = 0;

    // Build filtered + sorted items list
    const statusPriority = { accepted: 0, saved: 1, open: 2 };
    const itemsWithStatus = zleceniaElementsList.map((el, i) => ({
        el,
        index: i,
        status: getElementStatus(el)
    }));

    // Sort by status priority (accepted first, then saved, then open)
    itemsWithStatus.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

    itemsWithStatus.forEach((item) => {
        const el = item.el;
        const savedPO = (productionOrders || []).find(
            (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
        );
        const poNum =
            savedPO && savedPO.productionOrderNumber
                ? savedPO.productionOrderNumber.toLowerCase()
                : '';
        const matchesSearch =
            !search ||
            el.product.name.toLowerCase().includes(search) ||
            el.well.name.toLowerCase().includes(search) ||
            ('dn' + el.well.dn).toLowerCase().includes(search) ||
            poNum.includes(search);
        if (!matchesSearch) return;

        // Apply status filter
        if (zleceniaActiveFilter === 'saved' && item.status === 'open') return;
        if (zleceniaActiveFilter === 'accepted' && item.status !== 'accepted') return;

        if (!groupedElements[el.wellIndex]) {
            groupedElements[el.wellIndex] = {
                wellName: el.well.name,
                wellDn: el.well.dn,
                elements: []
            };
        }
        groupedElements[el.wellIndex].elements.push({ el, index: item.index });
        visibleCount++;
    });

    let html = '';

    Object.keys(groupedElements).forEach((wIdx) => {
        const group = groupedElements[wIdx];

        // Well Header
        html += `<div style="background:var(--bg-secondary); padding:0.6rem 0.8rem; border-bottom:1px solid var(--border-glass); border-top:1px solid var(--border-glass); position:sticky; top:0; z-index:5; display:flex; justify-content:space-between; align-items:center; margin-top:-1px;">
            <div style="font-size:0.75rem; font-weight:800; color:#818cf8; text-transform:uppercase; letter-spacing:0.5px;">🏷️ ${group.wellName}</div>
            <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); background:var(--bg-primary); padding:0.2rem 0.5rem; border-radius:12px; border:1px solid var(--border-glass);">${group.wellDn === 'styczna' ? 'Styczna' : 'DN' + group.wellDn}</div>
        </div>
        <div style="padding: 0.4rem;">`; // wrapper for elements in this well

        group.elements.forEach((item) => {
            const el = item.el;
            const i = item.index;
            const isSaved = (productionOrders || []).some(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const savedOrder = (productionOrders || []).find(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const isAccepted = savedOrder && savedOrder.status === 'accepted';
            const isActive = i === zleceniaSelectedIdx;

            const savedProdOrder = (productionOrders || []).find(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const prodOrderNum =
                savedProdOrder && savedProdOrder.productionOrderNumber
                    ? savedProdOrder.productionOrderNumber
                    : '';

            html += `<div class="zlecenia-el-item ${isActive ? 'active' : ''} ${isSaved ? 'saved' : ''} ${isAccepted ? 'accepted' : ''}" onclick="selectZleceniaElement(${i})" style="margin-bottom:0.3rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary);">${el.product.name}</div>
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                        ${prodOrderNum ? `<div style="font-size:0.6rem; font-weight:800; color:#818cf8; background:rgba(129,140,248,0.1); padding:0.1rem 0.4rem; border-radius:4px; border:1px solid rgba(129,140,248,0.2);">${prodOrderNum}</div>` : ''}
                        ${isSaved && !isAccepted ? `<button onclick="event.stopPropagation(); deleteProductionOrder('${savedOrder.id}')" title="Usuń zlecenie" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:4px; cursor:pointer; padding:0.1rem 0.3rem; font-size:0.6rem; line-height:1; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.3)'" onmouseleave="this.style.background='rgba(239,68,68,0.1)'">🗑️</button>` : ''}
                    </div>
                </div>
                <div style="display:flex; gap:0.6rem; margin-top:0.15rem; font-size:0.62rem; color:var(--text-muted);">
                    ${el.product.height ? '<span>📐 Wyskokość: ' + el.product.height + 'mm</span>' : ''}
                </div>
                ${isAccepted ? '<div style="font-size:0.55rem; color:#34d399; margin-top:0.2rem; font-weight:700;">🔒 Zaakceptowane — studnia zablokowana</div>' : isSaved ? '<div style="font-size:0.55rem; color:#fbbf24; margin-top:0.2rem; font-weight:700;">⏳ Wersja robocza</div>' : ''}
            </div>`;
        });

        html += `</div>`;
    });

    if (html === '') {
        let msg = 'Brak elementów (dennic / kręgów z otworem).';
        if (wells.length === 0) {
            msg = 'Najpierw dodaj studnię lub wczytaj zamówienie.';
        } else if (zleceniaElementsList.length === 0) {
            msg =
                'Brak elementów produkcyjnych (wymagana dennica lub krąg z otworem). Sprawdź czy produkty są w cenniku.';
        } else {
            msg = 'Brak elementów spełniających kryteria filtra.';
        }
        html = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.75rem;">${msg}</div>`;
    }

    // Remove default padding from the container if we bring our own wrappers
    container.style.padding = '0';
    container.innerHTML = html;

    if (countEl) countEl.textContent = visibleCount + ' elementów';
}

function filterZleceniaList() {
    renderZleceniaList();
}

function selectZleceniaElement(idx) {
    zleceniaSelectedIdx = idx;
    renderZleceniaList();
    const el = zleceniaElementsList[idx];
    if (!el) return;

    // Set global well context to the order's well
    if (currentWellIndex !== el.wellIndex) {
        currentWellIndex = el.wellIndex;
    }

    // Ensure the diagram updates with correct index and UI gets refreshed
    renderWellDiagram();
    renderZleceniaWellConfig();

    populateZleceniaForm(el);
}

function renderZleceniaWellConfig() {
    const tbody = document.getElementById('zlecenia-well-config-body');
    if (!tbody) return;
    const well = getCurrentWell();

    if (!well || !well.config || well.config.length === 0) {
        tbody.innerHTML =
            '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:0.7rem;">Brak elementów</div>';
        return;
    }

    const typeBadge = {
        wlaz: { bg: '#374151', label: '🔘' },
        plyta_din: { bg: '#1e3a5f', label: '🔽' },
        plyta_najazdowa: { bg: '#1e3a5f', label: '🔽' },
        plyta_zamykajaca: { bg: '#1e3a5f', label: '🔽' },
        pierscien_odciazajacy: { bg: '#1e3a5f', label: '⚙️' },
        konus: { bg: '#4c1d95', label: '🔶' },
        avr: { bg: '#44403c', label: '⚙️' },
        plyta_redukcyjna: { bg: '#4c1d95', label: '⬛' },
        krag: { bg: '#164e63', label: '🟦' },
        krag_ot: { bg: '#312e81', label: '🟪' },
        dennica: { bg: '#14532d', label: '🟩' },
        kineta: { bg: '#9d174d', label: '🔌' }
    };

    let html = '';
    well.config.forEach((item, index) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        const badge = typeBadge[p.componentType] || { bg: '#333', label: '?' };
        const isLocked = isWellLocked();

        // Highlight if this is the element currently selected in Zlecenia list
        const isCurrentlyEdited =
            zleceniaSelectedIdx !== -1 &&
            zleceniaElementsList[zleceniaSelectedIdx] &&
            zleceniaElementsList[zleceniaSelectedIdx].elementIndex === index;

        html += `<div data-zl-idx="${index}" class="config-tile" draggable="${!isLocked}" ondragstart="handleZlCfgDragStart(event)" ondragover="handleZlCfgDragOver(event)" ondrop="handleZlCfgDrop(event)" ondragend="handleZlCfgDragEnd(event)" 
                      style="background:rgba(30,41,59,0.7); border:1px solid ${isCurrentlyEdited ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}; border-left:4px solid ${badge.bg}; border-radius:6px; padding:0.35rem 0.5rem; margin-bottom:0.25rem; cursor:${isLocked ? 'default' : 'grab'}; transition:all 0.15s; ${isCurrentlyEdited ? 'box-shadow: 0 0 10px rgba(99,102,241,0.2); border-color:#818cf8;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <div style="display:flex; flex-direction:column; gap:1px; align-items:center; background:rgba(0,0,0,0.2); padding:0.1rem; border-radius:3px;">
                  <button onclick="event.stopPropagation(); moveZleceniaComponent(${index}, -1)" style="background:none; border:none; color:var(--text-muted); font-size:0.5rem; cursor:pointer; display:${isLocked || index === 0 ? 'none' : 'block'};">▲</button>
                  <span style="font-size:0.55rem; color:var(--text-primary); font-weight:700;">${index + 1}</span>
                  <button onclick="event.stopPropagation(); moveZleceniaComponent(${index}, 1)" style="background:none; border:none; color:var(--text-muted); font-size:0.5rem; cursor:pointer; display:${isLocked || index === well.config.length - 1 ? 'none' : 'block'};">▼</button>
                </div>
                <div style="display:flex; flex-direction:column;">
                  <div style="font-weight:700; color:var(--text-primary); font-size:0.68rem; line-height:1.1;">${p.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}</div>
                  <div style="font-size:0.55rem; color:var(--text-muted);">${p.height ? 'H=' + p.height + 'mm' : '—'}</div>
                </div>
            </div>
            ${isCurrentlyEdited ? '<span style="font-size:0.6rem; color:#818cf8;">✏️</span>' : ''}
          </div>
        </div>`;
    });

    tbody.innerHTML = html;
}

window.moveZleceniaComponent = function (index, dir) {
    if (isWellLocked()) return;
    const well = getCurrentWell();
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= well.config.length) return;

    // Snapshot currently edited element to restore focus after reorder
    const currentElObj =
        zleceniaSelectedIdx !== -1 ? zleceniaElementsList[zleceniaSelectedIdx].configItem : null;

    const temp = well.config[index];
    well.config[index] = well.config[newIdx];
    well.config[newIdx] = temp;

    well.configSource = 'MANUAL';
    well.autoLocked = true;

    // After reorder, if we were editing an element, we must find where it moved
    rebuildZleceniaListAndFocus(currentElObj);
    refreshZleceniaModal();
};

function rebuildZleceniaListAndFocus(targetObj) {
    // Regenerate the big list because indices changed
    initializeZleceniaModal();

    if (targetObj) {
        // Find which index in the NEW zleceniaElementsList points to the same object
        const newIdx = zleceniaElementsList.findIndex((el) => el.configItem === targetObj);
        if (newIdx !== -1) {
            zleceniaSelectedIdx = newIdx;
        }
    }
}

function refreshZleceniaModal() {
    renderZleceniaWellConfig();
    const well = getCurrentWell();
    const svg = document.getElementById('zlecenia-svg-preview');
    if (svg && well) {
        renderWellDiagram(svg, well);
    }
    renderZleceniaList(); // Refresh the right list too (indices updated)
}

/* Modal Drag & Drop */
let draggedZlIdx = null;

window.handleZlCfgDragStart = function (e) {
    if (isWellLocked()) {
        e.preventDefault();
        return;
    }
    draggedZlIdx = parseInt(e.currentTarget.getAttribute('data-zl-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
};

window.handleZlCfgDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.handleZlCfgDrop = function (e) {
    e.preventDefault();
    const tile = e.target.closest('[data-zl-idx]');
    if (tile && draggedZlIdx !== null) {
        const dropIdx = parseInt(tile.getAttribute('data-zl-idx'));
        if (draggedZlIdx === dropIdx) return;

        const well = getCurrentWell();
        const currentElObj =
            zleceniaSelectedIdx !== -1
                ? zleceniaElementsList[zleceniaSelectedIdx].configItem
                : null;

        const item = well.config.splice(draggedZlIdx, 1)[0];
        well.config.splice(dropIdx, 0, item);

        well.configSource = 'MANUAL';
        well.autoLocked = true;

        rebuildZleceniaListAndFocus(currentElObj);
        refreshZleceniaModal();
    }
};

window.handleZlCfgDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    draggedZlIdx = null;
};

function renderZleceniaSvgPreview(well) {
    const svg = document.getElementById('zlecenia-svg-preview');
    const info = document.getElementById('zlecenia-well-info-mini');
    if (!svg) return;

    // Use the REAL well diagram renderer with the target SVG
    renderWellDiagram(svg, well);
    renderZleceniaWellConfig();

    if (info) {
        const stats = calcWellStats(well);
        info.innerHTML = `<strong>${well.name}</strong> — DN${well.dn} — H: ${fmtInt(stats.height)}mm — ${fmtInt(stats.weight)}kg`;
    }
}

function populateZleceniaForm(el) {
    const { well, product, configItem, elementIndex, wellIndex } = el;
    const container = document.getElementById('zlecenia-form-content');
    if (!container) return;

    const parsed = parseWysokoscGlebokosc(product.name);

    // Custom calculations for tangential wells
    let displayDN = well.dn === 'styczna' ? 'Styczna' : 'DN' + well.dn;
    let displayGlebokosc = parsed.glebokosc || '—';
    let displayWysokosc = parsed.wysokosc || product.height || 0;
    let dnoKinetaVal = parsed.wysokosc - parsed.glebokosc;
    let displayDnoKineta = dnoKinetaVal > 0 ? dnoKinetaVal : '—';

    if (well.dn === 'styczna') {
        const dnMatch = (product.name || '').match(/DN\s*(\d+)/i);
        if (dnMatch) displayDN = `Styczna DN${dnMatch[1]}`;

        displayGlebokosc = product.height || '—';
        displayWysokosc = parsed.wysokosc || displayWysokosc;
        displayDnoKineta =
            parsed.wysokosc > 0 && parsed.glebokosc > 0 ? parsed.wysokosc - parsed.glebokosc : '—';
    }

    const din = getStudniaDIN(well.dn);
    const todayStr = new Date().toISOString().split('T')[0];
    const orderNumber = orderEditMode
        ? orderEditMode.order.number
        : document.getElementById('offer-number')?.value || '';

    // Get user name
    const userName = currentUser
        ? ((currentUser.firstName || '') + ' ' + (currentUser.lastName || '')).trim() ||
          currentUser.username
        : '';
    // Get firma from offer client
    const clientName = document.getElementById('client-name')?.value || '';
    const investName = document.getElementById('invest-name')?.value || '';
    const investAddress = document.getElementById('invest-address')?.value || '';
    const investContractor = document.getElementById('invest-contractor')?.value || '';

    // Check for existing saved production order
    const existing = productionOrders.find(
        (po) => po.wellId === well.id && po.elementIndex === elementIndex
    );
    const isAccepted = existing && existing.status === 'accepted';

    // Update buttons in header
    const btnAccept = document.getElementById('zl-btn-accept');
    const btnRevoke = document.getElementById('zl-btn-revoke');
    const btnDelete = document.getElementById('zl-btn-delete');
    const btnSave = document.getElementById('zl-btn-save');

    if (btnAccept) btnAccept.style.display = isAccepted ? 'none' : 'block';
    if (btnRevoke) btnRevoke.style.display = isAccepted ? 'block' : 'none';
    if (btnDelete) btnDelete.style.display = isAccepted ? 'none' : 'block';
    if (btnSave) btnSave.style.display = isAccepted ? 'none' : 'block';

    // Compute which element gets which transition to filter for this `elementIndex`
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProductFn = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProductFn, true);

    // Filter transitions assigned to this element
    const assignedPrzejscia = (well.przejscia || []).filter((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
        return assignedIndex === elementIndex;
    });
    const przejsciaCount = assignedPrzejscia.length;

    // Stopnie select — derive current value
    const stopnieVal = existing?.rodzajStopni || '';
    const stopnieOptions = [
        ['', 'Brak'],
        ['drabinka_a_stalowa', 'Drabinka Typ A/stalowa'],
        ['drabinka_a_szlachetna', 'Drabinka Typ A/stal szlachetna'],
        ['drabinka_b_stalowa', 'Drabinka Typ B/stalowa'],
        ['drabinka_b_szlachetna', 'Drabinka Typ B/stal szlachetna'],
        ['inne', 'Inne']
    ];

    const katStopni = existing?.katStopni || '';
    const wykonanie = katStopni ? calcStopnieExecution(katStopni) : '';

    // Values for tiles — kręgi wiercone domyślnie bez kinety/spocznika
    const isKragOt = product && product.componentType === 'krag_ot';
    const redKinetyVal =
        existing?.redukcjaKinety ?? (isKragOt ? 'nie' : (well.redukcjaKinety ?? ''));
    const spocznikHVal = existing?.spocznikH ?? (isKragOt ? 'brak' : (well.spocznikH ?? ''));
    const usytuowanieVal = existing?.usytuowanie ?? well.usytuowanie ?? '';
    const kinetaVal = existing?.kineta ?? (isKragOt ? 'brak' : (well.kineta ?? ''));
    const klasaBetonuVal = existing?.klasaBetonu ?? well.klasaBetonu ?? '';

    // Quick tiles for kat stopni
    const katOptions = ['90', '135', '180', '270'];

    const spocznikMatOptions = [
        ['brak', 'Brak'],
        ['beton', 'Beton'],
        ['beton_gfk', 'Beton z GFK'],
        ['klinkier', 'Klinkier'],
        ['preco', 'Preco'],
        ['precotop', 'Preco Top'],
        ['unolith', 'UnoLith'],
        ['predl', 'Predl'],
        ['kamionka', 'Kamionka']
    ];

    const rodzajStudniOptions = [
        ['beton', 'Beton'],
        ['zelbet', 'Żelbet']
    ];

    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? (isKragOt ? 'brak' : (well.spocznik ?? ''));

    let domyslnyRodzajStudni = '';
    if (product && product.componentType === 'dennica') {
        domyslnyRodzajStudni = well.dennicaMaterial === 'zelbetowa' ? 'zelbet' : 'beton';
    } else {
        domyslnyRodzajStudni = well.nadbudowa === 'zelbetowa' ? 'zelbet' : 'beton';
    }
    const rodzajStudniVal = existing?.rodzajStudni || domyslnyRodzajStudni;

    // Map well params to display labels
    const kinetaOptions = [
        ['brak', 'Brak'],
        ['beton', 'Beton'],
        ['beton_gfk', 'Beton z GFK'],
        ['klinkier', 'Klinkier'],
        ['preco', 'Preco'],
        ['precotop', 'PrecoTop'],
        ['unolith', 'UnoLith']
    ];
    const spocznikOptions = [
        ['1/2', '1/2'],
        ['2/3', '2/3'],
        ['3/4', '3/4'],
        ['1/1', '1/1'],
        ['brak', 'Brak']
    ];
    const usytOptions = [
        ['linia_dolna', 'Linia dolna'],
        ['linia_gorna', 'Linia górna'],
        ['w_osi', 'W osi'],
        ['patrz_uwagi', 'Patrz uwagi']
    ];
    const redKinetyOptions = [
        ['tak', 'Tak'],
        ['nie', 'Nie']
    ];
    const klasaBetonuOptions = [
        ['C40/50', 'C40/50'],
        ['C40/50(HSR!!!!)', 'C40/50 HSR'],
        ['C45/55', 'C45/55'],
        ['C45/55(HSR!!!!)', 'C45/55 HSR'],
        ['C70/85', 'C70/85'],
        ['C70/80(HSR!!!!)', 'C70/80 HSR']
    ];

    // GENEROWANIE DOMYŚLNYCH UWAG NA PODSTAWIE PARAMETRÓW STUDNI (tylko dla nowych zleceń)
    let autoUwagi = [];

    // 1. Klasa betonu (usunięto z automatycznych uwag na życzenie)

    // 2. Agresja chemiczna
    if (well.agresjaChemiczna === 'XA2' || well.agresjaChemiczna === 'XA3')
        autoUwagi.push('Agresja chem. ' + well.agresjaChemiczna);

    // 3. Agresja mrozowa
    if (well.agresjaMrozowa === 'XF2' || well.agresjaMrozowa === 'XF3')
        autoUwagi.push('Agresja mroz. ' + well.agresjaMrozowa);

    // 4. Wkładka PEHD
    if (well.wkladka === '3mm' || well.wkladka === '4mm')
        autoUwagi.push('Wkładka PEHD ' + well.wkladka);

    // 5. Malowanie wewnętrzne
    if (well.malowanieW && well.malowanieW !== 'brak') {
        let malWDesc = '';
        if (well.malowanieW === 'kineta') malWDesc = 'Kineta';
        else if (well.malowanieW === 'kineta_dennica') malWDesc = 'Kineta+denn.';
        else if (well.malowanieW === 'cale') malWDesc = 'Całość';
        if (malWDesc) {
            autoUwagi.push(
                'Malowanie wew. ' + malWDesc + (well.powlokaNameW ? ' ' + well.powlokaNameW : '')
            );
        }
    }

    // 6. Malowanie zewnętrzne
    if (well.malowanieZ === 'zewnatrz') {
        autoUwagi.push(
            'Malowanie zew. Zewnątrz' + (well.powlokaNameZ ? ' ' + well.powlokaNameZ : '')
        );
    }

    // 7. Studnia styczna
    if (well.dn === 'styczna') autoUwagi.push('STYCZNA');

    // 8. Klasa nośności korpusu
    if (well.klasaNosnosci_korpus === 'E600' || well.klasaNosnosci_korpus === 'F900') {
        autoUwagi.push('Kl. nośn. ' + well.klasaNosnosci_korpus);
    }

    const defaultUwagiStr = autoUwagi.join(', ');
    const finalUwagi = existing?.uwagi !== undefined ? existing.uwagi : defaultUwagiStr;

    let bannerHtml = '';
    if (isAccepted) {
        bannerHtml = `
            <div style="background:rgba(239,68,68,0.15); border:2px solid rgba(239,68,68,0.4); border-radius:10px; padding:0.8rem 1rem; display:flex; align-items:center; gap:0.8rem; margin-bottom:0.5rem;">
                <span style="font-size:1.5rem;">🔒</span>
                <div style="flex:1;">
                    <div style="font-size:0.85rem; font-weight:800; color:#f87171; text-transform:uppercase; letter-spacing:0.5px;">Zlecenie zaakceptowane</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">Edycja jest zablokowana. Aby wprowadzić zmiany, najpierw cofnij akceptację przyciskiem na górze.</div>
                </div>
            </div>
        `;
    }

    // Preserve visibility states before overwrite
    let przejsciaAppVisible = false;
    const existingPrzejsciaContainer = document.getElementById('zl-inline-przejscia-app-container');
    if (existingPrzejsciaContainer && existingPrzejsciaContainer.style.display !== 'none') {
        przejsciaAppVisible = true;
    }

    let daneZleceniaVisible = false;
    const existingDaneZlecenia = document.getElementById('zl-dane-zlecenia-container');
    if (existingDaneZlecenia && existingDaneZlecenia.style.display !== 'none') {
        daneZleceniaVisible = true;
    }

    container.innerHTML = `
    ${bannerHtml}
    <!-- Dane zlecenia -->
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm" onclick="const b=this.nextElementSibling; b.style.display=b.style.display==='none'?'grid':'none'; this.querySelector('.zl-toggle').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer; user-select:none; display:flex; justify-content:space-between; align-items:center;">
            <span>📋 Dane zlecenia <span style="margin-left:8px; color:#818cf8; font-weight:800;">${existing?.productionOrderNumber || '— nowy —'}</span></span>
            <span class="zl-toggle" style="font-size:0.6rem; color:var(--text-muted);">${daneZleceniaVisible ? '▼' : '▶'}</span>
        </div>
        <div id="zl-dane-zlecenia-container" style="display:${daneZleceniaVisible ? 'grid' : 'none'}; grid-template-columns:1fr 1fr; gap:0.5rem; padding:0.2rem 0;">
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" class="ui-text-sec">Obiekt</label>
                <input type="text" id="zl-obiekt" class="form-input form-input-sm" value="${existing?.obiekt || investName}" placeholder="Nazwa obiektu...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" class="ui-text-sec">Data</label>
                <input type="text" id="zl-data" class="form-input form-input-sm" value="${existing?.data || todayStr}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" class="ui-text-sec">Adres</label>
                <input type="text" id="zl-adres" class="form-input form-input-sm" value="${existing?.adres || investAddress}" placeholder="Adres obiektu...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" class="ui-text-sec">Nazwisko (przygotował)</label>
                <input type="text" id="zl-nazwisko" class="form-input form-input-sm" value="${existing?.nazwisko || userName}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" class="ui-text-sec">Wykonawca</label>
                <input type="text" id="zl-wykonawca" class="form-input form-input-sm" value="${existing?.wykonawca || investContractor}" placeholder="Wykonawca...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" class="ui-text-sec">Data produkcji</label>
                <input type="date" id="zl-data-produkcji" class="form-input form-input-sm" value="${existing?.dataProdukcji || ''}">
            </div>
            <div class="form-group-sm" style="grid-column: 1 / -1; margin:0;">
                <label class="form-label-sm" class="ui-text-sec">Fakturowane na</label>
                <input type="text" id="zl-fakturowane" class="form-input form-input-sm" value="${existing?.fakturowane || clientName}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
        </div>
    </div>

    <!-- Dane studni i Przejścia obok siebie -->
    <div style="display:grid; grid-template-columns:230px 1fr; gap:0.5rem; margin-bottom:0.5rem;">
        <div class="card card-compact">
            <div class="card-title-sm" class="ui-flex-between">
                <span>🏗️ Dane elementu</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.75rem;">
                <!-- Numer Studni -->
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase; font-weight:600;">Numer studni</span>
                    <span style="font-weight:bold; color:#818cf8; font-size:0.85rem;">${well.name || ''}</span>
                </div>
                
                <!-- Underneath list -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.2rem; background:#0d1520; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border-glass);">
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Średnica</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayDN}</span>
                        <input type="hidden" id="zl-srednica" value="${displayDN}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Głębokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayGlebokosc}${typeof displayGlebokosc === 'number' ? ' mm' : ''}</span>
                        <input type="hidden" id="zl-glebokosc" value="${displayGlebokosc}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Wysokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayWysokosc}${typeof displayWysokosc === 'number' ? ' mm' : ''}</span>
                        <input type="hidden" id="zl-wysokosc" value="${displayWysokosc}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Gr. dna</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayDnoKineta}</span>
                        <input type="hidden" id="zl-dno-kineta" value="${displayDnoKineta}">
                    </div>
                </div>
                
                <!-- Rodzaj studni -->
                <div class="form-group-sm" style="margin-top:0.3rem;">
                    <label class="form-label-sm" class="ui-text-sec">Rodzaj studni</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.3rem;" class="zl-param-group">
                        ${rodzajStudniOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ${v === rodzajStudniVal ? 'active' : ''}" style="padding:0.6rem; font-size:0.85rem; font-weight:800; letter-spacing:0.5px; border-radius:8px;" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                </div>

            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.5rem; min-width:0;">
            <div class="card card-compact" style="padding:0.5rem 0.6rem;">
                <div class="card-title-sm"
                    style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; margin-bottom:0; font-size:0.78rem; padding:0.15rem 0;"
                    onclick="window.toggleCard('zl-inline-przejscia-app-container', 'zl-przejscia-app-icon')">
                    <span>➕ Dodaj Przejście Szczelne</span>
                    <span id="zl-przejscia-app-icon" style="font-size:0.75rem;">${przejsciaAppVisible ? '🔼' : '🔽'}</span>
                </div>
                <div id="zl-inline-przejscia-app-container" class="card-content" style="margin-top:0.5rem; display:${przejsciaAppVisible ? 'block' : 'none'};">
                    <div id="zl-inline-przejscia-app"></div>
                </div>
            </div>

            <div class="card card-compact" style="display:flex; flex-direction:column; box-sizing:border-box; overflow-x:auto; padding:0.5rem 0.6rem; flex:1;">
                <div class="card-title-sm" style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <span>🔗 Lista dodanych układów</span>
                    <span id="zl-przejscia-count" style="color:var(--text-muted); font-size:0.7rem;">(${przejsciaCount})</span>
                </div>
                <div id="zl-przejscia-list" style="flex:1; border-radius:var(--radius-sm); font-size:0.72rem; color:var(--text-secondary); display:flex; flex-direction:column; overflow-y:auto; overflow-x:auto; min-width:100%;">
                </div>
            </div>
        </div>
    </div>

    <!-- Uwagi (Pełna szerokość pod spodem) -->
    <div class="card card-compact" style="margin-bottom:0.5rem; display:flex; flex-direction:column;">
        <div class="card-title-sm">📝 Uwagi</div>
        <div class="form-group-sm" style="flex:1; display:flex; flex-direction:column; margin-bottom:0;">
            <textarea id="zl-uwagi" class="form-textarea" placeholder="Uwagi do zlecenia..." style="flex:1; min-height:80px; resize:none;">${finalUwagi}</textarea>
        </div>
    </div>

    <!-- Parametry studni w dwóch kolumnach -->
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm">⚙️ Parametry studni</div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; align-items:start;">
            <!-- Kolumna 1 -->
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm">
                    <label class="form-label-sm">Redukcja kinety</label>
                    <div class="ui-row-gap zl-param-group">
                        ${redKinetyOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === redKinetyVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-red-kinety', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-red-kinety" value="${redKinetyVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Studnia wd. DIN</label>
                    <div class="ui-row-gap zl-param-group">
                        <input type="text" id="zl-din" class="form-input form-input-sm" value="${dinVal}" style="width:100%; color:#818cf8; font-weight:700;">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Rodzaj stopni</label>
                    <div class="ui-row-gap zl-param-group">
                        ${stopnieOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === stopnieVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-rodzaj-stopni', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-stopni" value="${stopnieVal}">
                </div>

                <div id="zl-stopnie-inne-wrap" style="display:${stopnieVal === 'inne' ? 'block' : 'none'};">
                    <div class="form-group-sm">
                        <label class="form-label-sm">Inne (opis)</label>
                        <input type="text" id="zl-stopnie-inne" class="form-input form-input-sm" value="${existing?.stopnieInne || ''}" placeholder="Opis...">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Ustalanie kąta stopni / Wykonanie</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem; align-items:center;" class="zl-param-group">
                        <input type="number" id="zl-kat-stopni" class="form-input form-input-sm" value="${katStopni}" placeholder="np. 90" min="0" max="360" onfocus="this.value=''" oninput="onZleceniaKatChange()" style="width:70px;">
                        <span style="font-size:1.2rem; color:var(--text-muted); margin: 0 4px;">→</span>
                        <input type="text" id="zl-wykonanie" class="form-input form-input-sm" value="${wykonanie ? wykonanie + '°' : ''}" readonly style="width:70px; color:#818cf8; font-weight:700; margin-right:5px; pointer-events:none;">
                        ${katOptions
                            .map(
                                (v) =>
                                    `<button type="button" class="param-tile ui-badge" onclick="document.getElementById('zl-kat-stopni').value='${v}'; onZleceniaKatChange();">${v}°</button>`
                            )
                            .join('')}
                    </div>
                </div>
            </div>

            <!-- Kolumna 2 -->
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm">
                    <label class="form-label-sm">Wysokość spocznika</label>
                    <div class="ui-row-gap zl-param-group">
                        ${spocznikOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === spocznikHVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-spocznik-h', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik-h" value="${spocznikHVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Usytuowanie</label>
                    <div class="ui-row-gap zl-param-group">
                        ${usytOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === usytuowanieVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-usytuowanie', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-usytuowanie" value="${usytuowanieVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Kineta</label>
                    <div class="ui-row-gap zl-param-group">
                        ${kinetaOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === kinetaVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-kineta', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-kineta" value="${kinetaVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Spocznik</label>
                    <div class="ui-row-gap zl-param-group">
                        ${spocznikMatOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === spocznikMatVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-spocznik', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik" value="${spocznikMatVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Klasa betonu</label>
                    <div class="ui-row-gap zl-param-group">
                        ${klasaBetonuOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === klasaBetonuVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-klasa-betonu', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-klasa-betonu" value="${klasaBetonuVal}">
                </div>
            </div>
        </div>
    </div>
    `;

    // Disable all inputs/buttons if accepted
    if (isAccepted) {
        setTimeout(() => {
            container.querySelectorAll('input, textarea, button').forEach((el) => {
                el.disabled = true;
                if (el.tagName === 'BUTTON' && el.classList.contains('param-tile')) {
                    el.style.opacity = '0.7';
                    el.style.cursor = 'not-allowed';
                }
            });
            const transitionsApp = document.getElementById('zl-inline-przejscia-app-container');
            if (transitionsApp) {
                transitionsApp.style.pointerEvents = 'none';
                transitionsApp.style.opacity = '0.6';
            }
        }, 10);
    }

    // Use full interactive transition rendering (same as configurator)
    renderInlinePrzejsciaApp('zl-inline-przejscia-app');
    renderWellPrzejscia({
        containerId: 'zl-przejscia-list',
        countElId: 'zl-przejscia-count',
        filterElementIndex: elementIndex
    });
}

async function selectZleceniaTile(btn, targetId, val) {
    const group = btn.closest('.zl-param-group');
    if (group) {
        group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
    }
    btn.classList.add('active');

    const input = document.getElementById(targetId);
    if (input) {
        input.value = val;
    }

    if (targetId === 'zl-rodzaj-stopni') {
        onZleceniaStopnieChange();
    } else if (
        [
            'zl-rodzaj-studni',
            'zl-red-kinety',
            'zl-spocznik-h',
            'zl-usytuowanie',
            'zl-kineta',
            'zl-spocznik',
            'zl-klasa-betonu'
        ].includes(targetId)
    ) {
        if (typeof zleceniaSelectedIdx === 'number' && zleceniaElementsList) {
            const el = zleceniaElementsList[zleceniaSelectedIdx];
            if (el && el.well && el.product) {
                // Zachowaj tymczasowe uwagi z okienka przed jego przeładowaniem
                const tempUwagi = document.getElementById('zl-uwagi')
                    ? document.getElementById('zl-uwagi').value
                    : '';

                // Pobierz ewentualne zapisane zlecenie, aby również je zaktualizować na żywo
                const existing = productionOrders.find(
                    (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
                );

                if (targetId === 'zl-rodzaj-studni') {
                    // Ustaw odpowiednią globalną cechę studni w zależności od edytowanego elementu
                    if (el.product.componentType === 'dennica') {
                        el.well.dennicaMaterial = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                    } else {
                        el.well.nadbudowa = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                    }
                    if (existing) existing.rodzajStudni = val;
                } else if (targetId === 'zl-red-kinety') {
                    el.well.redukcjaKinety = val;
                    if (existing) existing.redukcjaKinety = val;
                } else if (targetId === 'zl-spocznik-h') {
                    el.well.spocznikH = val;
                    if (existing) existing.spocznikH = val;
                } else if (targetId === 'zl-usytuowanie') {
                    el.well.usytuowanie = val;
                    if (existing) existing.usytuowanie = val;
                } else if (targetId === 'zl-kineta') {
                    el.well.kineta = val;
                    if (existing) existing.kineta = val;
                } else if (targetId === 'zl-spocznik') {
                    el.well.spocznik = val;
                    if (existing) existing.spocznik = val;
                } else if (targetId === 'zl-klasa-betonu') {
                    el.well.klasaBetonu = val;
                    if (existing) existing.klasaBetonu = val;
                }

                // Sync the main screen params tiles
                if (typeof window.updateParamTilesUI === 'function') window.updateParamTilesUI();

                const oldWellIdx = el.wellIndex;
                const oldCat = el.product.category;

                if (targetId === 'zl-rodzaj-studni') {
                    if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();

                    // 1. Zaktualizowanie komponentów by dobrać wyrobienie Żelbet/Beton (i uaktualnić ich ceny)
                    if (typeof window.autoSelectComponents === 'function') {
                        await window.autoSelectComponents(false);
                    }
                }

                // 2. Pełne odświeżenie całego interfejsu (łącznie z 'Parametry tej studni' i cenami na bieżąco)
                if (typeof window.refreshAll === 'function') {
                    window.refreshAll();
                } else {
                    if (typeof window.renderWellConfig === 'function') window.renderWellConfig();
                    if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
                    if (typeof window.updateSummary === 'function') window.updateSummary();
                    if (typeof window.renderWellParams === 'function') window.renderWellParams();
                }

                // 3. Przebudowa Listy elementów w Zleceniu, tak by zaktualizować wewnętrzne obiekty Ceny/Produktów
                if (typeof window.buildZleceniaWellList === 'function') {
                    window.buildZleceniaWellList();
                }

                // 4. Spróbujmy znaleźć przeliczony index elementu i go wybrać powtórnie
                let newTargetIdx = zleceniaElementsList.findIndex(
                    (e) => e.wellIndex === oldWellIdx && e.product && e.product.category === oldCat
                );
                if (newTargetIdx === -1) {
                    newTargetIdx = zleceniaElementsList.findIndex(
                        (e) => e.wellIndex === oldWellIdx
                    );
                }

                if (newTargetIdx >= 0 && typeof window.selectZleceniaElement === 'function') {
                    window.selectZleceniaElement(newTargetIdx);
                    // Odtworzenie wpisanych na sucho uwag
                    if (document.getElementById('zl-uwagi')) {
                        document.getElementById('zl-uwagi').value = tempUwagi;
                    }
                }
            }
        }
    }
}

function onZleceniaStopnieChange() {
    const hiddenInput = document.getElementById('zl-rodzaj-stopni');
    const wrap = document.getElementById('zl-stopnie-inne-wrap');
    if (hiddenInput && wrap) {
        wrap.style.display = hiddenInput.value === 'inne' ? 'block' : 'none';
    }
}

function onZleceniaKatChange() {
    const katInput = document.getElementById('zl-kat-stopni');
    const wykInput = document.getElementById('zl-wykonanie');
    if (katInput && wykInput) {
        const angle = parseFloat(katInput.value) || 0;
        const exec = angle > 0 ? calcStopnieExecution(angle) : '';
        wykInput.value = exec ? exec + '°' : '';
    }
}

async function saveProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const { well, product, elementIndex, wellIndex } = el;

    const existingIdx = productionOrders.findIndex(
        (po) => po.wellId === well.id && po.elementIndex === elementIndex
    );
    if (existingIdx >= 0 && productionOrders[existingIdx].status === 'accepted') {
        showToast(
            'Nie można zapisać zaakceptowanego zlecenia. Najpierw cofnij akceptację.',
            'error'
        );
        return;
    }

    let currentOrderNumber =
        existingIdx >= 0 ? productionOrders[existingIdx].productionOrderNumber || '' : '';

    // Claim production order number immediately so the draft has it
    if (!currentOrderNumber) {
        try {
            // Use assigned user (owner) for numbering if exists, otherwise current user
            const targetUserId =
                typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId
                    ? editingOfferAssignedUserId
                    : currentUser
                      ? currentUser.id
                      : null;

            if (targetUserId) {
                const claimResp = await fetch(
                    '/api/orders-studnie/claim-production-number/' + targetUserId,
                    {
                        method: 'POST',
                        headers: authHeaders()
                    }
                );
                if (claimResp.ok) {
                    const claimData = await claimResp.json();
                    if (claimData.number) {
                        currentOrderNumber = claimData.number;
                    }
                }
            }
        } catch (e) {
            console.error('Błąd poboru numeru zlecenia dla wersji roboczej', e);
        }
    }

    const order = {
        id: existingIdx >= 0 ? productionOrders[existingIdx].id : 'prodorder_' + Date.now(),
        productionOrderNumber: currentOrderNumber,
        userId:
            typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId
                ? editingOfferAssignedUserId
                : currentUser
                  ? currentUser.id
                  : null,
        wellId: well.id,
        wellName: well.name,
        offerId: typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : '',
        salesOrderNumber:
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            typeof currentOrder !== 'undefined' &&
            currentOrder
                ? currentOrder.number
                : '',
        elementIndex: elementIndex,
        productName: product.name,
        productId: product.id,
        dn: well.dn,

        // Form fields
        obiekt: document.getElementById('zl-obiekt')?.value || '',
        data: document.getElementById('zl-data')?.value || '',
        adres: document.getElementById('zl-adres')?.value || '',
        nazwisko: document.getElementById('zl-nazwisko')?.value || '',
        wykonawca: document.getElementById('zl-wykonawca')?.value || '',
        dataProdukcji: document.getElementById('zl-data-produkcji')?.value || '',
        fakturowane: document.getElementById('zl-fakturowane')?.value || '',

        // Well specs
        snr: well.numer || '',
        srednica: document.getElementById('zl-srednica')?.value || well.dn,
        wysokosc: document.getElementById('zl-wysokosc')?.value || '',
        glebokosc: document.getElementById('zl-glebokosc')?.value || '',
        dnoKineta: document.getElementById('zl-dno-kineta')?.value || '',
        rodzajStudni: document.getElementById('zl-rodzaj-studni')?.value || '',

        // Przejscia snapshot — only transitions assigned to THIS element (enriched with product data)
        przejscia: (() => {
            const allPrzejscia = well.przejscia || [];
            const rzDna = parseFloat(well.rzednaDna) || 0;
            const findProductFn = (id) =>
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === id)
                    : null;
            const configMap =
                typeof buildConfigMap !== 'undefined'
                    ? buildConfigMap(well, findProductFn, true)
                    : [];

            // Filter transitions to only those assigned to this element
            const assigned =
                configMap.length > 0
                    ? allPrzejscia.filter((p) => {
                          let pel = parseFloat(p.rzednaWlaczenia);
                          if (isNaN(pel)) pel = rzDna;
                          const mmFromBottom = (pel - rzDna) * 1000;
                          const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
                          return assignedIndex === elementIndex;
                      })
                    : allPrzejscia;

            // Enrich with product category/DN
            return assigned.map((p) => {
                const clone = JSON.parse(JSON.stringify(p));
                const prod = findProductFn(p.productId);
                if (prod) {
                    clone.productCategory = prod.category || '';
                    clone.productDn = prod.dn || '';
                }
                return clone;
            });
        })(),

        // Etykieta elements snapshot (for registry printing without studnieProducts context)
        etykietaElementy: buildEtykietaElementsSnapshot(well),

        uwagi: document.getElementById('zl-uwagi')?.value || '',

        // Params
        redukcjaKinety: document.getElementById('zl-red-kinety')?.value || '',
        spocznikH: document.getElementById('zl-spocznik-h')?.value || '',
        din: document.getElementById('zl-din')?.value || getStudniaDIN(well.dn),
        rodzajStopni: document.getElementById('zl-rodzaj-stopni')?.value || '',
        stopnieInne: document.getElementById('zl-stopnie-inne')?.value || '',
        katStopni: document.getElementById('zl-kat-stopni')?.value || '',
        wykonanie: document.getElementById('zl-wykonanie')?.value || '',
        usytuowanie: document.getElementById('zl-usytuowanie')?.value || '',
        kineta: document.getElementById('zl-kineta')?.value || '',
        spocznik: document.getElementById('zl-spocznik')?.value || '',
        klasaBetonu: document.getElementById('zl-klasa-betonu')?.value || '',

        createdAt:
            existingIdx >= 0 ? productionOrders[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: existingIdx >= 0 ? productionOrders[existingIdx].status || 'draft' : 'draft'
    };

    if (existingIdx >= 0) {
        productionOrders[existingIdx] = order;
    } else {
        productionOrders.push(order);
    }

    try {
        await saveProductionOrdersData(productionOrders);

        // Synchronizacja: Zapisz również Ofertę i (jeśli dotyczy) Zamówienie
        const syncResult = await syncSourceData();
        const extraMsg = syncResult ? ' + ' + syncResult : '';

        renderZleceniaList();
        renderZleceniaWellConfig();
        if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
            populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
        }
        refreshGlobalMetrics();
        showToast(`✅ Zlecenie produkcyjne zapisane${extraMsg}`, 'success');
    } catch (err) {
        console.error('saveProductionOrder error:', err);
        showToast('❌ Błąd zapisu: ' + err.message, 'error');
    }
}

async function deleteProductionOrder(id) {
    const po = productionOrders.find((p) => p.id === id);
    if (po && po.status === 'accepted') {
        showToast('Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.', 'error');
        return;
    }
    if (
        !(await appConfirm('Usunąć to zlecenie produkcyjne?', {
            title: 'Usuwanie zlecenia',
            type: 'danger'
        }))
    )
        return;
    try {
        const res = await fetch('/api/orders-studnie/production/' + id, {
            method: 'DELETE',
            headers: authHeaders()
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Błąd serwera podczas usuwania');
        }

        productionOrders = productionOrders.filter((po) => po.id !== id);
        renderZleceniaList();
        renderZleceniaWellConfig();
        if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
            populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
        }
        refreshGlobalMetrics();
        refreshAll(); // odblokuj studnię wizualnie po usunięciu zlecenia
        await syncSourceData();
        showToast('Zlecenie usunięte', 'info');
    } catch (e) {
        console.error('deleteProductionOrder error:', e);
        showToast(e.message, 'error');
    }
}

async function acceptProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    // Auto-zapis przed akceptacją
    await saveProductionOrder();

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = productionOrders.find(
        (p) => p.wellId === el.well.id && p.elementIndex === el.elementIndex
    );
    if (!po) {
        showToast('Najpierw zapisz zlecenie produkcyjne', 'error');
        return;
    }
    if (po.status === 'accepted') {
        showToast('Zlecenie już zaakceptowane', 'info');
        return;
    }
    if (
        !(await appConfirm('Zaakceptować zlecenie? Studnia zostanie zablokowana od edycji.', {
            title: 'Akceptacja zlecenia',
            type: 'warning',
            okText: 'Zaakceptuj'
        }))
    )
        return;

    // Claim production order number if not claimed yet
    if (!po.productionOrderNumber) {
        try {
            const targetUserId =
                typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId
                    ? editingOfferAssignedUserId
                    : currentUser
                      ? currentUser.id
                      : null;

            if (!targetUserId) {
                showToast('Brak przypisanego użytkownika', 'error');
                return;
            }
            const claimResp = await fetch('/api/orders-studnie/claim-production-number/' + targetUserId, {
                method: 'POST',
                headers: authHeaders()
            });
            const claimData = await claimResp.json();
            if (claimResp.ok && claimData.number) {
                po.productionOrderNumber = claimData.number;
            } else {
                showToast('Błąd pobierania numeru zlecenia z serwera', 'error');
                return;
            }
        } catch (e) {
            showToast('Błąd połączenia z serwerem przy numeracji', 'error');
            return;
        }
    }

    po.status = 'accepted';
    po.acceptedAt = new Date().toISOString();
    po.acceptedBy = currentUser ? currentUser.username : '';

    try {
        await saveProductionOrdersData(productionOrders);

        // Synchronizacja przy akceptacji
        await syncSourceData();

        renderZleceniaList();
        renderZleceniaWellConfig();
        if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
            populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
        }
        refreshGlobalMetrics();
        showToast('🔒 Zlecenie zaakceptowane — ' + po.productionOrderNumber, 'success');
    } catch (err) {
        console.error('acceptProductionOrder error:', err);
        showToast('❌ Błąd akceptacji: ' + err.message, 'error');
    }
}

async function revokeProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    // Auto-zapis przed cofnięciem akceptacji
    await saveProductionOrder();

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = productionOrders.find(
        (p) => p.wellId === el.well.id && p.elementIndex === el.elementIndex
    );
    if (!po) {
        showToast('Brak zlecenia do cofnięcia', 'error');
        return;
    }
    if (po.status !== 'accepted') {
        showToast('Zlecenie nie jest zaakceptowane', 'info');
        return;
    }
    if (
        !(await appConfirm('Cofnąć akceptację? Studnia zostanie odblokowana.', {
            title: 'Cofanie akceptacji',
            type: 'warning',
            okText: 'Cofnij'
        }))
    )
        return;
    po.status = 'draft';
    delete po.acceptedAt;
    delete po.acceptedBy;
    await saveProductionOrdersData(productionOrders);
    await syncSourceData();
    renderZleceniaList();
    refreshAll();
    if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
        populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
    }
    showToast('🔓 Akceptacja cofnięta — studnia odblokowana', 'info');
}

window.openZleceniaProdukcyjne = openZleceniaProdukcyjne;
window.closeZleceniaModal = closeZleceniaModal;
window.selectZleceniaElement = selectZleceniaElement;
window.filterZleceniaList = filterZleceniaList;
window.saveProductionOrder = saveProductionOrder;
window.deleteProductionOrder = deleteProductionOrder;
window.acceptProductionOrder = acceptProductionOrder;
window.revokeProductionOrder = revokeProductionOrder;
window.onZleceniaStopnieChange = onZleceniaStopnieChange;
window.onZleceniaKatChange = onZleceniaKatChange;

/** Delete the production order for the currently selected element */
async function deleteSelectedProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = (productionOrders || []).find(
        (p) => p.wellId === el.well.id && p.elementIndex === el.elementIndex
    );
    if (!po) {
        showToast('To zlecenie nie zostało jeszcze zapisane', 'info');
        return;
    }
    await deleteProductionOrder(po.id);
}
window.deleteSelectedProductionOrder = deleteSelectedProductionOrder;

/** Refresh global dashboard metrics if running in SPA / parent window */
function refreshGlobalMetrics() {
    try {
        if (window.parent && typeof window.parent.loadRecycledNumbers === 'function') {
            window.parent.loadRecycledNumbers();
        }
        if (
            window.parent &&
            window.parent.SpaRouter &&
            typeof window.parent.SpaRouter.refreshModule === 'function'
        ) {
            window.parent.SpaRouter.refreshModule('zlecenia');
        }
    } catch (e) {
        /* ignore cross-origin or missing parent */
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupParamTiles();
        updateParamTilesUI();
        loadProductionOrders();
    }, 500);
});
