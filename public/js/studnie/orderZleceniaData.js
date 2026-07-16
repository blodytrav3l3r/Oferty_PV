/* ===== ZLECENIA PRODUKCYJNE — WARSTWA DANYCH ===== */

async function loadProductionOrders() {
    try {
        const resp = await fetchWithTimeout('/api/orders-studnie/production', {
            headers: authHeaders()
        });
        if (resp.ok) {
            const json = await resp.json();
            productionOrders = json.data || [];
        }
    } catch (e) {
        logger.error('orderManager', 'loadProductionOrders error:', e);
    }
    return productionOrders;
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
    renderZleceniaList();
    refreshAll();
    if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
        populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
    }
    showToast('<i data-lucide="unlock"></i> Akceptacja cofnięta — studnia odblokowana', 'info');
}
