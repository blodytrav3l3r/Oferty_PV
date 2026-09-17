window.RuryExternalExportTemplate = {
    async generateAndDownload(offerId) {
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
            const offerData = offer.data || offer;
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
        }

        if (!rows.length) {
            await appAlert('Brak pozycji do eksportu dla wybranej oferty.', { type: 'warning' });
            return;
        }

        const wb = await XlsxImportShared.generateExternalXlsx('rury', rows);
        XLSX.writeFile(wb, 'eksport_rury_zewn.xlsx');
    },

    async generateAndDownloadOrder(orderData) {
        const offerNumber = orderData.offer_number || orderData.number || '';
        const items = orderData.items || [];
        if (!items.length) {
            await appAlert('Brak pozycji w zamówieniu.', { type: 'warning' });
            return;
        }

        const rows = items.map((item, i) => ({
            NUMER_OFERTY: orderData.orderNumber || offerNumber,
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
        if (orderData.transportSeparate) {
            const sepTrips = Number(orderData.transportCount) || 0;
            const sepPerTrip = Number(orderData.transportCostPerTrip) || 0;
            const sepTotal = Number(orderData.transportCost) || sepTrips * sepPerTrip;
            if (sepTotal > 0) {
                rows.push({
                    NUMER_OFERTY: orderData.orderNumber || offerNumber,
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
        const safeNumber = (orderData.orderNumber || 'zamowienie').replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, 'eksport_zamowienie_rury_' + safeNumber + '.xlsx');
    }
};
