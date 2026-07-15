// @ts-check
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
                        `<div class="product-dropdown-item" onclick="addOfferItem('${p.id}')">
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

    // Ustaw dzisiejszą datę i automatycznie wygeneruj numer oferty
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('offer-date', new Date().toISOString().slice(0, 10));
    setVal('offer-number', generateOfferNumber());

    const hiddenCategories = ['Akcesoria PEHD', 'Zabezpieczenie transportu'];
    if (!window.activeCatalogCategory || hiddenCategories.includes(window.activeCatalogCategory)) {
        window.activeCatalogCategory = CATEGORIES.filter((c) => !hiddenCategories.includes(c))[0];
    }
    renderCatalogTabs();
    renderCatalogProducts();
}
