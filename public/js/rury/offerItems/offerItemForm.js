// @ts-check
/* ===== POZYCJE OFERTY — FORMULARZ I KATALOG ===== */
/* Wydzielone z offerItems.js */
/* Zależności: products, CATEGORIES, currentUser, offers (globalne) */
/* getProductDiameter, isOneMetrePipe z productHelpers.js */
/* fmt, fmtInt z shared/formatters.js; escapeHtml z shared/escapeHtml.js */

function setupOfferForm() {
    const searchInput = document.getElementById('product-search');
    const dropdown = document.getElementById('product-dropdown');

    if (searchInput) {
        const doSearch = () => {
            const val = searchInput.value.toLowerCase().trim();
            if (val.length < 2) {
                dropdown.classList.remove('show');
                return;
            }
            const excludedCategories = ['Akcesoria PEHD', 'Zabezpieczenie transportu'];
            const matches = products
                .filter(
                    (p) =>
                        !excludedCategories.includes(p.category) &&
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
                        `<div class="product-dropdown-item" data-action="addOfferItem" data-product-id="${p.id}">
        <span>${escapeHtml(p.name)}</span>
        <span class="price">${fmt(p.price)} PLN</span>
      </div>`
                )
                .join('');
            dropdown.classList.add('show');
        };
        const debouncedSearch =
            typeof window.debounce === 'function' ? window.debounce(doSearch, 200) : doSearch;
        searchInput.addEventListener('input', debouncedSearch);

        searchInput.addEventListener('blur', () =>
            setTimeout(() => dropdown.classList.remove('show'), 200)
        );
    }
    const plSearch = document.getElementById('pricelist-search');
    if (plSearch) {
        const debouncedRender =
            typeof window.debounce === 'function'
                ? window.debounce(renderPriceList, 200)
                : renderPriceList;
        plSearch.addEventListener('input', debouncedRender);
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('offer-date', new Date().toISOString().slice(0, 10));
    setVal('offer-number', generateOfferNumber());

    const hiddenCategories = ['Akcesoria PEHD', 'Zabezpieczenie transportu'];
    if (!activeCatalogCategory || hiddenCategories.includes(activeCatalogCategory)) {
        activeCatalogCategory = CATEGORIES.filter((c) => !hiddenCategories.includes(c))[0];
    }
    renderCatalogTabs();
    renderCatalogProducts();
}

let catalogVisible = true;
let activeCatalogCategory = null;

function toggleCatalog() {
    catalogVisible = !catalogVisible;
    const catalog = document.getElementById('product-catalog');
    const btn = document.getElementById('toggle-catalog-btn');
    if (catalogVisible) {
        catalog.style.display = 'block';
        btn.innerHTML =
            '<i data-lucide="folder-open" aria-hidden="true"></i> Ukryj katalog produktów';
        if (window.lucide) lucide.createIcons();
        if (!activeCatalogCategory || activeCatalogCategory === 'Akcesoria PEHD')
            activeCatalogCategory = CATEGORIES.filter((c) => c !== 'Akcesoria PEHD')[0];
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
            return `<button class="catalog-tab${cat === activeCatalogCategory ? ' active' : ''}" data-action="selectCatalogCategory" data-category="${cat}">${cat} <span style="opacity:.6">(${count})</span></button>`;
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
      <div class="catalog-item-row${is1m ? ' catalog-item-1m' : ''}" data-action="addOfferItem" data-product-id="${p.id}">
        <div class="catalog-item-row-name">${escapeHtml(p.name)}</div>
        <div class="catalog-item-row-meta">
          <span class="catalog-item-row-id">${escapeHtml(p.id)}</span>
          ${p.weight ? `<span class="catalog-item-row-weight">${fmtInt(p.weight)} kg</span>` : ''}
        </div>
        <div class="catalog-item-row-price">${fmt(p.price)} PLN</div>
        <button class="catalog-item-add">+ Dodaj</button>
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
