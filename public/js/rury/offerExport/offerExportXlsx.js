// @ts-check
/* ===== EKSPORT / IMPORT OFERT — XLSX ===== */
/* Wydzielone z offerExports.js */
/* Zależności: offers (globalne) */
/* calculateTransports, calculateTransportDistributionStandalone z transport.js */
/* saveOffersData z dataService.js; renderSavedOffers z offerCrudLoad.js */
/* showToast, appConfirm z shared/ui.js; fmt z shared/formatters.js */

function exportOfferXlsx(id) {
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;

    const costPerTrip = offer.transportCostPerTrip || 0;
    const transportResult = calculateTransports(offer.items);
    const transportDist = calculateTransportDistributionStandalone(offer.items, costPerTrip);
    const xlsxMode = offer.transportMode || 'full';
    const xlsxTransports =
        xlsxMode === 'fractional'
            ? offer.items
                  .filter((i) => !i.autoAdded && i.weight && i.weight > 0 && i.quantity > 0)
                  .reduce((s, i) => s + i.weight * i.quantity, 0) / MAX_TRANSPORT_WEIGHT
            : transportResult.totalTransports;
    const transportCost = xlsxTransports * costPerTrip;

    // ─── Sheet 1: OFERTA ───
    const rows = [];

    rows.push(['OFERTA HANDLOWA']);
    rows.push([]);
    rows.push(['Nr oferty:', offer.number, '', 'Data:', offer.date]);
    rows.push([]);
    rows.push(['DANE KLIENTA']);
    rows.push(['Firma:', offer.clientName || '']);
    rows.push(['NIP:', offer.clientNip || '']);
    rows.push(['Adres:', offer.clientAddress || '']);
    rows.push(['Kontakt:', offer.clientContact || '']);
    rows.push([]);
    rows.push(['INWESTYCJA']);
    rows.push(['Nazwa:', offer.investName || '']);
    rows.push(['Adres:', offer.investAddress || '']);
    rows.push([]);
    rows.push(['TRANSPORT']);
    rows.push(['Kilometry:', offer.transportKm || 0, 'PLN/km:', offer.transportRate || 0]);
    rows.push(['Koszt/kurs:', costPerTrip, 'Ilość kursów:', xlsxTransports]);
    rows.push([]);

    const headerRow = 18;
    rows.push([
        'Lp.',
        'Indeks',
        'Nazwa produktu',
        'PEHD',
        'Cena jedn.',
        'Ilość <i data-lucide="pencil"></i>',
        'Metry',
        'Rabat % <i data-lucide="pencil"></i>',
        'Po rabacie',
        'Transport/szt',
        'Netto',
        'Brutto',
        'Waga/szt'
    ]);

    let totalNetto = 0;
    let totalWeight = 0;

    offer.items.forEach((item, i) => {
        const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const unitAfterDiscount = priceAfterDiscount + pehdCost;
        const tpu = transportDist[item.productId] || 0;
        const unitTotal = unitAfterDiscount + tpu;
        const netto = unitTotal * item.quantity;
        const brutto = netto * 1.23;

        totalNetto += netto;
        totalWeight += (item.weight || 0) * item.quantity;

        let pName = item.name;
        let pehdLabel = '';
        if (item.pehdType === 'PEHD-3MM') pehdLabel = 'PEHD 3mm';
        if (item.pehdType === 'PEHD-4MM') pehdLabel = 'PEHD 4mm';
        if (item.autoAdded) pName += ' (dodane automatycznie)';

        rows.push([
            i + 1,
            item.productId,
            pName,
            pehdLabel,
            item.unitPrice,
            item.quantity,
            item.meters || 0,
            item.discount,
            unitAfterDiscount,
            tpu > 0 ? tpu : '',
            netto,
            brutto,
            item.weight || ''
        ]);
    });

    const totalVat = totalNetto * 0.23;
    const totalBrutto = totalNetto + totalVat;

    rows.push([]);
    rows.push(['', '', '', '', '', '', '', '', 'RAZEM Netto:', '', totalNetto]);
    rows.push(['', '', '', '', '', '', '', '', 'Transport:', '', transportCost]);
    rows.push(['', '', '', '', '', '', '', '', 'VAT (23%):', '', totalVat]);
    rows.push(['', '', '', '', '', '', '', '', 'SUMA BRUTTO:', '', totalBrutto]);
    rows.push([]);
    rows.push(['Łączna waga:', totalWeight, 'kg']);

    if (offer.notes) {
        rows.push([]);
        rows.push(['Uwagi:', offer.notes]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
        { wch: 5 },
        { wch: 20 },
        { wch: 55 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 10 }
    ];

    const itemStartRow = headerRow + 1;
    const itemEndRow = itemStartRow + offer.items.length;
    for (let r = itemStartRow; r < itemEndRow; r++) {
        ['E', 'I', 'J', 'K', 'L'].forEach((col) => {
            const ref = col + (r + 1);
            if (ws[ref] && typeof ws[ref].v === 'number') {
                ws[ref].z = '#,##0.00';
            }
        });
    }

    for (let r = itemEndRow + 1; r < rows.length; r++) {
        const ref = 'K' + (r + 1);
        if (ws[ref] && typeof ws[ref].v === 'number') {
            ws[ref].z = '#,##0.00';
        }
    }

    // ─── Arkusz 2: METADATA ───
    const metaRows = [['KEY', 'VALUE']];
    metaRows.push(['offerId', offer.id]);
    metaRows.push(['number', offer.number]);
    metaRows.push(['date', offer.date]);
    metaRows.push(['clientName', offer.clientName || '']);
    metaRows.push(['clientNip', offer.clientNip || '']);
    metaRows.push(['clientAddress', offer.clientAddress || '']);
    metaRows.push(['clientContact', offer.clientContact || '']);
    metaRows.push(['investName', offer.investName || '']);
    metaRows.push(['investAddress', offer.investAddress || '']);
    metaRows.push(['notes', offer.notes || '']);
    metaRows.push([
        'paymentTerms',
        offer.paymentTerms || 'Do uzgodnienia lub według indywidualnych warunków handlowych.'
    ]);
    metaRows.push(['validity', offer.validity || '7 dni']);
    metaRows.push(['transportKm', offer.transportKm || 0]);
    metaRows.push(['transportRate', offer.transportRate || 0]);
    metaRows.push(['itemCount', offer.items.length]);

    offer.items.forEach((item, i) => {
        metaRows.push([`item_${i}`, JSON.stringify(item)]);
    });

    const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
    wsMeta['!cols'] = [{ wch: 15 }, { wch: 120 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Oferta');
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Dane');

    const safeNumber = offer.number.replace(/[/\\:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `Oferta_${safeNumber}_${offer.date}.xlsx`);
    showToast('Pobrano plik XLSX', 'success');
}

function importOfferFromXlsx() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.addEventListener('change', (e) => {
        const file = /** @type {HTMLInputElement} */ (e.target).files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = new Uint8Array(/** @type {ArrayBuffer} */ (ev.target.result));
                const wb = XLSX.read(data, { type: 'array' });

                const metaSheet = wb.Sheets['Dane'];
                if (metaSheet) {
                    const metaData = XLSX.utils.sheet_to_json(metaSheet, { header: 1 });
                    const meta = {};
                    metaData.forEach((row) => {
                        if (row[0] && row[0] !== 'KEY') meta[row[0]] = row[1];
                    });

                    const items = [];
                    const itemCount = parseInt(meta.itemCount) || 0;
                    for (let i = 0; i < itemCount; i++) {
                        const key = `item_${i}`;
                        if (meta[key]) {
                            try {
                                items.push(JSON.parse(meta[key]));
                            } catch (e) {
                                /* skip broken items */
                            }
                        }
                    }

                    const ofertaSheet = wb.Sheets['Oferta'];
                    if (ofertaSheet) {
                        const ofertaData = XLSX.utils.sheet_to_json(ofertaSheet, { header: 1 });

                        let headerRowIdx = -1;
                        for (let r = 0; r < ofertaData.length; r++) {
                            if (
                                ofertaData[r] &&
                                ofertaData[r][0] === 'Lp.' &&
                                String(ofertaData[r][5]).includes('Ilość')
                            ) {
                                headerRowIdx = r;
                                break;
                            }
                        }

                        if (headerRowIdx >= 0 && items.length > 0) {
                            for (let i = 0; i < items.length; i++) {
                                const row = ofertaData[headerRowIdx + 1 + i];
                                if (!row) continue;

                                const newQty = parseFloat(row[5]);
                                const newDiscount = parseFloat(row[7]);

                                if (!isNaN(newQty) && newQty >= 0) {
                                    items[i].quantity = newQty;
                                    if (items[i].lengthM) {
                                        items[i].meters = newQty * items[i].lengthM;
                                    }
                                }
                                if (!isNaN(newDiscount) && newDiscount >= 0 && newDiscount <= 100) {
                                    items[i].discount = newDiscount;
                                }
                            }
                        }
                    }

                    if (items.length === 0) {
                        showToast('Plik nie zawiera pozycji oferty', 'error');
                        return;
                    }

                    const transportKm = parseFloat(meta.transportKm) || 0;
                    const transportRate = parseFloat(meta.transportRate) || 0;
                    const transportCostPerTrip = transportKm * transportRate;
                    const transportResult = calculateTransports(items);
                    const transportDist = calculateTransportDistributionStandalone(
                        items,
                        transportCostPerTrip
                    );

                    let totalNetto = 0;
                    items.forEach((item) => {
                        const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
                        const tpu = transportDist[item.productId] || 0;
                        totalNetto += (priceAfterDiscount + tpu) * item.quantity;
                    });

                    const offer = {
                        id: meta.offerId || 'offer_' + Date.now(),
                        number: meta.number || 'XLSX-Import',
                        date: meta.date || new Date().toISOString().slice(0, 10),
                        clientName: meta.clientName || '',
                        clientNip: meta.clientNip || '',
                        clientAddress: meta.clientAddress || '',
                        clientContact: meta.clientContact || '',
                        investName: meta.investName || '',
                        investAddress: meta.investAddress || '',
                        notes: meta.notes || '',
                        paymentTerms:
                            meta.paymentTerms ||
                            'Do uzgodnienia lub według indywidualnych warunków handlowych.',
                        validity: meta.validity || '7 dni',
                        items,
                        transportKm,
                        transportRate,
                        transportCostPerTrip,
                        transportCount: transportResult.totalTransports,
                        transportCost: transportResult.totalTransports * transportCostPerTrip,
                        totalNetto,
                        totalBrutto: totalNetto * 1.23,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    const existingIdx = offers.findIndex((o) => o.id === offer.id);
                    if (existingIdx >= 0) {
                        if (
                            await appConfirm(`Oferta "${offer.number}" już istnieje. Nadpisać?`, {
                                title: 'Nadpisanie oferty',
                                type: 'warning'
                            })
                        ) {
                            offers[existingIdx] = offer;
                        } else {
                            return;
                        }
                    } else {
                        offers.push(offer);
                    }

                    saveOffersData(offers);
                    renderSavedOffers();
                    showToast(`Zaimportowano z XLSX: ${offer.number}`, 'success');
                } else {
                    showToast(
                        'Plik XLSX nie zawiera arkusza "Dane" — nie można zaimportować',
                        'error'
                    );
                }
            } catch (err) {
                logger.error('offerExports', err);
                showToast('Błąd odczytu pliku XLSX: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    });
    input.click();
}

if (typeof registerCspAction === 'function') {
    registerCspAction('exportOfferXlsx', {
        handler: function ({ offerId }) {
            exportOfferXlsx(offerId);
        },
        params: ['offerId']
    });
}
