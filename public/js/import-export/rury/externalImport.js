window.RuryExternalImport = {
    async findOfferByNumber(number) {
        return (
            XlsxImportShared.getLoadedOffers().find(
                (o) => o.offer_number === number || o.number === number
            ) || null
        );
    },

    // Czyste budowanie pozycji z wierszy (bez I/O — testowalne).
    // Bledne wiersze pomijane z wpisem bledu (D-FIX-2: zakaz cichego 0).
    // Rabat w skali 0-100 (jak wellComponentSchema, bez /100).
    _buildItems(rows) {
        const P = XlsxImportShared.parsePlNumber;
        const items = [];
        const errors = [];
        let transportSeparate = false;
        (rows || []).forEach((r, i) => {
            const rowNo = i + 2;
            if (XlsxImportShared.normalizeHeader(r['INDEKS_CZESCI']) === 'TR-RURY') {
                transportSeparate = true;
                return;
            }
            const qty = P(r['ILOSC']);
            if (qty === null || !Number.isInteger(qty) || qty <= 0) {
                errors.push({
                    sheet: 'Import',
                    row: rowNo,
                    col: 'ILOSC',
                    value: String(r['ILOSC'] ?? ''),
                    reason: 'ilosc-calkowita-dodatnia'
                });
                return;
            }
            const price = P(r['CENA_JEDNOSTKOWA']);
            if (price === null || price < 0) {
                errors.push({
                    sheet: 'Import',
                    row: rowNo,
                    col: 'CENA_JEDNOSTKOWA',
                    value: String(r['CENA_JEDNOSTKOWA'] ?? ''),
                    reason: 'cena-nieujemna'
                });
                return;
            }
            let discount = 0;
            if (r['RABAT'] !== '') {
                const d = P(r['RABAT']);
                if (d === null || d < 0 || d > 100) {
                    errors.push({
                        sheet: 'Import',
                        row: rowNo,
                        col: 'RABAT',
                        value: String(r['RABAT'] ?? ''),
                        reason: 'rabat-0-100'
                    });
                    return;
                }
                discount = d;
            }
            const pehdType = r['NR_STUDNI'] || '';
            items.push({
                productId: r['INDEKS_CZESCI'] || '',
                quantity: qty,
                discount: discount,
                unitPrice: price,
                price: price,
                ...(pehdType ? { pehdType } : {})
            });
        });
        return { items, errors, transportSeparate };
    },

    async import(offerGroup) {
        const number = offerGroup.number;
        const built = this._buildItems(offerGroup.rows || []);
        const items = built.items;
        const hasTransportRow = built.transportSeparate;
        // Zero poprawnych pozycji: brak POST (blokada), bledy do raportu.
        if (!items.length) {
            return { invalid: true, number, errors: built.errors };
        }

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
            transportCost: 0,
            transportSeparate: hasTransportRow
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

            return { success: true, number, action, rowErrors: built.errors };
        } catch (err) {
            return { error: true, number, message: err.message };
        }
    }
};
