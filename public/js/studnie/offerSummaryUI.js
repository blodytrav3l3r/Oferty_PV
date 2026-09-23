/* ===== AKTUALIZACJA UI PODSUMOWANIA ===== */

/* ===== ODSTĘP POD TABELĄ OFERTY (wiersz RAZEM znad fixed stopki) ===== */

// Rezerwa, gdy stopki brak w DOM albo pomiar niemożliwy.
const OFFER_FOOTER_SPACING_FALLBACK_PX = 200;
// Luz między końcem treści a fixed stopką.
const OFFER_FOOTER_SPACING_GAP_PX = 24;

function isOfferOverlayVisible(el) {
    return !!el && window.getComputedStyle(el).display !== 'none';
}

/* Łączna wysokość fixed elementów na dole (stopka + pasek nawigacji + luz).
 * Mierzona na żywo, bo kafelki rabatów zawijają się na wąskich ekranach. */
function getOfferFixedBottomHeight() {
    const footer = document.getElementById('offer-summary-footer-fixed');
    const nav = document.getElementById('studnie-wizard-bottom-nav');
    let height = OFFER_FOOTER_SPACING_GAP_PX;
    if (isOfferOverlayVisible(footer)) height += footer.offsetHeight;
    if (isOfferOverlayVisible(nav)) height += nav.offsetHeight;
    return height;
}

function applyOfferFooterSpacing() {
    // Padding MUSI być wewnątrz scrollowanej sekcji (#section-offer) —
    // padding na .main leży poza scrollportem i nie odsłania wiersza RAZEM.
    const section = document.getElementById('section-offer');
    if (!section) return;
    section.style.paddingBottom =
        Math.max(getOfferFixedBottomHeight(), OFFER_FOOTER_SPACING_FALLBACK_PX) + 'px';
}
window.applyOfferFooterSpacing = applyOfferFooterSpacing;

/* Dociąga wiersz RAZEM znad fixed stopki — tylko gdy jest zasłonięty.
 * Wołane przy wejściu w zakładkę Oferta (nie przy każdym re-renderze,
 * by nie wyrywać scrolla np. przy rozwijaniu pozycji). */
function scrollOfferTotalIntoView() {
    const section = document.getElementById('section-offer');
    const totalRow = document.getElementById('offer-total-row');
    if (!section || !totalRow || typeof totalRow.scrollIntoView !== 'function') return;
    const reserved = getOfferFixedBottomHeight();
    const rowRect = totalRow.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const fullyVisible =
        rowRect.top >= sectionRect.top && rowRect.bottom <= sectionRect.bottom - reserved;
    if (fullyVisible) return;
    totalRow.scrollIntoView({ block: 'end' });
    section.scrollTop += reserved;
}
window.scrollOfferTotalIntoView = scrollOfferTotalIntoView;

function updateOfferSummaryUI(totals) {
    const totalEl = document.getElementById('sum-total-netto');
    const bruttoEl = document.getElementById('sum-brutto-details');
    const weightEl = document.getElementById('sum-netto-weight');
    const transCostEl = document.getElementById('sum-transport-cost');

    if (totals.totalTransportCost > 0) {
        if (transCostEl)
            transCostEl.innerHTML = `<i data-lucide="truck" class="icon-md"></i> ${escapeHtml(fmt(totals.totalTransportCost))} PLN`;

        const activeTransportInfo = document.getElementById('offer-active-transport-info');
        if (activeTransportInfo) {
            activeTransportInfo.innerHTML = `
                <div style="margin-bottom: 2px;">Ilość aut: <span class="fw-600">${typeof formatTransportCount === 'function' ? formatTransportCount(totals.totalTransports, typeof orderEditMode !== 'undefined' && orderEditMode ? 'fractional' : currentTransportMode) : totals.totalTransports}</span></div>
                <div>Cena rejsu: <span class="fw-600">${fmt(totals.transportCostPerTrip)} PLN</span></div>
            `;
        }
    } else {
        if (transCostEl)
            transCostEl.innerHTML = '<i data-lucide="truck" class="icon-md"></i> 0 PLN';

        const activeTransportInfo = document.getElementById('offer-active-transport-info');
        if (activeTransportInfo) {
            activeTransportInfo.innerHTML = '<span style="opacity: 0.5;">Brak transportu</span>';
        }
    }

    let finalNetto = 0;
    let finalWeight = 0;
    wells.forEach((w) => {
        const s = calcWellStats(w);
        finalNetto +=
            s.price +
            (totals.globalWeight > 0
                ? totals.totalTransportCost * (s.weight / totals.globalWeight)
                : 0);
        finalWeight += s.weight;
    });

    if (totalEl) totalEl.textContent = fmt(finalNetto) + ' PLN';
    if (bruttoEl) bruttoEl.textContent = 'Brutto: ' + fmt(finalNetto * 1.23) + ' PLN';
    if (weightEl) weightEl.textContent = fmtInt(finalWeight) + ' kg';

    const productsEl = document.getElementById('sum-netto-products');
    if (productsEl) {
        const productsNetto = Math.max(0, finalNetto - (totals.totalTransportCost || 0));
        productsEl.textContent = fmt(productsNetto) + ' PLN';
    }

    const transportModalTotalEl = document.getElementById('transport-modal-total-val');
    if (transportModalTotalEl) transportModalTotalEl.textContent = fmt(finalNetto) + ' PLN';

    const discountsInfoEl = document.getElementById('offer-active-discounts-info');
    if (discountsInfoEl) {
        const activeDiscounts = typeof wellDiscounts !== 'undefined' ? wellDiscounts : {};
        const wellsList = typeof wells !== 'undefined' ? wells : [];

        const fmtDisc = (prefix, val, color) => {
            const v = Number(val || 0).toFixed(2);
            if (val > 0)
                return color
                    ? `<span style="color:${color};">${prefix}${v}%</span>`
                    : `${prefix}${v}%`;
            return `<span class="disc-tile--dim">${prefix}${v}%</span>`;
        };

        const buildDnTile = (dn) => {
            const label = dn === 'styczne' ? 'Stycz' : `DN${dn}`;
            const hasWells = wellsList.some((w) =>
                dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
            );
            if (!hasWells)
                return `<div class="disc-tile disc-tile--disabled"><span class="disc-tile-label">${label}</span></div>`;

            const d = activeDiscounts[dn] || {};
            const classHas = ['E600', 'F900'].some(
                (cls) =>
                    (d['dennica' + cls] || 0) > 0 ||
                    (d['nadbudowa' + cls] || 0) > 0 ||
                    (d['zwienczenie' + cls] || 0) > 0
            );
            const hasDisc = d.dennica > 0 || d.nadbudowa > 0 || d.preco > 0 || classHas;
            const tileMod = hasDisc ? 'disc-tile--accent' : 'disc-tile--accent-dim';
            const details = `${fmtDisc('D:', d.dennica)} ${fmtDisc('N:', d.nadbudowa)} ${fmtDisc('P:', d.preco, d.preco > 0 ? 'var(--danger-hover)' : null)}`;

            let classRows = '';
            const dnWells = wellsList.filter((w) =>
                dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
            );
            ['E600', 'F900'].forEach((cls) => {
                const used = dnWells.some(
                    (w) => w.klasaNosnosci_korpus === cls || w.klasaNosnosci_zwienczenie === cls
                );
                if (!used) return;
                if (!classHas) return;
                const color = cls === 'E600' ? 'var(--accent2-hover)' : 'var(--warn-hover)';
                classRows += `<span class="disc-tile-detail" style="color:${color};">${fmtDisc(cls + ' D:', d['dennica' + cls], null)} ${fmtDisc('N:', d['nadbudowa' + cls], null)} ${fmtDisc('Z:', d['zwienczenie' + cls], null)}</span>`;
            });

            return `<div class="disc-tile ${tileMod}"><span class="disc-tile-label">${label}</span><span class="disc-tile-detail">${details}</span>${classRows}</div>`;
        };

        const buildPehdTile = () => {
            const anyPehd = wellsList.some(
                (w) =>
                    (w.wkladkaDennica && w.wkladkaDennica !== 'brak') ||
                    (w.wkladkaNadbudowa && w.wkladkaNadbudowa !== 'brak') ||
                    (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak')
            );
            if (!anyPehd)
                return `<div class="disc-tile disc-tile--disabled"><span class="disc-tile-label">PEHD</span></div>`;

            const pehdDisc =
                wellsList[0] && wellsList[0].pehdDiscount ? wellsList[0].pehdDiscount : 0;
            let basePrice = 0;
            if (typeof studnieProducts !== 'undefined') {
                for (const p of studnieProducts) {
                    if (
                        p.area > 0 &&
                        p.doplataPEHD > 0 &&
                        p.componentType !== 'przejscie' &&
                        p.componentType !== 'kineta' &&
                        p.componentType !== 'konus'
                    ) {
                        basePrice = Math.round(p.doplataPEHD / getPehdEffectiveArea(p));
                        break;
                    }
                }
            }
            const afterPrice = basePrice * (1 - pehdDisc / 100);
            const discDetail =
                pehdDisc > 0
                    ? `${afterPrice.toFixed(0)} zł/m² (-${Number(pehdDisc).toFixed(2)}%)`
                    : `${afterPrice.toFixed(0)} zł/m²`;
            return `<div class="disc-tile disc-tile--blue"><span class="disc-tile-label">PEHD</span><span class="disc-tile-detail">${discDetail}</span></div>`;
        };

        const buildMalTile = () => {
            const anyW = wellsList.some((w) => w.malowanieW && w.malowanieW !== 'brak');
            const anyZ = wellsList.some((w) => w.malowanieZ && w.malowanieZ !== 'brak');
            if (!anyW && !anyZ)
                return `<div class="disc-tile disc-tile--disabled"><span class="disc-tile-label">Malowanie</span></div>`;

            const ref = wellsList[0] || {};
            const parts = [];
            if (anyW) parts.push(`W:${ref.malowanieWewCena || 0}`);
            if (anyZ) parts.push(`Z:${ref.malowanieZewCena || 0}`);
            return `<div class="disc-tile disc-tile--purple"><span class="disc-tile-label"><i data-lucide="paintbrush" class="icon-xxs"></i>Malowanie</span><span class="disc-tile-detail">${parts.join(' ')} zł/m²</span></div>`;
        };

        discountsInfoEl.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:3px; width:100%; min-width:0;">
                ${buildDnTile('1000')}
                ${buildDnTile('1500')}
                ${buildDnTile('2500')}
                ${buildPehdTile()}
                ${buildDnTile('1200')}
                ${buildDnTile('2000')}
                ${buildDnTile('styczne')}
                ${buildMalTile()}
            </div>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons)
            lucide.createIcons({ root: discountsInfoEl });
    }

    applyOfferFooterSpacing();
}

/* ===== Rejestracja globali ===== */
window.updateOfferSummaryUI = updateOfferSummaryUI;

if (typeof window.addEventListener === 'function') {
    window.addEventListener('resize', () => {
        applyOfferFooterSpacing();
    });
}
