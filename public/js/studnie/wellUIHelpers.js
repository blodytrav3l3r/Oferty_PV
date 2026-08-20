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

    let grandTotal = 0,
        grandDiscounted = 0;

    let html = `<div style="padding:0.4rem; border-bottom:1px solid rgba(var(--white-rgb), 0.1);">
        <div style="font-size: var(--fs-xs); text-transform:uppercase; color:var(--text-muted); font-weight: var(--fw-bold); letter-spacing:0.5px; margin-bottom:0.3rem;"><i data-lucide="banknote" aria-hidden="true"></i> Rabaty i podsumowanie</div>`;

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

        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        const dnLabel = dn === 'styczna' ? 'Studnia Styczna' : `DN${dn}`;
        const hasPrecoInGroup = groupWells.some(
            (w) => w.kineta === 'preco' || w.kineta === 'precotop'
        );

        html += `<div style="background:rgba(var(--white-rgb), 0.05); border-radius: var(--radius-sm); padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(var(--white-rgb), 0.05);">
          <div class="flex-between-35">
            <span style="font-size: var(--fs-md); font-weight: var(--fw-bold); color:var(--accent2-hover);">${dnLabel}</span>
            <span class="fs-sm-muted">${groupWells.length} szt.</span>
          </div>
          <div class="grid-1auto">
            <span class="ui-text-mute text-left" >Dennica / Baza</span>
            <div class="flex-gap-2">
              <input type="number" min="0" max="100" step="0.5" value="${disc.dennica || 0}"
                id="disc-${discountDn}-dennica"
                class="badge-90-white"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','dennica',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
            <span class="ui-text-mute text-left" >Nadbudowa</span>
            <div class="flex-gap-2">
              <input type="number" min="0" max="100" step="0.5" value="${disc.nadbudowa || 0}"
                id="disc-${discountDn}-nadbudowa"
                class="badge-90-white"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','nadbudowa',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
            ${
                hasPrecoInGroup
                    ? `<span class="ui-text-mute" style="text-align:left; color:var(--danger);">Wkładka PRECO</span>
            <div class="flex-gap-2">
              <input type="number" min="0" max="100" step="0.5" value="${disc.preco || 0}"
                id="disc-${discountDn}-preco"
                style="width:90px; padding:3px 6px; font-size: var(--fs-base); text-align:center; background:rgba(var(--danger-rgb), 0.1); border:1px solid rgba(var(--danger-rgb), 0.3); border-radius: var(--radius-2xs); color:var(--danger);"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','preco',this.value)">
              <span class="ui-text-mute" style="color:var(--danger);">%</span>
            </div>`
                    : ''
            }
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:0.4rem; padding-top:0.35rem; border-top:1px solid rgba(var(--white-rgb), 0.05);">
            <span style="font-size: var(--fs-base); color:var(--text-muted); text-align:left;">Po rabacie:</span>
            <span style="font-size: var(--fs-md); font-weight: var(--fw-bold); color:${totalAfter < totalDN ? 'var(--success-hover)' : 'var(--text-secondary)'};">${fmtInt(totalAfter)} PLN</span>
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
                p.componentType !== 'kineta' &&
                p.componentType !== 'konus'
            ) {
                currentPehdPrice = Math.round(p.doplataPEHD / getPehdEffectiveArea(p));
                break;
            }
        }
        const currentPehdPriceAfter = currentPehdPrice * (1 - pehdDiscountValue / 100);

        html += `<div style="background:rgba(var(--blue-alt-rgb), 0.05); border-radius: var(--radius-sm); padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(var(--blue-alt-rgb), 0.15);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem;">
            <div style="display:flex; flex-direction:column; gap:0.1rem;">
                <span style="font-size: var(--fs-md); font-weight: var(--fw-bold); color:var(--blue-alt); display:flex; align-items:center; gap:0.3rem;"><i data-lucide="shield" class="icon-xs"></i> Wkładka PEHD</span>
                <span class="fs-xs-muted">(Bazowo: ${currentPehdPrice} PLN/m²)</span>
            </div>
            <div class="text-right">
                <span style="font-size: var(--fs-lg); color:var(--blue-alt); font-weight: var(--fw-extrabold); white-space:nowrap;" id="sidebar-pehd-price-after">${currentPehdPriceAfter.toFixed(2)} PLN/m²</span>
            </div>
          </div>
          <div class="grid-1auto">
            <span class="ui-text-mute text-left" >Globalny Rabat</span>
            <div class="flex-gap-2">
              <input type="number" min="0" step="1" value="${pehdDiscountValue}"
                id="disc-global-pehd"
                style="width:90px; padding:3px 6px; font-size: var(--fs-base); text-align:center; background:rgba(var(--blue-alt-rgb), 0.1); border:1px solid rgba(var(--blue-alt-rgb), 0.3); border-radius: var(--radius-2xs); color:var(--blue-alt);"
                onclick="this.select()"
                onchange="updateGlobalPehdDiscount(this.value)">
              <span class="ui-text-mute" style="color:var(--blue-alt);">%</span>
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

        html += `<div style="background:rgba(var(--accent2-rgb), 0.05); border-radius: var(--radius-sm); padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(var(--accent2-rgb), 0.15);">
          <div class="flex-between-35">
            <span style="font-size: var(--fs-md); font-weight: var(--fw-bold); color:var(--purple-alt);"><i data-lucide="paintbrush" aria-hidden="true"></i> Koszt malowania</span>
            <span style="font-size: var(--fs-2xs); color:var(--text-muted);">PLN / m²</span>
          </div>
          <div class="grid-1auto">`;

        if (anyMalowanieW) {
            html += `<span class="ui-text-mute text-left" >Wewnętrzne</span>
            <div class="flex-gap-2">
              <input type="number" min="0" step="0.01" value="${malWCena}"
                id="disc-mal-wew-cena"
                class="badge-90-accent2"
                onclick="this.select()"
                onchange="updateGlobalPaintingCost('malowanieWewCena', this.value)">
              <span class="ui-text-mute color-purple" >zł</span>
            </div>`;
        }

        if (anyMalowanieZ) {
            html += `<span class="ui-text-mute text-left" >Zewnętrzne</span>
            <div class="flex-gap-2">
              <input type="number" min="0" step="0.01" value="${malZCena}"
                id="disc-mal-zew-cena"
                class="badge-90-accent2"
                onclick="this.select()"
                onchange="updateGlobalPaintingCost('malowanieZewCena', this.value)">
              <span class="ui-text-mute color-purple" >zł</span>
            </div>`;
        }

        html += `</div>
        </div>`;
    }

    // Suma całkowita
    const hasDiscount = grandDiscounted < grandTotal;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.2rem 0.1rem; border-top:1px solid rgba(var(--white-rgb), 0.1); margin-top:0.4rem;">
      <span style="font-size: var(--fs-lg); font-weight: var(--fw-bold); color:var(--text-primary);">Suma całkowita</span>
      <div class="text-right">
        ${hasDiscount ? `<div style="font-size: var(--fs-xs); color:var(--text-muted); text-decoration:line-through;">${fmtInt(grandTotal)} PLN</div>` : ''}
        <div style="font-size: var(--fs-2xl); font-weight: var(--fw-bold); color:var(--accent);">${fmtInt(grandDiscounted)} PLN</div>
      </div>
    </div>`;

    html += `</div>`;
    panel.innerHTML = html;
}

window.renderDiscountPanel = renderDiscountPanel;
