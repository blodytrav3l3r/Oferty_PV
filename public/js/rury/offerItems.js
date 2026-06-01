/* ===== POZYCJE OFERTY (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: formularz oferty, katalog, pozycje, uszczelki */
/* Zależności: products, currentOfferItems, CATEGORIES (globalne) */
/* getProductDiameter, getProductLength, getPipeInnerArea, isOneMetrePipe z productHelpers.js */
/* calculateTransportDistribution, updateOfferSummary z transport.js */
/* fmt, fmtInt z shared/formatters.js; showToast, closeModal z shared/ui.js */

/* ===== FORMULARZ OFERTY ===== */

function setupOfferForm() {
    const searchInput = document.getElementById('product-search');
    const dropdown = document.getElementById('product-dropdown');

    searchInput.addEventListener('input', () => {
        const val = searchInput.value.toLowerCase().trim();
        if (val.length < 2) {
            dropdown.classList.remove('show');
            return;
        }
        const matches = products
            .filter(
                (p) =>
                    p.category !== 'Akcesoria PEHD' &&
                    (p.id.toLowerCase().includes(val) || p.name.toLowerCase().includes(val))
            )
            .slice(0, 15);

        if (matches.length === 0) {
            dropdown.classList.remove('show');
            return;
        }
        dropdown.innerHTML = matches
            .map(
                (p) =>
                    `<div class="product-dropdown-item" onclick="addOfferItem('${p.id}')">
        <span>${escapeHtml(p.name)}</span>
        <span class="price">${fmt(p.price)} PLN</span>
      </div>`
            )
            .join('');
        dropdown.classList.add('show');
    });

    searchInput.addEventListener('blur', () =>
        setTimeout(() => dropdown.classList.remove('show'), 200)
    );
    document.getElementById('pricelist-search')?.addEventListener('input', renderPriceList);

    // Ustaw dzisiejszą datę i automatycznie wygeneruj numer oferty
    document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('offer-number').value = generateOfferNumber();

    if (!activeCatalogCategory || activeCatalogCategory === 'Akcesoria PEHD') {
        activeCatalogCategory = CATEGORIES.filter((c) => c !== 'Akcesoria PEHD')[0];
    }
    renderCatalogTabs();
    renderCatalogProducts();
}

/* ===== KATALOG PRODUKTÓW ===== */
let catalogVisible = true;
let activeCatalogCategory = null;

function toggleCatalog() {
    catalogVisible = !catalogVisible;
    const catalog = document.getElementById('product-catalog');
    const btn = document.getElementById('toggle-catalog-btn');
    if (catalogVisible) {
        catalog.style.display = 'block';
        btn.innerHTML = '<i data-lucide="folder-open" aria-hidden="true"></i> Ukryj katalog produktów';
        if (window.lucide) lucide.createIcons();
        if (!activeCatalogCategory || activeCatalogCategory === 'Akcesoria PEHD')
            activeCatalogCategory = CATEGORIES.filter((c) => c !== 'Akcesoria PEHD')[0];
        renderCatalogTabs();
        renderCatalogProducts();
    } else {
        catalog.style.display = 'none';
        btn.innerHTML = '<i data-lucide="folder-open" aria-hidden="true"></i> Pokaż katalog produktów';
        if (window.lucide) lucide.createIcons();
    }
}

function renderCatalogTabs() {
    const container = document.getElementById('catalog-tabs');
    container.innerHTML = CATEGORIES.filter((cat) => cat !== 'Akcesoria PEHD')
        .map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
            return `<button class="catalog-tab${cat === activeCatalogCategory ? ' active' : ''}" onclick="selectCatalogCategory('${cat}')">${cat} <span style="opacity:.6">(${count})</span></button>`;
        })
        .join('');
}

function selectCatalogCategory(cat) {
    activeCatalogCategory = cat;
    renderCatalogTabs();
    renderCatalogProducts();
}

function renderCatalogProducts() {
    const container = document.getElementById('catalog-products');
    const items = products.filter((p) => p.category === activeCatalogCategory);
    if (items.length === 0) {
        container.innerHTML =
            '<div style="padding:1rem;color:var(--text-muted);font-size:.85rem">Brak produktów w tej kategorii</div>';
        return;
    }

    // Grupuj produkty według średnicy
    const grouped = {};
    items.forEach((p) => {
        const diameter = getProductDiameter(p.id);
        const diamKey = diameter ? `DN ${diameter}` : 'Inne';
        if (!grouped[diamKey]) grouped[diamKey] = [];
        grouped[diamKey].push(p);
    });

    // Sortuj średnice numerycznie
    const diamKeys = Object.keys(grouped).sort((a, b) => {
        const da = parseInt(a.replace('DN ', '')) || 99999;
        const db = parseInt(b.replace('DN ', '')) || 99999;
        return da - db;
    });

    let html = '<div class="catalog-list">';

    diamKeys.forEach((diamKey) => {
        html += `<div class="catalog-diam-header">⌀ ${diamKey}</div>`;
        grouped[diamKey].forEach((p) => {
            const is1m = isOneMetrePipe(p.id);
            html += `
      <div class="catalog-item-row${is1m ? ' catalog-item-1m' : ''}" onclick="addOfferItem('${p.id}')">
        <div class="catalog-item-row-name">${escapeHtml(p.name)}</div>
        <div class="catalog-item-row-meta">
          <span class="catalog-item-row-id">${escapeHtml(p.id)}</span>
          ${p.weight ? `<span class="catalog-item-row-weight">${fmtInt(p.weight)} kg</span>` : ''}
        </div>
        <div class="catalog-item-row-price">${fmt(p.price)} PLN</div>
        <button class="catalog-item-add" onclick="event.stopPropagation();addOfferItem('${p.id}')">+ Dodaj</button>
      </div>`;
        });
    });

    html += '</div>';
    container.innerHTML = html;
}

function generateOfferNumber() {
    const d = new Date();
    const year = d.getFullYear();
    let symbol = 'XX';
    if (typeof currentUser !== 'undefined' && currentUser) {
        if (currentUser.symbol) {
            symbol = currentUser.symbol;
        } else if (currentUser.firstName && currentUser.lastName) {
            symbol = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();
        } else if (currentUser.username) {
            symbol = currentUser.username.substring(0, 2).toUpperCase();
        }
    }

    const count = typeof offers !== 'undefined' ? offers.length + 1 : 1;
    return `OF/${String(count).padStart(6, '0')}/${symbol}/${year}`;
}

/* ===== DODAWANIE POZYCJI ===== */

function addOfferItem(productId) {
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

function showPipeLengthModal(productId, editIndex = null) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const diam = getProductDiameter(product.id);
    const maxL = diam === 2200 ? 2.5 : 3;

    let currentVal = getProductLength(product.id) / 1000 || 3;
    if (editIndex !== null) {
        const item = currentOfferItems[editIndex];
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
            style="font-size:2.5rem; padding:1rem; width:140px; text-align:center; font-weight:800; border: 2px solid var(--primary); border-radius: 12px; color: var(--primary); background: transparent;">
          <button class="btn btn-secondary" style="border-radius:50%; width: 44px; height: 44px; padding: 0; font-size: 1.5rem; display: flex; align-items: center; justify-content: center;" onclick="document.getElementById('pipe-custom-length').stepUp()">+</button>
        </div>
        <div style="margin-top:1rem; font-size:0.9rem; color:var(--text-muted); display: flex; justify-content: center; gap: 1rem;">
          <span style="background: var(--bg-hover); padding: 0.25rem 0.5rem; border-radius: 4px;">Min: <strong>1.0m</strong></span>
          <span style="background: var(--bg-hover); padding: 0.25rem 0.5rem; border-radius: 4px;">Max: <strong>${maxL}m</strong></span>
        </div>
      </div>
      <div class="modal-footer" style="margin-top:1.5rem; border-top: 1px solid var(--border); padding-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
        <button class="btn btn-secondary" onclick="closeModal()" style="padding: 0.75rem 1.5rem;">Anuluj</button>
        <button class="btn btn-primary" onclick="confirmPipeLength('${productId}', ${editIndex})" style="padding: 0.75rem 2rem; font-size:1.05rem; font-weight: 600; box-shadow: 0 4px 6px -1px var(--primary-alpha);">Zatwierdź <i data-lucide="arrow-right" aria-hidden="true"></i></button>
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

function doAddOfferItem(productId, customLengthM) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Sprawdź, czy dokładnie ten sam produkt (produkt + długość) został już dodany
    const existingItemIndex = currentOfferItems.findIndex(
        (i) => i.productId === productId && (i.customLengthM || null) === (customLengthM || null)
    );
    if (existingItemIndex !== -1) {
        updateItem(
            existingItemIndex,
            'quantity',
            currentOfferItems[existingItemIndex].quantity + 1
        );
        showToast(`Zwiększono ilość: ${product.name}`, 'info');
        document.getElementById('product-search').value = '';
        document.getElementById('product-dropdown').classList.remove('show');
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

    currentOfferItems.push(item);

    if (customLengthM && customLengthM !== lengthM) {
        const newIndex = currentOfferItems.length - 1;
        updatePipeLength(newIndex, customLengthM, true);
    } else {
        syncGaskets(); syncTransportSecurity();
        document.getElementById('product-search').value = '';
        document.getElementById('product-dropdown').classList.remove('show');
        renderOfferItems();
        showToast('Dodano: ' + product.name.substring(0, 40) + '...', 'success');
    }
}

/* ===== SYNCHRONIZACJA USZCZELEK ===== */

function syncGaskets() {
    if (!currentOfferItems.some(i => i.ordered && !i.autoAdded)) {
        // no ordered non-auto items, proceed normally
    } else if (!window.orderEditMode) {
        return; // ordered items exist and we're not in order edit mode — skip gasket sync
    }
    const req = {};

    currentOfferItems.forEach((item) => {
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

    for (let i = currentOfferItems.length - 1; i >= 0; i--) {
        const item = currentOfferItems[i];
        if (item.autoAdded && !item.productId.startsWith('ZT-')) {
            if (req[item.productId] && req[item.productId].qty > 0) {
                item.quantity = req[item.productId].qty;
                req[item.productId].qty = 0; // obsłużone
            } else {
                currentOfferItems.splice(i, 1);
            }
        }
    }

    Object.values(req).forEach((r) => {
        if (r.qty > 0) {
            currentOfferItems.push({
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

/* ===== ZABEZPIECZENIE TRANSPORTU — STAN I TOGGLE ===== */

let zabezpieczenieTransportuEnabled = true;
window.zabezpieczenieTransportuEnabled = zabezpieczenieTransportuEnabled;

window.setZabezpieczenieTransportu = function (enabled) {
    window.zabezpieczenieTransportuEnabled = enabled;
    updateZabezpieczenieTransportuUI();
    syncTransportSecurity(!enabled);
    renderOfferItems();
    updateOfferSummary();
};

function updateZabezpieczenieTransportuUI() {
    const tak = document.getElementById('zt-toggle-tak');
    const nie = document.getElementById('zt-toggle-nie');
    if (tak && nie) {
        tak.classList.toggle('active', !!window.zabezpieczenieTransportuEnabled);
        nie.classList.toggle('active', !window.zabezpieczenieTransportuEnabled);
    }
}
window.updateZabezpieczenieTransportuUI = updateZabezpieczenieTransportuUI;

/* ===== SYNCHRONIZACJA ZABEZPIECZENIA TRANSPORTU ===== */

function syncTransportSecurity(forceRemove) {
    const hasNonAutoOrdered = currentOfferItems.some(i => i.ordered && !i.autoAdded);
    if (hasNonAutoOrdered && !window.orderEditMode && !forceRemove) return;
    if (forceRemove || !window.zabezpieczenieTransportuEnabled) {
        let removed = false;
        for (let i = currentOfferItems.length - 1; i >= 0; i--) {
            if (currentOfferItems[i].autoAdded && currentOfferItems[i].productId.startsWith('ZT-')) {
                currentOfferItems.splice(i, 1);
                removed = true;
            }
        }
        return removed;
    }

    const req = {};

    currentOfferItems.forEach((item) => {
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

    for (let i = currentOfferItems.length - 1; i >= 0; i--) {
        const item = currentOfferItems[i];
        if (item.autoAdded && item.productId.startsWith('ZT-')) {
            if (req[item.productId] && req[item.productId].qty > 0) {
                item.quantity = req[item.productId].qty;
                req[item.productId].qty = 0;
            } else {
                currentOfferItems.splice(i, 1);
            }
        }
    }

    Object.values(req).forEach((r) => {
        if (r.qty > 0) {
            currentOfferItems.push({
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

function addPehdToPipe(pipeIndex, pehdId) {
    if (currentOfferItems[pipeIndex]?.ordered && !window.orderEditMode) return;
    const pipe = currentOfferItems[pipeIndex];
    const area = getPipeInnerArea(pipe.productId);
    if (area <= 0) return;

    const pehdProd = products.find((p) => p.id === pehdId);
    if (!pehdProd) return;

    if (pipe.pehdType === pehdId) {
        pipe.pehdType = null;
        pipe.pehdCostPerUnit = 0;
        showToast('Wkładka usunięta', 'info');
    } else {
        pipe.pehdType = pehdId;
        let ratio = 1;
        if (pipe.customLengthM) {
            const origL = getProductLength(pipe.productId) / 1000;
            if (origL > 0) ratio = pipe.customLengthM / origL;
        }
        pipe.pehdCostPerUnit = area * ratio * pehdProd.price;
        showToast('Wkładka została przypisana do rury', 'success');
    }

    renderOfferItems();
}

/* ===== RENDEROWANIE POZYCJI OFERTY ===== */

function renderOfferItems() {
    const tbody = document.getElementById('offer-items-body');
    if (currentOfferItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" class="text-center" style="padding:2rem;color:var(--text-muted)">
      Wróć do kroku 2 aby dodać produkty</td></tr>`;
        updateOfferSummary();
        return;
    }

    // Odfiltruj wszelkie pozostałe samodzielne elementy PEHD z poprzednich wersji
    currentOfferItems = currentOfferItems.filter((i) => !i.isPehd);

    // Synchronizuj wagi z cennika (aby zmiany w cenniku były widoczne natychmiast)
    currentOfferItems.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product !== undefined) {
            if (!item.name) item.name = product.name;
            if (item.unitPrice === undefined) item.unitPrice = product.price;

            if (!item.customLengthM) {
                item.weight = product.weight;
                item.transport = product.transport;
                item.lengthM = getProductLength(item.productId) / 1000;
            }
        } else {
            // Rozwiązanie rezerwowe, jeśli produkt nie znajduje się już w katalogu
            if (!item.name) item.name = 'Nieznany produkt (' + item.productId + ')';
        }

        // Poprawka dla starych zapisanych ofert: oblicz metry, jeśli brakuje, ale ilość > 0
        if (!item.meters && item.quantity > 0 && item.lengthM > 0) {
            item.meters = item.quantity * item.lengthM;
        }

        // Synchronizuj również cenę PEHD, jeśli dodano PEHD
        if (item.pehdType) {
            const pehdProd = products.find((p) => p.id === item.pehdType);
            if (pehdProd) {
                const area = getPipeInnerArea(item.productId);
                let ratio = 1;
                if (item.customLengthM) {
                    const origL = getProductLength(item.productId) / 1000;
                    if (origL > 0) ratio = item.customLengthM / origL;
                }
                item.pehdCostPerUnit = area * ratio * pehdProd.price;
            }
        }
    });

    // Backfill uid + ordered status z istniejących zamówień
    const orderedUids = new Set();
    if (typeof ordersRury !== 'undefined' && ordersRury && editingOfferId) {
        const offerOrders = ordersRury.filter(o => o.offerId === editingOfferId);
        offerOrders.forEach(order => {
            if (order.items) {
                order.items.forEach(oi => { if (oi.uid) orderedUids.add(oi.uid); });
            }
        });
    }
    currentOfferItems.forEach(item => {
        if (!item.uid) item.uid = 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        if (orderedUids.has(item.uid)) item.ordered = true;
    });

    // Wstępnie oblicz rozkład transportu dla wszystkich pozycji
    const transportDist = calculateTransportDistribution(currentOfferItems);

    // Grupuj pozycje według kategorii, a następnie według średnicy
    const grouped = {};
    currentOfferItems.forEach((item, i) => {
        const product = products.find((p) => p.id === item.productId);
        const category = product ? product.category : 'Inne';
        if (!grouped[category]) grouped[category] = {};
        let diameter = getProductDiameter(item.productId);
        // ID uszczelek takich jak Y-U-GZ-U-14-BU mają średnicę w części parts[4]
        if (!diameter && item.productId) {
            const parts = item.productId.split('-');
            if (parts.length >= 5) {
                const code = parseInt(parts[4]);
                if (!isNaN(code) && code > 0) diameter = code * 100;
            }
        }
        const diamKey = diameter ? `DN ${diameter}` : 'Inne';
        if (!grouped[category][diamKey]) grouped[category][diamKey] = [];
        grouped[category][diamKey].push({ item, originalIndex: i, diameter });
    });

    // Sortuj kategorie według ich kolejności w CATEGORIES
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const ia = CATEGORIES.indexOf(a);
        const ib = CATEGORIES.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    let html = '';
    let lp = 1;

    sortedCategories.forEach((cat) => {
        // Wiersz nagłówka kategorii
        html += `<tr class="offer-cat-header"><td colspan="14">${cat}</td></tr>`;

        // Sortuj średnice numerycznie
        const diamKeys = Object.keys(grouped[cat]).sort((a, b) => {
            const da = parseInt(a.replace('DN ', '')) || 99999;
            const db = parseInt(b.replace('DN ', '')) || 99999;
            return da - db;
        });

        diamKeys.forEach((diamKey) => {
            // Wiersz podnagłówka średnicy
            html += `<tr class="offer-diam-header"><td colspan="14">⌀ ${diamKey}</td></tr>`;

            grouped[cat][diamKey].sort((a, b) => {
                // Bosy-Bosy zawsze pierwsze
                const aBB =
                    a.item.name.toLowerCase().includes('bosy') || a.item.productId.endsWith('-B00');
                const bBB =
                    b.item.name.toLowerCase().includes('bosy') || b.item.productId.endsWith('-B00');
                if (aBB !== bBB) return aBB ? -1 : 1;
                // Następnie według długości rosnąco
                return (a.item.lengthM || 0) - (b.item.lengthM || 0);
            });

            grouped[cat][diamKey].forEach(({ item, originalIndex: i }) => {
                const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
                const pehdCost = item.pehdCostPerUnit || 0;
                const surcharge = item.surcharge || 0;
                const priceAfterDiscount = basePriceAfterDiscount + pehdCost + surcharge;

                const transportPerUnit = transportDist[item.productId] || 0;
                const unitTotal = priceAfterDiscount + transportPerUnit;
                const netto = unitTotal * item.quantity;
                const vat = netto * 0.23;
                const brutto = netto + vat;
                const hasLength = item.lengthM && item.lengthM > 0;
                const metersVal = hasLength ? item.meters || 0 : '';
                const autoTag = item.autoAdded
                    ? ' <span style="font-size:.65rem;color:var(--warn);opacity:.8">(auto)</span>'
                    : '';
                const is1m = isOneMetrePipe(item.productId);

                let pName = escapeHtml(item.name);
                if (item.pehdType === 'PEHD-3MM')
                    pName +=
                        ' <span style="color:var(--primary);font-weight:bold">+ PEHD 3mm</span>';
                if (item.pehdType === 'PEHD-4MM')
                    pName +=
                        ' <span style="color:var(--primary);font-weight:bold">+ PEHD 4mm</span>';

                let rowClass = '';
                let rowStyle = '';
                if (item.autoAdded) {
                    rowStyle = 'background:rgba(245,158,11,0.04)';
                } else if (is1m) {
                    rowClass = 'row-1m';
                }
                const activePehdStyle =
                    'font-size:0.65rem; padding: 0.2rem 0.5rem; margin-top:2px; background:#10b981; color:white; border:none; box-shadow:0 0 10px rgba(16,185,129,0.3); font-weight:700; border-radius:4px;';
                const inactivePehdStyle =
                    'font-size:0.6rem; padding: 0.2rem 0.4rem; margin-top:2px; background:var(--bg-hover); color:var(--text-muted); border:1px solid var(--border); border-radius:4px; transition:all 0.2s ease;';

                const active3mm =
                    item.pehdType === 'PEHD-3MM'
                        ? `style="${activePehdStyle}"`
                        : `style="${inactivePehdStyle}"`;
                const active4mm =
                    item.pehdType === 'PEHD-4MM'
                        ? `style="${activePehdStyle}"`
                        : `style="${inactivePehdStyle}"`;

                const isEditableLength =
                    cat === 'Rury Jajowe Betonowe' ||
                    cat === 'Rury Jajowe Żelbetowe' ||
                    cat === 'Duże Żelbetowe II';
                const lengthEditor =
                    isEditableLength && hasLength
                        ? `<br><div style="margin-top:6px;"><button class="btn-icon" style="font-size:0.75rem; padding:0.2rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text);" onclick="showPipeLengthModal('${item.productId}', ${i})" title="Zmień długość rury i automatycznie przelicz wagę oraz transport"><i data-lucide="ruler"></i> Dł. rury: <strong style="color:var(--primary)">${fmt(item.customLengthM || item.lengthM)}m</strong> <i data-lucide="pencil"></i></button></div>`
                        : '';

                const isOrdered = item.ordered === true;
                const isLocked = isOrdered && !window.orderEditMode;
                const checkboxCell = isOrdered
                    ? '<td style="text-align:center;"><i data-lucide="package-check" style="width:16px;height:16px;color:#a5b4fc"></i></td>'
                    : `<td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox" class="item-order-checkbox" data-uid="${item.uid}" onchange="updateOrderSelectionCount()" style="cursor:pointer;width:16px;height:16px"></td>`;
                const orderedRowStyle = isOrdered ? 'border-left:3px solid rgba(99,102,241,0.5); background:rgba(99,102,241,0.04);' : '';
                const lockAttr = isLocked ? ' disabled' : '';

                html += `<tr class="${rowClass}" ${rowStyle ? `style="${rowStyle}${orderedRowStyle}"` : `style="${orderedRowStyle}"`}>
          ${checkboxCell}
          <td>${lp++}</td>
          <td style="max-width:280px">${pName}${autoTag}${lengthEditor}</td>
          <td class="text-right">${fmt(item.unitPrice)}</td>
          <td class="text-center">${
              hasLength
                  ? `<input type="number" class="edit-input" style="width:75px;text-align:center" min="0" step="0.1" value="${metersVal}" onfocus="this.select()" onchange="updateItemMeters(${i},this.value)" title="Metry bieżące"${lockAttr}> m`
                  : '—'
          }</td>
          <td class="text-center"><input type="number" class="edit-input" style="width:75px;text-align:center" min="1" value="${item.quantity}" onfocus="this.select()" onchange="updateItem(${i},'quantity',this.value)"${lockAttr}> szt.</td>
          <td class="text-center"><input type="number" class="edit-input" style="width:75px;text-align:center" min="0" max="100" step="0.5" value="${item.discount}" onfocus="this.select()" onchange="updateItem(${i},'discount',this.value)"${lockAttr}>%</td>
          <td class="text-right">${fmt(unitTotal)}</td>
          <td class="text-center"><input type="number" class="edit-input" style="width:75px;text-align:center" min="0" step="0.01" value="${item.surcharge || 0}" onfocus="this.select()" onchange="updateItem(${i},'surcharge',this.value)"${lockAttr}></td>
          <td class="text-right" style="color:var(--warn)">${transportPerUnit > 0 ? fmt(transportPerUnit) : '—'}</td>
          <td class="text-right" style="font-weight:600">${fmt(netto)}</td>
          <td class="text-right">${fmt(brutto)}</td>
          <td class="text-center"><input type="text" class="edit-input" style="width:200px;text-align:center" value="${item.commercialVersion || ''}" onchange="updateItemText(${i},'commercialVersion',this.value)" placeholder="Notatki"${lockAttr}></td>
          <td class="text-center" style="white-space:nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center;">
              ${
                  getPipeInnerArea(item.productId) > 0 && !item.autoAdded
                      ? `
                <div style="display: flex; flex-direction: column; gap: 2px;${isLocked ? ' display:none;' : ''}">
                  <button class="btn btn-sm btn-secondary" ${active3mm} onclick="addPehdToPipe(${i}, 'PEHD-3MM')" title="Dolicz wkładkę 3mm">+ PEHD 3mm</button>
                  <button class="btn btn-sm btn-secondary" ${active4mm} onclick="addPehdToPipe(${i}, 'PEHD-4MM')" title="Dolicz wkładkę 4mm">+ PEHD 4mm</button>
                </div>
              `
                      : ''
              }
              <button class="btn-icon" title="Usuń" aria-label="Usuń" onclick="removeOfferItem(${i})"${isLocked ? ' style="display:none"' : ''}><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
          </td>
        </tr>`;
            });
        });
    });

    tbody.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    updateOfferSummary();
}

/* ===== AKTUALIZACJA POZYCJI ===== */

function updatePipeLength(index, newLengthM, skipRender = false) {
    const item = currentOfferItems[index];
    let newL = Number(newLengthM);

    const diameter = getProductDiameter(item.productId);
    const maxLength = diameter === 2200 ? 2.5 : 3;

    if (newL < 1) {
        newL = 1;
        showToast('Minimalna długość rury to 1m', 'error');
    } else if (newL > maxLength) {
        newL = maxLength;
        showToast(`Maksymalna długość tej rury to ${maxLength}m`, 'error');
    }

    const product = products.find((p) => p.id === item.productId);
    if (!product) return;

    const originalLengthM = getProductLength(product.id) / 1000;
    if (!originalLengthM || originalLengthM <= 0) return;

    if (newL === originalLengthM) {
        item.customLengthM = null;
        item.lengthM = originalLengthM;
        item.weight = product.weight;
        item.transport = product.transport;
        item.name = product.name; // resetuj nazwę
    } else {
        item.customLengthM = newL;
        item.lengthM = newL;

        if (product.weight) {
            const weightPerMeter = product.weight / originalLengthM;
            item.weight = Math.round(weightPerMeter * newL);

            const truckCapacity = product.weight * product.transport || 24000;
            item.transport = Math.max(1, Math.floor(truckCapacity / item.weight));
        }

        // Aktualizuj nazwę dynamicznie
        const lOriginalMm = Math.round(originalLengthM * 1000);
        const lNewMm = Math.round(newL * 1000);
        if (product.name.includes(` / ${lOriginalMm}`)) {
            item.name = product.name.replace(` / ${lOriginalMm}`, ` / ${lNewMm}`);
        } else {
            item.name = `${product.name} (L=${newL}m)`;
        }
    }

    item.meters = item.quantity * item.lengthM;

    if (!skipRender) {
        syncGaskets(); syncTransportSecurity();
        renderOfferItems();
        updateOfferSummary();
        showToast('Przeliczono uciętą rurę (waga, transport, nazwa)', 'info');
    } else {
        syncGaskets(); syncTransportSecurity();
        document.getElementById('product-search').value = '';
        document.getElementById('product-dropdown').classList.remove('show');
        renderOfferItems();
        showToast('Dodano: ' + item.name.substring(0, 40) + '...', 'success');
    }
}

function updateItemText(index, field, value) {
    const item = currentOfferItems[index];
    if (item?.ordered && !window.orderEditMode) return;
    if (item) {
        item[field] = value;
    }
}

function updateItem(index, field, value) {
    const item = currentOfferItems[index];
    if (item?.ordered && !window.orderEditMode) return;
    const numVal = Number(value);

    // Ostrzeżenie o rabacie na uszczelki
    if (field === 'discount' && numVal > 0) {
        const isGasket =
            item.autoAdded ||
            item.name.toLowerCase().includes('uszczelk') ||
            (item.productId && item.productId.includes('Y-U-GZ-U'));
        if (isGasket) {
            showToast('UWAGA! Wpisujesz rabat na uszczelki!', 'warning');
        }
    }

    item[field] = numVal;
    // Jeśli ilość się zmieniła i produkt ma długość, przelicz metry
    if (field === 'quantity' && item.lengthM) {
        item.meters = numVal * item.lengthM;
    }

    syncGaskets(); syncTransportSecurity();
    renderOfferItems();
}

function updateItemMeters(index, metersValue) {
    const item = currentOfferItems[index];
    if (item?.ordered && !window.orderEditMode) return;
    const meters = Number(metersValue);
    item.meters = meters;
    if (item.lengthM && item.lengthM > 0) {
        item.quantity = Math.ceil(meters / item.lengthM);
        if (item.quantity < 1 && meters > 0) item.quantity = 1;
        if (meters === 0) item.quantity = 0;
    }

    syncGaskets(); syncTransportSecurity();
    renderOfferItems();
}

function removeOfferItem(index) {
    if (currentOfferItems[index]?.ordered && !window.orderEditMode) return;
    currentOfferItems.splice(index, 1);
    syncGaskets(); syncTransportSecurity();
    renderOfferItems();
}

/* ===== SELEKCJA POZYCJI DO ZAMÓWIENIA ===== */

window.toggleAllItemsForOrder = function (checked) {
    document.querySelectorAll('.item-order-checkbox').forEach(cb => {
        cb.checked = checked;
    });
};

window.updateOrderSelectionCount = function () {
    const total = document.querySelectorAll('.item-order-checkbox').length;
    const checked = document.querySelectorAll('.item-order-checkbox:checked').length;
    const selectAll = document.getElementById('select-all-items');
    if (selectAll) {
        selectAll.checked = total > 0 && checked === total;
        selectAll.indeterminate = checked > 0 && checked < total;
    }
};

window.collectSelectedItemsForOrder = function () {
    const offerTabActive = document.getElementById('section-offer')?.classList?.contains('active');
    const selector = offerTabActive ? '.offer-summary-checkbox:checked' : '.item-order-checkbox:checked';
    const selected = [];
    document.querySelectorAll(selector).forEach(cb => {
        const uid = cb.dataset.uid;
        const item = currentOfferItems.find(it => it.uid === uid);
        if (item) selected.push(item);
    });
    return selected;
};
