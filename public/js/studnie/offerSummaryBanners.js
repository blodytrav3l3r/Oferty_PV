/* ===== BANERY STATUSU ===== */

function renderOrderBanners(order, orderChanges) {
    let html = '';
    const wellChanges = (orderChanges && orderChanges.wells) || {};
    const transportChanged = !!(orderChanges && orderChanges.transportChanged);
    const changeCount = Object.keys(wellChanges).length;
    const hasChanges = changeCount > 0 || transportChanged;

    if (order) {
        const statusText = !hasChanges
            ? '— bez zmian'
            : changeCount > 0 && transportChanged
              ? `— ${changeCount} studni zmienionych • zmieniono transport`
              : changeCount > 0
                ? `— ${changeCount} studni zmienionych`
                : '— zmieniono transport';
        const orderNum = escapeHtml(order.orderNumber || order.number || '—');
        const offerNum = escapeHtml(order.offerNumber || '—');
        html += `<div class="order-banner ${hasChanges ? 'order-banner--danger' : 'order-banner--success'}">
            <div class="flex-gap-4">
                <span class="fs-3xl"><i data-lucide="package"></i></span>
                <span class="order-banner-title">ZAMÓWIENIE ${orderNum} • Oferta ${offerNum} ${statusText}</span>
            </div>
            <button class="btn btn-sm" onclick="orderEditMode ? saveCurrentOrder() : saveOrderStudnie()"><i data-lucide="package" aria-hidden="true"></i> Zapisz zamówienie</button>
        </div>`;
    }

    if (!orderEditMode && editingOfferIdStudnie && wells.length > 0) {
        html += renderPartialOrderProgress();
    }
    return html;
}

function renderPartialOrderProgress() {
    const progress =
        typeof getOfferOrderProgress === 'function'
            ? getOfferOrderProgress(editingOfferIdStudnie, wells)
            : { ordered: 0, total: wells.length, percent: 0 };
    const orderedIds =
        typeof getOrderedWellIds === 'function'
            ? getOrderedWellIds(editingOfferIdStudnie)
            : new Set();
    const availableCount = wells.filter((w) => !orderedIds.has(w.id)).length;

    if (progress.ordered === 0 && availableCount === wells.length) return '';

    const progressColor = progress.percent >= 100 ? 'var(--success-hover)' : 'var(--blue-hover)';
    return `<div class="blue-card">
        <div class="flex-1">
            <div class="flex-space-between">
                <span class="fs-sm-bold-secondary">
                    <i data-lucide="package" aria-hidden="true"></i> Postęp zamówień
                </span>
                <span style="font-size: var(--fs-sm); font-weight: var(--fw-extrabold); color:${progressColor};">
                    ${progress.ordered} / ${progress.total} studni (${progress.percent}%)
                </span>
            </div>
            <div class="progress-track">
                <div style="height:100%; width:${progress.percent}%; background:${progressColor}; border-radius: var(--radius-2xs); transition:width 0.3s ease;"></div>
            </div>
        </div>
    </div>`;
}

/* ===== Rejestracja globali ===== */
window.renderOrderBanners = renderOrderBanners;
