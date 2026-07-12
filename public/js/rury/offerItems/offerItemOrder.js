// @ts-check
/* ===== POZYCJE OFERTY — SELEKCJA DO ZAMÓWIENIA, NAWIGACJA SEKCJI, CSP ===== */
/* Wydzielone z offerItems.js */
/* Zależności: products, currentOfferItems, orderCurrentItems, ordersRury (globalne) */
/* getProductDiameter z productHelpers.js */
/* getActiveItemsArray, isItemInAnyOrder z orderManagerCore.js */
/* renderOfferItems z offerItemRender.js */
/* addOfferItem, selectCatalogCategory, removeOfferItem, addPehdToPipe z offerItemAdd.js */
/* renderPriceList z pricelistUi.js */
/* updateOfferSummary z transport.js */

window.toggleAllItemsForOrder = function (checked) {
    const section = document.querySelector('.section.active');
    if (!section) return;
    section.querySelectorAll('.item-order-checkbox').forEach((cb) => {
        if (!cb.disabled) cb.checked = checked;
    });
};

window.updateOrderSelectionCount = function () {
    const section = document.querySelector('.section.active');
    if (!section) return;
    const checkboxes = section.querySelectorAll('.item-order-checkbox');
    const total = checkboxes.length;
    const checked = section.querySelectorAll('.item-order-checkbox:checked').length;
    const selectAll = document.getElementById('select-all-items');
    if (selectAll) {
        selectAll.checked = total > 0 && checked === total;
        selectAll.indeterminate = checked > 0 && checked < total;
    }
};

window.collectSelectedItemsForOrder = function () {
    const section = document.querySelector('.section.active');
    if (!section) return [];
    const offerTabActive = section.id === 'section-offer';
    const selector = offerTabActive
        ? '.offer-summary-checkbox:checked'
        : '.item-order-checkbox:checked';
    const selected = [];
    const seen = new Set();
    const items = getActiveItemsArray() || [];
    section.querySelectorAll(selector).forEach((cb) => {
        if (cb.disabled) return;
        const uid = cb.dataset.uid;
        if (!uid || seen.has(uid)) return;
        const item = items.find((it) => it.uid === uid);
        if (item && item.autoAdded && item.productId && item.productId.startsWith('ZT-')) return;
        seen.add(uid);
        if (item) selected.push(item);
    });
    {
        const selectedPipeQtyByDiam = {};
        selected.forEach((it) => {
            if (it.autoAdded) return;
            const d =
                getProductDiameter(it.productId) ||
                (() => {
                    if (!it.productId) return 0;
                    const parts = it.productId.split('-');
                    if (parts.length >= 5) {
                        const code = parseInt(parts[4]);
                        if (!isNaN(code) && code > 0) return code * 100;
                    }
                    return 0;
                })();
            if (d > 0) {
                selectedPipeQtyByDiam[d] = (selectedPipeQtyByDiam[d] || 0) + (it.quantity || 0);
            }
        });

        const selectedDiameters = new Set(Object.keys(selectedPipeQtyByDiam).map(Number));

        items.forEach((it) => {
            if (!it.autoAdded) return;
            if (seen.has(it.uid)) return;
            const d =
                getProductDiameter(it.productId) ||
                (() => {
                    if (!it.productId) return 0;
                    const parts = it.productId.split('-');
                    if (parts.length >= 5) {
                        const code = parseInt(parts[4]);
                        if (!isNaN(code) && code > 0) return code * 100;
                    }
                    return 0;
                })();
            if (d > 0 && selectedDiameters.has(d)) {
                const cloned = structuredClone(it);
                if (cloned.productId && cloned.productId.startsWith('ZT-')) {
                    cloned.quantity = selectedPipeQtyByDiam[d] || 0;
                }
                if (cloned.quantity > 0) {
                    selected.push(cloned);
                    seen.add(it.uid);
                }
            }
        });
    }
    return selected;
};

window.onPipeCheckboxChange = function (cb) {
    const diameter = parseInt(cb.dataset.diameter || '0');
    if (!diameter) return;
    const checked = cb.checked;
    document
        .querySelectorAll(
            `.item-order-auto[data-diameter="${diameter}"]:not(:disabled), .offer-summary-auto[data-diameter="${diameter}"]:not(:disabled)`
        )
        .forEach((autoCb) => {
            autoCb.checked = checked;
        });
    if (typeof window.updateOrderSelectionCount === 'function') {
        window.updateOrderSelectionCount();
    }
};

function showSectionRury(id) {
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

    const targetSection = document.getElementById('section-' + id);
    if (targetSection) targetSection.classList.add('active');

    const targetBtn = document.querySelector(`.nav-btn[data-section="${id}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    if (id === 'pricelist') renderPriceList();

    const summaryBar = document.getElementById('rury-summary-bar');
    if (id === 'offer') {
        if (summaryBar) summaryBar.style.display = 'block';
        if (typeof updateOfferSummary === 'function') updateOfferSummary();

        const ctxBanner = document.getElementById('offer-context-banner');
        const ctxBadge = document.getElementById('offer-context-badge');
        const ctxText = document.getElementById('offer-context-text');
        if (ctxBanner && ctxBadge && ctxText) {
            ctxBanner.style.display = 'block';
            if (window.orderEditMode) {
                ctxBadge.innerHTML =
                    '<i data-lucide="package" class="icon-xs"></i> Zamówienie (krok 5)';
                ctxBadge.classList.add('badge-ok');
                ctxText.textContent =
                    'Podgląd zamówienia — dane pochodzą z zatwierdzonego zamówienia.';
            } else if (window.editingOfferId) {
                ctxBadge.innerHTML = '<i data-lucide="edit" class="icon-xs"></i> Oferta (krok 3)';
                ctxBadge.classList.add('badge-info');
                ctxText.textContent = 'Podgląd oferty — edytuj pozycje w zakładce Konfiguracja.';
            } else {
                ctxBadge.innerHTML = '<i data-lucide="file-text" class="icon-xs"></i> Nowa oferta';
                ctxBadge.classList.add('badge-muted');
                ctxText.textContent = 'Dodaj produkty w zakładce Konfiguracja.';
            }
            if (window.lucide) lucide.createIcons();
        }
    } else if (id === 'builder') {
        const activeStep = document.querySelector('.wizard-step.active');
        const step = activeStep ? parseInt(activeStep.id.replace('wizard-step-', '')) : 1;
        if (summaryBar) summaryBar.style.display = step === 3 || step === 5 ? 'block' : 'none';
    } else {
        if (summaryBar) summaryBar.style.display = 'none';
    }

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('tab', id);
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
}

window.showSectionRury = showSectionRury;
window.showSection = showSectionRury;

if (typeof registerCspAction === 'function') {
    registerCspAction('addOfferItem', {
        handler: function ({ productId }) {
            addOfferItem(productId);
        },
        params: ['productId']
    });
    registerCspAction('selectCatalogCategory', {
        handler: function ({ category }) {
            selectCatalogCategory(category);
        },
        params: ['category']
    });
    registerCspAction('removeOfferItem', {
        handler: function ({ index }) {
            removeOfferItem(parseInt(index, 10));
        },
        params: ['index']
    });
    registerCspAction('pipeLengthStepDown', function () {
        var input = document.getElementById('pipe-custom-length');
        if (input) input.stepDown();
    });
    registerCspAction('pipeLengthStepUp', function () {
        var input = document.getElementById('pipe-custom-length');
        if (input) input.stepUp();
    });
    registerCspAction('confirmPipeLength', {
        handler: function ({ productId, editIndex }) {
            confirmPipeLength(productId, editIndex !== undefined ? parseInt(editIndex, 10) : null);
        },
        params: ['productId', 'editIndex']
    });
    registerCspAction('showPipeLengthModal', {
        handler: function ({ productId, itemIndex }) {
            showPipeLengthModal(productId, parseInt(itemIndex, 10));
        },
        params: ['productId', 'itemIndex']
    });
    registerCspAction('pipeCheckboxChange', function (target) {
        if (typeof window.updateOrderSelectionCount === 'function') {
            window.updateOrderSelectionCount();
        }
        if (typeof window.onPipeCheckboxChange === 'function') {
            window.onPipeCheckboxChange(target);
        }
    });
    registerCspAction('addPehdToPipe', {
        handler: function ({ index, pehdType }) {
            addPehdToPipe(parseInt(index, 10), pehdType);
        },
        params: ['index', 'pehdType']
    });
}
