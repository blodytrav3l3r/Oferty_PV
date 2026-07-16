// @ts-check
/* ===== PODSUMOWANIE OFERTY — RENDEROWANIE ===== */

function toggleWellExpansion(index, event) {
    if (event) event.stopPropagation();
    if (expandedWellIndices.has(index)) {
        expandedWellIndices.delete(index);
    } else {
        expandedWellIndices.add(index);
    }
    renderOfferSummary();
}

/**
 * Główna funkcja renderująca podsumowanie oferty.
 */
function renderOfferSummary() {
    const container = document.getElementById('offer-summary-body');
    if (!container) return;

    const order = orderEditMode ? getCurrentOfferOrder() : null;
    const orderChanges = orderEditMode && order ? getOrderChanges({ ...order, wells: wells }) : {};

    generateOfferNotes(false);

    const totals = calculateOfferTotals();

    let html = '';
    html += renderOrderBanners(order, orderChanges);
    html += renderOfferSummaryTable(order, orderChanges, totals);

    container.innerHTML = html;

    if (window.lucide) window.lucide.createIcons({ root: container });

    updateOfferSummaryUI(totals);

    const saveBtn = document.getElementById('btn-save-studnie-offer');
    const createOrderBtn = document.getElementById('btn-create-order-offer');

    if (saveBtn) {
        if (orderEditMode) {
            saveBtn.innerHTML = '<i data-lucide="save" aria-hidden="true"></i> Zapisz zamówienie';
            saveBtn.onclick = () => {
                if (typeof saveCurrentOrder === 'function') saveCurrentOrder();
            };
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-order-save');
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';

            if (createOrderBtn) createOrderBtn.style.display = 'none';
        } else {
            saveBtn.innerHTML = '<i data-lucide="save" aria-hidden="true"></i> Zapisz ofertę';
            saveBtn.onclick = () => {
                if (typeof saveOfferStudnie === 'function') saveOfferStudnie();
            };
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-order-save');
            saveBtn.style.background = '';
            saveBtn.style.borderColor = '';

            if (createOrderBtn) createOrderBtn.style.display = 'flex';
        }
        if (window.lucide) window.lucide.createIcons({ root: saveBtn });
    }
}
