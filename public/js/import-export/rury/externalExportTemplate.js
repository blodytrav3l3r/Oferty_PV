window.RuryExternalExportTemplate = {
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
    /**
     * Cena końcowa pozycji = katalogowa × (1 − rabat%). Kolumna RABAT zostaje
     * pusta — plik niesie już cenę po rabacie (import bierze ją wprost).
     */
    _netUnitPrice(item) {
        const base = Number(item.unitPrice || item.price || 0) || 0;
        const disc = Number(item.discount) || 0;
        return this._roundMoney(base * (1 - disc / 100));
    },

    _transportRows(data, number, startIndex) {
        if (!data.transportSeparate) return [];
        const count = Number(data.transportCount) || 0;
        const total = this._roundMoney(
            Number(data.transportCost) || count * Number(data.transportCostPerTrip || 0)
        );
        if (!(total > 0)) return [];
        const unitPrice = count > 0 ? this._roundMoney(total / count) : 0;
        if (
            !Number.isInteger(count) &&
            count > 0 &&
            this._roundMoney(count * unitPrice) === total
        ) {
            return [
                {
                    NUMER_OFERTY: number,
                    NR_STUDNI: '',
                    GLEBOKOSC: '',
                    INDEKS_CZESCI: 'TR-RURY',
                    ILOSC: count,
                    CENA_JEDNOSTKOWA: unitPrice,
                    WERSJA: 1,
                    RABAT: '',
                    SREDNICA: '',
                    ZAKONCZENIE: '',
                    MAGAZYN: '',
                    LP: startIndex
                }
            ];
        }
        const trips = Number.isSafeInteger(count) && count > 0 ? count : 1;
        const cents = Math.round(total * 100);
        const price = Math.floor(cents / trips);
        const extraTrips = cents % trips;
        return [
            { count: trips - extraTrips, cents: price },
            { count: extraTrips, cents: price + 1 }
        ]
            .filter((row) => row.count > 0)
            .map((row, index) => ({
                NUMER_OFERTY: number,
                NR_STUDNI: '',
                GLEBOKOSC: '',
                INDEKS_CZESCI: 'TR-RURY',
                ILOSC: row.count,
                CENA_JEDNOSTKOWA: row.cents / 100,
                WERSJA: 1,
                RABAT: '',
                SREDNICA: '',
                ZAKONCZENIE: '',
                MAGAZYN: '',
                LP: startIndex + index
            }));
    },

    _offerRows(offer, items) {
        const rows = [];
        const metadataRows = [];
        const offerData = Object.assign({}, offer, (offer && offer.data) || {});
        const allocations =
            offerData.transportAllocation &&
            offerData.transportAllocation.version === 1 &&
            Array.isArray(offerData.transportAllocation.items)
                ? offerData.transportAllocation.items
                : [];
        let lp = 1;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemUid = String(item.uid || item.id || 'rury-' + (i + 1));
            const allocation = allocations.find((entry) => String(entry.itemUid) === itemUid);
            const segments =
                allocation && Array.isArray(allocation.segments) ? allocation.segments : [];
            const usableSegments =
                Number.isInteger(Number(item.quantity)) &&
                segments.length > 0 &&
                segments.every(
                    (segment) =>
                        Number.isInteger(Number(segment.quantity)) &&
                        Number(segment.quantity) > 0 &&
                        Number.isInteger(Number(segment.transportCentsPerUnit)) &&
                        Number(segment.transportCentsPerUnit) >= 0
                ) &&
                segments.reduce((sum, segment) => sum + Number(segment.quantity), 0) ===
                    Number(item.quantity) &&
                segments.reduce(
                    (sum, segment) =>
                        sum + Number(segment.quantity) * Number(segment.transportCentsPerUnit),
                    0
                ) === Number(allocation.totalCents);
            const displaySegments = usableSegments
                ? segments
                : [{ quantity: Number(item.quantity) || 0, transportCentsPerUnit: 0 }];
            displaySegments.forEach((segment) => {
                const rowLp = lp++;
                const transportCents = Number(segment.transportCentsPerUnit) || 0;
                const exportedRow = {
                    NUMER_OFERTY: offer.offer_number || offer.number || '',
                    NR_STUDNI: item.pehdType || '',
                    GLEBOKOSC: '',
                    INDEKS_CZESCI: item.productId || '',
                    ILOSC: segment.quantity,
                    CENA_JEDNOSTKOWA: this._roundMoney(
                        this._netUnitPrice(item) + transportCents / 100
                    ),
                    WERSJA: 1,
                    RABAT: '',
                    SREDNICA: '',
                    ZAKONCZENIE: '',
                    MAGAZYN: '',
                    LP: rowLp
                };
                rows.push(exportedRow);
                if (allocation) {
                    metadataRows.push({
                        VERSION: 1,
                        OFFER_NUMBER: offer.offer_number || offer.number || '',
                        OFFER_ID: offer.id || '',
                        ITEM_UID: itemUid,
                        ROW_LP: rowLp,
                        TOTAL_CENTS: allocation.totalCents,
                        SEGMENT_JSON: usableSegments ? JSON.stringify(segment) : '',
                        LINE_CENTS: 0,
                        ROW_JSON: JSON.stringify(exportedRow),
                        SOURCE_ITEM_JSON: JSON.stringify(item)
                    });
                }
                if (!usableSegments && allocation && Number(allocation.totalCents) > 0) {
                    const adjustmentLp = lp++;
                    const adjustmentRow = {
                        NUMER_OFERTY: offer.offer_number || offer.number || '',
                        NR_STUDNI: 'Transport wliczony w cenę',
                        GLEBOKOSC: '',
                        INDEKS_CZESCI: 'TR-RURY',
                        ILOSC: 1,
                        CENA_JEDNOSTKOWA: Number(allocation.totalCents) / 100,
                        WERSJA: 1,
                        RABAT: '',
                        SREDNICA: '',
                        ZAKONCZENIE: '',
                        MAGAZYN: '',
                        LP: adjustmentLp
                    };
                    rows.push(adjustmentRow);
                    metadataRows.push({
                        VERSION: 1,
                        OFFER_NUMBER: offer.offer_number || offer.number || '',
                        OFFER_ID: offer.id || '',
                        ITEM_UID: itemUid,
                        ROW_LP: adjustmentLp,
                        TOTAL_CENTS: allocation.totalCents,
                        SEGMENT_JSON: '',
                        LINE_CENTS: allocation.totalCents,
                        ROW_JSON: JSON.stringify(adjustmentRow),
                        SOURCE_ITEM_JSON: JSON.stringify(item)
                    });
                }
            });
        }
        // Osobna pozycja transportu (TR-RURY) — tylko gdy flaga na ofercie.
        rows.push(...this._transportRows(offerData, offer.offer_number || offer.number || '', lp));
        return { rows, metadataRows };
    },

    async generateAndDownload(offerId) {
        // Lazy-load: pełny dokument oferty dopiero w chwili eksportu.
        // Lista kartoteki (getLoadedOffers) to projekcja slim bez items.
        if (
            offerId &&
            typeof JsonOfferTransfer !== 'undefined' &&
            typeof JsonOfferTransfer.fetchOffer === 'function'
        ) {
            try {
                const full = await JsonOfferTransfer.fetchOffer('rury', offerId);
                const items =
                    (full.data && Array.isArray(full.data.items) && full.data.items) ||
                    full.items ||
                    [];
                const exported = this._offerRows(full, items);
                const rows = exported.rows;
                if (!rows.length) {
                    await appAlert('Brak pozycji do eksportu dla wybranej oferty.', {
                        type: 'warning'
                    });
                    return;
                }
                const wb = await XlsxImportShared.generateExternalXlsx(
                    'rury',
                    rows,
                    exported.metadataRows
                );
                XLSX.writeFile(wb, 'eksport_rury_zewn.xlsx');
                return;
            } catch (_fetchErr) {
                // Fallback na cache kartoteki poniżej.
            }
        }

        const offers = XlsxImportShared.getLoadedOffers();
        if (!offers.length) {
            await appAlert('Brak zaladowanych ofert. Otworz kartoteke.', { type: 'warning' });
            return;
        }

        const rows = [];
        const metadataRows = [];
        for (const offer of offers) {
            if (offerId && offer.id !== offerId) continue;
            if (offer.type === 'studnia_oferta') continue;
            const items =
                offer.data && Array.isArray(offer.data.items)
                    ? offer.data.items
                    : offer.items || [];
            const exported = this._offerRows(offer, items);
            rows.push(...exported.rows);
            metadataRows.push(...exported.metadataRows);
        }

        if (!rows.length) {
            await appAlert('Brak pozycji do eksportu dla wybranej oferty.', { type: 'warning' });
            return;
        }

        const wb = await XlsxImportShared.generateExternalXlsx('rury', rows, metadataRows);
        XLSX.writeFile(wb, 'eksport_rury_zewn.xlsx');
    },

    async generateAndDownloadOrder(orderData) {
        // Lazy-load: gdy przekazane zamówienie nie niesie pozycji (slim), dociągnij pełne z API.
        let full = orderData;
        if (
            (!full.items || !full.items.length) &&
            full.id &&
            typeof JsonOfferTransfer !== 'undefined' &&
            typeof JsonOfferTransfer.fetchOrder === 'function'
        ) {
            try {
                const fetched = await JsonOfferTransfer.fetchOrder('rury', full.id);
                full = Object.assign({}, full, fetched, (fetched && fetched.data) || {});
            } catch (_fetchErr) {
                // Zostań przy przekazanym obiekcie — poniżej komunikat o braku pozycji.
            }
        }
        const offerNumber = full.offer_number || full.number || '';
        const items = full.items || [];
        if (!items.length) {
            await appAlert('Brak pozycji w zamówieniu.', { type: 'warning' });
            return;
        }

        const exported = this._offerRows(
            Object.assign({}, full, { offer_number: full.orderNumber || offerNumber }),
            items
        );
        const rows = exported.rows;

        const wb = await XlsxImportShared.generateExternalXlsx('rury', rows, exported.metadataRows);
        const safeNumber =
            typeof window !== 'undefined' &&
            window.ExportFilenames &&
            window.ExportFilenames.pickPart
                ? window.ExportFilenames.pickPart([full.orderNumber, 'zamowienie'])
                : String(full.orderNumber || 'zamowienie').replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, 'eksport_zamowienie_rury_' + safeNumber + '.xlsx');
    }
};
