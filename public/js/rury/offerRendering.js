// @ts-check
/* ===== RENDEROWANIE POZYCJI OFERTY (RURY) ===== */

function renderOfferItems() {
    let _items = getActiveItemsArray();
    const tbody = document.getElementById('offer-items-body');
    if (_items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" class="text-center" style="padding:2rem;color:var(--text-muted)">
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
            html += `<tr class="offer-cat-header"><td colspan="14">${cat}</td></tr>`;
            lastCat = cat;
        }
        html += `<tr class="offer-diam-header"><td colspan="14">⌀ ${dk}</td></tr>`;
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

            const remaining = getRemainingQuantity(item);
            const isLocked = isItemLocked(item);
            const isOrdered = remaining <= 0 && isItemInAnyOrder(item.uid);

            const isEditableLength =
                cat === 'Rury Jajowe Betonowe' ||
                cat === 'Rury Jajowe Żelbetowe' ||
                cat === 'Duże Żelbetowe II';
            const lengthEditor =
                isEditableLength && hasLength && !isLocked
                    ? `<div class="length-editor" onclick="showPipeLengthModal('${escapeHtml(item.productId)}', ${i})" title="Zmień długość rury i automatycznie przelicz wagę oraz transport">
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
                checkboxCell = `<td class="text-center" onclick="event.stopPropagation()"><input type="checkbox" class="item-order-checkbox" data-uid="${item.uid}" checked disabled style="cursor:not-allowed;width:16px;height:16px;opacity:0.5" title="Wszystkie sztuki zamówione"></td>`;
            } else if (isAuto) {
                checkboxCell = `<td class="text-center" onclick="event.stopPropagation()"><input type="checkbox" class="item-order-checkbox item-order-auto" data-uid="${item.uid}" ${itemDiamAttr} onchange="updateOrderSelectionCount()" style="cursor:pointer;width:16px;height:16px;opacity:0.7" title="Dodawane automatycznie razem z rurą — odznacz aby pominąć"></td>`;
            } else {
                checkboxCell = `<td class="text-center" onclick="event.stopPropagation()"><input type="checkbox" class="item-order-checkbox item-order-pipe" data-uid="${item.uid}" ${itemDiamAttr} onchange="updateOrderSelectionCount();onPipeCheckboxChange(this)" style="cursor:pointer;width:16px;height:16px"></td>`;
            }

            let orderCell = '';
            if (isOrdered) {
                orderCell =
                    '<td class="text-center"><span class="order-fully-badge">Zamówione</span></td>';
            } else if (isAuto) {
                orderCell =
                    '<td class="text-center"><span class="order-fully-badge order-fully-badge--auto">Auto</span></td>';
            } else if (remaining > 0) {
                const inputId = 'order-qty-' + item.uid;
                orderCell = `<td class="text-center" onclick="event.stopPropagation()" style="white-space:nowrap">
                  <input type="number" id="${inputId}" class="order-partial-qty" value="${remaining}" min="1" max="${remaining}" title="Ilość do zamówienia (pozostało ${remaining} z ${item.quantity})">
                  <span class="order-qty-max">/ ${item.quantity}</span>
                </td>`;
            } else {
                orderCell =
                    '<td class="text-center"><span class="order-qty-all">&mdash;</span></td>';
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
                  ? `<input type="number" class="edit-input" style="width:75px;text-align:center" min="0" step="0.1" value="${metersVal}" onclick="this.select()" onchange="updateItemMeters(${i},this.value)" title="Metry bieżące"${lockAttr}> m`
                  : '—'
          }</span></td>
          <td style="text-align:right"><span class="text-center-block"><input type="number" class="edit-input" style="width:75px;text-align:center" min="1" value="${item.quantity}" onclick="this.select()" onchange="updateItem(${i},'quantity',this.value)"${lockAttr}> szt.</span></td>
          ${orderCell}
          <td style="text-align:right"><span class="text-center-block"><input type="number" class="edit-input" style="width:75px;text-align:center" min="0" max="100" step="0.5" value="${item.discount}" onclick="this.select()" onchange="updateItem(${i},'discount',this.value)"${lockAttr}>%</span></td>
          <td class="rury-col-num" style="text-align:right"><span class="text-center-block">${fmt(unitTotal)}</span></td>
          <td style="text-align:right"><span class="text-center-block"><input type="number" class="edit-input" style="width:75px;text-align:center" min="0" step="0.01" value="${item.surcharge || 0}" onclick="this.select()" onchange="updateItem(${i},'surcharge',this.value)"${lockAttr}></span></td>
          <td class="rury-col-num" style="text-align:right;color:var(--warn)"><span class="text-center-block">${transportPerUnit > 0 ? fmt(transportPerUnit) : '—'}</span></td>
          <td class="rury-col-num" style="text-align:right;font-weight:600"><span class="text-center-block">${fmt(netto)}</span></td>
          <td style="text-align:right"><span class="text-center-block"><input type="text" class="edit-input" style="width:200px;text-align:center" value="${item.commercialVersion || ''}" onchange="updateItemText(${i},'commercialVersion',this.value)" placeholder="Notatki"${lockAttr}></span></td>
          <td style="text-align:right;white-space:nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center;">
              ${
                  getPipeInnerArea(item.productId) > 0 && !item.autoAdded
                      ? `
                <div class="pehd-btn-stack">
                  <button class="btn btn-sm btn-secondary pehd-btn ${active3mm}" onclick="addPehdToPipe(${i}, 'PEHD-3MM')" title="Dolicz wkładkę 3mm">+ PEHD 3mm</button>
                  <button class="btn btn-sm btn-secondary pehd-btn ${active4mm}" onclick="addPehdToPipe(${i}, 'PEHD-4MM')" title="Dolicz wkładkę 4mm">+ PEHD 4mm</button>
                </div>
              `
                      : ''
              }
              <button class="btn-icon" title="Usuń" aria-label="Usuń" onclick="removeOfferItem(${i})"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
          </td>
        </tr>`;
        });
    });

    tbody.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    updateOfferSummary();
}
window.renderOfferItems = renderOfferItems;
