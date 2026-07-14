window.RuryExternalExportTemplate = {
    async generateAndDownload(offerId) {
        const offers = window.pvSalesUI && window.pvSalesUI.allLocalOffers;
        if (!offers || !offers.length) {
            alert('Brak zaladowanych ofert. Otworz kartoteke.');
            return;
        }

        const rows = [];
        for (const offer of offers) {
            if (offerId && offer.id !== offerId) continue;
            if (offer.type === 'studnia_oferta') continue;
            const items = offer.items || [];
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
        }

        if (!rows.length) {
            alert('Brak pozycji do eksportu dla wybranej oferty.');
            return;
        }

        const wb = XlsxImportShared.generateExternalXlsx('rury', rows);
        XLSX.writeFile(wb, 'eksport_rury_zewn.xlsx');
    }
};
