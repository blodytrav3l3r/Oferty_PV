window.JsonOfferTransfer = {
    SCHEMA_VERSION: 1,

    async fetchOffer(module, offerId) {
        const base = module === 'studnie' ? '/api/offers-rury/studnie' : '/api/offers-rury';
        const r = await fetch(base + '/' + offerId, { credentials: 'include' });
        if (!r.ok) throw new Error('Nie znaleziono oferty (ID: ' + offerId + ')');
        const j = await r.json();
        return j.data;
    },

    async fetchOrders(module, offerId) {
        const base = module === 'studnie' ? '/api/orders-studnie' : '/api/orders-rury';
        const r = await fetch(base + '?offerId=' + encodeURIComponent(offerId), {
            credentials: 'include'
        });
        if (!r.ok) return [];
        const j = await r.json();
        return j.data || [];
    },

    buildPayload(module, offer, orders) {
        return {
            kind: 'witros-offer-transfer',
            schemaVersion: this.SCHEMA_VERSION,
            module: module,
            exportedAt: new Date().toISOString(),
            exportedBy:
                (window.appState &&
                    window.appState.currentUser &&
                    window.appState.currentUser.id) ||
                null,
            offer: offer,
            orders: orders
        };
    },

    validatePayload(json) {
        if (!json || typeof json !== 'object') throw new Error('Nieprawidlowy format pliku');
        if (json.kind !== 'witros-offer-transfer')
            throw new Error('Plik nie jest plikiem transferu ofert (brak naglowka kind)');
        if (typeof json.schemaVersion !== 'number' || json.schemaVersion > this.SCHEMA_VERSION) {
            throw new Error('Nieobslugiwana wersja schematu (' + json.schemaVersion + ')');
        }
        if (!json.module || !json.offer) {
            throw new Error('Plik nie zawiera wymaganych pol: module, offer');
        }
        return true;
    },

    async _fetchOrdersFlat(module) {
        const base = module === 'studnie' ? '/api/orders-studnie' : '/api/orders-rury';
        const r = await fetch(base + '?t=' + Date.now(), { credentials: 'include' });
        if (!r.ok) throw new Error('Nie znaleziono zamówień');
        const j = await r.json();
        return j.data || [];
    },

    async fetchOrder(module, orderId) {
        const orders = await this._fetchOrdersFlat(module);
        const order = orders.find((o) => o.id === orderId);
        if (!order) throw new Error('Nie znaleziono zamówienia (ID: ' + orderId + ')');
        return order;
    },

    async fetchOrderByNumber(module, orderNumber) {
        const orders = await this._fetchOrdersFlat(module);
        return orders.find((o) => o.orderNumber === orderNumber) || null;
    },

    buildOrderPayload(module, order) {
        return {
            kind: 'witros-order-transfer',
            schemaVersion: this.SCHEMA_VERSION,
            module: module,
            exportedAt: new Date().toISOString(),
            exportedBy:
                (window.appState &&
                    window.appState.currentUser &&
                    window.appState.currentUser.id) ||
                null,
            order: order
        };
    },

    validateOrderPayload(json) {
        if (!json || typeof json !== 'object') throw new Error('Nieprawidlowy format pliku');
        if (json.kind !== 'witros-order-transfer')
            throw new Error('Plik nie jest plikiem transferu zamowienia (brak naglowka kind)');
        if (typeof json.schemaVersion !== 'number' || json.schemaVersion > this.SCHEMA_VERSION) {
            throw new Error('Nieobslugiwana wersja schematu (' + json.schemaVersion + ')');
        }
        if (!json.module || !json.order) {
            throw new Error('Plik nie zawiera wymaganych pol: module, order');
        }
        return true;
    },

    downloadFile(payload, fileName) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'oferta_transfer.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    },

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (json.kind === 'witros-order-transfer') {
                        this.validateOrderPayload(json);
                    } else {
                        this.validatePayload(json);
                    }
                    resolve(json);
                } catch (err) {
                    reject(new Error(err.message));
                }
            };
            reader.onerror = () => reject(new Error('Nie udalo sie odczytac pliku'));
            reader.readAsText(file);
        });
    }
};
