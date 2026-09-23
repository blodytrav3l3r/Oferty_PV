// @ts-check
/* ===== DODAWANIE POZYCJI (RURY) ===== */

function addOfferItem(productId) {
    if (!Array.isArray(products)) {
        showToast('Katalog produktów jeszcze niezaładowany', 'error');
        return;
    }
    const product = getRuryProductById(productId);
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
    const product = getRuryProductById(productId);
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
    <div class="modal modal--pipe-length">
      <div class="modal-header">
        <h3 id="pipe-length-title" class="fs-4xl-bold-primary"><i data-lucide="ruler" aria-hidden="true"></i> ${editIndex !== null ? 'Zmień' : 'Dostosuj'} długość rury</h3>
        <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="pipe-length-info">
        Wybrany produkt:<br><strong>${escapeHtml(product.name)}</strong>
      </div>
      <div class="form-group text-center pipe-length-form">
        <label class="form-label pipe-length-label" for="pipe-custom-length">Wprowadź długość rury (m)</label>
        <div class="pipe-length-stepper">
          <button class="btn btn-secondary btn-round-44" onclick="document.getElementById('pipe-custom-length').stepDown()" aria-label="Zmniejsz">-</button>
          <input class="form-input pipe-length-input" id="pipe-custom-length" type="number" step="0.1" min="1" max="${maxL}" value="${currentVal}">
          <button class="btn btn-secondary btn-round-44" onclick="document.getElementById('pipe-custom-length').stepUp()" aria-label="Zwiększ">+</button>
        </div>
        <div class="pipe-length-hints">
          <span class="bg-hover-025">Min: <strong>1.0m</strong></span>
          <span class="bg-hover-025">Max: <strong>${maxL}m</strong></span>
        </div>
      </div>
      <div class="modal-footer pipe-length-footer">
        <button class="btn btn-secondary p-075-15" onclick="closeModal()">Anuluj</button>
        <button class="btn btn-primary p-075-15" onclick="confirmPipeLength('${escapeJsStr(productId)}', ${editIndex})">Zatwierdź <i data-lucide="arrow-right" aria-hidden="true"></i></button>
      </div>
    </div>`
    });
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        const input = document.getElementById('pipe-custom-length');
        if (input) {
            input.focus();
            input.select();
            if (typeof window.bindEnter === 'function') {
                window.bindEnter(
                    input,
                    () => window.confirmPipeLength && window.confirmPipeLength(productId, editIndex)
                );
            } else {
                input.addEventListener('keydown', (e) => {
                    if (
                        e.key === 'Enter' &&
                        !e.ctrlKey &&
                        !e.shiftKey &&
                        !e.altKey &&
                        !e.metaKey &&
                        !e.isComposing
                    ) {
                        e.preventDefault();
                        window.confirmPipeLength && window.confirmPipeLength(productId, editIndex);
                    }
                });
            }
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
    const product = getRuryProductById(productId);
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
