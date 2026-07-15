// @ts-check
/* ===== SYNCHRONIZACJA USZCZELEK I ZABEZPIECZENIA TRANSPORTU (RURY) ===== */

function syncGaskets() {
    const activeItems = getActiveItemsArray();
    if (!activeItems.some((i) => i.ordered && !i.autoAdded)) {
        // no ordered non-auto items, proceed normally
    } else if (!window.orderEditMode) {
        return; // ordered items exist and we're not in order edit mode — skip gasket sync
    }
    const req = {};

    activeItems.forEach((item) => {
        if (!item.autoAdded && item.quantity > 0) {
            const product = products.find((p) => p.id === item.productId);
            if (product && product.category === 'Duże Żelbetowe II') {
                const diam = getProductDiameter(item.productId);
                if (diam) {
                    const kw = diam.toString();
                    const gasket = products.find(
                        (p) =>
                            p.category === 'Uszczelki' && (p.name.includes(kw) || p.id.includes(kw))
                    );
                    if (gasket) {
                        const isBosy = product.name.toLowerCase().includes('bosy-bosy');
                        const qtyPerPipe = isBosy ? 2 : 1;
                        if (!req[gasket.id]) req[gasket.id] = { product: gasket, qty: 0 };
                        req[gasket.id].qty += item.quantity * qtyPerPipe;
                    }
                }
            }
        }
    });

    for (let i = activeItems.length - 1; i >= 0; i--) {
        const item = activeItems[i];
        if (item.autoAdded && !item.productId.startsWith('ZT-')) {
            if (req[item.productId] && req[item.productId].qty > 0) {
                item.quantity = req[item.productId].qty;
                req[item.productId].qty = 0;
            } else {
                activeItems.splice(i, 1);
            }
        }
    }

    Object.values(req).forEach((r) => {
        if (r.qty > 0) {
            activeItems.push({
                uid: 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                productId: r.product.id,
                name: r.product.name,
                unitPrice: r.product.price,
                quantity: r.qty,
                meters: 0,
                lengthM: null,
                discount: 0,
                weight: r.product.weight,
                transport: r.product.transport,
                autoAdded: true,
                linkedTo: null
            });
            showToast(`Automatycznie zaktualizowano uszczelki: ${r.product.name}`, 'info');
        }
    });
}

window.zabezpieczenieTransportuEnabled = true;

window.setZabezpieczenieTransportu = function (enabled) {
    window.zabezpieczenieTransportuEnabled = enabled;
    updateZabezpieczenieTransportuUI();
    syncTransportSecurity(!enabled);
    renderOfferItems();
    updateOfferSummary();
};

function updateZabezpieczenieTransportuUI() {
    document.querySelectorAll('.zt-toggle-tak-btn').forEach((el) => {
        el.classList.toggle('active', !!window.zabezpieczenieTransportuEnabled);
    });
    document.querySelectorAll('.zt-toggle-nie-btn').forEach((el) => {
        el.classList.toggle('active', !window.zabezpieczenieTransportuEnabled);
    });
}
window.updateZabezpieczenieTransportuUI = updateZabezpieczenieTransportuUI;

function syncTransportSecurity(forceRemove) {
    const activeItems = getActiveItemsArray();
    const hasNonAutoOrdered = activeItems.some((i) => i.ordered && !i.autoAdded);
    if (hasNonAutoOrdered && !window.orderEditMode && !forceRemove) return;
    if (forceRemove || !window.zabezpieczenieTransportuEnabled) {
        let removed = false;
        for (let i = activeItems.length - 1; i >= 0; i--) {
            if (activeItems[i].productId?.startsWith('ZT-')) {
                activeItems.splice(i, 1);
                removed = true;
            }
        }
        return removed;
    }

    const req = {};

    activeItems.forEach((item) => {
        if (!item.autoAdded && item.quantity > 0) {
            const product = products.find((p) => p.id === item.productId);
            if (product && product.category !== 'Zabezpieczenie transportu') {
                const diam = getProductDiameter(item.productId);
                if (diam) {
                    const ztId = 'ZT-' + String(diam).padStart(4, '0');
                    const ztProduct = products.find((p) => p.id === ztId);
                    if (ztProduct) {
                        if (!req[ztId]) req[ztId] = { product: ztProduct, qty: 0 };
                        req[ztId].qty += item.quantity;
                    }
                }
            }
        }
    });

    for (let i = activeItems.length - 1; i >= 0; i--) {
        const item = activeItems[i];
        if (!item.productId?.startsWith('ZT-')) continue;
        const ztProduct = products.find((p) => p.id === item.productId);
        if (!ztProduct || ztProduct.category !== 'Zabezpieczenie transportu') continue;
        if (req[item.productId] && req[item.productId].qty > 0) {
            item.quantity = req[item.productId].qty;
            item.autoAdded = true;
            req[item.productId].qty = 0;
        } else {
            activeItems.splice(i, 1);
        }
    }

    Object.values(req).forEach((r) => {
        if (r.qty > 0) {
            activeItems.push({
                uid: 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                productId: r.product.id,
                name: r.product.name,
                unitPrice: r.product.price,
                quantity: r.qty,
                meters: 0,
                lengthM: null,
                discount: 0,
                weight: null,
                transport: null,
                autoAdded: true
            });
        }
    });
}
