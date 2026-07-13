// @ts-check
/* ===== OFFER PRINT MANAGER — Akcje eksportu ===== */

window.exportOfferDirect_action = async function (offerId, format) {
    if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie === offerId) {
        const isInOrderEditMode = typeof orderEditMode !== 'undefined' && orderEditMode;
        if (!isInOrderEditMode) {
            if (typeof showToast === 'function') {
                showToast('Zapisywanie oferty przed eksportem...', 'info');
            }
            const savedOk = await saveOfferStudnie();
            if (!savedOk) {
                if (typeof showToast === 'function') {
                    showToast('Eksport przerwany - nie udało się zapisać oferty.', 'error');
                }
                return;
            }
        }
    }

    if (typeof showToast === 'function') {
        showToast(`Generowanie oferty (${format.toUpperCase()})...`, 'info');
    }

    const endpoint = format === 'pdf' ? 'export-pdf' : 'export-docx';
    fetch(`/api/offers-studnie/${offerId}/${endpoint}`, {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(async (res) => {
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(
                    `Eksport ${format.toUpperCase()} (${res.status}): ${errText.slice(0, 200)}`
                );
            }
            return res.blob();
        })
        .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oferta_studnie_${offerId}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            if (typeof showToast === 'function') {
                showToast(`Pobrano ofertę w ${format.toUpperCase()}`, 'success');
            }
        })
        .catch((err) => {
            logger.error('offerPrintManager', '[Export Error]', err);
            if (typeof showToast === 'function') {
                showToast('Błąd eksportu: ' + err.message, 'error');
            }
        });
};

window.exportOrderDirect_action = async function (orderId, format) {
    if (!orderId) {
        if (typeof showToast === 'function') {
            showToast('Brak ID zamówienia do eksportu', 'error');
        }
        return;
    }
    if (format !== 'pdf' && format !== 'docx') {
        if (typeof showToast === 'function') {
            showToast('Nieobsługiwany format eksportu', 'error');
        }
        return;
    }

    if (typeof showToast === 'function') {
        showToast(`Generowanie Zamówienia (${format.toUpperCase()})...`, 'info');
    }

    const endpoint = format === 'pdf' ? 'export-pdf' : 'export-docx';
    fetch(`/api/orders-studnie/${orderId}/${endpoint}`, {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(async (res) => {
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(
                    `Eksport ${format.toUpperCase()} (${res.status}): ${errText.slice(0, 200)}`
                );
            }
            return res.blob();
        })
        .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zamowienie_studnie_${orderId.substring(0, 8)}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            if (typeof showToast === 'function') {
                showToast(`Pobrano Zamówienie w ${format.toUpperCase()}`, 'success');
            }
        })
        .catch((err) => {
            logger.error('offerPrintManager', '[Export Error]', err);
            if (typeof showToast === 'function') {
                showToast('Błąd eksportu: ' + err.message, 'error');
            }
        });
};

window.exportKartaDirect_action = async function (orderId, format) {
    if (typeof showToast === 'function') {
        showToast(`Generowanie Karty Budowy (${format.toUpperCase()})...`, 'info');
    }

    const endpoint = format === 'pdf' ? 'export-karta-pdf' : 'export-karta-docx';
    fetch(`/api/orders-studnie/${orderId}/${endpoint}`, {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(async (res) => {
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(
                    `Eksport ${format.toUpperCase()} (${res.status}): ${errText.slice(0, 200)}`
                );
            }
            return res.blob();
        })
        .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `karta_budowy_${orderId.substring(0, 8)}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            if (typeof showToast === 'function') {
                showToast(`Pobrano Kartę Budowy w ${format.toUpperCase()}`, 'success');
            }
        })
        .catch((err) => {
            logger.error('offerPrintManager', '[Export Error]', err);
            if (typeof showToast === 'function') {
                showToast('Błąd eksportu: ' + err.message, 'error');
            }
        });
};

async function exportStudnieOrderAsOffer_action(orderId, format) {
    if (!orderId) {
        if (typeof showToast === 'function') {
            showToast('Brak ID zamówienia do eksportu', 'error');
        }
        return;
    }
    if (format !== 'pdf' && format !== 'docx') {
        if (typeof showToast === 'function') {
            showToast('Nieobsługiwany format eksportu', 'error');
        }
        return;
    }

    const items = typeof wells !== 'undefined' && Array.isArray(wells) ? wells : [];
    if (!items.length) {
        if (typeof showToast === 'function') {
            showToast('Brak pozycji w bieżącym zamówieniu', 'warning');
        }
        return;
    }

    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const transportKm = Number(document.getElementById('transport-km')?.value || 0);
    const transportRate = Number(document.getElementById('transport-rate')?.value || 0);

    const currentOrder = typeof getCurrentOfferOrder === 'function' ? getCurrentOfferOrder() : null;
    const orderNumber = currentOrder?.orderNumber || orderId;
    const offerNumber = currentOrder?.offerNumber || getVal('offer-number') || '';

    const exportItems = items.map((well) => {
        const stats =
            typeof calcWellStats === 'function'
                ? calcWellStats(well)
                : { price: 0, weight: 0, height: 0 };
        const zwienczenieName =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            productId: (well.config && well.config[0] && well.config[0].productId) || '',
            productName: well.name || `Studnia DN${well.dn}`,
            quantity: 1,
            discount: 0,
            price: Number(stats.price) || 0,
            DN: String(well.dn ?? ''),
            height: Number(stats.height) || 0,
            zwienczenie: zwienczenieName,
            transportCost: 0,
            dodatkowe_info: well.dodatkowe_info || ''
        };
    });

    const payload = {
        items: exportItems,
        clientName: getVal('client-name'),
        clientNip: getVal('client-nip'),
        clientAddress: getVal('client-address'),
        clientContact: getVal('client-contact'),
        investName: getVal('invest-name'),
        investAddress: getVal('invest-address'),
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
        if (typeof showToast === 'function') {
            showToast(`Generowanie oferty z zamówienia (${format.toUpperCase()})...`, 'info');
        }
        const endpoint = format === 'pdf' ? 'export-offer-pdf' : 'export-offer-docx';
        const res = await fetch(`/api/orders-studnie/${orderId}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(typeof authHeaders === 'function' ? authHeaders() : {})
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({ error: 'Unknown error' }));
            const details = Array.isArray(errBody.details)
                ? ` (${errBody.details.join('; ')})`
                : '';
            throw new Error(`${errBody.error || 'Błąd serwera'}${details}`);
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeNumber = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `oferta_studnie_zamowienie_${safeNumber}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        if (typeof showToast === 'function') {
            showToast('Eksport oferty z bieżącego stanu zakończony', 'success');
        }
    } catch (err) {
        logger.error('offerPrintManager', 'exportStudnieOrderAsOffer_action error:', err);
        if (typeof showToast === 'function') {
            showToast(
                'Błąd eksportu oferty z zamówienia: ' + (err instanceof Error ? err.message : err),
                'error'
            );
        }
    }
}

window.exportStudnieOrderAsOffer_action = exportStudnieOrderAsOffer_action;

window.exportOfferToPDF_action = async function () {
    document.getElementById('offer-export-modal').remove();

    if (typeof showToast === 'function') {
        showToast('Zapisywanie oferty przed eksportem...', 'info');
    }

    const savedOk = await saveOfferStudnie();
    if (!savedOk && !editingOfferIdStudnie) {
        if (typeof showToast === 'function') {
            showToast('Eksport przerwany - nie udało się zapisać oferty.', 'error');
        }
        return;
    }

    if (typeof showToast === 'function') {
        showToast('Generowanie pliku PDF...', 'info');
    }

    fetch(`/api/offers-studnie/${editingOfferIdStudnie}/export-pdf`, {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(async (res) => {
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(`Eksport PDF (${res.status}): ${errText.slice(0, 200)}`);
            }
            return res.blob();
        })
        .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oferta_studnie_${editingOfferIdStudnie}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            if (typeof showToast === 'function') {
                showToast('Wyeksportowano ofertę do PDF', 'success');
            }
        })
        .catch((err) => {
            logger.error('offerPrintManager', '[Export Error]', err);
            if (typeof showToast === 'function') {
                showToast('Błąd eksportu: ' + err.message, 'error');
            }
        });
};

window.exportOfferToWord_action = async function () {
    document.getElementById('offer-export-modal').remove();

    if (typeof showToast === 'function') {
        showToast('Zapisywanie oferty przed eksportem...', 'info');
    }

    const savedOk = await saveOfferStudnie();
    if (!savedOk && !editingOfferIdStudnie) {
        if (typeof showToast === 'function') {
            showToast('Eksport przerwany - nie udało się zapisać oferty.', 'error');
        }
        return;
    }

    if (typeof showToast === 'function') {
        showToast('Generowanie pliku DOCX...', 'info');
    }

    fetch(`/api/offers-studnie/${editingOfferIdStudnie}/export-docx`, {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(async (res) => {
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(`Eksport DOCX (${res.status}): ${errText.slice(0, 200)}`);
            }
            return res.blob();
        })
        .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oferta_studnie_${editingOfferIdStudnie}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            if (typeof showToast === 'function') {
                showToast('Wyeksportowano ofertę do DOCX', 'success');
            }
        })
        .catch((err) => {
            logger.error('offerPrintManager', '[Export Error]', err);
            if (typeof showToast === 'function') {
                showToast('Błąd eksportu: ' + err.message, 'error');
            }
        });
};

window.printOfferStudnie = printOfferStudnie;
