// @ts-check
/* ===== HELPERY EKSPORTU OFERT (RURY) ===== */
/* Pure functions do budowy wierszy arkuszy XLSX — wydzielone z offerExports.js */

// SSoT zaokrągleń: shared/formatters.js → roundMoney (2 miejsca, half-up).
// Fallback wyłącznie dla sandboxów vm/testów bez formatters.js.
const _moneyRoundXlsx =
    typeof roundMoney === 'function'
        ? roundMoney
        : (/** @type {number} */ v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return 0;
              if (Math.abs(n) >= 1e21) return n;
              const [mantissa, exponent = '0'] = Math.abs(n).toString().split('e');
              return (
                  (n < 0 ? -1 : 1) *
                  (Math.round(Number(`${mantissa}e${Number(exponent) + 2}`)) / 100)
              );
          };

function getOfferTransportPresentation(item, transportAllocation) {
    const allocation = (transportAllocation?.items || []).find(
        (entry) => entry.itemUid === item.uid
    );
    const totalCents = Number(allocation?.totalCents) || 0;
    const segments = Array.isArray(allocation?.segments) ? allocation.segments : [];
    const baseUnit = _moneyRoundXlsx(
        Number(item.unitPrice || item.price || 0) * (1 - (Number(item.discount) || 0) / 100) +
            (Number(item.pehdCostPerUnit) || 0) +
            (Number(item.surcharge) || 0)
    );
    const baseUnitCents = Math.round(baseUnit * 100);
    const segmentsValid =
        Number.isInteger(Number(item.quantity)) &&
        segments.length > 0 &&
        segments.every(
            (segment) =>
                Number.isInteger(Number(segment.quantity)) &&
                Number.isInteger(Number(segment.transportCentsPerUnit))
        ) &&
        segments.reduce((sum, segment) => sum + segment.quantity, 0) === Number(item.quantity) &&
        segments.reduce(
            (sum, segment) => sum + segment.quantity * segment.transportCentsPerUnit,
            0
        ) === totalCents;
    const rows = segmentsValid
        ? segments.map((segment) => ({
              quantity: segment.quantity,
              transportCentsPerUnit: segment.transportCentsPerUnit,
              unitPriceCents: baseUnitCents + segment.transportCentsPerUnit,
              lineCents: (baseUnitCents + segment.transportCentsPerUnit) * segment.quantity,
              isTransportAdjustment: false
          }))
        : [
              {
                  quantity: Number(item.quantity) || 0,
                  transportCentsPerUnit: 0,
                  unitPriceCents: baseUnitCents,
                  lineCents: Math.round(
                      _moneyRoundXlsx((baseUnitCents * (Number(item.quantity) || 0)) / 100) * 100
                  ),
                  isTransportAdjustment: false
              },
              ...(totalCents > 0
                  ? [
                        {
                            quantity: 1,
                            transportCentsPerUnit: totalCents,
                            unitPriceCents: totalCents,
                            lineCents: totalCents,
                            isTransportAdjustment: true
                        }
                    ]
                  : [])
          ];
    return {
        rows,
        totalNettoCents: rows.reduce((sum, row) => sum + row.lineCents, 0),
        totalTransportCents: totalCents,
        segmentsValid
    };
}

/**
 * Buduje wiersze arkusza "Oferta" dla XLSX.
 * @param {object} offer
 * @param {object} transportAllocation
 * @param {number} costPerTrip
 * @param {number} xlsxTransports
 * @returns {{ rows: any[][], headerRow: number, totalNetto: number, totalWeight: number, itemRowMap: Record<number, number[]> }}
 */
function buildOfferXlsxRows(offer, transportAllocation, costPerTrip, xlsxTransports) {
    const transportCost =
        offer.transportSeparate && offer.externalTransportCost != null
            ? Number(offer.externalTransportCost)
            : xlsxTransports * costPerTrip;
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
    /** @type {Record<number, number[]>} */
    const itemRowMap = {};

    offer.items.forEach((item, i) => {
        const presentation = getOfferTransportPresentation(item, transportAllocation);
        const unitAfterDiscount = _moneyRoundXlsx(
            Number(item.unitPrice || item.price || 0) * (1 - (Number(item.discount) || 0) / 100) +
                (Number(item.pehdCostPerUnit) || 0) +
                (Number(item.surcharge) || 0)
        );
        const displayRows = presentation.rows;
        itemRowMap[i] = [];
        totalWeight += (item.weight || 0) * item.quantity;

        let pName = item.name;
        let pehdLabel = '';
        if (item.pehdType === 'PEHD-3MM') pehdLabel = 'PEHD 3mm';
        if (item.pehdType === 'PEHD-4MM') pehdLabel = 'PEHD 4mm';
        if (item.autoAdded) pName += ' (dodane automatycznie)';

        displayRows.forEach((displayRow) => {
            const segmentNetto = _moneyRoundXlsx(displayRow.lineCents / 100);
            totalNetto += segmentNetto;
            if (!displayRow.isTransportAdjustment) itemRowMap[i].push(rows.length);
            rows.push([
                displayRow.isTransportAdjustment ? '' : i + 1,
                displayRow.isTransportAdjustment ? 'TR-RURY' : item.productId,
                displayRow.isTransportAdjustment ? `Transport wliczony w cenę — ${pName}` : pName,
                displayRow.isTransportAdjustment ? '' : pehdLabel,
                displayRow.isTransportAdjustment ? '' : item.unitPrice,
                displayRow.quantity,
                displayRow.isTransportAdjustment
                    ? ''
                    : item.meters
                      ? (item.meters / item.quantity) * displayRow.quantity
                      : 0,
                displayRow.isTransportAdjustment ? '' : item.discount,
                displayRow.isTransportAdjustment ? '' : unitAfterDiscount,
                displayRow.isTransportAdjustment
                    ? 'kwota pozycji'
                    : displayRow.transportCentsPerUnit > 0
                      ? displayRow.transportCentsPerUnit / 100
                      : '',
                segmentNetto,
                _moneyRoundXlsx(segmentNetto * 1.23),
                displayRow.isTransportAdjustment ? '' : item.weight || ''
            ]);
        });
    });

    // Osobna pozycja: koszt nie siedzi w cenach jednostkowych — dolicz raz do sumy.
    if (offer.transportSeparate) totalNetto += _moneyRoundXlsx(transportCost);
    totalNetto = _moneyRoundXlsx(totalNetto);

    const totalVat = _moneyRoundXlsx(totalNetto * 0.23);
    const totalBrutto = _moneyRoundXlsx(totalNetto + totalVat);

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

    return { rows, headerRow, totalNetto, totalWeight, itemRowMap };
}

/**
 * Buduje wiersze arkusza "Dane" (metadata) dla XLSX.
 * @param {object} offer
 * @param {Record<number, number[]>} [itemRowMap]
 * @returns {any[][]}
 */
function buildOfferXlsxMetaRows(offer, itemRowMap = /** @type {Record<number, number[]>} */ ({})) {
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
    metaRows.push(['investStreet', offer.investStreet || '']);
    metaRows.push(['investPostalCode', offer.investPostalCode || '']);
    metaRows.push(['investCity', offer.investCity || '']);
    metaRows.push(['investCountry', offer.investCountry || 'PL']);
    metaRows.push(['investLocationDescription', offer.investLocationDescription || '']);
    metaRows.push(['investContacts', JSON.stringify(offer.investContacts || [])]);
    metaRows.push(['notes', offer.notes || '']);
    metaRows.push([
        'paymentTerms',
        offer.paymentTerms || 'Do uzgodnienia lub według indywidualnych warunków handlowych.'
    ]);
    metaRows.push(['validity', offer.validity || '7 dni']);
    metaRows.push(['transportKm', offer.transportKm || 0]);
    metaRows.push(['transportRate', offer.transportRate || 0]);
    metaRows.push(['transportMode', offer.transportMode || 'full']);
    metaRows.push(['transportSeparate', offer.transportSeparate ? '1' : '0']);
    if (offer.transportAllocation) {
        metaRows.push(['transportAllocation', JSON.stringify(offer.transportAllocation)]);
    }
    metaRows.push(['itemRowMap', JSON.stringify(itemRowMap)]);
    if (offer.externalTransportCost != null) {
        metaRows.push(['externalTransportCost', offer.externalTransportCost]);
        metaRows.push(['transportCount', offer.transportCount]);
    }
    metaRows.push(['itemCount', offer.items.length]);

    offer.items.forEach((item, i) => {
        metaRows.push([`item_${i}`, JSON.stringify(item)]);
    });

    return metaRows;
}

/* ===== Rejestracja globali ===== */
window.buildOfferXlsxRows = buildOfferXlsxRows;
window.buildOfferXlsxMetaRows = buildOfferXlsxMetaRows;
window.getOfferTransportPresentation = getOfferTransportPresentation;
