window.StudnieExternalImport = {
    async findOfferByNumber(number) {
        return (
            XlsxImportShared.getLoadedOffers().find(
                (o) => o.offer_number === number || o.number === number
            ) || null
        );
    },

    // Katalog produktów do rozpoznania części (dennica/nadbudowa) po INDEKS_CZESCI.
    // Musi być gotowy PRZED mapowaniem MAGAZYN (bez zgadywania typu).
    async _ensureTypeMap() {
        try {
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const res = await fetch('/api/products-studnie', { headers });
            if (!res.ok) return new Map();
            const json = await res.json();
            const list = json.data || [];
            return new Map(list.map((p) => [p.id, p.componentType]));
        } catch (_e) {
            return new Map();
        }
    },

    // Czyste grupowanie wierszy XLSX w studnie (bez I/O — testowalne).
    // Wejście: wiersze po odfiltrowaniu TR-STUDNIE, słownik kodów, mapa indeks→typ.
    _groupRows(rows, codes, typeMap) {
        const MC = window.MagazynCodes;
        const partOf = (indeks) => {
            const ct = typeMap ? typeMap.get((indeks || '').trim()) : undefined;
            if (ct && MC && typeof MC.isDennicaType === 'function' && MC.isDennicaType(ct))
                return 'dennica';
            // Typ nieznany (produkt spoza katalogu): null — kod idzie tylko w legacy magazyn.
            if (!ct) return null;
            return 'nadbudowa';
        };

        const wellMap = {};
        for (const r of rows) {
            const wellName = r['NR_STUDNI'] || 'Studnia_1';
            if (!wellMap[wellName]) {
                wellMap[wellName] = {
                    dn: r['SREDNICA'] || '',
                    depth: parseInt(r['GLEBOKOSC']) || 0,
                    name: wellName,
                    magazyn: 'Kluczbork',
                    magazynDennica: null,
                    magazynNadbudowa: null,
                    lp: parseInt(r['LP']) || Object.keys(wellMap).length + 1,
                    components: []
                };
            }
            const well = wellMap[wellName];
            const part = partOf(r['INDEKS_CZESCI']);
            const wh =
                MC && typeof MC.warehouseForCode === 'function'
                    ? MC.warehouseForCode(r['MAGAZYN'], part || 'nadbudowa', codes)
                    : r['MAGAZYN'] === 'WL'
                      ? 'Włocławek'
                      : 'Kluczbork';
            if (part === 'dennica') well.magazynDennica = wh;
            else if (part === 'nadbudowa') well.magazynNadbudowa = wh;
            else if (well.magazynDennica == null && well.magazynNadbudowa == null)
                well.magazyn = wh;
            const unitPrice = parseFloat(r['CENA_JEDNOSTKOWA']) || 0;
            const qty = parseInt(r['ILOSC']) || 0;
            const hasDiscount = r['RABAT'] !== '';
            const discount = hasDiscount ? parseFloat(r['RABAT']) / 100 || 0 : 0;
            const finalPrice = hasDiscount ? unitPrice * (1 - discount) : unitPrice;

            wellMap[wellName].components.push({
                indeks: r['INDEKS_CZESCI'] || '',
                ilosc: qty,
                rabat: hasDiscount ? discount : 0,
                cenaJednostkowa: hasDiscount ? unitPrice : finalPrice
            });
        }

        return Object.values(wellMap)
            .map((w) => {
                // Domknięcie: brakujące części dziedziczą legacy magazyn.
                // Legacy magazyn = magazyn nadbudowy (jedno źródło, nigdy trzecia wartość).
                if (w.magazynDennica == null) w.magazynDennica = w.magazyn;
                if (w.magazynNadbudowa == null) w.magazynNadbudowa = w.magazyn;
                w.magazyn = w.magazynNadbudowa;
                return w;
            })
            .sort((a, b) => (a.lp || 0) - (b.lp || 0));
    },

    async import(offerGroup) {
        const number = offerGroup.number;
        // Wiersz osobnej pozycji transportu (TR-STUDNIE) nie jest elementem studni.
        const rows = (offerGroup.rows || []).filter(
            (r) => (r['INDEKS_CZESCI'] || '').trim().toUpperCase() !== 'TR-STUDNIE'
        );
        const hasTransportRow = (offerGroup.rows || []).length !== rows.length;

        const MC = window.MagazynCodes;
        const codes = MC && typeof MC.get === 'function' ? await MC.get() : null;
        const typeMap = await this._ensureTypeMap();

        const wells = this._groupRows(rows, codes, typeMap);

        const existing = await this.findOfferByNumber(number);
        let action = 'create';
        if (existing) {
            const choice = await ConflictModal.show(number);
            if (choice === 'skip') return { skipped: true, number };
            if (choice === 'clone') {
                action = 'clone';
            }
            if (choice === 'overwrite') {
                action = 'overwrite';
            }
        }

        const offerPayload = {
            id: existing && action === 'overwrite' ? existing.id : undefined,
            number: number,
            status: 'draft',
            transportCost: 0,
            transportSeparate: hasTransportRow,
            wells: wells,
            clientName: '',
            investName: ''
        };

        if (action === 'clone') {
            offerPayload.number = number + '-2';
        }

        try {
            const resp = await fetch('/api/offers-rury/studnie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ data: [offerPayload] })
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Blad zapisu oferty studni');
            }
            const result = await resp.json();

            await fetch('/api/feature-flags/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    entityType: 'studnia_oferta',
                    entityId: result.results?.[0]?.id || '',
                    action: 'import.external',
                    details: {
                        number,
                        wellsCount: wells.length,
                        rowsCount: rows.length,
                        source: 'xlsx'
                    }
                })
            });

            return { success: true, number, action };
        } catch (err) {
            return { error: true, number, message: err.message };
        }
    }
};
