/* ============================
   WITROS — Wydruk Karty Budowy Rury
   offerPrintManager.js
   ============================ */

function handlePrintClick() {
    showUniversalPrintModalRury();
}

window.handlePrintClick = handlePrintClick;

function showUniversalPrintModalRury(offerId, orderId, relatedOrders) {
    const targetOfferId = offerId || (typeof editingOfferId !== 'undefined' ? editingOfferId : null);
    const targetOrderId = orderId || (typeof editingRuryOrderId !== 'undefined' ? editingRuryOrderId : null);

    let orders = [];
    if (Array.isArray(relatedOrders) && relatedOrders.length > 0) {
        orders = relatedOrders;
    } else {
        if (targetOfferId && typeof getOrdersForOffer === 'function') {
            orders = getOrdersForOffer(targetOfferId);
        }
        if (targetOrderId && orders.length === 0) {
            if (typeof ordersRury !== 'undefined') {
                const currentOrder = ordersRury.find(o => o.id === targetOrderId);
                if (currentOrder) orders = [currentOrder];
            }
        }
    }

    const config = {
        modalTitle: 'Wydruk Dokumentów',
        offerSection: targetOfferId ? {
            id: targetOfferId,
            actionPdf: 'exportOfferDirectRury_action',
            actionDocx: 'exportOfferDirectRury_action',
            title: 'Wydruk Oferty',
            description: 'Wybierz format eksportu oferty:'
        } : null,
        ordersSection: orders.length > 0 ? {
            orders: orders,
            actionPdf: 'exportOrderDirectRury_action',
            actionDocx: 'exportOrderDirectRury_action',
            title: 'Wydruk Zamówienia',
            description: 'Wybierz zamówienie i format eksportu:'
        } : null,
        kartaSection: orders.length > 0 ? {
            orders: orders,
            actionPdf: 'exportKartaDirectRury_action',
            actionDocx: 'exportKartaDirectRury_action',
            title: 'Wydruk Karty Budowy',
            description: 'Wybierz zamówienie i format Karty Budowy:'
        } : null
    };

    if (typeof window.__upmHelperShow === 'function') {
        window.__upmHelperShow(config);
    } else if (typeof showToast === 'function') {
        showToast('Helper printModal.js nie załadowany', 'error');
    }
}

window.showUniversalPrintModalRury = showUniversalPrintModalRury;

function getCurrentOfferForExport() {
    const number = document.getElementById('offer-number')?.value?.trim() || '';
    const date = document.getElementById('offer-date')?.value || '';
    const clientName = document.getElementById('client-name')?.value?.trim() || '';
    const clientNip = document.getElementById('client-nip')?.value?.trim() || '';
    const clientAddress = document.getElementById('client-address')?.value?.trim() || '';
    const clientContact = document.getElementById('client-contact')?.value?.trim() || '';
    const investName = document.getElementById('invest-name')?.value?.trim() || '';
    const investAddress = document.getElementById('invest-address')?.value?.trim() || '';
    const investContractor = document.getElementById('invest-contractor')?.value?.trim() || '';
    const notes = document.getElementById('offer-notes')?.value?.trim() || '';
    const paymentTerms = document.getElementById('offer-payment-terms')?.value?.trim() || '';
    const validity = document.getElementById('offer-validity')?.value?.trim() || '';

    return {
        id: editingOfferId,
        number,
        date,
        clientName,
        clientNip,
        clientAddress,
        clientContact,
        investName,
        investAddress,
        investContractor,
        notes,
        paymentTerms,
        validity,
        items: (typeof getActiveItemsArray === 'function' ? getActiveItemsArray() : (window.orderEditMode ? orderCurrentItems : currentOfferItems)) || []
    };
}

async function exportOfferDirectRury_action(offerId, format) {
    if (!offerId) {
        showToast('Brak ID oferty do eksportu', 'error');
        return;
    }

    try {
        if (format === 'pdf') {
            const res = await fetch(`/api/offers-rury/${offerId}/export-pdf`, {
                headers: authHeaders()
            });
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(`Eksport PDF (${res.status}): ${errText.slice(0, 200)}`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oferta_rury_${offerId.substring(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (format === 'docx') {
            const res = await fetch(`/api/offers-rury/${offerId}/export-docx`, {
                headers: authHeaders()
            });
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(`Eksport DOCX (${res.status}): ${errText.slice(0, 200)}`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oferta_rury_${offerId.substring(0, 8)}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        if (typeof closeModal === 'function') closeModal();
        showToast('Eksport zakończony', 'success');
    } catch (err) {
        logger.error('offerPrintManager', 'exportOfferDirectRury_action error:', err);
        showToast('Błąd eksportu oferty: ' + err.message, 'error');
    }
}

window.exportOfferDirectRury_action = exportOfferDirectRury_action;

async function exportKartaDirectRury_action(orderId, format) {
    if (!orderId) {
        showToast('Brak ID zamówienia do eksportu', 'error');
        return;
    }

    try {
        const endpoint = format === 'pdf' ? 'export-karta-pdf' : 'export-karta-docx';
        const res = await fetch(`/api/orders-rury/${orderId}/${endpoint}`, {
            headers: authHeaders()
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => 'Unknown error');
            throw new Error(errText);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `karta_budowy_rury_${orderId.substring(0, 8)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof closeModal === 'function') closeModal();
        showToast('Pobrano Kartę Budowy', 'success');
    } catch (err) {
        logger.error('offerPrintManager', 'exportKartaDirectRury_action error:', err);
        showToast('Błąd eksportu Karty Budowy: ' + err.message, 'error');
    }
}

window.exportKartaDirectRury_action = exportKartaDirectRury_action;

/**
 * Akcja eksportu Zamowienia rur (PDF/DOCX) — wariant Oferty.
 * Wywolywane z uniwersalnego modala (printModal.js) dla sekcji ZAMOWIENIA.
 * GET /api/orders-rury/:id/export-pdf|docx
 */
async function exportOrderDirectRury_action(orderId, format) {
    if (!orderId) {
        showToast('Brak ID zamówienia do eksportu', 'error');
        return;
    }
    if (format !== 'pdf' && format !== 'docx') {
        showToast('Nieobsługiwany format eksportu', 'error');
        return;
    }

    try {
        showToast(`Generowanie Zamówienia (${format.toUpperCase()})...`, 'info');
        const endpoint = format === 'pdf' ? 'export-pdf' : 'export-docx';
        const res = await fetch(`/api/orders-rury/${orderId}/${endpoint}`, {
            headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Eksport ${format.toUpperCase()} (${res.status}): ${errText.slice(0, 200)}`);
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zamowienie_rury_${orderId.substring(0, 8)}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToast(`Pobrano Zamówienie w ${format.toUpperCase()}`, 'success');
    } catch (err) {
        logger.error('offerPrintManager', 'exportOrderDirectRury_action error:', err);
        showToast('Błąd eksportu Zamówienia: ' + err.message, 'error');
    }
}

window.exportOrderDirectRury_action = exportOrderDirectRury_action;

async function exportRuryOrderAsOffer_action(orderId, format) {
    if (!orderId) {
        showToast('Brak ID zamówienia do eksportu', 'error');
        return;
    }
    if (format !== 'pdf' && format !== 'docx') {
        showToast('Nieobsługiwany format eksportu', 'error');
        return;
    }

    const items = (typeof getActiveItemsArray === 'function' ? getActiveItemsArray() : null) || [];
    if (!items.length) {
        showToast('Brak pozycji w bieżącym zamówieniu', 'warning');
        return;
    }

    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const transportKm = Number(document.getElementById('transport-km')?.value || 0);
    const transportRate = Number(document.getElementById('transport-rate')?.value || 0);

    const currentOrder = (typeof getCurrentRuryOrder === 'function') ? getCurrentRuryOrder() : null;
    const orderNumber = currentOrder?.orderNumber || orderId;
    const offerNumber = currentOrder?.offerNumber || getVal('offer-number') || '';

    const payload = {
        items,
        clientName: getVal('client-name'),
        clientNip: getVal('client-nip'),
        clientAddress: getVal('client-address'),
        clientContact: getVal('client-contact'),
        investName: getVal('invest-name'),
        investAddress: getVal('invest-address'),
        investContractor: getVal('invest-contractor'),
        notes: getVal('offer-notes'),
        paymentTerms: getVal('offer-payment-terms'),
        validity: getVal('offer-validity'),
        date: document.getElementById('offer-date')?.value || new Date().toISOString(),
        transportKm,
        transportRate,
        transportMode: currentRuryTransportMode || 'full',
        orderNumber,
        offerNumber
    };

    try {
        const endpoint = format === 'pdf' ? 'export-offer-pdf' : 'export-offer-docx';
        const res = await fetch(`/api/orders-rury/${orderId}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: 'Unknown error' }));
            const details = Array.isArray(errBody.details) ? ` (${errBody.details.join('; ')})` : '';
            throw new Error(`${errBody.error || 'Błąd serwera'}${details}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeNumber = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `oferta_rury_zamowienie_${safeNumber}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof closeModal === 'function') closeModal();
        showToast('Eksport oferty z bieżącego stanu zakończony', 'success');
    } catch (err) {
        logger.error('offerPrintManager', 'exportRuryOrderAsOffer_action error:', err);
        showToast('Błąd eksportu oferty z zamówienia: ' + (err instanceof Error ? err.message : err), 'error');
    }
}

window.exportRuryOrderAsOffer_action = exportRuryOrderAsOffer_action;
