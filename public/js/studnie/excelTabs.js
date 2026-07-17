// @ts-check
/* ===== EXCEL TABS — Zakładki DN, dodawanie studni, pusty wiersz ===== */

function _excelRenderTabs() {
    const container = document.getElementById('excel-tabs');
    if (!container) return;

    const dnCounts = {};
    wells.forEach((w) => {
        const key = w.dn === 'styczna' ? 'styczne' : String(w.dn);
        dnCounts[key] = (dnCounts[key] || 0) + 1;
    });

    let html = '';
    DN_TABS.forEach((tab) => {
        const count = dnCounts[tab] || 0;
        const c = DN_COLORS[tab] || DN_COLORS['1000'];
        const isActive = tab === _excelActiveTab;
        const tabLabel = tab === 'styczne' ? 'Styczne' : 'DN' + tab;
        html += `<button onclick="excelSwitchTab('${tab}')" style="
            padding:0.4rem 1rem;border:none;cursor:pointer;font-size:0.67rem;font-weight:600;
            border-bottom:2px solid ${isActive ? c.border : c.border + '66'};
            background:${isActive ? c.activeBg : c.bg};
            color:${isActive ? c.text : c.border + '99'};
            transition:all 0.12s;letter-spacing:0.2px;">
            ${tabLabel}<span style="opacity:0.5;margin-left:0.3rem;font-size:0.6rem;">${count}</span>
        </button>`;
    });
    container.innerHTML = html;
}

function _excelUpdateWellCount() {
    const el = document.getElementById('excel-well-count');
    if (el) el.textContent = wells.length + ' studni';
}

function excelSwitchTab(tab) {
    _excelActiveTab = tab;
    _excelRenderTabs();
    _excelRenderTable(tab);
    _excelUpdateHeaderProdCodes();
    /* Auto-focus na empty row gdy zakładka pusta */
    if (typeof wells !== 'undefined' && wells.length > 0) {
        let hasWellsInTab = false;
        for (let _st = 0; _st < wells.length; _st++) {
            if (_excelWellMatchesTab(wells[_st], tab)) {
                hasWellsInTab = true;
                break;
            }
        }
        if (!hasWellsInTab) {
            setTimeout(function () {
                let nameEl = document.getElementById('excel-empty-name');
                if (nameEl) nameEl.focus();
            }, 150);
        }
    }
}

/* ===== ADD WELL TO CURRENT TAB ===== */
function excelAddWellToTab() {
    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);

    let well;
    if (typeof createNewWell === 'function') {
        well = createNewWell(null, /** @type {any} */ (dn));
    } else {
        well = {
            id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            name:
                (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
                ' (#' +
                (wells.length + 1) +
                ')',
            dn: dn,
            config: [],
            przejscia: [],
            rzednaWlazu: null,
            rzednaDna: null,
            kineta: 'brak',
            psiaBuda: false,
            redukcjaDN1000: false,
            redukcjaMinH: 2500
        };
    }

    wells.push(well);
    _excelAutoSetWlaz(well);
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    const newWIdx = wells.length - 1;
    setTimeout(() => excelSelectRow(newWIdx), 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + well.name, 'success');
}

/**
 * @param {number} neededTotal
 * @param {NodeListOf<Element>} currentRows
 * @returns {NodeListOf<Element>}
 */
function _excelEnsureRowCount(neededTotal, currentRows) {
    let deficit = neededTotal - currentRows.length;
    if (deficit <= 0) return currentRows;
    let dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab, 10);
    _excelSaveUndoSnapshot();
    for (let i = 0; i < deficit; i++) {
        let well =
            typeof createNewWell === 'function'
                ? createNewWell(null, /** @type {any} */ (dn))
                : {
                      id: 'well_' + Date.now() + '_' + i,
                      name:
                          (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
                          ' (#' +
                          (wells.length + 1) +
                          ')',
                      dn: dn,
                      config: [],
                      przejscia: [],
                      rzednaWlazu: null,
                      rzednaDna: null,
                      kineta: 'brak',
                      psiaBuda: false,
                      redukcjaDN1000: false,
                      redukcjaMinH: 2500
                  };
        wells.push(well);
        _excelAutoSetWlaz(well);
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    return document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
}

/* ===== EMPTY ROW HANDLER — tworzenie studni z wiersza ===== */
function excelCreateFromEmpty() {
    if (_excelCreatingLock) return;
    _excelCreatingLock = true;

    const nameEl = document.getElementById('excel-empty-name');
    const rzwEl = document.getElementById('excel-empty-rzw');
    const rzdEl = document.getElementById('excel-empty-rzd');
    if (!nameEl) {
        _excelCreatingLock = false;
        return;
    }

    const name = (nameEl.value || '').trim();
    const rzwRaw = rzwEl ? rzwEl.value : '';
    const rzdRaw = rzdEl ? rzdEl.value : '';
    const rzw = rzwRaw !== '' ? parseFloat(rzwRaw) : null;
    const rzd = rzdRaw !== '' ? parseFloat(rzdRaw) : null;

    if (!name && rzw === null && rzd === null) {
        _excelCreatingLock = false;
        return;
    }

    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);
    const autoName =
        name ||
        (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
            ' (#' +
            (wells.length + 1) +
            ')';

    let well;
    try {
        if (typeof createNewWell === 'function') {
            well = createNewWell(autoName, /** @type {any} */ (dn));
            if (name) {
                well.numer = name;
                well.name = name;
            }
        } else {
            well = {
                id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                name: autoName,
                dn: dn,
                config: [],
                przejscia: [],
                rzednaWlazu: rzw,
                rzednaDna: rzd,
                kineta: 'brak',
                psiaBuda: false,
                redukcjaDN1000: false,
                redukcjaMinH: 2500
            };
        }

        if (rzw !== null) well.rzednaWlazu = rzw;
        if (rzd !== null) well.rzednaDna = rzd;

        wells.push(well);
        _excelAutoSetWlaz(well);
        _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
        _excelRenderTabs();
        _excelRenderTable(_excelActiveTab);
        _excelUpdateWellCount();
        _excelDebouncedRefresh();
        let newWIdx = wells.length - 1;
        if (_excelAutoSelectEnabled && rzw !== null && rzd !== null && rzw > rzd) {
            setTimeout(function () {
                _excelAutoSelectForWell(newWIdx);
            }, 200);
        }
        showToast('Dodano: ' + autoName, 'success');
    } finally {
        setTimeout(() => {
            _excelCreatingLock = false;
            const newIdx = wells.length - 1;
            const row = document.querySelector(`tr[data-widx="${newIdx}"]`);
            const rzwEl = row && row.querySelector('input[data-field="rzednaWlazu"]');
            if (rzwEl) {
                rzwEl.focus();
                rzwEl.select();
            }
        }, 100);
    }
}
