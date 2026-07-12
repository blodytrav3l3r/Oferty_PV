// @ts-check
/* ===== EXCEL RENDERER — Auto-dobór i kolory ===== */

function _excelRefreshAutoCells(wIdx, row) {
    const well = wells[wIdx];
    if (!well) return;

    const dnColor = (
        DN_COLORS[well.dn === 'styczna' ? 'styczne' : String(well.dn)] || DN_COLORS['1000']
    ).border;

    const height = _excelCalcWellHeight(well);
    const hCell = row.querySelector(`[data-cell="height-${wIdx}"]`);
    if (hCell) hCell.textContent = height || '—';

    const dennH = _excelCalcDennicaHeight(well);
    const dCell = row.querySelector(`[data-cell="denn-${wIdx}"]`);
    if (dCell) dCell.textContent = dennH || '—';

    const uszcz = _excelCalcUszczelkaCount(well);
    const uCell = row.querySelector(`[data-cell="uszcz-${wIdx}"]`);
    if (uCell) uCell.textContent = uszcz;
}

function _excelRefreshDupColors() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const dn = _excelActiveTab === 'styczne' ? 'styczne' : _excelActiveTab;
    const dnKey = dn === 'styczne' ? 'styczne' : dn;

    // Przelicz duplikaty i mapę DN-we wszystkich średnicach
    const nameCounts = {};
    const nameDnMap = {};
    wells.forEach((w) => {
        const n = (w.name || '').trim().toLowerCase();
        if (n) {
            nameCounts[n] = (nameCounts[n] || 0) + 1;
            const wDn = w.dn === 'styczna' ? 'styczne' : String(w.dn);
            if (!nameDnMap[n]) nameDnMap[n] = [];
            if (!nameDnMap[n].find((x) => x.dn === wDn)) {
                nameDnMap[n].push({ dn: wDn });
            }
        }
    });
    const dupNames = new Set(Object.keys(nameCounts).filter((n) => nameCounts[n] > 1));

    const rowDupSolid = {
        1000: '#162650',
        1200: '#0e2a1e',
        1500: '#2a2210',
        2000: '#241b36',
        2500: '#301818',
        styczne: '#2c1422'
    };
    const rowActiveDupSolid = {
        1000: '#1e3a6b',
        1200: '#164530',
        1500: '#3d3018',
        2000: '#352552',
        2500: '#4a2020',
        styczne: '#4a1a38'
    };
    const hoverDupSolid = {
        1000: '#1d3460',
        1200: '#143e2e',
        1500: '#383018',
        2000: '#2e2248',
        2500: '#3e2020',
        styczne: '#3a1a2e'
    };
    const hoverActiveDupSolid = {
        1000: '#2a4a80',
        1200: '#1d5a3e',
        1500: '#4d3d20',
        2000: '#452e66',
        2500: '#602a2a',
        styczne: '#602848'
    };

    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    tabWells.forEach((well, idx) => {
        const wIdx = wells.indexOf(well);
        const row = container.querySelector(`tr[data-widx="${wIdx}"]`);
        if (!row) return;

        const isEven = idx % 2 === 0;
        const isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        const nameKey = (well.name || '').trim().toLowerCase();
        const isDup = dupNames.has(nameKey);
        // Wykryj duplikaty między-średnicowe
        const nameDnList = nameDnMap[nameKey] || [];
        const otherDns = nameDnList.filter((d) => d.dn !== dnKey);
        const dupColorKey = isDup && otherDns.length > 0 ? otherDns[0].dn : dnKey;
        const baseBg = isEven ? '#0a0d16' : '#181c28';

        const rowBg =
            isDup && isActive
                ? rowActiveDupSolid[dupColorKey] || '#1e3a6b'
                : isDup
                  ? rowDupSolid[dupColorKey] || '#162650'
                  : isActive
                    ? '#1a2645'
                    : baseBg;
        const hoverBg =
            isDup && isActive
                ? hoverActiveDupSolid[dupColorKey] || '#2a4a80'
                : isDup
                  ? hoverDupSolid[dupColorKey] || '#1d3460'
                  : isActive
                    ? '#263460'
                    : '#141722';
        const activeBg =
            isDup && isActive
                ? rowActiveDupSolid[dupColorKey] || '#1e3a6b'
                : isDup
                  ? hoverDupSolid[dupColorKey] || '#1d3460'
                  : '#1a2645';

        row.setAttribute('data-base-bg', rowBg);
        row.setAttribute('data-orig-bg', rowBg);
        row.setAttribute('data-hover-bg', hoverBg);
        row.setAttribute('data-active-bg', activeBg);
        row.style.background = rowBg;
    });
}

async function _excelAutoSelectForWell(wIdx) {
    const well = wells[wIdx];
    if (!well) return;
    if (well.rzednaWlazu == null || well.rzednaDna == null) return;
    if (well.autoSelect === false) return; /* Manual skip */
    if (typeof autoSelectComponents !== 'function') return;
    var savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    try {
        currentWellIndex = wIdx;
        await autoSelectComponents(true);
        _excelClearResCache(well);
        _excelRenderTable(_excelActiveTab);
        _excelUpdateHeaderProdCodes();
    } finally {
        if (savedIdx >= 0) currentWellIndex = savedIdx;
    }
}

function _excelToggleWellAutoMode(wIdx) {
    if (typeof wells === 'undefined' || !wells[wIdx]) return;
    _excelSaveUndoSnapshot();
    wells[wIdx].autoSelect = wells[wIdx].autoSelect === false;
    /* Synchornizuj configSource z glownym panelem */
    wells[wIdx].configSource = wells[wIdx].autoSelect !== false ? 'AUTO' : 'MANUAL';
    /* Synchornizuj autoLocked - glowny panel sprawdza to dla przycisku Auto */
    if (wells[wIdx].autoSelect === false) wells[wIdx].autoLocked = true;
    else wells[wIdx].autoLocked = false;
    /* Lekki update - tylko jeden TD, bez calego _excelRenderTable (mniej migotania) */
    var btn = document.getElementById('excel-mode-btn-' + wIdx);
    var runBtn = document.getElementById('excel-run-auto-' + wIdx);
    if (!btn) return;
    var nowAuto = wells[wIdx].autoSelect !== false;
    btn.textContent = nowAuto ? 'AUTO' : 'MANUAL';
    btn.style.background = nowAuto ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.25)';
    btn.style.color = nowAuto ? '#c7d2fe' : '#fbbf24';
    btn.title = nowAuto ? 'Auto (klik = przelacz na Manual)' : 'Manual (klik = przelacz na Auto)';
    if (runBtn) {
        runBtn.disabled = !nowAuto;
        runBtn.style.opacity = nowAuto ? '1' : '0.4';
        runBtn.style.cursor = nowAuto ? 'pointer' : 'not-allowed';
        runBtn.style.background = nowAuto ? 'rgba(99,102,241,0.35)' : 'rgba(100,116,139,0.15)';
        runBtn.style.color = nowAuto ? '#c7d2fe' : '#64748b';
        runBtn.style.borderColor = nowAuto ? '#6366f1' : 'rgba(100,116,139,0.3)';
        runBtn.style.pointerEvents = nowAuto ? 'auto' : 'none';
        runBtn.title = nowAuto
            ? 'Uruchom auto-dobor elementow dla tej studni'
            : 'Przelacz na Auto aby uruchomic';
    }
    /* Odswiez glowny panel (configSource zmieniony przez nas) */
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.renderWellsList === 'function') window.renderWellsList();
    if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();
    showToast(nowAuto ? 'Auto wl.' : 'Manual wl.', 'info');
}

async function _excelRunAutoSelectForWell(wIdx) {
    if (typeof wells === 'undefined' || !wells[wIdx]) return;
    var well = wells[wIdx];
    if (!well) return;
    if (well.autoSelect === false) {
        showToast('Przełącz w tryb Auto aby uruchomić', 'warning');
        return;
    }
    if (well.rzednaWlazu == null || well.rzednaDna == null) {
        showToast('Uzupełnij Rz. włazu i Rz. dna przed autodor.', 'warning');
        return;
    }
    if (typeof autoSelectComponents !== 'function') {
        showToast('Auto-dobór nie dostępny (autoSelectComponents brak)', 'error');
        return;
    }
    var runBtn = document.getElementById('excel-run-auto-' + wIdx);
    var savedIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    if (runBtn) runBtn.textContent = '...';
    try {
        currentWellIndex = wIdx;
        /* WZORZEC z wellActions.js:1390 - czyscimy config i przeładowujemy solver */
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
        _excelClearResCache(well);
        _excelRenderTable(_excelActiveTab);
        _excelUpdateHeaderProdCodes();
        showToast('Auto-dobór dla studni #' + wIdx + ' OK', 'success');
    } catch (e) {
        console.error('Auto-dobór fail:', e);
        showToast('Błąd auto-doboru: ' + (e?.message || e), 'error');
    } finally {
        currentWellIndex = savedIdx >= 0 ? savedIdx : currentWellIndex;
        if (runBtn) runBtn.textContent = '▶';
    }
}
