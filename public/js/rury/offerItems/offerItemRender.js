// @ts-check
/* ===== POZYCJE OFERTY — RENDEROWANIE I EDYCJA ===== */
/* Wydzielone z offerItems.js */
/* Zależności: products, currentOfferItems, orderCurrentItems (globalne) */
/* getProductDiameter, getProductLength, getPipeInnerArea, isOneMetrePipe z productHelpers.js */
/* getActiveItemsArray, isItemLocked, isItemInAnyOrder z orderManagerCore.js */
/* calculateTransportDistribution, updateOfferSummary z transport.js */
/* getSortedRuryItems z offerSummaryTab.js */
/* syncGaskets, syncTransportSecurity z offerItemAdd.js */
/* fmt, fmtInt z shared/formatters.js; escapeHtml z shared/escapeHtml.js */
/* showToast z shared/ui.js */

function buildRuryColgroup(extraCols = 0) {
    const base = [
        '36px',
        '36px',
        '',
        '100px',
        '140px',
        '140px',
        '120px',
        '120px',
        '130px',
        '120px',
        '160px',
        '',
        '160px'
    ];
    const extra = [];
    for (let i = 0; i < extraCols; i++) extra.push('120px');
    return [...base, ...extra].map((w) => `<col style="width:${w}">`).join('');
}
window.buildRuryColgroup = buildRuryColgroup;

function renderOfferItems() {
    let _items = getActiveItemsArray();
    const tbody = document.getElementById('offer-items-body');
    if (_items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="text-center" style="padding:2rem;color:var(--text-muted)">
      Wróć do kroku 2 aby dodać produkty</td></tr>`;
        updateOfferSummary();
        return;
    }

    const filtered = _items.filter((i) => !i.isPehd);
    if (filtered.length !== _items.length) {
        if (window.orderEditMode) orderCurrentItems = filtered;
        else currentOfferItems = filtered;
        _items = filtered;
    }

    _items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product !== undefined) {
            if (!item.name) item.name = product.name;
            if (item.unitPrice === undefined) item.unitPrice = product.price;

            if (!item.customLengthM) {
                item.weight = product.weight;
                item.transport = product.transport;
                item.lengthM = getProductLength(item.productId) / 1000;
            }
        } else {
            if (!item.name) item.name = 'Nieznany produkt (' + item.productId + ')';
        }

        if (!item.meters && item.quantity > 0 && item.lengthM > 0) {
            item.meters = item.quantity * item.lengthM;
        }

        if (item.pehdType) {
            const pehdProd = products.find((p) => p.id === item.pehdType);
            if (pehdProd) {
                const area = getPipeInnerArea(item.productId);
                let ratio = 1;
                if (item.customLengthM) {
                    const origL = getProductLength(item.productId) / 1000;
                    if (origL > 0) ratio = item.customLengthM / origL;
                }
                item.pehdCostPerUnit = area * ratio * pehdProd.price;
            }
        }
    });

    _items.forEach((item) => {
        if (!item.uid)
            item.uid = 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    });

    const transportDist = calculateTransportDistribution(_items);

    const { flat } = getSortedRuryItems(_items);

    let html = '';
    let lp = 1;

    const offerColgroup = document.getElementById('offer-colgroup');
    if (offerColgroup) offerColgroup.innerHTML = buildRuryColgroup(0);

    let lastCat;
    flat.forEach(({ cat, dk, entries }) => {
        if (cat !== lastCat) {
            html += `<tr class="offer-cat-header"><td colspan="13">${cat}</td></tr>`;
            lastCat = cat;
        }
        html += `<tr class="offer-diam-header"><td colspan="13">⌀ ${dk}</td></tr>`;
        entries.forEach(({ item, originalIndex: i }) => {
            const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
            const pehdCost = item.pehdCostPerUnit || 0;
            const surcharge = item.surcharge || 0;
            const priceAfterDiscount = basePriceAfterDiscount + pehdCost + surcharge;

            const transportPerUnit = transportDist[item.productId] || 0;
            const unitTotal = priceAfterDiscount + transportPerUnit;
            const netto = unitTotal * item.quantity;
            const hasLength = item.lengthM && item.lengthM > 0;
            const metersVal = hasLength ? item.meters || 0 : '';
            const autoTag = item.autoAdded
                ? ' <span style="font-size:.65rem;color:var(--warn);opacity:.8">(dodane automatycznie)</span>'
                : '';
            const is1m = isOneMetrePipe(item.productId);

            let pName = escapeHtml(item.name);
            if (item.pehdType === 'PEHD-3MM')
                pName += ' <span style="color:var(--warn);font-weight:bold">+ PEHD 3mm</span>';
            if (item.pehdType === 'PEHD-4MM')
                pName += ' <span style="color:var(--warn);font-weight:bold">+ PEHD 4mm</span>';

            let rowClass = '';
            let rowStyle = '';
            if (item.autoAdded) {
                rowStyle = 'background:rgba(var(--warn-rgb),0.04)';
            } else if (is1m) {
                rowClass = 'row-1m';
            }
            const active3mm =
                item.pehdType === 'PEHD-3MM' ? 'pehd-btn-active' : 'pehd-btn-inactive';
            const active4mm =
                item.pehdType === 'PEHD-4MM' ? 'pehd-btn-active' : 'pehd-btn-inactive';

            const isOrdered = isItemInAnyOrder(item.uid);
            const isLocked = isItemLocked(item);

            const isEditableLength =
                cat === 'Rury Jajowe Betonowe' ||
                cat === 'Rury Jajowe Żelbetowe' ||
                cat === 'Duże Żelbetowe II';
            const lengthEditor =
                isEditableLength && hasLength && !isLocked
                    ? `<div class="length-editor" data-action="showPipeLengthModal" data-product-id="${item.productId}" data-item-index="${i}" title="Zmień długość rury i automatycznie przelicz wagę oraz transport">
                            <i data-lucide="ruler" style="width:11px;height:11px"></i>
                            <span>Dł:</span>
                            <span class="length-value">${fmt(item.customLengthM || item.lengthM)}m</span>
                            <i data-lucide="pencil" style="width:10px;height:10px;opacity:0.5"></i>
                        </div>`
                    : '';

            const itemDiamRaw = (() => {
                let d = getProductDiameter(item.productId);
                if (!d && item.productId) {
                    const parts = item.productId.split('-');
                    if (parts.length >= 5) {
                        const code = parseInt(parts[4]);
                        if (!isNaN(code) && code > 0) d = code * 100;
                    }
                }
                return d || 0;
            })();
            const itemDiamAttr = itemDiamRaw > 0 ? `data-diameter="${itemDiamRaw}"` : '';
            const isAuto = item.autoAdded === true;

            let checkboxCell = '';
            if (isOrdered) {
                checkboxCell = `<td class="text-center"><input type="checkbox" class="item-order-checkbox" data-uid="${item.uid}" checked disabled style="cursor:not-allowed;width:16px;height:16px;opacity:0.5" title="Element dodany do zamówienia — nie można odznaczyć"></td>`;
            } else if (isAuto) {
                checkboxCell = `<td class="text-center"><input type="checkbox" class="item-order-checkbox item-order-auto" data-uid="${item.uid}" ${itemDiamAttr} data-action="updateOrderSelectionCount" style="cursor:pointer;width:16px;height:16px;opacity:0.7" title="Dodawane automatycznie razem z rurą — odznacz aby pominąć"></td>`;
            } else {
                checkboxCell = `<td class="text-center"><input type="checkbox" class="item-order-checkbox item-order-pipe" data-uid="${item.uid}" ${itemDiamAttr} data-action="pipeCheckboxChange" style="cursor:pointer;width:16px;height:16px"></td>`;
            }
            const orderedRowStyle = isOrdered
                ? 'border-left:3px solid rgba(var(--accent-rgb),0.5); background:rgba(var(--accent-rgb),0.04);'
                : '';
            const lockAttr = isLocked ? ' disabled' : '';

            html += `<tr class="${rowClass}" data-uid="${item.uid}" ${rowStyle ? `style="${rowStyle}${orderedRowStyle}"` : `style="${orderedRowStyle}"`}>
          ${checkboxCell}
          <td class="rury-col-num" style="text-align:left">${lp++}</td>
          <td style="max-width:400px;text-align:left">${pName}${autoTag}${lengthEditor}</td>
          <td class="rury-col-num" style="text-align:right"><span class="text-center-block">${fmt(item.unitPrice)}</span></td>
          <td style="text-align:right"><span class="text-center-block">${
              hasLength
                  ? `<input type="number" class="edit-input" style="width:75px;text-align:center" min="0" step="0.1" value="${metersVal}" data-select-on-click="true" data-action="updateItemMeters" data-item-index="${i}" title="Metry bieżące"${lockAttr}> m`
                  : '—'
          }</span></td>
          <td style="text-align:right"><span class="text-center-block"><input type="number" class="edit-input" style="width:75px;text-align:center" min="1" value="${item.quantity}" data-select-on-click="true" data-action="updateItemQuantity" data-item-index="${i}"${lockAttr}> szt.</span></td>
          <td style="text-align:right"><span class="text-center-block"><input type="number" class="edit-input" style="width:75px;text-align:center" min="0" max="100" step="0.5" value="${item.discount}" data-select-on-click="true" data-action="updateItemDiscount" data-item-index="${i}"${lockAttr}>%</span></td>
          <td class="rury-col-num" style="text-align:right"><span class="text-center-block">${fmt(unitTotal)}</span></td>
          <td style="text-align:right"><span class="text-center-block"><input type="number" class="edit-input" style="width:75px;text-align:center" min="0" step="0.01" value="${item.surcharge || 0}" data-select-on-click="true" data-action="updateItemSurcharge" data-item-index="${i}"${lockAttr}></span></td>
          <td class="rury-col-num" style="text-align:right;color:var(--warn)"><span class="text-center-block">${transportPerUnit > 0 ? fmt(transportPerUnit) : '—'}</span></td>
          <td class="rury-col-num" style="text-align:right;font-weight:600"><span class="text-center-block">${fmt(netto)}</span></td>
          <td style="text-align:right"><span class="text-center-block"><input type="text" class="edit-input" style="width:200px;text-align:center" value="${item.commercialVersion || ''}" data-action="updateItemText" data-item-index="${i}" placeholder="Notatki"${lockAttr}></span></td>
          <td style="text-align:right;white-space:nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center;">
              ${
                  getPipeInnerArea(item.productId) > 0 && !item.autoAdded
                      ? `
                <div class="pehd-btn-stack">
                  <button class="btn btn-sm btn-secondary pehd-btn ${active3mm}" data-action="addPehdToPipe" data-index="${i}" data-pehd-type="PEHD-3MM" title="Dolicz wkładkę 3mm">+ PEHD 3mm</button>
                  <button class="btn btn-sm btn-secondary pehd-btn ${active4mm}" data-action="addPehdToPipe" data-index="${i}" data-pehd-type="PEHD-4MM" title="Dolicz wkładkę 4mm">+ PEHD 4mm</button>
                </div>
              `
                      : ''
              }
              <button class="btn-icon" title="Usuń" aria-label="Usuń" data-action="removeOfferItem" data-index="${i}"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
          </td>
        </tr>`;
        });
    });

    tbody.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    updateOfferSummary();
}

function updatePipeLength(index, newLengthM, skipRender = false) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    let newL = Number(newLengthM);

    const diameter = getProductDiameter(item.productId);
    const maxLength = diameter === 2200 ? 2.5 : 3;

    if (newL < 1) {
        newL = 1;
        showToast('Minimalna długość rury to 1m', 'error');
    } else if (newL > maxLength) {
        newL = maxLength;
        showToast(`Maksymalna długość tej rury to ${maxLength}m`, 'error');
    }

    const product = products.find((p) => p.id === item.productId);
    if (!product) return;

    const originalLengthM = getProductLength(product.id) / 1000;
    if (!originalLengthM || originalLengthM <= 0) return;

    if (newL === originalLengthM) {
        item.customLengthM = null;
        item.lengthM = originalLengthM;
        item.weight = product.weight;
        item.transport = product.transport;
        item.name = product.name;
    } else {
        item.customLengthM = newL;
        item.lengthM = newL;

        if (product.weight) {
            const weightPerMeter = product.weight / originalLengthM;
            item.weight = Math.round(weightPerMeter * newL);

            const truckCapacity = product.weight * product.transport || MAX_TRANSPORT_WEIGHT;
            item.transport = Math.max(1, Math.floor(truckCapacity / item.weight));
        }

        const lOriginalMm = Math.round(originalLengthM * 1000);
        const lNewMm = Math.round(newL * 1000);
        if (product.name.includes(` / ${lOriginalMm}`)) {
            item.name = product.name.replace(` / ${lOriginalMm}`, ` / ${lNewMm}`);
        } else {
            item.name = `${product.name} (L=${newL}m)`;
        }
    }

    item.meters = item.quantity * item.lengthM;

    if (!skipRender) {
        syncGaskets();
        syncTransportSecurity();
        renderOfferItems();
        updateOfferSummary();
        if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
        showToast('Przeliczono uciętą rurę (waga, transport, nazwa)', 'info');
    } else {
        syncGaskets();
        syncTransportSecurity();
        const ps = document.getElementById('product-search');
        if (ps) ps.value = '';
        const pd = document.getElementById('product-dropdown');
        if (pd) pd.classList.remove('show');
        renderOfferItems();
        if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
        showToast('Dodano: ' + item.name.substring(0, 40) + '...', 'success');
    }
}

function updateItemText(index, field, value) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    if (item) {
        item[field] = value;
    }
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}

function updateItem(index, field, value) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    const numVal = Number(value);

    if (field === 'discount' && numVal > 0) {
        const isGasket =
            item.autoAdded ||
            item.name.toLowerCase().includes('uszczelk') ||
            (item.productId && item.productId.includes('Y-U-GZ-U'));
        if (isGasket) {
            showToast('UWAGA! Wpisujesz rabat na uszczelki!', 'warning');
        }
    }

    item[field] = numVal;
    if (field === 'quantity' && item.lengthM) {
        item.meters = numVal * item.lengthM;
    }

    syncGaskets();
    syncTransportSecurity();
    renderOfferItems();
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}

function updateItemMeters(index, metersValue) {
    const item = getActiveItemsArray()[index];
    if (isItemLocked(item)) return;
    const meters = Number(metersValue);
    item.meters = meters;
    if (item.lengthM && item.lengthM > 0) {
        item.quantity = Math.ceil(meters / item.lengthM);
        if (item.quantity < 1 && meters > 0) item.quantity = 1;
        if (meters === 0) item.quantity = 0;
    }

    syncGaskets();
    syncTransportSecurity();
    renderOfferItems();
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}

function removeOfferItem(index) {
    if (isItemLocked(getActiveItemsArray()[index])) return;
    getActiveItemsArray().splice(index, 1);
    syncGaskets();
    syncTransportSecurity();
    renderOfferItems();
    if (typeof syncOrderTableIfNeeded === 'function') syncOrderTableIfNeeded();
}
