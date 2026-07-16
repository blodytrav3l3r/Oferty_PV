/* ===== BANERY STATUSU ===== */

function renderOrderBanners(order, orderChanges) {
    let html = '';
    const hasChanges = Object.keys(orderChanges).length > 0;

    if (order) {
        const changeCount = Object.keys(orderChanges).length;
        html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:${hasChanges ? 'rgba(var(--danger-rgb),0.1)' : 'rgba(var(--success-rgb),0.1)'}; border:1px solid ${hasChanges ? 'rgba(var(--danger-rgb),0.3)' : 'rgba(var(--success-rgb),0.3)'}; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-size:1.1rem;"><i data-lucide="package"></i></span>
                <span style="font-size:0.75rem; font-weight:700; color:${hasChanges ? 'var(--danger-hover)' : 'var(--success-hover)'};">ZAMÓWIENIE ${hasChanges ? '— ' + changeCount + ' studni zmienionych' : '— bez zmian'}</span>
            </div>
            <button class="btn btn-sm" style="background:rgba(var(--success-rgb),0.15); border:1px solid rgba(var(--success-rgb),0.3); color:var(--success-hover); font-size:0.65rem; padding:0.15rem 0.4rem;" onclick="orderEditMode ? saveCurrentOrder() : saveOrderStudnie()"><i data-lucide="package" aria-hidden="true"></i> Zapisz zamówienie</button>
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
    return `<div style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:rgba(var(--blue-rgb),0.08); border:1px solid rgba(var(--blue-rgb),0.2); border-radius:8px;">
        <div class="flex-1">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <span style="font-size:0.72rem; font-weight:700; color:var(--text-secondary);">
                    <i data-lucide="package" aria-hidden="true"></i> Postęp zamówień
                </span>
                <span style="font-size:0.72rem; font-weight:800; color:${progressColor};">
                    ${progress.ordered} / ${progress.total} studni (${progress.percent}%)
                </span>
            </div>
            <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${progress.percent}%; background:${progressColor}; border-radius:3px; transition:width 0.3s ease;"></div>
            </div>
        </div>
    </div>`;
}
