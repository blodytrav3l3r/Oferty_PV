/* ===== Extracted to wellPopups.js ===== */

function openZakonczeniePopup() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    const dn = well.dn;
    const effectiveDn = dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : dn;
    const topClosureTypes = [
        'konus',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'pierscien_odciazajacy'
    ];

    const candidates = getAvailableProducts(well).filter(
        (p) =>
            topClosureTypes.includes(p.componentType) &&
            (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null) &&
            filterByWellParams(p, well)
    );

    const typeIcons = {
        konus: 'diamond',
        plyta_din: 'chevron-down',
        plyta_najazdowa: 'chevron-down',
        plyta_zamykajaca: 'chevron-down',
        pierscien_odciazajacy: 'settings'
    };

    const typeLabels = {
        konus: 'Konus',
        plyta_din: 'Płyta DIN',
        plyta_najazdowa: 'Płyta Odciążająca',
        plyta_zamykajaca: 'Płyta Odciążająca',
        pierscien_odciazajacy: 'Pierścień Odciążający'
    };

    const typeColors = {
        konus: 'rgba(124,58,237,0.15)',
        plyta_din: 'rgba(30,58,95,0.3)',
        plyta_najazdowa: 'rgba(30,58,95,0.3)',
        plyta_zamykajaca: 'rgba(30,58,95,0.3)',
        pierscien_odciazajacy: 'rgba(30,58,95,0.3)'
    };

    const currentZak = well.zakonczenie;
    const dnLabel = dn === 'styczna' ? 'styczna (1000)' : dn;

    const renderTile = (p) => {
        const isActive = currentZak === p.id;
        const isKonus = p.componentType === 'konus';
        const wkladkaPEHDZwienczenieActive = well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';
        const isDisabled = isKonus && wkladkaPEHDZwienczenieActive;
        const typeColor = typeColors[p.componentType] || 'rgba(255,255,255,0.05)';
        const icon = typeIcons[p.componentType] || 'circle';
        const typeLabel = typeLabels[p.componentType] || p.componentType;

        if (isDisabled) {
            return `<div onclick="window.showKonusPehdResolverModal(currentWellIndex)" style="
                padding:0.7rem 0.9rem; border-radius:10px; cursor:not-allowed; opacity:0.5;
                border:2px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.02);
            ">
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
                    <i data-lucide="${icon}" style="width:16px; height:16px; color:var(--text-muted);"></i>
                    <span style="font-weight:700; font-size:0.82rem; color:var(--text-muted);">${typeLabel}</span>
                    <span style="margin-left:auto; font-size:0.55rem; color:var(--warning); font-weight:700;"><i data-lucide="alert-triangle" aria-hidden="true"></i> ZABLOKOWANE</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${p.name}</div>
                <div style="font-size:0.6rem; color:var(--warning); margin-top:0.2rem;">Brak możliwości wykonania wkładki PEHD</div>
            </div>`;
        }

        return `<div onclick="selectZakonczenie('${p.id}')" style="
            padding:0.7rem 0.9rem; border-radius:10px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isActive ? 'rgba(99,102,241,0.15)' : typeColor};
            ${isActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
        " onmouseenter="if(!${isActive})this.style.borderColor='rgba(99,102,241,0.3)'"
           onmouseleave="if(!${isActive})this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.25rem;">
                <i data-lucide="${icon}" style="width:16px; height:16px; color:${isActive ? '#a78bfa' : 'var(--text-secondary)'};"></i>
                <span style="font-weight:700; font-size:0.82rem; color:${isActive ? '#a78bfa' : 'var(--text-primary)'};">${typeLabel}</span>
                ${isActive ? '<span style="margin-left:auto; font-size:0.55rem; color:#a78bfa; font-weight:700;"><i data-lucide="check" aria-hidden="true"></i> AKTYWNE</span>' : ''}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:600;">${p.name}</div>
            <div style="display:flex; justify-content:space-between; margin-top:0.3rem; font-size:0.62rem; color:var(--text-muted);">
                ${p.height ? '<span>H: ' + p.height + 'mm</span>' : '<span></span>'}
                <span style="color:var(--success); font-weight:600;">${fmtInt(p.price)} PLN</span>
            </div>
        </div>`;
    };

    let tilesHtml = '';
    if (candidates.length === 0) {
        tilesHtml = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Brak elementów zakończenia dla DN ' + dnLabel + '</div>';
    } else {
        const isAutoActive = !currentZak;
        const sectionStyle = 'grid-column:1/ -1; font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; padding:0.6rem 0 0.1rem; border-top:1px solid rgba(255,255,255,0.06);';

        tilesHtml += `<div onclick="selectZakonczenie(null)" style="
            grid-column:1/ -1;
            padding:0.7rem 0.9rem; border-radius:10px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isAutoActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isAutoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
            ${isAutoActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
        " onmouseenter="if(!${isAutoActive})this.style.borderColor='rgba(99,102,241,0.3)'"
           onmouseleave="if(!${isAutoActive})this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="refresh-cw" style="width:16px; height:16px; color:${isAutoActive ? '#a78bfa' : 'var(--text-secondary)'};"></i>
                <span style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};">Auto (Zakończenie DN${effectiveDn})</span>
            </div>
            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem; margin-left:1.4rem;">Automatyczny dobór zakończenia dla średnicy DN${effectiveDn}</div>
        </div>`;

        const konuses = candidates.filter(p => p.componentType === 'konus');
        const dinPlates = candidates.filter(p => p.componentType === 'plyta_din');
        const odcParts = candidates.filter(p => ['plyta_najazdowa','plyta_zamykajaca','pierscien_odciazajacy'].includes(p.componentType));

        if (konuses.length) {
            tilesHtml += `<div style="${sectionStyle}">Konus</div>`;
            konuses.forEach(p => { tilesHtml += renderTile(p); });
            if (konuses.length % 2 !== 0) tilesHtml += '<div></div>';
        }
        if (dinPlates.length) {
            tilesHtml += `<div style="${sectionStyle}">Płyta DIN</div>`;
            dinPlates.forEach(p => { tilesHtml += renderTile(p); });
            if (dinPlates.length % 2 !== 0) tilesHtml += '<div></div>';
        }
        if (odcParts.length) {
            tilesHtml += `<div style="${sectionStyle}">Płyta / Pierścień Odciążający</div>`;
            odcParts.forEach(p => { tilesHtml += renderTile(p); });
        }
    }

    showModal({
        id: 'zakonczenie-modal',
        titleId: 'zakonczenie-title',
        html: `
    <div class="modal" style="max-width:600px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem; display:flex; align-items:flex-start; gap:0.8rem;">
        <div style="flex:1;">
          <h3 id="zakonczenie-title" style="font-size:1.05rem; font-weight:700; color:var(--text); display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="chevron-down" style="width:18px; height:18px;"></i> Zakończenie studni
            <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">DN${dnLabel}</span>
          </h3>
          <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz domyślny element zakończenia górnego dla tej studni. Wybrany element będzie używany przez Auto-dobór.</p>
        </div>
      </div>
      <div style="flex:1; overflow-y:auto; padding:0.8rem 0; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
        ${tilesHtml}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border); padding-top:0.8rem; text-align:right;">
        <button class="btn btn-secondary" onclick="closeModal()">Zamknij</button>
      </div>
    </div>`
    });
}

function updateZakonczenieButton() {
    const btn = document.getElementById('btn-zakonczenie');
    if (!btn) return;
    const well = getCurrentWell();
    if (!well) return;
    if (well.zakonczenie) {
        const p = studnieProducts.find((pr) => pr.id === well.zakonczenie);
        const shortName = p
            ? p.name.length > 12
                ? p.name.substring(0, 12) + '…'
                : p.name
            : well.zakonczenie;
        btn.innerHTML =
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> ' +
            shortName;
        btn.style.borderColor = 'rgba(99,102,241,0.4)';
        btn.style.color = '#a78bfa';
    } else {
        btn.innerHTML =
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zakończenie';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
    }
}

function updateRedukcjaButton() {
    const btn = document.getElementById('btn-redukcja');
    if (!btn) return;
    const well = getCurrentWell();

    // Ukryj przycisk dla studni DN1000 i studni stycznych (redukcja niemożliwa)
    if (!well || well.dn === 'styczna' || ![1200, 1500, 2000, 2500].includes(parseInt(well.dn))) {
        btn.style.display = 'none';
        if (typeof updatePsiaBudaButton === 'function') updatePsiaBudaButton();
        return;
    }
    btn.style.display = '';

    // Pokaż/ukryj pole minimalnej wysokości obok przycisku
    const minWrap = document.getElementById('redukcja-min-wrap');
    const minInput = document.getElementById('redukcja-min-h');
    const targetDn = well.redukcjaTargetDN || 1000;

    if (well.redukcjaDN1000) {
        btn.innerHTML =
            `<span style="font-size:0.75rem;"><i data-lucide="chevrons-down"></i></span> Redukcja DN${targetDn} <span style="font-size:0.75rem;"><i data-lucide="check"></i></span>`;
        btn.style.borderColor = 'rgba(109,40,217,0.5)';
        btn.style.color = '#a78bfa';
        btn.style.background = 'rgba(109,40,217,0.15)';
        if (minWrap) minWrap.style.display = 'flex';
        if (minInput) minInput.value = ((well.redukcjaMinH || 2500) / 1000).toFixed(1);
    } else {
        btn.innerHTML =
            '<span style="font-size:0.75rem;"><i data-lucide="chevrons-down"></i></span> Redukcja';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
        btn.style.background = '';
        if (minWrap) minWrap.style.display = 'none';
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function onRedukcjaMinChange(valueMeters) {
    const well = getCurrentWell();
    if (!well) return;
    const val = parseFloat(valueMeters);
    if (isNaN(val)) return;
    well.redukcjaMinH = Math.round(val * 1000);
}

function updateRedukcjaZakButton() {
    const btn = document.getElementById('btn-redukcja-zak');
    if (!btn) return;
    const well = getCurrentWell();
    if (!well) return;

    const targetDn = well.redukcjaTargetDN || 1000;
    if (well.redukcjaZakonczenie) {
        const p = studnieProducts.find((pr) => pr.id === well.redukcjaZakonczenie);
        const shortName = p
            ? p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)
            : 'Zak. DN' + targetDn;
        btn.innerHTML =
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> ' +
            shortName;
        btn.style.borderColor = 'rgba(99,102,241,0.5)';
        btn.style.color = '#a78bfa';
    } else {
        btn.innerHTML =
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zak. DN' + targetDn;
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
    }
    if (window.lucide) window.lucide.createIcons();
}

function updatePsiaBudaButton() {
    const btn = document.getElementById('btn-psia-buda');
    if (!btn) return;
    const well = getCurrentWell();

    // Ukryj przycisk dla studni stycznych
    if (well && well.dn === 'styczna') {
        btn.style.display = 'none';
        return;
    }
    btn.style.display = '';

    if (well && well.psiaBuda) {
        btn.innerHTML =
            '<i data-lucide="dog" style="width:14px; height:14px; margin-right:4px;"></i> Psia buda <span style="font-size:0.75rem; margin-left:4px;"><i data-lucide="check"></i></span>';
        btn.style.borderColor = 'rgba(16,185,129,0.5)';
        btn.style.color = '#6ee7b7';
        btn.style.background = 'rgba(16,185,129,0.15)';
    } else {
        btn.innerHTML =
            '<i data-lucide="dog" style="width:14px; height:14px; margin-right:4px;"></i> Psia buda';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
        btn.style.background = '';
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function openRedukcjaZakonczeniePopup() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    const availProducts = getAvailableProducts(well);
    const topClosureTypes = [
        'konus',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'pierscien_odciazajacy'
    ];
    const targetDn = well.redukcjaTargetDN || 1000;
    const candidates = availProducts
        .filter((p) => topClosureTypes.includes(p.componentType) && parseInt(p.dn) === parseInt(targetDn))
        .filter((p) => filterByWellParams(p, well));

    const typeIcons = {
        konus: 'diamond',
        plyta_din: 'chevron-down',
        plyta_najazdowa: 'chevron-down',
        plyta_zamykajaca: 'chevron-down',
        pierscien_odciazajacy: 'settings'
    };
    const typeLabels = {
        konus: 'Konus',
        plyta_din: 'Płyta DIN',
        plyta_najazdowa: 'Płyta Odciążająca',
        plyta_zamykajaca: 'Płyta Odciążająca',
        pierscien_odciazajacy: 'Pierścień Odciążający'
    };
    const typeColors = {
        konus: 'rgba(124,58,237,0.15)',
        plyta_din: 'rgba(30,58,95,0.3)',
        plyta_najazdowa: 'rgba(30,58,95,0.3)',
        plyta_zamykajaca: 'rgba(30,58,95,0.3)',
        pierscien_odciazajacy: 'rgba(30,58,95,0.3)'
    };

    const currentZak = well.redukcjaZakonczenie;
    const wkladkaPEHDZwienczenieActive = well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';

    const renderTile = (p, overrideLabel = null) => {
        if (!p) return '';
        const isKonus = p.componentType === 'konus';
        const isDisabled = isKonus && wkladkaPEHDZwienczenieActive;
        const isActive = currentZak === p.id;
        const typeColor = typeColors[p.componentType] || 'rgba(255,255,255,0.05)';
        const icon = typeIcons[p.componentType] || 'circle';
        const typeLabel = overrideLabel || typeLabels[p.componentType] || p.componentType;

        if (isDisabled) {
            return `<div onclick="window.showKonusPehdResolverModal(currentWellIndex)" style="
                padding:0.7rem 0.9rem; border-radius:10px; cursor:not-allowed; opacity:0.5;
                border:2px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.02);
            ">
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
                    <i data-lucide="${icon}" style="width:16px; height:16px; color:var(--text-muted);"></i>
                    <span style="font-weight:700; font-size:0.82rem; color:var(--text-muted);">${typeLabel}</span>
                    <span style="margin-left:auto; font-size:0.55rem; color:var(--warning); font-weight:700;"><i data-lucide="alert-triangle" aria-hidden="true"></i> BLOKADA</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${p.name}</div>
                <div style="font-size:0.6rem; color:var(--warning); margin-top:0.2rem;">Brak możliwości wkładki PEHD</div>
            </div>`;
        }

        return `<div onclick="selectRedukcjaZakonczenie('${p.id}')" style="
            padding:0.7rem 0.9rem; border-radius:10px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isActive ? 'rgba(99,102,241,0.15)' : typeColor};
            ${isActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
        " onmouseenter="if(!${isActive})this.style.borderColor='rgba(99,102,241,0.3)'"
           onmouseleave="if(!${isActive})this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.25rem;">
                <i data-lucide="${icon}" style="width:16px; height:16px; color:${isActive ? '#a78bfa' : 'var(--text-secondary)'};"></i>
                <span style="font-weight:700; font-size:0.82rem; color:${isActive ? '#a78bfa' : 'var(--text-primary)'};">${typeLabel}</span>
                ${isActive ? '<span style="margin-left:auto; font-size:0.55rem; color:#a78bfa; font-weight:700;"><i data-lucide="check" aria-hidden="true"></i> AKTYWNE</span>' : ''}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:600;">${p.name}</div>
            <div style="display:flex; justify-content:space-between; margin-top:0.3rem; font-size:0.62rem; color:var(--text-muted);">
                ${p.height ? '<span>H: ' + p.height + 'mm</span>' : '<span></span>'}
                <span style="color:var(--success); font-weight:600;">${fmtInt(p.price)} PLN</span>
            </div>
        </div>`;
    };

    let tilesHtml = '';
    const isAutoActive = !currentZak;
    tilesHtml += `<div onclick="selectRedukcjaZakonczenie(null)" style="
        grid-column:1/ -1;
        padding:0.7rem 0.9rem; border-radius:10px; cursor:pointer; transition:all 0.15s;
        border:2px solid ${isAutoActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
        background:${isAutoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
        ${isAutoActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
    " onmouseenter="if(!${isAutoActive})this.style.borderColor='rgba(99,102,241,0.3)'"
       onmouseleave="if(!${isAutoActive})this.style.borderColor='rgba(255,255,255,0.08)'">
        <div style="display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="refresh-cw" style="width:16px; height:16px; color:${isAutoActive ? '#a78bfa' : 'var(--text-secondary)'};"></i>
            <span style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};">Auto (Zakończenie DN${targetDn})</span>
        </div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem; margin-left:1.4rem;">Automatyczny dobór zakończenia dla średnicy DN${targetDn}</div>
    </div>`;

    const sectionStyle = 'grid-column:1/ -1; font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; padding:0.6rem 0 0.1rem; border-top:1px solid rgba(255,255,255,0.06);';

    const konuses = candidates.filter(p => p.componentType === 'konus');
    const dinPlates = candidates.filter(p => p.componentType === 'plyta_din');
    const odcParts = candidates.filter(p => ['plyta_najazdowa','plyta_zamykajaca','pierscien_odciazajacy'].includes(p.componentType));

    if (konuses.length) {
        tilesHtml += `<div style="${sectionStyle}">Konus</div>`;
        konuses.forEach(p => { tilesHtml += renderTile(p); });
        if (konuses.length % 2 !== 0) tilesHtml += '<div></div>';
    }
    if (dinPlates.length) {
        tilesHtml += `<div style="${sectionStyle}">Płyta DIN</div>`;
        dinPlates.forEach(p => { tilesHtml += renderTile(p); });
        if (dinPlates.length % 2 !== 0) tilesHtml += '<div></div>';
    }
    if (odcParts.length) {
        tilesHtml += `<div style="${sectionStyle}">Płyta / Pierścień Odciążający</div>`;
        odcParts.forEach(p => { tilesHtml += renderTile(p); });
    }

    showModal({
        id: 'redukcja-zak-modal',
        titleId: 'redukcja-zak-title',
        html: `
    <div class="modal" style="max-width:600px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem; display:flex; align-items:flex-start; gap:0.8rem;">
        <div style="flex:1;">
          <h3 id="redukcja-zak-title" style="font-size:1.05rem; font-weight:700; color:var(--text); display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="chevron-down" style="width:18px; height:18px;"></i> Zakończenie redukcji DN${targetDn}
          </h3>
          <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz zakończenie górne dla sekcji redukcji DN${targetDn}. Wybór elementu odciążającego automatycznie doda pierścień.</p>
        </div>
      </div>
      <div style="flex:1; overflow-y:auto; padding:0.8rem 0; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
        ${tilesHtml}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border); padding-top:0.8rem; text-align:right;">
        <button class="btn btn-secondary" onclick="closeModal()">Zamknij</button>
      </div>
    </div>`
    });
}

function showStycznaPopup(mode = 'select') {
    const standardProducts = studnieProducts
        .filter((p) => p.componentType === 'styczna' && !p.id.includes('KOREK'))
        .sort((a, b) => (a.dn || 0) - (b.dn || 0));
    const korekProducts = studnieProducts
        .filter((p) => p.componentType === 'styczna' && p.id.includes('KOREK'))
        .sort((a, b) => (a.dn || 0) - (b.dn || 0));

    const renderProductRow = (p) => `
        <button class="styczna-product-btn" onclick="handleStycznaProductChoice('${p.id}', '${mode}')" style="
            display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:0.6rem;
            padding:0.55rem 0.8rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);
            border-radius:8px; cursor:pointer; transition:all 0.15s; text-align:left; color:inherit; width:100%;
        " onmouseenter="this.style.borderColor='rgba(249,115,22,0.5)'; this.style.background='rgba(249,115,22,0.1)'"
           onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.background='rgba(255,255,255,0.03)'">
            <div>
                <div style="font-size:0.82rem; font-weight:700; color:var(--text-primary, #fff);">DN${p.dn}</div>
                <div style="font-size:0.65rem; color:var(--text-muted, #888); margin-top:1px;">${p.name}</div>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${p.weight ? fmtInt(p.weight) + ' kg' : ''}</div>
            <div style="font-size:0.85rem; font-weight:800; color:var(--success, #10b981);">${fmtInt(p.price)} PLN</div>
        </button>`;

    const renderSection = (title, icon, products) => {
        if (products.length === 0) return '';
        return `
            <div style="margin-bottom:0.8rem;">
                <div style="font-size:0.72rem; text-transform:uppercase; color:#f97316; font-weight:800; letter-spacing:0.5px; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.3rem;">
                    <span>${icon}</span> ${title}
                </div>
                <div style="display:flex; flex-direction:column; gap:0.3rem;">
                    ${products.map(renderProductRow).join('')}
                </div>
            </div>`;
    };

    showModal({
        id: 'styczna-modal',
        titleId: 'styczna-title',
        html: `
      <div style="background:var(--bg-secondary, #1e293b); border:1px solid rgba(249,115,22,0.3); border-radius:16px; padding:1.2rem 1.5rem; width:520px; max-width:92vw; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; position:sticky; top:0; background:var(--bg-secondary, #1e293b); padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div id="styczna-title" style="font-size:1rem; font-weight:800; color:#f97316;"><i data-lucide="cylinder" aria-hidden="true"></i> Wybierz studnię styczną</div>
          <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem;"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        ${renderSection('Studnie Styczne', '<i data-lucide="cylinder"></i>', standardProducts)}
        ${renderSection('Studnie Styczne z korkiem', '<i data-lucide="plug"></i>', korekProducts)}
      </div>
    `
    });
}

function handleStycznaProductChoice(productId, mode) {
    closeModal();
    const product = studnieProducts.find((p) => p.id === productId);
    if (!product) {
        showToast('Nie znaleziono produktu', 'error');
        return;
    }

    const isKorek = productId.includes('KOREK');
    const variant = isKorek ? 'korek' : 'standard';

    const stycznaDn = parseInt(product.dn);

    if (mode === 'add') {
        const well = createNewWell(null, 'styczna');
        well.stycznaVariant = variant;
        well.stycznaDn = product.dn;
        // Domyślne zakończenie wg średnicy podstawy stycznej
        const effDn = 1000; // nowa studnia zawsze startuje z DN1000
        if (stycznaDn >= 1400) {
            const plate = studnieProducts.find(p =>
                p.componentType === 'plyta_zamykajaca' && parseInt(p.dn) === effDn
            );
            if (plate) {
                well.zakonczenie = plate.id;
                offerDefaultZakonczenie = plate.id;
                well.zakonczenieByDn = well.zakonczenieByDn || {};
                well.zakonczenieByDn[effDn] = plate.id;
            }
        } else {
            well.zakonczenie = null;
            offerDefaultZakonczenie = null;
        }
        well.name = isKorek
            ? 'St. Styczna z korkiem DN' + product.dn + ' (#' + wellCounter + ')'
            : 'St. Styczna DN' + product.dn + ' (#' + wellCounter + ')';
        well.config = [{ productId: productId, quantity: 1 }];
        wells.push(well);
        currentWellIndex = wells.length - 1;
        const bcontentConcrete = document.getElementById('bcontent-concrete');
        if (bcontentConcrete && bcontentConcrete.style.display === 'none') {
            switchBuilderTab('concrete');
        }
        refreshAll();
        showToast(`Dodano: ${well.name}`, 'success');
    } else {
        const well = getCurrentWell();
        if (!well) return;
        well.stycznaVariant = variant;
        well.stycznaDn = product.dn;
        well.dn = 'styczna';
        // Domyślne zakończenie wg nowej średnicy podstawy
        const effDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        if (stycznaDn >= 1400) {
            const plate = studnieProducts.find(p =>
                p.componentType === 'plyta_zamykajaca' && parseInt(p.dn) === effDn
            );
            if (plate) {
                well.zakonczenie = plate.id;
                well.zakonczenieByDn = well.zakonczenieByDn || {};
                well.zakonczenieByDn[effDn] = plate.id;
            }
        } else if (stycznaDn <= 1200) {
            well.zakonczenie = null;
        }
        // Zamień istniejący element stycznej (jeśli jest) lub dodaj nowy
        const existingIdx = well.config.findIndex((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'styczna';
        });
        if (existingIdx >= 0) {
            well.config[existingIdx] = { productId: productId, quantity: 1 };
        } else {
            well.config.push({ productId: productId, quantity: 1 });
        }
        well.name = isKorek
            ? 'St. Styczna z korkiem DN' + product.dn + ' (#' + (currentWellIndex + 1) + ')'
            : 'St. Styczna DN' + product.dn + ' (#' + (currentWellIndex + 1) + ')';
        doSelectDN('styczna');
    }
}

/* ===== OBSŁUGA POPUPÓW WYBORU ELEMENTÓW ===== */

window.showKonusPehdResolverModal = function(wellIndex, callback) {
    const well = wells[wellIndex];
    if (!well) return;

    const oldOverlay = document.getElementById('pehd-konus-resolver');
    if (oldOverlay) oldOverlay.remove();

    let html = `
    <div style="background:var(--bg-secondary, #1e293b); padding:2.2rem; border-radius:16px; max-width:600px; width:100%; border:1px solid rgba(248,113,113,0.25); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <h3 id="pehd-konus-title" style="margin-top:0; color:#f87171; display:flex; align-items:center; gap:0.6rem; font-family:Inter,sans-serif; font-size:1.25rem; font-weight:700;">
            <i data-lucide="alert-circle" style="width:24px;height:24px;" aria-hidden="true"></i> Niezgodność technologiczna: Konus + PEHD
        </h3>
        <p style="color:#94a3b8; font-size:0.95rem; margin-bottom:1.8rem; line-height:1.6; font-family:Inter,sans-serif;">
            <b>Konus</b> nie może być zakończeniem studni, jeśli zastosowano w nim wkładkę <b>PEHD</b>.<br>
            Wybierz alternatywne zakończenie dla studni <strong style="color:var(--text-primary);">${well.name || 'Bieżąca studnia'}</strong>:
        </p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem;">
            <div onclick="window.resolveKonusPehd(${wellIndex}, 'plyta_din')" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.06); border-radius:12px; padding:1.5rem; cursor:pointer; text-align:center; transition:all 0.2s ease; font-family:Inter,sans-serif; display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:120px;" onmouseover="this.style.borderColor='#6366f1'; this.style.background='rgba(99,102,241,0.05)'; this.style.transform='translateY(-3px)';" onmouseout="this.style.borderColor='rgba(255,255,255,0.06)'; this.style.background='rgba(255,255,255,0.03)'; this.style.transform='translateY(0)';">
                <div style="font-weight:700; color:#e2e8f0; margin-bottom:0.4rem; font-size:1.15rem;">Płyta DIN</div>
                <div style="font-size:0.8rem; color:#64748b; line-height:1.4;">Standardowa płyta nastudzienna.</div>
            </div>
            
            <div onclick="window.resolveKonusPehd(${wellIndex}, 'pierscien_odciazajacy')" style="background:rgba(255,255,255,0.03); border:2px solid rgba(255,255,255,0.06); border-radius:12px; padding:1.5rem; cursor:pointer; text-align:center; transition:all 0.2s ease; font-family:Inter,sans-serif; display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:120px;" onmouseover="this.style.borderColor='#6366f1'; this.style.background='rgba(99,102,241,0.05)'; this.style.transform='translateY(-3px)';" onmouseout="this.style.borderColor='rgba(255,255,255,0.06)'; this.style.background='rgba(255,255,255,0.03)'; this.style.transform='translateY(0)';">
                <div style="font-weight:700; color:#e2e8f0; margin-bottom:0.4rem; font-size:1.15rem;">Płyta + Pierścień</div>
                <div style="font-size:0.8rem; color:#64748b; line-height:1.4;">Płyta zamykająca i pierścień odciążający.</div>
            </div>
        </div>
        
        <div style="margin-top:1.8rem; text-align:right;">
            <button onclick="document.getElementById('pehd-konus-resolver').remove(); if(window.konusResolverCallback) window.konusResolverCallback();" style="padding:0.6rem 1.2rem; background:transparent; border:1px solid rgba(255,255,255,0.15); border-radius:8px; color:#cbd5e1; cursor:pointer; font-family:Inter,sans-serif; font-size:0.9rem; transition:all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='transparent'; this.style.color='#cbd5e1';">Zostaw domyślne (Płyta DIN)</button>
        </div>
    </div>
    `;
    const overlay = showModal({
        id: 'pehd-konus-resolver',
        titleId: 'pehd-konus-title',
        html: html
    });
    if (window.lucide) window.lucide.createIcons({ root: overlay });
    window.konusResolverCallback = callback;
};

window.resolveKonusPehd = async function(wellIndex, type) {
    const well = wells[wellIndex];
    if (!well) return;
    
    let dn = well.dn === 'styczna' ? 1000 : well.dn;
    if (well.redukcjaDN1000) dn = well.redukcjaTargetDN || 1000;
    
    const mag = well.magazyn === 'Włocławek' ? 'WL' : 'KLB';
    const avail = studnieProducts.filter(p => p.dn === dn && p.componentType === type && ((mag === 'WL' && p.magazynWL === 1) || (mag !== 'WL' && p.magazynKLB === 1)));
    
    if (avail.length > 0) {
        if (well.redukcjaDN1000) {
            well.redukcjaZakonczenie = avail[0].id;
        } else {
            well.zakonczenie = avail[0].id;
        }
        
        document.getElementById('pehd-konus-resolver').remove();
        
        // Jeśli jesteśmy w trakcie edycji studni (Krok 3) i wywołano to przez updateWellParam:
        if (currentWizardStep === 3) {
            await autoSelectComponents(true);
            refreshAll();
        }
        
        if (window.konusResolverCallback) window.konusResolverCallback();
    } else {
        showToast('Brak elementu dla wybranego typu w cenniku (DN' + dn + ').', 'error');
    }
};

/* ===== GLOBAL RECALCULATOR ===== */
window.openGlobalRecalcModal = function () {
    if (!wells || wells.length === 0) {
        showToast('Brak studni w ofercie', 'error');
        return;
    }
    const uniqueDns = [...new Set(wells.map((w) => w.dn))].sort((a, b) => a - b);
    let groupsHtml = uniqueDns.map((dn) => {
        const exampleMag = wells[0]?.magazyn || 'Kluczbork';
        const availForDn = studnieProducts.filter(
            (p) => p.dn === dn &&
                ((exampleMag === 'Włocławek' && p.magazynWL === 1) ||
                    (exampleMag !== 'Włocławek' && p.magazynKLB === 1))
        );
        const topClosureTypes = ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'];
        const candidates = availForDn.filter((p) => topClosureTypes.includes(p.componentType));
        const canReduce = [1200, 1500, 2000, 2500].includes(dn);

        let topTiles = candidates.map((p) => `
            <div class="fs-dn-tile" id="recalc-top-${dn}-${p.id}"
                 style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                 onclick="window.recalcSelectTop(${dn}, '${p.id}')">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-primary);">${p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)}</div>
            </div>`).join('');

        topTiles = `
            <div class="fs-dn-tile active" id="recalc-top-${dn}-auto"
                 style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                 onclick="window.recalcSelectTop(${dn}, 'auto')">
                <div style="font-size:0.65rem; font-weight:700; color:#a78bfa;"><i data-lucide="refresh-cw"></i> Auto (Domyślny)</div>
            </div>` + topTiles;

        let reductionHtml = '';
        if (canReduce) {
            const dn1000Cand = studnieProducts.filter(
                (p) => p.dn === 1000 && topClosureTypes.includes(p.componentType) &&
                    ((exampleMag === 'Włocławek' && p.magazynWL === 1) ||
                        (exampleMag !== 'Włocławek' && p.magazynKLB === 1))
            );
            let redTiles = dn1000Cand.map((p) => `
                <div class="fs-dn-tile fs-red-tile-${dn}" id="recalc-redtop-${dn}-${p.id}"
                     style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                     onclick="window.recalcSelectRedTop(${dn}, '${p.id}')">
                    <div style="font-size:0.65rem; font-weight:700; color:var(--text-primary);">${p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)}</div>
                </div>`).join('');

            redTiles = `
                <div class="fs-dn-tile active fs-red-tile-${dn}" id="recalc-redtop-${dn}-auto"
                     style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                     onclick="window.recalcSelectRedTop(${dn}, 'auto')">
                    <div style="font-size:0.65rem; font-weight:700; color:#a78bfa;"><i data-lucide="refresh-cw"></i> Auto (Konus)</div>
                </div>` + redTiles;

            reductionHtml = `
            <div style="margin-top:0.6rem;">
                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; cursor:pointer;">
                    <input type="checkbox" id="recalc-use-red-${dn}" onchange="window.recalcToggleRed(${dn})" />
                    Wykonaj redukcję na DN1000
                </label>
                <div id="recalc-red-box-${dn}" style="display:none; margin-top:0.5rem; padding-left:1rem; border-left:2px solid var(--border);">
                    <div style="display:grid; grid-template-columns:1fr; gap:0.4rem; margin-bottom:0.5rem;">
                        <label class="form-label" style="font-size:0.65rem;">Min. wys. komory roboczej (m)</label>
                        <input type="number" id="recalc-red-minh-${dn}" class="form-input" value="2.5" step="0.1" style="padding:0.3rem 0.5rem; width:120px;" />
                    </div>
                    <div style="font-size:0.65rem; margin-bottom:0.3rem; color:var(--text-muted);">Zakończenie komina DN1000:</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:0.3rem;" id="recalc-red-tiles-${dn}">
                        ${redTiles}
                    </div>
                </div>
            </div>`;
        }

        return `
        <div style="background:rgba(30,41,59,0.4); border:1px solid var(--border); border-radius:8px; padding:0.8rem; margin-bottom:0.8rem;" class="recalc-group" data-dn="${dn}">
            <h4 style="margin-top:0; margin-bottom:0.6rem; color:var(--accent); font-size:0.9rem;">Studnie DN ${dn} <span style="font-size:0.65rem; color:var(--text-muted); font-weight:normal;">(${wells.filter((w) => w.dn === dn).length} szt.)</span></h4>
            <div style="font-size:0.65rem; margin-bottom:0.3rem; color:var(--text-muted);">Zakończenie główne:</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:0.3rem;" id="recalc-top-tiles-${dn}">
                ${topTiles}
            </div>
            ${reductionHtml}
            <input type="hidden" id="recalc-choice-top-${dn}" value="auto" />
            <input type="hidden" id="recalc-choice-redtop-${dn}" value="auto" />
        </div>`;
    }).join('');

    showModal({
        id: 'global-recalc-modal',
        titleId: 'global-recalc-title',
        html: `
    <div class="modal" style="width:700px; max-width:95vw; background:#111827;">
      <div class="modal-header"><h3 id="global-recalc-title"><i data-lucide="settings" aria-hidden="true"></i> Automatycznie przelicz ofertę</h3><button class="btn-icon" aria-label="Zamknij" onclick="window.closeGlobalRecalcModal()"><i data-lucide="x" aria-hidden="true"></i></button></div>
      <div style="padding:1rem; max-height:65vh; overflow-y:auto; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.4) transparent;">
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;">Ustaw preferencje dla poszczególnych średnic. Program zaktualizuje ustawienia zakończeń i ponownie wygeneruje układ elementów dla <strong>wszystkich studni w ofercie</strong> według reguł automatycznych.</p>
        ${groupsHtml}
      </div>
      <div style="padding:1rem; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:0.5rem; background:rgba(0,0,0,0.2);">
        <button class="btn btn-secondary" onclick="window.closeGlobalRecalcModal()">Anuluj</button>
        <button class="btn btn-primary" onclick="window.applyGlobalRecalc()" style="background:var(--accent); color:#fff; font-weight:600;"><i data-lucide="refresh-cw" aria-hidden="true"></i> Przelicz wszystkie</button>
      </div>
    </div>`
    });
};

window.closeGlobalRecalcModal = function () {
    const el = document.getElementById('global-recalc-modal');
    if (el) el.remove();
};

window.recalcSelectTop = function (dn, id) {
    document.getElementById(`recalc-choice-top-${dn}`).value = id;
    const tiles = document.querySelectorAll(`#recalc-top-tiles-${dn} .fs-dn-tile`);
    tiles.forEach((t) => {
        t.classList.remove('active');
        t.style.borderColor = 'var(--border)';
    });
    const selected = document.getElementById(`recalc-top-${dn}-${id}`);
    selected.classList.add('active');
    selected.style.borderColor = 'var(--accent)';
};

window.recalcSelectRedTop = function (dn, id) {
    document.getElementById(`recalc-choice-redtop-${dn}`).value = id;
    const tiles = document.querySelectorAll(`.fs-red-tile-${dn}`);
    tiles.forEach((t) => {
        t.classList.remove('active');
        t.style.borderColor = 'var(--border)';
    });
    const selected = document.getElementById(`recalc-redtop-${dn}-${id}`);
    selected.classList.add('active');
    selected.style.borderColor = 'var(--accent)';
};

window.recalcToggleRed = function (dn) {
    const cb = document.getElementById(`recalc-use-red-${dn}`);
    const box = document.getElementById(`recalc-red-box-${dn}`);
    if (cb && box) {
        box.style.display = cb.checked ? 'block' : 'none';
    }
};

window.applyGlobalRecalc = async function () {
    const btn = document.querySelector('#global-recalc-modal .btn-primary');
    if (btn) {
        btn.innerHTML = '<i data-lucide="refresh-cw"></i> Przeliczanie...';
        btn.disabled = true;
    }

    try {
        const uniqueDns = [...new Set(wells.map((w) => w.dn))];
        const prefs = {};

        uniqueDns.forEach((dn) => {
            const topId = document.getElementById(`recalc-choice-top-${dn}`)?.value || 'auto';
            const useRed = document.getElementById(`recalc-use-red-${dn}`)?.checked || false;
            let redTopId = 'auto';
            let redMinH = 2500;

            if (useRed) {
                redTopId = document.getElementById(`recalc-choice-redtop-${dn}`)?.value || 'auto';
                const redMinHMeters = parseFloat(document.getElementById(`recalc-red-minh-${dn}`)?.value);
                redMinH = isNaN(redMinHMeters) ? 2500 : Math.round(redMinHMeters * 1000);
            }

            prefs[dn] = { topId, useRed, redTopId, redMinH };
        });

        const originalIndex = currentWellIndex;

        for (let i = 0; i < wells.length; i++) {
            const w = wells[i];
            const p = prefs[w.dn];
            if (!p) continue;

            w.zakonczenie = p.topId === 'auto' ? null : p.topId;
            w.redukcjaDN1000 = p.useRed;
            if (p.useRed) {
                w.redukcjaMinH = p.redMinH;
                w.redukcjaZakonczenie = p.redTopId === 'auto' ? null : p.redTopId;
            } else {
                w.redukcjaZakonczenie = null;
            }
            w.config = [];
            w.autoLocked = false;

            currentWellIndex = i;
            await autoSelectComponents(true);
        }

        currentWellIndex = originalIndex;
        refreshAll();
        showToast('Wszystkie studnie przeliczone poprawnie', 'success');
        window.closeGlobalRecalcModal();
    } catch (e) {
        logger.error('wellPopups', e);
        showToast('Wystąpił błąd podczas przeliczania', 'error');
        if (btn) {
            btn.innerHTML = 'Spróbuj ponownie';
            btn.disabled = false;
        }
    }
};

function openRedukcjaChoicePopup() {
    const well = getCurrentWell();
    if (!well) return;

    const can1200 = [1500, 2000, 2500].includes(well.dn) || well.dn === 'styczna';
    const currentTarget = well.redukcjaTargetDN || 1000;
    const isActive = well.redukcjaDN1000;

    showModal({
        id: 'redukcja-choice-modal',
        titleId: 'redukcja-choice-title',
        html: `
    <div class="modal" style="max-width:400px; width:90%; border-radius:12px; padding:1.5rem; background: var(--bg-secondary); border: 1px solid var(--border);">
      <h3 id="redukcja-choice-title" style="margin-top:0; margin-bottom:1rem; font-size:1.1rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
        <i data-lucide="chevrons-down" style="color:var(--accent);" aria-hidden="true"></i> Wybierz rodzaj redukcji
      </h3>
      <div style="display:flex; flex-direction:column; gap:0.6rem;">
        <button onclick="selectRedukcjaChoice(1000)" style="
            padding:0.8rem; border-radius:8px; cursor:pointer; text-align:left; transition:all 0.2s;
            border:2px solid ${isActive && currentTarget === 1000 ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'};
            background:${isActive && currentTarget === 1000 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
            color:${isActive && currentTarget === 1000 ? '#a5b4fc' : 'var(--text-primary)'};
        ">
            <div style="font-weight:800; font-size:0.9rem;">Redukcja na DN1000</div>
            <div style="font-size:0.7rem; opacity:0.7; margin-top:0.2rem;">Standardowa redukcja na kręgi DN1000.</div>
        </button>
        
        ${can1200 ? `
        <button onclick="selectRedukcjaChoice(1200)" style="
            padding:0.8rem; border-radius:8px; cursor:pointer; text-align:left; transition:all 0.2s;
            border:2px solid ${isActive && currentTarget === 1200 ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'};
            background:${isActive && currentTarget === 1200 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
            color:${isActive && currentTarget === 1200 ? '#a5b4fc' : 'var(--text-primary)'};
        ">
            <div style="font-weight:800; font-size:0.9rem;">Redukcja na DN1200</div>
            <div style="font-size:0.7rem; opacity:0.7; margin-top:0.2rem;">Większa redukcja na kręgi DN1200.</div>
        </button>
        ` : ''}

        <button onclick="selectRedukcjaChoice(null)" style="
            padding:0.6rem; border-radius:8px; cursor:pointer; text-align:center; transition:all 0.2s;
            border:1px solid rgba(239, 68, 68, 0.3); background:rgba(239, 68, 68, 0.05); color:#ef4444; margin-top:0.4rem;
        ">
            Wyłącz redukcję
        </button>
      </div>
      <div style="margin-top:1.2rem; text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Anuluj</button>
      </div>
    </div>`
    });
    if (window.lucide) window.lucide.createIcons();
}

async function selectRedukcjaChoice(targetDn) {
    const well = getCurrentWell();
    if (!well) return;

    const oldTarget = well.redukcjaTargetDN || 1000;
    const wasActive = well.redukcjaDN1000;
    const newTarget = targetDn;

    if (targetDn === null) {
        well.redukcjaDN1000 = false;
        well.redukcjaTargetDN = 1000; // default back
    } else {
        well.redukcjaDN1000 = true;
        well.redukcjaTargetDN = targetDn;
        
        // Specjalna obsługa dla studni stycznych
        if (well.dn === 'styczna') {
            well.stycznaNadbudowa1200 = (targetDn === 1200);
        }
    }

    closeModal();
    updateRedukcjaButton();
    updateRedukcjaZakButton();
    
    if (!well.autoLocked) {
        let swapped = false;
        // Próbujemy podmienić elementy tylko jeśli zmieniamy średnicę aktywnej redukcji
        if (wasActive && targetDn !== null && oldTarget !== newTarget && (well.config || []).length > 0) {
            swapped = trySwapReductionComponents(well, oldTarget, newTarget);
        }

        if (!swapped) {
            // Full recalculation (przelicz od nowa)
            well.configSource = 'AUTO';
            well.config = [];
            await autoSelectComponents(true);
        }
    }
    refreshAll();
    showToast(targetDn ? `Redukcja na DN${targetDn} — WŁĄCZONA` : 'Redukcja — WYŁĄCZONA', targetDn ? 'success' : 'info');
}

/**
 * Próbuje podmienić elementy w konfiguracji przy zmianie średnicy redukcji.
 * Zwraca true jeśli udało się podmienić wszystko, false jeśli wymagany pełny re-dobór.
 */
function trySwapReductionComponents(well, oldTarget, newTarget) {
    if (!well.config || well.config.length === 0) return false;
    
    const newConfig = [];
    const availProducts = getAvailableProducts(well).filter(p => filterByWellParams(p, well));
    
    for (const item of well.config) {
        const prod = studnieProducts.find(p => p.id === item.productId);
        if (!prod) {
            newConfig.push(item);
            continue;
        }
        
        // 1. Podmiana płyty redukcyjnej
        if (prod.componentType === 'plyta_redukcyjna') {
            const newPlate = getReductionPlate(availProducts, well.dn, true, newTarget);
            if (!newPlate) return false; // Nie znaleziono pasującej płyty
            newConfig.push({ productId: newPlate.id, quantity: item.quantity });
            continue;
        }
        
        // 2. Podmiana elementów o starej średnicy docelowej
        if (parseInt(prod.dn) === oldTarget) {
            // Szukamy odpowiednika w nowej średnicy o tym samym typie i wysokości
            const match = availProducts.find(p => 
                parseInt(p.dn) === newTarget && 
                p.componentType === prod.componentType && 
                p.height === prod.height
            );
            
            if (!match) return false; // Brakuje elementu o tej samej wysokości - wymuś re-dobór
            newConfig.push({ productId: match.id, quantity: item.quantity });
            continue;
        }
        
        // 3. Reszta (dennica, kręgi główne) zostaje bez zmian
        newConfig.push(item);
    }
    
    well.config = newConfig;
    well.configSource = 'MANUAL_SWAP'; // Oznaczamy że to była podmiana, ale zachowujemy strukturę
    return true;
}



/* ===== TRANSITION MANAGER (MENEDŻER PRZEJŚĆ) ===== */
let tmSelectedTransitions = new Set();
let tmCurrentFilters = { sourceMaterial: [], dn: [], search: '' };
let tmWellData = [];

window.openTransitionManagerModal = function () {
    if (!wells || wells.length === 0) {
        showToast('Brak studni w ofercie', 'error');
        return;
    }

    const transitionProducts = studnieProducts.filter(p => p.componentType === 'przejscie');
    const categories = [...new Set(transitionProducts.map(p => p.category))].sort();

    if (categories.length === 0) {
        showToast('Brak przejść w cenniku', 'error');
        return;
    }

    tmRefreshWellData();
    tmSelectedTransitions.clear();
    tmCurrentFilters = { sourceMaterial: [], dn: [], search: '' };

    let allMaterials = new Set();
    let allDNs = new Set();
    
    tmWellData.forEach(w => {
        w.transitions.forEach(tr => {
            if (tr.material !== 'Nieznany') allMaterials.add(tr.material);
            allDNs.add(tr.dnRaw);
        });
    });
    
    const overlay = showModal({
        id: 'transition-manager-modal',
        titleId: 'tm-title',
        html: `
    <div class="modal" style="width:90vw; max-width:95vw; height:90vh; display:flex; flex-direction:column; background:#111827; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
      
      <!-- Nagłówek -->
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding:1rem; flex-shrink:0;">
        <h3 id="tm-title" style="font-size:1.1rem; font-weight:700; color:var(--text);"><i data-lucide="list" aria-hidden="true"></i> Menedżer Przejść</h3>
        <button class="btn-icon" aria-label="Zamknij" onclick="window.closeTransitionManagerModal()"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      
      <!-- Sekcja filtrów -->
      <div style="padding:0.6rem 0.75rem; border-bottom:1px solid var(--border); background:rgba(0,0,0,0.2); flex-shrink:0; display:flex; gap:0.6rem; align-items:flex-start; flex-wrap:wrap;">
         <div style="min-width:140px; flex:1;">
            <div style="font-size:0.6rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.25rem;">Kategoria źródłowa</div>
            <div id="tm-filter-material-tiles" style="display:flex; flex-wrap:wrap; gap:0.15rem;">
               <div data-val="" onclick="tmSelectFilterMaterial('')"
                    style="padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.62rem; font-weight:600; background:rgba(16,185,129,0.2); border:1.5px solid rgba(16,185,129,0.55); color:#a7f3d0; transition:all 0.12s;"
                    onmouseenter="this.style.borderColor='rgba(16,185,129,0.7)'" onmouseleave="this.style.borderColor='rgba(16,185,129,0.55)'">Dowolna</div>
               ${[...allMaterials].sort().map(m => {
                 const safe = m.replace(/'/g,"\\'");
                 return `<div data-val="${safe}" onclick="tmSelectFilterMaterial('${safe}')"
                      style="padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.62rem; font-weight:500; background:rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.06); color:var(--text-primary); transition:all 0.12s;"
                      onmouseenter="this.style.borderColor='rgba(16,185,129,0.3)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.06)'">${m}</div>`;
               }).join('')}
            </div>
         </div>
         <div style="min-width:90px;">
            <div style="font-size:0.6rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.25rem;">Średnica DN</div>
            <div id="tm-filter-dn-tiles" style="display:flex; flex-wrap:wrap; gap:0.15rem;">
               <div data-val="" onclick="tmSelectFilterDn('')"
                    style="padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.62rem; font-weight:600; background:rgba(16,185,129,0.2); border:1.5px solid rgba(16,185,129,0.55); color:#a7f3d0; transition:all 0.12s;"
                    onmouseenter="this.style.borderColor='rgba(16,185,129,0.7)'" onmouseleave="this.style.borderColor='rgba(16,185,129,0.55)'">Dowolne</div>
               ${[...allDNs].sort((a,b) => parseFloat(a) - parseFloat(b)).map(dn => {
                 const safe = String(dn).replace(/'/g,"\\'");
                 return `<div data-val="${safe}" onclick="tmSelectFilterDn('${safe}')"
                      style="padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.62rem; font-weight:500; background:rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.06); color:var(--text-primary); transition:all 0.12s;"
                      onmouseenter="this.style.borderColor='rgba(16,185,129,0.3)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.06)'">${dn}</div>`;
               }).join('')}
            </div>
         </div>
         <div style="min-width:160px; flex:1;">
            <div style="font-size:0.6rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.25rem;">Szukaj</div>
            <input type="text" id="tm-filter-search" placeholder="Nazwa, materiał, DN..." maxlength="30" oninput="tmApplyFilters()" style="width:100%; padding:0.25rem 0.4rem; font-size:0.65rem; background:#1a2536; border:1.5px solid rgba(255,255,255,0.06); border-radius:4px; color:var(--text-primary); outline:none; transition:all 0.12s;" onfocus="this.style.borderColor='rgba(16,185,129,0.4)'" onblur="this.style.borderColor='rgba(255,255,255,0.06)'">
         </div>
      </div>

      <!-- Pasek narzędzi -->
      <div style="flex-shrink:0; display:flex; align-items:center; gap:0.75rem; padding:0.45rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.04); background:rgba(0,0,0,0.12); font-size:0.78rem; color:var(--text-muted);">
         <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer; padding:0.2rem 0.5rem; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.15); border-radius:6px; color:var(--text-primary);">
            <input type="checkbox" id="tm-select-all" onchange="tmToggleSelectAll()" style="width:15px; height:15px; cursor:pointer;">
            <span style="font-weight:500;">Zaznacz wszystko</span>
         </label>
         <span style="opacity:0.2;">|</span>
         <span>Widoczne: <strong id="tm-visible-count" style="color:var(--text-primary);">0</strong></span>
         <span>Zaznaczone: <strong id="tm-selected-count" style="color:var(--accent);">0</strong></span>
         <div style="margin-left:auto; display:flex; align-items:center; gap:0.3rem;">
            <button onclick="tmSortBy('wellName')" style="background:none; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0.25rem 0.5rem; color:var(--text-muted); cursor:pointer; font-size:0.72rem; display:flex; align-items:center; gap:0.3rem; transition:all 0.15s;" onmouseover="this.style.borderColor='rgba(16,185,129,0.3)';this.style.color='var(--text-primary)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='var(--text-muted)'">
               <span>↕</span> Sortuj A–Z
            </button>
         </div>
      </div>

      <!-- Karty studni -->
      <div style="flex-grow:1; overflow-y:auto; overflow-x:hidden; padding:0.5rem 0.75rem; background:rgba(0,0,0,0.1);">
         <div id="tm-table-body"></div>
      </div>

      <!-- Panel podglądu przed apply -->
      <div id="tm-preview-panel" style="display:none; padding:0.6rem 1rem; border-top:1px solid var(--border); background:rgba(16,185,129,0.05); flex-shrink:0;">
         <div id="tm-preview-content"></div>
      </div>

      <!-- Panel Akcji -->
      <div style="padding:0.6rem 0.75rem; border-top:1px solid var(--border); background:#1e293b; flex-shrink:0;">
         <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
               <div style="font-size:0.6rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:0.25rem;">Docelowa kategoria (na co zamienić)</div>
               <div id="tm-target-cat-tiles" style="display:flex; flex-wrap:wrap; gap:0.2rem;">
                  <div data-val="" onclick="tmSelectTargetCat('')"
                       style="padding:0.25rem 0.5rem; border-radius:4px; cursor:pointer; font-size:0.65rem; font-weight:600; background:rgba(16,185,129,0.2); border:1.5px solid rgba(16,185,129,0.55); color:#a7f3d0; transition:all 0.12s;"
                       onmouseenter="this.style.borderColor='rgba(16,185,129,0.7)'" onmouseleave="this.style.borderColor='rgba(16,185,129,0.55)'">— Wybierz —</div>
                  ${categories.map(cat => {
                    const safe = cat.replace(/'/g,"\\'");
                    return `<div data-val="${safe}" onclick="tmSelectTargetCat('${safe}')"
                         style="padding:0.25rem 0.5rem; border-radius:4px; cursor:pointer; font-size:0.65rem; font-weight:500; background:rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.06); color:var(--text-primary); transition:all 0.12s;"
                         onmouseenter="this.style.borderColor='rgba(16,185,129,0.3)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.06)'">${cat}</div>`;
                  }).join('')}
               </div>
            </div>
            <div style="flex-shrink:0;">
               <button onclick="tmApplyChanges()" style="background:rgba(16,185,129,0.15); border:1.5px solid rgba(16,185,129,0.4); border-radius:5px; padding:0.35rem 0.8rem; display:flex; align-items:center; gap:0.35rem; font-size:0.72rem; font-weight:600; color:#6ee7b7; cursor:pointer; transition:all 0.15s;" onmouseenter="this.style.background='rgba(16,185,129,0.25)'" onmouseleave="this.style.background='rgba(16,185,129,0.15)'">
                  <i data-lucide="zap"></i> Zastosuj
               </button>
            </div>
         </div>
      </div>

    </div>`
    });
    if (window.lucide) window.lucide.createIcons({ root: overlay });
    
    tmRenderTable();
};

window.closeTransitionManagerModal = function () {
    const el = document.getElementById('transition-manager-modal');
    if (el) el.remove();
};

window.tmRefreshWellData = function() {
    tmWellData = [];
    for (let i = 0; i < wells.length; i++) {
        const well = wells[i];
        
        let trList = [];
        if (well.przejscia && well.przejscia.length > 0) {
            trList = well.przejscia.map((tr, trIdx) => {
                const p = studnieProducts.find(prod => prod.id === tr.productId);
                return {
                    trIndex: trIdx,
                    angle: tr.angle || 0,
                    rzedna: tr.rzednaWlaczenia !== undefined && tr.rzednaWlaczenia !== null ? tr.rzednaWlaczenia : well.rzednaDna,
                    productId: tr.productId,
                    material: p ? p.category : 'Nieznany',
                    dnRaw: p ? p.dn : '?',
                    flowType: tr.flowType || FLOW_TYPES.WLOT
                };
            });
        }

        let wellPrice = 0;
        if (typeof calcWellStats === 'function') {
            const stats = calcWellStats(well);
            let transportCost = 0;
            if (typeof calculateOfferTotals === 'function') {
                const totals = calculateOfferTotals();
                if (totals && totals.globalWeight > 0 && totals.totalTransportCost > 0) {
                    transportCost = totals.totalTransportCost * (stats.weight / totals.globalWeight);
                }
            }
            wellPrice = stats.price + transportCost;
        }

        tmWellData.push({
            wellIndex: i,
            uid: `well_${i}`,
            wellName: well.nazwaWlasna || well.name || `Studnia ${i+1}`,
            wellDn: well.dn,
            rzednaDna: well.rzednaDna || '0.000',
            price: wellPrice,
            transitions: trList
        });
    }
};

let tmSortState = { column: null, asc: true };
let tmTargetCat = '';

window.tmSortBy = function(column) {
    if (tmSortState.column === column) {
        tmSortState.asc = !tmSortState.asc;
    } else {
        tmSortState.column = column;
        tmSortState.asc = true;
    }
    tmRenderTable();
};

window.tmApplyFilters = function() {
    tmCurrentFilters.search = (document.getElementById('tm-filter-search')?.value || '').toLowerCase();
    tmRenderTable();
};

function tmHighlightTiles(containerId, selectedVal) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('[data-val]').forEach(d => {
        const isSel = d.dataset.val === selectedVal;
        d.style.background = isSel ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)';
        d.style.borderColor = isSel ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)';
        d.style.color = isSel ? '#a7f3d0' : 'var(--text-primary)';
    });
}

function tmHighlightTilesMulti(containerId, selectedVals) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('[data-val]').forEach(d => {
        const isSel = selectedVals.length === 0 ? d.dataset.val === '' : d.dataset.val !== '' && selectedVals.includes(d.dataset.val);
        d.style.background = isSel ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)';
        d.style.borderColor = isSel ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)';
        d.style.color = isSel ? '#a7f3d0' : 'var(--text-primary)';
    });
}

window.tmSelectFilterMaterial = function(val) {
    if (val === '') {
        tmCurrentFilters.sourceMaterial = [];
    } else {
        const idx = tmCurrentFilters.sourceMaterial.indexOf(val);
        if (idx >= 0) tmCurrentFilters.sourceMaterial.splice(idx, 1);
        else tmCurrentFilters.sourceMaterial.push(val);
    }
    tmHighlightTilesMulti('tm-filter-material-tiles', tmCurrentFilters.sourceMaterial);
    tmApplyFilters();
};

window.tmSelectFilterDn = function(val) {
    if (val === '') {
        tmCurrentFilters.dn = [];
    } else {
        const idx = tmCurrentFilters.dn.indexOf(val);
        if (idx >= 0) tmCurrentFilters.dn.splice(idx, 1);
        else tmCurrentFilters.dn.push(val);
    }
    tmHighlightTilesMulti('tm-filter-dn-tiles', tmCurrentFilters.dn);
    tmApplyFilters();
};

window.tmSelectTargetCat = function(val) {
    tmTargetCat = val;
    tmHighlightTiles('tm-target-cat-tiles', val);
    tmUpdatePreview();
};

window.tmRenderTable = function() {
    const container = document.getElementById('tm-table-body');
    if (!container) return;

    // Sortuj studnie jesli potrzeba
    let sortedWells = [...tmWellData];
    if (tmSortState.column === 'wellName') {
        sortedWells.sort((a, b) => {
            const va = a.wellName.toLowerCase();
            const vb = b.wellName.toLowerCase();
            return tmSortState.asc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }

    let html = '';
    let visibleCount = 0;
    let allChecked = true;
    let anyChecked = false;

    sortedWells.forEach(w => {
        let matchingTrs = [];
        w.transitions.forEach(tr => {
            let matchMat = true, matchDn = true, matchSearch = true;
            if (tmCurrentFilters.sourceMaterial.length > 0 && !tmCurrentFilters.sourceMaterial.includes(tr.material)) matchMat = false;
            if (tmCurrentFilters.dn.length > 0 && !tmCurrentFilters.dn.includes(String(tr.dnRaw))) matchDn = false;
            if (tmCurrentFilters.search) {
                const s = tmCurrentFilters.search;
                matchSearch = w.wellName.toLowerCase().includes(s) ||
                    tr.material.toLowerCase().includes(s) ||
                    String(tr.dnRaw).includes(s);
            }
            if (matchMat && matchDn && matchSearch) matchingTrs.push(tr);
        });
        if (matchingTrs.length === 0) return;
        visibleCount++;

        const wellSelCount = matchingTrs.filter(tr => tmSelectedTransitions.has(`${w.wellIndex}:${tr.trIndex}`)).length;
        const wellAllSel = wellSelCount === matchingTrs.length;
        const wellSomeSel = wellSelCount > 0;
        if (!wellAllSel) allChecked = false;
        if (wellSomeSel) anyChecked = true;

        const tilesHtml = matchingTrs.map(tr => {
            const key = `${w.wellIndex}:${tr.trIndex}`;
            const isSel = tmSelectedTransitions.has(key);
            const safeMaterial = tr.material.replace(/'/g, "\\'");
            const locked = isWellLocked(w.wellIndex);
            return `
            <div ${locked ? '' : `onclick="tmOpenEditTransitionPopup(${w.wellIndex}, ${tr.trIndex}, event)"`}
                  style="background:${isSel ? 'rgba(16,185,129,0.15)' : '#1a2536'};
                         border:1px solid ${isSel ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)'};
                         border-radius:8px; padding:0.4rem 0.45rem; ${locked ? 'cursor:default;' : 'cursor:pointer;'}
                         transition:all 0.2s; display:flex; flex-direction:column; gap:0.1rem;"
                  ${locked ? '' : `onmouseenter="this.style.borderColor='rgba(16,185,129,0.35)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)'"`}
                  ${locked ? '' : `onmouseleave="this.style.borderColor='${isSel ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)'}';this.style.transform='none';this.style.boxShadow='none'"`}>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.3rem;">
                <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; flex:1;">
                  <input type="checkbox" class="tm-row-cb" value="${key}" ${isSel ? 'checked' : ''}
                         onclick="event.stopPropagation(); tmToggleTransition('${key}', this.checked)"
                         style="width:14px; height:14px; cursor:pointer; margin:0; flex-shrink:0;" ${locked ? 'disabled' : ''}>
                  <span style="font-size:0.76rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${safeMaterial}">${tr.material}</span>
                  <span style="font-size:0.82rem; font-weight:800; color:#4ade80; flex-shrink:0;">DN${tr.dnRaw}</span>
                </div>
                ${locked ? '' : `
                <button onclick="event.stopPropagation(); tmOpenEditTransitionPopup(${w.wellIndex}, ${tr.trIndex}, event)"
                        style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.2); border-radius:4px; cursor:pointer; padding:0.05rem 0.3rem; color:#34d399; font-size:0.6rem; line-height:1.3; flex-shrink:0; transition:all 0.15s;"
                        onmouseenter="this.style.background='rgba(16,185,129,0.25)'"
                        onmouseleave="this.style.background='rgba(16,185,129,0.12)'">
                  ✎
                </button>`}
              </div>
              <div style="display:flex; gap:0.3rem; align-items:center; font-size:0.65rem; color:var(--text-muted);">
                <span>${tr.rzedna != null ? parseFloat(tr.rzedna).toFixed(2)+'m' : '—'}</span>
                <span style="opacity:0.3;">·</span>
                <span style="color:#fcd34d; font-weight:600;">${tr.angle}°</span>
                <span style="opacity:0.3;">·</span>
                <span style="background:${tr.flowType === FLOW_TYPES.WLOT ? 'rgba(52,211,153,0.18)' : 'rgba(251,191,36,0.18)'}; color:${tr.flowType === FLOW_TYPES.WLOT ? '#34d399' : '#fbbf24'}; padding:0.02rem 0.3rem; border-radius:3px; font-size:0.6rem; font-weight:700;">${tr.flowType === FLOW_TYPES.WLOT ? 'WLOT' : 'WYLOT'}</span>
              </div>
            </div>`;
        }).join('');

        const wellLocked = isWellLocked(w.wellIndex);
        html += `
        <div style="background:#111827; border:1px solid ${wellLocked ? 'rgba(239,68,68,0.2)' : (wellSomeSel ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)')}; border-radius:10px; margin-bottom:0.6rem; overflow:hidden; transition:all 0.2s;${wellLocked ? ' opacity:0.7;' : ''}">
          <div style="display:flex; align-items:center; padding:0.55rem 0.75rem; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05);">
            <input type="checkbox" ${wellAllSel ? 'checked' : ''} onchange="tmToggleWell(${w.wellIndex}, this.checked)"
                   style="width:16px; height:16px; margin-right:0.75rem; cursor:pointer;" ${wellLocked ? 'disabled' : ''}>
            <div style="flex:1; display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <span style="font-weight:700; color:var(--text-primary); font-size:0.85rem;">${w.wellName}</span>
              ${wellLocked ? '<span style="color:#f87171; font-size:0.68rem; display:flex; align-items:center; gap:0.2rem;"><i data-lucide="lock" style="width:12px;height:12px;"></i>Zablokowana</span>' : ''}
              <span style="color:var(--text-muted); font-size:0.72rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); padding:0.1rem 0.45rem; border-radius:5px; font-weight:600;">DN${w.wellDn}</span>
              <span style="color:var(--text-muted); font-size:0.72rem;">Rzędna: ${w.rzednaDna}</span>
              <span style="color:#34d399; font-weight:700; font-size:0.8rem;">${fmtInt(w.price)} PLN</span>
            </div>
            <span style="color:var(--text-muted); font-size:0.68rem; background:rgba(16,185,129,0.1); padding:0.15rem 0.55rem; border-radius:12px; white-space:nowrap; font-weight:500; border:1px solid rgba(16,185,129,0.15);">
              ${wellSelCount}/${matchingTrs.length}
            </span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:0.45rem; padding:0.55rem;">
            ${tilesHtml}
          </div>
        </div>`;
    });

    if (visibleCount === 0) {
        html = `<div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:0.9rem;">
                  <div style="font-size:2.5rem; margin-bottom:0.5rem; opacity:0.2;">⊘</div>
                  Brak przejść spełniających kryteria.
                </div>`;
    }

    container.innerHTML = html;

    const visEl = document.getElementById('tm-visible-count');
    if (visEl) visEl.textContent = visibleCount;
    tmUpdateSelectedCount();

    const selectAllCb = document.getElementById('tm-select-all');
    if (selectAllCb) {
        selectAllCb.disabled = visibleCount === 0;
        selectAllCb.checked = visibleCount > 0 && allChecked && anyChecked;
    }

    tmUpdatePreview();
};

window.tmToggleWell = function(wellIdx, isChecked) {
    if (isWellLocked(wellIdx)) return;
    const wData = tmWellData.find(w => w.wellIndex === wellIdx);
    if (!wData) return;
    wData.transitions.forEach(tr => {
        const key = `${wellIdx}:${tr.trIndex}`;
        if (isChecked) tmSelectedTransitions.add(key);
        else tmSelectedTransitions.delete(key);
    });
    tmRenderTable();
};

window.tmToggleTransition = function(key, isChecked) {
    if (isChecked) tmSelectedTransitions.add(key);
    else tmSelectedTransitions.delete(key);
    tmRenderTable();
};

window.tmToggleSelectAll = function() {
    const isChecked = document.getElementById('tm-select-all').checked;
    const visibleCbs = document.querySelectorAll('.tm-row-cb');
    
    visibleCbs.forEach(cb => {
        const key = cb.value;
        const wellIdx = parseInt(key.split(':')[0], 10);
        if (isChecked && isWellLocked(wellIdx)) return;
        if (isChecked) tmSelectedTransitions.add(key);
        else tmSelectedTransitions.delete(key);
    });
    
    tmRenderTable();
};

let tmEditSelectedCat = null;
let tmEditSelectedDn = null;

window.tmOpenEditTransitionPopup = function(wellIdx, trIdx, event) {
    event.stopPropagation();
    if (isWellLocked(wellIdx)) {
        showToast('<i data-lucide="lock"></i> Studnia zablokowana — posiada zamówienie lub zaakceptowane zlecenie produkcyjne.', 'error');
        return;
    }
    const existing = document.getElementById('tm-edit-popup');
    if (existing) existing.remove();
    tmEditSelectedCat = null;
    tmEditSelectedDn = null;

    const well = wells[wellIdx];
    if (!well || !well.przejscia || !well.przejscia[trIdx]) return;
    const tr = well.przejscia[trIdx];
    const currentP = studnieProducts.find(p => p.id === tr.productId);

    const allProducts = studnieProducts.filter(p => p.componentType === 'przejscie');
    const categories = [...new Set(allProducts.map(p => p.category))].sort();
    const allDNs = [...new Set(allProducts.map(p => p.dn))].sort((a,b) => parseFloat(a) - parseFloat(b));

    const currentCat = currentP ? currentP.category : '';
    const currentDn = currentP ? currentP.dn : '';

    const rect = event.currentTarget.getBoundingClientRect();
    const popupW = 340;
    let left = Math.min(rect.left, window.innerWidth - popupW - 16);
    if (left < 8) left = 8;
    const top = rect.bottom + 4;
    const maxH = Math.min(400, window.innerHeight - top - 20);

    const popup = document.createElement('div');
    popup.id = 'tm-edit-popup';
    popup.style.cssText = `position:fixed;z-index:100000;background:#1e293b;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:0.6rem;box-shadow:0 20px 60px rgba(0,0,0,0.5);width:${popupW}px;top:${top}px;left:${left}px;animation:fadeIn 0.1s ease;`;
    if (maxH > 120) { popup.style.maxHeight = maxH + 'px'; popup.style.overflowY = 'auto'; }

    const currentLabel = currentP ? `${currentP.category} DN${currentP.dn}` : 'Nieznane';

    popup.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0 0.1rem 0.4rem;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:0.45rem;">
        <div><div style="font-weight:700;color:var(--text-primary);font-size:0.8rem;">Zmień przejście</div><div style="font-size:0.64rem;color:var(--text-muted);">Aktualnie: ${currentLabel}</div></div>
        <button onclick="this.closest('#tm-edit-popup').remove()" style="background:rgba(255,255,255,0.05);border:none;border-radius:4px;color:var(--text-muted);cursor:pointer;font-size:0.85rem;padding:0.1rem 0.35rem;line-height:1.3;">✕</button>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.6rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:0.25rem;">Typ</div>
          <div id="tm-edit-type-list" style="display:flex;flex-direction:column;gap:0.15rem;max-height:180px;overflow-y:auto;padding-right:0.15rem;">
            ${categories.map(cat => {
              const isCur = cat === currentCat;
              return `<div data-cat="${cat}" onclick="tmEditSelectType(this,${wellIdx},${trIdx})"
                   style="padding:0.3rem 0.45rem;border-radius:5px;cursor:pointer;font-size:0.7rem;font-weight:600;background:${isCur ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)'};border:1.5px solid ${isCur ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)'};color:${isCur ? '#a7f3d0' : 'var(--text-primary)'};transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;${isCur ? 'box-shadow:0 0 8px rgba(16,185,129,0.15);' : ''}"
                   onmouseenter="this.style.borderColor='rgba(16,185,129,0.35)'" onmouseleave="this.style.borderColor='${isCur ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)'}'">${isCur ? '<span style="color:#34d399;font-size:0.75rem;">◆</span>' : '<span style="color:transparent;font-size:0.75rem;">◆</span>'}${cat}</div>`;
            }).join('')}
          </div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.6rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:0.25rem;">Średnica</div>
          <div id="tm-edit-dn-list" style="display:flex;flex-direction:column;gap:0.15rem;max-height:180px;overflow-y:auto;padding-right:0.15rem;">
            ${allDNs.map(dn => {
              const isCur = dn === currentDn;
              return `<div data-dn="${dn}" onclick="tmEditSelectDN(this,${wellIdx},${trIdx})"
                   style="padding:0.3rem 0.45rem;border-radius:5px;cursor:pointer;font-size:0.7rem;font-weight:700;background:${isCur ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.03)'};border:1.5px solid ${isCur ? 'rgba(52,211,153,0.55)' : 'rgba(255,255,255,0.06)'};color:${isCur ? '#6ee7b7' : 'var(--text-primary)'};transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;${isCur ? 'box-shadow:0 0 8px rgba(52,211,153,0.15);' : ''}"
                   onmouseenter="this.style.borderColor='rgba(52,211,153,0.35)'" onmouseleave="this.style.borderColor='${isCur ? 'rgba(52,211,153,0.55)' : 'rgba(255,255,255,0.06)'}'">${isCur ? '<span style="color:#34d399;font-size:0.75rem;">◆</span>' : '<span style="color:transparent;font-size:0.75rem;">◆</span>'}DN${dn}</div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div id="tm-edit-result" style="margin-top:0.45rem;padding:0.35rem 0.45rem;background:rgba(0,0,0,0.2);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:var(--text-muted);font-size:0.7rem;">Wybierz typ i średnicę</span>
        <button id="tm-edit-apply-btn" style="display:none;background:#6366f1;border:none;border-radius:5px;padding:0.28rem 0.55rem;color:#fff;font-size:0.7rem;font-weight:600;cursor:pointer;" onclick="tmEditApply(${wellIdx},${trIdx})">Zastosuj</button>
      </div>`;

    document.body.appendChild(popup);

    const closeHandler = function(e) {
        if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', closeHandler); }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
};

function tmEditSelectType(el, wellIdx, trIdx) {
    const list = document.getElementById('tm-edit-type-list');
    list.querySelectorAll('[data-cat]').forEach(div => { div.style.background = 'rgba(255,255,255,0.03)'; div.style.borderColor = 'rgba(255,255,255,0.06)'; div.style.color = 'var(--text-primary)'; div.style.boxShadow = 'none'; const dot = div.querySelector('span'); if (dot) dot.innerHTML = '◆'; dot.style.color = 'transparent'; });
    el.style.background = 'rgba(16,185,129,0.2)'; el.style.borderColor = 'rgba(16,185,129,0.55)'; el.style.color = '#a7f3d0'; el.style.boxShadow = '0 0 8px rgba(16,185,129,0.15)'; const dot = el.querySelector('span'); if (dot) dot.style.color = '#34d399';

    tmEditSelectedCat = el.dataset.cat;
    tmEditSelectedDn = null;

    const products = studnieProducts.filter(p => p.componentType === 'przejscie' && p.category === tmEditSelectedCat);
    const dns = [...new Set(products.map(p => p.dn))].sort((a,b) => parseFloat(a) - parseFloat(b));

    const dnList = document.getElementById('tm-edit-dn-list');
    dnList.innerHTML = dns.map(dn => `<div data-dn="${dn}" onclick="tmEditSelectDN(this,${wellIdx},${trIdx})" style="padding:0.3rem 0.45rem;border-radius:5px;cursor:pointer;font-size:0.7rem;font-weight:600;background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.06);color:var(--text-primary);transition:all 0.12s;display:flex;align-items:center;gap:0.35rem;" onmouseenter="this.style.borderColor='rgba(52,211,153,0.35)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.06)'"><span style="color:transparent;font-size:0.75rem;">◆</span>DN${dn}</div>`).join('');

    const resultSpan = document.querySelector('#tm-edit-result span');
    if (resultSpan) resultSpan.textContent = 'Wybierz średnicę';
    const applyBtn = document.getElementById('tm-edit-apply-btn');
    if (applyBtn) applyBtn.style.display = 'none';

    const currentP = studnieProducts.find(p => p.id === wells[wellIdx]?.przejscia?.[trIdx]?.productId);
    if (currentP && currentP.category === tmEditSelectedCat) {
        dnList.querySelectorAll('[data-dn]').forEach(div => { if (div.dataset.dn === currentP.dn) tmEditSelectDN(div, wellIdx, trIdx); });
    }
}

function tmEditSelectDN(el, wellIdx, trIdx) {
    const list = document.getElementById('tm-edit-dn-list');
    list.querySelectorAll('[data-dn]').forEach(div => { div.style.background = 'rgba(255,255,255,0.03)'; div.style.borderColor = 'rgba(255,255,255,0.06)'; div.style.color = 'var(--text-primary)'; div.style.boxShadow = 'none'; const dot = div.querySelector('span'); if (dot) dot.style.color = 'transparent'; });
    el.style.background = 'rgba(52,211,153,0.2)'; el.style.borderColor = 'rgba(52,211,153,0.55)'; el.style.color = '#6ee7b7'; el.style.boxShadow = '0 0 8px rgba(52,211,153,0.15)'; const dot = el.querySelector('span'); if (dot) dot.style.color = '#34d399';

    tmEditSelectedDn = el.dataset.dn;

    if (tmEditSelectedCat && tmEditSelectedDn) {
        const product = studnieProducts.find(p => p.componentType === 'przejscie' && p.category === tmEditSelectedCat && String(p.dn) === tmEditSelectedDn);
        if (product) {
            const resultDiv = document.getElementById('tm-edit-result');
            resultDiv.innerHTML = `<div><span style="color:var(--text-primary);font-size:0.73rem;font-weight:600;">${product.category} DN${product.dn}</span><span style="color:#34d399;font-weight:700;margin-left:0.5rem;font-size:0.7rem;">${product.price != null ? parseInt(product.price).toLocaleString('pl-PL') : '—'} PLN</span></div>
              <button style="background:#6366f1;border:none;border-radius:5px;padding:0.28rem 0.55rem;color:#fff;font-size:0.7rem;font-weight:600;cursor:pointer;" onclick="tmEditApply(${wellIdx},${trIdx})">Zastosuj</button>`;
        }
    }
}

async function tmEditApply(wellIdx, trIdx) {
    if (!tmEditSelectedCat || !tmEditSelectedDn) return;
    if (isWellLocked(wellIdx)) {
        document.getElementById('tm-edit-popup')?.remove();
        showToast('<i data-lucide="lock"></i> Studnia zablokowana.', 'error');
        return;
    }
    const product = studnieProducts.find(p => p.componentType === 'przejscie' && p.category === tmEditSelectedCat && String(p.dn) === tmEditSelectedDn);
    if (!product) { showToast('Nie znaleziono produktu', 'error'); return; }

    const tr = wells[wellIdx]?.przejscia?.[trIdx];
    if (!tr) return;
    tr.productId = product.id;

    document.getElementById('tm-edit-popup')?.remove();
    tmEditSelectedCat = null; tmEditSelectedDn = null;

    try {
        currentWellIndex = wellIdx;
        await autoSelectComponents(true);
        refreshAll();
    } catch (e) {
        logger.error('wellPopups', 'tmEditApply error:', e);
    }
    tmRefreshWellData();
    tmRenderTable();
    showToast(`Zmieniono na ${product.category} DN${product.dn}`, 'success');
}

window.tmUpdateSelectedCount = function() {
    const countEl = document.getElementById('tm-selected-count');
    if (countEl) countEl.textContent = tmSelectedTransitions.size;
};

window.tmUpdatePreview = function() {
    const panel = document.getElementById('tm-preview-panel');
    const content = document.getElementById('tm-preview-content');
    if (!panel || !content) return;

    const targetCat = tmTargetCat;
    if (!targetCat || tmSelectedTransitions.size === 0) {
        panel.style.display = 'none';
        return;
    }

    let replaceList = [];
    let skipList = [];

    tmSelectedTransitions.forEach(key => {
        const [wellIdxStr, trIdxStr] = key.split(':');
        const wellIdx = parseInt(wellIdxStr, 10);
        const trIdx = parseInt(trIdxStr, 10);
        const well = wells[wellIdx];
        if (!well || !well.przejscia || !well.przejscia[trIdx]) return;
        const tr = well.przejscia[trIdx];
        const p = studnieProducts.find(prod => prod.id === tr.productId);
        if (!p || p.category === targetCat) return;

        const replacement = studnieProducts.find(pr =>
            pr.componentType === 'przejscie' &&
            pr.category === targetCat &&
            pr.active !== 0 &&
            pr.dn === p.dn
        );

        const label = `${well.name || `Studnia ${wellIdx+1}`} — ${p.category} DN${p.dn}`;
        if (replacement) {
            replaceList.push(label);
        } else {
            skipList.push(label);
        }
    });

    if (replaceList.length === 0 && skipList.length === 0) {
        panel.style.display = 'none';
        return;
    }

    let html = '';
    if (replaceList.length > 0) {
        html += `<div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;"><span style="color:#34d399; font-weight:800;">✅ Zostanie zamienione: ${replaceList.length}</span></div>`;
        html += `<div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.5rem;">`;
        replaceList.forEach(l => {
            html += `<span style="background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.2); color:#34d399; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.72rem;">${l}</span>`;
        });
        html += `</div>`;
    }
    if (skipList.length > 0) {
        html += `<div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;"><span style="color:#f87171; font-weight:800;">⚠️ Brak odpowiednika w ${targetCat}: ${skipList.length}</span></div>`;
        html += `<div style="display:flex; flex-wrap:wrap; gap:0.3rem;">`;
        skipList.forEach(l => {
            html += `<span style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#f87171; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.72rem;">${l}</span>`;
        });
        html += `</div>`;
    }

    content.innerHTML = html;
    panel.style.display = 'block';
};

window.activatePreviewPanel = function() {
    setTimeout(tmUpdatePreview, 100);
};

window.tmApplyChanges = async function() {
    if (tmSelectedTransitions.size === 0) {
        showToast('Zaznacz co najmniej jedno przejście', 'warning');
        return;
    }
    
    const targetCat = tmTargetCat;

    if (!targetCat) {
        showToast('Wybierz docelową kategorię przejść', 'error');
        return;
    }

    let replacedCount = 0;
    let skippedDetails = [];
    let skippedLocked = new Set();
    let modifiedWellsIndices = new Set();

    tmSelectedTransitions.forEach(key => {
        const [wellIdxStr, trIdxStr] = key.split(':');
        const wellIdx = parseInt(wellIdxStr, 10);
        const trIdx = parseInt(trIdxStr, 10);
        const well = wells[wellIdx];

        if (isWellLocked(wellIdx)) {
            skippedLocked.add(wellIdx);
            return;
        }

        if (!well || !well.przejscia || !well.przejscia[trIdx]) return;

        const tr = well.przejscia[trIdx];
        const p = studnieProducts.find(prod => prod.id === tr.productId);
        if (!p) return;
        if (p.category === targetCat) return;

        const replacement = studnieProducts.find(pr => 
            pr.componentType === 'przejscie' && 
            pr.category === targetCat && 
            pr.active !== 0 &&
            pr.dn === p.dn
        );

        if (replacement) {
            well.przejscia[trIdx].productId = replacement.id;
            replacedCount++;
            modifiedWellsIndices.add(wellIdx);
        } else {
            skippedDetails.push({
                wellName: well.nazwaWlasna || well.name || `Studnia ${wellIdx+1}`,
                material: p.category,
                dn: p.dn,
                targetCat: targetCat
            });
        }
    });

    if (skippedLocked.size > 0) {
        showToast(`Pominięto ${skippedLocked.size} zablokowaną studnię/studnie (zamówienie/zlecenie).`, 'warning');
    }

    if (replacedCount === 0) {
        if (skippedLocked.size > 0) {
            // toast został już pokazany powyżej
        } else if (skippedDetails.length > 0) {
            showSkippedPopup(skippedDetails, targetCat);
        } else {
            showToast('Nie znaleziono pasujących przejść do zamiany.', 'info');
        }
        return;
    }

    showToast(`Trwa przeliczanie zmodyfikowanych studni (${modifiedWellsIndices.size})...`, 'info');

    for (const wellIdx of modifiedWellsIndices) {
        const originalIndex = currentWellIndex;
        currentWellIndex = wellIdx;
        await autoSelectComponents(true);
        currentWellIndex = originalIndex;
    }

    refreshAll();
    
    if (skippedDetails.length > 0) {
        showSkippedPopup(skippedDetails, targetCat);
    }
    
    let msg = `Zakończono. Zamieniono ${replacedCount} przejść w ${modifiedWellsIndices.size} studniach.`;
    showToast(msg, 'success');
    
    tmSelectedTransitions.clear();
    tmRefreshWellData();
    
    tmRenderTable();
};

function showSkippedPopup(skippedDetails, targetCat) {
    const rowsHtml = skippedDetails.map((s, i) => `
        <tr>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${i + 1}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${s.wellName}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${s.material}</td>
            <td style="padding:0.35rem 0.6rem; text-align:center; white-space:nowrap;">${s.dn}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap; color:#f87171;">Brak produktu ${s.targetCat} o średnicy ${s.dn}</td>
        </tr>
    `).join('');

    showModal({
        id: 'skipped-popup-modal',
        titleId: 'skipped-title',
        html: `
      <div style="background:var(--bg-secondary, #1e293b); border:1px solid rgba(239,68,68,0.3); border-radius:16px; padding:1.2rem 1.5rem; width:700px; max-width:92vw; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; position:sticky; top:0; background:var(--bg-secondary, #1e293b); padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div id="skipped-title" style="font-size:1rem; font-weight:800; color:#f87171;"><i data-lucide="alert-triangle" aria-hidden="true"></i> Pominięte przejścia (${skippedDetails.length})</div>
          <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem;"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
            Poniższe przejścia nie zostały zamienione — w kategorii <strong>${targetCat}</strong> nie istnieje produkt o podanej średnicy.
        </div>
        <table style="width:100%; font-size:0.8rem; border-collapse:collapse;">
            <thead style="position:sticky; top:0; background:#1e293b;">
                <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Lp.</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Studnia</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Obecny typ</th>
                    <th style="padding:0.4rem 0.6rem; text-align:center; white-space:nowrap;">Średnica</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Powód pominięcia</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.8rem; border-top:1px solid rgba(255,255,255,0.08);">
            <button class="btn btn-secondary" onclick="closeModal(); window.activatePreviewPanel && window.activatePreviewPanel()" style="font-size:0.8rem; padding:0.4rem 1rem; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399;">
                <i data-lucide="arrow-left"></i> Wróć do menedżera
            </button>
            <button class="btn btn-secondary" onclick="closeModal()" style="font-size:0.8rem; padding:0.4rem 1.2rem;">Zamknij</button>
        </div>
      </div>
    `
    });
    if (window.lucide) window.lucide.createIcons();
}
