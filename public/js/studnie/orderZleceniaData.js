/* ===== ZLECENIA PRODUKCYJNE — WARSTWA DANYCH ===== */

async function loadProductionOrders() {
    try {
        const resp = await fetchWithTimeout('/api/orders-studnie/production', {
            headers: authHeaders()
        });
        if (resp.ok) {
            const json = await resp.json();
            productionOrders = json.data || [];
            // Audyt uruchamia appStudnie.js po załadowaniu wszystkich danych w tle (orders, offers, products)
        }
    } catch (e) {
        logger.error('orderManager', 'loadProductionOrders error:', e);
    }
    return productionOrders;
}

/**
 * Audyt cichej zmiany (Faza 3, krok 3.7): loguje PZ, których elementKey nie ma
 * odpowiadającego elementu (_elemId) w aktualnym configu studni. Sygnalizuje PZ,
 * który po sortowaniu/usunięciu elementu mógł stracić swoje wskazanie.
 *
 * Klasyfikacja:
 *  - WARN  — elementKey nie istnieje ani w studniach załadowanych do edytora,
 *            ani w studniach oferty źródłowej (po.offerId) → osierocone PZ.
 *  - INFO  — elementKey nie ma w bieżącym kontekście edytora (np. snapshot
 *            zamówienia), ale żyje w ofercie źródłowej → nie osierocone.
 *
 * Wynik zbierany w window.pzAuditMismatches + jednorazowy toast na sesję.
 */
const _pzAuditSeen = new Set();
let _pzAuditToastShown = false;

function _collectElemIdsByWell(wellList, target /* Map<wellId, Set<elemId>> */) {
    for (const well of wellList || []) {
        const ids = ((well && well.config) || [])
            .map((c) => c && c._elemId)
            .filter(Boolean)
            .map(String);
        if (ids.length === 0) continue;
        const key = String(well.id);
        if (!target.has(key)) target.set(key, new Set());
        ids.forEach((id) => target.get(key).add(id));
    }
}

/**
 * Samonaprawa (Auto-heal): wstrzykuje po.elementKey z PZ do well.config[po.elementIndex]._elemId,
 * jeśli w edytorze/ofercie element pod tym samym indeksował miał przelosowany lub pusty _elemId.
 */
function _autoHealPzElementKeys(wellList, prodOrders) {
    if (!Array.isArray(wellList) || !Array.isArray(prodOrders)) return;
    const wellMap = new Map();
    for (const w of wellList) {
        if (w && w.id) wellMap.set(String(w.id), w);
    }
    for (const po of prodOrders) {
        if (!po || !po.wellId || !po.elementKey || typeof po.elementIndex !== 'number') continue;
        const well = wellMap.get(String(po.wellId));
        if (well && Array.isArray(well.config) && well.config[po.elementIndex]) {
            const item = well.config[po.elementIndex];
            if (item && item._elemId !== po.elementKey) {
                item._elemId = String(po.elementKey);
            }
        }
    }
}

function auditPzElementKeyMismatch() {
    if (!Array.isArray(productionOrders) || productionOrders.length === 0) return;
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return;

    // Najpierw wykonujemy auto-heal w RAM dla studni w edytorze, zamówieniach i ofertach źródłowych
    _autoHealPzElementKeys(wells, productionOrders);
    if (typeof ordersStudnie !== 'undefined' && Array.isArray(ordersStudnie)) {
        for (const order of ordersStudnie) {
            if (order && Array.isArray(order.wells)) {
                _autoHealPzElementKeys(order.wells, productionOrders);
            }
        }
    }
    if (typeof offersStudnie !== 'undefined' && Array.isArray(offersStudnie)) {
        for (const offer of offersStudnie) {
            if (offer && Array.isArray(offer.wells)) {
                _autoHealPzElementKeys(offer.wells, productionOrders);
            }
        }
    }

    // Mapy elemId: bieżący edytor + zamówienia źródłowe (ordersStudnie) + oferty źródłowe (offersStudnie)
    const editorIds = new Map();
    _collectElemIdsByWell(wells, editorIds);

    const orderIdsByOrder = new Map(); // Map<orderId, Map<wellId, Set<elemId>>>
    if (typeof ordersStudnie !== 'undefined' && Array.isArray(ordersStudnie)) {
        for (const order of ordersStudnie) {
            if (!order || !order.id) continue;
            const perWell = new Map();
            _collectElemIdsByWell(order.wells, perWell);
            if (perWell.size > 0) orderIdsByOrder.set(String(order.id), perWell);
        }
    }

    const offerIdsByOffer = new Map(); // Map<offerId, Map<wellId, Set<elemId>>>
    if (typeof offersStudnie !== 'undefined' && Array.isArray(offersStudnie)) {
        for (const offer of offersStudnie) {
            if (!offer || !offer.id) continue;
            const perWell = new Map();
            _collectElemIdsByWell(offer.wells, perWell);
            if (perWell.size > 0) offerIdsByOffer.set(String(offer.id), perWell);
        }
    }

    window.pzAuditMismatches = window.pzAuditMismatches || [];
    let warnCount = 0;
    let infoCount = 0;

    for (const po of productionOrders) {
        if (!po.elementKey || !po.wellId) continue;

        const inEditor = (() => {
            const ids = editorIds.get(String(po.wellId));
            return Boolean(ids && ids.has(String(po.elementKey)));
        })();
        if (inEditor) continue; // dopasowane w edytorze — nic nie logujemy

        // Czy wskazanie żyje w zamówieniu źródłowym PZ?
        const orderPerWell = po.orderId ? orderIdsByOrder.get(String(po.orderId)) : null;
        const inOrder = Boolean(
            orderPerWell && orderPerWell.get(String(po.wellId))?.has(String(po.elementKey))
        );

        // Fallback: czy wskazanie żyje w ofercie źródłowej PZ?
        const offerPerWell = po.offerId ? offerIdsByOffer.get(String(po.offerId)) : null;
        const inOffer = Boolean(
            offerPerWell && offerPerWell.get(String(po.wellId))?.has(String(po.elementKey))
        );

        if (inOrder) {
            // PZ jest prawidłowy w snapshotze zamówienia źródłowego
            continue;
        }

        if (_pzAuditSeen.has(po.id)) continue; // dedupe w obrębie sesji strony
        _pzAuditSeen.add(po.id);

        const ctx = {
            poId: po.id,
            wellId: po.wellId,
            elementKey: po.elementKey,
            productionOrderNumber: po.productionOrderNumber
        };

        if (inOffer) {
            infoCount++;
            logger.info(
                'pzAudit',
                'PZ elementKey poza snapshotem zamówienia (żyje w ofercie źródłowej):',
                ctx
            );
        } else {
            warnCount++;
            window.pzAuditMismatches.push(ctx);
            logger.warn(
                'pzAudit',
                'PZ elementKey nie pasuje do configu studni (możliwa cicha zmiana wskazania):',
                ctx
            );
        }
    }

    const total = warnCount + infoCount;
    if (total > 0) {
        logger.warn('pzAudit', `Audyt PZ: ${warnCount} osieroconych, ${infoCount} poza snapshotem`);
    }
    if (warnCount > 0 && !_pzAuditToastShown) {
        _pzAuditToastShown = true;
        const numbers = window.pzAuditMismatches
            .map((m) => m.productionOrderNumber)
            .filter(Boolean)
            .join(', ');
        showToast(
            `<i data-lucide="alert-triangle"></i> ${warnCount} zlecenie(nia) wskazuje na usunięty/zmieniony element (${numbers}). Zweryfikuj w zakładce Zlecenia.`,
            'warning'
        );
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
            logger.error('orderManager', 'saveProductionOrdersData error:', e);
            throw e;
        }
    }
    return results;
}

async function deleteProductionOrder(id) {
    const po = productionOrders.find((p) => p.id === id);
    if (!po) return;
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
        refreshAll();
        showToast('Zlecenie usunięte', 'info');
    } catch (e) {
        logger.error('orderManager', 'deleteProductionOrder error:', e);
        showToast(e.message, 'error');
    }
}

async function acceptProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    await saveProductionOrder();

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = pzGuard.findPzForElement(
        productionOrders || [],
        el.well.id,
        (el.configItem && el.configItem._elemId) || '',
        el.elementIndex
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

    if (!po.productionOrderNumber) {
        try {
            const targetUserId =
                (typeof orderEditMode !== 'undefined' &&
                    orderEditMode &&
                    orderEditMode.order &&
                    orderEditMode.order.userId) ||
                (typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId) ||
                (currentUser ? currentUser.id : null);

            if (!targetUserId) {
                showToast('Brak przypisanego użytkownika', 'error');
                return;
            }
            const claimResp = await fetch(
                '/api/orders-studnie/claim-production-number/' + targetUserId,
                {
                    method: 'POST',
                    headers: authHeaders()
                }
            );
            const claimData = await claimResp.json();
            if (claimResp.ok && claimData.number) {
                po.productionOrderNumber = claimData.number;
            } else {
                showToast('Błąd pobierania numeru zlecenia z serwera', 'error');
                return;
            }
        } catch (_e) {
            showToast('Błąd połączenia z serwerem przy numeracji', 'error');
            return;
        }
    }

    po.status = 'accepted';
    po.acceptedAt = new Date().toISOString();
    po.acceptedBy = currentUser ? currentUser.username : '';

    try {
        await saveProductionOrdersData(productionOrders);

        renderZleceniaList();
        renderZleceniaWellConfig();
        if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
            populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
        }
        refreshGlobalMetrics();
        showToast(
            '<i data-lucide="lock"></i> Zlecenie zaakceptowane — ' + po.productionOrderNumber,
            'success'
        );
    } catch (err) {
        logger.error('orderManager', 'acceptProductionOrder error:', err);
        showToast('<i data-lucide="x-circle"></i> Błąd akceptacji: ' + err.message, 'error');
    }
}

async function revokeProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    await saveProductionOrder();

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = pzGuard.findPzForElement(
        productionOrders || [],
        el.well.id,
        (el.configItem && el.configItem._elemId) || '',
        el.elementIndex
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
    renderZleceniaList();
    refreshAll();
    if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
        populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
    }
    showToast('<i data-lucide="unlock"></i> Akceptacja cofnięta — studnia odblokowana', 'info');
}

/* ===== Rejestracja globali ===== */
window.loadProductionOrders = loadProductionOrders;
window.auditPzElementKeyMismatch = auditPzElementKeyMismatch;
window.deleteProductionOrder = deleteProductionOrder;
window.acceptProductionOrder = acceptProductionOrder;
window.revokeProductionOrder = revokeProductionOrder;
