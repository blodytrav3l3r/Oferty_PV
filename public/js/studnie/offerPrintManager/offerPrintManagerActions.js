// @ts-check
/* ===== OFFER PRINT MANAGER — Akcje eksportu ===== */

/**
 * Główna funkcja wywoływana przy kliknięciu "Wydruk"
 * Pokazuje uniwersalny modal dający wybór wydruku oferty oraz karty budowy
 */
window.handlePrintClick = function () {
    /** @type {(...args: any[]) => void} */ (window.showUniversalPrintModal)();
};

/**
 * Kompatybilność wsteczna - deleguje do uniwersalnego modala
 */
window.showOfferExportChoice = function () {
    /** @type {(...args: any[]) => void} */ (window.showUniversalPrintModal)();
};

/**
 * Uniwersalny modal dający wybór wydruku oferty oraz karty budowy
 *
 * @param {string|null} offerId       ID oferty
 * @param {string|null} orderId       ID zamówienia (opcjonalne)
 * @param {Array|null}   relatedOrders Powiązane zamówienia — przekazywane przez dispatcher
 *                                     (kartoteka PV ma `this.ordersMap`, edytor studni
 *                                     ma `ordersStudnie` / `getOrdersForOffer`).
 */
window.showUniversalPrintModal = /** @type {function(...[*]=): void} */ (
    function (offerId, orderId, relatedOrders) {
        let finalOfferId = offerId;
        let finalOrderId = orderId;

        if (!finalOfferId && !finalOrderId) {
            // Kliknięcie w aktywnym edytorze
            if (
                typeof orderEditMode !== 'undefined' &&
                orderEditMode &&
                /** @type {any} */ (orderEditMode).orderId
            ) {
                finalOrderId = /** @type {any} */ (orderEditMode).orderId;
                finalOfferId =
                    /** @type {any} */ (
                        orderEditMode.order && /** @type {any} */ (orderEditMode).order.offerId
                    ) ||
                    /** @type {any} */ (orderEditMode).offerId ||
                    (typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : '');
            } else if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie) {
                finalOfferId = editingOfferIdStudnie;
                if (typeof getOrdersForOffer === 'function') {
                    const orders = getOrdersForOffer(finalOfferId);
                    if (orders && orders.length > 0) {
                        finalOrderId = orders[0].id;
                    }
                }
            }
        }

        if (!finalOfferId && !finalOrderId) {
            if (typeof showToast === 'function')
                showToast('Brak aktywnego dokumentu do wydruku', 'error');
            return;
        }

        // Powiązane zamówienia — priorytet: parametr relatedOrders (z dispatchera),
        // potem getOrdersForOffer / ordersStudnie (kontekst edytora studni).
        let orders = [];
        if (Array.isArray(relatedOrders) && relatedOrders.length > 0) {
            orders = relatedOrders;
        } else {
            if (finalOfferId && typeof getOrdersForOffer === 'function') {
                orders = getOrdersForOffer(finalOfferId);
            }
            if (finalOrderId && orders.length === 0) {
                if (typeof ordersStudnie !== 'undefined') {
                    const currentOrder = ordersStudnie.find((o) => o.id === finalOrderId);
                    if (currentOrder) orders = [currentOrder];
                }
            }
        }

        // Buduj config dla uniwersalnego modala (printModal.js)
        const config = {
            modalTitle: 'Wydruk Dokumentów',
            offerSection: finalOfferId
                ? {
                      id: finalOfferId,
                      actionPdf: 'exportOfferDirect_action',
                      actionDocx: 'exportOfferDirect_action',
                      title: 'Wydruk Oferty',
                      description: 'Wybierz format eksportu kalkulacji ofertowej:'
                  }
                : null,
            ordersSection:
                orders.length > 0
                    ? {
                          orders: orders,
                          actionPdf: 'exportOrderDirect_action',
                          actionDocx: 'exportOrderDirect_action',
                          title: 'Wydruk Zamówienia',
                          description: 'Wybierz zamówienie i format eksportu:'
                      }
                    : null,
            kartaSection:
                orders.length > 0
                    ? {
                          orders: orders,
                          actionPdf: 'exportKartaDirect_action',
                          actionDocx: 'exportKartaDirect_action',
                          title: 'Wydruk Karty Budowy',
                          description: 'Wybierz zamówienie i format Karty Budowy:'
                      }
                    : null
        };

        // Deleguj do wspólnego modala
        if (typeof window.__upmHelperShow === 'function') {
            window.__upmHelperShow(config);
        } else if (typeof showToast === 'function') {
            showToast('Helper printModal.js nie załadowany', 'error');
        }
    }
);

/**
 * Akcja pobierania oferty dla konkretnego ID
 */
window.exportOfferDirect_action = async function (offerId, format) {
    // Jeśli to jest aktualnie edytowana oferta w edytorze, możemy ją najpierw zapisać
    // W trybie edycji zamówienia (orderEditMode) oferta jest już zapisana — pomijamy zapis
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

/**
 * Akcja eksportu Zamowienia studni (PDF/DOCX) — wariant Oferty.
 * Wywolywane z uniwersalnego modala (printModal.js) dla sekcji ZAMOWIENIA.
 * GET /api/orders-studnie/:id/export-pdf|docx
 */
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

/**
 * Akcja pobierania karty budowy dla konkretnego ID
 */
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

/**
 * Akcja eksportu bieżącego stanu zamówienia studni jako oferty (PDF/DOCX).
 * Mirror implementacji rury: czyta pozycje z globalnej `wells`,
 * czyta pola formularza klienta/inwestora/transportu, POST do endpointu
 * /api/orders-studnie/:id/export-offer-pdf|docx i pobiera plik.
 */
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

// ===== GLOBAL EXPORTS =====
window.printOfferStudnie = printOfferStudnie;
