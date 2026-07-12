// @ts-check
/* ===== pvSalesOrders.js — order methods mixin for PVSalesUI ===== */

export const pvSalesOrdersMixin = {
    formatOrderLabel(order) {
        return this.escapeHtml(
            order?.orderNumber ||
                order?.offerNumber ||
                (order?.id ? String(order.id).substring(0, 8) : 'Zamówienie')
        );
    },

    getOrderChangeInfo(order) {
        const currentPrice = Number(order?.totalNetto || order?.totalTotalNetto || 0);
        const originalPrice = Number(
            order?.originalTotalTotalNetto || order?.originalTotalNetto || currentPrice
        );
        const changed = Math.abs(currentPrice - originalPrice) > 0.01;
        return { changed, currentPrice, originalPrice };
    },

    recalculateRuryTransportCost(items, transportKm, transportRate) {
        const costPerTrip = (Number(transportKm) || 0) * (Number(transportRate) || 0);
        if (costPerTrip <= 0) return 0;
        const calcItems = (items || [])
            .filter((i) => !i.autoAdded && Number(i.weight) > 0 && Number(i.quantity) > 0)
            .map((i) => ({
                weight: Number(i.weight),
                transport: Number(i.transport),
                quantity: Number(i.quantity)
            }));
        if (calcItems.length === 0) return 0;
        const result = calculateTransportTrips(calcItems);
        return result.totalTrips * costPerTrip;
    },

    computeOrderValueWithTransport(order, offerType) {
        if (!order) return 0;
        const isStudnie = offerType === 'studnia_oferta' || order.wells || order.wellsExport;
        if (isStudnie) {
            const exportData = order.wellsExport || (order.data && order.data.wellsExport);
            if (Array.isArray(exportData) && exportData.length > 0) {
                return exportData.reduce((sum, w) => sum + (Number(w.totalPrice) || 0), 0);
            }
            return Number(order.totalNetto || order.totalBrutto || 0);
        }
        const items = order.items || [];
        if (items.length === 0) return Number(order.totalNetto || order.totalBrutto || 0);
        const productsTotal = items.reduce((sum, item) => {
            const unitBase =
                (Number(item.unitPrice) || 0) * (1 - (Number(item.discount) || 0) / 100);
            const surcharge = Number(item.surcharge) || 0;
            const pehdCost = Number(item.pehdCostPerUnit) || 0;
            return sum + (unitBase + surcharge + pehdCost) * (Number(item.quantity) || 0);
        }, 0);
        const transportCost = this.recalculateRuryTransportCost(
            items,
            order.transportKm,
            order.transportRate
        );
        return productsTotal + transportCost;
    },

    findOrderById(orderId) {
        const needle = this.normalizeId(orderId);
        for (const [offerId, orders] of this.ordersMap.entries()) {
            const order = (orders || []).find((item) => this.normalizeId(item.id) === needle);
            if (order) return { offerId, order };
        }
        return { offerId: '', order: null };
    },

    async loadOrdersMap() {
        try {
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const timestamp = Date.now();
            this.ordersMap.clear();
            let totalOrders = 0;

            const studnieResp = await fetch(`/api/orders-studnie?t=${timestamp}`, { headers });
            if (studnieResp.ok) {
                const json = await studnieResp.json();
                (json.data || []).forEach((order) => {
                    const offId = order.offerId || order.offerStudnieId || order.offer_id;
                    if (!offId) return;
                    const key = this.normalizeId(offId);
                    const list = this.ordersMap.get(key) || [];
                    list.push(order);
                    this.ordersMap.set(key, list);
                    totalOrders++;
                });
            }

            const ruryResp = await fetch(`/api/orders-rury?t=${timestamp}`, { headers });
            if (ruryResp.ok) {
                const json = await ruryResp.json();
                (json.data || []).forEach((order) => {
                    const offId = order.offerId;
                    if (!offId) return;
                    const key = this.normalizeId(offId);
                    const list = this.ordersMap.get(key) || [];
                    list.push(order);
                    this.ordersMap.set(key, list);
                    totalOrders++;
                });
            }

            logger.info(
                'pvSalesUi',
                `[PVSalesUI] Załadowano ${totalOrders} zamówień (studnie+rury) powiązanych z ${this.ordersMap.size} ofertami.`
            );
        } catch (error) {
            logger.warn('pvSalesUi', 'Nie udało się pobrać zamówień:', error.message);
        }
    },

    getOrderForOffer(offer) {
        const offerId = this.normalizeId(offer.id);
        const orders =
            offerId && this.ordersMap.has(offerId) ? [...this.ordersMap.get(offerId)] : [];

        if (orders.length > 0) return { hasOrder: true, orders, order: orders[0] };

        if (offer.hasOrder && offer.orderId) {
            const fallbackOrder = { id: offer.orderId, orderNumber: offer.orderNumber || '' };
            return { hasOrder: true, orders: [fallbackOrder], order: fallbackOrder };
        }

        return { hasOrder: false, orders: [], order: null };
    },

    showOfferOrdersPopup(offerId) {
        const offerKey = this.normalizeId(offerId);
        const offer = this.allLocalOffers.find((o) => this.normalizeId(o.id) === offerKey);
        const orders =
            offerKey && this.ordersMap.has(offerKey) ? [...this.ordersMap.get(offerKey)] : [];

        if (!orders || orders.length === 0) {
            showToast('Brak zamówień powiązanych z tą ofertą.', 'info');
            return;
        }

        const offerLabel =
            offer && (offer.number || offer.title || offer.offerName)
                ? offer.number || offer.title || offer.offerName
                : 'Oferta';

        let html = `
            <div class="modal-header">
                <h3 id="offer-orders-title">Zamówienia oferty ${offerLabel}</h3>
                <button class="btn-icon btn-close-x" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div style="margin-bottom:1rem; color:var(--text-muted); font-size:0.9rem;">Lista wszystkich zamówień przypisanych do tej oferty.</div>
            <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:55vh; overflow-y:auto; padding-right:0.25rem;">
        `;

        orders.forEach((ord) => {
            const createdAt = ord.createdAt
                ? new Date(ord.createdAt).toLocaleDateString('pl-PL')
                : 'brak daty';
            const orderLabel = this.formatOrderLabel(ord);

            html += `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.85rem 0.8rem; border:1px solid rgba(148,163,184,0.15); border-radius:10px; background:rgba(15,23,42,0.855); box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <div style="min-width:0;">
                        <div class="btn-open-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer?.type || 'studnia_oferta')}" style="font-weight:700; color:#38bdf8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; cursor:pointer; transition:all 0.2s ease;" title="Kliknij, aby otworzyć zamówienie w trybie edycji">${orderLabel}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem;">Utworzono: ${createdAt}</div>
                    </div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
                        <button class="btn btn-sm btn-primary btn-open-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer?.type || 'studnia_oferta')}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Otwórz</button>
                        <button class="btn btn-sm btn-secondary btn-print-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-id="${this.escapeHtml(offerKey)}" data-offer-type="${this.escapeHtml(offer?.type || (/^offer_rury_/.test(offerKey) ? 'rura_oferta' : 'studnia_oferta'))}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Karta</button>
                        <button class="btn btn-sm btn-secondary btn-modal-history-order" data-order-id="${this.escapeHtml(ord.id)}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Historia</button>
                        <button class="btn btn-sm btn-danger btn-modal-delete-order" data-order-id="${this.escapeHtml(ord.id)}" data-offer-type="${this.escapeHtml(offer?.type || 'studnia_oferta')}" style="padding:0.35rem 0.7rem; font-size:0.75rem;">Usuń</button>
                    </div>
                </div>`;
        });

        html += `
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary btn-close-footer" data-action="closeModal">Zamknij</button>
            </div>`;

        const overlay = showModal({
            id: 'offer-orders-modal',
            titleId: 'offer-orders-title',
            html: `<div class="modal">${html}</div>`
        });

        try {
            if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
        } catch (err) {
            logger.error('pvSalesUi', 'Lucide icons error in showOfferOrdersPopup:', err);
        }

        overlay.querySelectorAll('.btn-open-order').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const buttonEl = e.target.closest('.btn-open-order');
                const orderId = buttonEl.getAttribute('data-order-id');
                const offerType = buttonEl.getAttribute('data-offer-type');
                closeModal();
                if (window.parent && window.parent.SpaRouter) {
                    window.parent.SpaRouter.openOfferInModule(offerType, orderId, 'order');
                } else if (window.SpaRouter) {
                    window.SpaRouter.openOfferInModule(offerType, orderId, 'order');
                } else {
                    window.location.href = `app.html#/${offerType === 'studnia_oferta' ? 'studnie' : 'rury'}?order=${orderId}`;
                }
            });
        });

        overlay.querySelectorAll('.btn-print-order').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const buttonEl = e.target.closest('button');
                const orderId = buttonEl.getAttribute('data-order-id');
                const offerId = buttonEl.getAttribute('data-offer-id');
                const offerType = buttonEl.getAttribute('data-offer-type');
                const relatedOrders =
                    this.ordersMap && offerId
                        ? [...(this.ordersMap.get(this.normalizeId(offerId)) || [])]
                        : null;
                window.openPrintModal(offerId, orderId, offerType, relatedOrders);
            });
        });

        overlay.querySelectorAll('.btn-modal-history-order').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const buttonEl = e.target.closest('button');
                const orderId = buttonEl.getAttribute('data-order-id');
                closeModal();
                this.showOfferHistoryUnified(String(orderId), 'order');
            });
        });

        overlay.querySelectorAll('.btn-modal-delete-order').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const buttonEl = e.target.closest('button');
                const orderId = buttonEl.getAttribute('data-order-id');
                const offerType = buttonEl.getAttribute('data-offer-type');
                closeModal();
                await this.deleteOrderUnified(orderId, offerType);
            });
        });
    },

    async deleteOrderUnified(orderId, offerType) {
        const foundOrder = this.findOrderById(orderId);
        const offerIdForOrder = foundOrder.offerId || '';
        const visibleOrderCount = offerIdForOrder
            ? (this.ordersMap.get(offerIdForOrder) || []).length
            : 1;
        const willUnlockOffer = visibleOrderCount <= 1;

        if (
            !(await appConfirm(
                `Czy na pewno chcesz USUNĄĆ to zamówienie?\n\n${willUnlockOffer ? 'Po usunięciu ostatniego zamówienia oferta zostanie odblokowana do edycji.' : 'Oferta ma też inne zamówienia, więc pozostanie oznaczona jako zamówiona.'}`,
                { title: 'Usuwanie zamówienia', type: 'danger', okText: 'Usuń' }
            ))
        )
            return;

        try {
            const endpoint =
                offerType === 'studnia_oferta'
                    ? `/api/orders-studnie/${encodeURIComponent(orderId)}`
                    : `/api/orders-rury/${encodeURIComponent(orderId)}`;
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };

            const response = await fetch(endpoint, { method: 'DELETE', headers });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Nie udało się usunąć zamówienia z serwera');
            }

            await this.loadOrdersMap();
            const remainingOrders = offerIdForOrder
                ? this.ordersMap.get(offerIdForOrder) || []
                : [];
            const shouldUnlockOffer = offerIdForOrder && remainingOrders.length === 0;

            if (shouldUnlockOffer) {
                const offers = await storageService.getOffers([offerType]);
                const offerWrapper = offers.find(
                    (o) => this.normalizeId(o.id) === this.normalizeId(offerIdForOrder)
                );
                const rawOffer = offerWrapper?.data || offerWrapper;

                if (rawOffer) {
                    logger.info('pvSalesUi', 'Odblokowywanie oferty:', offerWrapper.id);
                    rawOffer.id = offerWrapper.id;
                    rawOffer.type = offerWrapper.type || offerType;
                    rawOffer.state =
                        offerWrapper.status === 'active' ? 'final' : rawOffer.state || 'draft';
                    rawOffer.hasOrder = false;
                    delete rawOffer.orderId;
                    delete rawOffer.orderNumber;
                    await storageService.saveOffer(rawOffer);
                }
            }

            if (typeof window.showToast === 'function') {
                window.showToast(
                    shouldUnlockOffer
                        ? 'Zamówienie zostało usunięte. Oferta jest ponownie edytowalna.'
                        : 'Zamówienie zostało usunięte.',
                    'info'
                );
            }

            await this.loadLocalOffers();
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd podczas usuwania zamówienia:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Błąd podczas usuwania zamówienia: ' + error.message, 'error');
            }
        }
    }
};
