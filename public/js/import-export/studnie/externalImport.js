window.StudnieExternalImport = {
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

        const wellMap = {};
        for (const r of rows) {
            const wellName = r['NR_STUDNI'] || 'Studnia_1';
            if (!wellMap[wellName]) {
                wellMap[wellName] = {
                    dn: r['SREDNICA'] || '',
                    depth: parseInt(r['GLEBOKOSC']) || 0,
                    name: wellName,
                    magazyn: r['MAGAZYN'] === 'WL' ? 'Włocławek' : 'Kluczbork',
                    lp: parseInt(r['LP']) || Object.keys(wellMap).length + 1,
                    components: []
                };
            }
            const unitPrice = parseFloat(r['CENA_JEDNOSTKOWA']) || 0;
            const qty = parseInt(r['ILOSC']) || 0;
            const hasDiscount = r['RABAT'] !== '';
            const discount = hasDiscount ? parseFloat(r['RABAT']) / 100 || 0 : 0;
            const finalPrice = hasDiscount ? unitPrice * (1 - discount) : unitPrice;

            wellMap[wellName].components.push({
                indeks: r['INDEKS_CZESCI'] || '',
                ilosc: qty,
                rabat: hasDiscount ? discount : 0,
                cenaJednostkowa: hasDiscount ? unitPrice : finalPrice
            });
        }

        const wells = Object.values(wellMap).sort((a, b) => (a.lp || 0) - (b.lp || 0));

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
            number: number,
            status: 'draft',
            transportCost: 0,
            wells: wells,
            clientName: '',
            investName: ''
        };

        if (action === 'clone') {
            offerPayload.number = number + '-2';
        }

        try {
            const resp = await fetch('/api/offers-rury/studnie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ data: [offerPayload] })
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Blad zapisu oferty studni');
            }
            const result = await resp.json();

            await fetch('/api/feature-flags/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    entityType: 'studnia_oferta',
                    entityId: result.results?.[0]?.id || '',
                    action: 'import.external',
                    details: {
                        number,
                        wellsCount: wells.length,
                        rowsCount: rows.length,
                        source: 'xlsx'
                    }
                })
            });

            return { success: true, number, action };
        } catch (err) {
            return { error: true, number, message: err.message };
        }
    }
};
