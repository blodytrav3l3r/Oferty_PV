// @ts-check
/* ===== WELL UI — Renderowanie parametrów i rabatów ===== */

function renderWellParams() {
    const container = document.getElementById('well-params-container');
    if (!container) return;
    const well = getCurrentWell();
    if (!well) {
        container.innerHTML =
            '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Dodaj studnię aby edytować parametry</div>';
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:0.55rem;">`;

    const isOsadnik = typeof isSettlingWell === 'function' && isSettlingWell(well);

    WELL_PARAM_DEFS.forEach((def) => {
        if (def.key === 'precoFullHeight') {
            if (well.kineta !== 'preco' && well.kineta !== 'precotop') {
                return;
            }
        }
        let isGreyedOut = false;
        if (def.key === 'wkladkaOsadnikPreco' && !isOsadnik) {
            isGreyedOut = true;
        }
        if (def.key === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop')) {
            isGreyedOut = true;
        }
        if (well.wkladkaOsadnikPreco === 'tak') {
            if (def.key === 'kineta' || def.key === 'spocznik') {
                return;
            }
        }
        const currentVal = well[def.key] || '';

        html += `<div style="display:flex; align-items:center; gap:0.2rem; ${isGreyedOut ? 'opacity: 0.5;' : ''}">`;
        html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">${def.label}</span>`;
        html += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:0.35rem; flex:1;">`;
        def.options.forEach(([val, lbl]) => {
            const isActive = val === currentVal;
            html += `<button data-action="updateWellParamQuick" data-field="${def.key}" data-val="${val}" style="
                height: 34px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:${isActive ? '800' : '600'};
                border:1px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
                background:${isActive ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'};
                color:${isActive ? '#a5b4fc' : 'var(--text-secondary)'};
                transition:all 0.15s ease;
                display:flex; align-items:center; justify-content:center;
                ${isActive ? 'box-shadow:0 0 10px rgba(99,102,241,0.2);' : ''}
            ">${lbl}</button>`;
        });
        html += `</div></div>`;

        if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Nazwa p. wew.</span>`;
            html += `<input type="text" value="${escapeHtml(well.powlokaNameW || '')}" data-action="updateWellParam" data-field="powlokaNameW" placeholder="Nazwa powłoki..." style="flex:1; max-width:260px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Koszt p. wew.</span>`;
            html += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" data-action="updateWellParam" data-field="malowanieWewCena" placeholder="PLN / m²" style="width:100px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
        }

        if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Nazwa p. zew.</span>`;
            html += `<input type="text" value="${escapeHtml(well.powlokaNameZ || '')}" data-action="updateWellParam" data-field="powlokaNameZ" placeholder="Nazwa powłoki..." style="flex:1; max-width:260px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Koszt p. zew.</span>`;
            html += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" data-action="updateWellParam" data-field="malowanieZewCena" placeholder="PLN / m²" style="width:100px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
        }

        if (def.key === 'wkladkaOsadnikPreco' && well.wkladkaOsadnikPreco === 'tak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem; ${isGreyedOut ? 'opacity: 0.5;' : ''}">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Wys. wkładki osadnik</span>`;
            html += `<div style="display:flex; align-items:center; gap:0.5rem;">`;
            html += `<input type="number" value="${well.wkladkaOsadnikH || ''}" data-action="updateWellParam" data-field="wkladkaOsadnikH" placeholder="Wys. w mm" style="width:120px; height:34px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `<span style="font-size:0.8rem; color:var(--text-muted);">mm</span>`;
            html += `</div></div>`;
        }
    });

    html += `</div>`;
    html += `<div style="display:flex; gap:0.4rem; margin-top:1rem; justify-content:flex-end;">`;
    html += `<button class="btn btn-secondary btn-sm" data-action="resetWellParamsToDefaults" style="font-size:0.8rem; padding:0.4rem 0.8rem; border-radius:8px;"><i data-lucide="refresh-cw" aria-hidden="true"></i> Przywróć domyślne (Krok 2)</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

function updateAutoLockUI() {
    const well = getCurrentWell();
    const btnLock = document.getElementById('btn-lock-auto');
    const btnAuto = document.getElementById('btn-auto-select');
    if (!btnLock || !btnAuto) return;
    if (!well) {
        btnLock.innerHTML = '<i data-lucide="unlock"></i> Ręczny';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        return;
    }

    if (well.autoLocked) {
        btnLock.innerHTML = '<i data-lucide="lock"></i> Tryb ręczny (Włączony)';
        btnLock.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        btnLock.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        btnAuto.style.cursor = 'not-allowed';
    } else {
        btnLock.innerHTML = '<i data-lucide="unlock"></i> Tryb ręczny (Wyłączony)';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = false;
        btnAuto.style.opacity = '1';
        btnAuto.style.cursor = 'pointer';
    }
}

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
                data-action="updateDiscount" data-dn="${discountDn}" data-component="dennica">
              <span class="ui-text-mute">%</span>
            </div>
            <span class="ui-text-mute" class="text-left">Nadbudowa</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.nadbudowa || 0}"
                id="disc-${discountDn}-nadbudowa"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:#fff;"
                data-action="updateDiscount" data-dn="${discountDn}" data-component="nadbudowa">
              <span class="ui-text-mute">%</span>
            </div>
            ${
                hasPrecoInGroup
                    ? `<span class="ui-text-mute" style="text-align:left; color:#ef4444;">Wkładka PRECO</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.preco || 0}"
                id="disc-${discountDn}-preco"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:5px; color:#ef4444;"
                data-action="updateDiscount" data-dn="${discountDn}" data-component="preco">
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
                currentPehdPrice = Math.round(p.doplataPEHD / p.area);
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
                data-action="updateGlobalPehdDiscount">
              <span class="ui-text-mute" style="color:#38bdf8;">%</span>
            </div>
          </div>
        </div>`;
    }

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
                data-action="updateGlobalPaintingCost" data-field="malowanieWewCena">
              <span class="ui-text-mute" style="color:#c084fc;">zł</span>
            </div>`;
        }

        if (anyMalowanieZ) {
            html += `<span class="ui-text-mute" class="text-left">Zewnętrzne</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" step="0.01" value="${malZCena}"
                id="disc-mal-zew-cena"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.3); border-radius:5px; color:#c084fc;"
                data-action="updateGlobalPaintingCost" data-field="malowanieZewCena">
              <span class="ui-text-mute" style="color:#c084fc;">zł</span>
            </div>`;
        }

        html += `</div>
        </div>`;
    }

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
