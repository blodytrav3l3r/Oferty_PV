// @ts-check
/* ===== ZAMÓWIENIA RUR — PODSUMOWANIE I PORÓWNANIE ===== */

function updateRuryOrderSummary(orderData) {
    const dst = document.getElementById('order-items-body');
    const src = document.getElementById('offer-items-body');
    if (!dst) return;

    const isOrderMode = !!(window.orderEditMode && editingRuryOrderId);
    const colCount = isOrderMode
        ? /** @type {HTMLTableRowElement|null} */ (
              document.querySelector('#offer-items-table thead tr')
          )?.cells?.length || 13
        : 13;
    const orderColgroup = document.getElementById('order-items-colgroup');

    if (orderColgroup) {
        orderColgroup.innerHTML = buildRuryColgroup(0);
    }

    if (!src || (getActiveItemsArray() || []).length === 0) {
        dst.innerHTML = `<tr class="rury-table-empty"><td colspan="${colCount}">Brak produktów</td></tr>`;
        copyTransportBreakdown();
        if (window.lucide) lucide.createIcons();
        return;
    }

    dst.innerHTML = src.innerHTML;

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

function copyTransportBreakdown() {
    const src = document.getElementById('transport-breakdown');
    const dst = document.getElementById('order-transport-breakdown');
    if (!src || !dst) return;
    dst.innerHTML = src.innerHTML
        .replace(/id="transport-breakdown-content"/g, 'id="order-transport-breakdown-content"')
        .replace(/id="transport-toggle-icon"/g, 'id="order-transport-toggle-icon"')
        .replace(
            /data-action="toggleTransportBreakdown"/g,
            'data-action="toggleOrderTransportBreakdown"'
        );
    if (window.lucide) lucide.createIcons({ root: dst });
}
