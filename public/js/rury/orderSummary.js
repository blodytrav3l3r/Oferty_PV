// @ts-check
/* ===== ZAMÓWIENIA RUR — PODSUMOWANIE TABELI ===== */

function copyTransportBreakdown() {
    const src = document.getElementById('transport-breakdown');
    const dst = document.getElementById('order-transport-breakdown');
    if (!src || !dst) return;
    dst.innerHTML = src.innerHTML
        .replace(/id="transport-breakdown-content"/g, 'id="order-transport-breakdown-content"')
        .replace(/id="transport-toggle-icon"/g, 'id="order-transport-toggle-icon"')
        .replace(
            /onclick="toggleTransportBreakdown\(\)"/g,
            'onclick="toggleOrderTransportBreakdown()"'
        );
    if (window.lucide) lucide.createIcons({ root: dst });
}

function updateRuryOrderSummary(orderData) {
    const src = document.getElementById('offer-items-body');
    const dst = document.getElementById('order-items-body');
    if (!dst) return;

    const isOrderMode = !!(window.orderEditMode && orderData);
    const colCount = 14;

    const orderColgroup = document.getElementById('order-colgroup');
    if (orderColgroup && typeof buildRuryColgroup === 'function') {
        orderColgroup.innerHTML = buildRuryColgroup(0);
    }

    if (!src || (getActiveItemsArray() || []).length === 0) {
        dst.innerHTML = `<tr class="rury-table-empty"><td colspan="${colCount}">Brak produktów</td></tr>`;
        copyTransportBreakdown();
        if (window.lucide) lucide.createIcons();
        return;
    }

    dst.innerHTML = src.innerHTML;

    if (orderData && orderData.items) {
        const orderByUid = {};
        orderData.items.forEach((it) => {
            if (it.uid) orderByUid[it.uid] = it;
        });
        dst.querySelectorAll('tr[data-uid]').forEach((row) => {
            const oi = orderByUid[row.dataset.uid];
            if (!oi) return;
            const orderedQty = oi.orderedQuantity || oi.quantity || 0;
            const qtyInput = row.querySelector('td:nth-child(6) .edit-input');
            if (qtyInput) qtyInput.value = orderedQty;
            const orderCell = row.querySelector('.order-partial-qty');
            if (orderCell) {
                orderCell.value = orderedQty;
                const maxSpan = orderCell.parentElement?.querySelector('.order-qty-max');
                if (maxSpan) maxSpan.textContent = '/ ' + (oi.quantity || 0);
            }
        });
    }

    if (isOrderMode) {
        const applyOrderQty = async function (row, v) {
            const uid = row.dataset.uid;
            const item = (orderCurrentItems || []).find((it) => it.uid === uid);
            if (!item) return;
            v = parseInt(v);
            if (isNaN(v) || v < 1) v = 1;
            const curOrder = (ordersRury || []).find((o) => o && o.id === editingRuryOrderId);
            const savedItem = curOrder
                ? (curOrder.items || []).find((it) => it && it.uid === uid)
                : null;
            const savedQty = savedItem ? savedItem.orderedQuantity || savedItem.quantity || 0 : 0;
            const totalOrdered = getItemOrderedQty(item);
            const otherOrdered = Math.max(0, totalOrdered - savedQty);
            const maxAllowed = Math.max(1, (item.quantity || 0) - otherOrdered);
            if (v > maxAllowed) {
                const over = v - maxAllowed;
                const confirmed = await appConfirm(
                    'Ilo\u015B\u0107 ' +
                        v +
                        ' szt. przekracza pozosta\u0142\u0105 ilo\u015B\u0107 w ofercie (' +
                        maxAllowed +
                        ' szt.) o ' +
                        over +
                        ' szt.',
                    {
                        title: 'Przekroczenie ilo\u015Bci w ofercie',
                        okText: 'Kontynuuj',
                        cancelText: 'Anuluj',
                        type: 'warning'
                    }
                );
                if (!confirmed) v = maxAllowed;
            }
            item.orderedQuantity = v;
            const qtyInput = row.querySelector('td:nth-child(6) .edit-input');
            if (qtyInput) qtyInput.value = v;
            const orderInput = row.querySelector('.order-partial-qty');
            if (orderInput) orderInput.value = v;
            if (!item.autoAdded && typeof getProductDiameter === 'function') {
                const diam = getProductDiameter(item.productId);
                if (diam) {
                    const ztId = 'ZT-' + String(diam).padStart(4, '0');
                    let totalPipeQty = 0;
                    (orderCurrentItems || []).forEach((it) => {
                        if (!it.autoAdded && it.productId && it.productId !== ztId) {
                            const d = getProductDiameter(it.productId);
                            if (d === diam) totalPipeQty += it.orderedQuantity || it.quantity || 0;
                        }
                    });
                    (orderCurrentItems || []).forEach((it) => {
                        if (it.productId === ztId) {
                            it.orderedQuantity = totalPipeQty;
                            const ztRow = dst.querySelector('tr[data-uid="' + it.uid + '"]');
                            if (ztRow) {
                                const ztQty = ztRow.querySelector('td:nth-child(6) .edit-input');
                                if (ztQty) ztQty.value = totalPipeQty;
                                const ztOrder = ztRow.querySelector('.order-partial-qty');
                                if (ztOrder) ztOrder.value = totalPipeQty;
                            }
                        }
                    });
                }
            }
        };
        dst.querySelectorAll('.order-partial-qty').forEach((el) => {
            el.removeAttribute('disabled');
            el.onchange = function () {
                const row = this.closest('tr[data-uid]');
                if (!row) return;
                applyOrderQty(row, this.value);
            };
        });
        dst.querySelectorAll('td:nth-child(6) .edit-input').forEach((el) => {
            el.removeAttribute('disabled');
            el.onchange = function () {
                const row = this.closest('tr[data-uid]');
                if (!row) return;
                applyOrderQty(row, this.value);
            };
        });
        dst.querySelectorAll('tr[data-uid]').forEach((row) => {
            const orderCell = row.querySelector('td:nth-child(7)');
            if (!orderCell) return;
            const badge = orderCell.querySelector('.order-fully-badge');
            const existingInput = orderCell.querySelector('.order-partial-qty');
            if (badge && !existingInput && !badge.classList.contains('order-fully-badge--auto')) {
                const uid = row.dataset.uid;
                const item = (orderCurrentItems || []).find((it) => it.uid === uid);
                const currentQty = item ? item.orderedQuantity || item.quantity || 0 : 0;
                orderCell.innerHTML =
                    '<input type="number" class="order-partial-qty" value="' +
                    escapeHtml(String(currentQty)) +
                    '" min="1" style="width:60px;text-align:center;background:var(--bg-card);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px 4px">';
                const newInput = orderCell.querySelector('.order-partial-qty');
                if (newInput) {
                    newInput.onchange = function () {
                        const r = this.closest('tr[data-uid]');
                        if (!r) return;
                        applyOrderQty(r, this.value);
                    };
                }
            }
        });
    } else {
        dst.querySelectorAll('.order-partial-qty').forEach((el) => el.setAttribute('disabled', ''));
    }

    let changes = { items: {}, transportChanged: false };
    if (isOrderMode && orderData && typeof getRuryOrderChanges === 'function') {
        changes = getRuryOrderChanges({
            ...orderData,
            items: orderCurrentItems || orderData.items,
            transportKm: Number(document.getElementById('transport-km')?.value || 0),
            transportRate: Number(document.getElementById('transport-rate')?.value || 0),
            transportMode: currentRuryTransportMode || 'full'
        });
    }

    const snapItems =
        (orderData && orderData.originalSnapshot && orderData.originalSnapshot.items) || [];

    dst.querySelectorAll('tr:not(.offer-cat-header):not(.offer-diam-header)').forEach((row) => {
        const firstCell = row.querySelector('td');
        if (!firstCell) return;
        const checkbox = firstCell.querySelector('.item-order-checkbox');
        if (!checkbox) return;
        const uid = row.dataset.uid;
        const ordered = isOrderMode || isItemInAnyOrder(uid);
        const icon = ordered
            ? '<i data-lucide="package-check" style="width:16px;height:16px;color:#a5b4fc"></i>'
            : '<i data-lucide="circle" style="width:12px;height:12px;color:var(--text-muted);opacity:0.4"></i>';
        firstCell.innerHTML = icon;
        firstCell.setAttribute('data-status', ordered ? 'ordered' : 'available');

        if (isOrderMode) {
            const snapIdx = snapItems.findIndex((it) => it.uid === uid);
            const curIdx = (orderCurrentItems || []).findIndex((it) => it.uid === uid);
            const change = curIdx >= 0 ? changes.items[curIdx] : null;
            if (change) {
                row.style.borderLeft = '3px solid #ef4444';
                row.style.background = 'rgba(239,68,68,0.05)';
                let badge = '[ZMIENIONE]';
                if (change.type === 'added') {
                    row.style.borderLeft = '3px solid #10b981';
                    row.style.background = 'rgba(16,185,129,0.05)';
                    badge = '[NOWE]';
                }
                const badgeSpan = document.createElement('span');
                badgeSpan.style.cssText =
                    'font-size:0.6rem;color:' +
                    (change.type === 'added' ? '#10b981' : '#ef4444') +
                    ';font-weight:700;margin-left:0.3rem;white-space:nowrap;';
                badgeSpan.textContent = badge;
                const nameCell = row.querySelectorAll('td')[1];
                if (nameCell) nameCell.appendChild(badgeSpan);
            }
        }
    });

    dst.querySelectorAll('.offer-cat-header td, .offer-diam-header td').forEach((td) => {
        td.setAttribute('colspan', String(colCount));
    });

    copyTransportBreakdown();
    if (window.lucide) lucide.createIcons();
}
window.updateRuryOrderSummary = updateRuryOrderSummary;
