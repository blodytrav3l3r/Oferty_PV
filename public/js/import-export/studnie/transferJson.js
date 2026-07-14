window.StudnieTransferJson = {
    async exportOffer(offerId) {
        const offer = await JsonOfferTransfer.fetchOffer('studnie', offerId);
        const orders = await JsonOfferTransfer.fetchOrders('studnie', offerId);
        const payload = JsonOfferTransfer.buildPayload('studnie', offer, orders);
        const safeNumber = (offer.offer_number || offer.number || offerId).replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
        );
        const date = (offer.createdAt || '').slice(0, 10) || 'unknown';
        JsonOfferTransfer.downloadFile(payload, 'studnie_' + safeNumber + '_' + date + '.json');

        await fetch('/api/feature-flags/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                entityType: 'studnia_oferta',
                entityId: offerId,
                action: 'export.transfer',
                details: { module: 'studnie', offerNumber: safeNumber, ordersCount: orders.length }
            })
        });
    },

    async findOfferByNumber(number) {
        const offers = window.pvSalesUI && window.pvSalesUI.allLocalOffers;
        if (!offers) return null;
        return offers.find((o) => o.offer_number === number || o.number === number) || null;
    },

    async importOffer(file) {
        const json = await JsonOfferTransfer.readFile(file);

        const existing = await this.findOfferByNumber(json.offer.offer_number || json.offer.number);
        let targetId = json.offer.id;
        let action = 'create';

        if (existing) {
            const choice = await ConflictModal.show(json.offer.offer_number || json.offer.number);
            if (choice === 'skip') return { skipped: true };
            if (choice === 'overwrite') {
                action = 'overwrite';
                targetId = existing.id;
            }
            if (choice === 'clone') {
                action = 'clone';
                targetId = undefined;
                json.offer.offer_number = (json.offer.offer_number || '') + '-2';
                json.offer.number = (json.offer.number || '') + '-2';
            }
        }

        const importPayload = {
            id: targetId,
            number: json.offer.offer_number || json.offer.number || json.offer.number,
            status: json.offer.status || 'draft',
            transportCost: json.offer.transportCost || 0
        };

        if (json.offer.data && typeof json.offer.data === 'object') {
            Object.assign(importPayload, json.offer.data);
        }

        importPayload.wells = json.offer.wells || json.offer.data?.wells || [];

        try {
            const resp = await fetch('/api/offers-rury/studnie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ data: [importPayload] })
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Blad importu oferty studni');
            }
            const result = await resp.json();
            const newOfferId = result.results?.[0]?.id;

            for (const order of json.orders || []) {
                const orderPayload = {
                    id: order.id,
                    offerStudnieId: newOfferId,
                    status: order.status || 'new',
                    createdAt: order.createdAt,
                    ...(order.data || {})
                };
                delete orderPayload.type;

                await fetch('/api/orders-studnie', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ data: [orderPayload] })
                });
            }

            await fetch('/api/feature-flags/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    entityType: 'studnia_oferta',
                    entityId: newOfferId || '',
                    action: 'import.transfer',
                    details: {
                        module: 'studnie',
                        originalNumber: json.offer.offer_number,
                        ordersCount: (json.orders || []).length,
                        source: 'transfer'
                    }
                })
            });

            return { success: true, action, offerId: newOfferId };
        } catch (err) {
            return { error: true, message: err.message };
        }
    }
};
