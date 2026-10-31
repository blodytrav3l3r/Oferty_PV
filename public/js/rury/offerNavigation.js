// @ts-check
/* ===== NAWIGACJA SEKCJI (RURY) ===== */

// SSoT widoczności paska podsumowania: pasek (Zapisz ofertę / Utwórz zamówienie)
// widoczny w zakładce Oferta oraz w kroku 3 Konfiguracji (Pozycje oferty).
// Jedyny mechanizm: klasa `hidden` (display:none !important) — zakaz style.display
// (desync z wizard.js).
function updateRurySummaryBarVisibility() {
    const summaryBar = document.getElementById('rury-summary-bar');
    if (!summaryBar) return;
    const offerActive = !!document.getElementById('section-offer')?.classList.contains('active');
    const step3Active =
        !!document.getElementById('section-builder')?.classList.contains('active') &&
        !!document.getElementById('wizard-step-3')?.classList.contains('active');
    const barVisible = offerActive || step3Active;
    // ponytail: czyści legacy inline display ze starego sterowania style.display
    summaryBar.style.removeProperty('display');
    summaryBar.classList.toggle('hidden', !barVisible);
    if (!barVisible) return;
    const saveBtn = document.getElementById('btn-save-offer-order');
    if (saveBtn) {
        const isOrderMode = window.orderEditMode && window.editingRuryOrderId;
        saveBtn.innerHTML = isOrderMode
            ? '<i data-lucide="save"></i> Zapisz zamówienie'
            : '<i data-lucide="save"></i> Zapisz ofertę';
    }
    if (typeof updateOfferSummary === 'function') updateOfferSummary();
    if (window.lucide) lucide.createIcons();
}

async function showSectionRury(id) {
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

    const targetSection = document.getElementById('section-' + id);
    if (targetSection) targetSection.classList.add('active');

    const targetBtn = document.querySelector(`.nav-btn[data-section="${id}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    // Podgląd w module oferty = cennik, z którego oferta liczy: wersja pieczątki
    // oferty, a bez pieczątki ACTIVE. Dane edytora (szkic/LIVE) tylko w #/cennik.
    const ruryOfferStamp =
        window.pricelistVersions && typeof window.pricelistVersions.offerStamp === 'function'
            ? window.pricelistVersions.offerStamp('rury')
            : null;
    if (id === 'pricelist') {
        const pv = window.pricelistVersions;
        const editingPricing = !!(
            pv &&
            typeof pv.isPricelistEditing === 'function' &&
            pv.isPricelistEditing('rury')
        );
        if (editingPricing) {
            products = await loadProducts();
        } else if (ruryOfferStamp && pv && typeof pv.applyOfferPricelist === 'function') {
            // Ta sama wersja co pieczątka oferty — siatka nie kłamie o cenniku.
            try {
                await pv.applyOfferPricelist('rury', ruryOfferStamp);
            } catch (_e) {
                products = await loadProducts({ source: 'active' });
            }
        } else {
            products = await loadProducts({ source: 'active' });
        }
        renderPriceList();
        // Pasek stanu: co edytujesz (szkic) vs co liczy oferta.
        if (
            window.pricelistVersions &&
            typeof window.pricelistVersions.renderStatusStrip === 'function'
        ) {
            window.pricelistVersions.renderStatusStrip('pricelist-status-strip', 'rury');
        }
    } else if (
        !ruryOfferStamp &&
        window.__ruryPricingSource === 'live' &&
        (typeof _pricelistDirty === 'undefined' || !_pricelistDirty)
    ) {
        // Powrót z cennika LIVE (bez niezapisanych edycji) — oferty liczą z ACTIVE.
        products = await loadProducts({ source: 'active' });
    }

    updateRurySummaryBarVisibility();

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('tab', id);
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
}

window.showSectionRury = showSectionRury;
window.showSection = showSectionRury;
