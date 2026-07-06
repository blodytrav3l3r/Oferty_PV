window.StudnieExternalExportTemplate = {
    async generateAndDownload(offerId) {
        const offers = window.pvSalesUI && window.pvSalesUI.allLocalOffers;
        if (!offers || !offers.length) {
            alert('Brak zaladowanych ofert. Otworz kartoteke.');
            return;
        }

        // Wykryj czy ktoras oferta wymaga siegnięcia po katalog (brak _xp)
        let needsCatalog = false;
        for (const offer of offers) {
            if (offerId && offer.id !== offerId) continue;
            if (offer.type !== 'studnia_oferta') continue;
            const data = offer.data || offer;
            const wells = data.wellsExport || data.wells || [];
            if (wells.length && !wells[0].config?.some(c => c._xp !== undefined)) {
                needsCatalog = true;
                break;
            }
        }

        if (needsCatalog && typeof studnieProducts === 'undefined') {
            try {
                const res = await fetch('/api/products-studnie', { headers: authHeaders() });
                if (res.ok) {
                    const json = await res.json();
                    window.studnieProducts = json.data || [];
                }
            } catch (e) {
                window.studnieProducts = [];
            }
        }

        const productMap = needsCatalog
            ? new Map(studnieProducts.map(p => [p.id, p])) : null;

        const rows = [];
        for (const offer of offers) {
            if (offerId && offer.id !== offerId) continue;
            if (offer.type !== 'studnia_oferta') continue;
            const data = offer.data || offer;

            // wellsExport (nowe oferty) lub wells (stare oferty / fallback)
            const wellsExport = data.wellsExport || [];
            const hasEnriched = wellsExport.length > 0 &&
                wellsExport[0].config?.some(c => c._xp !== undefined);
            const wells = hasEnriched ? wellsExport : (data.wells || []);

            const offerDiscounts = data.wellDiscounts || {};
            let lp = 1;

            for (const well of wells) {
                const config = well.config || well.components || [];
                if (!config.length) continue;

                const magCode = (well.magazyn === 'Włocławek') ? 'WL' : 'M0';

                const rzednaWlazu = well.rzednaWlazu || 0;
                const rzednaDna = well.rzednaDna || 0;
                const glebokosc = (rzednaWlazu - rzednaDna).toFixed(2).replace('.', ',');

                const srednica = well.dn != null ? 'X' + well.dn : '';

                // Zakonczenie: juz obliczone w wellsExport (zwienczenie) lub licz na zyczenie
                const zakonczenie = well.zwienczenie ||
                    (typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '');

                for (const comp of config) {
                    const productId = comp.productId || comp.indeks || '';
                    if (comp._xskip === true) continue;
                    const quantity = comp.quantity || comp.ilosc || 0;

                    let cenaJednostkowa;
                    let rabat = '';

                    if (comp._xp !== undefined) {
                        cenaJednostkowa = comp._xp;
                        if (comp._xd !== undefined) rabat = comp._xd;
                    } else {
                        const p = productMap ? productMap.get(productId) : null;
                        if (p && p.componentType === 'kineta') continue;
                        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
                        const isDennicaType = p && ['dennica', 'kineta', 'styczna'].includes(p.componentType);
                        const disc = offerDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
                        const discountPct = Number(isDennicaType ? (disc.dennica || 0) : (disc.nadbudowa || 0));
                        cenaJednostkowa = (p ? p.price : 0) * (1 - discountPct / 100);
                    }

                    rows.push({
                        NUMER_OFERTY: offer.offer_number || offer.number || '',
                        NR_STUDNI: well.name || '',
                        GLEBOKOSC: glebokosc,
                        INDEKS_CZESCI: productId,
                        ILOSC: quantity,
                        CENA_JEDNOSTKOWA: cenaJednostkowa,
                        WERSJA: 1,
                        RABAT: rabat,
                        SREDNICA: srednica,
                        ZAKONCZENIE: zakonczenie,
                        MAGAZYN: magCode,
                        LP: lp
                    });
                }
                lp++;
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
