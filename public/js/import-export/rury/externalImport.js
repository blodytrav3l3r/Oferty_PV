window.RuryExternalImport = {
    _roundMoney(value) {
        if (typeof roundMoney === 'function') return roundMoney(value);
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        if (Math.abs(numeric) >= 1e21) return numeric;
        const [mantissa, exponent = '0'] = Math.abs(numeric).toString().split('e');
        return (
            ((numeric < 0 ? -1 : 1) * Math.round(Number(`${mantissa}e${Number(exponent) + 2}`))) /
            100
        );
    },
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
    _buildItems(rows, transportAllocation) {
        const P = XlsxImportShared.parsePlNumber;
        const items = [];
        const errors = [];
        const metadataItems =
            transportAllocation &&
            transportAllocation.version === 1 &&
            Array.isArray(transportAllocation.items)
                ? transportAllocation.items
                : [];
        const metadataByLp = new Map();
        const rowsByLp = new Map();
        const invalidMetadataUids = new Set();
        const conflictError = (metadata, lp, row, column) => ({
            sheet: 'Import',
            row: Math.max(2, Number(lp) + 1 || 2),
            col: column,
            value: String(row?.[column] ?? ''),
            reason: 'wiersz-niezgodny-z-metadanymi',
            itemUid: metadata.itemUid
        });
        (rows || []).forEach((row) => {
            const lp = String(row['LP'] || '');
            if (lp) rowsByLp.set(lp, row);
        });
        metadataItems.forEach((metadata) => {
            (metadata.rowLps || []).forEach((lp) => metadataByLp.set(String(lp), metadata));
            const rowLps = (metadata.rowLps || []).map(String);
            const rowDetails = new Map(
                (metadata.rowDetails || []).map((detail) => [String(detail.rowLp), detail])
            );
            rowLps.forEach((lp) => {
                const row = rowsByLp.get(lp);
                const source = metadata.sourceItem;
                const rowDetail = rowDetails.get(lp);
                let segment = rowDetail?.segment || null;
                let lineCents = Number(rowDetail?.lineCents) || 0;
                let visibleMetadataMatches = true;
                const rowSnapshot = rowDetail?.rowSnapshot;
                if (row && !rowSnapshot) {
                    visibleMetadataMatches = false;
                    invalidMetadataUids.add(metadata.itemUid);
                    errors.push(conflictError(metadata, lp, row, 'ROW_JSON'));
                } else if (row && rowSnapshot) {
                    [
                        'NUMER_OFERTY',
                        'NR_STUDNI',
                        'GLEBOKOSC',
                        'INDEKS_CZESCI',
                        'ILOSC',
                        'CENA_JEDNOSTKOWA',
                        'WERSJA',
                        'RABAT',
                        'SREDNICA',
                        'ZAKONCZENIE',
                        'MAGAZYN',
                        'LP'
                    ].forEach((field) => {
                        const expected = rowSnapshot[field];
                        const actual = row[field];
                        const numeric = [
                            'GLEBOKOSC',
                            'ILOSC',
                            'CENA_JEDNOSTKOWA',
                            'WERSJA',
                            'RABAT',
                            'SREDNICA'
                        ].includes(field);
                        const expectedText = String(expected ?? '').trim();
                        const actualText = String(actual ?? '').trim();
                        const matches = numeric
                            ? expectedText === '' || actualText === ''
                                ? expectedText === actualText
                                : P(expected) !== null &&
                                  P(actual) !== null &&
                                  P(expected) === P(actual)
                            : expectedText === actualText;
                        if (matches) return;
                        visibleMetadataMatches = false;
                        invalidMetadataUids.add(metadata.itemUid);
                        errors.push(conflictError(metadata, lp, row, field));
                    });
                }
                if (!visibleMetadataMatches) return;
                if (!segment && !lineCents && row && source) {
                    const qty = P(row['ILOSC']);
                    const price = P(row['CENA_JEDNOSTKOWA']);
                    if (XlsxImportShared.normalizeHeader(row['INDEKS_CZESCI']) === 'TR-RURY') {
                        lineCents = Number(metadata.lineCents) || 0;
                    } else {
                        segment = (metadata.segments || []).find((candidate) => {
                            const base = this._roundMoney(
                                (Number(source.unitPrice || source.price || 0) || 0) *
                                    (1 - (Number(source.discount) || 0) / 100)
                            );
                            const expectedPrice = this._roundMoney(
                                base + Number(candidate.transportCentsPerUnit || 0) / 100
                            );
                            return (
                                Number(candidate.quantity) === qty &&
                                Math.abs(expectedPrice - (price ?? NaN)) < 0.001
                            );
                        });
                    }
                }
                const quantity = P(row?.['ILOSC']);
                const visiblePrice = P(row?.['CENA_JEDNOSTKOWA']);
                const validLine =
                    row &&
                    source &&
                    XlsxImportShared.normalizeHeader(row['INDEKS_CZESCI']) === 'TR-RURY' &&
                    lineCents > 0 &&
                    quantity === 1 &&
                    Math.abs((visiblePrice ?? NaN) - lineCents / 100) < 0.001;
                const validSegment =
                    row &&
                    source &&
                    segment &&
                    XlsxImportShared.normalizeHeader(row['INDEKS_CZESCI']) ===
                        XlsxImportShared.normalizeHeader(source.productId) &&
                    quantity === Number(segment.quantity) &&
                    Number(
                        rowDetails.get(lp)?.segment?.transportCentsPerUnit ??
                            segment.transportCentsPerUnit
                    ) === Number(segment.transportCentsPerUnit) &&
                    Math.abs(
                        (visiblePrice ?? NaN) -
                            this._roundMoney(
                                this._roundMoney(
                                    (Number(source.unitPrice || source.price || 0) || 0) *
                                        (1 - (Number(source.discount) || 0) / 100)
                                ) +
                                    Number(segment.transportCentsPerUnit || 0) / 100
                            )
                    ) < 0.001;
                const validBase =
                    row &&
                    source &&
                    !segment &&
                    !lineCents &&
                    XlsxImportShared.normalizeHeader(row['INDEKS_CZESCI']) ===
                        XlsxImportShared.normalizeHeader(source.productId) &&
                    quantity === Number(source.quantity) &&
                    Math.abs(
                        (visiblePrice ?? NaN) -
                            this._roundMoney(
                                (Number(source.unitPrice || source.price || 0) || 0) *
                                    (1 - (Number(source.discount) || 0) / 100)
                            )
                    ) < 0.001;
                if (!validLine && !validSegment && !validBase) {
                    invalidMetadataUids.add(metadata.itemUid);
                    errors.push(
                        conflictError(
                            metadata,
                            lp,
                            row,
                            row &&
                                XlsxImportShared.normalizeHeader(row['INDEKS_CZESCI']) === 'TR-RURY'
                                ? 'CENA_JEDNOSTKOWA'
                                : 'ILOSC'
                        )
                    );
                }
            });
        });
        const addedMetadataUids = new Set();
        const restoredAllocations = [];
        let transportSeparate = false;
        let transportCost = 0;
        let transportCount = 0;
        (rows || []).forEach((r, i) => {
            const rowNo = i + 2;
            const mappedItem = metadataByLp.get(String(r['LP'] || ''));
            if (mappedItem && mappedItem.sourceItem && mappedItem.itemUid) {
                if (invalidMetadataUids.has(mappedItem.itemUid)) return;
                if (!addedMetadataUids.has(mappedItem.itemUid)) {
                    const sourceItem = Object.assign({}, mappedItem.sourceItem, {
                        uid: mappedItem.itemUid
                    });
                    items.push(sourceItem);
                    addedMetadataUids.add(mappedItem.itemUid);
                    const allocation = {
                        itemUid: mappedItem.itemUid,
                        totalCents: mappedItem.totalCents
                    };
                    if (mappedItem.segments && mappedItem.segments.length) {
                        allocation.segments = mappedItem.segments.map((segment) => ({
                            quantity: segment.quantity,
                            transportCentsPerUnit: segment.transportCentsPerUnit
                        }));
                    }
                    restoredAllocations.push(allocation);
                }
                return;
            }
            if (XlsxImportShared.normalizeHeader(r['INDEKS_CZESCI']) === 'TR-RURY') {
                const qty = P(r['ILOSC']);
                const price = P(r['CENA_JEDNOSTKOWA']);
                if (qty === null || qty <= 0 || price === null || price < 0) {
                    errors.push({
                        sheet: 'Import',
                        row: rowNo,
                        col: qty === null || qty <= 0 ? 'ILOSC' : 'CENA_JEDNOSTKOWA',
                        value: String(
                            (qty === null || qty <= 0 ? r['ILOSC'] : r['CENA_JEDNOSTKOWA']) ?? ''
                        ),
                        reason: qty === null || qty <= 0 ? 'ilosc-dodatnia' : 'cena-nieujemna'
                    });
                    return;
                }
                transportSeparate = true;
                transportCount += qty;
                transportCost += this._roundMoney(qty * price);
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
            if (r['RABAT'] != null && r['RABAT'] !== '') {
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
        return {
            items,
            errors,
            invalid: invalidMetadataUids.size > 0,
            ...(restoredAllocations.length
                ? { transportAllocation: { version: 1, items: restoredAllocations } }
                : {}),
            transportSeparate,
            transportCount,
            transportCost: this._roundMoney(transportCost)
        };
    },

    async import(offerGroup) {
        const number = offerGroup.number;
        const built = this._buildItems(offerGroup.rows || [], offerGroup.transportAllocation);
        const items = built.items;
        const hasTransportRow = built.transportSeparate;
        // Zero poprawnych pozycji: brak POST (blokada), bledy do raportu.
        if (built.invalid || !items.length) {
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
            transportCost: built.transportCost,
            transportCount: built.transportCount,
            externalTransportCost: built.transportSeparate ? built.transportCost : null,
            transportSeparate: hasTransportRow,
            ...(built.transportAllocation ? { transportAllocation: built.transportAllocation } : {})
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
