window.StudnieExternalExportTemplate = {
    _wellRows(data, offerNumber) {
        const wellsExport = data.wellsExport || [];
        const hasEnriched =
            wellsExport.length > 0 && wellsExport[0].config?.some((c) => c._xp !== undefined);
        const wells = hasEnriched ? wellsExport : data.wells || [];
        const offerDiscounts = data.wellDiscounts || {};
        const rows = [];
        let lp = 1;

        for (const well of wells) {
            const config = well.config || well.components || [];
            if (!config.length) continue;

            const magCode = well.magazyn === 'Włocławek' ? 'WL' : 'M0';
            const rzednaWlazu = well.rzednaWlazu || 0;
            const rzednaDna = well.rzednaDna || 0;
            const glebokosc = (rzednaWlazu - rzednaDna).toFixed(2).replace('.', ',');
            const srednica = well.dn != null ? 'X' + well.dn : '';
            const zakonczenie =
                well.zwienczenie ||
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
                    const p = this._productMap ? this._productMap.get(productId) : null;
                    if (p && p.componentType === 'kineta') continue;
                    const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
                    const isDennicaType =
                        p && ['dennica', 'kineta', 'styczna'].includes(p.componentType);
                    const disc = offerDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
                    const discountPct = Number(
                        isDennicaType ? disc.dennica || 0 : disc.nadbudowa || 0
                    );
                    cenaJednostkowa = (p ? p.price : 0) * (1 - discountPct / 100);
                }

                rows.push({
                    NUMER_OFERTY: offerNumber,
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

        return rows;
    },

    /**
     * Wiersz osobnej pozycji transportu (TR-STUDNIE) — tylko gdy flaga
     * transportSeparate na ofercie/zamówieniu. Suma z transportCost wpisów
     * eksportowych (ceny _xp transportu nie zawierają).
     */
    _transportRow(data, offerNumber, lp) {
        const wells = data.wellsExport || data.wells || [];
        const total = wells.reduce((s, w) => s + (Number(w.transportCost) || 0), 0);
        if (!data.transportSeparate || !(total > 0)) return null;
        const km = Number(data.transportKm) || 0;
        const rate = Number(data.transportRate) || 0;
        const perTrip = km * rate;
        const trips = perTrip > 0 ? Math.round((total / perTrip) * 100) / 100 : 0;
        return {
            NUMER_OFERTY: offerNumber,
            NR_STUDNI: '',
            GLEBOKOSC: '',
            INDEKS_CZESCI: 'TR-STUDNIE',
            ILOSC: trips,
            CENA_JEDNOSTKOWA: perTrip,
            WERSJA: 1,
            RABAT: '',
            SREDNICA: '',
            ZAKONCZENIE: '',
            MAGAZYN: '',
            LP: lp
        };
    },

    async _ensureProductCatalog() {
        if (typeof studnieProducts === 'undefined') {
            try {
                const res = await fetch('/api/products-studnie', { headers: authHeaders() });
                if (res.ok) {
                    const json = await res.json();
                    window.studnieProducts = json.data || [];
                }
            } catch (_e) {
                window.studnieProducts = [];
            }
        }
    },

    async generateAndDownload(offerId) {
        const offers = XlsxImportShared.getLoadedOffers();
        if (!offers.length) {
            await appAlert('Brak zaladowanych ofert. Otworz kartoteke.', { type: 'warning' });
            return;
        }

        this._productMap = null;
        let needsCatalog = false;
        for (const offer of offers) {
            if (offerId && offer.id !== offerId) continue;
            if (offer.type !== 'studnia_oferta') continue;
            const data = offer.data || offer;
            const wells = data.wellsExport || data.wells || [];
            if (wells.length && !wells[0].config?.some((c) => c._xp !== undefined)) {
                needsCatalog = true;
                break;
            }
        }

        if (needsCatalog) {
            await this._ensureProductCatalog();
            this._productMap = new Map(studnieProducts.map((p) => [p.id, p]));
        }

        const rows = [];
        for (const offer of offers) {
            if (offerId && offer.id !== offerId) continue;
            if (offer.type !== 'studnia_oferta') continue;
            const data = offer.data || offer;
            const offerNumber = offer.offer_number || offer.number || '';
            const before = rows.length;
            rows.push(...this._wellRows(data, offerNumber));
            const trRow = this._transportRow(data, offerNumber, rows.length - before + 1);
            if (trRow) rows.push(trRow);
        }

        if (!rows.length) {
            await appAlert('Brak pozycji do eksportu dla wybranej oferty.', { type: 'warning' });
            return;
        }

        const wb = await XlsxImportShared.generateExternalXlsx('studnie', rows);
        XLSX.writeFile(wb, 'eksport_studnie_zewn.xlsx');
    },

    async generateAndDownloadOrder(orderData) {
        this._productMap = null;

        const data = orderData;
        const wells = data.wellsExport || data.wells || [];
        if (wells.length && !wells[0].config?.some((c) => c._xp !== undefined)) {
            await this._ensureProductCatalog();
            this._productMap = new Map(studnieProducts.map((p) => [p.id, p]));
        }

        const offerNumber =
            orderData.orderNumber || orderData.offer_number || orderData.number || '';
        const rows = this._wellRows(data, offerNumber);
        const trRow = this._transportRow(data, offerNumber, rows.length + 1);
        if (trRow) rows.push(trRow);

        if (!rows.length) {
            await appAlert('Brak pozycji do eksportu dla wybranego zamówienia.', {
                type: 'warning'
            });
            return;
        }

        const wb = await XlsxImportShared.generateExternalXlsx('studnie', rows);
        const safeNumber = (orderData.orderNumber || 'zamowienie').replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, 'eksport_zamowienie_studnie_' + safeNumber + '.xlsx');
    }
};
