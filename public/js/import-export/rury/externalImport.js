window.RuryExternalImport = {
    async findOfferByNumber(number) {
        if (window.pvSalesUI && window.pvSalesUI.allLocalOffers) {
            return (
                window.pvSalesUI.allLocalOffers.find(
                    (o) => o.offer_number === number || o.number === number
                ) || null
            );
        }
        return null;
    },

    async import(offerGroup) {
        const number = offerGroup.number;
        const rows = offerGroup.rows;

        const items = rows.map((r, i) => {
            const unitPrice = parseFloat(r['CENA_JEDNOSTKOWA']) || 0;
            const qty = parseInt(r['ILOSC']) || 0;
            const hasDiscount = r['RABAT'] !== '';
            const discount = hasDiscount ? parseFloat(r['RABAT']) / 100 || 0 : 0;
            const finalPrice = hasDiscount ? unitPrice * (1 - discount) : unitPrice;

            return {
                productId: r['INDEKS_CZESCI'] || '',
                quantity: qty,
                discount: hasDiscount ? discount : 0,
                unitPrice: hasDiscount ? unitPrice : finalPrice,
                price: hasDiscount ? unitPrice : finalPrice
            };
        });

        const existing = await this.findOfferByNumber(number);
        let action = 'create';
        if (existing) {
            const choice = await ConflictModal.show(number);
            if (choice === 'skip') return { skipped: true, number };
            if (choice === 'clone') {
                action = 'clone';
            }
            if (choice === 'overwrite') {
                action = 'overwrite';
            }
        }

        const offerPayload = {
            id: existing && action === 'overwrite' ? existing.id : undefined,
            offer_number: number,
            number: number,
            status: 'draft',
            items: items,
            transportCost: 0
        };

        if (action === 'clone') {
            offerPayload.offer_number = number + '-2';
            offerPayload.number = number + '-2';
        }

        try {
            const resp = await fetch('/api/offers-rury', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ data: [offerPayload] })
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Blad zapisu oferty');
            }
            const result = await resp.json();

            await fetch('/api/feature-flags/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    entityType: 'offer',
                    entityId: result.results?.[0]?.id || '',
                    action: 'import.external',
                    details: { number, itemsCount: items.length, source: 'xlsx' }
                })
            });

            return { success: true, number, action };
        } catch (err) {
            return { error: true, number, message: err.message };
        }
    }
};
