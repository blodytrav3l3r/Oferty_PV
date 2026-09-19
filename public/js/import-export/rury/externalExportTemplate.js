window.RuryExternalExportTemplate = {
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
                CENA_JEDNOSTKOWA: item.unitPrice || item.price || 0,
                WERSJA: 1,
                RABAT: item.discount ? item.discount.toFixed(2) : '',
                SREDNICA: '',
                ZAKONCZENIE: '',
                MAGAZYN: '',
                LP: i + 1
            });
        }
        // Osobna pozycja transportu (TR-RURY) — tylko gdy flaga na ofercie.
        const offerData = Object.assign({}, offer, (offer && offer.data) || {});
        if (offerData.transportSeparate) {
            const sepTrips = Number(offerData.transportCount) || 0;
            const sepPerTrip = Number(offerData.transportCostPerTrip) || 0;
            const sepTotal = Number(offerData.transportCost) || sepTrips * sepPerTrip;
            if (sepTotal > 0) {
                rows.push({
                    NUMER_OFERTY: offer.offer_number || offer.number || '',
                    NR_STUDNI: '',
                    GLEBOKOSC: '',
                    INDEKS_CZESCI: 'TR-RURY',
                    ILOSC: Math.round(sepTrips * 100) / 100,
                    CENA_JEDNOSTKOWA: sepPerTrip,
                    WERSJA: 1,
                    RABAT: '',
                    SREDNICA: '',
                    ZAKONCZENIE: '',
                    MAGAZYN: '',
                    LP: items.length + 1
                });
            }
        }
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
            CENA_JEDNOSTKOWA: item.unitPrice || item.price || 0,
            WERSJA: 1,
            RABAT: item.discount ? item.discount.toFixed(2) : '',
            SREDNICA: '',
            ZAKONCZENIE: '',
            MAGAZYN: '',
            LP: i + 1
        }));

        // Osobna pozycja transportu (TR-RURY) — tylko gdy flaga na zamówieniu.
        if (full.transportSeparate) {
            const sepTrips = Number(full.transportCount) || 0;
            const sepPerTrip = Number(full.transportCostPerTrip) || 0;
            const sepTotal = Number(full.transportCost) || sepTrips * sepPerTrip;
            if (sepTotal > 0) {
                rows.push({
                    NUMER_OFERTY: full.orderNumber || offerNumber,
                    NR_STUDNI: '',
                    GLEBOKOSC: '',
                    INDEKS_CZESCI: 'TR-RURY',
                    ILOSC: Math.round(sepTrips * 100) / 100,
                    CENA_JEDNOSTKOWA: sepPerTrip,
                    WERSJA: 1,
                    RABAT: '',
                    SREDNICA: '',
                    ZAKONCZENIE: '',
                    MAGAZYN: '',
                    LP: items.length + 1
                });
            }
        }

        const wb = await XlsxImportShared.generateExternalXlsx('rury', rows);
        const safeNumber = (full.orderNumber || 'zamowienie').replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, 'eksport_zamowienie_rury_' + safeNumber + '.xlsx');
    }
};
