/* ===== Extracted to wellPopups.js ===== */

function openZakonczeniePopup() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    const dn = well.dn;
    const effectiveDn = dn === 'styczna' ? 1000 : dn;
    const topClosureTypes = [
        'konus',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'pierscien_odciazajacy'
    ];

    // Znajdź wszystkie produkty zamknięcia górnego dla tego DN (lub uniwersalne z dn=null)
    const candidates = studnieProducts.filter(
        (p) =>
            topClosureTypes.includes(p.componentType) &&
            (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null) &&
            filterByWellParams(p, well)
    );

    // Grupuj według componentType dla ładniejszego wyświetlania
    const typeLabels = {
        konus: '<i data-lucide="diamond"></i> Konus',
        plyta_din:
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta DIN',
        plyta_najazdowa:
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta Odciążająca',
        plyta_zamykajaca:
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta Odciążająca',
        pierscien_odciazajacy: '<i data-lucide="settings"></i> Pierścień Odciążający'
    };

    const typeColors = {
        konus: 'rgba(124,58,237,0.15)',
        plyta_din: 'rgba(30,58,95,0.3)',
        plyta_najazdowa: 'rgba(30,58,95,0.3)',
        plyta_zamykajaca: 'rgba(30,58,95,0.3)',
        pierscien_odciazajacy: 'rgba(30,58,95,0.3)'
    };

    const currentZak = well.zakonczenie;

    let tilesHtml = '';
    if (candidates.length === 0) {
        const errorDn = dn === 'styczna' ? 'styczna (1000)' : dn;
        tilesHtml =
            '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Brak elementów zakończenia dla DN ' +
            errorDn +
            '</div>';
    } else {
        // Domyślny kafel "Auto (Konus)"
        const isAutoActive = !currentZak;
        tilesHtml += `<div onclick="selectZakonczenie(null)" style="
            padding:0.6rem 0.8rem; border-radius:8px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isAutoActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isAutoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
            ${isAutoActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
        " onmouseenter="if(!${isAutoActive})this.style.borderColor='rgba(99,102,241,0.3)'"
           onmouseleave="if(!${isAutoActive})this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};"><i data-lucide="refresh-cw"></i> Auto (Konus)</div>
            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem;">Domyślny konus dla DN ${effectiveDn}</div>
        </div>`;

        candidates.forEach((p) => {
            const isActive = currentZak === p.id;
            const typeColor = typeColors[p.componentType] || 'rgba(255,255,255,0.05)';
            const typeLabel = typeLabels[p.componentType] || p.componentType;
            tilesHtml += `<div onclick="selectZakonczenie('${p.id}')" style="
                padding:0.6rem 0.8rem; border-radius:8px; cursor:pointer; transition:all 0.15s;
                border:2px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
                background:${isActive ? 'rgba(99,102,241,0.15)' : typeColor};
                ${isActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
            " onmouseenter="if(!${isActive})this.style.borderColor='rgba(99,102,241,0.3)'"
               onmouseleave="if(!${isActive})this.style.borderColor='rgba(255,255,255,0.08)'">
                <div class="ui-flex-between">
                    <div style="font-weight:700; font-size:0.82rem; color:${isActive ? '#a78bfa' : 'var(--text-primary)'};">${typeLabel}</div>
                    ${isActive ? '<span style="font-size:0.6rem; color:#a78bfa; font-weight:700;"><i data-lucide="check"></i> AKTYWNE</span>' : ''}
                </div>
                <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.15rem; font-weight:600;">${p.name}</div>
                <div style="display:flex; gap:0.8rem; margin-top:0.2rem; font-size:0.62rem; color:var(--text-muted);">
                    <span>ID: ${p.id}</span>
                    ${p.height ? '<span>H: ' + p.height + 'mm</span>' : ''}
                    <span style="color:var(--success);">${fmtInt(p.price)} PLN</span>
                </div>
            </div>`;
        });
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal" style="max-width:600px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
        <h3 style="font-size:1.1rem; font-weight:700; color:var(--text);"><span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zakończenie studni <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">(${well.name} — DN ${dn === 'styczna' ? 'styczna (1000)' : dn})</span></h3>
        <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz domyślny element zakończenia górnego dla tej studni. Wybrany element będzie używany przez Auto-dobór.</p>
      </div>
      <div style="flex:1; overflow-y:auto; padding:0.8rem 0; display:grid; grid-template-columns:1fr; gap:0.5rem;">
        ${tilesHtml}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border); padding-top:0.8rem;">
        <button class="btn btn-secondary" onclick="closeModal()">Zamknij</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
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

    const typeLabels = {
        konus: '<i data-lucide="diamond"></i> Konus',
        plyta_din:
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta DIN',
        plyta_najazdowa:
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta Odciążająca',
        plyta_zamykajaca:
            '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta Odciążająca',
        pierscien_odciazajacy: '<i data-lucide="settings"></i> Pierścień Odciążający'
    };
    const typeColors = {
        konus: 'rgba(124,58,237,0.15)',
        plyta_din: 'rgba(30,58,95,0.3)',
        plyta_najazdowa: 'rgba(30,58,95,0.3)',
        plyta_zamykajaca: 'rgba(30,58,95,0.3)',
        pierscien_odciazajacy: 'rgba(30,58,95,0.3)'
    };

    const currentZak = well.redukcjaZakonczenie;

    const renderTile = (p, overrideLabel = null) => {
        if (!p) return '';
        const isActive = currentZak === p.id;
        const typeColor = typeColors[p.componentType] || 'rgba(255,255,255,0.05)';
        const typeLabel = overrideLabel || typeLabels[p.componentType] || p.componentType;
        return `<div onclick="selectRedukcjaZakonczenie('${p.id}')" style="
            padding:0.6rem 0.8rem; border-radius:8px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isActive ? 'rgba(99,102,241,0.15)' : typeColor};
            ${isActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
            display:flex; flex-direction:column; justify-content:space-between;
        " onmouseenter="if(!${isActive})this.style.borderColor='rgba(99,102,241,0.3)'"
           onmouseleave="if(!${isActive})this.style.borderColor='rgba(255,255,255,0.08)'">
            <div class="ui-flex-between">
                <div style="font-weight:700; font-size:0.82rem; color:${isActive ? '#a78bfa' : 'var(--text-primary)'};">${typeLabel}</div>
                ${isActive ? '<span style="font-size:0.6rem; color:#a78bfa; font-weight:700;"><i data-lucide="check"></i> AKTYWNE</span>' : ''}
            </div>
            <div style="flex-grow:1;"></div>
            <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.3rem; font-weight:600;">${p.name}</div>
            <div style="display:flex; justify-content:space-between; margin-top:0.3rem; font-size:0.62rem; color:var(--text-muted);">
                ${p.height ? '<span>H: ' + p.height + 'mm</span>' : '<span></span>'}
                <span style="color:var(--success); font-weight:600;">${fmtInt(p.price)} PLN</span>
            </div>
        </div>`;
    };

    let tilesHtml = '';
    // Auto default tile spans 2 columns
    const isAutoActive = !currentZak;
    tilesHtml += `<div onclick="selectRedukcjaZakonczenie(null)" style="
        grid-column: 1 / -1;
        padding:0.6rem 0.8rem; border-radius:8px; cursor:pointer; transition:all 0.15s;
        border:2px solid ${isAutoActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
        background:${isAutoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
        ${isAutoActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
    " onmouseenter="if(!${isAutoActive})this.style.borderColor='rgba(99,102,241,0.3)'"
       onmouseleave="if(!${isAutoActive})this.style.borderColor='rgba(255,255,255,0.08)'">
        <div style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};"><i data-lucide="refresh-cw"></i> Auto (Zakończenie DN${targetDn})</div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem;">Automatyczny dobór zakończenia dla średnicy DN${targetDn}</div>
    </div>`;

    // Group items
    const konuses = candidates.filter((p) => p.componentType === 'konus');
    const dinPlates = candidates.filter((p) => p.componentType === 'plyta_din');
    const odcPlates = candidates.filter(
        (p) => p.componentType === 'plyta_najazdowa' || p.componentType === 'plyta_zamykajaca'
    );
    const rings = candidates.filter((p) => p.componentType === 'pierscien_odciazajacy');

    // Row 1: Konusy
    konuses.forEach((p) => (tilesHtml += renderTile(p)));
    // If odd number, add invisible empty div to keep grid aligned (unlikely needed with grid-auto-rows but safe)
    if (konuses.length % 2 !== 0) tilesHtml += '<div></div>';

    // Row 2: DIN plates
    dinPlates.forEach((p) => (tilesHtml += renderTile(p)));
    if (dinPlates.length % 2 !== 0) tilesHtml += '<div></div>';

    // Row 3: Płyty odciążające and Pierścienie
    // Usually there's a plate and a ring, let's put them together
    odcPlates.forEach((p) => (tilesHtml += renderTile(p)));
    rings.forEach((p) => (tilesHtml += renderTile(p)));

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal" style="max-width:600px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
        <h3 style="font-size:1.1rem; font-weight:700; color:var(--text);"><span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zakończenie redukcji DN${targetDn}</h3>
        <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz zakończenie górne dla sekcji redukcji DN${targetDn}. Wybór elementu odciążającego automatycznie doda pierścień.</p>
      </div>
      <div style="overflow-y:auto; padding:0.8rem; display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem;">
        ${tilesHtml}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border); padding-top:0.6rem; text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="closeModal()" style="font-size:0.8rem;">Zamknij</button>
      </div>
    </div>`;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
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

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText =
        'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease;';

    overlay.innerHTML = `
      <div style="background:var(--bg-secondary, #1e293b); border:1px solid rgba(249,115,22,0.3); border-radius:16px; padding:1.2rem 1.5rem; width:520px; max-width:92vw; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; position:sticky; top:0; background:var(--bg-secondary, #1e293b); padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:1rem; font-weight:800; color:#f97316;"><i data-lucide="cylinder"></i> Wybierz studnię styczną</div>
          <button class="btn-icon" onclick="closeModal()" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem;"><i data-lucide="x"></i></button>
        </div>
        ${renderSection('Studnie Styczne', '<i data-lucide="cylinder"></i>', standardProducts)}
        ${renderSection('Studnie Styczne z korkiem', '<i data-lucide="plug"></i>', korekProducts)}
      </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
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

    if (mode === 'add') {
        const well = createNewWell(null, 'styczna');
        well.stycznaVariant = variant;
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
        well.dn = 'styczna';
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

/* ===== GLOBAL RECALCULATOR ===== */
window.openGlobalRecalcModal = function () {
    if (!wells || wells.length === 0) {
        showToast('Brak studni w ofercie', 'error');
        return;
    }
    const uniqueDns = [...new Set(wells.map((w) => w.dn))].sort((a, b) => a - b);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'global-recalc-modal';

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
                        <label class="form-label" style="font-size:0.65rem;">Min. wys. komory roboczej (mm)</label>
                        <input type="number" id="recalc-red-minh-${dn}" class="form-input" value="2500" style="padding:0.3rem 0.5rem; width:120px;" />
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

    overlay.innerHTML = `
    <div class="modal" style="width:700px; max-width:95vw; background:#111827;">
      <div class="modal-header"><h3><i data-lucide="settings"></i> Automatycznie przelicz ofertę</h3><button class="btn-icon" onclick="window.closeGlobalRecalcModal()"><i data-lucide="x"></i></button></div>
      <div style="padding:1rem; max-height:65vh; overflow-y:auto; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.4) transparent;">
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;">Ustaw preferencje dla poszczególnych średnic. Program zaktualizuje ustawienia zakończeń i ponownie wygeneruje układ elementów dla <strong>wszystkich studni w ofercie</strong> według reguł automatycznych.</p>
        ${groupsHtml}
      </div>
      <div style="padding:1rem; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:0.5rem; background:rgba(0,0,0,0.2);">
        <button class="btn btn-secondary" onclick="window.closeGlobalRecalcModal()">Anuluj</button>
        <button class="btn btn-primary" onclick="window.applyGlobalRecalc()" style="background:var(--accent); color:#fff; font-weight:600;"><i data-lucide="refresh-cw"></i> Przelicz wszystkie</button>
      </div>
    </div>`;

    document.body.appendChild(overlay);
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
        console.error(e);
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

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Check if DN1200 is available for this DN
    const can1200 = [1500, 2000, 2500].includes(well.dn) || well.dn === 'styczna';
    const currentTarget = well.redukcjaTargetDN || 1000;
    const isActive = well.redukcjaDN1000;

    overlay.innerHTML = `
    <div class="modal" style="max-width:400px; width:90%; border-radius:12px; padding:1.5rem; background: var(--bg-secondary); border: 1px solid var(--border);">
      <h3 style="margin-top:0; margin-bottom:1rem; font-size:1.1rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
        <i data-lucide="chevrons-down" style="color:var(--accent);"></i> Wybierz rodzaj redukcji
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
    </div>`;
    
    document.body.appendChild(overlay);
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

