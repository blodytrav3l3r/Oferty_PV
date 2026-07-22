// @ts-check
/* ===== DODAWANIE POZYCJI (RURY) ===== */

function addOfferItem(productId) {
    if (!Array.isArray(products)) {
        showToast('Katalog produktów jeszcze niezaładowany', 'error');
        return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const isEditableLength =
        product.category === 'Rury Jajowe Betonowe' ||
        product.category === 'Rury Jajowe Żelbetowe' ||
        product.category === 'Duże Żelbetowe II';

    if (isEditableLength) {
        showPipeLengthModal(productId);
    } else {
        doAddOfferItem(productId, null);
    }
}
window.addOfferItem = addOfferItem;

function showPipeLengthModal(productId, editIndex = null) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const diam = getProductDiameter(product.id);
    const maxL = diam === 2200 ? 2.5 : 3;

    let currentVal = getProductLength(product.id) / 1000 || 3;
    if (editIndex !== null) {
        const item = getActiveItemsArray()[editIndex];
        currentVal = item.customLengthM || item.lengthM || currentVal;
    }

    showModal({
        id: 'add-pipe-length-modal',
        titleId: 'pipe-length-title',
        html: `
    <div class="modal" style="max-width: 450px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <h3 id="pipe-length-title" style="font-size: 1.25rem; font-weight: 700; color: var(--text);"><i data-lucide="ruler" aria-hidden="true"></i> ${editIndex !== null ? 'Zmień' : 'Dostosuj'} długość rury</h3>
        <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div style="font-size:0.95rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.5; background: var(--bg-hover); padding: 1rem; border-radius: 8px;">
        Wybrany produkt:<br><strong style="color:var(--text); font-size: 1.05rem;">${escapeHtml(product.name)}</strong>
      </div>
      <div class="form-group" style="text-align: center; margin-bottom: 2rem;">
        <label class="form-label" style="font-size:1.15rem; font-weight:600; margin-bottom:1rem; color: var(--text);">Wprowadź długość rury (m)</label>
        <div style="display:flex; justify-content:center; align-items:center; gap:1rem">
          <button class="btn btn-secondary" style="border-radius:50%; width: 44px; height: 44px; padding: 0; font-size: 1.5rem; display: flex; align-items: center; justify-content: center;" onclick="document.getElementById('pipe-custom-length').stepDown()">-</button>
          <input class="form-input" id="pipe-custom-length" type="number" step="0.1" min="1" max="${maxL}" value="${currentVal}" 
            style="font-size:2.5rem; padding:1rem; width:140px; text-align:center; font-weight:800; border: 2px solid var(--accent); border-radius: 12px; color: var(--accent); background: transparent;">
          <button class="btn btn-secondary" style="border-radius:50%; width: 44px; height: 44px; padding: 0; font-size: 1.5rem; display: flex; align-items: center; justify-content: center;" onclick="document.getElementById('pipe-custom-length').stepUp()">+</button>
        </div>
        <div style="margin-top:1rem; font-size:0.9rem; color:var(--text-muted); display: flex; justify-content: center; gap: 1rem;">
          <span style="background: var(--bg-hover); padding: 0.25rem 0.5rem; border-radius: 4px;">Min: <strong>1.0m</strong></span>
          <span style="background: var(--bg-hover); padding: 0.25rem 0.5rem; border-radius: 4px;">Max: <strong>${maxL}m</strong></span>
        </div>
      </div>
      <div class="modal-footer" style="margin-top:1.5rem; border-top: 1px solid var(--border); padding-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
        <button class="btn btn-secondary" onclick="closeModal()" style="padding: 0.75rem 1.5rem;">Anuluj</button>
        <button class="btn btn-primary" onclick="confirmPipeLength('${escapeHtml(productId)}', ${editIndex})" style="padding: 0.75rem 2rem; font-size:1.05rem; font-weight: 600; box-shadow: 0 4px 6px -1px var(--primary-alpha);">Zatwierdź <i data-lucide="arrow-right" aria-hidden="true"></i></button>
      </div>
    </div>`
    });
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        const input = document.getElementById('pipe-custom-length');
        if (input) {
            input.focus();
            input.select();
        }
    }, 100);
}
window.showPipeLengthModal = showPipeLengthModal;

function confirmPipeLength(productId, editIndex) {
    const input = document.getElementById('pipe-custom-length');
    if (!input) return;
    const lengthM = Number(input.value);
    closeModal();

    if (editIndex !== null && typeof editIndex === 'number') {
        updatePipeLength(editIndex, lengthM);
    } else {
        doAddOfferItem(productId, lengthM);
    }
}
window.confirmPipeLength = confirmPipeLength;

function doAddOfferItem(productId, customLengthM) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const activeItems = getActiveItemsArray();

    const existingItemIndex = activeItems.findIndex(
        (i) => i.productId === productId && (i.customLengthM || null) === (customLengthM || null)
    );
    if (existingItemIndex !== -1) {
        updateItem(existingItemIndex, 'quantity', activeItems[existingItemIndex].quantity + 1);
        showToast(`Zwiększono ilość: ${product.name}`, 'info');
        const ps = document.getElementById('product-search');
        if (ps) ps.value = '';
        const pd = document.getElementById('product-dropdown');
        if (pd) pd.classList.remove('show');
        return;
    }

    const lengthMm = getProductLength(product.id);
    const lengthM = lengthMm ? lengthMm / 1000 : null;

    const item = {
        uid: 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: 1,
        meters: lengthM || 0,
        lengthM: lengthM,
        discount: 0,
        surcharge: 0,
        commercialVersion: '',
        weight: product.weight,
        transport: product.transport,
        pehdType: null,
        pehdCostPerUnit: 0,
        customLengthM: null
    };

    activeItems.push(item);

    if (customLengthM && customLengthM !== lengthM) {
        const newIndex = activeItems.length - 1;
        updatePipeLength(newIndex, customLengthM, true);
    } else {
        syncGaskets();
        syncTransportSecurity();
        const ps = document.getElementById('product-search');
        if (ps) ps.value = '';
        const pd = document.getElementById('product-dropdown');
        if (pd) pd.classList.remove('show');
        renderOfferItems();
        showToast('Dodano: ' + product.name.substring(0, 40) + '...', 'success');
    }
}
