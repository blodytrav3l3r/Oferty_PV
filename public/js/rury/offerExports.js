/* ===== EKSPORT / IMPORT OFERT (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: import/eksport PDF, XLSX, JSON, modal rabatów */
/* Zależności: offers, currentOfferItems, products, CATEGORIES (globalne) */
/* calculateTransports, calculateTransportDistributionStandalone z transport.js */
/* syncGaskets, renderOfferItems z offerItems.js */
/* updateOfferSummary z transport.js */
/* renderSavedOffers, saveOffersData z offerCrud.js / dataService.js */
/* fmt, fmtInt z shared/formatters.js; showToast, appConfirm, closeModal z shared/ui.js */

/* ===== IMPORT OFERTY Z PLIKU JSON ===== */

function importOfferFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.multiple = true;
    input.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        let imported = 0;
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const offer = JSON.parse(ev.target.result);
                    if (!offer.number || !offer.items || !Array.isArray(offer.items)) {
                        showToast(`Plik ${file.name} nie zawiera poprawnej oferty`, 'error');
                        return;
                    }
                    // Check if offer with same id already exists
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
                    imported++;
                    saveOffersData(offers);
                    renderSavedOffers();
                    showToast(`Zaimportowano: ${offer.number}`, 'success');
                } catch (err) {
                    showToast(`Błąd odczytu pliku ${file.name}`, 'error');
                }
            };
            reader.readAsText(file);
        });
    });
    input.click();
}

/* ===== EKSPORT PDF ===== */

function exportOfferPDF(id) {
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;

    let totalNetto = 0,
        totalWeight = 0;
    const costPerTrip = offer.transportCostPerTrip || 0;

    // Przelicz transport dla PDF
    const transportResult = calculateTransports(offer.items);
    const transportCost = transportResult.totalTransports * costPerTrip;
    const transportDist = calculateTransportDistributionStandalone(offer.items, costPerTrip);

    offer.items.forEach((item) => {
        const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const transportPerUnit = transportDist[item.productId] || 0;
        totalNetto += (priceAfterDiscount + transportPerUnit) * item.quantity;
        totalWeight += (item.weight || 0) * item.quantity;
    });

    const totalVat = totalNetto * 0.23;
    const totalBrutto = totalNetto + totalVat;

    // HTML tabeli transportu
    let transportHtml = '';
    if (transportResult.lines.length > 0) {
        transportHtml = `<h3 style="font-size:13px;color:#2d3561;margin-top:18px;margin-bottom:6px">🚚 Transport (max 24 000 kg / kurs)</h3>
    <table><thead><tr><th>Produkt</th><th class="text-right">Ilość</th><th class="text-right">Waga/szt</th><th class="text-right">Łączna waga</th><th class="text-right">Max/transport</th><th class="text-right">Transporty</th></tr></thead><tbody>`;
        transportResult.lines.forEach((l) => {
            transportHtml += `<tr><td>${l.name}</td><td class="text-right">${l.quantity}</td><td class="text-right">${fmtInt(l.weightPerPiece)} kg</td><td class="text-right">${fmtInt(l.totalWeight)} kg</td><td class="text-right">${l.maxPerTransport}</td><td class="text-right" style="font-weight:bold">${l.dedicatedTransports}</td></tr>`;
        });
        transportHtml += `</tbody></table>`;
        if (transportResult.saved > 0) {
            transportHtml += `<div style="font-size:11px;color:#059669;margin-top:4px">Optymalizacja: połączono niepełne transporty (${transportResult.lines.reduce((s, l) => s + l.dedicatedTransports, 0)} → ${transportResult.totalTransports})</div>`;
        }
    }

    const printWin = window.open('', '_blank');
    printWin.document
        .write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Oferta ${offer.number}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#1a1a2e;padding:30px;font-size:13px;line-height:1.5}
    h1{font-size:20px;color:#2d3561;margin-bottom:5px}
    .header-line{border-bottom:3px solid #2d3561;padding-bottom:10px;margin-bottom:15px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}
    .info-box{background:#f4f6fb;border-radius:6px;padding:12px}
    .info-box h3{font-size:12px;color:#6b7280;text-transform:uppercase;margin-bottom:5px}
    table{width:100%;border-collapse:collapse;margin:15px 0;font-size:12px}
    th{background:#2d3561;color:#fff;padding:8px;text-align:left;font-size:11px}
    td{padding:7px 8px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even){background:#f9fafb}
    .text-right{text-align:right}
    .summary{background:#f0f4ff;border-radius:6px;padding:15px;margin-top:15px}
    .summary-row{display:flex;justify-content:space-between;padding:4px 0}
    .summary-row.total{font-weight:bold;font-size:15px;border-top:2px solid #2d3561;padding-top:8px;margin-top:5px}
    .summary-row.transport{color:#b45309}
    .notes{margin-top:15px;padding:10px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;font-size:12px}
    .footer{margin-top:10px;font-size:11px;color:#6b7280;text-align:center;padding-top:10px}
    .letterhead-header { width: 100%; object-fit: contain; margin-bottom: 20px; display: block; }
    .letterhead-footer { width: 100%; object-fit: contain; margin-top: 20px; display: block; page-break-inside: avoid; }
  </style></head><body>
  <img src="${window.location.origin}/templates/naglowek.png" class="letterhead-header" onload="window._hLoaded=true" onerror="window._hLoaded=true" />
  <div class="header-line" style="margin-top:20px;">
    <h1>OFERTA HANDLOWA</h1>
    <div style="display:flex;justify-content:space-between">
      <span><strong>Nr:</strong> ${offer.number}</span>
      <span><strong>Data:</strong> ${offer.date}</span>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box"><h3>Dane klienta</h3>
      ${offer.clientName ? `<div><strong>${offer.clientName}</strong></div>` : ''}
      ${offer.clientNip ? `<div>NIP: ${offer.clientNip}</div>` : ''}
      ${offer.clientAddress ? `<div>${offer.clientAddress}</div>` : ''}
      ${offer.clientContact ? `<div>Kontakt: ${offer.clientContact}</div>` : ''}
      ${offer.investName ? `<div style="margin-top:6px"><strong>Inwestycja:</strong> ${offer.investName}</div>` : ''}
      ${offer.investAddress ? `<div>Adres inwestycji: ${offer.investAddress}</div>` : ''}
    </div>
    <div class="info-box"><h3>Podsumowanie</h3>
      <div>Pozycji: ${offer.items.length}</div>
      <div>Łączna waga: ${fmtInt(totalWeight)} kg</div>
      <div>Transportów: ${transportResult.totalTransports}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Lp.</th><th>Indeks</th><th>Nazwa</th><th class="text-right">Cena jedn.</th><th class="text-right">Rabat</th><th class="text-right">Po rabacie</th><th class="text-right">Transport/szt.</th><th class="text-right">Ilość</th><th class="text-right">Netto</th><th class="text-right">Brutto</th></tr></thead>
    <tbody>${offer.items
        .map((item, i) => {
            const pad = item.unitPrice * (1 - item.discount / 100) + (item.pehdCostPerUnit || 0);
            const tpu = transportDist[item.productId] || 0;
            const unitTotal = pad + tpu;
            const n = unitTotal * item.quantity;

            let pName = item.name;
            if (item.pehdType === 'PEHD-3MM') pName += ' + PEHD 3mm';
            if (item.pehdType === 'PEHD-4MM') pName += ' + PEHD 4mm';

            return `<tr><td>${i + 1}</td><td>${item.productId}</td><td>${pName}${item.autoAdded ? ' (uszczelka)' : ''}</td><td class="text-right">${fmt(item.unitPrice)}</td><td class="text-right">${item.discount}%</td><td class="text-right">${fmt(unitTotal)}</td><td class="text-right">${tpu > 0 ? fmt(tpu) : '—'}</td><td class="text-right">${item.quantity}</td><td class="text-right">${fmt(n)}</td><td class="text-right">${fmt(n * 1.23)}</td></tr>`;
        })
        .join('')}</tbody>
  </table>
  ${transportHtml}
  <div class="summary">
    <div class="summary-row"><span>RAZEM netto (produkty + transport):</span><span>${fmt(totalNetto)} PLN</span></div>
    ${costPerTrip > 0 ? `<div class="summary-row transport"><span>w tym transport: ${offer.transportKm || '?'} km × ${fmt(offer.transportRate || 0)} PLN/km = ${fmt(costPerTrip)} PLN/kurs × ${transportResult.totalTransports} kursów</span><span>${fmt(transportCost)} PLN</span></div>` : ''}
    <div class="summary-row"><span>RAZEM netto:</span><span>${fmt(totalNetto)} PLN</span></div>
    <div class="summary-row"><span>VAT (23%):</span><span>${fmt(totalVat)} PLN</span></div>
    <div class="summary-row total"><span>SUMA BRUTTO:</span><span>${fmt(totalBrutto)} PLN</span></div>
  </div>
  ${offer.notes ? `<div class="notes"><strong>Uwagi:</strong> ${offer.notes}</div>` : ''}
  <div style="margin-top: 15px; font-size: 11px;">
    <strong>Warunki płatności:</strong> ${offer.paymentTerms || 'Do uzgodnienia lub według indywidualnych warunków handlowych.'}<br>
    <strong>Data ważności oferty:</strong> ${offer.validity || '7 dni'}
  </div>
  <img src="${window.location.origin}/templates/stopka.png" class="letterhead-footer" onload="window._fLoaded=true" onerror="window._fLoaded=true" />
  <div class="footer">Oferta wygenerowana automatycznie • WITROS</div>
  </body></html>`);
    printWin.document.close();
    let rounds = 0;
    const checkInterval = setInterval(() => {
        rounds++;
        if ((printWin._hLoaded && printWin._fLoaded) || rounds > 15) {
            clearInterval(checkInterval);
            printWin.print();
        }
    }, 100);
}

/* ===== MODAL RABATU NA POZIOMIE POZYCJI ===== */
let tempDiscounts = [];

function showItemDiscountModal() {
    if (currentOfferItems.length === 0) {
        showToast('Brak produktów w ofercie.', 'error');
        return;
    }

    // Utwórz płytką kopię bieżących rabatów
    tempDiscounts = currentOfferItems.map((item) => item.discount || 0);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'item-discount-modal';

    overlay.innerHTML = `
    <div class="modal" style="max-width:1200px; width:95%; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding-bottom: 0.8rem; margin-bottom: 0.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">% Edytuj rabaty pozycji</h3>
        <button class="btn-icon" onclick="closeModal()">✕</button>
      </div>
      
      <div style="overflow-y:auto; flex:1; padding-right:0.5rem;" id="discount-modal-list">
        <!-- JS wypełni to miejsce -->
      </div>

      <div class="modal-footer" style="margin-top:1rem; border-top: 1px solid var(--border); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <div style="text-align:left;">
          <div style="font-size:0.9rem; color:var(--text-muted);">Suma Netto (po rabatach):</div>
          <div id="discount-modal-total" style="font-size:1.4rem; font-weight:800; color:var(--success);">0,00 PLN</div>
        </div>
        <div style="display:flex; gap: 1rem;">
          <button class="btn btn-secondary" onclick="closeModal()" style="padding: 0.75rem 1.5rem;">Anuluj</button>
          <button class="btn btn-primary" onclick="applyItemDiscounts()" style="padding: 0.75rem 2rem; font-size:1.05rem; font-weight: 600;">Zastosuj ➔</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    renderDiscountModalItems();
}

function renderDiscountModalItems() {
    const container = document.getElementById('discount-modal-list');
    if (!container) return;

    let html = `<table style="width:100%; text-align:left; border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:1px solid var(--border); font-size:0.75rem; color:var(--text-muted);">
        <th style="padding:0.4rem; width:50%;">Produkt</th>
        <th style="padding:0.4rem; width:15%; text-align:center;">Rabat (%)</th>
        <th style="padding:0.4rem; width:15%; text-align:right;">Cena jedn. po rabacie</th>
        <th style="padding:0.4rem; width:20%; text-align:right;">Wartość Netto</th>
      </tr>
    </thead>
    <tbody>`;

    let totalNetto = 0;

    // Zbuduj posortowaną listę pasującą do kolejności w tabeli oferty
    const sortedItems = currentOfferItems
        .map((item, index) => {
            const product = products.find((p) => p.id === item.productId);
            const category = product ? product.category : 'Inne';
            const catOrder = CATEGORIES.indexOf(category);
            const diameter = getProductDiameter(item.productId) || 99999;
            const isBB =
                item.name.toLowerCase().includes('bosy') || item.productId.endsWith('-B00');
            return {
                item,
                index,
                catOrder: catOrder === -1 ? 999 : catOrder,
                diameter,
                isBB,
                lengthM: item.lengthM || 0
            };
        })
        .sort((a, b) => {
            if (a.catOrder !== b.catOrder) return a.catOrder - b.catOrder;
            if (a.diameter !== b.diameter) return a.diameter - b.diameter;
            if (a.isBB !== b.isBB) return a.isBB ? -1 : 1;
            return a.lengthM - b.lengthM;
        });

    sortedItems.forEach(({ item, index }) => {
        const d = tempDiscounts[index];
        const basePriceAfterDiscount = item.unitPrice * (1 - d / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const priceAfterDiscount = basePriceAfterDiscount + pehdCost;
        const netto = priceAfterDiscount * item.quantity;

        totalNetto += netto;

        let pName = item.name;
        if (item.pehdType === 'PEHD-3MM')
            pName +=
                ' <span style="display:inline-block; font-size:0.65rem; padding:0.15rem 0.4rem; background:#10b981; color:white; border-radius:4px; font-weight:700; box-shadow:0 0 8px rgba(16,185,129,0.3); vertical-align:middle;">+ PEHD 3mm</span>';
        if (item.pehdType === 'PEHD-4MM')
            pName +=
                ' <span style="display:inline-block; font-size:0.65rem; padding:0.15rem 0.4rem; background:#10b981; color:white; border-radius:4px; font-weight:700; box-shadow:0 0 8px rgba(16,185,129,0.3); vertical-align:middle;">+ PEHD 4mm</span>';
        if (item.autoAdded)
            pName += ' <span style="font-size:.65rem;color:var(--warn);opacity:.8">(auto)</span>';

        const isGasket =
            item.autoAdded ||
            item.name.toLowerCase().includes('uszczelk') ||
            (item.productId && item.productId.includes('Y-U-GZ-U'));
        const warningText = isGasket
            ? '<div style="font-size:0.65rem; color:var(--danger); font-weight:700; margin-top:4px; line-height:1.2;">Uwaga rabat<br>na uszczelki !</div>'
            : '';

        html += `
      <tr style="border-bottom:1px solid var(--border-glass);">
        <td style="padding:0.4rem; font-size:0.8rem; font-weight:500;">
          ${pName} <br>
          <span style="font-size:0.7rem; color:var(--text-muted);">Ilość: ${item.quantity}</span>
        </td>
        <td style="padding:0.4rem; text-align:center; vertical-align:middle;">
          <input type="number" step="0.5" min="0" max="100" value="${d}" 
            onfocus="this.select()"
            oninput="updateTempDiscount(${index}, this)"
            onchange="checkGasketDiscount(${index}, this)"
            style="width:65px; padding:0.3rem; text-align:center; border:1px solid var(--border); border-radius:4px; font-weight:700; color:var(--primary); background:var(--bg);">
          ${warningText}
        </td>
        <td id="modal-price-${index}" style="padding:0.4rem; text-align:right; font-size:0.8rem;">${fmt(priceAfterDiscount)} PLN</td>
        <td id="modal-netto-${index}" style="padding:0.4rem; text-align:right; font-weight:700; color:var(--text-primary); font-size:0.9rem;">${fmt(netto)} PLN</td>
      </tr>
    `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    const totalEl = document.getElementById('discount-modal-total');
    if (totalEl) totalEl.textContent = `${fmt(totalNetto)} PLN`;
}

function updateTempDiscount(index, inputEl) {
    let val = inputEl.value;
    let v = parseFloat(val);
    if (isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 100) {
        v = 100;
        inputEl.value = 100;
    }
    tempDiscounts[index] = v;

    // Aktualizacja DOM na żywo dla tego konkretnego wiersza
    const item = currentOfferItems[index];

    const basePriceAfterDiscount = item.unitPrice * (1 - v / 100);
    const pehdCost = item.pehdCostPerUnit || 0;
    const priceAfterDiscount = basePriceAfterDiscount + pehdCost;
    const netto = priceAfterDiscount * item.quantity;

    const priceTd = document.getElementById(`modal-price-${index}`);
    const nettoTd = document.getElementById(`modal-netto-${index}`);
    if (priceTd) priceTd.textContent = `${fmt(priceAfterDiscount)} PLN`;
    if (nettoTd) nettoTd.textContent = `${fmt(netto)} PLN`;

    // Przelicz i zaktualizuj sumę końcową
    let totalNetto = 0;
    currentOfferItems.forEach((it, idx) => {
        const d = tempDiscounts[idx];
        const bpad = it.unitPrice * (1 - d / 100);
        const pCost = it.pehdCostPerUnit || 0;
        totalNetto += (bpad + pCost) * it.quantity;
    });

    const totalEl = document.getElementById('discount-modal-total');
    if (totalEl) totalEl.textContent = `${fmt(totalNetto)} PLN`;
}

function checkGasketDiscount(index, inputEl) {
    const item = currentOfferItems[index];
    const v = parseFloat(inputEl.value) || 0;
    const isGasket =
        item.autoAdded ||
        item.name.toLowerCase().includes('uszczelk') ||
        (item.productId && item.productId.includes('Y-U-GZ-U'));
    if (isGasket && v > 0) {
        showToast('UWAGA! Wpisujesz rabat na uszczelki!', 'warning');
    }
}

function applyItemDiscounts() {
    currentOfferItems.forEach((item, index) => {
        item.discount = tempDiscounts[index];
    });

    closeModal();
    syncGaskets();
    renderOfferItems();
    updateOfferSummary();
    showToast('Zaktualizowano rabaty dla wybranych pozycji', 'success');
}

/* ===== EKSPORT XLSX ===== */

function exportOfferXlsx(id) {
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;

    const costPerTrip = offer.transportCostPerTrip || 0;
    const transportResult = calculateTransports(offer.items);
    const transportDist = calculateTransportDistributionStandalone(offer.items, costPerTrip);
    const transportCost = transportResult.totalTransports * costPerTrip;

    // ─── Sheet 1: OFERTA ───
    const rows = [];

    // Sekcja nagłówka
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
    rows.push(['Koszt/kurs:', costPerTrip, 'Ilość kursów:', transportResult.totalTransports]);
    rows.push([]);

    // Items table header
    const headerRow = 18;
    rows.push([
        'Lp.',
        'Indeks',
        'Nazwa produktu',
        'PEHD',
        'Cena jedn.',
        'Ilość ✏️',
        'Metry',
        'Rabat % ✏️',
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
        if (item.autoAdded) pName += ' (uszczelka)';

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

    // Wiersze podsumowania
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

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Szerokości kolumn
    ws['!cols'] = [
        { wch: 5 }, { wch: 20 }, { wch: 55 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }, { wch: 10 }
    ];

    // Formatowanie liczb dla kolumn walutowych
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

    // Formatuj liczby w podsumowaniu
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

    // Zapisz pełne dane pozycji jako JSON dla bezstratnego ponownego importu
    offer.items.forEach((item, i) => {
        metaRows.push([`item_${i}`, JSON.stringify(item)]);
    });

    const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
    wsMeta['!cols'] = [{ wch: 15 }, { wch: 120 }];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Oferta');
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Dane');

    // Download
    const safeNumber = offer.number.replace(/[/\\:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `Oferta_${safeNumber}_${offer.date}.xlsx`);
    showToast('Pobrano plik XLSX', 'success');
}

/* ===== IMPORT XLSX ===== */

function importOfferFromXlsx() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = new Uint8Array(ev.target.result);
                const wb = XLSX.read(data, { type: 'array' });

                // Najpierw spróbuj znaleźć arkusz metadanych (bezstratny import)
                const metaSheet = wb.Sheets['Dane'];
                if (metaSheet) {
                    const metaData = XLSX.utils.sheet_to_json(metaSheet, { header: 1 });
                    const meta = {};
                    metaData.forEach((row) => {
                        if (row[0] && row[0] !== 'KEY') meta[row[0]] = row[1];
                    });

                    // Odczytaj pozycje z metadanych (pełny cykl JSON)
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

                    // Teraz sprawdź arkusz Oferta pod kątem edycji ilości i rabatu przez użytkownika
                    const ofertaSheet = wb.Sheets['Oferta'];
                    if (ofertaSheet) {
                        const ofertaData = XLSX.utils.sheet_to_json(ofertaSheet, { header: 1 });

                        // Znajdź wiersz nagłówka
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
                            // Odczytaj edytowane wartości z arkusza kalkulacyjnego
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

                    // Sprawdź duplikaty
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
                console.error(err);
                showToast('Błąd odczytu pliku XLSX: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    });
    input.click();
}
