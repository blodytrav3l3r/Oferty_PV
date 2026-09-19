window.StudnieExternalExportTemplate = {
    _partForComp(comp) {
        const MC = window.MagazynCodes;
        let ct = comp.componentType;
        if (!ct && this._productMap) {
            const p = this._productMap.get(comp.productId || comp.indeks || '');
            ct = p && p.componentType;
        }
        if (ct && MC && typeof MC.isDennicaType === 'function' && MC.isDennicaType(ct))
            return 'dennica';
        // Typ nieznany (produkt spoza katalogu): fallback nadbudowa — nigdy zgadywanie dennicy.
        return 'nadbudowa';
    },

    _magCodeFor(well, comp, wMagDen, wMagNad, codes) {
        const MC = window.MagazynCodes;
        if (MC && typeof MC.codeForPart === 'function') {
            const part = this._partForComp(comp);
            return MC.codeForPart(part, part === 'dennica' ? wMagDen : wMagNad, codes);
        }
        // Fallback bez słownika: historyczne twarde WL/M0 z magazynu nadbudowy.
        return wMagNad === 'Włocławek' ? 'WL' : 'M0';
    },

    _wellRows(data, offerNumber, codes) {
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

            // Kod MAGAZYN per wiersz: dennica z magazynu dennicy, reszta z nadbudowy.
            const wMagDen = well.magazynDennica || well.magazyn || 'Kluczbork';
            const wMagNad = well.magazynNadbudowa || well.magazyn || 'Kluczbork';
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
                    MAGAZYN: this._magCodeFor(well, comp, wMagDen, wMagNad, codes),
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

    async _resolveCodes() {
        if (window.MagazynCodes && typeof window.MagazynCodes.get === 'function') {
            return window.MagazynCodes.get();
        }
        return null;
    },

    async _ensureProductMap() {
        await this._ensureProductCatalog();
        if (typeof studnieProducts !== 'undefined' && Array.isArray(studnieProducts)) {
            this._productMap = new Map(studnieProducts.map((p) => [p.id, p]));
        }
    },

    async generateAndDownload(offerId) {
        this._productMap = null;
        await this._ensureProductMap();
        const codes = await this._resolveCodes();

        // Lazy-load: pełny dokument oferty dopiero w chwili eksportu.
        // Lista kartoteki (getLoadedOffers) to projekcja slim bez wells/wellsExport.
        if (
            offerId &&
            typeof JsonOfferTransfer !== 'undefined' &&
            typeof JsonOfferTransfer.fetchOffer === 'function'
        ) {
            try {
                const full = await JsonOfferTransfer.fetchOffer('studnie', offerId);
                const data = Object.assign({}, full, (full && full.data) || {});
                const offerNumber = (full && (full.offer_number || full.number)) || '';
                const rows = this._wellRows(data, offerNumber, codes);
                const trRow = this._transportRow(data, offerNumber, rows.length + 1);
                if (trRow) rows.push(trRow);
                if (!rows.length) {
                    await appAlert('Brak pozycji do eksportu dla wybranej oferty.', {
                        type: 'warning'
                    });
                    return;
                }
                const wb = await XlsxImportShared.generateExternalXlsx('studnie', rows);
                XLSX.writeFile(wb, 'eksport_studnie_zewn.xlsx');
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
            if (offer.type !== 'studnia_oferta') continue;
            const data = offer.data || offer;
            const offerNumber = offer.offer_number || offer.number || '';
            const before = rows.length;
            rows.push(...this._wellRows(data, offerNumber, codes));
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
        await this._ensureProductMap();
        const codes = await this._resolveCodes();

        // Lazy-load: gdy przekazane zamówienie nie niesie pozycji (slim), dociągnij pełne z API.
        let data = orderData;
        if (
            (!data.wellsExport || !data.wellsExport.length) &&
            (!data.wells || !data.wells.length) &&
            data.id &&
            typeof JsonOfferTransfer !== 'undefined' &&
            typeof JsonOfferTransfer.fetchOrder === 'function'
        ) {
            try {
                const full = await JsonOfferTransfer.fetchOrder('studnie', data.id);
                data = Object.assign({}, data, full, (full && full.data) || {});
            } catch (_fetchErr) {
                // Zostań przy przekazanym obiekcie — poniżej komunikat o braku pozycji.
            }
        }
        const offerNumber = data.orderNumber || data.offer_number || data.number || '';
        const rows = this._wellRows(data, offerNumber, codes);
        const trRow = this._transportRow(data, offerNumber, rows.length + 1);
        if (trRow) rows.push(trRow);

        if (!rows.length) {
            await appAlert('Brak pozycji do eksportu dla wybranego zamówienia.', {
                type: 'warning'
            });
            return;
        }

        const wb = await XlsxImportShared.generateExternalXlsx('studnie', rows);
        const safeNumber = (data.orderNumber || 'zamowienie').replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, 'eksport_zamowienie_studnie_' + safeNumber + '.xlsx');
    }
};
