// @ts-check
/* ===== EKSPORT / IMPORT OFERT — PDF I JSON ===== */
/* Wydzielone z offerExports.js */
/* Zależności: offers (globalne) */
/* calculateTransports, calculateTransportDistributionStandalone z transport.js */
/* saveOffersData z dataService.js; renderSavedOffers z offerCrudLoad.js */
/* showToast, appConfirm z shared/ui.js; fmt, fmtInt, escapeHtml z shared/formatters.js */

function importOfferFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.multiple = true;
    input.addEventListener('change', (e) => {
        const files = Array.from(/** @type {HTMLInputElement} */ (e.target).files);
        if (!files.length) return;
        let imported = 0;
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const offer = JSON.parse(/** @type {string} */ (ev.target.result));
                    if (!offer.number || !offer.items || !Array.isArray(offer.items)) {
                        showToast(`Plik ${file.name} nie zawiera poprawnej oferty`, 'error');
                        return;
                    }
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

function exportOfferPDF(id) {
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;

    let totalNetto = 0,
        totalWeight = 0;
    const costPerTrip = offer.transportCostPerTrip || 0;

    const transportResult = calculateTransports(offer.items);
    const offerMode = offer.transportMode || 'full';
    const exportTransports =
        offerMode === 'fractional'
            ? offer.items
                  .filter((i) => !i.autoAdded && i.weight && i.weight > 0 && i.quantity > 0)
                  .reduce((s, i) => s + i.weight * i.quantity, 0) / MAX_TRANSPORT_WEIGHT
            : transportResult.totalTransports;
    const transportCost = exportTransports * costPerTrip;
    const transportDist = calculateTransportDistributionStandalone(offer.items, costPerTrip);

    offer.items.forEach((item) => {
        const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const transportPerUnit = transportDist[item.productId] || 0;
        totalNetto += (priceAfterDiscount + transportPerUnit) * item.quantity;
        totalWeight += (item.weight || 0) * item.quantity;
    });

    const totalVat = totalNetto * 0.23;
    const totalBrutto = totalNetto + totalVat;

    let transportHtml = '';
    if (transportResult.lines.length > 0) {
        transportHtml = `<h3 style="font-size:13px;color:#2d3561;margin-top:18px;margin-bottom:6px"><i data-lucide="truck"></i> Transport (max 24 000 kg / kurs)</h3>
    <table><thead><tr><th>Produkt</th><th class="text-right">Ilość</th><th class="text-right">Waga/szt</th><th class="text-right">Łączna waga</th><th class="text-right">Max/transport</th><th class="text-right">Transporty</th></tr></thead><tbody>`;
        transportResult.lines.forEach((l) => {
            transportHtml += `<tr><td>${escapeHtml(l.name)}</td><td class="text-right">${l.quantity}</td><td class="text-right">${fmtInt(l.weightPerPiece)} kg</td><td class="text-right">${fmtInt(l.totalWeight)} kg</td><td class="text-right">${l.maxPerTransport}</td><td class="text-right" style="font-weight:bold">${l.dedicatedTransports}</td></tr>`;
        });
        transportHtml += `</tbody></table>`;
        if (transportResult.saved > 0 && offerMode !== 'fractional') {
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
    .notes{margin-top:15px;padding:10px;background:#fffbeb;border-left:3px solid var(--warn);border-radius:4px;font-size:12px}
    .footer{margin-top:10px;font-size:11px;color:#6b7280;text-align:center;padding-top:10px}
    .letterhead-header { width: 100%; object-fit: contain; margin-bottom: 20px; display: block; }
    .letterhead-footer { width: 100%; object-fit: contain; margin-top: 20px; display: block; page-break-inside: avoid; }
  </style></head><body>
  <img src="${window.location.origin}/images/letterhead-header.png" class="letterhead-header" />
  <div class="header-line" style="margin-top:20px;">
    <h1>OFERTA HANDLOWA</h1>
    <div style="display:flex;justify-content:space-between">
      <span><strong>Nr:</strong> ${offer.number}</span>
      <span><strong>Data:</strong> ${offer.date}</span>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box"><h3>Dane klienta</h3>
      ${offer.clientName ? `<div><strong>${escapeHtml(offer.clientName)}</strong></div>` : ''}
      ${offer.clientNip ? `<div>NIP: ${escapeHtml(offer.clientNip)}</div>` : ''}
      ${offer.clientAddress ? `<div>${escapeHtml(offer.clientAddress)}</div>` : ''}
      ${offer.clientContact ? `<div>Kontakt: ${escapeHtml(offer.clientContact)}</div>` : ''}
      ${offer.investName ? `<div style="margin-top:6px"><strong>Inwestycja:</strong> ${escapeHtml(offer.investName)}</div>` : ''}
      ${offer.investAddress ? `<div>Adres inwestycji: ${escapeHtml(offer.investAddress)}</div>` : ''}
    </div>
    <div class="info-box"><h3>Podsumowanie</h3>
      <div>Pozycji: ${offer.items.length}</div>
      <div>Łączna waga: ${fmtInt(totalWeight)} kg</div>
      <div>Transportów: ${typeof formatTransportCount === 'function' ? formatTransportCount(exportTransports, offerMode) : transportResult.totalTransports}</div>
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

            let pName = escapeHtml(item.name);
            if (item.pehdType === 'PEHD-3MM') pName += ' + PEHD 3mm';
            if (item.pehdType === 'PEHD-4MM') pName += ' + PEHD 4mm';

            return `<tr><td>${i + 1}</td><td>${escapeHtml(item.productId)}</td><td>${pName}</td><td class="text-right">${fmt(item.unitPrice)}</td><td class="text-right">${item.discount}%</td><td class="text-right">${fmt(unitTotal)}</td><td class="text-right">${tpu > 0 ? fmt(tpu) : '—'}</td><td class="text-right">${item.quantity}</td><td class="text-right">${fmt(n)}</td><td class="text-right">${fmt(n * 1.23)}</td></tr>`;
        })
        .join('')}</tbody>
  </table>
  ${transportHtml}
  <div class="summary">
    <div class="summary-row"><span>RAZEM netto (produkty + transport):</span><span>${fmt(totalNetto)} PLN</span></div>
    ${costPerTrip > 0 ? `<div class="summary-row transport"><span>w tym transport: ${offer.transportKm || '?'} km × ${fmt(offer.transportRate || 0)} PLN/km = ${fmt(costPerTrip)} PLN/kurs × ${typeof formatTransportCount === 'function' ? formatTransportCount(exportTransports, offerMode) : transportResult.totalTransports} kursów</span><span>${fmt(transportCost)} PLN</span></div>` : ''}
    <div class="summary-row"><span>RAZEM netto:</span><span>${fmt(totalNetto)} PLN</span></div>
    <div class="summary-row"><span>VAT (23%):</span><span>${fmt(totalVat)} PLN</span></div>
    <div class="summary-row total"><span>SUMA BRUTTO:</span><span>${fmt(totalBrutto)} PLN</span></div>
  </div>
  ${offer.notes ? `<div class="notes"><strong>Uwagi:</strong> ${escapeHtml(offer.notes)}</div>` : ''}
  <div style="margin-top: 15px; font-size: 11px;">
    <strong>Warunki płatności:</strong> ${offer.paymentTerms || 'Do uzgodnienia lub według indywidualnych warunków handlowych.'}<br>
    <strong>Data ważności oferty:</strong> ${offer.validity || '7 dni'}
  </div>
  <img src="${window.location.origin}/images/letterhead-footer.png" class="letterhead-footer" />
  <div class="footer">Oferta wygenerowana automatycznie • WITROS</div>
  </body></html>`);
    printWin.document.close();
    const hdr = /** @type {HTMLImageElement} */ (
        printWin.document.querySelector('.letterhead-header')
    );
    const ftr = /** @type {HTMLImageElement} */ (
        printWin.document.querySelector('.letterhead-footer')
    );
    if (hdr) {
        if (hdr.complete && hdr.naturalWidth > 0) {
            printWin._hLoaded = true;
        } else {
            hdr.onload = function () {
                printWin._hLoaded = true;
            };
            hdr.onerror = function () {
                printWin._hLoaded = true;
            };
        }
    }
    if (ftr) {
        if (ftr.complete && ftr.naturalWidth > 0) {
            printWin._fLoaded = true;
        } else {
            ftr.onload = function () {
                printWin._fLoaded = true;
            };
            ftr.onerror = function () {
                printWin._fLoaded = true;
            };
        }
    }
    let rounds = 0;
    const checkInterval = setInterval(() => {
        rounds++;
        if ((printWin._hLoaded && printWin._fLoaded) || rounds > 15) {
            clearInterval(checkInterval);
            printWin.print();
        }
    }, 100);
}

if (typeof registerCspAction === 'function') {
    registerCspAction('exportOfferPDF', {
        handler: function ({ offerId }) {
            exportOfferPDF(offerId);
        },
        params: ['offerId']
    });
}
