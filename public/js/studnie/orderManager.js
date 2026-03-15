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
        await fetch('/api/orders-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
    } catch (err) {
        console.error('Błąd zapisu zamówień studni:', err);
    }
}

async function createOrderFromOffer() {
    // First save the current offer
    const number = document.getElementById('offer-number').value.trim();
    if (!number) { showToast('Najpierw zapisz ofertę', 'error'); return; }
    if (!editingOfferIdStudnie) {
        showToast('Najpierw zapisz ofertę (kliknij 💾 Zapisz)', 'error');
        return;
    }

    // Ostrzeżenie że oferta zostanie zablokowana
    if (!confirm('Po utworzeniu zamówienia oferta zostanie zablokowana do edycji.\n' +
        'Dalsze zmiany będą możliwe tylko w zamówieniu.\n\nKontynuować?')) return;

    const offer = offersStudnie.find(o => o.id === editingOfferIdStudnie);
    if (!offer) { showToast('Nie znaleziono oferty', 'error'); return; }

    // Check if order already exists
    const existingOrder = ordersStudnie.find(o => o.offerId === offer.id);
    if (existingOrder) {
        if (!confirm('Zamówienie dla tej oferty już istnieje. Czy chcesz utworzyć nowe (nadpisze poprzednie)?')) return;
        ordersStudnie = ordersStudnie.filter(o => o.offerId !== offer.id);
    }

    // Determine assigned user for order numbering
    let assignedUserId = currentUser ? currentUser.id : null;
    let assignedUserName = currentUser ? currentUser.username : '';

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
                assignedUserName = selectedUser.username;
            }
        } catch (e) {
            console.error('Błąd pobierania użytkowników:', e);
        }
    }

    // Claim order number from server
    let orderNumber = '';
    try {
        const claimResp = await fetch('/api/claim-order-number/' + assignedUserId, {
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

    // Mark the offer as having an order
    offer.hasOrder = true;
    offer.orderId = order.id;
    saveOffersDataStudnie(offersStudnie);

    ordersStudnie.push(order);
    saveOrdersDataStudnie(ordersStudnie);
    renderSavedOffersStudnie();

    showToast(`📦 Zamówienie ${orderNumber} utworzone z oferty ${offer.number}`, 'success');

    // Open order in the same window (uses main studnie editor in order mode)
    window.location.href = '/studnie?order=' + order.id;
}

/** Show popup for pro/admin to select which user to assign the order to */
function showUserSelectionPopup(users, defaultUserId) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:99999; display:flex; align-items:center; justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#1a2536; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:1.5rem; min-width:350px; max-width:500px; max-height:80vh; overflow-y:auto; color:#e2e8f0; font-family:Inter,sans-serif;';

        let html = `<div style="font-size:1.1rem; font-weight:700; margin-bottom:1rem; color:#f59e0b;">👤 Przypisz zamówienie do użytkownika</div>`;
        html += `<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:1rem;">Numer zamówienia zostanie wygenerowany z sekwencji wybranego użytkownika.</div>`;
        html += `<div style="display:flex; flex-direction:column; gap:0.4rem;">`;

        users.forEach(u => {
            const displayName = (u.firstName && u.lastName) ? `${u.firstName} ${u.lastName}` : u.username;
            const isDefault = u.id === defaultUserId;
            const symbol = u.symbol || '??';
            const roleBadge = u.role === 'admin' ? '🔑' : (u.role === 'pro' ? '⭐' : '👤');

            html += `<button class="user-select-btn" data-user-id="${u.id}" style="
                display:flex; align-items:center; gap:0.8rem; padding:0.7rem 1rem;
                background:${isDefault ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
                border:1px solid ${isDefault ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'};
                border-radius:10px; cursor:pointer; color:#e2e8f0; font:500 0.85rem Inter,sans-serif;
                transition:all 0.15s; text-align:left; width:100%;
            " onmouseenter="this.style.borderColor='rgba(99,102,241,0.4)';this.style.background='rgba(99,102,241,0.1)'"
               onmouseleave="if(!this.classList.contains('selected')){this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='rgba(255,255,255,0.03)'}">
                <span style="font-size:1.1rem;">${roleBadge}</span>
                <div style="flex:1;">
                    <div style="font-weight:700;">${displayName}</div>
                    <div style="font-size:0.7rem; color:#94a3b8;">Symbol: ${symbol} | Nr start: ${u.orderStartNumber || 1}</div>
                </div>
                ${isDefault ? '<span style="font-size:0.65rem; color:#818cf8; font-weight:700;">DOMYŚLNY</span>' : ''}
            </button>`;
        });

        html += `</div>`;
        html += `<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.2rem;">`;
        html += `<button id="user-select-cancel" style="padding:0.5rem 1rem; border:1px solid rgba(255,255,255,0.1); border-radius:8px; background:transparent; color:#94a3b8; cursor:pointer; font:500 0.8rem Inter,sans-serif;">Anuluj</button>`;
        html += `</div>`;

        modal.innerHTML = html;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Handle button clicks
        modal.querySelectorAll('.user-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-user-id');
                const selectedUser = users.find(u => u.id === userId);
                document.body.removeChild(overlay);
                resolve(selectedUser);
            });
        });

        modal.querySelector('#user-select-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(null);
            }
        });
    });
}

function saveOrderStudnie() {
    if (!editingOfferIdStudnie) return;
    const offer = offersStudnie.find(o => o.id === editingOfferIdStudnie);
    if (!offer) return;
    const order = ordersStudnie.find(o => o.offerId === offer.id);
    if (!order) return;

    // Update order wells with current wells state
    order.wells = JSON.parse(JSON.stringify(wells));
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    // Recalculate totals
    let totalNetto = 0, totalWeight = 0;
    wells.forEach(well => {
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

function deleteOrderStudnie(orderId) {
    if (!confirm('Czy na pewno usunąć to zamówienie?')) return;
    const order = ordersStudnie.find(o => o.id === orderId);
    let affectedOfferId = null;
    if (order) {
        affectedOfferId = order.offerId;
        // Remove hasOrder flag from offer
        const offer = offersStudnie.find(o => o.id === order.offerId);
        if (offer) {
            offer.hasOrder = false;
            delete offer.orderId;
            saveOffersDataStudnie(offersStudnie);
        }
    }
    ordersStudnie = ordersStudnie.filter(o => o.id !== orderId);
    saveOrdersDataStudnie(ordersStudnie);
    renderSavedOffersStudnie();
    showToast('Zamówienie usunięte', 'info');
    
    // Jeśli usunięte zamówienie dotyczy aktualnie otwartej oferty w edytorze, odśwież widok
    if (affectedOfferId && editingOfferIdStudnie === affectedOfferId) {
        refreshAll();
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
        const o = orig[i], c = curr[i];
        const diffs = [];

        // Compare config (components)
        const oConfig = JSON.stringify(o.config || []);
        const cConfig = JSON.stringify(c.config || []);
        if (oConfig !== cConfig) diffs.push('config');

        // Compare przejscia (ignoring angle, angleExecution, angleGony)
        const cleanPrzejscia = (arr) => (arr || []).map(p => ({
            productId: p.productId,
            rzednaWlaczenia: p.rzednaWlaczenia,
            notes: p.notes
        }));
        if (JSON.stringify(cleanPrzejscia(o.przejscia)) !== JSON.stringify(cleanPrzejscia(c.przejscia))) {
            diffs.push('przejscia');
        }

        // Compare params
        const paramKeys = ['nadbudowa', 'dennicaMaterial', 'wkladka', 'klasaBetonu', 'agresjaChemiczna', 'agresjaMrozowa', 'malowanieW', 'malowanieZ', 'kineta', 'redukcjaKinety', 'stopnie', 'spocznikH', 'usytuowanie'];
        paramKeys.forEach(key => {
            if ((o[key] || '') !== (c[key] || '')) diffs.push(key);
        });

        // Compare basic fields & elevations
        if ((o.dn || 0) !== (c.dn || 0)) diffs.push('dn');
        if ((o.name || '') !== (c.name || '')) diffs.push('name');
        if ((o.rzednaWlazu == null ? '' : o.rzednaWlazu) !== (c.rzednaWlazu == null ? '' : c.rzednaWlazu)) diffs.push('rzednaWlazu');
        if ((o.rzednaDna == null ? '' : o.rzednaDna) !== (c.rzednaDna == null ? '' : c.rzednaDna)) diffs.push('rzednaDna');

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
    return ordersStudnie.find(o => o.offerId === editingOfferIdStudnie) || null;
}

/** Enter order editing mode — loads order into main editor */
async function enterOrderEditMode(orderId) {
    try {
        const res = await fetch(`/api/orders-studnie/${orderId}`, { headers: authHeaders() });
        if (!res.ok) { showToast('Zamówienie nie znalezione', 'error'); return; }
        const json = await res.json();
        const order = json.data;
        if (!order) { showToast('Zamówienie nie znalezione', 'error'); return; }

        orderEditMode = { orderId: order.id, order: order };

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        // Load wells from order
        wells = JSON.parse(JSON.stringify(order.wells));
        migrateWellData(wells);

        // Automatyczne odblokowanie widoku kategorii dla użytych przejść
        wells.forEach(w => {
            if (w.przejscia) {
                w.przejscia.forEach(pr => {
                    const prod = studnieProducts.find(p => p.id === pr.productId);
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
        document.getElementById('offer-date').value = order.date || new Date().toISOString().slice(0, 10);
        document.getElementById('client-name').value = order.clientName || '';
        document.getElementById('client-nip').value = order.clientNip || '';
        document.getElementById('client-address').value = order.clientAddress || '';
        document.getElementById('client-contact').value = order.clientContact || '';
        document.getElementById('invest-name').value = order.investName || '';
        document.getElementById('invest-address').value = order.investAddress || '';
        document.getElementById('invest-contractor').value = order.investContractor || '';

        // Skip wizard → go to step 3 (config)
        skipWizardToStep3();
        showSection('builder');

        // Update UI
        refreshAll();

        // Show order mode banner
        renderOrderModeBanner();

        // Update page title
        document.title = `📦 Zamówienie: ${order.number || orderId}`;

        showToast('📦 Zamówienie wczytane do edycji', 'success');
    } catch (err) {
        console.error('Błąd ładowania zamówienia:', err);
        showToast('Błąd ładowania zamówienia: ' + err.message, 'error');
    }
}

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
            <a href="/studnie?tab=saved" class="btn btn-sm btn-secondary" style="font-size:0.65rem; padding:0.25rem 0.5rem;">← Wróć do ofert</a>
        </div>
    `;
}

async function saveCurrentOrder() {
    if (!orderEditMode) { showToast('Brak trybu zamówienia', 'error'); return; }

    const order = orderEditMode.order;

    // Update order with current wells
    order.wells = JSON.parse(JSON.stringify(wells));
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    // Recalculate totals
    let totalNetto = 0, totalWeight = 0;
    wells.forEach(well => {
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



/* ===== ZLECENIA PRODUKCYJNE (Production Orders) ===== */
let productionOrders = [];
let zleceniaElementsList = []; // [{wellIndex, elementIndex, well, product, configItem}]
let zleceniaSelectedIdx = -1;

async function loadProductionOrders() {
    try {
        const resp = await fetch('/api/production-orders', { headers: authHeaders() });
        if (resp.ok) {
            const json = await resp.json();
            productionOrders = json.data || [];
        }
    } catch (e) { console.error('loadProductionOrders error:', e); }
}

async function saveProductionOrdersData(data) {
    try {
        await fetch('/api/production-orders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ data })
        });
    } catch (e) { console.error('saveProductionOrdersData error:', e); }
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
    return a > 0 ? (360 - a) : 0;
}

function openZleceniaProdukcyjne() {
    if (wells.length === 0) {
        showToast('Najpierw dodaj studnie', 'error');
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
    // Auto select first element
    if (zleceniaElementsList.length > 0) {
        selectZleceniaElement(0);
    }
}

function closeZleceniaModal() {
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
    zleceniaElementsList = [];
    wells.forEach((well, wIdx) => {
        well.config.forEach((item, eIdx) => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (p && (p.componentType === 'dennica' || p.componentType === 'krag_ot')) {
                zleceniaElementsList.push({
                    wellIndex: wIdx,
                    elementIndex: eIdx,
                    well: well,
                    product: p,
                    configItem: item
                });
            }
        });
    });
    renderZleceniaList();
}

function renderZleceniaList() {
    const container = document.getElementById('zlecenia-elements-list');
    const countEl = document.getElementById('zlecenia-el-count');
    if (!container) return;

    const search = (document.getElementById('zlecenia-search')?.value || '').toLowerCase();

    const groupedElements = {};
    let visibleCount = 0;

    zleceniaElementsList.forEach((el, i) => {
        const matchesSearch = !search ||
            el.product.name.toLowerCase().includes(search) ||
            el.well.name.toLowerCase().includes(search) ||
            ('dn' + el.well.dn).toLowerCase().includes(search);
        if (!matchesSearch) return;

        if (!groupedElements[el.wellIndex]) {
            groupedElements[el.wellIndex] = {
                wellName: el.well.name,
                wellDn: el.well.dn,
                elements: []
            };
        }
        groupedElements[el.wellIndex].elements.push({ el, index: i });
        visibleCount++;
    });

    let html = '';
    
    Object.keys(groupedElements).forEach(wIdx => {
        const group = groupedElements[wIdx];
        
        // Well Header
        html += `<div style="background:var(--bg-secondary); padding:0.6rem 0.8rem; border-bottom:1px solid var(--border-glass); border-top:1px solid var(--border-glass); position:sticky; top:0; z-index:5; display:flex; justify-content:space-between; align-items:center; margin-top:-1px;">
            <div style="font-size:0.75rem; font-weight:800; color:#818cf8; text-transform:uppercase; letter-spacing:0.5px;">🏷️ ${group.wellName}</div>
            <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); background:var(--bg-primary); padding:0.2rem 0.5rem; border-radius:12px; border:1px solid var(--border-glass);">DN${group.wellDn}</div>
        </div>
        <div style="padding: 0.4rem;">`; // wrapper for elements in this well

        group.elements.forEach(item => {
            const el = item.el;
            const i = item.index;
            const isSaved = productionOrders.some(po => po.wellId === el.well.id && po.elementIndex === el.elementIndex);
            const savedOrder = productionOrders.find(po => po.wellId === el.well.id && po.elementIndex === el.elementIndex);
            const isAccepted = savedOrder && savedOrder.status === 'accepted';
            const isActive = i === zleceniaSelectedIdx;
            
            html += `<div class="zlecenia-el-item ${isActive ? 'active' : ''} ${isSaved ? 'saved' : ''} ${isAccepted ? 'accepted' : ''}" onclick="selectZleceniaElement(${i})" style="margin-bottom:0.3rem;">
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary);">${el.product.name}</div>
                <div style="display:flex; gap:0.6rem; margin-top:0.15rem; font-size:0.62rem; color:var(--text-muted);">
                    ${el.product.height ? '<span>📐 Wyskokość: ' + el.product.height + 'mm</span>' : ''}
                </div>
                ${isAccepted ? '<div style="font-size:0.55rem; color:#34d399; margin-top:0.2rem; font-weight:700;">🔒 Zaakceptowane — studnia zablokowana</div>' : (isSaved ? '<div style="font-size:0.55rem; color:#fbbf24; margin-top:0.2rem; font-weight:700;">⏳ Wersja robocza</div>' : '')}
            </div>`;
        });
        
        html += `</div>`;
    });

    if (html === '') html = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.72rem;">Brak elementów (dennic / kręgów z otworem)</div>';
    
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
    
    populateZleceniaForm(el);
}

function renderZleceniaSvgPreview(well) {
    const svg = document.getElementById('zlecenia-svg-preview');
    const info = document.getElementById('zlecenia-well-info-mini');
    if (!svg) return;

    // Use the REAL well diagram renderer with the target SVG
    renderWellDiagram(svg, well);

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
    const dnoKineta = parsed.wysokosc - parsed.glebokosc;
    const din = getStudniaDIN(well.dn);
    const todayStr = new Date().toISOString().split('T')[0];
    const orderNumber = orderEditMode ? orderEditMode.order.number : (document.getElementById('offer-number')?.value || '');

    // Get user name
    const userName = currentUser ? ((currentUser.firstName || '') + ' ' + (currentUser.lastName || '')).trim() || currentUser.username : '';
    // Get firma from offer client
    const clientName = document.getElementById('client-name')?.value || '';
    const investName = document.getElementById('invest-name')?.value || '';
    const investAddress = document.getElementById('invest-address')?.value || '';
    const investContractor = document.getElementById('invest-contractor')?.value || '';

    // Check for existing saved production order
    const existing = productionOrders.find(po => po.wellId === well.id && po.elementIndex === elementIndex);

    // Compute which element gets which transition to filter for this `elementIndex`
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const configMap = [];
    let currY = 0;
    let dennicaProcessedCount = 0;
    for (let j = well.config.length - 1; j >= 0; j--) {
        const cItem = well.config[j];
        const p = studnieProducts.find(pr => pr.id === cItem.productId);
        if (!p) continue;
        let h = 0;
        if (p.componentType === 'dennica') {
            for (let q = 0; q < cItem.quantity; q++) {
                dennicaProcessedCount++;
                h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
            }
        } else {
            h = (p.height || 0) * cItem.quantity;
        }
        configMap.push({ index: j, name: p.name, start: currY, end: currY + h });
        currY += h;
    }

    // Filter transitions assigned to this element
    const assignedPrzejscia = (well.przejscia || []).filter(item => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        let assignedIndex = -1;
        for (let cm of configMap) {
            if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
                assignedIndex = cm.index;
                break;
            }
        }
        if (assignedIndex === -1 && configMap.length > 0) {
            assignedIndex = (mmFromBottom < 0) ? configMap[0].index : configMap[configMap.length - 1].index;
        }
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

    // Values for tiles
    const redKinetyVal = existing?.redukcjaKinety ?? well.redukcjaKinety ?? '';
    const spocznikHVal = existing?.spocznikH ?? well.spocznikH ?? '';
    const usytuowanieVal = existing?.usytuowanie ?? well.usytuowanie ?? '';
    const kinetaVal = existing?.kineta ?? well.kineta ?? '';
    const klasaBetonuVal = existing?.klasaBetonu ?? well.klasaBetonu ?? '';
    
    // Quick tiles for kat stopni
    const katOptions = ['90', '135', '180', '270'];
    
    const dinOptions = [
        ['AT/2009-03-1733', 'AT/2009-03-1733'],
        ['Brak', 'Brak']
    ];
    
    const spocznikMatOptions = [
        ['brak', 'Brak'], ['beton_gfk', 'Beton z GFK'], ['klinkier', 'Klinkier'],
        ['preco', 'Preco'], ['precotop', 'Preco Top'], ['unolith', 'UnoLith'],
        ['predl', 'Predl'], ['kamionka', 'Kamionka']
    ];
    
    const rodzajStudniOptions = [
        ['beton', 'Beton'], ['zelbet', 'Żelbet']
    ];
    
    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? '';
    
    let domyslnyRodzajStudni = '';
    if (product && product.componentType === 'dennica') {
        domyslnyRodzajStudni = (well.dennicaMaterial === 'zelbetowa') ? 'zelbet' : 'beton';
    } else {
        domyslnyRodzajStudni = (well.nadbudowa === 'zelbetowa') ? 'zelbet' : 'beton';
    }
    const rodzajStudniVal = existing?.rodzajStudni || domyslnyRodzajStudni;

    // Map well params to display labels
    const kinetaOptions = [
        ['brak', 'Brak'], ['beton', 'Beton'], ['beton_gfk', 'Beton GFK'],
        ['klinkier', 'Klinkier'], ['preco', 'Preco'], ['precotop', 'PrecoTop'], ['unolith', 'UnoLith']
    ];
    const spocznikOptions = [
        ['1/2', '1/2'], ['2/3', '2/3'], ['3/4', '3/4'], ['1/1', '1/1'], ['brak', 'Brak']
    ];
    const usytOptions = [
        ['linia_dolna', 'Linia dolna'], ['linia_gorna', 'Linia górna'],
        ['w_osi', 'W osi'], ['patrz_uwagi', 'Patrz uwagi']
    ];
    const redKinetyOptions = [
        ['tak', 'Tak'], ['nie', 'Nie']
    ];
    const klasaBetonuOptions = [
        ['C40/50', 'C40/50'], ['C40/50(HSR!!!!)', 'C40/50 HSR'],
        ['C45/55', 'C45/55'], ['C45/55(HSR!!!!)', 'C45/55 HSR'],
        ['C70/85', 'C70/85'], ['C70/80(HSR!!!!)', 'C70/80 HSR']
    ];

    container.innerHTML = `
    <!-- Dane zlecenia -->
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm" onclick="const b=this.nextElementSibling; b.style.display=b.style.display==='none'?'grid':'none'; this.querySelector('.zl-toggle').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer; user-select:none; display:flex; justify-content:space-between; align-items:center;">
            <span>📋 Dane zlecenia <span style="margin-left:8px; color:#818cf8; font-weight:800;">${orderNumber}</span></span>
            <span class="zl-toggle" style="font-size:0.6rem; color:var(--text-muted);">▶</span>
        </div>
        <div style="display:none; grid-template-columns:1fr 1fr; gap:0.5rem; padding:0.2rem 0;">
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
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">${orderNumber}</span>
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
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">DN${well.dn}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Głębokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${parsed.glebokosc || '—'} mm</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Wysokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${parsed.wysokosc || (product.height || 0)} mm</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Gr. dna</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${dnoKineta > 0 ? dnoKineta + ' mm' : '—'}</span>
                    </div>
                </div>
                
                <!-- Rodzaj studni -->
                <div class="form-group-sm" style="margin-top:0.3rem;">
                    <label class="form-label-sm" class="ui-text-sec">Rodzaj studni</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.3rem;" class="zl-param-group">
                        ${rodzajStudniOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === rodzajStudniVal ? 'active' : ''}" style="padding:0.6rem; font-size:0.85rem; font-weight:800; letter-spacing:0.5px; border-radius:8px;" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                </div>

            </div>
        </div>

        <div class="card card-compact" style="display:flex; flex-direction:column; box-sizing:border-box; overflow-x:auto;">
            <div class="card-title-sm" style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                <span>🔗 Przejścia </span>
                <span style="color:var(--text-muted); font-size:0.7rem;">(${przejsciaCount})</span>
            </div>
            <div id="zlecenia-przejscia-mirror" style="flex:1; border-radius:var(--radius-sm); font-size:0.72rem; color:var(--text-secondary); display:flex; flex-direction:column; overflow-y:auto; overflow-x:auto; min-width:100%;">
            </div>
        </div>
    </div>

    <!-- Uwagi (Pełna szerokość pod spodem) -->
    <div class="card card-compact" style="margin-bottom:0.5rem; display:flex; flex-direction:column;">
        <div class="card-title-sm">📝 Uwagi</div>
        <div class="form-group-sm" style="flex:1; display:flex; flex-direction:column; margin-bottom:0;">
            <textarea id="zl-uwagi" class="form-textarea" placeholder="Uwagi do zlecenia..." style="flex:1; min-height:80px; resize:none;">${existing?.uwagi || ''}</textarea>
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
                    <div class="ui-row-gap" class="zl-param-group">
                        ${redKinetyOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === redKinetyVal ? 'active' : ''}" class="ui-badge" onclick="selectZleceniaTile(this, 'zl-red-kinety', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-red-kinety" value="${redKinetyVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Studnia wd. DIN</label>
                    <div class="ui-row-gap" class="zl-param-group">
                        <input type="text" id="zl-din" class="form-input form-input-sm" value="${dinVal}" style="width:140px; margin-right:5px; color:#818cf8; font-weight:700;">
                        ${dinOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile" class="ui-badge" onclick="document.getElementById('zl-din').value='${v}'">${l}</button>`
                        ).join('')}
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Rodzaj stopni</label>
                    <div class="ui-row-gap" class="zl-param-group">
                        ${stopnieOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === stopnieVal ? 'active' : ''}" class="ui-badge" onclick="selectZleceniaTile(this, 'zl-rodzaj-stopni', '${v}')">${l}</button>`
                        ).join('')}
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
                        ${katOptions.map(v =>
                            `<button type="button" class="param-tile" class="ui-badge" onclick="document.getElementById('zl-kat-stopni').value='${v}'; onZleceniaKatChange();">${v}°</button>`
                        ).join('')}
                    </div>
                </div>
            </div>

            <!-- Kolumna 2 -->
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm">
                    <label class="form-label-sm">Wysokość spocznika</label>
                    <div class="ui-row-gap" class="zl-param-group">
                        ${spocznikOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === spocznikHVal ? 'active' : ''}" class="ui-badge" onclick="selectZleceniaTile(this, 'zl-spocznik-h', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik-h" value="${spocznikHVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Usytuowanie</label>
                    <div class="ui-row-gap" class="zl-param-group">
                        ${usytOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === usytuowanieVal ? 'active' : ''}" class="ui-badge" onclick="selectZleceniaTile(this, 'zl-usytuowanie', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-usytuowanie" value="${usytuowanieVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Kineta</label>
                    <div class="ui-row-gap" class="zl-param-group">
                        ${kinetaOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === kinetaVal ? 'active' : ''}" class="ui-badge" onclick="selectZleceniaTile(this, 'zl-kineta', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-kineta" value="${kinetaVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Spocznik</label>
                    <div class="ui-row-gap" class="zl-param-group">
                        ${spocznikMatOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === spocznikMatVal ? 'active' : ''}" class="ui-badge" onclick="selectZleceniaTile(this, 'zl-spocznik', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik" value="${spocznikMatVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Klasa betonu</label>
                    <div class="ui-row-gap" class="zl-param-group">
                        ${klasaBetonuOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === klasaBetonuVal ? 'active' : ''}" class="ui-badge" onclick="selectZleceniaTile(this, 'zl-klasa-betonu', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-klasa-betonu" value="${klasaBetonuVal}">
                </div>
            </div>
        </div>
    </div>
    `;
    // Render filtered przejścia into the mirror container
    const mirrorEl = document.getElementById('zlecenia-przejscia-mirror');
    if (mirrorEl) {
        if (assignedPrzejscia.length === 0) {
            mirrorEl.innerHTML = '<div style="padding:1.2rem; text-align:center; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; font-size:0.75rem;">Brak przejść szczelnych<br>w tym elemencie.</div>';
        } else {
            mirrorEl.innerHTML = assignedPrzejscia.map((item, i) => {
                const globalIndex = well.przejscia.indexOf(item);
                const przProd = studnieProducts.find(pr => pr.id === item.productId);
                const przName = przProd ? przProd.category : 'Nieznane';
                const dn = przProd ? przProd.dn : '—';
                if (!item.flowType) {
                    item.flowType = (i === 0 && (item.angle === 0 || item.angle === '0')) ? 'wylot' : 'wlot';
                }
                const flowLabel = item.flowType === 'wylot' ? 'Wylot' : 'Wlot';
                const flowBg = item.flowType === 'wylot' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)';
                const flowColor = item.flowType === 'wylot' ? '#fca5a5' : '#93c5fd';
                const flowBorder = item.flowType === 'wylot' ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)';
                const flowIcon = item.flowType === 'wylot' ? '📤' : '📥';
                const angleColor = (item.angle === 0 || item.angle === '0') ? '#6366f1' : '#818cf8';

                let pel = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                const mmFromBottom = (pel - rzDna) * 1000;
                let elementStartMm = 0;
                for (let cm of configMap) {
                    if (mmFromBottom >= cm.start && mmFromBottom < cm.end) { elementStartMm = cm.start; break; }
                }
                const heightMm = Math.round(mmFromBottom - elementStartMm);

                return `<div style="background:linear-gradient(90deg, rgba(30,58,138,0.3) 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:5px solid ${flowBorder}; border-radius:10px; height:49px; padding:0 0.45rem; box-sizing:border-box; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem;">
                    <button onclick="openFlowTypePopup(${globalIndex})" title="Kliknij by zmienić na Wlot/Wylot" style="background:${flowBg}; color:${flowColor}; border:1px solid ${flowBorder}; border-radius:8px; padding:0.15rem 0.4rem; display:flex; flex-direction:column; align-items:center; cursor:pointer; min-width:55px; transition:all 0.2s;">
                        <span style="font-size:1.1rem; margin-bottom:0px;">${flowIcon}</span>
                        <span style="font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-top:-2px;">${flowLabel}</span>
                    </button>
                    <div style="flex:1; display:flex; justify-content:space-between; align-items:center; gap:0.8rem; white-space:nowrap;">
                        <div style="display:flex; flex-direction:column; gap:0.15rem; min-width:120px; overflow:hidden;">
                            <div style="display:flex; align-items:center; gap:0.6rem; white-space:nowrap;">
                                <span style="font-size:1.0rem; font-weight:800; color:var(--text-primary);">${przName}</span>
                                <span style="font-size:1.0rem; color:#a78bfa; font-weight:800;">${typeof dn === 'string' && dn.includes('/') ? dn : 'DN ' + dn}</span>
                            </div>
                            ${item.notes ? `<div style="font-size:0.65rem; color:#94a3b8; font-style:italic; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📝 ${item.notes}</div>` : ''}
                        </div>
                        <div style="display:flex; align-items:center; gap:1.5rem; margin-right: 0.5rem; white-space:nowrap;">
                          <div class="ui-center-min">
                            <div class="ui-text-muted-sm">Spadek w k.</div>
                            <div onclick="window.activateQuickEdit(this, ${globalIndex}, 'spadekKineta')" title="Kliknij aby edytować" style="font-size:0.9rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.3rem; transition:color 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'" onmouseleave="this.style.color='var(--text-primary)'">${item.spadekKineta != null && item.spadekKineta !== '' ? item.spadekKineta + '%' : '—'}</div>
                          </div>
                          <div class="ui-center-min">
                            <div class="ui-text-muted-sm">Spadek w m.</div>
                            <div onclick="window.activateQuickEdit(this, ${globalIndex}, 'spadekMufa')" title="Kliknij aby edytować" style="font-size:0.9rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.3rem; transition:color 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'" onmouseleave="this.style.color='var(--text-primary)'">${item.spadekMufa != null && item.spadekMufa !== '' ? item.spadekMufa + '%' : '—'}</div>
                          </div>
                          <div style="text-align:center; min-width:80px; position:relative; padding-bottom:0.1rem;">
                            <div class="ui-text-muted-sm">Kąt</div>
                            <div onclick="window.activateQuickEdit(this, ${globalIndex}, 'angle')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.05rem; font-weight:800; color:${angleColor}; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.5rem; transition:transform 0.2s; display:inline-block;" onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform='scale(1)'">${item.angle}°</div>
                          </div>
                          <div style="text-align:center; min-width:70px;">
                            <div class="ui-text-muted-sm">Wysokość</div>
                            <div onclick="window.activateQuickEdit(this, ${globalIndex}, 'heightMm')" title="Wysokość od dolnej krawędzi elementu" style="font-size:1.05rem; font-weight:800; color:#f59e0b; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.3rem; transition:color 0.2s; display:inline-block;" onmouseenter="this.style.color='#fbbf24'" onmouseleave="this.style.color='#f59e0b'">${heightMm} mm</div>
                          </div>
                          <div style="text-align:center; min-width:65px;">
                            <div class="ui-text-muted-sm">Kąt wyk.</div>
                            <div style="font-size:1.0rem; font-weight:700; color:#38bdf8;" title="360° - kąt">${(item.angle === 0 || item.angle === 360) ? '0' : (360 - item.angle)}°</div>
                          </div>
                          <div class="ui-center-min">
                            <div class="ui-text-muted-sm">Kąt gony</div>
                            <div style="font-size:1.0rem; font-weight:700; color:#2dd4bf;" title="Kąt wykonania w gonach">${((item.angle === 0 || item.angle === 360) ? 0 : ((360 - item.angle) * 400 / 360)).toFixed(2)}g</div>
                          </div>
                          <div style="text-align:center; min-width:80px;">
                            <div class="ui-text-muted-sm">Rzędna</div>
                            <div onclick="window.activateQuickEdit(this, ${globalIndex}, 'rzednaWlaczenia')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.05rem; font-weight:800; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.5rem; transition:color 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'" onmouseleave="this.style.color='var(--text-primary)'">${item.rzednaWlaczenia || '—'}</div>
                          </div>
                       </div>
                    </div>
                </div>`;
            }).join('');
        }
    }
}

function selectZleceniaTile(btn, targetId, val) {
    const group = btn.closest('.zl-param-group');
    if (group) {
        group.querySelectorAll('.param-tile').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');
    
    const input = document.getElementById(targetId);
    if (input) {
        input.value = val;
    }
    
    if (targetId === 'zl-rodzaj-stopni') {
        onZleceniaStopnieChange();
    } else if (targetId === 'zl-rodzaj-studni') {
        if (typeof window.zleceniaSelectedIdx === 'number' && window.zleceniaElementsList) {
            const el = window.zleceniaElementsList[window.zleceniaSelectedIdx];
            if (el && el.well && el.product) {
                // Zachowaj tymczasowe uwagi z okienka przed jego przeładowaniem
                const tempUwagi = document.getElementById('zl-uwagi') ? document.getElementById('zl-uwagi').value : '';
                
                // Ustaw odpowiednią globalną cechę studni w zależności od edytowanego elementu
                if (el.product.componentType === 'dennica') {
                    el.well.dennicaMaterial = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                } else {
                    el.well.nadbudowa = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                }
                
                const oldWellIdx = el.wellIndex;
                const oldCat = el.product.category;

                // 1. Zaktualizowanie komponentów by dobrać wyrobienie Żelbet/Beton (i uaktualnić ich ceny)
                if (typeof window.autoSelectComponents === 'function') {
                    window.autoSelectComponents(false);
                }
                
                // 2. Przebudowanie głównych widoków pod spodem
                if (typeof window.renderWellConfig === 'function') window.renderWellConfig();
                if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
                if (typeof window.updateSummary === 'function') window.updateSummary();
                
                // 3. Przebudowa Listy elementów w Zleceniu, tak by zaktualizować wewnętrzne obiekty Ceny/Produktów
                if (typeof window.buildZleceniaWellList === 'function') {
                    window.buildZleceniaWellList();
                }
                
                // 4. Spróbujmy znaleźć przeliczony index elementu i go wybrać powtórnie
                let newTargetIdx = window.zleceniaElementsList.findIndex(e => e.wellIndex === oldWellIdx && e.product && e.product.category === oldCat);
                if (newTargetIdx === -1) {
                    newTargetIdx = window.zleceniaElementsList.findIndex(e => e.wellIndex === oldWellIdx);
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

    const existingIdx = productionOrders.findIndex(po => po.wellId === well.id && po.elementIndex === elementIndex);

    const order = {
        id: existingIdx >= 0 ? productionOrders[existingIdx].id : 'prodorder_' + Date.now(),
        userId: currentUser ? currentUser.id : null,
        wellId: well.id,
        wellName: well.name,
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
        srednica: well.dn,
        wysokosc: document.getElementById('zl-wysokosc')?.value || '',
        glebokosc: document.getElementById('zl-glebokosc')?.value || '',
        dnoKineta: document.getElementById('zl-dno-kineta')?.value || '',
        rodzajStudni: document.getElementById('zl-rodzaj-studni')?.value || '',

        // Przejscia snapshot
        przejscia: well.przejscia ? JSON.parse(JSON.stringify(well.przejscia)) : [],

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

        createdAt: existingIdx >= 0 ? productionOrders[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: existingIdx >= 0 ? (productionOrders[existingIdx].status || 'draft') : 'draft'
    };

    if (existingIdx >= 0) {
        productionOrders[existingIdx] = order;
    } else {
        productionOrders.push(order);
    }

    await saveProductionOrdersData(productionOrders);
    renderZleceniaList();
    showToast('✅ Zlecenie produkcyjne zapisane', 'success');
}

async function deleteProductionOrder(id) {
    if (!confirm('Usunąć to zlecenie produkcyjne?')) return;
    try {
        await fetch('/api/production-orders/' + id, {
            method: 'DELETE',
            headers: authHeaders()
        });
        productionOrders = productionOrders.filter(po => po.id !== id);
        renderZleceniaList();
        refreshAll(); // odblokuj studnię wizualnie po usunięciu zlecenia
        showToast('Zlecenie usunięte', 'info');
    } catch (e) { console.error('deleteProductionOrder error:', e); }
}

async function acceptProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }
    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = productionOrders.find(p => p.wellId === el.well.id && p.elementIndex === el.elementIndex);
    if (!po) { showToast('Najpierw zapisz zlecenie produkcyjne', 'error'); return; }
    if (po.status === 'accepted') { showToast('Zlecenie już zaakceptowane', 'info'); return; }
    if (!confirm('Zaakceptować zlecenie? Studnia zostanie zablokowana od edycji.')) return;
    po.status = 'accepted';
    po.acceptedAt = new Date().toISOString();
    po.acceptedBy = currentUser ? currentUser.username : '';
    await saveProductionOrdersData(productionOrders);
    renderZleceniaList();
    showToast('🔒 Zlecenie zaakceptowane — studnia zablokowana', 'success');
}

async function revokeProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }
    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = productionOrders.find(p => p.wellId === el.well.id && p.elementIndex === el.elementIndex);
    if (!po) { showToast('Brak zlecenia do cofnięcia', 'error'); return; }
    if (po.status !== 'accepted') { showToast('Zlecenie nie jest zaakceptowane', 'info'); return; }
    if (!confirm('Cofnąć akceptację? Studnia zostanie odblokowana.')) return;
    po.status = 'draft';
    delete po.acceptedAt;
    delete po.acceptedBy;
    await saveProductionOrdersData(productionOrders);
    renderZleceniaList();
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

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { setupParamTiles(); updateParamTilesUI(); loadProductionOrders(); }, 500); });
