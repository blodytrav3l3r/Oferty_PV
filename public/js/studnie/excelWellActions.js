// @ts-check
/* ===== EXCEL WELL ACTIONS — Save, parametry, CRUD studni ===== */

/* ===== SAVE ===== */
function excelSaveAll() {
    let btn = document.getElementById('excel-save-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Zapisywanie...';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
    if (typeof refreshAll === 'function') refreshAll();
    showToast('Zapisano zmiany w tabeli', 'success');
    _excelDirty = false;
    closeExcelTableModal();
}

/* ===== PARAM. BUTTON — popup parametrów studni w Excelu — kafelki ===== */
function _excelUpdateWellParam(wIdx, paramKey, value) {
    const well = wells[wIdx];
    if (!well) return;
    well[paramKey] = value;
    if (paramKey === 'malowanieWewCena' || paramKey === 'malowanieZewCena') {
        wells.forEach(function (w) {
            w[paramKey] = value;
        });
    }
    if (paramKey === 'wkladkaOsadnikPreco' && value === 'tak') {
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.precoFullHeight = 'tak';
    }
    _excelDebouncedRefresh();
    _excelRenderTable(_excelActiveTab);
    let existing = document.getElementById('excel-params-popup');
    if (existing) {
        existing.remove();
        excelOpenWellParams(wIdx);
    }
}

function excelOpenWellParams(wIdx) {
    const well = wells[wIdx];
    if (!well) return;

    const existing = document.getElementById('excel-params-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-params-popup';
    overlay.style.cssText =
        'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    const maxOptions = Math.max(...WELL_PARAM_DEFS.map((d) => d.options.length));
    const TILE_W = 90;
    const gapPx = 5.6;
    const gridW = maxOptions * TILE_W + (maxOptions - 1) * gapPx;
    const popupW = Math.min(Math.round(gridW + 185 + 42), 1200);

    const modal = document.createElement('div');
    modal.style.cssText = `width:${popupW}px;max-height:90vh;background:var(--bg-primary);border:1px solid rgba(255,255,255,0.06);border-radius:6px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);`;

    let bodyHtml = `<div style="display:flex;flex-direction:column;gap:0.55rem;">`;
    if (typeof WELL_PARAM_DEFS !== 'undefined') {
        const isOsadnik = typeof isSettlingWell === 'function' && isSettlingWell(well);
        WELL_PARAM_DEFS.forEach((def) => {
            if (
                def.key === 'precoFullHeight' &&
                well.kineta !== 'preco' &&
                well.kineta !== 'precotop'
            )
                return;

            let isGreyedOut = false;
            if (def.key === 'wkladkaOsadnikPreco' && !isOsadnik) isGreyedOut = true;
            if (def.key === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop'))
                isGreyedOut = true;
            if (
                well.wkladkaOsadnikPreco === 'tak' &&
                (def.key === 'kineta' || def.key === 'spocznik')
            )
                return;

            const currentVal = well[def.key] || '';
            bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;${isGreyedOut ? 'opacity:0.5;' : ''}">`;
            bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">${def.label}</span>`;
            const cols = def.options.length;
            bodyHtml += `<div style="display:grid;grid-template-columns:repeat(${cols}, ${TILE_W}px);gap:0.35rem;flex:1;">`;
            def.options.forEach(([val, lbl]) => {
                const active = val === currentVal;
                bodyHtml += `<button onclick="_excelUpdateWellParam(${wIdx},'${def.key}','${val}')" style="height:34px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:${active ? '800' : '600'};border:1px solid ${active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};background:${active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'};color:${active ? '#a5b4fc' : 'var(--text-secondary)'};transition:all 0.15s ease;display:flex;align-items:center;justify-content:center;${active ? 'box-shadow:0 0 10px rgba(99,102,241,0.2);' : ''}" onmouseenter="if(!${active}){this.style.borderColor='rgba(99,102,241,0.3)';this.style.background='rgba(255,255,255,0.08)'}" onmouseleave="if(!${active}){this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.04)'}">${lbl}</button>`;
            });
            bodyHtml += `</div></div>`;

            if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. wew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameW || '')}" onclick="this.select()" onchange="_excelUpdateWellParam('powlokaNameW',this.value);excelRefreshParamsPopup(${wIdx})" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. wew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onclick="this.select()" onchange="_excelUpdateWellParam('malowanieWewCena',parseFloat(this.value)||0);excelRefreshParamsPopup(${wIdx})" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
            if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. zew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameZ || '')}" onclick="this.select()" onchange="_excelUpdateWellParam('powlokaNameZ',this.value);excelRefreshParamsPopup(${wIdx})" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. zew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onclick="this.select()" onchange="_excelUpdateWellParam('malowanieZewCena',parseFloat(this.value)||0);excelRefreshParamsPopup(${wIdx})" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
        });
    }
    bodyHtml += `</div>`;

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">Parametry: ${escapeHtml(well.name)}</span>
            <button onclick="document.getElementById('excel-params-popup').remove()" style="background:#13151f;color:var(--text-muted);border:none;cursor:pointer;font-size:1.1rem;">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0.8rem;">
            ${bodyHtml}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.5rem 0.8rem;background:#10131a;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <button onclick="document.getElementById('excel-params-popup').remove()" style="background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid rgba(255,255,255,0.1);padding:0.4rem 1.2rem;border-radius:6px;font-size:0.8rem;cursor:pointer;font-weight:600;">Zamknij</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function excelRefreshParamsPopup(wIdx) {
    _excelDebouncedRefresh();
    _excelRenderTable(_excelActiveTab);
    const existing = document.getElementById('excel-params-popup');
    if (existing) {
        existing.remove();
        excelOpenWellParams(wIdx);
    }
}

/* ===== EDYCJA NAZWY STUDNI ===== */
function excelOnNameChange(wIdx, value) {
    _excelSaveUndoSnapshot();
    _excelMarkAsManual(wIdx);
    const name = (value || '').trim();
    if (!name) return;
    wells[wIdx].name = name;
    wells[wIdx].numer = name.replace(/ (PRE|UTH)$/, '');
    if (typeof autoUpdateWellName === 'function') {
        autoUpdateWellName(wells[wIdx], wIdx);
    }
    _excelRefreshDupColors();
    _excelRenderTabs();
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
}

/* ===== DUPLIKOWANIE STUDNI Z TABELI ===== */
function excelDuplicateWell(wIdx) {
    const src = wells[wIdx];
    if (!src) return;
    const copy = structuredClone(src);
    copy.id = 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    copy.name = src.name + ' (kopia)';
    wells.splice(wIdx + 1, 0, copy);
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    setTimeout(() => excelSelectRow(wIdx + 1), 50);
    _excelDebouncedRefresh();
    showToast('Skopiowano: ' + copy.name, 'success');
}

/* ===== USUWANIE STUDNI Z TABELI ===== */
async function excelDeleteWell(wIdx) {
    const well = wells[wIdx];
    if (!well) return;
    if (typeof isWellLocked === 'function' && isWellLocked(wIdx)) {
        showToast('Ta studnia jest zablokowana — nie można usunąć', 'error');
        return;
    }
    if (!(await appConfirm(`Usunąć "${well.name}"?`, { title: 'Usuwanie studni', type: 'danger' })))
        return;
    wells.splice(wIdx, 1);
    if (typeof currentWellIndex !== 'undefined' && currentWellIndex >= wells.length) {
        currentWellIndex = Math.max(0, wells.length - 1);
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    showToast('Studnia usunięta', 'info');
}
