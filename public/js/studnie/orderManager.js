// @ts-check
/* ===== ORDER MANAGER — BARREL ===== */
// Deleguje do: orderState.js, orderCrud.js, orderKartaBudowy.js
// CSP actions w: orderCspActions.js

/** Zmienna przechowująca dane do utworzenia zamówienia w trakcie kroku Karta Budowy */
var pendingOrderCreationData = null;

/* ===== ZLECENIA PRODUKCYJNE ===== */
let productionOrders = [];
let zleceniaElementsList = [];
let zleceniaSelectedIdx = -1;
let zleceniaActiveFilter = 'all';
let wellsSnapshotBeforeZlecenia = null;

/* ===== PODGLĄD HISTORYCZNEGO ZAMÓWIENIA ===== */
window.isPreviewMode = false;

window.applyPreviewLockUI = function () {
    let banner = document.getElementById('preview-lock-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'preview-lock-banner';
        banner.innerHTML = `
            <div style="position:fixed; top:2rem; left:50%; transform:translateX(-50%); background:rgba(15, 23, 42, 0.95); border:2px solid var(--warn-hover); color:var(--warn-hover); padding:0.8rem 2.5rem; border-radius:40px; z-index:99999; box-shadow:0 20px 40px rgba(0,0,0,0.6); font-weight:800; display:flex; align-items:center; gap:1.5rem; backdrop-filter:blur(10px);">
                <span style="font-size:1.2rem;"><i data-lucide="eye"></i>️ HISTORIA — TYLKO DO ODCZYTU</span>
                <button data-action="exitPreviewMode" class="btn btn-sm" style="background:var(--warn-hover); color:#000; border:none; padding:0.4rem 1rem; border-radius:20px; font-weight:700;">ZAMKNIJ PODGLĄD</button>
            </div>
        `;
        document.body.appendChild(banner);
    }

    document
        .querySelectorAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar')
        .forEach((el) => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.7';
        });

    const originalSaveOrder = window.saveCurrentOrder;
    window.saveCurrentOrder = async () => {
        if (window.isPreviewMode)
            showToast('Zapisywanie w trybie podglądu jest zablokowane', 'error');
        else if (originalSaveOrder) await originalSaveOrder();
    };
    const originalSaveOffer = window.saveOfferStudnie;
    window.saveOfferStudnie = async () => {
        if (window.isPreviewMode) {
            showToast('Zapisywanie w trybie podglądu jest zablokowane', 'error');
            return false;
        } else if (originalSaveOffer) return await originalSaveOffer();
    };

    window.isPreviewMode = true;
};

window.exitPreviewMode = function () {
    window.location.reload();
};

function renderOrderModeBanner() {
    let banner = document.getElementById('order-mode-banner');
    if (!banner) {
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        banner = document.createElement('div');
        banner.id = 'order-mode-banner';
        centerCol.insertBefore(banner, centerCol.firstChild);
    }

    const saveSidebarBtn = document.getElementById('btn-save-studnie-sidebar');
    const saveZamowienieSidebarBtn = document.getElementById('btn-save-zamowienie-sidebar');
    const zleceniaSidebarBtn = document.getElementById('btn-zlecenia-sidebar');

    if (!orderEditMode) {
        banner.style.display = 'none';
        if (saveSidebarBtn) saveSidebarBtn.style.display = 'flex';
        if (saveZamowienieSidebarBtn) saveZamowienieSidebarBtn.style.display = 'none';
        if (zleceniaSidebarBtn) zleceniaSidebarBtn.style.display = 'none';
        if (typeof currentWizardStep !== 'undefined' && currentWizardStep === 5) {
            currentWizardStep = 3;
            if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        }
        return;
    }

    banner.style.display = '';
    if (saveSidebarBtn) saveSidebarBtn.style.display = 'none';
    if (saveZamowienieSidebarBtn) saveZamowienieSidebarBtn.style.display = 'flex';
    if (zleceniaSidebarBtn) zleceniaSidebarBtn.style.display = 'flex';

    const order = orderEditMode.order;
    const changes = getOrderChanges({ ...order, wells: wells });
    const changeCount = Object.keys(changes).length;
    const hasChanges = changeCount > 0;

    banner.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
        padding:0.7rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
        background: ${hasChanges ? 'linear-gradient(135deg, rgba(var(--danger-rgb),0.12), rgba(var(--danger-rgb),0.06))' : 'linear-gradient(135deg, rgba(var(--success-rgb),0.12), rgba(var(--success-rgb),0.06))'};
        border: 2px solid ${hasChanges ? 'rgba(var(--danger-rgb),0.3)' : 'rgba(var(--success-rgb),0.3)'};
    `;

    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:1.3rem;"><i data-lucide="package"></i></span>
            <div>
                <div style="font-size:0.82rem; font-weight:800; color:${hasChanges ? 'var(--danger-hover)' : 'var(--success-hover)'};">
                    TRYB ZAMÓWIENIA — ${order.number || ''}
                </div>
                <div style="font-size:0.65rem; color:var(--text-muted);">
                    ${hasChanges ? `<i data-lucide="alert-triangle"></i> ${changeCount} studni zmienionych od oryginału` : '<i data-lucide="check-circle-2"></i> Bez zmian od oryginału'}
                    • Utworzono: ${new Date(order.createdAt).toLocaleString('pl-PL')}
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
        </div>
    `;
}

async function syncSourceData(options = {}) {
    let synced = '';
    try {
        if (typeof orderEditMode !== 'undefined' && orderEditMode) {
            if (typeof window.saveCurrentOrder === 'function') {
                await window.saveCurrentOrder(options);
                synced += 'Zamówienie';
            }
        } else {
            if (typeof window.saveOfferStudnie === 'function') {
                const offerSaved = await window.saveOfferStudnie();
                if (offerSaved) synced += 'Oferta';
            }
        }
    } catch (err) {
        logger.error('orderManager', 'syncSourceData error:', err);
    }
    return synced;
}
window.syncSourceData = syncSourceData;
