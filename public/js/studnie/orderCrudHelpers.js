// @ts-check
/* ===== HELPERY CRUD ZAMÓWIEŃ (STUDNIE) ===== */
/* renderOrderModeBanner — baner trybu zamówienia */
/* Zależności: orderEditMode, wells, getOrderChanges (globalne) */

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
    const tempOrder = { ...order, wells: wells };
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

window.renderOrderModeBanner = renderOrderModeBanner;
