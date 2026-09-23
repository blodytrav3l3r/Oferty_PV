// @ts-check
/* ===== EXCEL WELL ACTIONS — Save, parametry, CRUD studni ===== */

/* ===== SAVE ===== */
async function excelSaveAll() {
    const btn = document.getElementById('excel-save-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Zapisywanie...';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
    let shouldClose = true;
    try {
        // Defense-in-depth: wyczyść puste przejścia przed walidacją/zapisem (source guard jest podstawą)
        if (typeof _excelCleanEmptyPrzejscia === 'function' && Array.isArray(wells)) {
            wells.forEach(function (w) {
                _excelCleanEmptyPrzejscia(w);
            });
        }
        if (typeof validatePrzejsciaForSave === 'function') {
            const v = validatePrzejsciaForSave(typeof wells !== 'undefined' ? wells : []);
            if (!v.valid) {
                if (typeof showPrzejsciaValidationPopup === 'function')
                    showPrzejsciaValidationPopup(v.errors);
                else showToast(v.errors[0], 'error');
                shouldClose = false;
                return;
            }
        }
        if (typeof refreshAll === 'function') refreshAll();
        if (typeof orderEditMode !== 'undefined' && orderEditMode) {
            /* Tryb edycji zamówienia — zapis przez saveCurrentOrder */
            if (typeof saveCurrentOrder === 'function') {
                await saveCurrentOrder();
            }
        } else if (typeof saveOfferStudnie === 'function') {
            const saved = await saveOfferStudnie();
            if (saved === false) {
                shouldClose = false;
                showToast('Nie zapisano oferty — popraw wymagane pola', 'warning');
            }
        }
        if (shouldClose) {
            showToast('Zapisano zmiany w tabeli', 'success');
            _excelDirty = false;
        }
    } catch (err) {
        shouldClose = false;
        showToast('Błąd zapisu: ' + (err && err.message ? err.message : 'nieznany'), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Gotowe (Zapisz)';
            btn.style.opacity = '';
            btn.style.cursor = '';
        }
        /* Zamknij tylko po udanym zapisie — przy nieudanym modal zostaje,
           by użytkownik mógł poprawić (guard _excelClosing nie jest tu ustawiany). */
        if (shouldClose) _excelCloseOverlay();
    }
}

/* ===== PARAM. BUTTON — popup parametrów studni w Excelu — kafelki ===== */
function _excelUpdateWellParam(wIdx, paramKey, value) {
    const well = wells[wIdx];
    if (!well) return;
    if (!_excelGuardWellLocked(wIdx)) return;
    const oldParamVal = well[paramKey];
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
    if (paramKey === 'kineta') {
        const syncValues = [
            'beton',
            'beton_gfk',
            'klinkier',
            'preco',
            'precotop',
            'unolith',
            'predl',
            'kamionka',
            'brak'
        ];
        if (syncValues.includes(value)) {
            well.spocznik = value;
        }
        if (value === 'preco' || value === 'precotop') {
            if (oldParamVal !== 'preco' && oldParamVal !== 'precotop') {
                well.precoFullHeight = 'nie';
            }
        }
        if (value === 'preco' || value === 'precotop' || value === 'unolith') {
            well.spocznikH = '1/1';
        }
    }
    if (
        paramKey === 'spocznikH' &&
        (well.kineta === 'preco' || well.kineta === 'precotop' || well.kineta === 'unolith')
    ) {
        well.spocznikH = '1/1';
    }
    if (paramKey === 'kineta' || paramKey === 'spocznik' || paramKey === 'spocznikH') {
        if (typeof syncKineta === 'function') syncKineta(well);
    }
    /* Parametry cenowe (malowanie itd.) — kafelki preview natychmiast za wierszem. */
    try {
        if (typeof _excelSyncMainPreview === 'function') _excelSyncMainPreview(wIdx);
    } catch (_e) {}
    _excelDebouncedRefresh(wIdx);
    if (typeof recalculateWellErrors === 'function' && wells[wIdx]) {
        try {
            recalculateWellErrors(wells[wIdx]);
        } catch (_e) {}
    }
    _excelRenderTable(_excelActiveTab);
    const existing = document.getElementById('excel-params-popup');
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
        'position:fixed;inset:0;z-index:' +
        LAYERS.EXCEL_POPUP_BACKDROP +
        ';background:var(--excel-backdrop);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    const maxOptions = Math.max(...WELL_PARAM_DEFS.map((d) => d.options.length));
    const TILE_W = 90;
    const gapPx = 5.6;
    const gridW = maxOptions * TILE_W + (maxOptions - 1) * gapPx;
    const popupW = Math.min(Math.round(gridW + 185 + 42), 1200);

    const modal = document.createElement('div');
    modal.style.cssText = `width:${popupW}px;max-height:90vh;background:var(--bg-primary);border:1px solid var(--excel-border-subtle);border-radius: var(--radius-sm);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--excel-shadow);`;

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
            if (
                def.key === 'spocznikH' &&
                (well.kineta === 'preco' || well.kineta === 'precotop' || well.kineta === 'unolith')
            )
                isGreyedOut = true;
            if (
                well.wkladkaOsadnikPreco === 'tak' &&
                (def.key === 'kineta' || def.key === 'spocznik')
            )
                return;
            // Psia buda → dennica bez dna: kineta/spocznik/spocznikH zablokowane na 'brak'
            if (
                well.psiaBuda &&
                (def.key === 'kineta' || def.key === 'spocznik' || def.key === 'spocznikH')
            )
                isGreyedOut = true;

            const currentVal = well[def.key] || '';
            bodyHtml += `<div class="dn-tile-grid${isGreyedOut ? ' dn-tile-grid--dim' : ''}">`;
            bodyHtml += `<span class="well-param-label" title="${escapeHtmlAttr(def.label)}">${escapeHtml(def.label)}</span>`;
            const cols = def.options.length;
            bodyHtml += `<div class="dn-tile-opts" style="grid-template-columns:repeat(${cols}, ${TILE_W}px);">`;
            def.options.forEach(([val, lbl]) => {
                const active = val === currentVal;
                bodyHtml += `<button class="dn-tile${active ? ' dn-tile--active' : ''}" onclick="_excelUpdateWellParam(${wIdx},'${def.key}','${val}')">${escapeHtml(lbl)}</button>`;
            });
            bodyHtml += `</div></div>`;

            if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
                bodyHtml += `<div class="well-param-row">`;
                bodyHtml += `<span class="well-param-label">Nazwa p. wew.</span>`;
                bodyHtml += `<input type="text" class="well-param-input" value="${escapeHtmlAttr(well.powlokaNameW || '')}" onclick="this.select()" onchange="_excelUpdateWellParam(${wIdx},'powlokaNameW',this.value);excelRefreshParamsPopup(${wIdx})" placeholder="Nazwa powłoki...">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div class="well-param-row">`;
                bodyHtml += `<span class="well-param-label">Koszt p. wew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onclick="this.select()" onchange="_excelUpdateWellParam(${wIdx},'malowanieWewCena',parseFloat(this.value)||0);excelRefreshParamsPopup(${wIdx})" placeholder="PLN / m²" style="width:120px;height:34px;background:var(--excel-input-bg);border:1px solid var(--excel-input-border);color:var(--text-primary);padding:0 0.7rem;font-size: var(--fs-lg);border-radius: var(--radius-sm);">`;
                bodyHtml += `</div>`;
            }
            if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
                bodyHtml += `<div class="well-param-row">`;
                bodyHtml += `<span class="well-param-label">Nazwa p. zew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtmlAttr(well.powlokaNameZ || '')}" onclick="this.select()" onchange="_excelUpdateWellParam(${wIdx},'powlokaNameZ',this.value);excelRefreshParamsPopup(${wIdx})" placeholder="Nazwa powłoki..." style="flex:1;height:34px;background:var(--excel-input-bg);border:1px solid var(--excel-input-border);color:var(--text-primary);padding:0 0.7rem;font-size: var(--fs-lg);border-radius: var(--radius-sm);">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div class="well-param-row">`;
                bodyHtml += `<span class="well-param-label">Koszt p. zew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onclick="this.select()" onchange="_excelUpdateWellParam(${wIdx},'malowanieZewCena',parseFloat(this.value)||0);excelRefreshParamsPopup(${wIdx})" placeholder="PLN / m²" style="width:120px;height:34px;background:var(--excel-input-bg);border:1px solid var(--excel-input-border);color:var(--text-primary);padding:0 0.7rem;font-size: var(--fs-lg);border-radius: var(--radius-sm);">`;
                bodyHtml += `</div>`;
            }
        });
    }
    bodyHtml += `</div>`;

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.8rem;background:var(--excel-bg-alt);border-bottom:1px solid var(--excel-border-subtle);flex-shrink:0;">
            <span style="font-size: var(--fs-lg);font-weight: var(--fw-bold);color:var(--text-primary);">Parametry tej studni Excel</span>
            <button type="button" onclick="document.getElementById('excel-params-popup').remove()" class="btn-icon" aria-label="Zamknij"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0.8rem;">
            ${bodyHtml}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.5rem 0.8rem;background:var(--excel-bg-alt);border-top:1px solid var(--excel-border-subtle);flex-shrink:0;">
            <button type="button" onclick="document.getElementById('excel-params-popup').remove()" class="excel-neutral-btn">Zamknij</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons({ root: overlay });
        } catch (_e) {}
    }
}

function excelRefreshParamsPopup(wIdx) {
    _excelDebouncedRefresh(wIdx);
    if (
        typeof recalculateWellErrors === 'function' &&
        typeof wells !== 'undefined' &&
        wells[wIdx]
    ) {
        try {
            recalculateWellErrors(wells[wIdx]);
        } catch (_e) {}
    }
    _excelRenderTable(_excelActiveTab);
    const existing = document.getElementById('excel-params-popup');
    if (existing) {
        existing.remove();
        excelOpenWellParams(wIdx);
    }
}

/* ===== EDYCJA NAZWY STUDNI ===== */
function excelOnNameChange(wIdx, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelSaveUndoSnapshot();
    _excelMarkAsManual(wIdx);
    const name = (value || '').trim();
    if (!name) return;
    wells[wIdx].name = name;
    wells[wIdx].numer = name.replace(/ (PRE|UTH)$/i, '').trim();
    if (typeof autoUpdateWellName === 'function') {
        autoUpdateWellName(wells[wIdx], wIdx);
    }
    if (typeof _excelInvalidateFilteredIndexes === 'function') _excelInvalidateFilteredIndexes();
    _excelRefreshDupColors();
    _excelRenderTabs();
    _excelUpdateWellCount();
    _excelDebouncedRefresh(wIdx);
    /* Re-aplikuj filtr wyszukiwarki — nazwa mogła przestać pasować do zapytania */
    if (typeof excelFilterWells === 'function') {
        const si = document.getElementById('excel-search-input');
        if (si && si.value) excelFilterWells(si.value);
    }
}

/* ===== DUPLIKOWANIE STUDNI Z TABELI ===== */
function excelDuplicateWell(wIdx) {
    const src = wells[wIdx];
    if (!src) return;
    if (typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(wIdx)) {
        showToast('Nie można duplikować — studnia zablokowana (PZ / zamówienie)', 'error');
        return;
    }
    _excelSaveUndoSnapshot();
    _excelMarkDirty();
    const copy = structuredClone(src);
    copy.id = 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    copy.name = src.name + ' (kopia)';
    // Kopia dostaje nową tożsamość przejść — inaczej dzieliłaby pr.id
    // z oryginałem i hover SVG podświetlałby oba wiersze Excela.
    if (typeof resetPrzejsciaIds === 'function') resetPrzejsciaIds(copy.przejscia);
    /* Kopia nie dziedziczy cache resolution (wskazywałby nieaktualne produkty) */
    delete copy.__resCache;
    wells.splice(wIdx + 1, 0, copy);
    if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
    if (typeof _excelInvalidateFilteredIndexes === 'function') _excelInvalidateFilteredIndexes();
    /* Wstawienie przesuwa indeksy studni po wIdx o +1 — przesuń też zaznaczenia
       (S2), inaczej selekcje komórek i checkboxy wskazują sąsiednie studnie. */
    if (typeof _excelSelectedCells !== 'undefined' && _excelSelectedCells.length > 0) {
        _excelSelectedCells.forEach(function (cell) {
            if (cell.wIdx > wIdx) cell.wIdx += 1;
        });
    }
    if (_excelLastClickedCell && _excelLastClickedCell.wIdx > wIdx) {
        _excelLastClickedCell.wIdx += 1;
    }
    /* Kopia nie dziedziczy zaznaczenia checkboxa wiersza (kluczowane indeksem) */
    if (typeof _excelRowSelectStates !== 'undefined') {
        const shifted = {};
        Object.keys(_excelRowSelectStates).forEach(function (k) {
            const i = parseInt(k, 10);
            if (!isNaN(i)) {
                shifted[i > wIdx ? i + 1 : i] = _excelRowSelectStates[k];
            }
        });
        shifted[wIdx + 1] = false;
        _excelRowSelectStates = shifted;
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    setTimeout(() => excelSelectRow(wIdx + 1), 50);
    _excelDebouncedRefresh(wIdx + 1);
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
    if (
        typeof window.pzGuard !== 'undefined' &&
        window.pzGuard.hasPzForWell &&
        window.pzGuard.hasPzForWell(well.id)
    ) {
        showToast('Nie można usunąć — studnia posiada zlecenia produkcyjne', 'error');
        return;
    }
    if (!(await appConfirm(`Usunąć "${well.name}"?`, { title: 'Usuwanie studni', type: 'danger' })))
        return;
    wells.splice(wIdx, 1);
    if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
    if (typeof _excelInvalidateFilteredIndexes === 'function') _excelInvalidateFilteredIndexes();
    if (typeof currentWellIndex !== 'undefined' && currentWellIndex >= wells.length) {
        currentWellIndex = Math.max(0, wells.length - 1);
    }
    /* Preview za aktualnym zaznaczeniem (nie za usuniętym wierszem). */
    try {
        if (typeof _excelSyncMainPreview === 'function') _excelSyncMainPreview(currentWellIndex);
    } catch (_e) {}
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    showToast('Studnia usunięta', 'info');
}

/* ===== Rejestracja globali ===== */
window.excelSaveAll = excelSaveAll;
window.excelRefreshParamsPopup = excelRefreshParamsPopup;
window.excelOnNameChange = excelOnNameChange;
window.excelDuplicateWell = excelDuplicateWell;

/* ===== Rejestracja globali ===== */
window.excelDeleteWell = excelDeleteWell;
