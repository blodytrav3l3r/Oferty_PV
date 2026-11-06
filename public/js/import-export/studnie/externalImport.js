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
    // LEGACY (ciche 0): zachowane dla zgodnosci testow magazynSplit;
    // import() uzywa _groupRowsStrict.
    _groupRows(rows, codes, typeMap) {
        return this._groupRowsStrict(rows, codes, typeMap, { legacyZeros: true }).wells;
    },

    // Strict: bledne liczby pomijane z wpisem bledu (D-FIX-2: zakaz cichego 0).
    // Rabat w skali 0-100 (jak wellComponentSchema i rury, bez /100).
    // opts.legacyZeros: true odtwarza stare ||0 (tylko testy legacy).
    _groupRowsStrict(rows, codes, typeMap, opts) {
        const legacy = !!(opts && opts.legacyZeros);
        const P = XlsxImportShared.parsePlNumber;
        const MC = window.MagazynCodes;
        const partOf = (indeks) => {
            const ct = typeMap ? typeMap.get((indeks || '').trim()) : undefined;
            if (ct && MC && typeof MC.isDennicaType === 'function' && MC.isDennicaType(ct))
                return 'dennica';
            // Typ nieznany (produkt spoza katalogu): null — kod idzie tylko w legacy magazyn.
            if (!ct) return null;
            return 'nadbudowa';
        };

        const errors = [];
        const wellMap = {};
        for (let ri = 0; ri < rows.length; ri++) {
            const r = rows[ri];
            const rowNo = ri + 2;
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
            const err = (col, value, reason) => {
                errors.push({
                    sheet: 'Import',
                    row: rowNo,
                    col: col,
                    value: String(value ?? ''),
                    reason: reason
                });
            };
            const unitPrice = legacy
                ? parseFloat(r['CENA_JEDNOSTKOWA']) || 0
                : P(r['CENA_JEDNOSTKOWA']);
            const qty = legacy ? parseInt(r['ILOSC']) || 0 : P(r['ILOSC']);
            let discount = 0;
            let finalPrice = unitPrice;
            if (!legacy) {
                if (qty === null || !Number.isInteger(qty) || qty <= 0) {
                    err('ILOSC', r['ILOSC'], 'ilosc-calkowita-dodatnia');
                    continue;
                }
                if (unitPrice === null || unitPrice < 0) {
                    err('CENA_JEDNOSTKOWA', r['CENA_JEDNOSTKOWA'], 'cena-nieujemna');
                    continue;
                }
                if (r['RABAT'] !== '') {
                    const d = P(r['RABAT']);
                    if (d === null || d < 0 || d > 100) {
                        err('RABAT', r['RABAT'], 'rabat-0-100');
                        continue;
                    }
                    discount = d;
                }
            } else {
                const hasDiscount = r['RABAT'] !== '';
                discount = hasDiscount ? parseFloat(r['RABAT']) / 100 || 0 : 0;
                finalPrice = hasDiscount ? unitPrice * (1 - discount) : unitPrice;
            }

            wellMap[wellName].components.push({
                indeks: r['INDEKS_CZESCI'] || '',
                ilosc: qty,
                rabat: discount,
                cenaJednostkowa: legacy ? (r['RABAT'] !== '' ? unitPrice : finalPrice) : unitPrice
            });
        }

        const wells = Object.values(wellMap)
            .map((w) => {
                // Domknięcie: brakujące części dziedziczą legacy magazyn.
                // Legacy magazyn = magazyn nadbudowy (jedno źródło, nigdy trzecia wartość).
                if (w.magazynDennica == null) w.magazynDennica = w.magazyn;
                if (w.magazynNadbudowa == null) w.magazynNadbudowa = w.magazyn;
                w.magazyn = w.magazynNadbudowa;
                return w;
            })
            .sort((a, b) => (a.lp || 0) - (b.lp || 0));
        return { wells, errors };
    },

    _applyWellTransportRows(wells, transportRows) {
        const P = XlsxImportShared.parsePlNumber;
        const errors = [];
        const costsByWell = new Map();
        let globalTransportCost = 0;
        for (const entry of transportRows) {
            const row = entry.row;
            const wellName = String(row['NR_STUDNI'] || '').trim();
            const quantity = P(row['ILOSC']);
            const unitPrice = P(row['CENA_JEDNOSTKOWA']);
            const rowNo = entry.rowNo;
            const addError = (col, value, reason) =>
                errors.push({
                    sheet: 'Import',
                    row: rowNo,
                    col,
                    value: String(value ?? ''),
                    reason
                });

            if (quantity === null || quantity <= 0 || (wellName && !Number.isInteger(quantity))) {
                addError('ILOSC', row['ILOSC'], 'ilosc-calkowita-dodatnia');
                continue;
            }
            if (unitPrice === null || unitPrice < 0) {
                addError('CENA_JEDNOSTKOWA', row['CENA_JEDNOSTKOWA'], 'cena-nieujemna');
                continue;
            }
            const amount =
                typeof roundMoney === 'function'
                    ? roundMoney(quantity * unitPrice)
                    : Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
            if (!wellName) {
                globalTransportCost += amount;
                continue;
            }

            costsByWell.set(wellName, (costsByWell.get(wellName) || 0) + amount);
        }

        for (const wellName of costsByWell.keys()) {
            if (!wells.some((well) => String(well.name || '').trim() === wellName)) {
                errors.push({
                    sheet: 'Import',
                    row: transportRows.find(
                        (entry) => String(entry.row['NR_STUDNI'] || '').trim() === wellName
                    )?.rowNo,
                    col: 'NR_STUDNI',
                    value: wellName,
                    reason: 'studnia-nie-znaleziona'
                });
            }
        }

        const nextWells = wells.map((well) => {
            const wellName = String(well.name || '').trim();
            const amount = costsByWell.get(wellName);
            if (amount === undefined || errors.some((error) => error.value === wellName))
                return well;
            const existing = Number(well.transportCost) || 0;
            const total = existing + amount;
            return {
                ...well,
                transportCost:
                    typeof roundMoney === 'function'
                        ? roundMoney(total)
                        : Math.round((total + Number.EPSILON) * 100) / 100
            };
        });
        const roundedGlobalTransportCost =
            typeof roundMoney === 'function'
                ? roundMoney(globalTransportCost)
                : Math.round((globalTransportCost + Number.EPSILON) * 100) / 100;
        return { wells: nextWells, globalTransportCost: roundedGlobalTransportCost, errors };
    },

    async import(offerGroup) {
        const number = offerGroup.number;
        const offerRows = offerGroup.rows || [];
        const transportRows = offerRows
            .map((row, index) => ({ row, rowNo: index + 2 }))
            .filter(
                (entry) =>
                    (typeof XlsxImportShared !== 'undefined' && XlsxImportShared.normalizeHeader
                        ? XlsxImportShared.normalizeHeader(entry.row['INDEKS_CZESCI'])
                        : String(entry.row['INDEKS_CZESCI'] || '')
                              .trim()
                              .toUpperCase()) === 'TR-STUDNIE'
            );
        const rows = offerRows.filter(
            (row) =>
                (typeof XlsxImportShared !== 'undefined' && XlsxImportShared.normalizeHeader
                    ? XlsxImportShared.normalizeHeader(row['INDEKS_CZESCI'])
                    : String(row['INDEKS_CZESCI'] || '')
                          .trim()
                          .toUpperCase()) !== 'TR-STUDNIE'
        );
        const hasTransportRow = transportRows.some(
            (entry) => !String(entry.row['NR_STUDNI'] || '').trim()
        );

        const MC = window.MagazynCodes;
        const codes = MC && typeof MC.get === 'function' ? await MC.get() : null;
        const typeMap = await this._ensureTypeMap();

        const grouped = this._groupRowsStrict(rows, codes, typeMap);
        const wellTransportRows = this._applyWellTransportRows(grouped.wells, transportRows);
        grouped.errors.push(...wellTransportRows.errors);
        const wells = wellTransportRows.wells;
        // Zero poprawnych komponentow: brak POST (blokada), bledy do raportu.
        if (!wells.length || !wells.some((w) => (w.components || []).length)) {
            return { invalid: true, number, errors: grouped.errors };
        }

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
            transportCost: wellTransportRows.globalTransportCost,
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

            return { success: true, number, action, rowErrors: grouped.errors };
        } catch (err) {
            return { error: true, number, message: err.message };
        }
    }
};
