// @ts-check
/* ===== API OFERTY (STUDNIE) ===== */

function normalizeOfferData(doc) {
    if (!doc) return doc;
    if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) {
        const fields = [
            'items',
            'wells',
            'totalNetto',
            'totalBrutto',
            'number',
            'clientName',
            'clientNip',
            'clientAddress',
            'clientContact',
            'clientPhone',
            'investName',
            'investAddress',
            'investContractor',
            'notes',
            'paymentTerms',
            'validity',
            'transportKm',
            'transportRate',
            'wellDiscounts',
            'visiblePrzejsciaTypes',
            'date',
            'history',
            'wizard',
            'userName',
            'lastEditedBy',
            'createdByUserId',
            'createdByUserName',
            'userId'
        ];
        for (const key of fields) {
            const val = doc.data[key];
            if (
                val !== undefined &&
                val !== null &&
                (doc[key] === undefined || doc[key] === null)
            ) {
                doc[key] = val;
            }
        }
        if (!doc.number && doc.data.offerNumber) doc.number = doc.data.offerNumber;
        if (!doc.date && doc.data.offerDate) doc.date = doc.data.offerDate;
        if (!doc.totalNetto && doc.data.summary && doc.data.summary.totalValue)
            doc.totalNetto = doc.data.summary.totalValue;
        if (!doc.totalBrutto && doc.data.summary && doc.data.summary.totalBrutto)
            doc.totalBrutto = doc.data.summary.totalBrutto;
    }
    return doc;
}

async function loadOffersStudnie() {
    try {
        const res = await fetchWithTimeout('/api/offers-studnie', { headers: authHeaders() });
        const json = await res.json();
        const rawOffers = json.data || [];
        logger.info('offerManager', '[loadOffersStudnie] API response:', {
            count: rawOffers.length,
            ids: rawOffers.map((o) => o.id)
        });
        const normalized = rawOffers.map((o) => normalizeOfferData(o));
        logger.info('offerManager', '[loadOffersStudnie] Normalized:', {
            count: normalized.length,
            ids: normalized.map((o) => o.id)
        });
        return normalized;
    } catch (e) {
        logger.error('offerManager', 'Błąd ładowania ofert:', e);
        return [];
    }
}

async function saveOffersDataStudnie(data) {
    try {
        const res = await fetch('/api/offers-studnie', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ data })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
        logger.error('offerManager', 'Błąd zapisu ofert studni:', e);
        throw e;
    }
}
