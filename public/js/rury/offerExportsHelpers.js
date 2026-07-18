// @ts-check
/* ===== HELPERY EKSPORTU OFERT (RURY) ===== */
/* Pure functions do budowy wierszy arkuszy XLSX — wydzielone z offerExports.js */

/**
 * Buduje wiersze arkusza "Oferta" dla XLSX.
 * @param {object} offer
 * @param {object} transportDist
 * @param {number} costPerTrip
 * @param {number} xlsxTransports
 * @returns {{ rows: any[][], headerRow: number, totalNetto: number, totalWeight: number }}
 */
function buildOfferXlsxRows(offer, transportDist, costPerTrip, xlsxTransports) {
    const transportCost = xlsxTransports * costPerTrip;
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

    return { rows, headerRow, totalNetto, totalWeight };
}

/**
 * Buduje wiersze arkusza "Dane" (metadata) dla XLSX.
 * @param {object} offer
 * @returns {any[][]}
 */
function buildOfferXlsxMetaRows(offer) {
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

    return metaRows;
}
