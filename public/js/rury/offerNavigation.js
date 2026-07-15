// @ts-check
/* ===== NAWIGACJA SEKCJI (RURY) ===== */

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
