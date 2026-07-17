window.RuryTransferJson = {
    async exportOffer(offerId) {
        const offer = await JsonOfferTransfer.fetchOffer('rury', offerId);
        const orders = await JsonOfferTransfer.fetchOrders('rury', offerId);
        const payload = JsonOfferTransfer.buildPayload('rury', offer, orders);
        const safeNumber = (offer.offer_number || offer.number || offerId).replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
        );
        const date = (offer.createdAt || '').slice(0, 10) || 'unknown';
        JsonOfferTransfer.downloadFile(payload, 'rury_' + safeNumber + '_' + date + '.json');

        await fetch('/api/feature-flags/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                entityType: 'offer',
                entityId: offerId,
                action: 'export.transfer',
                details: { module: 'rury', offerNumber: safeNumber, ordersCount: orders.length }
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
            offer_number: json.offer.offer_number || json.offer.number,
            number: json.offer.number,
            status: json.offer.status || 'draft',
            transportCost: json.offer.transportCost || 0,
            items: (json.offer.items || []).map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                discount: i.discount,
                unitPrice: i.unitPrice || i.price || 0
            }))
        };

        const spreadFields = [
            'clientName',
            'clientNip',
            'clientAddress',
            'clientContact',
            'investName',
            'investAddress',
            'investContractor',
            'notes',
            'paymentTerms',
            'validity',
            'date'
        ];
        const jsonOffer = json.offer;
        for (const key of spreadFields) {
            if (jsonOffer[key] !== undefined) {
                importPayload[key] = jsonOffer[key];
            }
        }

        try {
            const resp = await fetch('/api/offers-rury', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ data: [importPayload] })
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Blad importu oferty');
            }
            const result = await resp.json();
            const newOfferId = result.results?.[0]?.id;

            for (const order of json.orders || []) {
                const orderPayload = {
                    id: order.id,
                    offerId: newOfferId,
                    status: order.status || 'new',
                    createdAt: order.createdAt,
                    ...(order.data || {})
                };
                delete orderPayload.type;

                await fetch('/api/orders-rury', {
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
                    entityType: 'offer',
                    entityId: newOfferId || '',
                    action: 'import.transfer',
                    details: {
                        module: 'rury',
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
    },

    async exportOrder(orderId) {
        const order = await JsonOfferTransfer.fetchOrder('rury', orderId);
        const payload = JsonOfferTransfer.buildOrderPayload('rury', order);
        const safeNumber = (order.orderNumber || orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const date = (order.createdAt || '').slice(0, 10) || 'unknown';
        JsonOfferTransfer.downloadFile(
            payload,
            'zamowienie_rury_' + safeNumber + '_' + date + '.json'
        );

        await fetch('/api/feature-flags/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                entityType: 'order',
                entityId: orderId,
                action: 'export.transfer',
                details: { module: 'rury', orderNumber: safeNumber }
            })
        });
    },

    async importOrder(file) {
        const json = await JsonOfferTransfer.readFile(file);
        const order = json.order;

        const orderPayload = {
            id: order.id,
            offerId: order.offerId,
            status: order.status || 'new',
            createdAt: order.createdAt,
            ...Object.fromEntries(
                Object.entries(order).filter(
                    ([k]) => !['id', 'type', 'offerId', 'status', 'createdAt', 'userId'].includes(k)
                )
            )
        };

        try {
            const resp = await fetch('/api/orders-rury', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ data: [orderPayload] })
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Blad importu zamowienia');
            }

            await fetch('/api/feature-flags/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    entityType: 'order',
                    entityId: order.id,
                    action: 'import.transfer',
                    details: { module: 'rury', orderNumber: order.orderNumber, source: 'transfer' }
                })
            });

            return { success: true };
        } catch (err) {
            return { error: true, message: err.message };
        }
    }
};
