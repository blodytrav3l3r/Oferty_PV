/* ===== BANERY STATUSU ===== */

function renderOrderBanners(order, orderChanges) {
    let html = '';
    const hasChanges = Object.keys(orderChanges).length > 0;

    if (order) {
        const changeCount = Object.keys(orderChanges).length;
        html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:${hasChanges ? 'rgba(var(--danger-rgb), 0.1)' : 'rgba(var(--success-rgb), 0.1)'}; border:1px solid ${hasChanges ? 'rgba(var(--danger-rgb), 0.3)' : 'rgba(var(--success-rgb), 0.3)'}; border-radius: var(--radius-sm);">
            <div class="flex-gap-4">
                <span class="fs-3xl"><i data-lucide="package"></i></span>
                <span style="font-size: var(--fs-base); font-weight: var(--fw-bold); color:${hasChanges ? 'var(--danger-hover)' : 'var(--success-hover)'};">ZAMÓWIENIE ${hasChanges ? '— ' + changeCount + ' studni zmienionych' : '— bez zmian'}</span>
            </div>
            <button class="btn btn-sm" style="background:rgba(var(--success-rgb), 0.15); border:1px solid rgba(var(--success-rgb), 0.3); color:var(--success-hover); font-size: var(--fs-xs); padding:0.15rem 0.4rem;" onclick="orderEditMode ? saveCurrentOrder() : saveOrderStudnie()"><i data-lucide="package" aria-hidden="true"></i> Zapisz zamówienie</button>
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
