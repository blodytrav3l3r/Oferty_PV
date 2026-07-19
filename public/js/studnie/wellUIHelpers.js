// @ts-check
/* ===== HELPERY UI STUDNI ===== */
/* renderDiscountPanel — panel rabatów i podsumowania w sidebarze */
/* Zależności: wells, wellDiscounts, calcWellStats, studnieProducts, fmtInt, updateDiscount, updateGlobalPehdDiscount, updateGlobalPaintingCost, getPehdEffectiveArea (globalne) */

function renderDiscountPanel() {
    const panel = document.getElementById('wells-discount-panel');
    if (!panel) return;

    const dktCap = [1000, 1200, 1500, 2000, 2500, 'styczna'];
    const activeDNs = dktCap.filter((dn) => wells.some((w) => w.dn === dn));

    if (activeDNs.length === 0) {
        panel.innerHTML = '';
        return;
    }

    let grandDennica = 0,
        grandNadbudowa = 0,
        grandTotal = 0,
        grandDiscounted = 0;

    let html = `<div style="padding:0.4rem; border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:0.3rem;"><i data-lucide="banknote" aria-hidden="true"></i> Rabaty i podsumowanie</div>`;

    activeDNs.forEach((dn) => {
        const groupWells = wells.filter((w) => w.dn === dn);
        const discountDn = dn === 'styczna' ? 'styczne' : dn;
        let dennicaBaseSum = 0,
            nadbudowaBaseSum = 0;
        let dennicaAfterSum = 0,
            nadbudowaAfterSum = 0;
        groupWells.forEach((w) => {
            const s = calcWellStats(w);
            dennicaBaseSum += s.priceDennicaBase;
            nadbudowaBaseSum += s.priceNadbudowaBase;
            dennicaAfterSum += s.priceDennica;
            nadbudowaAfterSum += s.priceNadbudowa;
        });
        const totalDN = dennicaBaseSum + nadbudowaBaseSum;

        const disc = wellDiscounts[discountDn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
        const totalAfter = dennicaAfterSum + nadbudowaAfterSum;

        grandDennica += dennicaBaseSum;
        grandNadbudowa += nadbudowaBaseSum;
        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        const dnLabel = dn === 'styczna' ? 'Studnia Styczna' : `DN${dn}`;
        const hasPrecoInGroup = groupWells.some(
            (w) => w.kineta === 'preco' || w.kineta === 'precotop'
        );

        html += `<div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.82rem; font-weight:700; color:#a78bfa;">${dnLabel}</span>
            <span style="font-size:0.7rem; color:var(--text-muted);">${groupWells.length} szt.</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto; gap:0.25rem 0.45rem; font-size:0.78rem; align-items:center;">
            <span class="ui-text-mute" class="text-left">Dennica / Baza</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.dennica || 0}"
                id="disc-${discountDn}-dennica"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:#fff;"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','dennica',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
            <span class="ui-text-mute" class="text-left">Nadbudowa</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.nadbudowa || 0}"
                id="disc-${discountDn}-nadbudowa"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:#fff;"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','nadbudowa',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
            ${
                hasPrecoInGroup
                    ? `<span class="ui-text-mute" style="text-align:left; color:#ef4444;">Wkładka PRECO</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.preco || 0}"
                id="disc-${discountDn}-preco"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:5px; color:#ef4444;"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','preco',this.value)">
              <span class="ui-text-mute" style="color:#ef4444;">%</span>
            </div>`
                    : ''
            }
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:0.4rem; padding-top:0.35rem; border-top:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.78rem; color:var(--text-muted); text-align:left;">Po rabacie:</span>
            <span style="font-size:0.82rem; font-weight:700; color:${totalAfter < totalDN ? '#34d399' : 'var(--text-secondary)'};">${fmtInt(totalAfter)} PLN</span>
          </div>
        </div>`;
    });

    // Sekcja wkładki PEHD (globalna dla wszystkich studni)
    const anyPehd = wells.some(
        (w) =>
            (w.wkladkaDennica && w.wkladkaDennica !== 'brak') ||
            (w.wkladkaNadbudowa && w.wkladkaNadbudowa !== 'brak') ||
            (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak')
    );
    if (anyPehd) {
        const pehdDiscountValue = wells[0] && wells[0].pehdDiscount ? wells[0].pehdDiscount : 0;
        let currentPehdPrice = 0;
        for (const p of studnieProducts) {
            if (
                p.area > 0 &&
                p.doplataPEHD > 0 &&
                p.componentType !== 'przejscie' &&
                p.componentType !== 'kineta'
            ) {
                currentPehdPrice = Math.round(p.doplataPEHD / getPehdEffectiveArea(p));
                break;
            }
        }
        const currentPehdPriceAfter = currentPehdPrice * (1 - pehdDiscountValue / 100);

        html += `<div style="background:rgba(14,165,233,0.06); border-radius:10px; padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(14,165,233,0.15);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem;">
            <div style="display:flex; flex-direction:column; gap:0.1rem;">
                <span style="font-size:0.82rem; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:0.3rem;"><i data-lucide="shield" style="width:14px; height:14px;"></i> Wkładka PEHD</span>
                <span style="font-size:0.65rem; color:var(--text-muted);">(Bazowo: ${currentPehdPrice} PLN/m²)</span>
            </div>
            <div style="text-align:right;">
                <span style="font-size:0.85rem; color:#38bdf8; font-weight:800; white-space:nowrap;" id="sidebar-pehd-price-after">${currentPehdPriceAfter.toFixed(2)} PLN/m²</span>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto; gap:0.25rem 0.45rem; font-size:0.78rem; align-items:center;">
            <span class="ui-text-mute" class="text-left">Globalny Rabat</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" step="1" value="${pehdDiscountValue}"
                id="disc-global-pehd"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.3); border-radius:5px; color:#38bdf8;"
                onclick="this.select()"
                onchange="updateGlobalPehdDiscount(this.value)">
              <span class="ui-text-mute" style="color:#38bdf8;">%</span>
            </div>
          </div>
        </div>`;
    }

    // Sekcja kosztów malowania (globalna dla wszystkich studni)
    const anyMalowanieW = wells.some((w) => w.malowanieW && w.malowanieW !== 'brak');
    const anyMalowanieZ = wells.some((w) => w.malowanieZ && w.malowanieZ !== 'brak');

    if (anyMalowanieW || anyMalowanieZ) {
        const refWell = wells[0] || {};
        const malWCena = refWell.malowanieWewCena || '';
        const malZCena = refWell.malowanieZewCena || '';

        html += `<div style="background:rgba(168,85,247,0.06); border-radius:10px; padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(168,85,247,0.15);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.82rem; font-weight:700; color:#c084fc;"><i data-lucide="paintbrush" aria-hidden="true"></i> Koszt malowania</span>
            <span style="font-size:0.6rem; color:var(--text-muted);">PLN / m²</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto; gap:0.25rem 0.45rem; font-size:0.78rem; align-items:center;">`;

        if (anyMalowanieW) {
            html += `<span class="ui-text-mute" class="text-left">Wewnętrzne</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" step="0.01" value="${malWCena}"
                id="disc-mal-wew-cena"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.3); border-radius:5px; color:#c084fc;"
                onclick="this.select()"
                onchange="updateGlobalPaintingCost('malowanieWewCena', this.value)">
              <span class="ui-text-mute" style="color:#c084fc;">zł</span>
            </div>`;
        }

        if (anyMalowanieZ) {
            html += `<span class="ui-text-mute" class="text-left">Zewnętrzne</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" step="0.01" value="${malZCena}"
                id="disc-mal-zew-cena"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.3); border-radius:5px; color:#c084fc;"
                onclick="this.select()"
                onchange="updateGlobalPaintingCost('malowanieZewCena', this.value)">
              <span class="ui-text-mute" style="color:#c084fc;">zł</span>
            </div>`;
        }

        html += `</div>
        </div>`;
    }

    // Suma całkowita
    const hasDiscount = grandDiscounted < grandTotal;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.2rem 0.1rem; border-top:1px solid rgba(255,255,255,0.1); margin-top:0.4rem;">
      <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">Suma całkowita</span>
      <div style="text-align:right;">
        ${hasDiscount ? `<div style="font-size:0.65rem; color:var(--text-muted); text-decoration:line-through;">${fmtInt(grandTotal)} PLN</div>` : ''}
        <div style="font-size:1rem; font-weight:700; color:#6366f1;">${fmtInt(grandDiscounted)} PLN</div>
      </div>
    </div>`;

    html += `</div>`;
    panel.innerHTML = html;
}

window.renderDiscountPanel = renderDiscountPanel;
