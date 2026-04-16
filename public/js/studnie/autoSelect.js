/* ===== ZAKOŃCZENIE (WYBÓR ZAMKNIĘCIA GÓRNEGO) ===== */
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
        plyta_din: '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta DIN',
        plyta_najazdowa: '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta Odciążająca',
        plyta_zamykajaca: '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta Odciążająca',
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

async function selectZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.zakonczenie = productId;
    closeModal();

    // Zapisz jako domyślne na poziomie oferty dla nowych studni
    offerDefaultZakonczenie = productId;

    // Aktualizuj etykietę przycisku, aby pokazać bieżący wybór
    updateZakonczenieButton();

    if (productId) {
        const p = studnieProducts.find((pr) => pr.id === productId);
        showToast(`Zakończenie: ${p ? p.name : productId}`, 'success');
    } else {
        showToast('Zakończenie: Auto (Konus)', 'success');
    }

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
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
        btn.innerHTML = '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> ' + shortName;
        btn.style.borderColor = 'rgba(99,102,241,0.4)';
        btn.style.color = '#a78bfa';
    } else {
        btn.innerHTML = '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zakończenie';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
    }
}

/* ===== REDUKCJA DN1000 ===== */
async function toggleRedukcja() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (![1200, 1500, 2000, 2500].includes(well.dn)) {
        showToast('Redukcja DN1000 dostępna tylko dla studni DN ≥ 1200', 'error');
        return;
    }

    well.redukcjaDN1000 = !well.redukcjaDN1000;
    offerDefaultRedukcja = well.redukcjaDN1000; // zapisz jako domyślne na poziomie oferty
    updateRedukcjaButton();

    if (well.redukcjaDN1000) {
        showToast('Redukcja DN1000 — WŁĄCZONA', 'success');
    } else {
        showToast('Redukcja DN1000 — WYŁĄCZONA', 'info');

        // Reset ewentualnego nadpisanego błędem "Zakoczenia" dla rury DN1000 i samej redukcji
        well.zakonczenie = null;
        offerDefaultZakonczenie = null;
        well.redukcjaZakonczenie = null;
        offerDefaultRedukcjaZak = null;
        updateZakonczenieButton();

        const btnZak = document.getElementById('btn-redukcja-zak');
        if (btnZak) {
            btnZak.innerHTML = '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zak. DN1000';
            btnZak.style.borderColor = 'var(--border-glass)';
            btnZak.style.color = '';
        }
    }

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

function updateRedukcjaButton() {
    const btn = document.getElementById('btn-redukcja');
    if (!btn) return;
    const well = getCurrentWell();

    // Ukryj przycisk dla studni DN1000 (redukcja niemożliwa)
    if (!well || ![1200, 1500, 2000, 2500].includes(well.dn)) {
        btn.style.display = 'none';
        if (typeof updatePsiaBudaButton === 'function') updatePsiaBudaButton();
        return;
    }
    btn.style.display = '';

    // Pokaż/ukryj pole minimalnej wysokości obok przycisku
    const minWrap = document.getElementById('redukcja-min-wrap');
    const minInput = document.getElementById('redukcja-min-h');

    if (well.redukcjaDN1000) {
        btn.innerHTML = '<span style="font-size:0.75rem;"><i data-lucide="chevrons-down"></i></span> Redukcja DN1000 <span style="font-size:0.75rem;"><i data-lucide="check"></i></span>';
        btn.style.borderColor = 'rgba(109,40,217,0.5)';
        btn.style.color = '#a78bfa';
        btn.style.background = 'rgba(109,40,217,0.15)';
        if (minWrap) minWrap.style.display = 'flex';
        if (minInput) minInput.value = ((well.redukcjaMinH || 2500) / 1000).toFixed(1);
    } else {
        btn.innerHTML = '<span style="font-size:0.75rem;"><i data-lucide="chevrons-down"></i></span> Redukcja DN1000';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
        btn.style.background = '';
        if (minWrap) minWrap.style.display = 'none';
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
}


/* ===== PSIA BUDA ===== */
async function togglePsiaBuda() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    well.psiaBuda = !well.psiaBuda;
    updatePsiaBudaButton();

    if (well.psiaBuda) {
        showToast('Tryb Psia buda — WŁĄCZONY', 'success');
        
        // Backup parametrów
        well._psiaBudaBackup = {
            kineta: well.kineta || 'beton',
            spocznik: well.spocznik || 'beton',
            spocznikH: well.spocznikH || '1/2'
        };

        // Automatyczne ustawienie na "brak"
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    } else {
        showToast('Tryb Psia buda — WYŁĄCZONY', 'info');
        
        // Przywracanie parametrów, jeśli backup istnieje
        if (well._psiaBudaBackup) {
            well.kineta = well._psiaBudaBackup.kineta;
            well.spocznik = well._psiaBudaBackup.spocznik;
            well.spocznikH = well._psiaBudaBackup.spocznikH;
            delete well._psiaBudaBackup;
        }
    }

    // Odśwież UI parametrów (wellManager.js)
    if (typeof renderWellParams === 'function') renderWellParams();

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

function updatePsiaBudaButton() {
    const btn = document.getElementById('btn-psia-buda');
    if (!btn) return;
    const well = getCurrentWell();

    if (well && well.psiaBuda) {
        btn.innerHTML = '<i data-lucide="dog" style="width:14px; height:14px; margin-right:4px;"></i> Psia buda <span style="font-size:0.75rem; margin-left:4px;"><i data-lucide="check"></i></span>';
        btn.style.borderColor = 'rgba(16,185,129,0.5)';
        btn.style.color = '#6ee7b7';
        btn.style.background = 'rgba(16,185,129,0.15)';
    } else {
        btn.innerHTML = '<i data-lucide="dog" style="width:14px; height:14px; margin-right:4px;"></i> Psia buda';
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
    const dn1000Candidates = availProducts
        .filter((p) => topClosureTypes.includes(p.componentType) && p.dn === 1000)
        .filter((p) => filterByWellParams(p, well));

    const typeLabels = {
        konus: '<i data-lucide="diamond"></i> Konus',
        plyta_din: '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta DIN',
        plyta_najazdowa: '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta Odciążająca',
        plyta_zamykajaca: '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyta Odciążająca',
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
        <div style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};"><i data-lucide="refresh-cw"></i> Auto (Konus DN1000)</div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem;">Domyślny konus DN1000</div>
    </div>`;

    // Group items
    const konuses = dn1000Candidates.filter((p) => p.componentType === 'konus');
    const dinPlates = dn1000Candidates.filter((p) => p.componentType === 'plyta_din');
    const odcPlates = dn1000Candidates.filter(
        (p) => p.componentType === 'plyta_najazdowa' || p.componentType === 'plyta_zamykajaca'
    );
    const rings = dn1000Candidates.filter((p) => p.componentType === 'pierscien_odciazajacy');

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
        <h3 style="font-size:1.1rem; font-weight:700; color:var(--text);"><span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zakończenie redukcji DN1000</h3>
        <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz zakończenie górne dla sekcji redukcji DN1000. Wybór elementu odciążającego automatycznie doda pierścień.</p>
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

async function selectRedukcjaZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.redukcjaZakonczenie = productId;
    offerDefaultRedukcjaZak = productId;
    closeModal();

    // Update button label
    const btn = document.getElementById('btn-redukcja-zak');
    if (btn) {
        if (productId) {
            const p = studnieProducts.find((pr) => pr.id === productId);
            btn.innerHTML =
                '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> ' +
                (p
                    ? p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)
                    : 'Zak. DN1000');
            btn.style.borderColor = 'rgba(99,102,241,0.5)';
            btn.style.color = '#a78bfa';
        } else {
            btn.innerHTML = '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zak. DN1000';
            btn.style.borderColor = 'var(--border-glass)';
            btn.style.color = '';
        }
    }

    if (productId) {
        const p = studnieProducts.find((pr) => pr.id === productId);
        showToast(`Zakończenie redukcji: ${p ? p.name : productId}`, 'success');
    } else {
        showToast('Zakończenie redukcji: Auto (Konus DN1000)', 'success');
    }
    
    if (window.lucide) {
        window.lucide.createIcons();
    }

    if (!well.autoLocked && well.redukcjaDN1000) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

/* ===== ELEVATIONS (RZĘDNE) ===== */
function updateElevations() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const wlazInput = document.getElementById('input-rzedna-wlazu');
    const dnaInput = document.getElementById('input-rzedna-dna');

    well.rzednaWlazu = wlazInput.value !== '' ? parseFloat(wlazInput.value) : null;
    well.rzednaDna = dnaInput.value !== '' ? parseFloat(dnaInput.value) : 0; // domyślnie 0

    updateHeightIndicator();
    renderWellsList();
    autoSelectComponents(true);
}

function updateDoplata() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const domEl = document.getElementById('input-doplata');
    const dVal = domEl.value !== '' ? parseFloat(domEl.value) : 0;
    well.doplata = dVal;

    // Apply color immediately
    if (dVal > 0) {
        domEl.style.color = '#10b981';
        domEl.style.fontWeight = '700';
    } else if (dVal < 0) {
        domEl.style.color = '#ef4444';
        domEl.style.fontWeight = '700';
    } else {
        domEl.style.color = '#a78bfa';
        domEl.style.fontWeight = 'normal';
    }

    renderWellsList();
    updateSummary();
    renderOfferSummary();
}

function updateWellNumer() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    const numerInput = document.getElementById('input-well-numer');
    if (!numerInput) return;

    const newNumer = numerInput.value.trim();
    checkWellNumerDuplicate(newNumer, numerInput);

    well.numer = newNumer;
    well.name = well.numer || 'Studnia DN' + well.dn + ' (#' + (currentWellIndex + 1) + ')';
    renderWellsList();
    updateSummary();
}

function checkWellNumerDuplicate(newNumer, inputEl) {
    if (!inputEl) return false;
    if (newNumer !== '') {
        const isDuplicate = wells.some(
            (w, idx) =>
                idx !== currentWellIndex &&
                w.numer &&
                w.numer.toLowerCase() === newNumer.toLowerCase()
        );
        if (isDuplicate) {
            inputEl.style.borderColor = '#ef4444';
            inputEl.style.color = '#ef4444';
            inputEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.2)';
            showToast(
                `<i data-lucide="alert-triangle"></i> Numer studni "${newNumer}" już istnieje! Zmień numer, aby uniknąć duplikatów.`,
                'error'
            );
            return true; // is duplicate
        }
    }
    // reset styling
    inputEl.style.borderColor = 'var(--border-glass)';
    inputEl.style.color = '#a78bfa';
    inputEl.style.boxShadow = 'none';
    return false;
}

function syncElevationInputs() {
    const well = getCurrentWell();
    const wlazInput = document.getElementById('input-rzedna-wlazu');
    const dnaInput = document.getElementById('input-rzedna-dna');
    const numerInput = document.getElementById('input-well-numer');
    const doplataInput = document.getElementById('input-doplata');
    if (!well) {
        if (wlazInput) wlazInput.value = '';
        if (dnaInput) dnaInput.value = '';
        if (doplataInput) doplataInput.value = '';
        if (numerInput) {
            numerInput.value = '';
            checkWellNumerDuplicate('', numerInput);
        }
        updateHeightIndicator();
        return;
    }
    if (wlazInput) wlazInput.value = well.rzednaWlazu != null ? well.rzednaWlazu : '';
    if (dnaInput) dnaInput.value = well.rzednaDna != null ? well.rzednaDna : '';
    if (doplataInput) {
        const dVal = well.doplata != null ? well.doplata : 0;
        doplataInput.value = dVal;

        // Positive -> Green, Negative -> Red, Zero -> Default
        if (dVal > 0) {
            doplataInput.style.color = '#10b981';
            doplataInput.style.fontWeight = '700';
        } else if (dVal < 0) {
            doplataInput.style.color = '#ef4444';
            doplataInput.style.fontWeight = '700';
        } else {
            doplataInput.style.color = '#a78bfa';
            doplataInput.style.fontWeight = 'normal';
        }
    }
    if (numerInput) {
        numerInput.value = well.numer || '';
        checkWellNumerDuplicate(numerInput.value.trim(), numerInput);
    }
    updateHeightIndicator();
}

function updateHeightIndicator() {
    const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
    const reqEl = document.getElementById('well-required-height');
    const confEl = document.getElementById('well-configured-height');
    const diffEl = document.getElementById('height-diff-indicator');
    const errContainer = document.getElementById('well-config-errors-container');

    if (!reqEl || !confEl || !diffEl) return;
    if (!well) {
        confEl.innerHTML = '0 m';
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
        if (errContainer) errContainer.style.display = 'none';
        return;
    }

    recalculateWellErrors(well);
    let liveErrors = well.configErrors || [];

    if (errContainer) {
        if (liveErrors.length > 0) {
            errContainer.innerHTML =
                '<i data-lucide="alert-triangle"></i> Błędy w konfiguracji studni:<br>' +
                liveErrors.map((e) => `• ${e}`).join('<br>');
            errContainer.style.display = 'block';
            if (window.lucide) {
                window.lucide.createIcons();
            }
        } else {
            errContainer.style.display = 'none';
        }
    }

    const prevErrors = well.configErrors ? well.configErrors.length : 0;
    if (prevErrors !== liveErrors.length) renderWellsList();

    const stats = calcWellStats(well);
    const confM = (stats.height / 1000).toFixed(3).replace('.', ',');
    confEl.textContent = confM + ' m';

    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

    if (well.rzednaWlazu != null && well.rzednaWlazu > rzDna) {
        const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
        const reqM = (requiredMm / 1000).toFixed(3).replace('.', ',');
        reqEl.textContent = reqM + ' m';

        const diff = stats.height - requiredMm;
        if (Math.abs(diff) <= 50) {
            diffEl.innerHTML = '<span style="color:#10b981;"><i data-lucide="check-circle-2"></i> Wysokość OK</span>';
        } else if (diff > 0) {
            const diffM = (diff / 1000).toFixed(3).replace('.', ',');
            diffEl.innerHTML = `<span style="color:#f59e0b;"><i data-lucide="alert-triangle"></i> +${diffM} m za dużo</span>`;
        } else {
            const diffM = (Math.abs(diff) / 1000).toFixed(3).replace('.', ',');
            diffEl.innerHTML = `<span style="color:#f87171;"><i data-lucide="alert-triangle"></i> Brakuje ${diffM} m</span>`;
        }
    } else {
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
    }
}

/* ===== POMOCNICY MAGAZYNU I WARIANTÓW ===== */

/**
 * Filtruje produkty wg magazynu studni i priorytetyzuje formy standardowe.
 * well.magazyn = 'Kluczbork' → magazynKLB === 1
 * well.magazyn = 'Włocławek' → magazynWL === 1
 */
function getAvailableProducts(well) {
    const mag = well.magazyn || 'Kluczbork';
    const isWl = mag.includes('oc') || mag.includes('Włoc');
    const magField = isWl ? 'magazynWL' : 'magazynKLB';
    const formaField = isWl ? 'formaStandardowa' : 'formaStandardowaKLB';
    return studnieProducts
        .filter((p) => p[magField] === 1)
        .sort((a, b) => {
            // 1. Priorytet dla formy standardowej (malejąco: 1 -> 0)
            const fA = b[formaField] || 0;
            const fB = a[formaField] || 0;
            if (fA !== fB) return fA - fB;

            // 2. Sortowanie wg wysokości (rosnąco: 250, 500, 750, 1000)
            const hA = parseFloat(a.height) || 0;
            const hB = parseFloat(b.height) || 0;
            return hA - hB;
        });
}

/**
 * Z listy kręgów (tego samego DN) wybiera najlepszy wariant per wysokość
 * wg parametrów studni (nadbudowa, stopnie).
 * Zwraca listę z max 1 produktem per unikalna wysokość.
 */
function selectRingVariants(kregiList, well) {
    const isZelbet = well.nadbudowa === 'zelbetowa';
    const stopnie = well.stopnie || 'drabinka';
    let suffix;
    if (stopnie === 'nierdzewna') suffix = '-N';
    else if (stopnie === 'brak') suffix = '-B';
    else suffix = '-D'; // drabinka

    // Grupuj według wysokości
    const byHeight = {};
    kregiList.forEach((k) => {
        const h = k.height;
        if (!byHeight[h]) byHeight[h] = [];
        byHeight[h].push(k);
    });

    const result = [];
    Object.keys(byHeight)
        .sort((a, b) => Number(b) - Number(a))
        .forEach((h) => {
            const candidates = byHeight[h];
            // Oceń każdego kandydata
            let best = null,
                bestScore = -Infinity;
            for (const c of candidates) {
                let score = 0;
                const id = (c.id || '').toUpperCase();
                // Dopasowanie materiału
                if (isZelbet && id.startsWith('KDZ')) score += 10;
                else if (!isZelbet && id.startsWith('KDB')) score += 10;
                // Dopasowanie przyrostka
                if (id.includes(suffix)) score += 5;
                // Forma standardowa
                const mag = well.magazyn || 'Kluczbork';
                const ff = mag === 'Włocławek' ? 'formaStandardowa' : 'formaStandardowaKLB';
                if (c[ff] === 1) score += 3000;
                if (score > bestScore) {
                    bestScore = score;
                    best = c;
                }
            }
            if (best) result.push(best);
        });
    return result.sort((a, b) => b.height - a.height);
}

/**
 * Po zbudowaniu segmentów, sprawdza czy przejście (otwór) jest WEWNĄTRZ kręgu
 * i zamienia zwykły krag na krag_ot (wiercony) w odpowiednim segmencie.
 *
 * ZASADY:
 * 1. Otwór OT tylko gdy przejście faktycznie jest WEWNĄTRZ tego kręgu (cały otwór mieści się w segmencie)
 * 2. Zamiana na OT musi zachować tę samą wysokość kręgu (nie zmienia totalnej wysokości)
 * 3. Jeśli otwór wychodzi na łączenie dennicy i kręgu → zwraca flagę needsTallerDennica
 *
 * Zwraca { items: kregItems[], needsTallerDennica: boolean }
 */
function applyDrilledRings(kregItems, segments, well, availProducts) {
    const result = { items: kregItems, needsTallerDennica: false };
    if (!well.przejscia || well.przejscia.length === 0) return result;
    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
    const newItems = JSON.parse(JSON.stringify(kregItems));
    const usedSegIndices = new Set();

    for (const pr of well.przejscia) {
        let pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const mmFromBottom = (pel - rzDna) * 1000;
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
        if (!pprod) continue;

        // Przebuduj wysokość krawędzi dennic z uwzględnieniem redukcji dennic piętrowych
        let currentDennicaEnd = 0;
        let cy = 0;
        let lastWasD = !!well.psiaBuda;
        const configReversed = [...newItems].reverse();
        for (const item of configReversed) {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) continue;
            let h = p.height || 0;
            if (p.componentType === 'dennica' && lastWasD) h -= 100;
            if (p.componentType === 'dennica') currentDennicaEnd = cy + h;
            cy += h;
            lastWasD = (p.componentType === 'dennica');
        }

        let prDN =
            typeof pprod.dn === 'string' && pprod.dn.includes('/')
                ? parseFloat(pprod.dn.split('/')[1]) || 160
                : parseFloat(pprod.dn) || 160;

        const holeCenter = mmFromBottom + prDN / 2;

        // Sprawdź, czy otwór przesuwa się przez połączenie dennicy i kręgu (fizyczne nakładanie się rur)
        if (currentDennicaEnd > 0 && mmFromBottom < currentDennicaEnd && mmFromBottom + prDN > currentDennicaEnd) {
            // Otwór przecina górną krawędź dennicy → potrzebna wyższa dennica
            result.needsTallerDennica = true;
        }

        // Sprawdź, czy środek otworu znajduje się w całości wewnątrz dennicy — OT nie jest potrzebne
        if (currentDennicaEnd > 0 && holeCenter < currentDennicaEnd) continue;

        // Znajdź, który segment kręgu zawiera środek otworu
        for (let si = 1; si < segments.length; si++) {
            const seg = segments[si];
            if (seg.type !== 'krag' && seg.type !== 'krag_ot') continue;
            // Sprawdź, czy środek otworu znajduje się wewnątrz tego segmentu
            if (holeCenter >= seg.start && holeCenter < seg.end && !usedSegIndices.has(si)) {
                usedSegIndices.add(si);

                // Znajdź odpowiedni kregItem
                let segCount = 0;
                for (let ki = 0; ki < newItems.length; ki++) {
                    const kp = studnieProducts.find((p) => p.id === newItems[ki].productId);
                    if (!kp || (kp.componentType !== 'krag' && kp.componentType !== 'krag_ot'))
                        continue;
                    for (let q = 0; q < newItems[ki].quantity; q++) {
                        segCount++;
                        if (segCount === si) {
                            const otProd = availProducts.find((p) => {
                                const isOt =
                                    p.componentType === 'krag_ot' ||
                                    (p.id && String(p.id).toLowerCase().endsWith('ot')) ||
                                    (p.name && String(p.name).toLowerCase().includes('wiercony')) ||
                                    (p.name && String(p.name).toLowerCase().includes('z otworem'));
                                return (
                                    isOt &&
                                    p.dn === kp.dn &&
                                    p.height === kp.height &&
                                    (p.componentType === 'krag' || p.componentType === 'krag_ot')
                                );
                            });
                            if (otProd) {
                                if (newItems[ki].quantity === 1) {
                                    newItems[ki].productId = otProd.id;
                                } else {
                                    newItems[ki].quantity--;
                                    newItems.splice(ki + 1, 0, {
                                        productId: otProd.id,
                                        quantity: 1
                                    });
                                }
                            } else {
                                const dynamicOtId = kp.id + '_OT';
                                if (!studnieProducts.find((p) => p.id === dynamicOtId)) {
                                    const dynamicProd = JSON.parse(JSON.stringify(kp));
                                    dynamicProd.id = dynamicOtId;
                                    dynamicProd.componentType = 'krag_ot';
                                    if (!dynamicProd.name.includes(' wiercony')) {
                                        dynamicProd.name = dynamicProd.name.replace(
                                            'Krąg',
                                            'Krąg wiercony'
                                        );
                                    }
                                    studnieProducts.push(dynamicProd);
                                }

                                if (newItems[ki].quantity === 1) {
                                    newItems[ki].productId = dynamicOtId;
                                } else {
                                    newItems[ki].quantity--;
                                    newItems.splice(ki + 1, 0, {
                                        productId: dynamicOtId,
                                        quantity: 1
                                    });
                                }
                            }
                            break;
                        }
                    }
                    if (segCount >= si) break;
                }
                break;
            }
        }
    }
    result.items = newItems;
    return result;
}

/* ===== AUTO-DOBÓR ELEMENTÓW ===== */
/*
 * ZASADY DOBORU ELEMENTÓW:
 * 1. Zakończenie studni (góra) — TYLKO jedno z trzech:
 *    a) Płyta (PZE — płyta zamykająca)
 *    b) Konus (stożek z PDD — płytą DIN na górze)
 *    c) Płyta z pierścieniem odciążającym (PZE + PO)
 * 2. Regulacja: pierścienie AVR — max 300mm (30 cm) łącznie
 * 3. Tolerancja: do -50mm poniżej wymaganej wysokości
 * 4. NIE przekraczać wysokości; jeśli brak wyjścia — max +20mm
 * 5. Preferuj najniższą dennicę
 * 6. Uwzględniaj zapasy przejść szczelnych
 * 7. Obsługuj redukcję DN → DN1000 (DN1200, DN1500, DN2000, DN2500)
 */
/* ===== ZAPYTANIE DO NOWEGO BACKENDU (OFFLINE-FIRST) ===== */
async function fetchConfigFromBackend(well, requiredMm, availProducts) {
    try {
        const payload = {
            dn: well.dn,
            target_height_mm: requiredMm,
            use_reduction: well.redukcjaDN1000 || false,
            redukcja_min_h_mm: well.redukcjaMinH || 0,
            warehouse: well.magazyn === 'Włocławek' ? 'WL' : 'KLB',
            transitions: (well.przejscia || []).map((p, idx) => {
                let prDN = 160;
                let prod = availProducts.find((x) => x.id === p.productId);
                if (prod && typeof prod.dn === 'string' && prod.dn.includes('/'))
                    prDN = parseFloat(prod.dn.split('/')[1]) || 160;
                else if (prod && prod.dn != null) prDN = parseFloat(prod.dn) || 160;
                let bottomEdge = Math.round(
                    (parseFloat(p.rzednaWlaczenia) - (well.rzednaDna || 0)) * 1000
                );
                let center = isNaN(bottomEdge) ? 0 : bottomEdge + prDN / 2;
                return {
                    id: p.productId || `T${idx + 1}`,
                    height_from_bottom_mm: isNaN(bottomEdge) ? 0 : bottomEdge
                };
            }),
            forced_top_closure_id: well.redukcjaDN1000
                ? well.redukcjaZakonczenie || null
                : well.zakonczenie || null,
            available_products: availProducts.map((p) => ({
                id: p.id || '',
                name: p.name || '',
                componentType: p.componentType || '',
                dn:
                    typeof p.dn === 'string' && p.dn.includes('/')
                        ? parseFloat(p.dn.split('/')[0]) || p.dn
                        : parseFloat(p.dn) || null,
                height: parseFloat(p.height) || 0,
                formaStandardowaKLB: parseInt(p.formaStandardowaKLB) || 0,
                formaStandardowaWL:
                    parseInt(p.formaStandardowa) || parseInt(p.formaStandardowaWL) || 0,
                zapasDol: parseFloat(p.zapasDol) || 0,
                zapasGora: parseFloat(p.zapasGora) || 0,
                zapasDolMin: parseFloat(p.zapasDolMin) || 0,
                zapasGoraMin: parseFloat(p.zapasGoraMin) || 0
            }))
        };
        const apiUrl = `http://${window.location.hostname}:8000/api/v1/configure`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.length > 0 ? data[0] : null;
    } catch {
        return null; // Fallback do lokalnego kodu gdy serwer nie działa
    }
}

async function autoSelectComponents(autoTriggered = false) {
    const well = getCurrentWell();
    if (!well) {
        if (!autoTriggered) showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (well.autoLocked) {
        if (!autoTriggered) showToast('Auto-dobór jest zablokowany w Trybie Ręcznym.', 'error');
        return;
    }

    const dn = well.dn;

    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

    if (well.rzednaWlazu == null || well.rzednaWlazu <= rzDna) {
        if (!autoTriggered)
            showToast(
                'Ustaw rzędną włazu, aby auto-dobrać elementy (Rzędna Dna przyjęta jako 0)',
                'error'
            );
        return;
    }

    const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
    if (requiredMm < 500) {
        if (!autoTriggered) showToast('Wymagana wysokość za mała (min. 500mm)', 'error');
        return;
    }

    // --- Filtruj produkty wg dostępności w magazynie i parametrów studni ---
    const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));

    // --- INTEGRACJA Z NOWYM BACKENDEM ---
    console.log('Próba integracji z backendem OR-Tools...');
    const backendResult = await fetchConfigFromBackend(well, requiredMm, availProducts);
    if (backendResult && backendResult.is_valid && backendResult.items.length > 0) {
        console.log('Otrzymano pomyślny model z API:', backendResult);
        // Zastąp format backendowego na UI config format ('productId' jako główny klucz)
        // Backend grupuje każdą płytę osobno: { product_id, quantity ... }
        // Więc można albo skondensować duplikaty, albo po prostu wpisać 1 sztukowa połączone kręgi (tak samo zadziała)
        const newConfig = [];
        // Backend zwraca elementy od dołu do góry (Dennica -> Kręgi -> Konus).
        // Nasze UI JS renderuje od góry do dołu, a sortWellConfigByOrder utrzymuje względną kolejność grupowania.
        // Odwrócenie tego tutaj zapewnia, że kręgi zachowają poprawną kolejność fizyczną od góry do dołu.
        const reversedItems = [...backendResult.items].reverse();

        for (const bItem of reversedItems) {
            if (
                !studnieProducts.find((p) => p.id === bItem.product_id) &&
                bItem.product_id.endsWith('_OT')
            ) {
                const baseId = bItem.product_id.replace('_OT', '');
                const baseProd = studnieProducts.find((p) => p.id === baseId);
                if (baseProd) {
                    const dynamicProd = JSON.parse(JSON.stringify(baseProd));
                    dynamicProd.id = bItem.product_id;
                    dynamicProd.name = bItem.name;
                    dynamicProd.componentType = bItem.component_type || 'krag_ot';
                    studnieProducts.push(dynamicProd);
                }
            }

            const qty = bItem.quantity || 1;
            for (let i = 0; i < qty; i++) {
                newConfig.push({ productId: bItem.product_id, quantity: 1 });
            }
        }

        // Upewnij się, że studnia ma właz (Wlaz) - backend może nie zawsze go zwracać, jeśli nie ma ograniczeń
        const hasWlaz = newConfig.some(
            (item) => studnieProducts.find((p) => p.id === item.productId)?.componentType === 'wlaz'
        );
        if (!hasWlaz) {
            const defaultWlaz = studnieProducts.find((p) => p.id === 'WLAZ-150');
            if (defaultWlaz) newConfig.unshift({ productId: defaultWlaz.id, quantity: 1 });
        }

        well.config = newConfig;

        // --- Zapis na potrzeby Telemetrii (Pętla Sprzężenia) ---
        well.originalAutoConfig = JSON.parse(JSON.stringify(newConfig));
        well.overrideReason = null; // reset uzasadnienia przy nowym autodoborze

        if (backendResult.errors && backendResult.errors.length > 0) {
            backendResult.errors.forEach((e) => showToast(e, 'error'));
        } else if (!autoTriggered) {
            showToast('Zoptymalizowano matematycznie (serwer OR-Tools) pomyślnie!', 'success');
        }

        well.configSource = 'AUTO_AI';

        if (backendResult.has_minimal_clearance) {
            showToast('Zastosowano minimalne zapasy przejść rur.', 'warning');
        }

        sortWellConfigByOrder();
        renderWellConfig();
        renderWellDiagram();
        updateSummary();
        return;
    }

    // Jeżeli API odpowiedziało, ale uznało że budowa z żądanymi restrykcjami (np max +20mm) jest NIEMOŻLIWA:
    if (backendResult && !backendResult.is_valid) {
        console.warn('Backend OR-Tools odrzucił układ bez ułożenia:', backendResult.errors);

        const apiErrors =
            backendResult.errors && backendResult.errors.length > 0
                ? backendResult.errors
                : [
                      'Algorytm AI nie odnalazł ułożenia spełniającego wymogi rygorów wysokości lub kolizji.'
                  ];

        if (!autoTriggered) {
            apiErrors.forEach((e) => showToast(e, 'error'));
        }

        well.configSource = 'AUTO_AI';
        well.configStatus = 'ERROR';
        well.configErrors = apiErrors;
        well.config = [];

        refreshAll();
        return; // Zakończ odpytywanie - wymuszamy AI i BLOKUJEMY przepinanie na słabszy kod JS!
    }

    // FALLBACK tylko wtedy, gdy API nie ma w ogóle łączności (wyłączony port 8000, brak serwera Pyt):
    console.warn(
        'Backend niedostępny lub środowisko Python nie działa. Spadek do lokalnego kodu awaryjnego JS.'
    );
    const result = runJsAutoSelection(well, requiredMm, availProducts);
    if (result.error) {
        if (!autoTriggered) showToast(result.error, 'error');
        well.configStatus = 'ERROR';
        well.configErrors = [result.error];
        refreshAll();
        return;
    }
    well.config = result.config;

    const errors = result.errors || [];
    if (result.fallback)
        errors.push(
            result.fallbackReason
                ? `Zastosowana rozszerzona tolerancja - ${result.fallbackReason}`
                : 'Zastosowana rozszerzona tolerancja'
        );
    if (errors.length > 0 && result.isMinimal) {
        well.configStatus = 'WARNING';
    } else if (errors.length > 0) {
        well.configStatus = 'WARNING';
    } else {
        well.configStatus = 'OK';
    }
    well.configErrors = errors;
    well.configSource = 'AUTO_JS';

    refreshAll();
    const diffStr = result.diff >= 0 ? `+${result.diff}mm` : `${result.diff}mm`;
    const redLabel = result.reductionUsed ? ' + Redukcja DN1000' : '';
    const fallbackLabel = result.fallback ? ' <i data-lucide="alert-triangle"></i> (rozszerzona tolerancja)' : '';
    let statusIcon = '<i data-lucide="check-circle-2"></i>';
    if (well.configStatus === 'WARNING') statusIcon = '<i data-lucide="alert-triangle"></i>';
    if (well.configStatus === 'ERROR') statusIcon = '<i data-lucide="alert-circle"></i>';
    if (!autoTriggered) {
        showToast(
            `${statusIcon} Auto-dobór: ${fmtInt(result.totalHeight)} mm (${diffStr}) | ${result.topLabel}${redLabel}${fallbackLabel}`,
            well.configStatus === 'OK' ? 'success' : 'warning'
        );
    }
}

function runJsAutoSelection(well, requiredMm, availProducts) {
    const dn = well.dn;
    const effectiveDn = dn === 'styczna' ? 1000 : dn;
    const mag = well.magazyn || 'Kluczbork';
    const ff = mag === 'Włocławek' ? 'formaStandardowa' : 'formaStandardowaKLB';

    // --- Filtrowanie produktów wg parametrów studni ---
    const dnProducts = availProducts.filter((p) => parseInt(p.dn) === parseInt(effectiveDn));
    const allProducts = availProducts;

    // =============================================================
    // KROK 1: Dennica (port z Logika/rules.py → get_lowest_dennica)
    // =============================================================
    const dennica = getLowestDennica(
        availProducts.filter((p) => filterByWellParams(p, well)),
        dn,
        mag
    );
    if (!dennica) return { error: 'Brak dennic w magazynie.' };

    // =============================================================
    // KROK 2: Zakończenie (port z Logika/rules.py → get_top_closure)
    // =============================================================
    const forcedZak = well.zakonczenie || null;
    let topProd = getTopClosure(
        availProducts.filter((p) => filterByWellParams(p, well)),
        effectiveDn,
        forcedZak,
        false, // fallbackToDin — będzie ustawiony jeśli kolizja
        mag
    );

    // Rozszerzenie: obsługa płyty zamykającej/odciążającej + pierścień
    if (!topProd && forcedZak) {
        topProd = studnieProducts.find(
            (p) => p.id === forcedZak && (parseInt(p.dn) === dn || p.dn === null)
        );
    }
    if (!topProd) return { error: 'Nie znaleziono domyślnego zakończenia studni.' };

    // --- Build top closure configs (zachowaj rozszerzenie: konus/DIN/płyta+pierścień) ---
    const topConfigs = [];
    const buildTopConfig = (topP) => {
        let items = [];
        let h = 0;
        let lbl = '';
        if (
            ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(
                topP.componentType
            )
        ) {
            const sameDn = studnieProducts.filter((p) => parseInt(p.dn) === parseInt(topP.dn));
            const ring = sameDn.find((p) => p.componentType === 'pierscien_odciazajacy');
            const plate =
                topP.componentType === 'pierscien_odciazajacy'
                    ? sameDn.find(
                          (p) =>
                              p.componentType === 'plyta_zamykajaca' ||
                              p.componentType === 'plyta_najazdowa'
                      )
                    : topP;
            if (ring && plate) {
                items.push(
                    { productId: plate.id, quantity: 1 },
                    { productId: ring.id, quantity: 1 }
                );
                h += plate.height + ring.height;
                lbl = plate.name + ' + Pierścień';
            } else {
                items.push({ productId: topP.id, quantity: 1 });
                h += topP.height;
                lbl = topP.name;
            }
        } else {
            items.push({ productId: topP.id, quantity: 1 });
            h += topP.height;
            lbl = topP.name;
        }

        // Wlaz
        let wlazItem = well.config.find(
            (c) => studnieProducts.find((p) => p.id === c.productId)?.componentType === 'wlaz'
        );
        if (!wlazItem) {
            const wlaz150 = studnieProducts.find((p) => p.id === 'WLAZ-150');
            if (wlaz150) wlazItem = { productId: wlaz150.id, quantity: 1 };
        }
        if (wlazItem) {
            const wlazProd = studnieProducts.find((p) => p.id === wlazItem.productId);
            if (wlazProd) {
                items.unshift(wlazItem);
                h += wlazProd.height * wlazItem.quantity;
                lbl = wlazProd.name + ' + ' + lbl;
            }
        }
        return { items, height: h, label: lbl, prod: topP };
    };

    topConfigs.push(buildTopConfig(topProd));

    // Fallback DIN (port z Logika/rules.py: fallback_to_din)
    const isRelief = ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(
        topProd.componentType
    );
    if (isRelief || topProd.componentType === 'konus') {
        const dinProd = getTopClosure(
            availProducts.filter((p) => filterByWellParams(p, well)),
            dn,
            null,
            true, // fallbackToDin = true
            mag
        );
        if (dinProd && dinProd.id !== topProd.id) {
            const fbCfg = buildTopConfig(dinProd);
            fbCfg.label += ' (zamiennik)';
            topConfigs.push(fbCfg);
        }
    }

    // =============================================================
    // KROK 3: Przejścia — oblicz minimalne wymagania
    // =============================================================
    let holes = (well.przejscia || []).map((p) => {
        let pel = parseFloat(p.rzednaWlaczenia);
        let prDN = 160;
        let prod = availProducts.find((x) => x.id === p.productId);
        if (prod && typeof prod.dn === 'string' && prod.dn.includes('/'))
            prDN = parseFloat(prod.dn.split('/')[1]) || 160;
        else if (prod && prod.dn != null) prDN = parseFloat(prod.dn) || 160;

        let bottomEdge = isNaN(pel) ? 0 : Math.round((pel - (well.rzednaDna || 0)) * 1000);
        let center = bottomEdge + prDN / 2;

        const parseHoleClearance = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            const p = parseFloat(val);
            return isNaN(p) ? 0 : p;
        };

        return {
            z: center - prDN / 2,
            ruraDz: prDN,
            zdD: prod ? parseHoleClearance(prod.zapasDol) : 0,
            zdDM: prod ? parseHoleClearance(prod.zapasDolMin) : 0,
            zdG: prod ? parseHoleClearance(prod.zapasGora) : 0,
            zdGM: prod ? parseHoleClearance(prod.zapasGoraMin) : 0
        };
    });

    let maxReqH = 0;
    let maxReqHMin = 0;
    holes.forEach((h) => {
        const reqH = h.z + h.ruraDz + h.zdG;
        if (reqH > maxReqH) maxReqH = reqH;
        const reqHMin = h.z + h.ruraDz + h.zdGM;
        if (reqHMin > maxReqHMin) maxReqHMin = reqHMin;
    });

    // =============================================================
    // KROK 4: Listy kręgów i redukcja (port z Logika/rules.py)
    // =============================================================
    const dennicy = availProducts
        .filter((p) => {
            if (dn === 'styczna') {
                return (
                    (p.componentType === 'styczna' || p.category === 'Studnie styczne') &&
                    filterByWellParams(p, well)
                );
            }
            return (
                p.componentType === 'dennica' &&
                parseInt(p.dn) === dn &&
                filterByWellParams(p, well)
            );
        })
        .sort((a, b) => {
            const aForm = a[ff] === 1 ? 1 : 0;
            const bForm = b[ff] === 1 ? 1 : 0;
            if (aForm !== bForm) return bForm - aForm;
            return a.height - b.height;
        });
    if (dennicy.length === 0) return { error: 'Brak dennic w magazynie.' };

    const avrRings = allProducts
        .filter((p) => p.componentType === 'avr')
        .sort((a, b) => b.height - a.height);

    const isDrilledRing = (p) =>
        p.componentType === 'krag_ot' ||
        (p.id && String(p.id).toLowerCase().endsWith('ot')) ||
        (p.name && String(p.name).toLowerCase().includes('z otworem'));

    // Kręgi z ruleEngine — posortowane wg formy standardowej
    const kregiFromEngine = getKregiList(
        availProducts.filter(
            (p) => filterByWellParams(p, well) && p.componentType === 'krag' && !isDrilledRing(p)
        ),
        dn,
        mag
    );
    // Fallback do surowej listy jeśli engine nie znalazł standardowych
    const kregi =
        kregiFromEngine.length > 0
            ? kregiFromEngine
            : availProducts
                  .filter(
                      (p) =>
                          p.componentType === 'krag' && parseInt(p.dn) === dn && !isDrilledRing(p)
                  )
                  .sort((a, b) => b.height - a.height);

    const dn1000Products = availProducts.filter((p) => parseInt(p.dn) === 1000);
    const dn1000KregiEngine = getKregiList(
        availProducts.filter(
            (p) => filterByWellParams(p, well) && p.componentType === 'krag' && !isDrilledRing(p)
        ),
        1000,
        mag
    );
    const dn1000Kregi =
        dn1000KregiEngine.length > 0
            ? dn1000KregiEngine
            : dn1000Products
                  .filter((p) => p.componentType === 'krag' && !isDrilledRing(p))
                  .sort((a, b) => b.height - a.height);

    // Płyta redukcyjna (port z Logika/rules.py → get_reduction_plate)
    let reductionPlate = getReductionPlate(availProducts, dn, well.redukcjaDN1000);
    if (!reductionPlate)
        reductionPlate = studnieProducts.find(
            (p) => p.componentType === 'plyta_redukcyjna' && parseInt(p.dn) === dn
        );
    let canReduce = well.redukcjaDN1000 && [1200, 1500, 2000, 2500].includes(dn) && reductionPlate;

    // =============================================================
    // KROK 5: DP Ring Optimizer (port z Logika/cp_optimizer.py)
    // =============================================================
    function fillKregiDP(target, kList, tolBelow, tolAbove) {
        if (target <= 0) return { kItems: [], filled: 0 };

        const dpResult = optimizeRingsForDistance(target, kList, tolBelow, tolAbove);
        if (dpResult.success && dpResult.selectedRings.length > 0) {
            const kItems = dpResult.selectedRings.map((ring) => ({
                productId: ring.id,
                quantity: 1,
                _h: parseFloat(ring.height)
            }));
            const filled = kItems.reduce((sum, k) => sum + k._h, 0);
            return { kItems, filled };
        }

        // Fallback do greedy jeśli DP nie znalazł
        return fillKregiGreedy(target, kList);
    }

    // Zachowany greedy jako fallback
    function fillKregiGreedy(target, kList) {
        let kItems = [];
        let filled = 0;
        if (target > 0) {
            let left = target;
            for (const k of kList) {
                if (left <= 0) break;
                const qty = Math.floor(left / k.height);
                for (let i = 0; i < qty; i++) {
                    kItems.push({ productId: k.id, quantity: 1, _h: k.height });
                    filled += k.height;
                    left -= k.height;
                }
            }
        }
        return { kItems, filled };
    }

    // =============================================================
    // KROK 6: Walidacja przejść (port z Logika/generator.py linia 85)
    // =============================================================
    function checkConflicts(kItems, denH, reduceH, topItems) {
        let segs = [];
        let y = 0;
        segs.push({ type: 'dennica', h: denH, start: 0, end: denH });
        y += denH;

        let lastWasDennica = !!well.psiaBuda; // Pierwszy element to dół (dennica) - w trybie Psia buda traktujemy go jak piętrową

        for (let k of kItems) {
            let actualH = k._h;
            const kp = studnieProducts.find(p => p.id === k.productId);
            if (kp && kp.componentType === 'dennica' && lastWasDennica) {
                actualH -= 100;
            }

            if (k.productId === reductionPlate?.id) {
                segs.push({ type: 'plyta_redukcyjna', h: actualH, start: y, end: y + actualH });
                y += actualH;
            } else {
                segs.push({ type: 'krag', h: actualH, start: y, end: y + actualH });
                y += actualH;
            }
            if (kp && kp.componentType !== 'uszczelka') {
                lastWasDennica = (kp.componentType === 'dennica');
            }
        }
        for (let t of [...topItems].reverse()) {
            const tp = studnieProducts.find((p) => p.id === t.productId);
            if (tp) {
                let actualH = tp.height;
                if (tp.componentType === 'dennica' && lastWasDennica) actualH -= 100;

                segs.push({ type: tp.componentType, h: actualH, start: y, end: y + actualH });
                y += actualH;
                if (tp.componentType !== 'uszczelka') {
                    lastWasDennica = (tp.componentType === 'dennica');
                }
            }
        }

        let isMinimal = false;
        let valid = true;
        let errors = [];

        holes.forEach((h) => {
            const hTop = h.z + h.ruraDz;
            const hBot = h.z;
            const effZdD = h.z === 0 ? 0 : h.zdD;
            const resTop = hTop + h.zdG;
            const resBot = hBot - effZdD;
            const resTopMin = hTop + h.zdGM;
            const effZdDM = h.z === 0 ? 0 : h.zdDM;
            const resBotMin = hBot - effZdDM;

            let strictValid = true;
            let minValid = true;

            for (let s of segs) {
                if (s.type !== 'dennica' || true) {
                    if (s.end >= resBot && s.end <= resTop) strictValid = false;
                    if (s.end >= resBotMin && s.end <= resTopMin) minValid = false;
                }

                const isForbidden = [
                    'konus',
                    'plyta_din',
                    'plyta_redukcyjna',
                    'pierscien_odciazajacy'
                ].includes(s.type);
                if (isForbidden) {
                    if (hTop > s.start && hBot < s.end) {
                        strictValid = false;
                        minValid = false;
                        errors.push(`Kolizja otworu z elementem ${s.type}`);
                    }
                }
                if (s.type === 'plyta_redukcyjna') {
                    if (hBot >= s.start) {
                        strictValid = false;
                        minValid = false;
                        errors.push(`Przejście nie może być powyżej płyty redukcyjnej`);
                    }
                }
            }

            if (!strictValid) {
                if (minValid) {
                    isMinimal = true;
                } else {
                    valid = false;
                    errors.push(`Kolizja otworu Z=${h.z} ze złączami`);
                }
            }
        });

        return { valid, isMinimal, errors };
    }

    // =============================================================
    // KROK 7: Solver — szuka najlepszej kombinacji
    //         (flow z Logika/generator.py → generate())
    // =============================================================
    function solve(tolBelow, tolAbove, maxAvr, skipHolesValid) {
        let best = null;
        let bestScore = Infinity;

        for (const topCfg of topConfigs) {
            for (const dennicaItem of dennicy) {
                if (dennicaItem.height < maxReqHMin) continue;
                let denIsMin = dennicaItem.height < maxReqH;

                let effDenH = dennicaItem.height;
                if (well.psiaBuda) effDenH -= 100;

                const targetBody = requiredMm - topCfg.height - effDenH;
                if (targetBody < 0) continue;

                // DP optimizer z tolerancjami z Logika (toleranceBelow=50, toleranceAbove=20)
                const { kItems, filled } = fillKregiDP(targetBody, kregi, tolBelow, tolAbove);

                const deficit = requiredMm - (dennicaItem.height + topCfg.height + filled);
                if (deficit > maxAvr || deficit < -tolAbove) continue;

                let avrItems = [];
                let avrH = 0;

                let bestAvrCombo = [];
                let bestAvrDiff = deficit;
                function bcktrAvr(combo, sum, idx) {
                    let d = Math.abs(deficit - sum);
                    if (d < bestAvrDiff) {
                        bestAvrDiff = d;
                        bestAvrCombo = [...combo];
                        avrH = sum;
                    } else if (d === bestAvrDiff && combo.length < bestAvrCombo.length) {
                        bestAvrCombo = [...combo];
                        avrH = sum;
                    }
                    for (let i = idx; i < avrRings.length; i++) {
                        if (sum + avrRings[i].height <= maxAvr) {
                            combo.push(avrRings[i]);
                            bcktrAvr(combo, sum + avrRings[i].height, i);
                            combo.pop();
                        }
                    }
                }
                if (deficit > 0) bcktrAvr([], 0, 0);

                let cMap = {};
                for (let a of bestAvrCombo) cMap[a.id] = (cMap[a.id] || 0) + 1;
                for (let id in cMap) avrItems.push({ productId: id, quantity: cMap[id] });
                const diff = dennicaItem.height + topCfg.height + filled + avrH - requiredMm;
                const isOutOfBounds = diff < -50 || diff > 20;

                const conf = checkConflicts(kItems, dennicaItem.height, 0, topCfg.items);
                if (!conf.valid && !skipHolesValid) continue;

                // Scoring (port z generator.py: preferuj najmniej elementów, najniższą dennicę)
                let score = dennicaItem.height * 1000 + kItems.length * 10;
                if (diff !== 0) score += Math.abs(diff) * 5;
                if (isOutOfBounds) score += 20000; // Penalize out of bounds height deviations
                if (conf.isMinimal || denIsMin) score += 50000;
                if (topCfg.label.includes('zamiennik')) score += 100000;

                if (score < bestScore) {
                    bestScore = score;
                    let runErrors = [...conf.errors];
                    if (isOutOfBounds)
                        runErrors.push(
                            `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                        );
                    best = {
                        topItems: [...topCfg.items],
                        kregItems: kItems.map((ki) => ({
                            productId: ki.productId,
                            quantity: ki.quantity
                        })),
                        dennica: { productId: dennicaItem.id, quantity: 1 },
                        avrItems: avrItems,
                        totalHeight: dennicaItem.height + topCfg.height + filled + avrH,
                        diff: diff,
                        topLabel: topCfg.label,
                        errors: runErrors,
                        isMinimal: conf.isMinimal || denIsMin
                    };
                }
            }
        }

        // --- Redukcja DN1000 (port z Logika/generator.py) ---
        if (canReduce) {
            let topRedItems = [];
            let topRedH = 0;
            const redTopProducts = dn1000Products.filter((p) =>
                [
                    'konus',
                    'plyta_din',
                    'plyta_najazdowa',
                    'plyta_zamykajaca',
                    'pierscien_odciazajacy'
                ].includes(p.componentType)
            );

            // Zakończenie redukcji z ruleEngine
            const rZak = well.redukcjaZakonczenie
                ? redTopProducts.find((p) => p.id === well.redukcjaZakonczenie)
                : getTopClosure(
                      dn1000Products.filter((p) => filterByWellParams(p, well)),
                      1000,
                      null,
                      false,
                      mag
                  );
            if (rZak) {
                topRedItems.push({ productId: rZak.id, quantity: 1 });
                topRedH += rZak.height;
            }

            let maxHoleTop = 0;
            if (well.przejscia && well.przejscia.length > 0) {
                const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
                for (const pr of well.przejscia) {
                    let pel = parseFloat(pr.rzednaWlaczenia);
                    if (!isNaN(pel)) {
                        const holeCenter = (pel - rzDna) * 1000;
                        const pprod = studnieProducts.find((x) => x.id === pr.productId);
                        if (pprod) {
                            let prDN =
                                typeof pprod.dn === 'string' && pprod.dn.includes('/')
                                    ? parseFloat(pprod.dn.split('/')[1]) || 160
                                    : parseFloat(pprod.dn) || 160;
                            const zapasGora = parseFloat(
                                pprod.zapasGora !== undefined
                                    ? pprod.zapasGora
                                    : pprod.zapasGoraMin || 0
                            );
                            const holeTop = holeCenter + prDN / 2 + zapasGora;
                            if (holeTop > maxHoleTop) maxHoleTop = holeTop;
                        }
                    }
                }
            }

            let minLowerTotal = Math.max(well.redukcjaMinH || 0, maxHoleTop);
            let dynamicMinBottom = minLowerTotal;
            let lift = 0;
            // 15 skoków to 3.75 metra różnicy — wystarczająco dużo do zwiedzenia bardzo głębokiej studni
            while (lift < 15) {
                for (const dennicaItem of dennicy) {
                    if (dennicaItem.height < maxReqHMin) continue;
                    let bottomNeed = Math.max(dynamicMinBottom - dennicaItem.height, 0);

                    // DP optimizer dla dolnej sekcji
                    const bKregi = fillKregiDP(bottomNeed, kregi, tolBelow, tolAbove);
                    const bSec = dennicaItem.height + bKregi.filled;

                    const dn1000Need = requiredMm - bSec - reductionPlate.height - topRedH;
                    if (dn1000Need < 0) continue;

                    // DP optimizer dla górnej sekcji DN1000
                    const t1000 = fillKregiDP(dn1000Need, dn1000Kregi, tolBelow, tolAbove);
                    const currentTotal = bSec + reductionPlate.height + topRedH + t1000.filled;

                    const deficit = requiredMm - currentTotal;
                    if (deficit > maxAvr || deficit < -tolAbove) continue;
                    let avrItems = [];
                    let avrH = 0;

                    let bestAvrCombo = [];
                    let bestAvrDiff = deficit;
                    function bcktrAvr(combo, sum, idx) {
                        let d = Math.abs(deficit - sum);
                        if (d < bestAvrDiff) {
                            bestAvrDiff = d;
                            bestAvrCombo = [...combo];
                            avrH = sum;
                        } else if (d === bestAvrDiff && combo.length < bestAvrCombo.length) {
                            bestAvrCombo = [...combo];
                            avrH = sum;
                        }
                        for (let i = idx; i < avrRings.length; i++) {
                            if (sum + avrRings[i].height <= maxAvr) {
                                combo.push(avrRings[i]);
                                bcktrAvr(combo, sum + avrRings[i].height, i);
                                combo.pop();
                            }
                        }
                    }
                    if (deficit > 0) bcktrAvr([], 0, 0);

                    let cMap = {};
                    for (let a of bestAvrCombo) cMap[a.id] = (cMap[a.id] || 0) + 1;
                    for (let id in cMap) avrItems.push({ productId: id, quantity: cMap[id] });

                    const diff = currentTotal + avrH - requiredMm;
                    const isOutOfBounds = diff < -50 || diff > 20;

                    let redKItems = [];
                    bKregi.kItems.forEach((k) => redKItems.push(k));
                    redKItems.push({
                        productId: reductionPlate.id,
                        quantity: 1,
                        _h: reductionPlate.height
                    });
                    t1000.kItems.forEach((k) => redKItems.push(k));

                    const conf = checkConflicts(redKItems, dennicaItem.height, bSec, topRedItems);

                    if (!conf.valid && !skipHolesValid) {
                        if (
                            conf.errors.some(
                                (e) => e.includes('redukcyjnej') || e.includes('konus')
                            )
                        ) {
                            break;
                        }
                        continue;
                    }

                    let score =
                        dennicaItem.height * 1000 +
                        (bKregi.kItems.length + t1000.kItems.length) * 10;

                    const oversizedBottom = bSec - dynamicMinBottom;
                    if (oversizedBottom > 0) {
                        score += oversizedBottom * 40;
                    }

                    if (diff !== 0) score += Math.abs(diff) * 5;
                    if (isOutOfBounds) score += 10000; // Penalizuj odchylenia wysokości poza zakresem
                    if (conf.isMinimal) score += 50000;

                    if (score < bestScore) {
                        bestScore = score;
                        let runErrors = [...conf.errors];
                        if (isOutOfBounds)
                            runErrors.push(
                                `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                            );
                        best = {
                            reductionUsed: true,
                            topItems: [...topRedItems],
                            kregItems: [
                                ...t1000.kItems
                                    .map((ki) => ({
                                        productId: ki.productId,
                                        quantity: ki.quantity
                                    }))
                                    .reverse(),
                                { productId: reductionPlate.id, quantity: 1 },
                                ...bKregi.kItems
                                    .map((ki) => ({
                                        productId: ki.productId,
                                        quantity: ki.quantity
                                    }))
                                    .reverse()
                            ],
                            dennica: { productId: dennicaItem.id, quantity: 1 },
                            avrItems: avrItems,
                            totalHeight: currentTotal + avrH,
                            diff: diff,
                            topLabel: 'Redukcja',
                            errors: runErrors,
                            isMinimal: conf.isMinimal || dennicaItem.height < maxReqH
                        };
                    }
                }
                dynamicMinBottom += 250;
                lift++;
            }
        }

        return best;
    }

    let solution = solve(280, 20, 280, false);
    let fallback = false;
    let fallbackReason = '';
    if (!solution) {
        solution = solve(280, 20, 280, true);
        if (solution) {
            fallback = true;
            fallbackReason = 'kolizje przejść ominięte awaryjnie';
        }
    }

    if (!solution) {
        return {
            error: `Nie znaleziono pasującej kombinacji elementów dla tej wysokości (max. ± dozwolona odchyłka, max ${well.magazyn || 'Kluczbork'} avr 28cm).`
        };
    }

    const wlazItems = solution.topItems.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'wlaz';
    });
    const otherTopItems = solution.topItems.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType !== 'wlaz';
    });

    const kregItemsOrdered = solution.reductionUsed
        ? solution.kregItems
        : [...solution.kregItems].reverse();

    let newConfig = [
        ...wlazItems,
        ...solution.avrItems,
        ...otherTopItems,
        ...kregItemsOrdered,
        solution.dennica
    ];

    for (let i = 0; i < newConfig.length - 1; i++) {
        const itemKonus = newConfig[i];
        const prodKonus = studnieProducts.find((p) => p.id === itemKonus.productId);

        if (prodKonus && prodKonus.componentType === 'konus' && !prodKonus.name.includes('+')) {
            let nextKragIdx = -1;
            for (let j = i + 1; j < newConfig.length; j++) {
                const pj = studnieProducts.find((p) => p.id === newConfig[j].productId);
                if (pj && (pj.componentType === 'krag' || pj.componentType === 'krag_ot')) {
                    nextKragIdx = j;
                    break;
                } else if (
                    pj &&
                    (pj.componentType === 'dennica' || pj.componentType === 'plyta_redukcyjna')
                ) {
                    break;
                }
            }

            if (nextKragIdx >= 0) {
                const itemKrag = newConfig[nextKragIdx];
                const prodKrag = studnieProducts.find((p) => p.id === itemKrag.productId);

                if (prodKrag && prodKrag.height === 250 && prodKrag.componentType === 'krag') {
                    const konusPlus = availProducts.find(
                        (p) =>
                            p.componentType === 'konus' &&
                            p.dn === prodKonus.dn &&
                            p.name.includes('Konus+')
                    );
                    if (konusPlus) {
                        itemKonus.productId = konusPlus.id;
                        if (itemKrag.quantity > 1) {
                            itemKrag.quantity--;
                        } else {
                            newConfig.splice(nextKragIdx, 1);
                        }
                    }
                }
            }
            break;
        }
    }
    // --- ZABIEG APLIKUJĄCY KRĘGI Z OTWOREM (DRILLED RINGS) DLA CAŁEJ STUDNI ---
    let revY = 0;
    let lastWasD = !!well.psiaBuda;
    const segmentsReverse = [...newConfig].reverse().map((item) => {
        const prod = studnieProducts.find((p) => p.id === item.productId);
        let h = prod ? parseFloat(prod.height) || 0 : 0;
        if (prod && prod.componentType === 'dennica' && lastWasD) {
            h -= 100;
        }
        const seg = {
            itemBase: item,
            start: revY,
            end: revY + h,
            type: prod ? prod.componentType : ''
        };
        revY += h;
        lastWasD = (prod && prod.componentType === 'dennica');
        return seg;
    });

    for (const pr of well.przejscia || []) {
        let pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const holeCenter = (pel - (well.rzednaDna || 0)) * 1000;
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
        if (!pprod) continue;
        let prDN =
            typeof pprod.dn === 'string' && pprod.dn.includes('/')
                ? parseFloat(pprod.dn.split('/')[1]) || 160
                : parseFloat(pprod.dn) || 160;
        const zapasGora = parseFloat(
            pprod.zapasGora !== undefined ? pprod.zapasGora : pprod.zapasGoraMin || 0
        );
        const zapasDol = parseFloat(
            pprod.zapasDol !== undefined ? pprod.zapasDol : pprod.zapasDolMin || 0
        );
        const holeBottom = holeCenter - prDN / 2 - zapasDol;
        const holeTop = holeCenter + prDN / 2 + zapasGora;

        for (const seg of segmentsReverse) {
            if (
                (seg.type === 'krag' || seg.type === 'krag_ot') &&
                Math.max(seg.start, holeBottom) < Math.min(seg.end, holeTop)
            ) {
                const itemProd = studnieProducts.find((p) => p.id === seg.itemBase.productId);
                if (itemProd && itemProd.componentType !== 'krag_ot') {
                    const isDrilledRingObj = (p) =>
                        p.componentType === 'krag_ot' ||
                        (p.id && String(p.id).toLowerCase().endsWith('ot')) ||
                        (p.name && String(p.name).toLowerCase().includes('z otworem'));
                    const otProd = availProducts.find(
                        (p) =>
                            isDrilledRingObj(p) &&
                            p.dn === itemProd.dn &&
                            p.height === itemProd.height
                    );
                    if (otProd) {
                        seg.itemBase.productId = otProd.id;
                        seg.type = 'krag_ot';
                    } else {
                        const dynamicOtId = itemProd.id + '_OT';
                        if (!studnieProducts.find((p) => p.id === dynamicOtId)) {
                            const dynamicProd = JSON.parse(JSON.stringify(itemProd));
                            dynamicProd.id = dynamicOtId;
                            dynamicProd.componentType = 'krag_ot';
                            if (!dynamicProd.name.endsWith(' z otworem'))
                                dynamicProd.name += ' z otworem';
                            studnieProducts.push(dynamicProd);
                        }
                        seg.itemBase.productId = dynamicOtId;
                        seg.type = 'krag_ot';
                    }
                }
            }
        }
    }
    // --- KONIEC APLIKOWANIA KRĘGÓW Z OTWOREM ---

    return {
        config: newConfig,
        totalHeight: solution.totalHeight,
        diff: solution.diff,
        isMinimal: solution.isMinimal,
        errors: solution.errors,
        topLabel: solution.topLabel,
        fallback,
        fallbackReason
    };
}

function recalculateWellErrors(well) {
    if (!well) return;
    
    // Wyczyść błędy dotyczące luzów z poprzedniego wywołania, aby wygenerować je ponownie
    let liveErrors = well.configErrors ? well.configErrors.filter(e => !e.includes('Błąd zapasu') && !e.includes('nie spełnia zapasów')) : [];

    // --- WALIDACJA LUZÓW NA ŻYWO ---
    if (well.przejscia && well.przejscia.length > 0 && well.config && well.config.length > 0) {
        const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : null;
        if (rzDna !== null && !isNaN(rzDna)) {
            // Buduj segmenty fizyczne od dołu do góry
            const segments = [];
            let cy = 0;
            let lastWasDennica = !!well.psiaBuda;
            const configReversed = [...well.config].reverse();
            for (const item of configReversed) {
                const p = studnieProducts.find((pr) => pr.id === item.productId);
                if (!p || !p.height) continue;
                const qty = item.quantity || 1;
                for (let i = 0; i < qty; i++) {
                    let actualHeight = p.height || 0;
                    if (p.componentType === 'dennica' && lastWasDennica) {
                        actualHeight -= 100;
                    }

                    segments.push({
                        type: p.componentType,
                        start: cy,
                        end: cy + actualHeight,
                        product: p,
                        name: p.name
                    });
                    cy += actualHeight;
                    if (p.componentType !== 'uszczelka') {
                        lastWasDennica = (p.componentType === 'dennica');
                    }
                }
            }

            // Domyślna logika luzów
            const getDefaultC = (dn) => {
                const table = [
                    { max: 200, z: [100, 100, 50, 50] },
                    { max: 400, z: [150, 150, 100, 100] },
                    { max: 600, z: [200, 150, 150, 100] },
                    { max: 800, z: [200, 200, 150, 100] },
                    { max: 1000, z: [250, 250, 200, 150] },
                    { max: 9999, z: [300, 300, 250, 200] }
                ];
                for (let r of table) if (dn <= r.max) return r.z;
                return [300, 300, 250, 200];
            };

            const przZegarowe = well.przejscia.map((pr, idx) => ({ pr, origIdx: idx })).sort((a, b) => {
                return (parseFloat(a.pr.angle) || 0) - (parseFloat(b.pr.angle) || 0);
            });

            przZegarowe.forEach(({ pr }, porzadekIdx) => {
                const pel = parseFloat(pr.rzednaWlaczenia);
                if (isNaN(pel)) return;

                const pprod = studnieProducts.find((x) => x.id === pr.productId);
                if (!pprod) return;

                let dn_val = 160;
                if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
                    dn_val = parseFloat(pprod.dn.split('/')[1]) || 160;
                } else if (pprod.dn) {
                    dn_val = parseFloat(pprod.dn) || 160;
                }

                const defs = getDefaultC(dn_val);
                const parseClearance = (val, defVal) => {
                    if (val === undefined || val === null || val === '') return defVal;
                    const p = parseFloat(val);
                    return isNaN(p) ? defVal : p;
                };
                const zg_req = parseClearance(pprod.zapasGora, defs[1]);
                const zd_req = parseClearance(pprod.zapasDol, defs[0]);
                const hc_invert = (pel - rzDna) * 1000;
                const top_pos = hc_invert + dn_val;
                
                const typStr = pr.flowType === 'wylot' ? "wylot" : "dolot";
                const displayType = `nr ${porzadekIdx + 1} (${typStr} DN${dn_val}, rodzaj: ${pprod.name})`;

                for (const seg of segments) {
                    if (hc_invert >= seg.start && hc_invert < seg.end) {
                        const distToBottom = hc_invert - seg.start;
                        const distToTop = seg.end - top_pos;

                        // Dla absolutnie najniższej dennicy, tolerujemy rzędną włączenia 0 (brak wymaganego zapasu dolnego) ale tylko gdy to molocha "ddd"
                        const isBottomMostDennica = seg.start === 0 && (seg.type === 'dennica' || seg.type === 'styczna');
                        const isDdd = seg.product.id.toLowerCase().includes('ddd');
                        const applyingZdReq = (isBottomMostDennica && isDdd) ? 0 : zd_req;

                        if (distToBottom < applyingZdReq && distToBottom >= 0) {
                            const errStr = `Błąd zapasu dolnego w "${seg.name}" dla przejścia ${displayType} (jest ${Math.round(distToBottom)}mm, wymagane ${applyingZdReq}mm z cennika)`;
                            if (!liveErrors.includes(errStr)) liveErrors.push(errStr);
                        }
                        if (distToTop < zg_req) {
                            const errStr = `Błąd zapasu górnego w "${seg.name}" dla przejścia ${displayType} (zostało ${Math.round(distToTop)}mm, wymagane ${zg_req}mm z cennika)`;
                            if (!liveErrors.includes(errStr)) liveErrors.push(errStr);
                        }
                    }
                }
            });
        }
    }
    well.configErrors = [...new Set(liveErrors)];
    well.configStatus = well.configErrors.length > 0 ? 'ERROR' : (well.configSource ? 'OK' : well.configStatus || '');
}

/* ===== RENDEROWANIE LISTY STUDNI ===== */
function renderWellsList() {
    const container = document.getElementById('wells-list');
    if (!container) return;

    // Przelicz bezwzględnie wszystkie studnie z tła, aby uzyskać aktualne błędy grubości rur / luzów
    wells.forEach(w => recalculateWellErrors(w));

    // Funkcja szybkoskanująca uchybienia studni (luzy, braki wysokości), aktualizując obiekt przed wyrysowaniem
    const validateAutomatedErrors = (well) => {
        if (!well) return false;
        let isError = false;
        
        // 1. Sprawdzamy wysokość
        if (well.rzednaWlazu != null && well.rzednaDna != null) {
            const req = Math.round((well.rzednaWlazu - well.rzednaDna) * 1000);
            const stats = calcWellStats(well);
            if (Math.abs(stats.height - req) > 50) isError = true;
        }

        // 2. Status 'ERROR' nakazany przez główną funkcję updateHeightIndicator lub backend OR-TOOLS
        if (well.configStatus === 'ERROR' || (well.configErrors && well.configErrors.length > 0 && well.configStatus !== 'OK')) {
            isError = true;
        }
        
        return isError;
    };

    const searchTerm = (document.getElementById('wells-search-input')?.value || '')
        .toLowerCase()
        .trim();

    let html = '';
    const dktCap = [1000, 1200, 1500, 2000, 2500, 'styczna'];

    // Sprawdź zmiany w zamówieniu, jeśli w trybie edycji
    let orderChanges = {};
    if (orderEditMode) {
        orderChanges = getOrderChanges({ ...orderEditMode.order, wells: wells });
    }

    dktCap.forEach((dnGroup) => {
        const groupWells = wells
            .map((w, i) => ({ w, i }))
            .filter((item) => {
                const matchesDN = item.w.dn === dnGroup;
                const matchesSearch = !searchTerm || item.w.name.toLowerCase().includes(searchTerm);
                return matchesDN && matchesSearch;
            });
        if (groupWells.length === 0) return;

        const groupTitle = dnGroup === 'styczna' ? 'Studnie Styczne' : `Studnie DN${dnGroup}`;
        html += `<div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; margin: 0.8rem 0 0.35rem 0.3rem; letter-spacing:0.8px; font-weight:800; opacity:0.7;">${groupTitle}</div>`;

        groupWells.forEach(({ w, i }) => {
            const isActive = i === currentWellIndex;
            const stats = calcWellStats(w);
            const hasElevations = w.rzednaWlazu != null && w.rzednaDna != null;
            const requiredH = hasElevations
                ? Math.round((w.rzednaWlazu - w.rzednaDna) * 1000)
                : null;

            let changeStyling = '';
            let changeBadge = '';
            if (orderEditMode && orderChanges[i]) {
                const changeType = orderChanges[i].type;
                if (changeType === 'added') {
                    changeStyling =
                        'border-left: 3px solid #10b981; background: rgba(16,185,129,0.05);';
                    changeBadge =
                        '<span style="font-size:0.6rem; color:#10b981; font-weight:700; margin-left:0.3rem;">[NOWA]</span>';
                } else if (changeType === 'modified') {
                    changeStyling =
                        'border-left: 3px solid #ef4444; background: rgba(239,68,68,0.05);';
                    changeBadge =
                        '<span style="font-size:0.6rem; color:#ef4444; font-weight:700; margin-left:0.3rem;">[ZMIENIONA]</span>';
                }
            }

            const statusBadge =
                w.configStatus === 'ERROR'
                    ? '<span title="Błąd konfiguracji" style="margin-left:0.3rem;"><i data-lucide="x-circle"></i></span>'
                    : w.configStatus === 'WARNING'
                      ? '<span title="' +
                        (w.configErrors || []).join('; ') +
                        '" style="margin-left:0.3rem;"><i data-lucide="alert-triangle"></i></span>'
                      : w.configStatus === 'OK'
                        ? '<span style="margin-left:0.3rem;"><i data-lucide="check-circle-2"></i></span>'
                        : '';

            // Ikona źródła konfiguracji
            let sourceBadge = '';
            if (w.configSource === 'AUTO_AI') {
                sourceBadge =
                    '<span title="Dobór Automatyczny (Serwer AI / OR-Tools)" style="font-size:0.75rem; margin-left:0.3rem; filter: sepia(100%) hue-rotate(190deg) saturate(500%);"><i data-lucide="brain"></i></span>';
            } else if (w.configSource === 'AUTO_JS') {
                sourceBadge =
                    '<span title="Dobór Automatyczny (Skrypt JS)" style="font-size:0.75rem; margin-left:0.3rem; filter: sepia(100%) hue-rotate(30deg) saturate(300%);"><i data-lucide="settings"></i></span>';
            } else {
                sourceBadge =
                    '<span title="Dobór Ręczny" style="font-size:0.75rem; margin-left:0.3rem; filter: grayscale(1);"><i data-lucide="hand"></i></span>';
            }

            let errorsHtml = '';
            if (w.configErrors && w.configErrors.length > 0) {
                const color = w.configStatus === 'ERROR' ? '#ef4444' : '#f59e0b';
                errorsHtml = `<div style="font-size:0.65rem; color:${color}; padding:0.2rem 0; line-height:1.2;">${w.configErrors.join('<br>')}</div>`;
            }

            const wellLockBadge = isWellLocked(i)
                ? '<span title="Studnia zablokowana — zaakceptowane zlecenie produkcyjne" style="font-size:0.75rem; margin-left:0.3rem;"><i data-lucide="lock"></i></span>'
                : '';

            let doplataBadge = '';
            if (w.doplata && w.doplata !== 0) {
                const isNeg = w.doplata < 0;
                const badgeLabel = isNeg ? 'UPUST' : 'DOPŁATA';
                const colorHex = isNeg ? '#ef4444' : '#10b981';
                const bgRgba = isNeg ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';
                const borderRgba = isNeg ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)';
                doplataBadge = `<span title="${badgeLabel}: ${fmtInt(w.doplata)} PLN" style="font-size:0.6rem; background:${bgRgba}; color:${colorHex}; border:1px solid ${borderRgba}; padding:1px 4px; border-radius:3px; font-weight:800; margin-left:0.3rem; vertical-align:middle;">${badgeLabel}</span>`;
            }

            // Automatyczne sprawdzenie w locie dla wszystkich kart
            const hasErrors = validateAutomatedErrors(w);

            const errorStyling = hasErrors
                ? ' border:2px solid #ef4444 !important; background:rgba(239,68,68,0.15) !important;'
                : '';
            const errorNameStyle = hasErrors ? 'color:#ef4444 !important; font-weight:700 !important;' : '';
            html += `<div class="well-list-item ${isActive ? 'active' : ''}" style="${changeStyling}${isWellLocked(i) ? ' opacity:0.7;' : ''}${errorStyling}" onclick="selectWell(${i})">
              <div class="well-list-header" style="display:flex; align-items:center; gap:0.4rem;">
                <div class="well-list-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${errorNameStyle}">${w.name}</div>
                <div style="display:flex; align-items:center; gap:0.15rem; flex-shrink:0;">
                   ${wellLockBadge}${sourceBadge}${statusBadge}${changeBadge}${doplataBadge}
                </div>
                <div class="well-list-actions">
                  <button class="well-list-action" title="Duplikuj" onclick="event.stopPropagation(); duplicateWell(${i})"><i data-lucide="clipboard-list"></i></button>
                  <button class="well-list-action del" title="Usuń" onclick="event.stopPropagation(); removeWell(${i})"><i data-lucide="x"></i></button>
                </div>
              </div>
              <div class="well-list-meta">
                <div style="display:flex; gap:0.6rem;">
                  <span>Elementy: <strong>${(w.config || []).length}</strong></span>
                  <span>Przejścia: <strong>${w.przejscia ? w.przejscia.length : 0}</strong></span>
                </div>
                <span class="well-list-price">${fmtInt(stats.price)} PLN</span>
              </div>
              ${
                  hasElevations
                      ? `<div class="well-list-elevations">
                <span>↑ <strong>${w.rzednaWlazu.toFixed(3)}</strong></span>
                <span>↓ <strong>${w.rzednaDna.toFixed(3)}</strong></span>
                <span style="margin-left:auto;">H=<strong>${requiredH}</strong>mm</span>
              </div>`
                      : ''
              }
            </div>`;
        });
    });

    if (wells.length === 0) {
        html = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">Brak dodanych studni.<br>Wybierz średnicę z przycisków powyżej.</div>`;
    }

    container.innerHTML = html;

    const counter = document.getElementById('wells-counter');
    if (counter) counter.textContent = `(${wells.length})`;

    renderDiscountPanel();
}

/* ===== POPUP WARIANTU STUDNI STYCZNEJ ===== */

/**
 * Wyświetla popup z listą konkretnych produktów studni stycznych.
 * Produkty pogrupowane na: Studnie Styczne i Studnie Styczne z korkiem.
 * Po kliknięciu produktu — od razu tworzy studnię i dodaje produkt do konfiguracji.
 * @param {'select'|'add'} mode - 'select' = zmiana DN istniejącej studni, 'add' = dodanie nowej
 */
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

/**
 * Obsługuje wybór konkretnego produktu studni stycznej z popupu.
 * @param {string} productId - ID wybranego produktu
 * @param {'select'|'add'} mode
 */
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

/* ===== WYBÓR DN ===== */
function selectDN(dn) {
    if (dn === 'styczna') {
        const well = getCurrentWell();
        if (!well) {
            showToast('Najpierw dodaj studnię', 'error');
            return;
        }
        showStycznaPopup('select');
        return;
    }

    doSelectDN(dn);
}

/**
 * Wewnętrzna logika zmiany DN (wywoływana bezpośrednio dla DN numerycznych
 * lub po wyborze wariantu stycznej z popupu).
 */
function doSelectDN(dn) {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (well.dn !== dn) {
        well.dn = dn;
        // Aktualizuj nazwę, jeśli używa formatu domyślnego
        if (
            !well.numer ||
            well.name.startsWith('Studnia DN') ||
            well.name.startsWith('Studnia Styczna')
        ) {
            well.name =
                well.numer ||
                (dn === 'styczna'
                    ? 'Studnia Styczna (#' + (currentWellIndex + 1) + ')'
                    : 'Studnia DN' + well.dn + ' (#' + (currentWellIndex + 1) + ')');
        }

        // Aktualizuj zakończenie, aby pasowało do nowego DN (jeśli jest standardowe)
        if (well.zakonczenie && dn !== 'styczna') {
            const oldProd = studnieProducts.find((p) => p.id === well.zakonczenie);
            if (oldProd) {
                const newProd = studnieProducts.find(
                    (p) => p.componentType === oldProd.componentType && p.dn === dn
                );
                well.zakonczenie = newProd ? newProd.id : null;
            } else {
                well.zakonczenie = null;
            }
        }

        // Wyczyść stare elementy, które nie pasują do nowego DN i uruchom ponownie auto-dobór
        well.config = [];
        autoSelectComponents(true);
        refreshAll();
    }

    updateDNButtons();
    renderTiles();
    renderWellsList();
}

function updateDNButtons() {
    const well = getCurrentWell();
    document.querySelectorAll('.dn-btn').forEach((b) => {
        if (!well) {
            b.classList.remove('active');
            return;
        }

        let btnText = b.textContent.trim().toLowerCase();
        let wellDnStr = String(well.dn).toLowerCase();

        if (btnText === wellDnStr) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

/**
 * Uniwersalny filtr produktów wg parametrów studni (nadbudowa, dennica, stopnie).
 * @param {Object} p - Produkt z cennika
 * @param {Object} well - Aktualna studnia
 * @returns {boolean}
 */
function filterByWellParams(p, well) {
    if (!well) return true;
    const id = (p.id || '').toUpperCase();

    // 1. Kręgi (KDZ/KDB), Konus (JZW) i stopnie (-B, -D, -N)
    if (
        p.componentType === 'krag' ||
        p.componentType === 'krag_ot' ||
        p.componentType === 'konus'
    ) {
        const isZelbet = well.nadbudowa === 'zelbetowa';
        if (isZelbet && id.startsWith('KDB') && p.dn !== 2000 && p.dn !== 2500) return false;
        if (!isZelbet && id.startsWith('KDZ') && p.dn !== 2000 && p.dn !== 2500) return false;

        const stopnie = well.stopnie || 'drabinka';

        // Usuń przyrostek _OT dla walidacji
        const checkId = id.endsWith('_OT') ? id.replace('_OT', '') : id;

        // Kręgi kończą się na: -B (brak), -D (drabinka), -N-D (nierdzewna)
        const hasStepsAny = checkId.endsWith('-B') || checkId.endsWith('-D');

        if (hasStepsAny) {
            if (stopnie === 'nierdzewna') {
                if (!checkId.endsWith('-N-D')) return false;
            } else if (stopnie === 'brak') {
                if (!checkId.endsWith('-B')) return false;
            } else {
                // drabinka (domyślna)
                if (!checkId.endsWith('-D') || checkId.endsWith('-N-D')) return false;
            }
        }
    }

    // 2. Dennice (DUZ/DU)
    if (p.componentType === 'dennica') {
        const isZelbet = well.dennicaMaterial === 'zelbetowa';
        if (
            isZelbet &&
            id.startsWith('DU') &&
            !id.startsWith('DUZ') &&
            p.dn !== 2000 &&
            p.dn !== 2500
        )
            return false;
        if (!isZelbet && id.startsWith('DUZ') && p.dn !== 2000 && p.dn !== 2500) return false;
    }

    // 3. Płyty (PDZ/PD itp)
    if (
        ['plyta_najazdowa', 'plyta_zamykajaca', 'plyta_din', 'plyta_redukcyjna'].includes(
            p.componentType
        )
    ) {
        const isZelbet = well.nadbudowa === 'zelbetowa';
        if (
            isZelbet &&
            id.startsWith('PD') &&
            !id.startsWith('PDZ') &&
            p.dn !== 2000 &&
            p.dn !== 2500
        )
            return false;
        if (!isZelbet && id.startsWith('PDZ') && p.dn !== 2000 && p.dn !== 2500) return false;
        if (
            isZelbet &&
            id.startsWith('PZ') &&
            !id.startsWith('PZZ') &&
            p.dn !== 2000 &&
            p.dn !== 2500
        )
            return false;
        if (!isZelbet && id.startsWith('PZZ') && p.dn !== 2000 && p.dn !== 2500) return false;
    }

    return true;
}

window.updateConfigToMatchParams = function (well) {
    if (!well || !well.config || well.config.length === 0) return;
    const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));
    let anyChanged = false;

    well.config.forEach((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        // Upewnij się, że poprawnie obsługujemy dynamicznie generowane kręgi wiercone, tymczasowo znajdując ich podstawowy produkt ogólny
        const isDrilled = p.componentType === 'krag_ot' || p.id.endsWith('_OT');

        if (!filterByWellParams(p, well)) {
            // Znajdź zamiennik
            const substitute = availProducts.find(
                (cand) =>
                    cand.componentType === p.componentType &&
                    cand.dn === p.dn &&
                    parseFloat(cand.height) === parseFloat(p.height)
            );
            if (substitute) {
                item.productId = substitute.id;
                anyChanged = true;
            } else if (isDrilled) {
                // Dla dynamicznych kręgów wierconych znajdujemy zamiennik dla kręgu bazowego, a następnie dodajemy _OT
                const baseId = p.id.replace('_OT', '');
                const baseProd = studnieProducts.find((pr) => pr.id === baseId);
                if (baseProd) {
                    const baseSub = availProducts.find(
                        (cand) =>
                            cand.componentType === 'krag' &&
                            cand.dn === baseProd.dn &&
                            parseFloat(cand.height) === parseFloat(baseProd.height)
                    );
                    if (baseSub) {
                        const dynamicOtId = baseSub.id + '_OT';
                        if (!studnieProducts.find((pr) => pr.id === dynamicOtId)) {
                            const dynamicProd = JSON.parse(JSON.stringify(baseSub));
                            dynamicProd.id = dynamicOtId;
                            dynamicProd.componentType = 'krag_ot';
                            if (!dynamicProd.name.endsWith(' z otworem'))
                                dynamicProd.name += ' z otworem';
                            studnieProducts.push(dynamicProd);
                        }
                        item.productId = dynamicOtId;
                        anyChanged = true;
                    }
                }
            }
        }
    });

    if (anyChanged) {
        showToast('Zaktualizowano rodzaje elementów w konfiguracji', 'info');
    }
};

/* ===== RENDEROWANIE KAFELKÓW ===== */

/**
 * Filtruje uszczelki wg wybranego typu w parametrach studni (SDV, GSG, NBR, SDV PO).
 * Zwraca pustą tablicę jeśli uszczelka = 'brak' lub 'smar'.
 */
function filterSealsByWellType(sealItems, well) {
    if (!well.uszczelka || well.uszczelka === 'brak' || well.uszczelka === 'smar') {
        return [];
    }
    const keyword = well.uszczelka.replace('Uszczelka ', '').toUpperCase();
    return sealItems.filter((p) => {
        const nameUpper = p.name.toUpperCase();
        const idUpper = p.id.toUpperCase();

        if (keyword === 'SDV') {
            return (
                nameUpper.includes('SDV') &&
                !nameUpper.includes('PIERŚCIENIEM') &&
                !nameUpper.includes('PO')
            );
        }
        if (keyword === 'SDV PO') {
            return (
                nameUpper.includes('SDV') &&
                (nameUpper.includes('PIERŚCIENIEM') || nameUpper.includes('PO'))
            );
        }
        if (keyword === 'GSG') {
            return nameUpper.includes('GSG') && !nameUpper.includes('NBR');
        }
        if (keyword === 'NBR') {
            return nameUpper.includes('NBR');
        }
        return nameUpper.includes(keyword) || idUpper.includes(keyword);
    });
}

function renderTiles() {
    const container = document.getElementById('tiles-container');
    const well = getCurrentWell();
    if (!well) {
        if (container)
            container.innerHTML =
                '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.8rem;">Dodaj studnię aby wybrać elementy</div>';
        return;
    }
    const dn = well.dn;

    const groups = [
        { title: '<i data-lucide="circle-dot"></i> Włazy', icon: '', types: ['wlaz'] },
        { title: '<i data-lucide="settings"></i> AVR / Pierścienie', icon: '', types: ['avr'] },
        { title: '<i data-lucide="diamond"></i> Konus / Stożek', icon: '', types: ['konus'] },
        {
            title: '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyty nakrywające',
            icon: '',
            types: ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy']
        },
        { title: '⬛ Płyty redukcyjne', icon: '', types: ['plyta_redukcyjna'] },
        { title: '<i data-lucide="square"></i> Kręgi', icon: '', types: ['krag'] },
        { title: '<i data-lucide="square"></i> Kręgi z otworami (OT)', icon: '', types: ['krag_ot'] },
        { title: '<i data-lucide="square"></i> Dennica', icon: '', types: ['dennica'] },
        { title: '🪣 Osadniki', icon: '', types: ['osadnik'] },
        // Studnie styczne widoczne tylko gdy wybrana typu studni Styczna
        ...(dn === 'styczna'
            ? (() => {
                  const variant = well.stycznaVariant || 'standard';
                  if (variant === 'korek') {
                      return [
                          {
                              title: '<i data-lucide="plug"></i> Studnie Styczne z korkiem',
                              icon: '',
                              types: ['styczna'],
                              filterFn: (p) => p.id.includes('KOREK')
                          }
                      ];
                  }
                  return [
                      {
                          title: '<i data-lucide="cylinder"></i> Studnie Styczne',
                          icon: '',
                          types: ['styczna'],
                          filterFn: (p) => !p.id.includes('KOREK')
                      }
                  ];
              })()
            : []),
        { title: '<i data-lucide="circle-check"></i> Uszczelki', icon: '', types: ['uszczelka'] }
    ];

    let html = '';

    const renderGroup = (group, prods) => {
        let items = prods.filter((p) => group.types.includes(p.componentType));
        if (group.filterFn) {
            items = items.filter(group.filterFn);
        }
        if (items.length === 0) return;

        // Niestandardowe sortowanie dla studni stycznych: sortuj wg DN
        if (group.types.includes('styczna')) {
            items.sort((a, b) => (a.dn || 0) - (b.dn || 0));
        }

        // Niestandardowe sortowanie dla dennicy: sortuj wg wysokości od najniższej do najwyższej
        if (group.types.includes('dennica')) {
            items.sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
        }

        html += `<div class="tiles-section">
      <div class="tiles-section-title">${group.title}</div>
      <div class="tiles-grid">`;

        items.forEach((p) => {
            const isTopClosure = [
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'konus',
                'pierscien_odciazajacy'
            ].includes(p.componentType);
            const isInConfig = (well.config || []).some((c) => c.productId === p.id);
            const activeClass = isTopClosure && isInConfig ? 'active-top-closure' : '';
            const isLocked = isWellLocked();
            const lockedStyle = isLocked
                ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                : '';

            // Oblicz cenę z dopłatą, jeśli wybrano drabinę nierdzewną
            let displayPrice = p.price || 0;
            if (well.stopnie === 'nierdzewna' && p.doplataDrabNierdzewna) {
                displayPrice += parseFloat(p.doplataDrabNierdzewna);
            }

            html += `<div class="tile ${activeClass}" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${p.id}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${p.id}')`}" ondragend="dragEndWellComponent(event)">
        <div class="tile-name">${p.name}</div>
        <div class="tile-meta">
          <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
          <span class="tile-price">${fmtInt(displayPrice)} PLN</span>
        </div>
      </div>`;
        });
        html += `</div></div>`;
    };

    const availProducts = getAvailableProducts(well);
    const primaryProducts = availProducts
        .filter((p) => {
            if (dn === 'styczna') {
                // Dla studni stycznych użyj well.dn dla nadbudowy, ale pozwól na 'styczną' dla dennicy
                if (p.componentType === 'dennica' || p.componentType === 'styczna') {
                    return p.dn === 'styczna' || p.componentType === 'styczna';
                }
                const effectiveDn = well.dn || 1000;
                return p.dn === effectiveDn || p.dn === null;
            }

            return p.dn === dn || p.dn === null;
        })
        .filter((p) => filterByWellParams(p, well));

    groups.forEach((g) => {
        // Specjalna logika dla studni stycznych, aby pokazać poprawny parametr uszczelki w kategorii uszczelek
        if (g.types.includes('uszczelka')) {
            let items = primaryProducts.filter((p) => g.types.includes(p.componentType));
            items = filterSealsByWellType(items, well);

            if (items.length > 0) {
                html += `<div class="tiles-section"><div class="tiles-section-title">${g.title}</div><div class="tiles-grid">`;
                items.forEach((p) => {
                    const isLocked = isWellLocked();
                    const lockedStyle = isLocked
                        ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                        : '';

                    html += `<div class="tile" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${p.id}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${p.id}')`}" ondragend="dragEndWellComponent(event)">
                        <div class="tile-name">${p.name}</div>
                        <div class="tile-meta">
                          <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
                          <span class="tile-price">${fmtInt(p.price)} PLN</span>
                        </div>
                      </div>`;
                });
                html += `</div></div>`;
            }
        } else {
            renderGroup(g, primaryProducts);
        }
    });

    const hasReduction =
        well.redukcjaDN1000 ||
        (well.config || []).some((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'plyta_redukcyjna';
        });

    if ([1200, 1500, 2000, 2500].includes(dn) && hasReduction) {
        const redProducts = availProducts
            .filter(
                (p) =>
                    p.dn === 1000 &&
                    p.componentType !== 'plyta_redukcyjna' &&
                    p.componentType !== 'dennica'
            )
            .filter((p) => filterByWellParams(p, well));
        if (redProducts.length > 0) {
            html += `<div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">`;
            html += `<h3 style="color:#f59e0b; margin-bottom:1rem; font-size:1.1rem;">⏬ Redukcja (DN1000)</h3>`;
            groups.forEach((g) => {
                if (g.types.includes('uszczelka')) {
                    // Zastosuj to samo filtrowanie typu uszczelki dla sekcji redukcji
                    let items = redProducts.filter((p) => g.types.includes(p.componentType));
                    items = filterSealsByWellType(items, well);
                    if (items.length > 0) {
                        html += `<div class="tiles-section"><div class="tiles-section-title">${g.title}</div><div class="tiles-grid">`;
                        items.forEach((p) => {
                            const isLocked = isWellLocked();
                            const lockedStyle = isLocked
                                ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                                : '';
                            html += `<div class="tile" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${p.id}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${p.id}')`}" ondragend="dragEndWellComponent(event)">
                                <div class="tile-name">${p.name}</div>
                                <div class="tile-meta">
                                  <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
                                  <span class="tile-price">${fmtInt(p.price)} PLN</span>
                                </div>
                              </div>`;
                        });
                        html += `</div></div>`;
                    }
                } else {
                    renderGroup(g, redProducts);
                }
            });
            html += `</div>`;
        }
    }

    container.innerHTML = html;
}

/* ===== KONFIGURACJA STUDNI ===== */

/* --- Przeciągnij i upuść dla elementów studni --- */
window.currentDraggedPlaceholderId = null;

function dragWellComponent(ev, productId) {
    ev.dataTransfer.setData('text/plain', productId);
    ev.dataTransfer.effectAllowed = 'copy';
    window.currentDraggedPlaceholderId = productId;
}

function dragEndWellComponent(ev) {
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');

    const well = getCurrentWell();
    if (well && window.currentDraggedPlaceholderId) {
        well.config = well.config.filter((c) => !c.isPlaceholder);
        window.requestAnimationFrame(() => {
            renderWellConfig();
            renderWellDiagram();
        });
    }
    window.currentDraggedPlaceholderId = null;
}

function allowDropWellComponent(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = draggedCfgIndex !== null ? 'move' : 'copy';
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.add('drag-over');

    const well = getCurrentWell();
    if (!well) return;

    let targetIdx = well.config.length;
    let found = false;
    const grps = Array.from(dz.querySelectorAll('g.diag-comp-grp'));

    for (let g of grps) {
        const rect = g.getBoundingClientRect();
        if (ev.clientY < rect.top + rect.height / 2) {
            targetIdx = parseInt(g.getAttribute('data-cfg-idx'));
            found = true;
            break;
        }
    }
    if (!found && grps.length > 0) {
        targetIdx = well.config.length;
    }

    if (window.currentDraggedPlaceholderId) {
        const plIdx = well.config.findIndex((c) => c.isPlaceholder);
        // Unikaj migotania, nie renderując, jeśli zmapowana pozycja jest praktycznie taka sama
        let currentEffIdx = plIdx;
        let newEffIdx = targetIdx;
        if (plIdx > -1 && plIdx < targetIdx) newEffIdx -= 1;

        if (plIdx === -1 || plIdx !== newEffIdx) {
            const p = studnieProducts.find((x) => x.id === window.currentDraggedPlaceholderId);
            if (p) {
                if (plIdx > -1) well.config.splice(plIdx, 1);

                let insertIdx = targetIdx;
                if (plIdx > -1 && plIdx < targetIdx) insertIdx -= 1;
                insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

                well.config.splice(insertIdx, 0, {
                    productId: window.currentDraggedPlaceholderId,
                    quantity: 1,
                    height: p.height || 0,
                    isPlaceholder: true
                });

                window.requestAnimationFrame(() => {
                    renderWellConfig();
                    renderWellDiagram();
                });
            }
        }
    } else if (draggedCfgIndex !== null) {
        let insertIdx = targetIdx;
        if (draggedCfgIndex < targetIdx) insertIdx -= 1;
        insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

        if (draggedCfgIndex !== insertIdx) {
            const draggedItem = well.config.splice(draggedCfgIndex, 1)[0];
            well.config.splice(insertIdx, 0, draggedItem);
            draggedCfgIndex = insertIdx;

            window.requestAnimationFrame(() => renderWellDiagram());
        }
    }
}

function dragLeaveWellComponent(ev) {
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');
}

window.injectPairIfReliefComponent = function (well, productId, baseIndex) {
    const prod = studnieProducts.find((x) => x.id === productId);
    if (!prod) return;

    if (prod.componentType === 'pierscien_odciazajacy') {
        const pair = getAvailableProducts(well).find(
            (x) =>
                (x.componentType === 'plyta_najazdowa' || x.componentType === 'plyta_zamykajaca') &&
                parseInt(x.dn) === parseInt(prod.dn) &&
                filterByWellParams(x, well)
        );
        if (pair) {
            well.config.splice(baseIndex, 0, {
                productId: pair.id,
                quantity: 1,
                _addedAt: Date.now()
            });
            showToast('Dodano komplet: Płyta + Pierścień odciążający', 'info');
        }
    } else if (
        prod.componentType === 'plyta_najazdowa' ||
        prod.componentType === 'plyta_zamykajaca' ||
        (prod.name && prod.name.toLowerCase().includes('odciążając'))
    ) {
        const pair = getAvailableProducts(well).find(
            (x) =>
                x.componentType === 'pierscien_odciazajacy' &&
                parseInt(x.dn) === parseInt(prod.dn) &&
                filterByWellParams(x, well)
        );
        if (pair) {
            well.config.splice(baseIndex + 1, 0, {
                productId: pair.id,
                quantity: 1,
                _addedAt: Date.now()
            });
            showToast('Dodano komplet: Płyta + Pierścień odciążający', 'info');
        }
    }
};

function enforceSingularTopClosures(well, productId) {
    const product = studnieProducts.find((p) => p.id === productId);
    if (!product) return;

    const topClosureTypes = [
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'konus',
        'pierscien_odciazajacy'
    ];

    // ZASADA 1: Tylko jedno zakończenie studni
    if (topClosureTypes.includes(product.componentType)) {
        well.config = well.config.filter((item) => {
            if (item.isPlaceholder) return true;
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && !topClosureTypes.includes(p.componentType);
        });
    }

    // ZASADA 2: Właz - tylko 1 naraz
    if (product.componentType === 'wlaz') {
        well.config = well.config.filter((item) => {
            if (item.isPlaceholder) return true;
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && p.componentType !== 'wlaz';
        });
    }
}

function dropWellComponent(ev) {
    ev.preventDefault();
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');

    const well = getCurrentWell();
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        window.currentDraggedPlaceholderId = null;
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        window.currentDraggedPlaceholderId = null;
        return;
    }
    if (well && window.currentDraggedPlaceholderId) {
        enforceSingularTopClosures(well, window.currentDraggedPlaceholderId);

        // Zamiast kasować na bezczelnego, szukamy gdzie jest nasz placeholder
        const plIdx = well.config.findIndex((c) => c.isPlaceholder);
        let actualIndex = -1;
        if (plIdx > -1) {
            well.config[plIdx].isPlaceholder = false;
            actualIndex = plIdx;
        } else {
            // Bezpiecznik: jeśli go nie było, dodaj na koniec
            well.config.push({
                productId: window.currentDraggedPlaceholderId,
                quantity: 1
            });
            actualIndex = well.config.length - 1;
        }

        if (typeof window.injectPairIfReliefComponent === 'function') {
            window.injectPairIfReliefComponent(
                well,
                window.currentDraggedPlaceholderId,
                actualIndex
            );
        }

        window.currentDraggedPlaceholderId = null;

        // Włączamy ręczny reżim
        well.autoLocked = true;
        updateAutoLockUI();
        well.configSource = 'MANUAL';

        sortWellConfigByOrder();
        syncGaskets(well);

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    } else if (well && draggedCfgIndex !== null) {
        // Zostało puszczone na puste pole SVG, resetujemy flagi i zapisujemy
        well.config.forEach((c) => (c.isPlaceholder = false));
        well.autoLocked = true;
        updateAutoLockUI();
        well.configSource = 'MANUAL';

        syncGaskets(well);

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    }
}

function addWellComponent(productId) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const product = studnieProducts.find((p) => p.id === productId);
    if (!product) return;

    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    // Włączenie trybu ręcznego jeśli dodano jakikolwiek element z palety
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
        showToast('Włączono tryb ręczny.', 'info');
    }
    well.configSource = 'MANUAL';

    // ZASADA 1: Tylko jedno zakończenie studni
    const topClosureTypes = [
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'konus',
        'pierscien_odciazajacy'
    ];
    if (topClosureTypes.includes(product.componentType)) {
        // Usuń poprzednie elementy zakończenia
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && !topClosureTypes.includes(p.componentType);
        });
    }

    // ZASADA 2: Właz - tylko 1 naraz
    if (product.componentType === 'wlaz') {
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && p.componentType !== 'wlaz';
        });
    }

    // Pomocnik do dodawania pojedynczego produktu do konfiguracji studni w odpowiedniej pozycji
    const addSingle = (prod) => {
        const topClosureTypes = [
            'plyta_din',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'konus',
            'pierscien_odciazajacy',
            'wlaz'
        ];
        const isTop = topClosureTypes.includes(prod.componentType);
        const isBottom = ['dennica', 'kineta', 'styczna'].includes(prod.componentType);

        if (isTop) {
            // Zakończenia zawsze na samą górę (indeks 0 lub za włazem, ale właz jest już filtrowany wyżej)
            well.config.unshift({ productId: prod.id, quantity: 1, _addedAt: Date.now() });
            if (typeof window.injectPairIfReliefComponent === 'function') {
                window.injectPairIfReliefComponent(well, prod.id, 0);
            }
            return;
        }

        if (isBottom) {
            // Dennice zawsze na sam dół (koniec tablicy)
            well.config.push({ productId: prod.id, quantity: 1, _addedAt: Date.now() });
            return;
        }

        // Dla rur (krag, krag_ot) szukamy odpowiedniego miejsca
        const plateIdx = well.config.findIndex((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'plyta_redukcyjna';
        });

        if (plateIdx >= 0) {
            const plate = studnieProducts.find((p) => p.id === well.config[plateIdx].productId);
            // Wykrywamy czy krąg jest DN główny (np. 1500) czy redukcyjny (1000)
            const mainDn = well.dn;
            const isRedDn = prod.dn === 1000;

            if (isRedDn) {
                // Krąg DN1000 -> wstawiamy NAD płytą redukcyjną (przed płytą w tablicy)
                // Ale za włazem/konusem
                let insertIdx = 0;
                for (let i = 0; i < plateIdx; i++) {
                    const p = studnieProducts.find((pr) => pr.id === well.config[i].productId);
                    if (!topClosureTypes.includes(p.componentType)) {
                        insertIdx = i;
                        break;
                    }
                    insertIdx = i + 1;
                }
                well.config.splice(insertIdx, 0, {
                    productId: prod.id,
                    quantity: 1,
                    _addedAt: Date.now()
                });
            } else {
                well.config.splice(plateIdx + 1, 0, {
                    productId: prod.id,
                    quantity: 1,
                    _addedAt: Date.now()
                });
            }
        } else {
            let insertIdx = 0;
            for (let i = 0; i < well.config.length; i++) {
                const p = studnieProducts.find((pr) => pr.id === well.config[i].productId);
                if (!topClosureTypes.includes(p.componentType)) {
                    insertIdx = i;
                    break;
                }
                insertIdx = i + 1;
            }
            well.config.splice(insertIdx, 0, {
                productId: prod.id,
                quantity: 1,
                _addedAt: Date.now()
            });
        }
    };

    addSingle(product);

    sortWellConfigByOrder();
    syncGaskets(well);
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderWellsList();
    renderTiles(); // Update highlight
    updateHeightIndicator(); // Odśwież błędy

    if (topClosureTypes.includes(product.componentType) && well.rzednaWlazu != null) {
        const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
        if (well.rzednaWlazu > rzDna) {
            showToast(`Wybrano zakończenie: ${product.name}`, 'success');

            // Auto-dobór (gdy dodajemy płyte starym "klikiem",
            // ale teraz tryb ręczny blokuje autodobór, wiec nigdy to nie zajdzie, chyba ze go odblokujemy)
            if (!well.autoLocked) {
                autoSelectComponents(true);
                return;
            }
        } else {
            showToast(`Dodano: ${product.name}`, 'success');
        }
    } else {
        showToast(`Dodano: ${product.name}`, 'success');
    }
}

function removeWellComponent(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    well.configSource = 'MANUAL';

    const removedItem = well.config.splice(index, 1)[0];

    if (removedItem) {
        const p = studnieProducts.find((pr) => pr.id === removedItem.productId);
        if (p && p.componentType === 'redukcja') {
            well.redukcjaDN1000 = false;

            const redToggle = document.getElementById('well-redukcja-toggle');
            if (redToggle) redToggle.checked = false;

            if (typeof updateAutoLockUI === 'function') updateAutoLockUI();

            showToast('Usunięto redukcję ze studni.', 'info');
            // Pozwól kodowi kontynuować i ponownie wyrenderować bez automatycznego dobierania
        }
    }

    syncGaskets(well);
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderWellsList();
    renderTiles(); // Update highlight
    updateHeightIndicator(); // Odśwież błędy
}

function updateWellQuantity(index, value) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const qty = parseInt(value);
    if (qty <= 0) {
        removeWellComponent(index);
        return;
    }
    const well = getCurrentWell();
    well.configSource = 'MANUAL';
    // Nie pozwalamy na zmianę ilości na > 1 dla elementów betonowych, ale zachowujemy funkcję do usuwania
    well.config[index].quantity = 1;
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderTiles(); // highlight items
    updateHeightIndicator(); // Odśwież błędy
}

function clearWellConfig() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    well.configSource = 'MANUAL';
    well.config = [];
    refreshAll();
    showToast('Wyczyszczono konfigurację studni', 'info');
}

function renderWellConfig() {
    const tbody = document.getElementById('well-config-body');
    const well = getCurrentWell();

    if (!well || !well.config || well.config.length === 0) {
        tbody.innerHTML =
            '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Kliknij kafelki powyżej, aby dodać elementy studni</div>';
        return;
    }

    // Mapowanie wizualnej kolejności typu komponentu (góra studni → dół)
    const typeOrderMap = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2,
        plyta_najazdowa: 2,
        plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 4,
        krag: 5,
        krag_ot: 5,
        dennica: 6,
        kineta: 7
    };

    // Odznaki kolorów typów
    const typeBadge = {
        wlaz: { bg: '#1e293b', label: 'Właz' },
        plyta_din: { bg: '#be185d', label: 'Płyta' },
        plyta_najazdowa: { bg: '#9d174d', label: 'Płyta' },
        plyta_zamykajaca: { bg: '#7c3aed', label: 'Płyta' },
        pierscien_odciazajacy: { bg: '#0891b2', label: 'Pierścień' },
        konus: { bg: '#d97706', label: 'Konus' },
        avr: { bg: '#475569', label: 'AVR' },
        plyta_redukcyjna: { bg: '#6d28d9', label: 'Redukcja' },
        krag: { bg: '#4338ca', label: 'Krąg' },
        krag_ot: { bg: '#4338ca', label: 'Krąg OT' },
        dennica: { bg: '#047857', label: 'Dennica' },
        kineta: { bg: '#9d174d', label: 'Kineta' },
        uszczelka: { bg: '#334155', label: 'Uszczelka' },
        styczna: { bg: '#059669', label: 'Styczna' },
        osadnik: { bg: '#a16207', label: 'Osadnik' }
    };

    let html = '';
    well.config.forEach((item, index) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        const itemAssessedPrice = getItemAssessedPrice(well, p);
        let totalPrice = itemAssessedPrice * item.quantity;

        if (p.componentType === 'dennica' || p.componentType === 'styczna') {
            const kinetaItem = well.config.find((c) => {
                const pr = studnieProducts.find((x) => x.id === c.productId);
                return pr && pr.componentType === 'kineta';
            });
            if (kinetaItem) {
                const kinetaProd = studnieProducts.find((x) => x.id === kinetaItem.productId);
                if (kinetaProd) {
                    const rawKinetaPrice = getItemAssessedPrice(well, kinetaProd);
                    totalPrice += rawKinetaPrice * (kinetaItem.quantity || 1);
                }
            }
            // Dopłata wliczona do dennicy / studni stycznej (nie podlega rabatowi)
            if (well.doplata) {
                totalPrice += well.doplata;
            }
        }
        const totalWeight = (p.weight || 0) * item.quantity;
        const totalAreaInt = (p.area || 0) * item.quantity;
        const totalAreaExt = (p.areaExt || 0) * item.quantity;
        const badge = typeBadge[p.componentType] || { bg: '#333', label: '?' };

        const canMoveUp = index > 0;
        const canMoveDown = index < well.config.length - 1;

        const isPlaceholder = item.isPlaceholder;
        const plStyle = isPlaceholder
            ? 'opacity:0.7; box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); pointer-events: none;'
            : '';

        html += `<div data-cfg-idx="${index}" class="config-tile" draggable="true" ondragstart="handleCfgDragStart(event)" ondragover="handleCfgDragOver(event)" ondrop="handleCfgDrop(event)" ondragend="handleCfgDragEnd(event)" style="background:linear-gradient(90deg, ${badge.bg} 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:4px solid ${badge.bg.substring(0, 7)}; border-radius:8px; padding:0.45rem 0.5rem; position:relative; transition:all 0.2s ease; margin-bottom:0.3rem; cursor:grab; ${plStyle}"
                      onmouseenter="if(!${isPlaceholder}){this.style.filter='brightness(1.5)'; this.style.borderColor='rgba(255,255,255,0.3)'; this.style.boxShadow='0 0 12px rgba(99,102,241,0.4)'; window.highlightSvg('cfg', ${index})}" onmouseleave="if(!${isPlaceholder}){this.style.filter='brightness(1)'; this.style.borderColor='rgba(255,255,255,0.05)'; this.style.boxShadow='none'; window.unhighlightSvg('cfg', ${index})}">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            
            <div style="display:flex; align-items:center; gap:0.6rem; flex:1; min-width:0;">
                <div style="display:flex; flex-direction:column; gap:1px; align-items:center; background:rgba(0,0,0,0.25); padding:0.2rem 0.35rem; border-radius:6px; min-width:28px;">
                  <button class="cfg-move-btn" ${!canMoveUp ? 'disabled' : ''} onclick="moveWellComponent(${index}, -1)" title="W górę" style="background:none; border:none; color:var(--text-muted); padding:0; cursor:${canMoveUp ? 'pointer' : 'default'}; display:${item.autoAdded ? 'none' : 'block'};"><i data-lucide="chevron-up" style="font-size: 0.75rem;"></i></button>
                  <span style="font-size:0.7rem; color:var(--text-primary); font-weight:800;">${index + 1}</span>
                  <button class="cfg-move-btn" ${!canMoveDown ? 'disabled' : ''} onclick="moveWellComponent(${index}, 1)" title="W dół" style="background:none; border:none; color:var(--text-muted); padding:0; cursor:${canMoveDown ? 'pointer' : 'default'}; display:${item.autoAdded ? 'none' : 'block'};"><i data-lucide="chevron-down" style="font-size: 0.75rem;"></i></button>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.15rem; min-width:0;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="background:${badge.bg}; color:white; font-size:0.55rem; padding:2px 6px; border-radius:4px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; opacity:0.9;">${badge.label.split(' ')[1] || badge.label}</span>
                    <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}${p.componentType === 'uszczelka' && item.quantity > 1 ? ` (x${item.quantity} szt.)` : p.componentType === 'uszczelka' ? ` (1 szt.)` : ''}</div>
                  </div>
                  <div style="font-size:0.65rem; color:var(--text-muted); opacity:0.6; padding-left:2px;">${p.id}${p.height ? ' | H=' + p.height + 'mm' : ''}</div>
                </div>
            </div>

            <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.6rem; flex-shrink:0; min-width:340px;">
              <div style="display:grid; grid-template-columns:36px 65px 60px 48px 120px; gap:0 0.5rem; align-items:baseline;">
                <span style="font-size:0.52rem; color:rgba(255,255,255,0.25); font-weight:800; letter-spacing:0.6px; text-align:left;">WAGA:</span>
                <span style="color:rgba(255,255,255,0.95); font-weight:700; font-size:0.82rem; white-space:nowrap; text-align:right;">${p.weight || totalWeight > 0 ? fmtInt(totalWeight) + ' kg' : '—'}</span>
                
                <div style="width:60px;"></div>
                
                <span style="font-size:0.52rem; color:rgba(255,255,255,0.25); font-weight:800; letter-spacing:0.6px; text-align:left;">CENA:</span>
                <span style="font-size:1.0rem; font-weight:800; color:var(--success); white-space:nowrap; letter-spacing:0.3px; text-align:right; width:100%; display:block;">${p.componentType === 'kineta' ? 'wliczone (' + fmtInt(totalPrice) + ' PLN)' : fmtInt(totalPrice) + ' PLN'}</span>
              </div>
              <div style="width:32px; display:flex; justify-content:center;">
                <button onclick="removeWellComponent(${index})" title="Usuń" style="width:32px; height:32px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:8px; cursor:pointer; font-size:0.9rem; color:#ef4444; display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.15)'; this.style.borderColor='rgba(239,68,68,0.4)';" onmouseleave="this.style.background='rgba(239,68,68,0.06)'; this.style.borderColor='rgba(239,68,68,0.2)';"><i data-lucide="x"></i></button>
              </div>
            </div>

          </div>
        </div>`;
    });

    tbody.innerHTML = html;
}

/* ===== MOVE WELL COMPONENT ===== */
function moveWellComponent(index, direction) {
    const well = getCurrentWell();
    if (!well) return;
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.config.length) return;

    // Swap elements
    const temp = well.config[index];
    well.config[index] = well.config[newIndex];
    well.config[newIndex] = temp;

    // Enable manual mode since user is reordering
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
    }
    well.configSource = 'MANUAL';

    renderWellConfig();
    updateHeightIndicator(); // Odśwież błędy po przesunięciu
}

/* ===== DRAG & DROP FOR CONCRETE CONFIG ===== */
let draggedCfgIndex = null;

window.handleCfgDragStart = function (e) {
    draggedCfgIndex = parseInt(e.currentTarget.getAttribute('data-cfg-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';

    // Robimy z niego ducha na czas ciągnięcia
    const well = getCurrentWell();
    if (well && well.config[draggedCfgIndex]) {
        well.config[draggedCfgIndex].isPlaceholder = true;
        window.requestAnimationFrame(() => renderWellDiagram());
    }
};

window.handleCfgDragOver = function (e) {
    if (draggedCfgIndex === null && !window.currentDraggedPlaceholderId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tile = e.target.closest('.config-tile');

    if (draggedCfgIndex !== null) {
        if (tile) {
            tile.style.borderTop = '2px solid #6366f1';
            const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
            const well = getCurrentWell();
            if (well && draggedCfgIndex !== dropIndex) {
                const draggedItem = well.config.splice(draggedCfgIndex, 1)[0];
                well.config.splice(dropIndex, 0, draggedItem);
                draggedCfgIndex = dropIndex;
                window.requestAnimationFrame(() => renderWellDiagram());
            }
        }
    } else if (window.currentDraggedPlaceholderId) {
        if (tile) {
            const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
            const well = getCurrentWell();
            if (well) {
                // Find existing placeholder index
                const plIdx = well.config.findIndex((c) => c.isPlaceholder);

                if (plIdx !== dropIndex) {
                    const p = studnieProducts.find(
                        (x) => x.id === window.currentDraggedPlaceholderId
                    );
                    if (p) {
                        // Remove old placeholder
                        if (plIdx > -1) well.config.splice(plIdx, 1);

                        // Because splicing might shift indices, find new effective drop index
                        let targetIdx = dropIndex;
                        if (plIdx > -1 && plIdx < dropIndex) targetIdx -= 1; // It shifted down

                        well.config.splice(targetIdx, 0, {
                            productId: window.currentDraggedPlaceholderId,
                            quantity: 1,
                            height: p.height || 0,
                            isPlaceholder: true
                        });

                        window.requestAnimationFrame(() => {
                            renderWellConfig();
                            renderWellDiagram();
                        });
                    }
                }
            }
        }
    }
};

window.handleCfgDragLeave = function (e) {
    const tile = e.target.closest('.config-tile');
    if (tile && draggedCfgIndex !== null) {
        tile.style.borderTop = '';
    }
};

window.handleCfgDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const tile = e.target.closest('.config-tile');

    if (tile) {
        const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
        const well = getCurrentWell();
        if (!well) return;

        if (draggedCfgIndex !== null) {
            tile.style.borderTop = '';

            well.config.forEach((c) => (c.isPlaceholder = false));

            well.autoLocked = true;
            updateAutoLockUI();
            well.configSource = 'MANUAL';

            renderWellConfig();
            renderWellDiagram();
            updateSummary();
            updateHeightIndicator();
        } else if (window.currentDraggedPlaceholderId) {
            tile.style.borderTop = '';

            enforceSingularTopClosures(well, window.currentDraggedPlaceholderId);

            well.config = well.config.filter((c) => !c.isPlaceholder);

            const addedProductId = window.currentDraggedPlaceholderId;
            well.config.splice(dropIndex, 0, { productId: addedProductId, quantity: 1 });

            if (typeof window.injectPairIfReliefComponent === 'function') {
                window.injectPairIfReliefComponent(well, addedProductId, dropIndex);
            }

            window.currentDraggedPlaceholderId = null;

            well.autoLocked = true;
            updateAutoLockUI();
            well.configSource = 'MANUAL';

            sortWellConfigByOrder();
            syncGaskets(well);

            renderWellConfig();
            renderWellDiagram();
            updateSummary();
            updateHeightIndicator();
        }
    }
};

window.handleCfgDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('.config-tile').forEach((t) => (t.style.borderTop = ''));
    draggedCfgIndex = null;

    const well = getCurrentWell();
    if (well) {
        well.config.forEach((c) => (c.isPlaceholder = false));
        window.requestAnimationFrame(() => {
            renderWellConfig();
            renderWellDiagram();
            updateHeightIndicator();
        });
    }
};

/* ===== SORT WELL CONFIG by well-physical order (top → bottom) ===== */
function sortWellConfigByOrder() {
    const well = getCurrentWell();
    if (!well) return;
    const typeOrder = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2,
        plyta_najazdowa: 2,
        plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 5,
        krag: 5,
        krag_ot: 5,
        dennica: 6,
        kineta: 7
    };
    well.config.sort((a, b) => {
        const pa = studnieProducts.find((p) => p.id === a.productId);
        const pb = studnieProducts.find((p) => p.id === b.productId);
        const oa = pa ? (typeOrder[pa.componentType] ?? 99) : 99;
        const ob = pb ? (typeOrder[pb.componentType] ?? 99) : 99;
        if (oa !== ob) return oa - ob;

        // Elementy tego samego typu zachowują swoją względną kolejność strukturalną.
        // Wcześniej kręgi były sortowane według wysokości, co mieszało pozycje krag_ot.
        return 0;
    });
}

window.refreshZleceniaModalIfActive = function () {
    const zlModal = document.getElementById('zlecenia-modal');
    if (
        zlModal &&
        zlModal.classList.contains('active') &&
        typeof zleceniaElementsList !== 'undefined'
    ) {
        let oldWellIdx = -1;
        let oldElIdx = -1;
        
        if (typeof zleceniaSelectedIdx !== 'undefined' && zleceniaSelectedIdx >= 0) {
            const oldEl = zleceniaElementsList[zleceniaSelectedIdx];
            if (oldEl) {
                oldWellIdx = oldEl.wellIndex;
                oldElIdx = oldEl.elementIndex;
            }
        }

        // Zawsze zbuduj od nowa listę elementów (by the kręgi z the otworami się the uaktualniły)
        if (typeof buildZleceniaWellList === 'function') {
            buildZleceniaWellList();
            
            // Znajdź na nowo the index do okna the (priorytet elementIndex lub najbliższy w dół)
            if (oldWellIdx !== -1) {
                let fallbackIdx = -1;
                let foundExact = -1;
                for (let i = 0; i < zleceniaElementsList.length; i++) {
                    const el = zleceniaElementsList[i];
                    if (el.wellIndex === oldWellIdx) {
                        fallbackIdx = i;
                        if (el.elementIndex === oldElIdx) {
                            foundExact = i;
                            break;
                        }
                    }
                }
                zleceniaSelectedIdx = foundExact !== -1 ? foundExact : fallbackIdx;
            }
        }

        if (typeof populateZleceniaForm === 'function' && typeof zleceniaSelectedIdx !== 'undefined' && zleceniaSelectedIdx >= 0) {
            const el = zleceniaElementsList[zleceniaSelectedIdx];
            if (el) {
                // Aktualizujemy główny kontekst modala elementem z zaktualizowanej listy
                populateZleceniaForm(el);
            }
        }
    }
};

function renderWellPrzejscia(opts) {
    const _opts = opts || {};
    const container = document.getElementById(_opts.containerId || 'well-przejscia-tiles');
    const countEl = document.getElementById(_opts.countElId || 'przejscia-count');
    const filterElementIndex = _opts.filterElementIndex != null ? _opts.filterElementIndex : null;
    const well = getCurrentWell();

    if (!window.activateQuickEdit) {
        window.activateQuickEdit = function (element, index, field) {
            if (element.querySelector('input')) return; // Aboard if already in edit mode
            if (isWellLocked()) {
                showToast(WELL_LOCKED_MSG, 'error');
                return;
            }
            if (isOfferLocked()) {
                showToast(OFFER_LOCKED_MSG, 'error');
                return;
            }

            // Anuluj wszelkie oczekujące odświeżania po utracie fokusu (blur) przez inne pole
            if (window.__pendingPrzejsciaRefresh) {
                clearTimeout(window.__pendingPrzejsciaRefresh);
                window.__pendingPrzejsciaRefresh = null;

                // Natychmiast zapisz oczekujące zmiany!
                if (typeof window.__pendingPrzejsciaApply === 'function') {
                    window.__pendingPrzejsciaApply();
                    window.__pendingPrzejsciaApply = null;
                }

                // Do którego kontenera należy ten element?
                const containerId = element.closest('#zl-przejscia-list')
                    ? 'zl-przejscia-list'
                    : 'well-przejscia-tiles';

                renderWellPrzejscia();
                if (typeof window.refreshZleceniaModalIfActive === 'function')
                    window.refreshZleceniaModalIfActive();

                const newList = document.getElementById(containerId);
                if (newList) {
                    const stableId = element.getAttribute('data-qe-id');
                    const newEl = newList.querySelector(
                        `[data-qe-id="${stableId}"][data-qe-field="${field}"]`
                    );
                    if (newEl) element = newEl;
                }
            }

            const well = getCurrentWell();
            if (!well || !well.przejscia || !well.przejscia[index]) return;

            let val, step;
            if (field === 'angle') {
                val = well.przejscia[index].angle;
                step = '1';
            } else if (field === 'spadekKineta') {
                val = well.przejscia[index].spadekKineta || '';
                step = '1';
            } else if (field === 'spadekMufa') {
                val = well.przejscia[index].spadekMufa || '';
                step = '1';
            } else if (field === 'heightMm') {
                val = '';
                step = '1';
            } else if (field === 'doplata') {
                val = well.przejscia[index].doplata || '0';
                step = '1';
            } else {
                val = (well.przejscia[index].rzednaWlaczenia !== null && well.przejscia[index].rzednaWlaczenia !== undefined) ? well.przejscia[index].rzednaWlaczenia : '';
                step = '0.001';
            }
            const w = element.offsetWidth;

            element.innerHTML = `<input type="number" step="${step}" placeholder="${val}" style="width:${Math.max(70, w + 10)}px; background:#0f172a; color:#fff; border:1px solid #3b82f6; border-radius:4px; font-size:1.15rem; font-weight:800; text-align:center; padding:0; outline:none; box-shadow:0 0 5px rgba(59,130,246,0.5);" value="" onfocus="this.select()" onblur="window.saveQuickEdit(${index}, '${field}', this.value)" onkeydown="if(event.key==='Enter') this.blur();">`;
            const inp = element.querySelector('input');
            inp.focus();
        };

        window.__pendingPrzejsciaRefresh = null;
        window.saveQuickEdit = function (index, field, value) {
            if (isWellLocked()) {
                showToast(WELL_LOCKED_MSG, 'error');
                return;
            }
            if (isOfferLocked()) {
                showToast(OFFER_LOCKED_MSG, 'error');
                return;
            }
            const well = getCurrentWell();
            if (!well || !well.przejscia || !well.przejscia[index]) return;

            const applyChanges = () => {
                if (value.trim() === '') {
                    renderWellPrzejscia();
                    if (typeof window.refreshZleceniaModalIfActive === 'function') {
                        window.refreshZleceniaModalIfActive();
                    }
                    return;
                }

                let numVal = parseFloat(value);
                if (field === 'angle') {
                    if (isNaN(numVal)) numVal = 0;
                    if (numVal < 0) numVal = 0;
                    if (numVal > 360) numVal = 360;
                    well.przejscia[index].angle = numVal;
                    well.przejscia[index].angleExecution =
                        numVal === 0 || numVal === 360 ? 0 : 360 - numVal;
                    well.przejscia[index].angleGony = ((numVal * 400) / 360).toFixed(2);
                    
                    if (!well.przejscia[index].flowTypeManual) {
                        well.przejscia[index].flowType = (numVal === 0) ? 'wylot' : 'wlot';
                    }
                } else if (field === 'rzednaWlaczenia') {
                    if (isNaN(numVal)) {
                        well.przejscia[index].rzednaWlaczenia = '';
                    } else {
                        const rzWlazu = parseFloat(well.rzednaWlazu);
                        const rzDna = parseFloat(well.rzednaDna);
                        if (!isNaN(rzDna) && numVal < rzDna) {
                            showToast('Rzędna nie może być niższa niż rzędna dna!', 'error');
                            numVal = rzDna;
                        }
                        if (!isNaN(rzWlazu) && numVal > rzWlazu) {
                            showToast('Rzędna nie może być wyższa niż rzędna włazu!', 'error');
                            numVal = rzWlazu;
                        }
                        well.przejscia[index].rzednaWlaczenia = parseFloat(numVal).toFixed(3);
                    }
                } else if (field === 'spadekKineta') {
                    well.przejscia[index].spadekKineta = isNaN(numVal) ? null : Math.round(numVal);
                } else if (field === 'spadekMufa') {
                    well.przejscia[index].spadekMufa = isNaN(numVal) ? null : Math.round(numVal);
                } else if (field === 'heightMm') {
                    const rzDnaQ = parseFloat(well.rzednaDna) || 0;
                    const cfgMap = buildConfigMap(well, (id) =>
                        studnieProducts.find((p) => p.id === id)
                    );
                    let curRz = parseFloat(well.przejscia[index].rzednaWlaczenia);
                    if (isNaN(curRz)) curRz = rzDnaQ;
                    const curMm = (curRz - rzDnaQ) * 1000;
                    const { entry: assigned } = findAssignedElement(curMm, cfgMap);
                    const elStart = assigned ? assigned.start : 0;
                    if (isNaN(numVal)) numVal = 0;
                    if (numVal < 0) numVal = 0;
                    const newRzedna = rzDnaQ + (elStart + numVal) / 1000;
                    well.przejscia[index].rzednaWlaczenia = parseFloat(newRzedna).toFixed(3);
                } else if (field === 'doplata') {
                    well.przejscia[index].doplata = isNaN(numVal) ? 0 : parseFloat(numVal);
                }

                renderWellPrzejscia();
                renderWellDiagram();
                updateSummary();
                if (typeof window.refreshZleceniaModalIfActive === 'function') {
                    window.refreshZleceniaModalIfActive();
                }
            };

            // Ujmij krótkie opóźnienie do odświeżenia, aby pozwolić na wcześniejsze wywołanie kliknięcia na następnym elemencie
            if (window.__pendingPrzejsciaRefresh) {
                clearTimeout(window.__pendingPrzejsciaRefresh);
                if (typeof window.__pendingPrzejsciaApply === 'function') {
                    window.__pendingPrzejsciaApply();
                }
            }
            window.__pendingPrzejsciaApply = applyChanges;
            window.__pendingPrzejsciaRefresh = setTimeout(() => {
                applyChanges();
                window.__pendingPrzejsciaRefresh = null;
                window.__pendingPrzejsciaApply = null;
            }, 100);
        };
    }

    if (!container) return;

    if (!well || !well.przejscia || well.przejscia.length === 0) {
        container.innerHTML =
            '<div style="text-align:center; padding:1.2rem; color:var(--text-muted); font-size:0.75rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak zdefiniowanych przejść.<br>Dodaj przejście z formularza powyżej.</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    // Jeśli ustawiono filterElementIndex, sprawdź, czy DOWOLNE przejście należy do elementu
    if (filterElementIndex != null) {
        const rzDnaCheck = parseFloat(well.rzednaDna) || 0;
        const findProdCheck = (id) => studnieProducts.find((pr) => pr.id === id);
        const cfgMapCheck = buildConfigMap(well, findProdCheck);
        const hasAny = well.przejscia.some((item) => {
            let pel = parseFloat(item.rzednaWlaczenia);
            if (isNaN(pel)) pel = rzDnaCheck;
            const mm = (pel - rzDnaCheck) * 1000;
            const { assignedIndex } = findAssignedElement(mm, cfgMapCheck);
            return assignedIndex === filterElementIndex;
        });
        if (!hasAny) {
            container.innerHTML =
                '<div style="text-align:center; padding:1.2rem; color:var(--text-muted); font-size:0.75rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak przejść szczelnych<br>w tym elemencie.</div>';
            if (countEl) countEl.textContent = '(0)';
            return;
        }
    }

    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProduct = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProduct, true);

    // Automatyczne sortowanie według poziomu elementu (assignedIndex), a następnie według kąta
    const sorted = well.przejscia
        .map((item) => {
            let pel = parseFloat(item.rzednaWlaczenia);
            if (isNaN(pel)) pel = rzDna;
            const mmFromBottom = (pel - rzDna) * 1000;
            const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
            return { item, assignedIndex };
        })
        .sort((a, b) => {
            if (a.assignedIndex !== b.assignedIndex) {
                return b.assignedIndex - a.assignedIndex;
            }
            return (a.item.angle || 0) - (b.item.angle || 0);
        });

    // Przebuduj tablicę przejść w posortowanej kolejności
    well.przejscia = sorted.map((s) => s.item);

    let totalPrice = 0;
    let html = '<div style="display:grid; grid-template-columns:1fr; gap:0.5rem;">';

    let prevAssignedIndex = -999;
    let filteredCount = 0;

    // Nadaj displayIndex przejściom, które go nie mają (kompatybilność wsteczna)
    ensureDisplayIndices(well.przejscia);

    well.przejscia.forEach((item, index) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;

        const { assignedIndex, entry: assignedEntry } = findAssignedElement(
            mmFromBottom,
            configMap
        );

        // Skip transitions not assigned to this element when filtering
        if (filterElementIndex != null && assignedIndex !== filterElementIndex) return;
        filteredCount++;

        const assignedName = assignedEntry
            ? assignedEntry.name || 'Brak dopasowania'
            : 'Brak dopasowania';
        const assignedBg = assignedEntry
            ? assignedEntry.bg || 'rgba(0,0,0,0.25)'
            : 'rgba(0,0,0,0.25)';

        if (filterElementIndex == null && assignedIndex !== prevAssignedIndex) {
            const rawRGB = assignedBg.length > 7 ? assignedBg.substring(0, 7) : assignedBg;
            if (index > 0) html += `<div style="height:0.5rem;"></div>`;
            html += `<div style="display:flex; align-items:center; gap:0.4rem; padding:0.3rem 0.5rem; margin-top:0.4rem; margin-bottom:0.4rem; background:linear-gradient(90deg, ${assignedBg} 0%, rgba(30,41,59,0.8) 100%); border-left:3px solid ${rawRGB}; border-radius:6px; color:var(--text-muted); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                <span style="font-size:0.9rem; filter:grayscale(0.4);"><i data-lucide="map-pin"></i></span> 
                <span>Dotyczy:</span> 
                <span style="color:#e2e8f0; font-size:0.75rem; padding-left:0.2rem;">${assignedName}</span>
            </div>`;
            prevAssignedIndex = assignedIndex;
        }

        const p = findProduct(item.productId);
        const price = p ? p.price : 0;
        totalPrice += price;

        const heightMm = computeHeightFromElement(mmFromBottom, configMap);

        // Edit mode for this tile
        if (editPrzejscieIdx === index) {
            const typeName = p ? p.category : 'Nieznane';
            const przejsciaProducts = studnieProducts.filter(
                (pr) => pr.componentType === 'przejscie' && pr.active !== 0
            );
            const allTypes = [...new Set(przejsciaProducts.map((pr) => pr.category))].sort();

            // Sync fallback to what was currently rendering if state is empty
            if (!editPrzejscieState.type) {
                editPrzejscieState.type = typeName;
                editPrzejscieState.dnId = item.productId;
                editPrzejscieState.rzedna = item.rzednaWlaczenia || '';
                editPrzejscieState.angle = item.angle || 0;

                editPrzejscieState.spadekKineta = item.spadekKineta || '';
                editPrzejscieState.spadekMufa = item.spadekMufa || '';
            }

            const currentTypeDNs = przejsciaProducts
                .filter((pr) => pr.category === editPrzejscieState.type || pr.id === item.productId)
                .sort((a, b) => a.dn - b.dn);
            const execAngle =
                editPrzejscieState.angle === 0 || editPrzejscieState.angle === 360
                    ? 0
                    : 360 - editPrzejscieState.angle;
            const gons = ((editPrzejscieState.angle * 400) / 360).toFixed(2);

            html += `<div style="background:linear-gradient(90deg, rgba(30,58,138,0.8) 0%, rgba(30,41,59,0.95) 100%); border:1px solid rgba(96,165,250,0.5); border-left:4px solid #3b82f6; border-radius:8px; padding:0.6rem; position:relative; box-shadow:0 4px 12px rgba(96,165,250,0.15); margin-bottom:0.3rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <div style="display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.2); padding:0.2rem 0.4rem; border-radius:4px;">
                    <span style="font-size:0.65rem; color:var(--text-primary); font-weight:700;">${index + 1}</span>
                  </div>
                  <span style="font-size:0.75rem; font-weight:700; color:#60a5fa;">Edycja wariantu</span>
                </div>
                <button onclick="cancelPrzejscieEdit()" title="Krzyżyk" style="background:none; border:none; cursor:pointer; font-size:0.8rem; color:var(--text-muted);"><i data-lucide="x"></i></button>
              </div>
              
              <div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:0.2rem;">Kategoria przejścia</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.5rem; max-height:80px; overflow-y:auto; scrollbar-width:thin;">
                ${allTypes
                    .map((t) => {
                        const isActive = t === editPrzejscieState.type;
                        return `<div onclick="window.editInlineSetType('${t}')" style="padding:0.25rem 0.45rem; font-size:0.65rem; font-weight:600; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.08)'}; color:${isActive ? '#93c5fd' : 'var(--text-primary)'}; transition:all 0.15s;">${t}</div>`;
                    })
                    .join('')}
              </div>

              <div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:0.2rem;">Średnica (DN)</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.6rem;">
                ${currentTypeDNs
                    .map((pr) => {
                        const isActive = pr.id === editPrzejscieState.dnId;
                        const dnLbl =
                            typeof pr.dn === 'string' && pr.dn.includes('/') ? pr.dn : 'DN' + pr.dn;
                        return `<div onclick="window.editInlineSetDN('${pr.id}')" style="padding:0.25rem 0.45rem; font-size:0.65rem; font-weight:700; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.08)'}; color:${isActive ? '#4ade80' : 'var(--text-primary)'}; transition:all 0.15s;">${dnLbl}</div>`;
                    })
                    .join('')}
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Rzędna [m]</label>
                  <input type="number" class="form-input" id="edit-rzedna-${index}" step="0.001" value="${editPrzejscieState.rzedna}" placeholder="142.500" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Kąt [°]</label>
                  <input type="number" class="form-input" id="edit-angle-${index}" value="${editPrzejscieState.angle}" min="0" max="360" oninput="editUpdateAngles(${index}); window.syncEditState()" style="padding:0.35rem; font-size:0.75rem; color:#818cf8; font-weight:800; text-align:center;">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spadek w kinecie [mm]</label>
                  <input type="number" class="form-input" id="edit-spadek-kineta-${index}" step="1" value="${editPrzejscieState.spadekKineta}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spadek w mufie [mm]</label>
                  <input type="number" class="form-input" id="edit-spadek-mufa-${index}" step="1" value="${editPrzejscieState.spadekMufa}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
              </div>
              


              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding-top:0.4rem; border-top:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; gap:0.8rem; font-size:0.65rem;">
                  <span class="ui-text-mute">Wyk: <strong id="edit-exec-${index}" style="color:var(--text-primary);">${execAngle}°</strong></span>
                  <span class="ui-text-mute">Gony: <strong id="edit-gony-${index}" style="color:var(--success);">${gons}<sup>g</sup></strong></span>
                </div>
                <div style="display:flex; gap:0.4rem;">
                  <button onclick="cancelPrzejscieEdit()" style="padding:0.3rem 0.6rem; font-size:0.7rem; border-radius:5px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:var(--text-primary); cursor:pointer;">Anuluj</button>
                  <button onclick="savePrzejscieEdit(${index})" class="btn btn-primary" style="padding:0.3rem 0.6rem; font-size:0.7rem;"><i data-lucide="save"></i> Zapisz</button>
                </div>
              </div>
            </div>`;
            return;
        }

        // Use the shared transition tile renderer
        html += renderTransitionTileHTML(item, index, p, {
            heightMm,
            showEditBtn: true,
            showDeleteBtn: true,
            showPrice: true,
            enableDragDrop: true,
            assignedCfgIndex: assignedIndex
        });
    });

    html += '</div>';

    // Pasek podsumowania
    const countLabel =
        filterElementIndex != null
            ? `Przejścia tego elementu (${filteredCount} szt.)`
            : `Suma wszystkich przejść (${well.przejscia.length} szt.)`;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding:0.4rem 0.6rem; background:rgba(99,102,241,0.08); border-radius:6px; border:1px solid rgba(99,102,241,0.2);">
      <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${countLabel}</span>
      <span style="font-size:0.85rem; font-weight:800; color:var(--success);">${fmtInt(totalPrice)} PLN</span>
    </div>`;

    container.innerHTML = html;
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
    if (countEl)
        countEl.textContent = `(${filterElementIndex != null ? filteredCount : well.przejscia.length})`;
}

function movePrzejscie(index, direction) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.przejscia.length) return;
    const temp = well.przejscia[index];
    well.przejscia[index] = well.przejscia[newIndex];
    well.przejscia[newIndex] = temp;
    renderWellPrzejscia();
    updateSummary();
    window.refreshZleceniaModalIfActive();
}

/* ===== PRZECIĄGNIJ I UPUŚĆ DLA PRZEJŚĆ ===== */
let draggedPrzIndex = null;

window.handlePrzDragStart = function (e) {
    draggedPrzIndex = parseInt(e.currentTarget.getAttribute('data-prz-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
};

window.handlePrzDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tile = e.target.closest('[data-prz-idx]');
    if (tile) {
        tile.style.borderTop = '2px solid #3b82f6';
    }
};

window.handlePrzDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const tile = e.target.closest('[data-prz-idx]');
    if (tile && draggedPrzIndex !== null) {
        tile.style.borderTop = '';
        const dropIndex = parseInt(tile.getAttribute('data-prz-idx'));
        if (draggedPrzIndex === dropIndex) return;

        const well = getCurrentWell();
        if (!well) return;

        // Wyodrębnij przeciągany element
        const draggedItem = well.przejscia.splice(draggedPrzIndex, 1)[0];

        // Wstaw w nowej pozycji
        well.przejscia.splice(dropIndex, 0, draggedItem);

        renderWellPrzejscia();
        updateSummary();
    }
};

window.handlePrzDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('[data-prz-idx]').forEach((t) => (t.style.borderTop = ''));
    draggedPrzIndex = null;
};

function syncEditState() {
    if (editPrzejscieIdx < 0) return;
    const rzednaEl = document.getElementById('edit-rzedna-' + editPrzejscieIdx);
    const angleEl = document.getElementById('edit-angle-' + editPrzejscieIdx);
    if (rzednaEl) editPrzejscieState.rzedna = rzednaEl.value;
    if (angleEl) editPrzejscieState.angle = parseFloat(angleEl.value) || 0;
    const spKEl = document.getElementById('edit-spadek-kineta-' + editPrzejscieIdx);
    const spMEl = document.getElementById('edit-spadek-mufa-' + editPrzejscieIdx);
    if (spKEl) editPrzejscieState.spadekKineta = spKEl.value;
    if (spMEl) editPrzejscieState.spadekMufa = spMEl.value;
}

window.editInlineSetType = function (type) {
    syncEditState();
    editPrzejscieState.type = type;
    const przejsciaProducts = studnieProducts.filter((pr) => pr.componentType === 'przejscie' && pr.active !== 0);
    const dns = przejsciaProducts.filter((p) => p.category === type).sort((a, b) => a.dn - b.dn);
    if (dns.length > 0) editPrzejscieState.dnId = dns[0].id;
    else editPrzejscieState.dnId = null;
    renderWellPrzejscia();
};

window.editInlineSetDN = function (dnId) {
    syncEditState();
    editPrzejscieState.dnId = dnId;
    renderWellPrzejscia();
};

function editPrzejscie(index) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    const item = well.przejscia[index];
    const p = studnieProducts.find((pr) => pr.id === item.productId);

    editPrzejscieIdx = index;
    editPrzejscieState = {
        type: p ? p.category : null,
        dnId: item.productId,
        rzedna: item.rzednaWlaczenia,
        angle: item.angle,

        spadekKineta: item.spadekKineta || '',
        spadekMufa: item.spadekMufa || ''
    };
    renderWellPrzejscia();
}

let editPrzejscieIdx = -1;
let editPrzejscieState = {
    type: null,
    dnId: null,
    rzedna: '',
    angle: 0,
    spadekKineta: '',
    spadekMufa: ''
};

function savePrzejscieEdit(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    syncEditState(); // zapisz wartości z DOM do stanu na wszelki wypadek

    if (!editPrzejscieState.dnId) {
        showToast('Wybierz typ i średnicę przejścia', 'error');
        return;
    }

    const newProductId = editPrzejscieState.dnId;
    const rzedna = editPrzejscieState.rzedna;
    const angle = editPrzejscieState.angle || 0;

    const spadekKineta = editPrzejscieState.spadekKineta;
    const spadekMufa = editPrzejscieState.spadekMufa;

    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    well.przejscia[index] = {
        productId: newProductId,
        rzednaWlaczenia: (rzedna !== null && rzedna !== undefined && rzedna !== '') ? parseFloat(rzedna).toFixed(3) : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,

        spadekKineta: spadekKineta ? Math.round(parseFloat(spadekKineta)) : null,
        spadekMufa: spadekMufa ? Math.round(parseFloat(spadekMufa)) : null
    };

    editPrzejscieIdx = -1;
    refreshAll();
    autoSelectComponents(true);
    showToast('Zapisano zmiany przejścia', 'success');
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
}

function cancelPrzejscieEdit() {
    editPrzejscieIdx = -1;
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
}

function editUpdateAngles(index) {
    const el = document.getElementById('edit-angle-' + index);
    if (!el) return;
    const angle = parseFloat(el.value) || 0;
    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);
    const execEl = document.getElementById('edit-exec-' + index);
    const gonyEl = document.getElementById('edit-gony-' + index);
    if (execEl) execEl.textContent = exec + '°';
    if (gonyEl) gonyEl.innerHTML = gons + '<sup>g</sup>';
}

function editChangePrzejscieType(index) {
    const typeSelect = document.getElementById('edit-type-' + index);
    const dnSelect = document.getElementById('edit-dn-' + index);
    if (!typeSelect || !dnSelect) return;
    const newType = typeSelect.value;
    const przejsciaProducts = studnieProducts.filter(
        (pr) => pr.componentType === 'przejscie' && pr.active !== 0 && pr.category === newType
    );
    dnSelect.innerHTML = przejsciaProducts
        .map((pr) => {
            const dnLbl = typeof pr.dn === 'string' && pr.dn.includes('/') ? pr.dn : 'DN' + pr.dn;
            return `<option value="${pr.id}">${dnLbl} — ${fmtInt(pr.price)} PLN</option>`;
        })
        .join('');
}

window.editPrzejscie = editPrzejscie;
window.savePrzejscieEdit = savePrzejscieEdit;
window.cancelPrzejscieEdit = cancelPrzejscieEdit;
window.editUpdateAngles = editUpdateAngles;
window.editChangePrzejscieType = editChangePrzejscieType;

function toggleCard(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (!content || !icon) return;
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.innerHTML = '<i data-lucide="chevron-up"></i>';
    } else {
        content.style.display = 'none';
        icon.innerHTML = '<i data-lucide="chevron-down"></i>';
    }
}

function switchBuilderTab(tab) {
    document.getElementById('btab-concrete').classList.toggle('active', tab === 'concrete');
    document.getElementById('btab-transitions').classList.toggle('active', tab === 'transitions');
    document.getElementById('bcontent-concrete').style.display =
        tab === 'concrete' ? 'block' : 'none';
    document.getElementById('bcontent-transitions').style.display =
        tab === 'transitions' ? 'block' : 'none';

    if (tab === 'transitions') {
        renderInlinePrzejsciaApp();
        renderWellPrzejscia();
    }
}

let inlinePrzejsciaState = { type: null, dnId: null };
let visiblePrzejsciaTypes = new Set(); // By default, all types are hidden

/* ===== POPUP WIDOCZNOŚCI PRZEJŚĆ ===== */
function openPrzejsciaVisibilityPopup(containerId) {
    const przejsciaProducts = studnieProducts.filter((p) => p.componentType === 'przejscie' && p.active !== 0);
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();

    // Utwórz nakładkę
    let overlay = document.getElementById('przejscia-visibility-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'przejscia-visibility-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,0.6); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        animation: fadeInOverlay 0.2s ease;
    `;
    overlay.onclick = (e) => {
        if (e.target === overlay) closePrzejsciaVisibilityPopup(containerId);
    };

    const visibleCount = allTypes.filter((t) => visiblePrzejsciaTypes.has(t)).length;

    let tilesHtml = allTypes
        .map((t) => {
            const isVisible = visiblePrzejsciaTypes.has(t);
            return `
            <div class="przejscia-vis-tile ${isVisible ? 'visible' : 'hidden-type'}" 
                 onclick="togglePrzejsciaTypeVisibility('${t.replace(/'/g, "\\\\'")}')"
                 title="${t}">
                <div class="przejscia-vis-tile-name">${t}</div>
            </div>`;
        })
        .join('');

    overlay.innerHTML = `
        <div class="przejscia-vis-popup">
            <div class="przejscia-vis-header">
                <div>
                    <h3 style="margin:0; font-size:0.85rem; font-weight:800; color:var(--text-primary);">Pokaż / Ukryj przejścia</h3>
                    <div class="przejscia-vis-counter" style="font-size:0.6rem; color:var(--text-muted); margin-top:0.1rem;">Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong style="color:var(--success);">${visibleCount}</strong> / ${allTypes.length}</div>
                </div>
                <button onclick="closePrzejsciaVisibilityPopup('${containerId || ''}')" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem 0.4rem; border-radius:4px; transition:all 0.15s;" onmouseenter="this.style.color='#f87171'" onmouseleave="this.style.color='var(--text-muted)'"><i data-lucide="x"></i></button>
            </div>
            <div class="przejscia-vis-actions">
                <button class="przejscia-vis-action-btn" onclick="setPrzejsciaVisibilityAll(true)">Pokaż wszystkie</button>
                <button class="przejscia-vis-action-btn" onclick="setPrzejsciaVisibilityAll(false)">Ukryj wszystkie</button>
            </div>
            <div class="przejscia-vis-grid">
                ${tilesHtml}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Zmierz najdłuższą nazwę kafelka i ustaw jednolitą szerokość kolumny
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '700 0.85rem Inter, sans-serif';
    const maxTextWidth = Math.max(...allTypes.map((n) => ctx.measureText(n).width));
    const tileMinW = Math.ceil(maxTextWidth + 24); // +24 dla marginesu wewnętrznego
    const gridEl = overlay.querySelector('.przejscia-vis-grid');
    if (gridEl) gridEl.style.setProperty('--tile-min-w', tileMinW + 'px');
}

function closePrzejsciaVisibilityPopup(containerId) {
    const overlay = document.getElementById('przejscia-visibility-overlay');
    if (overlay) overlay.remove();
    renderInlinePrzejsciaApp(containerId);
}

function togglePrzejsciaTypeVisibility(type) {
    if (visiblePrzejsciaTypes.has(type)) {
        visiblePrzejsciaTypes.delete(type);
    } else {
        visiblePrzejsciaTypes.add(type);
    }
    refreshPrzejsciaVisibilityTiles();
}

function setPrzejsciaVisibilityAll(visible) {
    const przejsciaProducts = studnieProducts.filter((p) => p.componentType === 'przejscie' && p.active !== 0);
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))];
    if (visible) {
        allTypes.forEach((t) => visiblePrzejsciaTypes.add(t));
    } else {
        visiblePrzejsciaTypes.clear();
    }
    refreshPrzejsciaVisibilityTiles();
}

function refreshPrzejsciaVisibilityTiles() {
    const overlay = document.getElementById('przejscia-visibility-overlay');
    if (!overlay) return;

    const przejsciaProducts = studnieProducts.filter((p) => p.componentType === 'przejscie' && p.active !== 0);
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();
    const visibleCount = allTypes.filter((t) => visiblePrzejsciaTypes.has(t)).length;

    // Update counter text
    const counterEl = overlay.querySelector('.przejscia-vis-counter');
    if (counterEl)
        counterEl.innerHTML = `Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong style="color:var(--success);">${visibleCount}</strong> / ${allTypes.length}`;

    // Status server ping
    checkBackendStatus();

    // Update each tile in-place
    const tiles = overlay.querySelectorAll('.przejscia-vis-tile');
    tiles.forEach((tile) => {
        const type = tile.getAttribute('title');
        const isVisible = visiblePrzejsciaTypes.has(type);
        tile.classList.toggle('visible', isVisible);
        tile.classList.toggle('hidden-type', !isVisible);
    });
}

window.openPrzejsciaVisibilityPopup = openPrzejsciaVisibilityPopup;
window.closePrzejsciaVisibilityPopup = closePrzejsciaVisibilityPopup;
window.togglePrzejsciaTypeVisibility = togglePrzejsciaTypeVisibility;
window.setPrzejsciaVisibilityAll = setPrzejsciaVisibilityAll;

function renderInlinePrzejsciaApp(containerId) {
    const well = getCurrentWell();
    const przejsciaProducts = studnieProducts.filter((p) => p.componentType === 'przejscie' && p.active !== 0);
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();
    // Filtruj tylko do widocznych typów
    const types = allTypes.filter((t) => visiblePrzejsciaTypes.has(t));

    const container = document.getElementById(containerId || 'inline-przejscia-app');
    if (!container) return;

    // Zresetuj typ, jeśli został ukryty
    if (inlinePrzejsciaState.type && !types.includes(inlinePrzejsciaState.type)) {
        inlinePrzejsciaState.type = types[0] || null;
        inlinePrzejsciaState.dnId = null;
    }
    if (!inlinePrzejsciaState.type) {
        inlinePrzejsciaState.type = types[0] || null;
    }

    const hiddenCount = allTypes.length - types.length;
    const visibilityBtnLabel =
        hiddenCount > 0 ? `<i data-lucide="eye"></i>️ Pokaż/Ukryj (${hiddenCount} ukrytych)` : '<i data-lucide="eye"></i>️ Pokaż/Ukryj';

    // Jeśli żadne typy nie są widoczne, pokaż stan pusty
    if (types.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:1.5rem; border:1px dashed rgba(99,102,241,0.2); border-radius:10px; background:rgba(15,23,42,0.3); margin:0.4rem 0;">
                <div style="font-size:1.5rem; margin-bottom:0.5rem;"><i data-lucide="ban"></i></div>
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:0.3rem;">Wszystkie przejścia są ukryte</div>
                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:0.8rem;">Włącz widoczność wybranych typów przejść, aby móc je dodawać.</div>
                <button class="btn btn-primary btn-sm" onclick="openPrzejsciaVisibilityPopup('${containerId || ''}')" style="padding:0.35rem 0.8rem; font-size:0.7rem;">
                    <i data-lucide="eye"></i>️ Pokaż przejścia (${allTypes.length} dostępnych)
                </button>
            </div>
        `;
        return;
    }

    const dnList = inlinePrzejsciaState.type
        ? przejsciaProducts
              .filter((p) => p.category === inlinePrzejsciaState.type)
              .sort((a, b) => a.dn - b.dn)
        : [];
    const selectedProduct = inlinePrzejsciaState.dnId
        ? studnieProducts.find((p) => p.id === inlinePrzejsciaState.dnId)
        : null;

    container.innerHTML = `
        <!-- Rodzaj kafelków - przewijalna siatka -->
        <div style="padding:0.4rem 0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <div style="font-size:0.58rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Rodzaj materiału</div>
                <button onclick="openPrzejsciaVisibilityPopup('${containerId || ''}')" style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); color:#a5b4fc; font-size:0.58rem; font-weight:600; padding:0.15rem 0.5rem; border-radius:5px; cursor:pointer; transition:all 0.15s;" onmouseenter="this.style.background='rgba(99,102,241,0.2)';this.style.borderColor='rgba(99,102,241,0.4)'" onmouseleave="this.style.background='rgba(99,102,241,0.1)';this.style.borderColor='rgba(99,102,241,0.25)'">${visibilityBtnLabel}</button>
            </div>
            <div id="przejscia-type-scroll" style="max-height:140px; overflow-y:auto; padding-right:0.2rem; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.4) transparent;">
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:11px;">
                    ${types
                        .map((t) => {
                            const isActive = t === inlinePrzejsciaState.type;
                            return `
                        <div onclick="window.inlineSetType('${t}', '${containerId || ''}')" 
                             style="padding:0.2rem 0.4rem; border-radius:6px; cursor:pointer; transition:all 0.15s ease; height:44px; display:flex; align-items:center; justify-content:center;
                                    background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                                    border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                                    ${isActive ? 'box-shadow:0 0 8px rgba(99,102,241,0.15);' : ''}"
                             onmouseenter="if(!${isActive})this.style.background='rgba(99,102,241,0.1)';this.style.borderColor='rgba(99,102,241,0.3)'"
                             onmouseleave="if(!${isActive})this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.06)'"
                             title="${t}">
                            <div style="font-size:${t.length > 20 ? '9px' : t.length > 14 ? '11px' : '14px'}; font-weight:700; color:${isActive ? '#a78bfa' : 'var(--text-primary)'}; text-align:center; line-height:1.1; word-break:break-word;">${t}</div>
                        </div>`;
                        })
                        .join('')}
                </div>
            </div>
        </div>

        <!-- Wybór DN -->
        <div style="padding:0.3rem 0;">
            <div style="font-size:0.58rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.3rem; letter-spacing:0.5px; font-weight:700;">Średnica (DN) — ${inlinePrzejsciaState.type || ''}</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:11px;">
                ${dnList
                    .map((p) => {
                        const isActive = p.id === inlinePrzejsciaState.dnId;
                        const dnLabel =
                            typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                        return `
                    <div class="fs-dn-tile ${isActive ? 'active' : ''}" 
                         style="padding:0.2rem 0.4rem; text-align:center; cursor:pointer; border-radius:6px; height:44px; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;
                                background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                                border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                                ${isActive ? 'box-shadow:0 0 10px rgba(99,102,241,0.3);' : ''}"
                         onmouseenter="if(!${isActive}){this.style.background='rgba(99,102,241,0.1)';this.style.borderColor='rgba(99,102,241,0.3)'}"
                         onmouseleave="if(!${isActive}){this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.06)'}"
                         onclick="window.inlineSetDN('${p.id}', '${containerId || ''}')">
                        <div style="font-size:${dnLabel.length > 18 ? '9px' : dnLabel.length > 13 ? '11px' : '15px'}; font-weight:800; color:${isActive ? '#a78bfa' : 'var(--text-primary)'}; text-align:center; letter-spacing:0.5px;">${dnLabel}</div>
                    </div>
                `;
                    })
                    .join('')}
            </div>
        </div>

        ${
            selectedProduct
                ? `
        <div style="background:linear-gradient(90deg, rgba(30,58,138,0.3) 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:5px solid rgba(59,130,246,0.6); padding:0.6rem; border-radius:10px; margin-top:0.3rem; position:relative; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span style="font-size:1.0rem; font-weight:800; color:#fff;"><i data-lucide="link"></i> ${selectedProduct.category} ${typeof selectedProduct.dn === 'string' && selectedProduct.dn.includes('/') ? selectedProduct.dn : 'DN' + selectedProduct.dn}</span>
                <span style="font-size:0.95rem; color:var(--success); font-weight:800; font-family:'Inter'">${fmtInt(selectedProduct.price)} <span style="font-size:0.6rem;">PLN</span></span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:0.4rem; align-items:end;">
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Rzędna [m]</div>
                    <input type="number" class="form-input" id="inl-rzedna-${containerId || 'main'}" step="0.001" 
                           onfocus="this.select()"
                           value="${(well && (well.rzednaDna !== null && well.rzednaDna !== undefined)) ? parseFloat(well.rzednaDna).toFixed(3) : ''}" 
                           placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Kąt [°]</div>
                    <input type="number" class="form-input" id="inl-angle-${containerId || 'main'}" value="0" min="0" max="360" onfocus="this.select()" oninput="window.inlineUpdateAngles('${containerId || 'main'}')" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:800; text-align:center; color:#818cf8; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Spadek w kinecie [mm]</div>
                    <input type="number" class="form-input" id="inl-spadek-kineta-${containerId || 'main'}" step="1" onfocus="this.select()" placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>
                <div class="ui-center-min">
                    <div class="ui-text-muted-sm">Spadek w mufie [mm]</div>
                    <input type="number" class="form-input" id="inl-spadek-mufa-${containerId || 'main'}" step="1" onfocus="this.select()" placeholder="—" style="height:26px; padding:0 0.3rem; font-size:0.9rem; font-weight:700; text-align:center; color:var(--text-primary); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px;">
                </div>

                <div style="text-align:center;">
                    <div class="ui-text-muted-sm">Kąt wyk.</div>
                    <div style="font-size:1.0rem; font-weight:700; color:#38bdf8; padding:0.15rem 0;" id="inl-exec-${containerId || 'main'}">360°</div>
                </div>
                <div style="text-align:center;">
                    <div class="ui-text-muted-sm">Gony</div>
                    <div style="font-size:1.0rem; font-weight:700; color:#2dd4bf; padding:0.15rem 0;" id="inl-gony-${containerId || 'main'}">0.00<sup>g</sup></div>
                </div>
                <div style="display:flex; align-items:flex-end; justify-content:flex-end;">
                    <button class="btn btn-primary" onclick="window.inlineFinish('${containerId || 'main'}', '${containerId || ''}')" style="height:26px; width:100%; justify-content:center; font-size:0.7rem; padding:0;"><i data-lucide="plus"></i> Dodaj</button>
                </div>
            </div>
        </div>
        `
                : `
        <div style="text-align:center; padding:0.8rem; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.06); border-radius:8px; font-size:0.7rem; margin-top:0.3rem;">
            Wybierz średnicę (DN) aby skonfigurować przejście
        </div>
        `
        }
    `;

    if (inlinePrzejsciaState.dnId) window.inlineUpdateAngles(containerId || 'main');
}

window.inlineSetType = (t, containerId = '') => {
    inlinePrzejsciaState.type = t;
    inlinePrzejsciaState.dnId = null;
    renderInlinePrzejsciaApp(containerId);
};
window.inlineSetDN = (id, containerId = '') => {
    inlinePrzejsciaState.dnId = id;
    renderInlinePrzejsciaApp(containerId);
};

window.inlineUpdateAngles = (contextId = 'main') => {
    const el = document.getElementById(`inl-angle-${contextId}`);
    if (!el) return;
    const angle = parseFloat(el.value) || 0;
    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    const execEl = document.getElementById(`inl-exec-${contextId}`);
    const gonyEl = document.getElementById(`inl-gony-${contextId}`);
    if (execEl) execEl.textContent = exec + '°';
    if (gonyEl) gonyEl.innerHTML = gons + '<sup>g</sup>';
};

window.inlineFinish = (contextId = 'main', containerId = '') => {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const id = inlinePrzejsciaState.dnId;
    if (!id) return;

    const rzednaEl = document.getElementById(`inl-rzedna-${contextId}`);
    const angleEl = document.getElementById(`inl-angle-${contextId}`);

    const spadekKinetaEl = document.getElementById(`inl-spadek-kineta-${contextId}`);
    const spadekMufaEl = document.getElementById(`inl-spadek-mufa-${contextId}`);

    const rzedna = rzednaEl ? rzednaEl.value : '';
    const angle = angleEl ? parseFloat(angleEl.value) || 0 : 0;

    const spadekKineta = spadekKinetaEl ? spadekKinetaEl.value.trim() : '';
    const spadekMufa = spadekMufaEl ? spadekMufaEl.value.trim() : '';

    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    if (!well.przejscia) well.przejscia = [];

    const isFirst = well.przejscia ? well.przejscia.length === 0 : true;
    const flowType = isFirst && angle === 0 ? 'wylot' : 'wlot';

    well.przejscia.push({
        id: 'prz-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        productId: id,
        rzednaWlaczenia: (rzedna !== null && rzedna !== undefined && rzedna !== '') ? parseFloat(rzedna).toFixed(3) : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,

        flowType: flowType,
        spadekKineta: spadekKineta ? Math.round(parseFloat(spadekKineta)) : null,
        spadekMufa: spadekMufa ? Math.round(parseFloat(spadekMufa)) : null
    });

    refreshAll();
    autoSelectComponents(true);
    showToast('Dodano przejście szczelne', 'success');
    renderInlinePrzejsciaApp(containerId);
    window.refreshZleceniaModalIfActive();
};

window.openFlowTypePopup = function (index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    let modal = document.getElementById('flow-type-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'flow-type-modal';
        modal.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" onclick="document.getElementById('flow-type-modal').style.display='none'">
           <div style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:300px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
               <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wybierz typ przepływu</h3>
               <div style="display:flex; gap:1rem; justify-content:center;">
                  <button id="flow-wlot-btn" style="flex:1; background:rgba(59,130,246,0.2); color:#93c5fd; border:2px solid rgba(59,130,246,0.6); padding:1.2rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:1.1rem; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseenter="this.style.background='rgba(59,130,246,0.4)'" onmouseleave="this.style.background='rgba(59,130,246,0.2)'">
                     <span style="font-size:2.5rem;"><i data-lucide="download"></i></span>WLOT
                  </button>
                  <button id="flow-wylot-btn" style="flex:1; background:rgba(239,68,68,0.2); color:#fca5a5; border:2px solid rgba(239,68,68,0.6); padding:1.2rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:1.1rem; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.4)'" onmouseleave="this.style.background='rgba(239,68,68,0.2)'">
                     <span style="font-size:2.5rem;"><i data-lucide="upload"></i></span>WYLOT
                  </button>
               </div>
               <button style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="document.getElementById('flow-type-modal').style.display='none'">Anuluj</button>
           </div>
        </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('flow-type-modal').style.display = 'flex';

    document.getElementById('flow-wlot-btn').onclick = () => {
        well.przejscia[index].flowType = 'wlot';
        well.przejscia[index].flowTypeManual = true;
        document.getElementById('flow-type-modal').style.display = 'none';
        renderWellPrzejscia();
        window.refreshZleceniaModalIfActive();
    };

    document.getElementById('flow-wylot-btn').onclick = () => {
        well.przejscia[index].flowType = 'wylot';
        well.przejscia[index].flowTypeManual = true;
        document.getElementById('flow-type-modal').style.display = 'none';
        renderWellPrzejscia();
        window.refreshZleceniaModalIfActive();
    };
};

window.openChangePrzejscieTypePopup = function (index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    const currTypeId = well.przejscia[index].productId;
    const currProduct = studnieProducts.find((p) => p.id === currTypeId);
    if (!currProduct) return;

    const przejsciaProducts = studnieProducts.filter((p) => p.componentType === 'przejscie' && p.active !== 0);
    const allTypes = [...new Set(przejsciaProducts.map((p) => p.category))].sort();

    let modal = document.getElementById('change-prz-type-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'change-prz-type-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" onclick="document.getElementById('change-prz-type-modal').style.display='none'">
       <div style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:1120px; max-width:95%; height:850px; max-height:95vh; display:flex; flex-direction:column; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
           <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Zmień rodzaj przejścia</h3>
           <div style="display:grid; grid-template-columns:repeat(auto-fill, 192px); justify-content:center; gap:11px; flex:1; overflow-y:auto; padding:0.2rem;">
              ${allTypes
                  .map((t) => {
                      const isActive = t === currProduct.category;
                      return `<button onclick="window.confirmChangePrzejscieType(${index}, '${t}')" 
                          style="width:192px; height:44px; display:flex; align-items:center; justify-content:center; padding:0.2rem 0.6rem; border-radius:8px; cursor:pointer; font-size:14px; font-weight:700; text-align:center; transition:all 0.15s;
                                 background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};
                                 border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};
                                 color:${isActive ? '#a78bfa' : 'var(--text-primary)'};"
                          onmouseenter="this.style.background='rgba(99,102,241,0.15)';this.style.borderColor='rgba(99,102,241,0.3)'"
                          onmouseleave="this.style.background='${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}';this.style.borderColor='${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}'">
                       ${t}
                   </button>`;
                  })
                  .join('')}
           </div>
           <button style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="document.getElementById('change-prz-type-modal').style.display='none'">Anuluj</button>
       </div>
    </div>
    `;
    modal.style.display = 'flex';
};

window.confirmChangePrzejscieType = function (index, newType) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    const available = studnieProducts
        .filter((p) => p.category === newType)
        .sort((a, b) => a.dn - b.dn);
    if (available.length > 0) {
        well.przejscia[index].productId = available[0].id;
        document.getElementById('change-prz-type-modal').style.display = 'none';
        refreshAll();
        autoSelectComponents(true);
        window.refreshZleceniaModalIfActive();
        showToast('Zmieniono materiał przejścia', 'success');
    }
};

window.openChangePrzejscieDnPopup = function (index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    const currId = well.przejscia[index].productId;
    const currProduct = studnieProducts.find((p) => p.id === currId);
    if (!currProduct) return;

    const available = studnieProducts
        .filter((p) => p.category === currProduct.category)
        .sort((a, b) => a.dn - b.dn);

    let modal = document.getElementById('change-prz-dn-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'change-prz-dn-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" onclick="document.getElementById('change-prz-dn-modal').style.display='none'">
       <div style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:1120px; max-width:95%; height:850px; max-height:95vh; display:flex; flex-direction:column; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
           <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wybierz średnicę (DN): ${currProduct.category}</h3>
           <div style="display:grid; grid-template-columns:repeat(auto-fill, 192px); justify-content:center; align-content:start; gap:11px; flex:1; overflow-y:auto; padding:0.2rem;">
              ${available
                  .map((p) => {
                      const isActive = p.id === currId;
                      const dnLabel =
                          typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                      return `<button onclick="window.confirmChangePrzejscieDn(${index}, '${p.id}')" 
                          style="width:192px; height:44px; display:flex; align-items:center; justify-content:center; padding:0.2rem 0.6rem; border-radius:8px; cursor:pointer; font-size:14px; font-weight:700; text-align:center; transition:all 0.15s;
                                 background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};
                                 border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'};
                                 color:${isActive ? '#a78bfa' : 'var(--text-primary)'};"
                          onmouseenter="this.style.background='rgba(99,102,241,0.15)';this.style.borderColor='rgba(99,102,241,0.3)'"
                          onmouseleave="this.style.background='${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}';this.style.borderColor='${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}'">
                       ${dnLabel}
                   </button>`;
                  })
                  .join('')}
           </div>
           <button style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="document.getElementById('change-prz-dn-modal').style.display='none'">Anuluj</button>
       </div>
    </div>
    `;
    modal.style.display = 'flex';
};

window.confirmChangePrzejscieDn = function (index, newProductId) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    well.przejscia[index].productId = newProductId;
    document.getElementById('change-prz-dn-modal').style.display = 'none';
    refreshAll();
    autoSelectComponents(true);
    window.refreshZleceniaModalIfActive();
    showToast('Zmieniono średnicę przejścia', 'success');
};

function removePrzejscieFromWell(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    if (well.przejscia) {
        well.przejscia.splice(index, 1);
        refreshAll();
        autoSelectComponents(true);
        window.refreshZleceniaModalIfActive();
    }
}

/* ===== PODSUMOWANIE ===== */
function updateSummary() {
    const well = getCurrentWell();
    if (!well) {
        document.getElementById('sum-price').textContent = '0 PLN';
        document.getElementById('sum-weight').textContent = '0 kg';
        document.getElementById('sum-height').textContent = '0 mm';
        document.getElementById('sum-area-int').textContent = '0,00 m²';
        document.getElementById('sum-area-ext').textContent = '0,00 m²';

        const wsHeight = document.getElementById('ws-height');
        const wsReq = document.getElementById('ws-req-height');
        const wsDiff = document.getElementById('ws-diff-height');
        const wsPrice = document.getElementById('ws-price');
        if (wsHeight) wsHeight.textContent = '0 mm';
        if (wsReq) wsReq.textContent = '—';
        if (wsDiff) {
            wsDiff.textContent = '—';
            wsDiff.style.color = 'var(--text-muted)';
        }
        if (wsPrice) wsPrice.textContent = '0';

        updateHeightIndicator();
        return;
    }
    const stats = calcWellStats(well);

    // Dolny pasek
    document.getElementById('sum-price').textContent = fmtInt(stats.price) + ' PLN';
    document.getElementById('sum-weight').textContent = fmtInt(stats.weight) + ' kg';
    document.getElementById('sum-height').textContent = fmtInt(stats.height) + ' mm';
    document.getElementById('sum-area-int').textContent = fmt(stats.areaInt) + ' m²';
    document.getElementById('sum-area-ext').textContent = fmt(stats.areaExt) + ' m²';

    let reqMmText = '—';
    let diffMmText = '—';
    let diffColor = 'var(--text-muted)';

    const rzWlazu = parseFloat(well.rzednaWlazu);
    const rzDna = isNaN(parseFloat(well.rzednaDna))
        ? isNaN(rzWlazu)
            ? NaN
            : 0
        : parseFloat(well.rzednaDna);

    if (!isNaN(rzWlazu) && !isNaN(rzDna) && rzWlazu > rzDna) {
        const reqMm = Math.round((rzWlazu - rzDna) * 1000);
        reqMmText = fmtInt(reqMm) + ' mm';
        const diff = reqMm - stats.height;

        if (diff > 0) {
            diffMmText = '-' + fmtInt(diff) + ' mm';
            diffColor = '#f87171'; // czerwony
        } else if (diff < 0) {
            diffMmText = '+' + fmtInt(Math.abs(diff)) + ' mm';
            diffColor = '#facc15'; // żółty/pomarańczowy
        } else {
            diffMmText = 'OK';
            diffColor = '#4ade80'; // zielony
        }
    }

    const wsHeight = document.getElementById('ws-height');
    const wsReq = document.getElementById('ws-req-height');
    const wsDiff = document.getElementById('ws-diff-height');
    const wsPrice = document.getElementById('ws-price');

    if (wsHeight) wsHeight.textContent = fmtInt(stats.height) + ' mm';
    if (wsReq) wsReq.textContent = reqMmText;
    if (wsDiff) {
        wsDiff.textContent = diffMmText;
        wsDiff.style.color = diffColor;
    }
    if (wsPrice) wsPrice.textContent = fmtInt(stats.price);

    // Height indicator
    updateHeightIndicator();
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

    // We will build a UI for each DN
    let groupsHtml = uniqueDns
        .map((dn) => {
            const exampleMag = wells[0]?.magazyn || 'Kluczbork';
            // Get all products that can be used for closures
            const availForDn = studnieProducts.filter(
                (p) =>
                    p.dn === dn &&
                    ((exampleMag === 'Włocławek' && p.magazynWL === 1) ||
                        (exampleMag !== 'Włocławek' && p.magazynKLB === 1))
            );

            const topClosureTypes = [
                'konus',
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'pierscien_odciazajacy'
            ];
            const candidates = availForDn.filter((p) => topClosureTypes.includes(p.componentType));
            const canReduce = [1200, 1500, 2000, 2500].includes(dn);

            let topTiles = candidates
                .map(
                    (p) => `
            <div class="fs-dn-tile" id="recalc-top-${dn}-${p.id}"
                 style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                 onclick="window.recalcSelectTop(${dn}, '${p.id}')">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-primary);">${p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)}</div>
            </div>
        `
                )
                .join('');

            // Auto Konus as default tile
            topTiles =
                `
            <div class="fs-dn-tile active" id="recalc-top-${dn}-auto"
                 style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                 onclick="window.recalcSelectTop(${dn}, 'auto')">
                <div style="font-size:0.65rem; font-weight:700; color:#a78bfa;"><i data-lucide="refresh-cw"></i> Auto (Domyślny)</div>
            </div>
        ` + topTiles;

            let reductionHtml = '';
            if (canReduce) {
                const dn1000Candidates = studnieProducts.filter(
                    (p) =>
                        p.dn === 1000 &&
                        topClosureTypes.includes(p.componentType) &&
                        ((exampleMag === 'Włocławek' && p.magazynWL === 1) ||
                            (exampleMag !== 'Włocławek' && p.magazynKLB === 1))
                );

                let redTiles = dn1000Candidates
                    .map(
                        (p) => `
                <div class="fs-dn-tile fs-red-tile-${dn}" id="recalc-redtop-${dn}-${p.id}"
                     style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                     onclick="window.recalcSelectRedTop(${dn}, '${p.id}')">
                    <div style="font-size:0.65rem; font-weight:700; color:var(--text-primary);">${p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)}</div>
                </div>
            `
                    )
                    .join('');

                redTiles =
                    `
                <div class="fs-dn-tile active fs-red-tile-${dn}" id="recalc-redtop-${dn}-auto"
                     style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                     onclick="window.recalcSelectRedTop(${dn}, 'auto')">
                    <div style="font-size:0.65rem; font-weight:700; color:#a78bfa;"><i data-lucide="refresh-cw"></i> Auto (Konus)</div>
                </div>
            ` + redTiles;

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
        </div>
        `;
        })
        .join('');

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
    </div>
    `;

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
                redMinH = parseInt(document.getElementById(`recalc-red-minh-${dn}`)?.value) || 2500;
            }

            prefs[dn] = { topId, useRed, redTopId, redMinH };
        });

        // Backup current index
        const originalIndex = currentWellIndex;

        // Apply settings and recalc all
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
            w.config = []; // clean state to force full recalculation
            w.autoLocked = false;

            currentWellIndex = i; // let generator pick the right well
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
