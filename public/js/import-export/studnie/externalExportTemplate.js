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

    /**
     * Netto pozycji bez `_xp`: zamrożona cena (zamówienia, stare oferty) albo
     * cennik z rabatem. `frozenPrice` zawiera już narzuty pozycji.
     */
    _legacyNet(well, p, comp, offerDiscounts) {
        if (comp && comp.frozenPrice != null) return Number(comp.frozenPrice) || 0;
        if (!p) return 0;
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const disc = (offerDiscounts || {})[discountKey] || { dennica: 0, nadbudowa: 0 };
        const isDennicaType = ['dennica', 'kineta', 'styczna'].includes(p.componentType);
        const pct = Number(isDennicaType ? disc.dennica || 0 : disc.nadbudowa || 0);
        return (p.price || 0) * (1 - pct / 100);
    },

    /**
     * Kineta i przejścia nie mają własnego wiersza — ich koszt siedzi w wierszu
     * dennicy, tak jak w kalkulacji `_xp`. Bez tego suma pliku jest za niska.
     */
    _dennicaExtras(well, config, offerDiscounts, enriched) {
        const map = this._productMap;
        let sum = 0;
        for (const comp of config) {
            if (comp._xp !== undefined || comp._xskip === true) continue;
            const p = map ? map.get(comp.productId || comp.indeks || '') : null;
            if (!p || p.componentType !== 'kineta') continue;
            const qty = Number(comp.quantity || comp.ilosc) || 0;
            sum += this._legacyNet(well, p, comp, offerDiscounts) * qty;
        }
        // W ścieżce `_xp` przejścia są już doliczone do ceny hosta.
        if (enriched) return sum;
        for (const prz of well.przejscia || []) {
            const frozen = Number(prz.frozenPrice);
            if (Number.isFinite(frozen) && frozen > 0) {
                sum += frozen;
                continue;
            }
            const pp = map ? map.get(prz.productId) : null;
            if (pp) sum += this._legacyNet(well, pp, null, offerDiscounts);
        }
        return sum;
    },

    /**
     * Transport „w cenie elementów” (transportSeparate = false): doklejony do
     * cen jednostkowych proporcjonalnie do wartości wierszy studni, żeby suma
     * pliku równała się cenie studni z oferty (cena + transport).
     */
    _withTransport(rows, transport) {
        const extra = Number(transport) || 0;
        const total = rows.reduce(
            (s, r) => s + (Number(r.CENA_JEDNOSTKOWA) || 0) * (Number(r.ILOSC) || 0),
            0
        );
        if (!(extra > 0) || !(total > 0) || rows.length === 0) return rows;
        const factor = (total + extra) / total;
        const scaled = rows.map((r) => ({
            ...r,
            CENA_JEDNOSTKOWA: Math.round((Number(r.CENA_JEDNOSTKOWA) || 0) * factor * 100) / 100
        }));
        // Korekta groszowa, żeby suma po zaokrągleniach trafiła w cenę studni.
        const target = Math.round((total + extra) * 100) / 100;
        const now = scaled.reduce(
            (s, r) => s + (Number(r.CENA_JEDNOSTKOWA) || 0) * (Number(r.ILOSC) || 0),
            0
        );
        const delta = Math.round((target - now) * 100) / 100;
        if (delta !== 0) {
            // Preferuj wiersz o ilości 1 — korekta trafia w cenę co do grosza.
            const singles = scaled.filter((r) => Number(r.ILOSC) === 1);
            const host = singles.length
                ? singles.reduce((a, b) => (b.CENA_JEDNOSTKOWA > a.CENA_JEDNOSTKOWA ? b : a))
                : [...scaled].reverse().find((r) => Number(r.ILOSC) > 0);
            if (host) {
                const qty = Number(host.ILOSC);
                host.CENA_JEDNOSTKOWA =
                    Math.round((Number(host.CENA_JEDNOSTKOWA) + delta / qty) * 100) / 100;
            }
        }
        return scaled;
    },

    _wellRows(data, offerNumber, codes) {
        const wellsExport = data.wellsExport || [];
        const hasEnriched =
            wellsExport.length > 0 && wellsExport[0].config?.some((c) => c._xp !== undefined);
        const wells = hasEnriched ? wellsExport : data.wells || [];
        const offerDiscounts = data.wellDiscounts || {};
        const rows = [];
        let lp = 1;

        // Transport per studnia: zamówienia mają go tylko w slim `wellsExport`.
        const transportByWell = new Map();
        for (const w of wellsExport) {
            if (w && w.name != null)
                transportByWell.set(String(w.name), Number(w.transportCost) || 0);
        }

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
            const enriched = config.some((c) => c._xp !== undefined);
            const extras = this._dennicaExtras(well, config, offerDiscounts, enriched);
            const wellRows = [];

            for (const comp of config) {
                const productId = comp.productId || comp.indeks || '';
                if (comp._xskip === true) continue;
                const p = this._productMap ? this._productMap.get(productId) : null;
                // Właz (WLAZ-110/WLAZ-150) nie jest pozycją handlową pliku — pomijamy.
                // Fallback po ID: działa też, gdy katalog produktów nie jest załadowany.
                if (
                    comp.componentType === 'wlaz' ||
                    p?.componentType === 'wlaz' ||
                    /^WLAZ/i.test(productId)
                )
                    continue;
                const quantity = comp.quantity || comp.ilosc || 0;

                let cenaJednostkowa;

                if (comp._xp !== undefined) {
                    // `_xp` bywa ceną katalogową (`_xd` = rabat %) albo już końcową
                    // (wiersze z narzutami). Rozpoznajemy po `frozenPriceBase`.
                    const xp = Number(comp._xp) || 0;
                    const base = Number(comp.frozenPriceBase);
                    const isCatalogPrice = Number.isFinite(base) && Math.abs(xp - base) < 0.005;
                    cenaJednostkowa =
                        isCatalogPrice || !Number.isFinite(base)
                            ? xp * (1 - (Number(comp._xd) || 0) / 100)
                            : xp;
                } else {
                    // Kineta nie ma wiersza — jej cena jest w dennicy (extras).
                    if (p && p.componentType === 'kineta') continue;
                    cenaJednostkowa = this._legacyNet(well, p, comp, offerDiscounts);
                    if (p && p.componentType === 'dennica') cenaJednostkowa += extras;
                }

                wellRows.push({
                    NUMER_OFERTY: offerNumber,
                    NR_STUDNI: well.name || '',
                    GLEBOKOSC: glebokosc,
                    INDEKS_CZESCI: productId,
                    ILOSC: quantity,
                    // Cena końcowa po rabacie; RABAT pusty (import bierze cenę wprost).
                    CENA_JEDNOSTKOWA: Math.round(cenaJednostkowa * 100) / 100,
                    WERSJA: 1,
                    RABAT: '',
                    SREDNICA: srednica,
                    ZAKONCZENIE: zakonczenie,
                    MAGAZYN: this._magCodeFor(well, comp, wMagDen, wMagNad, codes),
                    LP: lp
                });
            }

            // „Transport w cenie elementów”: rozdziel na wiersze studni, żeby suma
            // pliku = cena studni z oferty. Osobna pozycja → wiersz TR-STUDNIE.
            const transport = data.transportSeparate
                ? 0
                : Number(well.transportCost) || transportByWell.get(String(well.name)) || 0;
            rows.push(...this._withTransport(wellRows, transport));
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
        const safeNumber =
            typeof window !== 'undefined' &&
            window.ExportFilenames &&
            window.ExportFilenames.pickPart
                ? window.ExportFilenames.pickPart([data.orderNumber, 'zamowienie'])
                : String(data.orderNumber || 'zamowienie').replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, 'eksport_zamowienie_studnie_' + safeNumber + '.xlsx');
    }
};
