window.StudnieExternalExportTemplate = {
    async generateAndDownload(offerId) {
        const offers = window.pvSalesUI && window.pvSalesUI.allLocalOffers;
        if (!offers || !offers.length) {
            alert('Brak zaladowanych ofert. Otworz kartoteke.');
            return;
        }

        const rows = [];
        for (const offer of offers) {
            if (offerId && offer.id !== offerId) continue;
            if (offer.type !== 'studnia_oferta') continue;
            const data = offer.data || offer;
            const wells = data.wells || [];
            let lp = 1;
            for (const well of wells) {
                const components = well.components || [];
                for (const comp of components) {
                    const isDennica =
                        comp.indeks &&
                        (comp.indeks.toLowerCase().indexOf('dennica') !== -1 ||
                            comp.indeks.toLowerCase().indexOf('dno') !== -1);
                    rows.push({
                        NUMER_OFERTY: offer.offer_number || offer.number || '',
                        NR_STUDNI: well.name || '',
                        GLEBOKOSC: well.depth || '',
                        INDEKS_CZESCI: comp.indeks || '',
                        ILOSC: comp.ilosc || 0,
                        CENA_JEDNOSTKOWA: isDennica
                            ? comp.cenaPoRabacie || comp.cenaJednostkowa || 0
                            : comp.cenaJednostkowa || 0,
                        WERS: 1,
                        RABAT: isDennica ? '' : comp.rabat ? (comp.rabat * 100).toFixed(2) : '',
                        SREDNICA: well.dn || '',
                        ZAKONCZENIE: comp.zakonczenie || '',
                        MAGA: comp.maga || '',
                        LP: lp++
                    });
                }
            }
        }

        if (!rows.length) {
            alert('Brak pozycji do eksportu dla wybranej oferty.');
            return;
        }

        const wb = XlsxImportShared.generateExternalXlsx('studnie', rows);
        XLSX.writeFile(wb, 'eksport_studnie_zewn.xlsx');
    }
};
