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
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            rows.push({
                NUMER_OFERTY: offer.offer_number || offer.number || '',
                NR_STUDNI: item.pehdType || '',
                GLEBOKOSC: '',
                INDEKS_CZESCI: item.productId || '',
                ILOSC: item.quantity || 0,
                CENA_JEDNOSTKOWA: this._netUnitPrice(item),
                WERSJA: 1,
                RABAT: '',
                SREDNICA: '',
                ZAKONCZENIE: '',
                MAGAZYN: '',
                LP: i + 1
            });
        }
        // Osobna pozycja transportu (TR-RURY) — tylko gdy flaga na ofercie.
        const offerData = Object.assign({}, offer, (offer && offer.data) || {});
        rows.push(
            ...this._transportRows(
                offerData,
                offer.offer_number || offer.number || '',
                items.length + 1
            )
        );
        return rows;
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
                const rows = this._offerRows(full, items);
                if (!rows.length) {
                    await appAlert('Brak pozycji do eksportu dla wybranej oferty.', {
                        type: 'warning'
                    });
                    return;
                }
                const wb = await XlsxImportShared.generateExternalXlsx('rury', rows);
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
        for (const offer of offers) {
            if (offerId && offer.id !== offerId) continue;
            if (offer.type === 'studnia_oferta') continue;
            const items =
                offer.data && Array.isArray(offer.data.items)
                    ? offer.data.items
                    : offer.items || [];
            rows.push(...this._offerRows(offer, items));
        }

        if (!rows.length) {
            await appAlert('Brak pozycji do eksportu dla wybranej oferty.', { type: 'warning' });
            return;
        }

        const wb = await XlsxImportShared.generateExternalXlsx('rury', rows);
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

        const rows = items.map((item, i) => ({
            NUMER_OFERTY: full.orderNumber || offerNumber,
            NR_STUDNI: item.pehdType || '',
            GLEBOKOSC: '',
            INDEKS_CZESCI: item.productId || '',
            ILOSC: item.quantity || 0,
            CENA_JEDNOSTKOWA: this._netUnitPrice(item),
            WERSJA: 1,
            RABAT: '',
            SREDNICA: '',
            ZAKONCZENIE: '',
            MAGAZYN: '',
            LP: i + 1
        }));

        // Osobna pozycja transportu (TR-RURY) — tylko gdy flaga na zamówieniu.
        rows.push(...this._transportRows(full, full.orderNumber || offerNumber, items.length + 1));

        const wb = await XlsxImportShared.generateExternalXlsx('rury', rows);
        const safeNumber =
            typeof window !== 'undefined' &&
            window.ExportFilenames &&
            window.ExportFilenames.pickPart
                ? window.ExportFilenames.pickPart([full.orderNumber, 'zamowienie'])
                : String(full.orderNumber || 'zamowienie').replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, 'eksport_zamowienie_rury_' + safeNumber + '.xlsx');
    }
};
