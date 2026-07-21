// @ts-check
/* ===== UI: BLOKADA OFERTY - BANERY I AUTO-BLOKADA ===== */
/* Wyodrebnione z wellUI.js - fazy refaktoryzacji */

/* ===== BLOKADA OFERTY - BANER ===== */
const OFFER_LOCKED_MSG =
    '<i data-lucide="lock" aria-hidden="true"></i> Ta studnia jest zablokowana — jest częścią zamówienia. Edytuj ją przez zamówienie.';
const WELL_LOCKED_MSG =
    '<i data-lucide="lock" aria-hidden="true"></i> Studnia zablokowana — posiada zaakceptowane zlecenie produkcyjne.';

function renderOfferLockBanner() {
    // Jeśli jesteśmy w trybie zamówienia, baner blokady z oferty nie powinien się wyświetlać
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        let lockBanner = document.getElementById('offer-lock-banner');
        if (lockBanner) lockBanner.style.display = 'none';
        return;
    }

    let lockBanner = document.getElementById('offer-lock-banner');
    if (!lockBanner) {
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        lockBanner = document.createElement('div');
        lockBanner.id = 'offer-lock-banner';
        centerCol.insertBefore(lockBanner, centerCol.firstChild);
    }

    // Oblicz stan zamówień częściowych
    const well = getCurrentWell();
    const wellLocked = well && typeof isWellOrdered === 'function' && isWellOrdered(well);
    const hasAnyOrders =
        editingOfferIdStudnie &&
        typeof getOrdersForOffer === 'function' &&
        getOrdersForOffer(editingOfferIdStudnie).length > 0;

    if (!hasAnyOrders && !wellLocked) {
        lockBanner.style.display = 'none';
        return;
    }

    // Pokaż info o zamówieniach częściowych
    const orders =
        typeof getOrdersForOffer === 'function' ? getOrdersForOffer(editingOfferIdStudnie) : [];
    const progress =
        typeof getOfferOrderProgress === 'function'
            ? getOfferOrderProgress(editingOfferIdStudnie, wells)
            : { ordered: 0, total: wells.length, percent: 0 };

    if (wellLocked) {
        // Znajdź zamówienie, do którego należy bieżąca studnia
        const wellOrder = orders.find((ord) => (ord.wells || []).some((w) => w.id === well.id));

        lockBanner.style.cssText = `
            display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
            padding:0.7rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
            background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08));
            border: 2px solid rgba(239,68,68,0.3);
        `;

        lockBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <span style="font-size:1.3rem;"><i data-lucide="lock"></i></span>
                <div>
                    <div style="font-size:0.82rem; font-weight:800; color:#f87171;">
                        STUDNIA ZABLOKOWANA
                    </div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">
                        „${escapeHtml(well.name)}" jest częścią zamówienia${wellOrder ? ' ' + escapeHtml(wellOrder.orderNumber || '') : ''}.
                        Edytuj ją przez zamówienie lub wybierz inną studnię.
                        <span style="color:#34d399; font-weight:700;">${progress.ordered}/${progress.total} studni zamówionych</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:0.4rem; align-items:center;">
                ${
                    wellOrder
                        ? `<button class="btn btn-sm" onclick="window.location.href='studnie.html?order=${wellOrder.id}'" style="height:48px; background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.75rem; font-weight:700; padding:0 1rem; display:flex; align-items:center; gap:0.4rem;">
                        <i data-lucide="package"></i> Edytuj zamówienie
                    </button>`
                        : ''
                }
            </div>
        `;
    } else {
        // Oferta ma zamówienia, ale bieżąca studnia jest wolna
        lockBanner.style.cssText = `
            display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
            padding:0.5rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
            background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.05));
            border: 1px solid rgba(16,185,129,0.25);
        `;

        lockBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="font-size:1rem;"><i data-lucide="info"></i></span>
                <div style="font-size:0.7rem; color:var(--text-muted);">
                    Oferta ma <strong style="color:#34d399;">${orders.length}</strong> zamówień
                    (<strong style="color:#34d399;">${progress.ordered}/${progress.total}</strong> studni zamówionych).
                    Ta studnia jest <strong style="color:#6ee7b7;">dostępna do edycji</strong>.
                </div>
            </div>
        `;
    }

    if (window.lucide) window.lucide.createIcons({ root: lockBanner });
}

/* ===== AUTO-BLOKADA UI ===== */
function updateAutoLockUI() {
    const well = getCurrentWell();
    const btnLock = document.getElementById('btn-lock-auto');
    const btnAuto = document.getElementById('btn-auto-select');
    if (!btnLock || !btnAuto) return;
    if (!well) {
        btnLock.innerHTML = '<i data-lucide="unlock"></i> Ręczny';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        return;
    }

    if (well.autoLocked) {
        btnLock.innerHTML = '<i data-lucide="lock"></i> Tryb ręczny (Włączony)';
        btnLock.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        btnLock.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        btnAuto.style.cursor = 'not-allowed';
    } else {
        btnLock.innerHTML = '<i data-lucide="unlock"></i> Tryb ręczny (Wyłączony)';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = false;
        btnAuto.style.opacity = '1';
        btnAuto.style.cursor = 'pointer';
    }
}

window.renderOfferLockBanner = renderOfferLockBanner;
window.updateAutoLockUI = updateAutoLockUI;
