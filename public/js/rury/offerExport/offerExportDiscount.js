// @ts-check
/* ===== EKSPORT / IMPORT OFERT — MODAL RABATÓW ===== */
/* Wydzielone z offerExports.js */
/* Zależności: products, CATEGORIES (globalne) */
/* getActiveItemsArray z orderManagerCore.js; getProductDiameter z productHelpers.js */
/* syncGaskets, syncTransportSecurity z offerItemAdd.js */
/* renderOfferItems z offerItemRender.js; updateOfferSummary z transport.js */
/* showModal, showToast, closeModal z shared/ui.js; fmt, escapeHtml z shared/formatters.js */

let tempDiscounts = [];

function showItemDiscountModal() {
    const items = getActiveItemsArray();
    if (items.length === 0) {
        showToast('Brak produktów w ofercie.', 'error');
        return;
    }

    tempDiscounts = items.map((item) => item.discount || 0);

    showModal({
        id: 'item-discount-modal',
        titleId: 'item-discount-title',
        html: `
    <div class="modal" style="max-width:1200px; width:95%; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding-bottom: 0.8rem; margin-bottom: 0.5rem;">
        <h3 id="item-discount-title" style="font-size: 1.25rem; font-weight: 700; color: var(--text);">% Edytuj rabaty pozycji</h3>
        <button class="btn-icon" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      
      <div style="overflow-y:auto; flex:1; padding-right:0.5rem;" id="discount-modal-list">
      </div>

      <div class="modal-footer" style="margin-top:1rem; border-top: 1px solid var(--border); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <div style="text-align:left; display:flex; gap:1.5rem; align-items:baseline;">
          <div>
            <div style="font-size:0.8rem; color:var(--text-muted);">Suma Netto (po rabatach):</div>
            <div id="discount-modal-total" style="font-size:1.3rem; font-weight:800; color:var(--success);">0,00 PLN</div>
          </div>
          <div>
            <div style="font-size:0.8rem; color:var(--text-muted);">Zabezpieczenie transportu:</div>
            <div id="discount-modal-zabezpieczenie" style="font-size:1rem; font-weight:700; color:var(--text-primary);">—</div>
          </div>
        </div>
        <div style="display:flex; gap: 1rem;">
          <button class="btn btn-secondary" data-action="closeModal" style="padding: 0.75rem 1.5rem;">Anuluj</button>
          <button class="btn btn-primary" data-action="applyItemDiscounts" style="padding: 0.75rem 2rem; font-size:1.05rem; font-weight: 600;">Zastosuj <i data-lucide="arrow-right" aria-hidden="true"></i></button>
        </div>
      </div>
    </div>`
    });
    if (window.lucide) lucide.createIcons();

    renderDiscountModalItems();
}

function renderDiscountModalItems() {
    const container = document.getElementById('discount-modal-list');
    if (!container) return;

    let html = `<table style="width:100%; text-align:left; border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:1px solid var(--border); font-size:0.75rem; color:var(--text-muted);">
        <th style="padding:0.4rem; width:50%;">Produkt</th>
        <th style="padding:0.4rem; width:15%; text-align:center;">Rabat (%)</th>
        <th style="padding:0.4rem; width:15%; text-align:right;">Cena jedn. po rabacie</th>
        <th style="padding:0.4rem; width:20%; text-align:right;">Wartość Netto</th>
      </tr>
    </thead>
    <tbody>`;

    let totalNetto = 0;
    let totalZabezpieczenie = 0;

    const items = getActiveItemsArray();
    const sortedItems = items
        .map((item, index) => {
            const product = products.find((p) => p.id === item.productId);
            const category = product ? product.category : 'Inne';
            const catOrder = CATEGORIES.indexOf(category);
            const diameter = getProductDiameter(item.productId) || 99999;
            const isBB =
                item.name.toLowerCase().includes('bosy') || item.productId.endsWith('-B00');
            return {
                item,
                index,
                catOrder: catOrder === -1 ? 999 : catOrder,
                diameter,
                isBB,
                lengthM: item.lengthM || 0
            };
        })
        .sort((a, b) => {
            if (a.catOrder !== b.catOrder) return a.catOrder - b.catOrder;
            if (a.diameter !== b.diameter) return a.diameter - b.diameter;
            if (a.isBB !== b.isBB) return a.isBB ? -1 : 1;
            return a.lengthM - b.lengthM;
        });

    sortedItems.forEach(({ item, index }) => {
        if (item.productId && item.productId.startsWith('ZT-')) {
            totalZabezpieczenie += item.unitPrice * item.quantity;
            return;
        }

        const d = tempDiscounts[index];
        const basePriceAfterDiscount = item.unitPrice * (1 - d / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const priceAfterDiscount = basePriceAfterDiscount + pehdCost;
        const netto = priceAfterDiscount * item.quantity;

        totalNetto += netto;

        let pName = escapeHtml(item.name);
        if (item.pehdType === 'PEHD-3MM')
            pName +=
                ' <span style="display:inline-block; font-size:0.65rem; padding:0.15rem 0.4rem; background:var(--success); color:white; border-radius:4px; font-weight:700; box-shadow:0 0 8px rgba(var(--success-rgb),0.3); vertical-align:middle;">+ PEHD 3mm</span>';
        if (item.pehdType === 'PEHD-4MM')
            pName +=
                ' <span style="display:inline-block; font-size:0.65rem; padding:0.15rem 0.4rem; background:var(--success); color:white; border-radius:4px; font-weight:700; box-shadow:0 0 8px rgba(var(--success-rgb),0.3); vertical-align:middle;">+ PEHD 4mm</span>';
        if (item.autoAdded)
            pName +=
                ' <span style="font-size:.65rem;color:var(--warn);opacity:.8">(dodane automatycznie)</span>';

        const isGasket =
            item.autoAdded ||
            item.name.toLowerCase().includes('uszczelk') ||
            (item.productId && item.productId.includes('Y-U-GZ-U'));
        const warningText = isGasket
            ? '<div style="font-size:0.65rem; color:var(--danger); font-weight:700; margin-top:4px; line-height:1.2;">Uwaga rabat<br>na uszczelki !</div>'
            : '';

        html += `
      <tr style="border-bottom:1px solid var(--border-glass);">
        <td style="padding:0.4rem; font-size:0.8rem; font-weight:500;">
          ${pName} <br>
          <span style="font-size:0.7rem; color:var(--text-muted);">Ilość: ${item.quantity}</span>
        </td>
        <td style="padding:0.4rem; text-align:center; vertical-align:middle;">
          <input type="number" step="0.5" min="0" max="100" data-action="discountInput" data-index="${index}" value="${d}" 
            style="width:65px; padding:0.3rem; text-align:center; border:1px solid var(--border); border-radius:4px; font-weight:700; color:var(--accent); background:var(--bg);">
          ${warningText}
        </td>
        <td id="modal-price-${index}" style="padding:0.4rem; text-align:right; font-size:0.8rem;">${fmt(priceAfterDiscount)} PLN</td>
        <td id="modal-netto-${index}" style="padding:0.4rem; text-align:right; font-weight:700; color:var(--text-primary); font-size:0.9rem;">${fmt(netto)} PLN</td>
      </tr>
    `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    const totalEl = document.getElementById('discount-modal-total');
    if (totalEl) totalEl.textContent = `${fmt(totalNetto)} PLN`;

    const ztEl = document.getElementById('discount-modal-zabezpieczenie');
    if (ztEl) ztEl.textContent = totalZabezpieczenie > 0 ? `${fmt(totalZabezpieczenie)} PLN` : '—';
}

function updateTempDiscount(index, inputEl) {
    let val = inputEl.value;
    let v = parseFloat(val);
    if (isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 100) {
        v = 100;
        inputEl.value = 100;
    }
    tempDiscounts[index] = v;

    const item = getActiveItemsArray()[index];

    const basePriceAfterDiscount = item.unitPrice * (1 - v / 100);
    const pehdCost = item.pehdCostPerUnit || 0;
    const priceAfterDiscount = basePriceAfterDiscount + pehdCost;
    const netto = priceAfterDiscount * item.quantity;

    const priceTd = document.getElementById(`modal-price-${index}`);
    const nettoTd = document.getElementById(`modal-netto-${index}`);
    if (priceTd) priceTd.textContent = `${fmt(priceAfterDiscount)} PLN`;
    if (nettoTd) nettoTd.textContent = `${fmt(netto)} PLN`;

    let totalNetto = 0;
    let totalZabezpieczenie = 0;
    getActiveItemsArray().forEach((it, idx) => {
        const d = tempDiscounts[idx];
        const bpad = it.unitPrice * (1 - d / 100);
        const pCost = it.pehdCostPerUnit || 0;
        const itemTotal = (bpad + pCost) * it.quantity;
        if (it.productId && it.productId.startsWith('ZT-')) {
            totalZabezpieczenie += itemTotal;
        } else {
            totalNetto += itemTotal;
        }
    });

    const totalEl = document.getElementById('discount-modal-total');
    if (totalEl) totalEl.textContent = `${fmt(totalNetto)} PLN`;

    const ztEl = document.getElementById('discount-modal-zabezpieczenie');
    if (ztEl) ztEl.textContent = totalZabezpieczenie > 0 ? `${fmt(totalZabezpieczenie)} PLN` : '—';
}

function checkGasketDiscount(index, inputEl) {
    const item = getActiveItemsArray()[index];
    const v = parseFloat(inputEl.value) || 0;
    const isGasket =
        item.autoAdded ||
        item.name.toLowerCase().includes('uszczelk') ||
        (item.productId && item.productId.includes('Y-U-GZ-U'));
    if (isGasket && v > 0) {
        showToast('UWAGA! Wpisujesz rabat na uszczelki!', 'warning');
    }
}

function applyItemDiscounts() {
    getActiveItemsArray().forEach((item, index) => {
        item.discount = tempDiscounts[index];
    });

    closeModal();
    syncGaskets();
    syncTransportSecurity();
    renderOfferItems();
    updateOfferSummary();
    if (typeof renderOfferSummaryTab === 'function') renderOfferSummaryTab();
    showToast('Zaktualizowano rabaty dla wybranych pozycji', 'success');
}

document.addEventListener('click', (e) => {
    const target = e.target.closest(
        '[data-action="closeModal"],[data-action="applyItemDiscounts"],[data-action="discountInput"]'
    );
    if (!target) return;
    if (target.dataset.action === 'closeModal') closeModal();
    else if (target.dataset.action === 'applyItemDiscounts') applyItemDiscounts();
});

document.addEventListener('input', (e) => {
    const target = e.target.closest('[data-action="discountInput"]');
    if (!target) return;
    updateTempDiscount(parseInt(target.dataset.index), target);
});

document.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action="discountInput"]');
    if (!target) return;
    checkGasketDiscount(parseInt(target.dataset.index), target);
});
