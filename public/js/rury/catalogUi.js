/* ===== KATALOG PRODUKTÓW (RURY) ===== */
let catalogVisible = true;
window.activeCatalogCategory = null;
const MAX_TRANSPORT_WEIGHT = 24000;

function toggleCatalog() {
    catalogVisible = !catalogVisible;
    const catalog = document.getElementById('product-catalog');
    const btn = document.getElementById('toggle-catalog-btn');
    if (catalogVisible) {
        catalog.style.display = 'block';
        btn.innerHTML =
            '<i data-lucide="folder-open" aria-hidden="true"></i> Ukryj katalog produktów';
        if (window.lucide) lucide.createIcons();
        if (!window.activeCatalogCategory || window.activeCatalogCategory === 'Akcesoria PEHD')
            window.activeCatalogCategory = CATEGORIES.filter((c) => c !== 'Akcesoria PEHD')[0];
        renderCatalogTabs();
        renderCatalogProducts();
    } else {
        catalog.style.display = 'none';
        btn.innerHTML =
            '<i data-lucide="folder-open" aria-hidden="true"></i> Pokaż katalog produktów';
        if (window.lucide) lucide.createIcons();
    }
}

function renderCatalogTabs() {
    const container = document.getElementById('catalog-tabs');
    const hiddenCategories = ['Akcesoria PEHD', 'Zabezpieczenie transportu'];
    container.innerHTML = CATEGORIES.filter((cat) => !hiddenCategories.includes(cat))
        .map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
            return `<button class="catalog-tab${cat === window.activeCatalogCategory ? ' active' : ''}" onclick="selectCatalogCategory('${cat}')">${cat} <span style="opacity:.6">(${count})</span></button>`;
        })
        .join('');
}

function selectCatalogCategory(cat) {
    window.activeCatalogCategory = cat;
    renderCatalogTabs();
    renderCatalogProducts();
}

function renderCatalogProducts() {
    const container = document.getElementById('catalog-products');
    const items = products.filter((p) => p.category === window.activeCatalogCategory);
    if (items.length === 0) {
        container.innerHTML =
            '<div style="padding:1rem;color:var(--text-muted);font-size:.85rem">Brak produktów w tej kategorii</div>';
        return;
    }

    const grouped = {};
    items.forEach((p) => {
        const diameter = getProductDiameter(p.id);
        const diamKey = diameter ? `DN ${diameter}` : 'Inne';
        if (!grouped[diamKey]) grouped[diamKey] = [];
        grouped[diamKey].push(p);
    });

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
