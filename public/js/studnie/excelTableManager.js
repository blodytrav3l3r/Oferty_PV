// @ts-check
/* ===== EXCEL TABLE MANAGER — Tabela konfiguracyjna studni (Excel-style) ===== */

let _excelMaxTransitions = 1;
let _excelActiveTab = '1000';
const _excelFocusedCell = null;
let _excelCreatingLock = false;
let _excelRefreshTimer = null;

function _excelDebouncedRefresh() {
    if (_excelRefreshTimer) clearTimeout(_excelRefreshTimer);
    _excelRefreshTimer = setTimeout(() => {
        _excelRefreshTimer = null;
        if (typeof refreshAll === 'function') refreshAll(true);
    }, 300);
}

const KINETA_OPTIONS = [
    ['brak', 'Brak'],
    ['beton', 'Beton'],
    ['beton_gfk', 'Beton z GFK'],
    ['klinkier', 'Klinkier'],
    ['preco', 'Preco'],
    ['precotop', 'PrecoTop'],
    ['unolith', 'UnoLith'],
    ['predl', 'Predl'],
    ['kamionka', 'Kamionka']
];

const DN_TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
const DN_COLORS = {
    1000: {
        bg: 'rgba(59,130,246,0.12)',
        border: '#3b82f6',
        text: '#93c5fd',
        activeBg: 'rgba(59,130,246,0.25)'
    },
    1200: {
        bg: 'rgba(16,185,129,0.12)',
        border: '#10b981',
        text: '#6ee7b7',
        activeBg: 'rgba(16,185,129,0.25)'
    },
    1500: {
        bg: 'rgba(245,158,11,0.12)',
        border: '#f59e0b',
        text: '#fbbf24',
        activeBg: 'rgba(245,158,11,0.25)'
    },
    2000: {
        bg: 'rgba(168,85,247,0.12)',
        border: '#a855f7',
        text: '#c4b5fd',
        activeBg: 'rgba(168,85,247,0.25)'
    },
    2500: {
        bg: 'rgba(239,68,68,0.12)',
        border: '#ef4444',
        text: '#fca5a5',
        activeBg: 'rgba(239,68,68,0.25)'
    },
    styczne: {
        bg: 'rgba(236,72,153,0.12)',
        border: '#ec4899',
        text: '#f9a8d4',
        activeBg: 'rgba(236,72,153,0.25)'
    }
};

const _EXCEL_BORDER = '1px solid rgba(255,255,255,0.07)';
const _EXCEL_CELL_PADD = '0.35rem 0.5rem';
const _EXCEL_FONT = 'font-size:0.7rem;font-family:Inter,Segoe UI,sans-serif;letter-spacing:0.1px;';

function _excelWellMatchesTab(well, tab) {
    if (tab === 'styczne') return well.dn === 'styczna';
    return String(well.dn) === String(tab);
}

function _excelGetMaxTransitions() {
    let max = 1;
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (w.przejscia && w.przejscia.length > max) max = w.przejscia.length;
        });
    }
    return Math.max(max, _excelMaxTransitions);
}

function _excelCreatePrzejscie() {
    return {
        id: 'prz-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        productId: '',
        rzednaWlaczenia: null,
        angle: 0,
        flowType: 'WYLOT',
        angleExecution: 0,
        angleGony: '0.00',
        displayIndex: 0
    };
}

function _excelGetComponentsForDn(dn) {
    if (typeof studnieProducts === 'undefined' || !studnieProducts) return {};
    const mag =
        typeof wells !== 'undefined' && wells.length > 0
            ? wells[0].magazyn || 'Kluczbork'
            : 'Kluczbork';
    const isWl = mag.includes('oc') || mag.includes('Włoc');
    const field = isWl ? 'magazynWL' : 'magazynKLB';

    let products = studnieProducts.filter((p) => {
        const val = p[field];
        return val === 1 || val === '1' || val === undefined;
    });

    if (dn === 'styczna') {
        products = products.filter(
            (p) => p.dn === 'styczna' || p.dn === null || p.componentType === 'styczna'
        );
    } else {
        products = products.filter((p) => parseInt(p.dn) === parseInt(dn) || p.dn === null);
    }

    const groups = {};
    products.forEach((p) => {
        const ct = p.componentType;
        if (!ct || ct === 'przejscie' || ct === 'kineta') return;
        if (!groups[ct]) groups[ct] = [];
        groups[ct].push(p);
    });

    return groups;
}

function _excelBuildComponentColumns(dn) {
    const groups = _excelGetComponentsForDn(dn);
    const cols = [];

    /* 1. Właz */
    const wlazProducts = groups['wlaz'] || [];
    if (wlazProducts.length > 0) {
        cols.push({
            key: 'wlaz',
            label: 'Właz',
            type: 'select',
            componentType: 'wlaz',
            products: wlazProducts
        });
    }

    /* 2. AVR / Pierścienie — per produkt (osobna kolumna każdy) */
    const avrProducts = groups['avr'] || [];
    avrProducts.forEach((p) => {
        const nameShort = p.name.replace(/AVR\s*/i, '').trim() || p.id;
        cols.push({
            key: 'avr_' + p.id,
            label: 'AVR ' + nameShort,
            type: 'number',
            componentType: 'avr',
            productId: p.id,
            height: p.height
        });
    });

    /* 3. Konus / Stożek */
    const konusProducts = groups['konus'] || [];
    konusProducts.forEach((p) => {
        cols.push({
            key: 'konus_' + p.id,
            label: p.name,
            type: 'number',
            componentType: 'konus',
            productId: p.id,
            height: p.height
        });
    });

    /* 4. Płyty nakrywające — per componentType per wysokość */
    ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].forEach((ct) => {
        const prods = [...(groups[ct] || [])].sort(
            (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
        );
        const seenH = new Set();
        const ctLabels = {
            plyta_din: 'Pł. DIN',
            plyta_najazdowa: 'Pł. najazd.',
            plyta_zamykajaca: 'Pł. zamyk.',
            pierscien_odciazajacy: 'Pierśc. odciąż.'
        };
        prods.forEach((p) => {
            const h = parseInt(p.height) || 0;
            if (h > 0 && !seenH.has(h)) {
                seenH.add(h);
                const matching = prods.filter((k) => parseInt(k.height) === h);
                cols.push({
                    key: ct + '_' + h,
                    label: (ctLabels[ct] || ct) + ' H=' + h,
                    type: 'number',
                    componentType: ct,
                    height: h,
                    products: matching
                });
            }
        });
        /* produkty bez wysokości — osobna kolumna */
        const noHeight = prods.filter((p) => !parseInt(p.height));
        noHeight.forEach((p) => {
            cols.push({
                key: ct + '_' + p.id,
                label:
                    (ctLabels[ct] || ct) +
                    ' ' +
                    (p.name.length > 15 ? p.name.substring(0, 13) + '…' : p.name),
                type: 'number',
                componentType: ct,
                productId: p.id
            });
        });
    });

    /* 5. Płyty redukcyjne */
    const plytaRedProducts = groups['plyta_redukcyjna'] || [];
    plytaRedProducts.forEach((p) => {
        cols.push({
            key: 'plyta_redukcyjna_' + p.id,
            label: p.name,
            type: 'number',
            componentType: 'plyta_redukcyjna',
            productId: p.id,
            height: p.height
        });
    });

    /* 6. Kręgi — per wysokość */
    const kregProducts = [...(groups['krag'] || [])].sort(
        (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
    );
    const seenKregH = new Set();
    kregProducts.forEach((p) => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenKregH.has(h)) {
            seenKregH.add(h);
            const matching = kregProducts.filter((k) => parseInt(k.height) === h);
            cols.push({
                key: 'krag_' + h,
                label: 'Krąg H=' + h,
                type: 'number',
                componentType: 'krag',
                height: h,
                products: matching
            });
        }
    });

    /* 7. Kręgi OT — per wysokość */
    const kragOtProducts = [...(groups['krag_ot'] || [])].sort(
        (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
    );
    const seenOtH = new Set();
    kragOtProducts.forEach((p) => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenOtH.has(h)) {
            seenOtH.add(h);
            const matching = kragOtProducts.filter((k) => parseInt(k.height) === h);
            cols.push({
                key: 'krag_ot_' + h,
                label: 'Krąg OT H=' + h,
                type: 'number',
                componentType: 'krag_ot',
                height: h,
                products: matching
            });
        }
    });

    /* 8. Dennica — per wysokość lub per produkt */
    const dennicaProducts = [...(groups['dennica'] || [])].sort(
        (a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0)
    );
    const seenDenH = new Set();
    dennicaProducts.forEach((p) => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenDenH.has(h)) {
            seenDenH.add(h);
            const matching = dennicaProducts.filter((k) => parseInt(k.height) === h);
            cols.push({
                key: 'dennica_' + h,
                label: 'Dennica H=' + h,
                type: 'number',
                componentType: 'dennica',
                height: h,
                products: matching
            });
        }
    });
    dennicaProducts
        .filter((p) => !parseInt(p.height))
        .forEach((p) => {
            cols.push({
                key: 'dennica_' + p.id,
                label: 'Dennica ' + (p.name.length > 12 ? p.name.substring(0, 10) + '…' : p.name),
                type: 'number',
                componentType: 'dennica',
                productId: p.id
            });
        });

    /* 9. Osadniki */
    const osadnikProducts = groups['osadnik'] || [];
    osadnikProducts.forEach((p) => {
        cols.push({
            key: 'osadnik_' + p.id,
            label: p.name,
            type: 'number',
            componentType: 'osadnik',
            productId: p.id,
            height: p.height
        });
    });

    /* 10. Studnie Styczne (tylko dla dn='styczna') */
    if (dn === 'styczna') {
        const stycznaProducts = groups['styczna'] || [];
        stycznaProducts.forEach((p) => {
            cols.push({
                key: 'styczna_' + p.id,
                label: p.name,
                type: 'number',
                componentType: 'styczna',
                productId: p.id,
                dn: p.dn
            });
        });
    }

    /* 11. Uszczelki — ilość (auto: kręgi + 1) */
    cols.push({ key: 'uszczelka', label: 'Uszczelki', type: 'auto', componentType: 'uszczelka' });

    return cols;
}

function _excelCalcWellHeight(well) {
    return Math.round(((well.rzednaWlazu || 0) - (well.rzednaDna || 0)) * 1000);
}

function _excelCalcDennicaHeight(well) {
    let dennH = 0;
    (well.config || []).forEach((item) => {
        const p =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
        if (p && p.componentType === 'dennica' && p.height) {
            dennH += p.height * item.quantity;
        }
    });
    return dennH;
}

function _excelCalcUszczelkaCount(well) {
    let count = 0;
    (well.config || []).forEach((item) => {
        const p =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
        if (p && p.componentType === 'uszczelka') {
            count += item.quantity;
        }
    });
    return count;
}

function _excelCountProductInConfig(well, componentType, height, productId) {
    let count = 0;
    (well.config || []).forEach((item) => {
        const p =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
        if (!p) return;
        if (productId) {
            if (item.productId !== productId) return;
        } else {
            if (p.componentType !== componentType) return;
            if (height !== undefined && parseInt(p.height) !== parseInt(height)) return;
        }
        count += item.quantity;
    });
    return count;
}

function _excelGetWlazFromConfig(well) {
    for (const item of well.config || []) {
        const p =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
        if (p && p.componentType === 'wlaz') return p.id;
    }
    return '';
}

function _excelAutoSetWlaz(well) {
    if (!well) return;
    const avail = (typeof getAvailableProducts === 'function' ? getAvailableProducts(well) : [])
        .filter((p) => p.componentType === 'wlaz' && parseInt(p.dn) === parseInt(well.dn))
        .filter((p) => typeof filterByWellParams !== 'function' || filterByWellParams(p, well));
    if (avail.length === 0) return;
    const chosen = avail.find((p) => parseInt(p.height) === 15) || avail[0];
    well.config = (well.config || []).filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'wlaz');
    });
    well.config.push({ productId: chosen.id, quantity: 1, autoAdded: false });
}

/* ===== CELL STYLES (Excel-like) ===== */
function _excelCellTxt(isRight, color) {
    return `padding:${_EXCEL_CELL_PADD};border:${_EXCEL_BORDER};${_EXCEL_FONT}white-space:nowrap;${isRight ? 'text-align:right;' : ''}${color ? 'color:' + color + ';' : ''}`;
}
/** @param {number} [w] */
function _excelCellInp(w) {
    return `background:transparent;border:1px solid transparent;border-radius:2px;color:var(--text-primary);${_EXCEL_FONT}text-align:right;outline:none;transition:border-color 0.15s,background 0.15s;`;
}

/* ===== OPEN MODAL ===== */
function openExcelTableModal() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) {
        window.wells = [];
    }

    _excelMaxTransitions = _excelGetMaxTransitions();

    const existing = document.getElementById('excel-table-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-table-overlay';

    // Pozycjonuj overlay obok lewego panelu (jeśli widoczny)
    const diagramPanel = document.querySelector('.well-diagram-panel');
    const isDiagramVisible = diagramPanel && diagramPanel.offsetParent !== null;
    if (isDiagramVisible) {
        const rect = diagramPanel.getBoundingClientRect();
        overlay.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.right}px;width:calc(100vw - ${rect.right}px);height:${rect.height}px;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;`;
    } else {
        overlay.style.cssText =
            'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeExcelTableModal();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeExcelTableModal();
        if (e.key === 'Tab') _excelHandleTab(e);
        if (e.key.startsWith('Arrow')) _excelHandleArrow(e);
    });

    const modal = document.createElement('div');
    if (isDiagramVisible) {
        modal.style.cssText =
            'width:calc(100% - 1rem);height:calc(100% - 1rem);background:#0c0e14;border:1px solid rgba(255,255,255,0.06);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);';
    } else {
        modal.style.cssText =
            'width:96vw;height:96vh;background:#0c0e14;border:1px solid rgba(255,255,255,0.06);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);';
    }

    modal.innerHTML = `
        <style>
            #excel-table-container input:focus { border-color:rgba(99,102,241,0.5) !important; }
            #excel-table-container select:focus { border-color:rgba(99,102,241,0.5) !important; }
            #excel-table-container ::-webkit-scrollbar { width:6px; height:6px; }
            #excel-table-container ::-webkit-scrollbar-track { background:transparent; }
            #excel-table-container ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px; }
        </style>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:0.6rem;">
                <i data-lucide="table" style="width:16px;height:16px;color:#10b981;"></i>
                <span style="font-size:0.75rem;font-weight:700;color:#e2e8f0;letter-spacing:0.3px;">Tabela konfiguracyjna</span>
                <span id="excel-well-count" style="font-size:0.6rem;color:#64748b;padding:0.1rem 0.5rem;background:rgba(255,255,255,0.04);border-radius:3px;"></span>
            </div>
            <div style="display:flex;gap:0.4rem;align-items:center;">
                <button onclick="excelAddWellToTab()" id="excel-add-btn" title="Dodaj studnię do bieżącej zakładki" style="background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.3rem;"><i data-lucide="plus" style="width:12px;height:12px;"></i> Dodaj</button>
                <button onclick="excelSaveAll()" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.9rem;border-radius:3px;font-size:0.65rem;font-weight:700;cursor:pointer;">Gotowe (Zapisz)</button>
                <button onclick="closeExcelTableModal()" style="background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;">✕</button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0;padding:0;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;"></div>
        <div id="excel-table-container" style="flex:1;overflow:auto;background:#0c0e14;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Delegowany klik na wiersze — bardziej niezawodny niż inline onclick
    const container = document.getElementById('excel-table-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-widx]');
            if (tr) {
                const wIdx = parseInt(tr.getAttribute('data-widx'));
                if (!isNaN(wIdx)) excelSelectRow(wIdx);
            }
        });
    }

    _excelActiveTab = DN_TABS[0];
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

/* ===== WYBÓR WIERSZA ===== */
function _excelUpdateLeftPreview(wIdx) {
    const well = typeof wells !== 'undefined' && wells[wIdx] ? wells[wIdx] : null;
    if (!well) return;
    if (typeof currentWellIndex !== 'undefined') {
        currentWellIndex = wIdx;
    }
    if (typeof renderWellDiagram === 'function') {
        renderWellDiagram();
    }
}

function excelSelectRow(wIdx) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    container.querySelectorAll('tr[data-widx]').forEach((tr) => {
        const idx = parseInt(tr.getAttribute('data-widx'));
        tr.style.outline = idx === wIdx ? '2px solid rgba(99,102,241,0.6)' : 'none';
    });
    _excelUpdateLeftPreview(wIdx);
}

function closeExcelTableModal() {
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) overlay.remove();
}

/* ===== TABS (always all visible) ===== */
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
            border-bottom:2px solid ${isActive ? c.border : 'transparent'};
            background:${isActive ? c.activeBg : 'transparent'};
            color:${isActive ? c.text : '#64748b'};
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
    _excelMaxTransitions = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    const newWIdx = wells.length - 1;
    setTimeout(() => excelSelectRow(newWIdx), 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + well.name, 'success');
}

/* ===== TABLE RENDER (Excel-style) ===== */
function _excelRenderTable(dn) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;

    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    const maxTr = _excelMaxTransitions;
    const compCols = _excelBuildComponentColumns(dn);
    const hasReduction = dn === '1000';

    const dnColor = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).border;

    let html = '<table style="width:100%;border-collapse:collapse;table-layout:auto;">';

    /* THEAD — sticky */
    html += '<thead><tr style="position:sticky;top:0;z-index:20;">';

    const thBase =
        'padding:0.4rem 0.5rem;border-bottom:2px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.04);font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;';

    html += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:130px;text-align:left;border-right:2px solid rgba(255,255,255,0.08);">Nr Studni</th>`;
    html += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">Rz. Włazu</th>`;
    html += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">Rz. Dna</th>`;
    html += `<th style="${thBase}background:#161923;color:${dnColor};min-width:65px;text-align:center;">Wys.</th>`;

    for (let i = 0; i < maxTr; i++) {
        html += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:78px;text-align:right;">Rz. wlot ${i}</th>`;
        html += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:55px;text-align:center;">Kąt ${i}°</th>`;
        html += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:125px;text-align:left;">Rodzaj ${i}</th>`;
        html += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:110px;text-align:left;">Średnica ${i}</th>`;
    }

    html += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button onclick="excelRemoveTransitionColumn()" title="Usuń ostatnią kolumnę przejścia" style="background:transparent;color:#ef4444;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;transition:color 0.1s;" onmouseenter="this.style.color='#f87171'" onmouseleave="this.style.color='#ef4444'">−</button></th>`;
    html += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button onclick="excelAddTransitionColumn()" title="Dodaj kolumnę przejścia" style="background:transparent;color:#64748b;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;transition:color 0.1s;" onmouseenter="this.style.color='#94a3b8'" onmouseleave="this.style.color='#64748b'">+</button></th>`;
    html += `<th style="${thBase}background:#0f1a15;color:#6ee7b7;min-width:130px;text-align:left;">Właz</th>`;

    compCols.forEach((col) => {
        if (col.type === 'auto' || col.type === 'select')
            return; /* uszczelka + właz — osobne nagłówki niżej */
        const ct = col.componentType;
        const hc =
            ct === 'avr'
                ? '#fbbf24'
                : ct === 'krag' || ct === 'krag_ot'
                  ? '#34d399'
                  : ct === 'dennica'
                    ? '#f97316'
                    : ct === 'konus'
                      ? '#fb923c'
                      : ct === 'plyta_din' ||
                          ct === 'plyta_najazdowa' ||
                          ct === 'plyta_zamykajaca' ||
                          ct === 'pierscien_odciazajacy'
                        ? '#60a5fa'
                        : ct === 'plyta_redukcyjna'
                          ? '#f472b6'
                          : ct === 'osadnik'
                            ? '#a78bfa'
                            : ct === 'styczna'
                              ? '#f472b6'
                              : '#93c5fd';
        html += `<th style="${thBase}background:#13151f;color:${hc};min-width:62px;text-align:center;">${col.label}</th>`;
    });

    if (hasReduction) {
        html += `<th style="${thBase}background:#1a1215;color:#fca5a5;min-width:45px;text-align:center;">Red</th>`;
        html += `<th style="${thBase}background:#1a1215;color:#fca5a5;min-width:65px;text-align:center;">Min H</th>`;
    }

    html += `<th style="${thBase}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">H denn</th>`;
    html += `<th style="${thBase}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">Uszcz</th>`;
    html += `<th style="${thBase}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">Kineta</th>`;
    html += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">P.Buda</th>`;
    html += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">Akcje</th>`;

    html += '</tr></thead><tbody>';

    /* Wykryj duplikaty nazw */
    const nameCounts = {};
    tabWells.forEach((w) => { const n = (w.name || '').trim().toLowerCase(); if (n) nameCounts[n] = (nameCounts[n] || 0) + 1; });
    const dupNames = new Set(Object.keys(nameCounts).filter((n) => nameCounts[n] > 1));

    tabWells.forEach((well, idx) => {
        const wIdx = wells.indexOf(well);
        const isEven = idx % 2 === 0;
        const isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        const isDup = dupNames.has((well.name || '').trim().toLowerCase());
        const rowBg = isDup ? 'rgba(239,68,68,0.15)' : isActive ? 'rgba(99,102,241,0.08)' : isEven ? '#0e1017' : '#11131b';
        const rowBorder = isDup ? '2px solid rgba(239,68,68,0.6)' : isActive ? '2px solid rgba(99,102,241,0.6)' : 'none';
        const przejscia = well.przejscia || [];

        html += `<tr data-widx="${wIdx}" onclick="excelSelectRow(${wIdx})" style="background:${rowBg};outline:${rowBorder};transition:background 0.15s;" onmouseenter="this.style.background=isDup?'rgba(239,68,68,0.25)':isActive?'rgba(99,102,241,0.12)':'rgba(255,255,255,0.04)'" onmouseleave="this.style.background='${rowBg}'">`;

        const tdBase = `padding:${_EXCEL_CELL_PADD};border-bottom:1px solid rgba(255,255,255,0.03);border-right:1px solid rgba(255,255,255,0.04);${_EXCEL_FONT}`;

        /* Nr. Studni — edytowalny input */
        html += `<td style="${tdBase}font-weight:600;color:#cbd5e1;position:sticky;left:0;z-index:5;background:inherit;border-right:2px solid rgba(255,255,255,0.08);"><input type="text" value="${escapeHtml(well.name)}" onchange="excelOnNameChange(${wIdx},this.value)" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(125)}text-align:left;font-weight:600;color:#cbd5e1;" /></td>`;

        /* Rz. Włazu */
        html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" data-field="rzednaWlazu" value="${well.rzednaWlazu != null ? well.rzednaWlazu : ''}" onchange="excelOnRzednaChange(${wIdx})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;

        /* Rz. Dna */
        html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" data-field="rzednaDna" value="${well.rzednaDna != null ? well.rzednaDna : ''}" onchange="excelOnRzednaChange(${wIdx})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;

        /* Wys. — auto */
        const height = _excelCalcWellHeight(well);
        html += `<td style="${tdBase}text-align:center;color:${dnColor};font-weight:600;background:rgba(255,255,255,0.015);" data-cell="height-${wIdx}">${height || '—'}</td>`;

        /* Przejścia */
        for (let i = 0; i < maxTr; i++) {
            const prz = przejscia[i] || {};
            const hasExplicitRzWl = prz.rzednaWlaczenia != null && prz.rzednaWlaczenia !== '';
            const rzWlPlaceholder =
                !hasExplicitRzWl && well.rzednaDna != null ? well.rzednaDna.toFixed(3) : '';
            const przProducts =
                typeof studnieProducts !== 'undefined' && typeof getMaxPipeDn === 'function'
                    ? studnieProducts.filter(
                          (p) =>
                              p.componentType === 'przejscie' &&
                              p.active !== 0 &&
                              parseInt(p.dn) <= getMaxPipeDn(well.dn)
                      )
                    : [];

            // Znajdź obecny produkt
            const currProduct = przProducts.find((p) => p.id === prz.productId);
            // Wybierz unikalne kategorie (Rodzaje) dla tej studni
            const categories = [...new Set(przProducts.map((p) => p.category))].sort();

            // Określ aktywny rodzaj
            const activeCategory = currProduct ? currProduct.category : prz.tempCategory || '';

            let typeSel = `<select onchange="excelOnPrzejscieTypeChange(${wIdx},${i},this.value)" style="${_excelCellInp(120)}text-align:left;cursor:pointer;">`;
            typeSel += '<option value="">—</option>';
            categories.forEach((cat) => {
                typeSel += `<option value="${cat}"${activeCategory === cat ? ' selected' : ''}>${cat}</option>`;
            });
            typeSel += '</select>';

            // Wybierz średnice dostępne tylko dla wybranego rodzaju
            const availDns = activeCategory
                ? [...przProducts.filter((p) => p.category === activeCategory)].sort(
                      (a, b) => parseFloat(a.dn) - parseFloat(b.dn)
                  )
                : [];

            let dnSel = `<select onchange="excelOnPrzejscieChange(${wIdx},${i},'productId',this.value)" style="${_excelCellInp(110)}text-align:left;cursor:pointer;"${!activeCategory ? ' disabled' : ''}>`;
            dnSel += '<option value="">—</option>';
            availDns.forEach((p) => {
                const dnLabel =
                    typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn;
                dnSel += `<option value="${p.id}"${prz.productId === p.id ? ' selected' : ''}>${dnLabel}</option>`;
            });
            dnSel += '</select>';

            html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" value="${hasExplicitRzWl ? prz.rzednaWlaczenia : ''}" placeholder="${rzWlPlaceholder}" onchange="excelOnPrzejscieChange(${wIdx},${i},'rzednaWlaczenia',this.value)" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;
            html += `<td style="${tdBase}text-align:center;"><input type="number" step="1" value="${prz.angle != null ? prz.angle : ''}" onchange="excelOnPrzejscieChange(${wIdx},${i},'angle',this.value)" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(50)}text-align:center;" /></td>`;
            html += `<td style="${tdBase}text-align:left;">${typeSel}</td>`;
            html += `<td style="${tdBase}text-align:left;">${dnSel}</td>`;
        }

        html += `<td style="padding:0.3rem 0;border-bottom:1px solid rgba(255,255,255,0.03);border-right:1px solid rgba(255,255,255,0.04);font-size:0.67rem;font-family:Consolas,Menlo,monospace;text-align:center;color:#1e293b;background:#0c0e14;"></td><td style="padding:0.3rem 0;border-bottom:1px solid rgba(255,255,255,0.03);border-right:1px solid rgba(255,255,255,0.04);font-size:0.67rem;font-family:Consolas,Menlo,monospace;text-align:center;color:#1e293b;background:#0c0e14;"></td>`;
                /* Właz — użyj produktów z definicji kolumny (spójne z nagłówkiem) */
        const wlazCol = compCols.find((c) => c.componentType === 'wlaz');
        const wlazProducts = wlazCol
            ? wlazCol.products.filter(
                  (p) => typeof filterByWellParams !== 'function' || filterByWellParams(p, well)
              )
            : [];
        const wlazVal = _excelGetWlazFromConfig(well);
        let wlazSel = `<select onchange="excelOnWlazChange(${wIdx},this.value)" style="${_excelCellInp(125)}text-align:left;cursor:pointer;">`;
        wlazSel += '<option value="">—</option>';
        wlazProducts.forEach((p) => {
            const nm = p.name.length > 20 ? p.name.substring(0, 18) + '…' : p.name;
            wlazSel += `<option value="${p.id}"${wlazVal === p.id ? ' selected' : ''}>${nm}</option>`;
        });
        wlazSel += '</select>';
        html += `<td style="${tdBase}text-align:left;">${wlazSel}</td>`;

        /* Komponenty — ilości */
        compCols.forEach((col) => {
            if (col.type === 'select' || col.type === 'auto') return;
            const c = /** @type {any} */ (col);
            const count = _excelCountProductInConfig(well, c.componentType, c.height, c.productId);
            const pidArg = c.productId ? `'${c.productId}'` : 'null';
            const hArg = c.height != null ? c.height : 'null';
            html += `<td style="${tdBase}text-align:center;"><input type="number" min="0" step="1" value="${count || ''}" onchange="excelOnCompChange(${wIdx},'${c.componentType}',${hArg},this.value,${pidArg})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(50)}text-align:center;" /></td>`;
        });

        /* Redukcja */
        if (hasReduction) {
            html += `<td style="${tdBase}text-align:center;"><input type="checkbox"${well.redukcjaDN1000 ? ' checked' : ''} onchange="excelOnReductionChange(${wIdx},this.checked)" style="accent-color:#f87171;cursor:pointer;" /></td>`;
            html += `<td style="${tdBase}text-align:center;"><input type="number" min="0" step="100" value="${well.redukcjaMinH || 2500}" onchange="excelOnReductionMinHChange(${wIdx},this.value)" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(60)}text-align:center;" /></td>`;
        }

        /* H dennica — auto */
        const dennH = _excelCalcDennicaHeight(well);
        html += `<td style="${tdBase}text-align:center;color:#fbbf24;font-weight:600;background:rgba(245,158,11,0.03);" data-cell="denn-${wIdx}">${dennH || '—'}</td>`;

        /* Uszczelki — auto (z compCols) */
        const uszczCount = _excelCalcUszczelkaCount(well);
        html += `<td style="${tdBase}text-align:center;color:#f97316;font-weight:600;background:rgba(249,115,22,0.04);" data-cell="uszcz-${wIdx}">${uszczCount}</td>`;

        /* Kineta */
        let kinSel = `<select onchange="excelOnKinetaChange(${wIdx},this.value)" style="${_excelCellInp(90)}text-align:left;cursor:pointer;">`;
        KINETA_OPTIONS.forEach(([val, label]) => {
            kinSel += `<option value="${val}"${well.kineta === val ? ' selected' : ''}>${label}</option>`;
        });
        kinSel += '</select>';
        html += `<td style="${tdBase}text-align:left;">${kinSel}</td>`;

        /* Psia buda */
        html += `<td style="${tdBase}text-align:center;"><input type="checkbox"${well.psiaBuda ? ' checked' : ''} onchange="excelOnPsiaBudaChange(${wIdx},this.checked)" style="accent-color:#f59e0b;cursor:pointer;" /></td>`;

        /* Akcje: Param, Duplikuj, Usuń */
        html += `<td style="${tdBase}text-align:center;white-space:nowrap;">`;
        html += '<div style="display:flex;gap:2px;justify-content:center;">';
        html += `<button onclick="excelOpenWellParams(${wIdx})" title="Parametry" style="background:transparent;color:#818cf8;border:1px solid rgba(129,140,248,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(129,140,248,0.1)'" onmouseleave="this.style.background='transparent'">⋯</button>`;
        html += `<button onclick="excelDuplicateWell(${wIdx})" title="Duplikuj" style="background:transparent;color:#60a5fa;border:1px solid rgba(96,165,250,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(96,165,250,0.1)'" onmouseleave="this.style.background='transparent'">⧉</button>`;
        html += `<button onclick="excelDeleteWell(${wIdx})" title="Usuń" style="background:transparent;color:#f87171;border:1px solid rgba(248,113,113,0.2);padding:0.15rem 0.3rem;border-radius:2px;font-size:0.55rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(239,68,68,0.15)'" onmouseleave="this.style.background='transparent'">✕</button>`;
        html += '</div></td>';

        html += '</tr>';
    });

    /* ===== EMPTY ROW — wiersz na nową studnię ===== */
    const emptyRowBg = '#0a0c10';
    html += `<tr id="excel-empty-row" style="background:${emptyRowBg};border-top:2px dashed rgba(255,255,255,0.08);">`;

    const tdBase = `padding:${_EXCEL_CELL_PADD};border-bottom:1px solid rgba(255,255,255,0.03);border-right:1px solid rgba(255,255,255,0.04);${_EXCEL_FONT}`;
    const tdEmpty = `${tdBase}color:#334155;`;

    /* Nazwa — sticky left */
    /* Nazwa — sticky left */
    html += `<td style="${tdEmpty}position:sticky;left:0;z-index:5;background:${emptyRowBg};border-right:2px solid rgba(255,255,255,0.08);"><input type="text" placeholder="Nazwa studni… (Enter/zmiana dodaje)" id="excel-empty-name" onkeydown="if(event.key==='Enter')excelCreateFromEmpty()" onblur="excelCreateFromEmpty(event)" onfocus="excelCellFocus(this)" style="${_excelCellInp(125)}text-align:left;color:#94a3b8;" /></td>`;

    /* Rz. Włazu */
    html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzw" onfocus="excelCellFocus(this)" style="${_excelCellInp(72)}" /></td>`;

    /* Rz. Dna */
    html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzd" onfocus="excelCellFocus(this)" style="${_excelCellInp(72)}" /></td>`;

    /* Wys. — placeholder */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="height-empty">—</td>`;

    /* Przejścia — puste */
    for (let i = 0; i < maxTr; i++) {
        html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" disabled style="${_excelCellInp(72)}opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:center;"><input type="number" step="1" placeholder="—" disabled style="${_excelCellInp(50)}opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(120)}opacity:0.3;"><option value="">—</option></select></td>`;
        html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(110)}opacity:0.3;"><option value="">—</option></select></td>`;
    }

    html += `<td style="padding:0.3rem 0;border-bottom:1px solid rgba(255,255,255,0.03);border-right:1px solid rgba(255,255,255,0.04);font-size:0.67rem;font-family:Consolas,Menlo,monospace;color:#334155;background:#0a0c10;"></td><td style="padding:0.3rem 0;border-bottom:1px solid rgba(255,255,255,0.03);border-right:1px solid rgba(255,255,255,0.04);font-size:0.67rem;font-family:Consolas,Menlo,monospace;color:#334155;background:#0a0c10;"></td>`;
            /* Właz */
    html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(125)}opacity:0.3;"><option value="">—</option></select></td>`;

    /* Komponenty */
    compCols.forEach((col) => {
        if (col.type === 'select' || col.type === 'auto') return;
        html += `<td style="${tdEmpty}text-align:center;"><input type="number" min="0" step="1" placeholder="—" disabled style="${_excelCellInp(50)}opacity:0.3;" /></td>`;
    });

    /* Redukcja */
    if (hasReduction) {
        html += `<td style="${tdEmpty}text-align:center;"><input type="checkbox" disabled style="opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:center;"><input type="number" min="0" step="100" placeholder="2500" disabled style="${_excelCellInp(60)}opacity:0.3;" /></td>`;
    }

    /* Auto-kolumny — placeholder */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="denn-empty">—</td>`;
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="uszcz-empty">—</td>`;

    /* Kineta */
    html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(90)}opacity:0.3;"><option value="">—</option></select></td>`;

    /* P.Buda */
    html += `<td style="${tdEmpty}text-align:center;"><input type="checkbox" disabled style="opacity:0.3;" /></td>`;

    /* Akcje */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;font-size:0.6rem;" data-cell="empty-actions">nowa</td>`;

    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
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
        _excelMaxTransitions = _excelGetMaxTransitions();
        _excelRenderTabs();
        _excelRenderTable(_excelActiveTab);
        _excelUpdateWellCount();
        _excelDebouncedRefresh();
        showToast('Dodano: ' + autoName, 'success');
    } finally {
        setTimeout(() => {
            _excelCreatingLock = false;
            const newIdx = wells.length - 1;
            const row = document.querySelector(`tr[data-widx="${newIdx}"]`);
            const rzwEl = row && row.querySelector('input[data-field="rzednaWlazu"]');
            if (rzwEl) { rzwEl.focus(); rzwEl.select(); }
        }, 100);
    }
}

/* ===== CELL FOCUS (Excel highlight) ===== */
function excelCellFocus(el) {
    el.style.outline = '1px solid rgba(99,102,241,0.5)';
    el.style.background = 'rgba(99,102,241,0.06)';
    el.parentElement.style.background = 'rgba(99,102,241,0.04)';
}
function excelCellBlur(el) {
    el.style.outline = 'none';
    el.style.background = 'transparent';
    const tr = el.closest('tr');
    if (tr) el.parentElement.style.background = '';
}

/* ===== TAB KEY NAVIGATION ===== */
function _excelHandleTab(e) {
    const target = e.target;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'SELECT')) return;

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const inputs = Array.from(
        container.querySelectorAll('input:not([disabled]), select:not([disabled])')
    );
    const idx = inputs.indexOf(target);
    if (idx === -1) return;

    e.preventDefault();
    const next = e.shiftKey ? inputs[idx - 1] : inputs[idx + 1];
    if (next) {
        next.focus();
        if (next.tagName === 'INPUT') next.select();
    }
}

/* ===== ARROW KEY NAVIGATION (Excel-like) ===== */
function _excelHandleArrow(e) {
    const target = e.target;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'SELECT')) return;

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const tr = target.closest('tr');
    if (!tr) return;

    const rows = Array.from(container.querySelectorAll('tbody tr'));
    const currentRowIdx = rows.indexOf(tr);
    if (currentRowIdx === -1) return;

    const rowEls = Array.from(tr.querySelectorAll('input:not([disabled]), select:not([disabled])'));
    const colIdx = rowEls.indexOf(target);
    if (colIdx === -1) return;

    let next = null;

    if (e.key === 'ArrowRight') {
        next = rowEls[colIdx + 1] || null;
    } else if (e.key === 'ArrowLeft') {
        next = rowEls[colIdx - 1] || null;
    } else if (e.key === 'ArrowDown') {
        const nextRow = rows[currentRowIdx + 1];
        if (nextRow) {
            const nextEls = Array.from(
                nextRow.querySelectorAll('input:not([disabled]), select:not([disabled])')
            );
            next = nextEls[Math.min(colIdx, nextEls.length - 1)] || null;
        }
    } else if (e.key === 'ArrowUp') {
        const prevRow = rows[currentRowIdx - 1];
        if (prevRow) {
            const prevEls = Array.from(
                prevRow.querySelectorAll('input:not([disabled]), select:not([disabled])')
            );
            next = prevEls[Math.min(colIdx, prevEls.length - 1)] || null;
        }
    }

    if (next) {
        e.preventDefault();
        next.focus();
        if (next.tagName === 'INPUT') next.select();
    }
}

/* ===== HANDLERS ===== */
function excelOnRzednaChange(wIdx) {
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (!row) return;
    const rzWlazuInput = row.querySelector('input[data-field="rzednaWlazu"]');
    const rzDnaInput = row.querySelector('input[data-field="rzednaDna"]');
    const rzWlazu = rzWlazuInput ? parseFloat(rzWlazuInput.value) || null : null;
    const rzDna = rzDnaInput ? parseFloat(rzDnaInput.value) || null : null;

    /* Walidacja: rzędna włazu musi być większa od rzędnej dna */
    if (rzWlazu !== null && rzDna !== null && rzWlazu <= rzDna) {
        rzWlazuInput.style.outline = '1px solid #ef4444';
        rzDnaInput.style.outline = '1px solid #ef4444';
        showToast('Rzędna włazu musi być większa od rzędnej dna', 'error');
    } else {
        if (rzWlazuInput) rzWlazuInput.style.outline = '';
        if (rzDnaInput) rzDnaInput.style.outline = '';
    }

    wells[wIdx].rzednaWlazu = rzWlazu;
    wells[wIdx].rzednaDna = rzDna;
    _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

/* ===== DODAWANIE KOLUMNY PRZEJŚCIA ===== */

/* ===== USUWANIE KOLUMNY PRZEJŚCIA ===== */
function excelRemoveTransitionColumn() {
    if (_excelMaxTransitions <= 1 && wells.length > 0) {
        showToast('Nie można usunąć — minimum 1 kolumna przejścia', 'error');
        return;
    }
    const lastIdx = _excelMaxTransitions - 1;
    let hasData = false;
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        for (const w of wells) {
            if (w.przejscia && w.przejscia[lastIdx]) {
                const p = w.przejscia[lastIdx];
                if (p.rzednaWlaczenia !== null && p.rzednaWlaczenia !== '' || p.productId !== null && p.productId !== '' || (p.kat && p.kat !== 0)) {
                    hasData = true;
                    break;
                }
            }
        }
    }
    if (hasData) {
        showToast('Nie można usunąć — ostatnia kolumna zawiera dane', 'error');
        return;
    }
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (w.przejscia && w.przejscia.length > 0) {
                w.przejscia.pop();
            }
        });
    }
    _excelMaxTransitions = Math.max(0, _excelMaxTransitions - 1);
    _excelRenderTable(_excelActiveTab);
    _excelDebouncedRefresh();
    showToast('Usunięto kolumnę przejścia', 'info');
}

function excelAddTransitionColumn() {
    _excelMaxTransitions = (_excelMaxTransitions || 1) + 1;
    /* Dodaj puste przejście do każdej studni, która ma mniej niż nowe max */
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (!w.przejscia) w.przejscia = [];
            while (w.przejscia.length < _excelMaxTransitions) {
                w.przejscia.push(_excelCreatePrzejscie());
            }
        });
    }
    _excelRenderTable(_excelActiveTab);
    _excelDebouncedRefresh();
    showToast('Dodano kolumnę przejścia', 'info');
}
function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    while (wells[wIdx].przejscia.length <= trIdx) {
        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
    }
    const prz = wells[wIdx].przejscia[trIdx];
    prz[field] = field === 'angle' ? parseFloat(value) || 0 : value || null;
    if (field === 'angle') {
        prz.angleExecution = parseFloat(prz.angle) || 0;
        prz.angleGony = (parseFloat(prz.angle) || 0).toFixed(2);
        prz.flowType = (parseFloat(prz.angle) || 0) === 0 ? 'WYLOT' : 'WLOT';
    }
    /* Nadaj displayIndex */
    wells[wIdx].przejscia.forEach((p, i) => {
        p.displayIndex = i;
    });
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnPrzejscieTypeChange(wIdx, trIdx, value) {
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    while (wells[wIdx].przejscia.length <= trIdx) {
        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
    }
    wells[wIdx].przejscia[trIdx].tempCategory = value || '';
    // Jeśli wyczyszczono rodzaj, usuń również productId
    if (!value) {
        wells[wIdx].przejscia[trIdx].productId = '';
    } else {
        // Sprawdź, czy dotychczas wybrany produkt pasuje do nowego rodzaju
        const currProduct = studnieProducts.find(
            (p) => p.id === wells[wIdx].przejscia[trIdx].productId
        );
        if (!currProduct || currProduct.category !== value) {
            wells[wIdx].przejscia[trIdx].productId = ''; // wyczyść, bo rodzaj się zmienił
        }
    }
    // Renderuj ponownie tabelę, by zaktualizować listę średnic (DN)
    _excelRenderTable(_excelActiveTab);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnWlazChange(wIdx, productId) {
    const well = wells[wIdx];
    well.config = (well.config || []).filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'wlaz');
    });
    if (productId) _excelInsertConfigItem(well, 'wlaz', productId, 1);
    _excelMarkManual(well);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function _excelMarkManual(well) {
    if (!well) return;
    well.autoLocked = true;
    well.configSource = 'MANUAL';
}

function _excelInsertConfigItem(well, componentType, productId, qty) {
    /* Konus + PEHD wkładka — blokada jak w głównym konfiguratorze */
    if (componentType === 'konus' && well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') {
        showToast('Nie można dodać konusa przy aktywnej wkładce PEHD zwieńczenia.', 'error');
        return;
    }
    const topTypes = ['wlaz', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'konus', 'pierscien_odciazajacy'];
    const bottomTypes = ['dennica', 'kineta', 'styczna'];
    const reliefTypes = ['pierscien_odciazajacy', 'plyta_zamykajaca', 'plyta_najazdowa'];
    if (topTypes.includes(componentType)) {
        /* Właz: tylko wstaw, nie ruszaj reszty zakończeń */
        if (componentType === 'wlaz') {
            const wlazIdx = well.config.findIndex((item) => {
                const p = typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === item.productId)
                    : null;
                return p && p.componentType === 'wlaz';
            });
            const insertAt = wlazIdx >= 0 ? wlazIdx + 1 : 0;
            well.config.splice(insertAt, 0, { productId, quantity: qty, autoAdded: false });
            return;
        }
        /* Jeśli dodajemy element odciążający: zachowaj partnera, usuń resztę */
        if (reliefTypes.includes(componentType)) {
            well.config = well.config.filter((item) => {
                const p = typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === item.productId)
                    : null;
                if (!p) return true;
                if (reliefTypes.includes(p.componentType)) {
                    return p.componentType !== componentType;
                }
                return !topTypes.includes(p.componentType);
            });
        } else {
            /* Nie-odciążający (konus/plyta_din): usuń wszystkie zakończenia */
            well.config = well.config.filter((item) => {
                const p = typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === item.productId)
                    : null;
                return !(p && topTypes.includes(p.componentType));
            });
        }
        /* Wstaw za włazem (jeśli istnieje), żeby nie rozbić kolejności góra-dół */
        const wlazIdx = well.config.findIndex((item) => {
            const p = typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
            return p && p.componentType === 'wlaz';
        });
        const insertAt = wlazIdx >= 0 ? wlazIdx + 1 : 0;
        well.config.splice(insertAt, 0, { productId, quantity: qty, autoAdded: false });
        /* Auto-uzupełnij komplet odciążający */
        if (typeof window.ensureReliefRingPair === 'function') {
            window.ensureReliefRingPair(well);
        }
    } else if (bottomTypes.includes(componentType)) {
        well.config.push({ productId, quantity: qty, autoAdded: false });
    } else {
        const topTypesForMiddle = ['wlaz', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'konus', 'pierscien_odciazajacy'];
        /* Szukaj płyty redukcyjnej — wpływa na pozycję kręgów */
        const plateIdx = well.config.findIndex((item) => {
            const p = typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === item.productId)
                : null;
            return p && p.componentType === 'plyta_redukcyjna';
        });
        if (plateIdx >= 0) {
            const prod = typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === productId)
                : null;
            const isRedDn = prod && String(prod.dn) === '1000';
            if (isRedDn) {
                /* Krąg DN1000 — wstaw NAD płytą redukcyjną, za topClosure */
                let insertIdx = 0;
                for (let i = 0; i < plateIdx; i++) {
                    const p = typeof studnieProducts !== 'undefined'
                        ? studnieProducts.find((pr) => pr.id === well.config[i].productId)
                        : null;
                    if (!p || !topTypesForMiddle.includes(p.componentType)) {
                        insertIdx = i;
                        break;
                    }
                    insertIdx = i + 1;
                }
                well.config.splice(insertIdx, 0, { productId, quantity: qty, autoAdded: false });
            } else {
                /* Krąg głównego DN — wstaw ZA płytą redukcyjną */
                well.config.splice(plateIdx + 1, 0, { productId, quantity: qty, autoAdded: false });
            }
        } else {
            /* Brak płyty redukcyjnej — wstaw za topClosure, przed bottom */
            let insertAt = well.config.length;
            for (let i = 0; i < well.config.length; i++) {
                const p = typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === well.config[i].productId)
                    : null;
                if (p && bottomTypes.includes(p.componentType)) {
                    insertAt = i;
                    break;
                }
                if (!p || !topTypesForMiddle.includes(p.componentType)) {
                    insertAt = i;
                    break;
                }
            }
            well.config.splice(insertAt, 0, { productId, quantity: qty, autoAdded: false });
        }
    }
}

function excelOnCompChange(wIdx, componentType, height, value, productId) {
    const well = wells[wIdx];
    const newQty = parseInt(value) || 0;

    well.config = (well.config || []).filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return true;
        if (productId) return item.productId !== productId;
        if (p.componentType !== componentType) return true;
        if (height !== undefined && parseInt(p.height) !== parseInt(height)) return true;
        return false;
    });

    if (newQty > 0) {
        let candidates;
        if (productId) {
            candidates = (
                typeof getAvailableProducts === 'function'
                    ? getAvailableProducts(well)
                    : studnieProducts
            ).filter((p) => p.id === productId);
            if (typeof filterByWellParams === 'function')
                candidates = candidates.filter((p) => filterByWellParams(p, well));
        } else {
            candidates = (
                typeof getAvailableProducts === 'function'
                    ? getAvailableProducts(well)
                    : studnieProducts
            ).filter(
                (p) => p.componentType === componentType && parseInt(p.dn) === parseInt(well.dn)
            );
            if (height !== undefined)
                candidates = candidates.filter((p) => parseInt(p.height) === parseInt(height));
            if (typeof filterByWellParams === 'function')
                candidates = candidates.filter((p) => filterByWellParams(p, well));
        }
        /* Dodaj jeden wpis z pełną ilością (zamiast wielu wpisów po 1) */
        if (candidates.length > 0) {
            _excelInsertConfigItem(well, componentType, candidates[0].id, newQty);
        }
    }
    _excelMarkManual(well);

    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnKinetaChange(wIdx, value) {
    wells[wIdx].kineta = value;
    if (typeof syncKineta === 'function') syncKineta(wells[wIdx]);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnPsiaBudaChange(wIdx, checked) {
    const well = wells[wIdx];
    if (checked) {
        /* Backup parametrów przed włączeniem */
        well._psiaBudaBackup = {
            kineta: well.kineta || 'beton',
            spocznik: well.spocznik || 'beton',
            spocznikH: well.spocznikH || '1/2'
        };
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    } else {
        /* Przywróć backup */
        if (well._psiaBudaBackup) {
            well.kineta = well._psiaBudaBackup.kineta;
            well.spocznik = well._psiaBudaBackup.spocznik;
            well.spocznikH = well._psiaBudaBackup.spocznikH;
            delete well._psiaBudaBackup;
        }
    }
    well.psiaBuda = checked;
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnReductionChange(wIdx, checked) {
    wells[wIdx].redukcjaDN1000 = checked;
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

function excelOnReductionMinHChange(wIdx, value) {
    wells[wIdx].redukcjaMinH = parseInt(value) || 2500;
    _excelUpdateLeftPreview(wIdx);
    _excelDebouncedRefresh();
}

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

/* ===== SAVE ===== */
function excelSaveAll() {
    if (typeof refreshAll === 'function') refreshAll();
    showToast('Zapisano zmiany w tabeli', 'success');
    closeExcelTableModal();
}

/* ===== PARAM. BUTTON — popup parametrów studni w Excelu ===== */
function excelOpenWellParams(wIdx) {
    const well = wells[wIdx];
    if (!well) return;

    const existing = document.getElementById('excel-params-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-params-popup';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.style.cssText = 'width:520px;max-height:90vh;background:#0c0e14;border:1px solid rgba(255,255,255,0.06);border-radius:6px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);';

    const save = () => {
        _excelDebouncedRefresh();
        _excelRenderTable(_excelActiveTab);
        showToast('Parametry zaktualizowane', 'success');
        overlay.remove();
    };

    const sel = (id, val, opts) => opts.map((o) => `<option value="${o}"${val === o ? ' selected' : ''}>${o}</option>`).join('');
    const inp = (id, val) => `<input type="text" id="ep-${id}" value="${escapeHtml(String(val ?? ''))}" style="background:#161923;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;padding:0.3rem 0.5rem;font-size:0.7rem;width:100%;outline:none;transition:border-color 0.15s;" onfocus="this.style.borderColor=\'rgba(99,102,241,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.08)\'" />`;
    const selEl = (id, val, opts) => `<select id="ep-${id}" style="background:#161923;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;padding:0.3rem 0.5rem;font-size:0.7rem;width:100%;outline:none;cursor:pointer;">${sel(id, val, opts)}</select>`;

    const f = (label, html) => `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;"><span style="min-width:130px;font-size:0.7rem;color:#94a3b8;flex-shrink:0;">${label}</span>${html}</div>`;

    const materialOpts = ['betonowa', 'zelbetowa'];
    const takNie = ['brak', 'tak'];

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <span style="font-size:0.8rem;font-weight:700;color:#e2e8f0;">Parametry: ${escapeHtml(well.name)}</span>
            <button onclick="document.getElementById('excel-params-popup').remove()" style="background:transparent;color:#64748b;border:none;cursor:pointer;font-size:1.1rem;">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0.8rem;display:flex;flex-direction:column;gap:0.3rem;">
            ${f('Nadbudowa', selEl('nadbudowa', well.nadbudowa || 'betonowa', materialOpts))}
            ${f('Dennica material', selEl('dennicaMaterial', well.dennicaMaterial || 'betonowa', materialOpts))}
            ${f('Klasa betonu', inp('klasaBetonu', well.klasaBetonu))}
            ${f('Stopnie/drabinka', selEl('stopnie', well.stopnie || 'brak', ['brak', 'nierdzewna', 'ocynkowana', 'drabinka']))}
            ${f('Agresja chemiczna', selEl('agresjaChemiczna', well.agresjaChemiczna || 'brak', ['brak', 'X0', 'XA1', 'XA2', 'XA3']))}
            ${f('Agresja mrozowa', selEl('agresjaMrozowa', well.agresjaMrozowa || 'brak', ['brak', 'XF1', 'XF2', 'XF3', 'XF4']))}
            ${f('Klasa nośności (korpus)', inp('klasaNosnosci_korpus', well.klasaNosnosci_korpus))}
            ${f('Klasa nośności (zwień.)', inp('klasaNosnosci_zwienczenie', well.klasaNosnosci_zwienczenie))}
            ${f('Malowanie wewnątrz', selEl('malowanieW', well.malowanieW || 'brak', ['brak', 'bitum', 'epoksyd', 'ftalowy']))}
            ${f('Malowanie zewnątrz', selEl('malowanieZ', well.malowanieZ || 'brak', ['brak', 'bitum', 'epoksyd', 'ftalowy']))}
            ${f('Wkładka dennicy', selEl('wkladkaDennica', well.wkladkaDennica || 'brak', ['brak', 'PEHD', 'PP', 'PVC']))}
            ${f('Wkładka nadbudowy', selEl('wkladkaNadbudowa', well.wkladkaNadbudowa || 'brak', ['brak', 'PEHD', 'PP', 'PVC']))}
            ${f('Wkładka zwieńczenia', selEl('wkladkaZwienczenie', well.wkladkaZwienczenie || 'brak', ['brak', 'PEHD', 'PP', 'PVC']))}
            ${f('Spocznik', selEl('spocznik', well.spocznik || 'brak', ['brak', 'lewy', 'prawy', 'obustronny']))}
            ${f('Spocznik H (mm)', inp('spocznikH', well.spocznikH))}
            ${f('Usytuowanie', selEl('usytuowanie', well.usytuowanie || '', ['', 'w terenie', 'w drodze', 'w chodniku']))}
            ${f('Uszczelka', selEl('uszczelka', well.uszczelka || '', ['', 'guma', 'EPDM', 'silikon']))}
            ${f('Magazyn', selEl('magazyn', well.magazyn || '', ['', 'WL', 'KLB']))}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.5rem 0.8rem;background:#10131a;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <button onclick="document.getElementById('excel-params-popup').remove()" style="background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);padding:0.35rem 1rem;border-radius:4px;font-size:0.7rem;cursor:pointer;">Anuluj</button>
            <button onclick="(function(){
                const w = wells[${wIdx}]; if(!w)return;
                ['nadbudowa','dennicaMaterial','klasaBetonu','stopnie','agresjaChemiczna','agresjaMrozowa','klasaNosnosci_korpus','klasaNosnosci_zwienczenie','malowanieW','malowanieZ','wkladkaDennica','wkladkaNadbudowa','wkladkaZwienczenie','spocznik','usytuowanie','uszczelka','magazyn','spocznikH'].forEach((f) => {
                    const el = document.getElementById('ep-'+f);
                    if(el) w[f] = el.value;
                });
                const hEl = document.getElementById('ep-spocznikH');
                if(hEl) w.spocznikH = parseFloat(hEl.value) || null;
                _excelDebouncedRefresh();
                _excelRenderTable(_excelActiveTab);
                document.getElementById('excel-params-popup').remove();
                showToast('Parametry zaktualizowane', 'success');
            })()" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:0.35rem 1.2rem;border-radius:4px;font-size:0.7rem;font-weight:700;cursor:pointer;">Zapisz</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/* ===== EDYCJA NAZWY STUDNI ===== */
function excelOnNameChange(wIdx, value) {
    /* Odśwież tabelę po zmianie nazwy — wykryje duplikaty */
    _excelRenderTable(_excelActiveTab);
    const name = (value || '').trim();
    if (!name) return;
    wells[wIdx].name = name;
    wells[wIdx].numer = name.replace(/ (PRE|UTH)$/, '');
    if (typeof autoUpdateWellName === 'function') {
        autoUpdateWellName(wells[wIdx], wIdx);
    }
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
    _excelMaxTransitions = _excelGetMaxTransitions();
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
    _excelMaxTransitions = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    _excelDebouncedRefresh();
    showToast('Studnia usunięta', 'info');
}
