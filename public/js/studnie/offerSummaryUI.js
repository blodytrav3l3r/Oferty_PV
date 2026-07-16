/* ===== AKTUALIZACJA UI PODSUMOWANIA ===== */

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
                <div style="margin-bottom: 2px;">Ilość aut: <span style="color: #cbd5e1; font-weight: 600;">${typeof formatTransportCount === 'function' ? formatTransportCount(totals.totalTransports, typeof orderEditMode !== 'undefined' && orderEditMode ? 'fractional' : currentTransportMode) : totals.totalTransports}</span></div>
                <div>Cena rejsu: <span style="color: #cbd5e1; font-weight: 600;">${fmt(totals.transportCostPerTrip)} PLN</span></div>
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

        const tileBase =
            'padding:2px 4px; border-radius:5px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; min-width:0;';
        const labelStyle =
            'font-size:0.72rem; font-weight:800; line-height:1.15; color:var(--text-primary);';
        const detailStyle =
            'font-size:0.65rem; font-weight:600; line-height:1.15; color:rgba(255,255,255,0.85);';
        const dimVal = 'opacity:0.5; color:rgba(255,255,255,0.6);';
        const disabledTile = `${tileBase} background:rgba(255,255,255,0.02); color:rgba(100,116,139,0.5); border:1px solid rgba(255,255,255,0.04);`;

        const fmtDisc = (prefix, val, color) => {
            const v = Number(val || 0).toFixed(2);
            if (val > 0)
                return color
                    ? `<span style="color:${color};">${prefix}${v}%</span>`
                    : `${prefix}${v}%`;
            return `<span style="${dimVal}">${prefix}${v}%</span>`;
        };

        const buildDnTile = (dn) => {
            const label = dn === 'styczne' ? 'Stycz' : `DN${dn}`;
            const hasWells = wellsList.some((w) =>
                dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
            );
            if (!hasWells)
                return `<div style="${disabledTile}"><span style="${labelStyle}">${label}</span></div>`;

            const d = activeDiscounts[dn] || {};
            const hasDisc = d.dennica > 0 || d.nadbudowa > 0 || d.preco > 0;
            const bg = hasDisc
                ? 'background:rgba(var(--accent-rgb),0.12); color:var(--accent-text); border:1px solid rgba(var(--accent-rgb),0.3);'
                : 'background:rgba(var(--accent-rgb),0.06); color:rgba(165,180,252,0.5); border:1px solid rgba(var(--accent-rgb),0.12);';
            const details = `${fmtDisc('D:', d.dennica)} ${fmtDisc('N:', d.nadbudowa)} ${fmtDisc('P:', d.preco, d.preco > 0 ? 'var(--danger-hover)' : null)}`;
            return `<div style="${tileBase} ${bg}"><span style="${labelStyle}">${label}</span><span style="${detailStyle}">${details}</span></div>`;
        };

        const buildPehdTile = () => {
            const anyPehd = wellsList.some(
                (w) =>
                    (w.wkladkaDennica && w.wkladkaDennica !== 'brak') ||
                    (w.wkladkaNadbudowa && w.wkladkaNadbudowa !== 'brak') ||
                    (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak')
            );
            if (!anyPehd)
                return `<div style="${disabledTile}"><span style="${labelStyle}">PEHD</span></div>`;

            const pehdDisc =
                wellsList[0] && wellsList[0].pehdDiscount ? wellsList[0].pehdDiscount : 0;
            let basePrice = 0;
            if (typeof studnieProducts !== 'undefined') {
                for (const p of studnieProducts) {
                    if (
                        p.area > 0 &&
                        p.doplataPEHD > 0 &&
                        p.componentType !== 'przejscie' &&
                        p.componentType !== 'kineta'
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
            return `<div style="${tileBase} background:rgba(14,165,233,0.12); color:#38bdf8; border:1px solid rgba(14,165,233,0.3);"><span style="${labelStyle}"><i data-lucide="shield" style="width:9px;height:9px;display:inline;vertical-align:middle;margin-right:1px;"></i>PEHD</span><span style="${detailStyle}">${discDetail}</span></div>`;
        };

        const buildMalTile = () => {
            const anyW = wellsList.some((w) => w.malowanieW && w.malowanieW !== 'brak');
            const anyZ = wellsList.some((w) => w.malowanieZ && w.malowanieZ !== 'brak');
            if (!anyW && !anyZ)
                return `<div style="${disabledTile}"><span style="${labelStyle}">Malowanie</span></div>`;

            const ref = wellsList[0] || {};
            const parts = [];
            if (anyW) parts.push(`W:${ref.malowanieWewCena || 0}`);
            if (anyZ) parts.push(`Z:${ref.malowanieZewCena || 0}`);
            return `<div style="${tileBase} background:rgba(168,85,247,0.12); color:#c084fc; border:1px solid rgba(168,85,247,0.3);"><span style="${labelStyle}"><i data-lucide="paintbrush" style="width:9px;height:9px;display:inline;vertical-align:middle;margin-right:1px;"></i>Malowanie</span><span style="${detailStyle}">${parts.join(' ')} zł/m²</span></div>`;
        };

        discountsInfoEl.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:3px; width:100%;">
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
}
