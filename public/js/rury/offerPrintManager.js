/* ============================
   WITROS — Wydruk Karty Budowy Rury
   offerPrintManager.js
   ============================ */

function handlePrintClick() {
    showUniversalPrintModalRury();
}

window.handlePrintClick = handlePrintClick;

function showUniversalPrintModalRury(offerId, orderId) {
    const targetOfferId = offerId || editingOfferId || null;
    const targetOrderId = orderId || editingRuryOrderId || null;
    const inOrderMode = !!(window.orderEditMode && targetOrderId);

    let html = `
    <div class="modal" style="max-width: 500px; width: 95%; border-radius: 12px;">
        <div class="modal-header">
            <h3><i data-lucide="printer"></i> Wydruk dokumentów</h3>
            <button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div style="padding: 1rem 0;">`;

    // Sekcja zamówienia / karty budowy
    if (targetOrderId) {
        html += `
            <div style="margin-bottom: 1rem;">
                <h4 style="font-size:0.85rem; font-weight:700; color:#a78bfa; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="file-text"></i> Karta Budowy
                </h4>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="exportKartaDirect_action('${targetOrderId}', 'pdf')" style="flex:1; min-width:120px;">
                        <i data-lucide="file-text"></i> PDF
                    </button>
                    <button class="btn btn-secondary" onclick="exportKartaDirect_action('${targetOrderId}', 'docx')" style="flex:1; min-width:120px;">
                        <i data-lucide="file-text"></i> Word (DOCX)
                    </button>
                </div>
            </div>`;
    } else {
        html += `
            <div style="margin-bottom: 1rem;">
                <h4 style="font-size:0.85rem; font-weight:700; color:#a78bfa; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="file-text"></i> Karta Budowy
                </h4>
                <p style="font-size:0.8rem; color:var(--text-muted);">Utwórz zamówienie, aby móc wydrukować Kartę Budowy.</p>
            </div>`;
    }

    // Sekcja oferty (jeśli dostępna) — w trybie zamówienia przekierowuje na bieżący stan edycji
    if (inOrderMode) {
        html += `
            <div style="margin-bottom: 0.5rem; padding-top: 0.8rem; border-top: 1px solid var(--border-glass);">
                <h4 style="font-size:0.85rem; font-weight:700; color:#34d399; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="package"></i> Oferta <span style="font-size:0.7rem; font-weight:600; color:#a5b4fc; background:rgba(165,180,252,0.12); padding:0.1rem 0.4rem; border-radius:4px;">stan bieżący zamówienia</span>
                </h4>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem;">Drukuje aktualne pozycje z edycji zamówienia (krok 5), nie bazową ofertę.</p>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="exportRuryOrderAsOffer_action('${targetOrderId}', 'pdf')" style="flex:1; min-width:120px;">
                        <i data-lucide="file-text"></i> PDF
                    </button>
                    <button class="btn btn-secondary" onclick="exportRuryOrderAsOffer_action('${targetOrderId}', 'docx')" style="flex:1; min-width:120px;">
                        <i data-lucide="file-text"></i> Word (DOCX)
                    </button>
                </div>
            </div>`;
    } else if (targetOfferId) {
        html += `
            <div style="margin-bottom: 0.5rem; padding-top: 0.8rem; border-top: 1px solid var(--border-glass);">
                <h4 style="font-size:0.85rem; font-weight:700; color:#34d399; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="file-text"></i> Oferta
                </h4>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="exportOfferDirect_action('${targetOfferId}', 'pdf')" style="flex:1; min-width:120px;">
                        <i data-lucide="file-text"></i> PDF
                    </button>
                    <button class="btn btn-secondary" onclick="exportOfferDirect_action('${targetOfferId}', 'docx')" style="flex:1; min-width:120px;">
                        <i data-lucide="file-text"></i> Word (DOCX)
                    </button>
                </div>
            </div>`;
    }

    html += `
        </div>
    </div>`;

    showModal({
        id: 'rury-print-modal',
        titleId: 'rury-print-title',
        html
    });
    if (window.lucide) lucide.createIcons();
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

async function exportOfferDirect_action(offerId, format) {
    if (!offerId) {
        showToast('Brak ID oferty do eksportu', 'error');
        return;
    }

    try {
        if (format === 'pdf') {
            const res = await fetch(`/api/offers-rury/${offerId}/export-pdf`, {
                headers: authHeaders()
            });
            if (!res.ok) throw new Error('Błąd eksportu PDF');
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
            if (!res.ok) throw new Error('Błąd eksportu DOCX');
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
        console.error('exportOfferDirect_action error:', err);
        showToast('Błąd eksportu oferty', 'error');
    }
}

window.exportOfferDirect_action = exportOfferDirect_action;

async function exportKartaDirect_action(orderId, format) {
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
        console.error('exportKartaDirect_action error:', err);
        showToast('Błąd eksportu Karty Budowy: ' + err.message, 'error');
    }
}

window.exportKartaDirect_action = exportKartaDirect_action;

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
            const errText = await res.text().catch(() => 'Unknown error');
            throw new Error(errText);
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
        console.error('exportRuryOrderAsOffer_action error:', err);
        showToast('Błąd eksportu oferty z zamówienia: ' + (err instanceof Error ? err.message : err), 'error');
    }
}

window.exportRuryOrderAsOffer_action = exportRuryOrderAsOffer_action;
