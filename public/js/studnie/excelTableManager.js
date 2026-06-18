/* ===== EXCEL TABLE MANAGER — Tabela konfiguracyjna studni (Excel-style) ===== */

let _excelMaxTransitions = 1;
let _excelActiveTab = '1000';
let _excelFocusedCell = null;

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
    '1000': { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', text: '#93c5fd', activeBg: 'rgba(59,130,246,0.25)' },
    '1200': { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#6ee7b7', activeBg: 'rgba(16,185,129,0.25)' },
    '1500': { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#fbbf24', activeBg: 'rgba(245,158,11,0.25)' },
    '2000': { bg: 'rgba(168,85,247,0.12)', border: '#a855f7', text: '#c4b5fd', activeBg: 'rgba(168,85,247,0.25)' },
    '2500': { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#fca5a5', activeBg: 'rgba(239,68,68,0.25)' },
    'styczne': { bg: 'rgba(236,72,153,0.12)', border: '#ec4899', text: '#f9a8d4', activeBg: 'rgba(236,72,153,0.25)' }
};

const _EXCEL_BORDER = '1px solid rgba(255,255,255,0.07)';
const _EXCEL_CELL_PADD = '0.3rem 0.45rem';
const _EXCEL_FONT = 'font-size:0.67rem;font-family:Consolas,Menlo,monospace;';

function _excelWellMatchesTab(well, tab) {
    if (tab === 'styczne') return well.dn === 'styczna';
    return String(well.dn) === String(tab);
}

function _excelGetMaxTransitions() {
    let max = 1;
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach(w => {
            if (w.przejscia && w.przejscia.length > max) max = w.przejscia.length;
        });
    }
    return Math.max(max, _excelMaxTransitions);
}

function _excelGetComponentsForDn(dn) {
    if (typeof studnieProducts === 'undefined' || !studnieProducts) return {};
    const mag = (typeof wells !== 'undefined' && wells.length > 0) ? (wells[0].magazyn || 'Kluczbork') : 'Kluczbork';
    const isWl = mag.includes('oc') || mag.includes('Włoc');
    const field = isWl ? 'magazynWL' : 'magazynKLB';

    let products = studnieProducts.filter(p => {
        const val = p[field];
        return val === 1 || val === '1' || val === undefined;
    });

    if (dn === 'styczna') {
        products = products.filter(p => p.dn === 'styczna' || p.dn === null || p.componentType === 'styczna');
    } else {
        products = products.filter(p => parseInt(p.dn) === parseInt(dn) || p.dn === null);
    }

    const groups = {};
    products.forEach(p => {
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
        cols.push({ key: 'wlaz', label: 'Właz', type: 'select', componentType: 'wlaz', products: wlazProducts });
    }

    /* 2. AVR / Pierścienie — per produkt (osobna kolumna każdy) */
    const avrProducts = groups['avr'] || [];
    avrProducts.forEach(p => {
        const nameShort = p.name.replace(/AVR\s*/i, '').trim() || p.id;
        cols.push({ key: 'avr_' + p.id, label: 'AVR ' + nameShort, type: 'number', componentType: 'avr', productId: p.id, height: p.height });
    });

    /* 3. Konus / Stożek */
    const konusProducts = groups['konus'] || [];
    konusProducts.forEach(p => {
        cols.push({ key: 'konus_' + p.id, label: p.name, type: 'number', componentType: 'konus', productId: p.id, height: p.height });
    });

    /* 4. Płyty nakrywające — per componentType per wysokość */
    ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].forEach(ct => {
        const prods = (groups[ct] || []).sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
        const seenH = new Set();
        const ctLabels = {
            plyta_din: 'Pł. DIN', plyta_najazdowa: 'Pł. najazd.', plyta_zamykajaca: 'Pł. zamyk.', pierscien_odciazajacy: 'Pierśc. odciąż.'
        };
        prods.forEach(p => {
            const h = parseInt(p.height) || 0;
            if (h > 0 && !seenH.has(h)) {
                seenH.add(h);
                const matching = prods.filter(k => parseInt(k.height) === h);
                cols.push({ key: ct + '_' + h, label: (ctLabels[ct] || ct) + ' H=' + h, type: 'number', componentType: ct, height: h, products: matching });
            }
        });
        /* produkty bez wysokości — osobna kolumna */
        const noHeight = prods.filter(p => !parseInt(p.height));
        noHeight.forEach(p => {
            cols.push({ key: ct + '_' + p.id, label: (ctLabels[ct] || ct) + ' ' + (p.name.length > 15 ? p.name.substring(0, 13) + '…' : p.name), type: 'number', componentType: ct, productId: p.id });
        });
    });

    /* 5. Płyty redukcyjne */
    const plytaRedProducts = groups['plyta_redukcyjna'] || [];
    plytaRedProducts.forEach(p => {
        cols.push({ key: 'plyta_redukcyjna_' + p.id, label: p.name, type: 'number', componentType: 'plyta_redukcyjna', productId: p.id, height: p.height });
    });

    /* 6. Kręgi — per wysokość */
    const kregProducts = (groups['krag'] || []).sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
    const seenKregH = new Set();
    kregProducts.forEach(p => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenKregH.has(h)) {
            seenKregH.add(h);
            const matching = kregProducts.filter(k => parseInt(k.height) === h);
            cols.push({ key: 'krag_' + h, label: 'Krąg H=' + h, type: 'number', componentType: 'krag', height: h, products: matching });
        }
    });

    /* 7. Kręgi OT — per wysokość */
    const kragOtProducts = (groups['krag_ot'] || []).sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
    const seenOtH = new Set();
    kragOtProducts.forEach(p => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenOtH.has(h)) {
            seenOtH.add(h);
            const matching = kragOtProducts.filter(k => parseInt(k.height) === h);
            cols.push({ key: 'krag_ot_' + h, label: 'Krąg OT H=' + h, type: 'number', componentType: 'krag_ot', height: h, products: matching });
        }
    });

    /* 8. Dennica — per wysokość lub per produkt */
    const dennicaProducts = (groups['dennica'] || []).sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
    const seenDenH = new Set();
    dennicaProducts.forEach(p => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenDenH.has(h)) {
            seenDenH.add(h);
            const matching = dennicaProducts.filter(k => parseInt(k.height) === h);
            cols.push({ key: 'dennica_' + h, label: 'Dennica H=' + h, type: 'number', componentType: 'dennica', height: h, products: matching });
        }
    });
    dennicaProducts.filter(p => !parseInt(p.height)).forEach(p => {
        cols.push({ key: 'dennica_' + p.id, label: 'Dennica ' + (p.name.length > 12 ? p.name.substring(0, 10) + '…' : p.name), type: 'number', componentType: 'dennica', productId: p.id });
    });

    /* 9. Osadniki */
    const osadnikProducts = groups['osadnik'] || [];
    osadnikProducts.forEach(p => {
        cols.push({ key: 'osadnik_' + p.id, label: p.name, type: 'number', componentType: 'osadnik', productId: p.id, height: p.height });
    });

    /* 10. Studnie Styczne (tylko dla dn='styczna') */
    if (dn === 'styczna') {
        const stycznaProducts = groups['styczna'] || [];
        stycznaProducts.forEach(p => {
            cols.push({ key: 'styczna_' + p.id, label: p.name, type: 'number', componentType: 'styczna', productId: p.id, dn: p.dn });
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
    const totalMm = _excelCalcWellHeight(well);
    let compMm = 0;
    (well.config || []).forEach(item => {
        const p = (typeof studnieProducts !== 'undefined') ? studnieProducts.find(pr => pr.id === item.productId) : null;
        if (p && p.height) compMm += p.height * item.quantity;
    });
    const overlap = well.psiaBuda ? 100 : 0;
    return Math.max(0, totalMm - compMm + overlap);
}

function _excelCalcUszczelkaCount(well) {
    let kragCount = 0;
    (well.config || []).forEach(item => {
        const p = (typeof studnieProducts !== 'undefined') ? studnieProducts.find(pr => pr.id === item.productId) : null;
        if (p && ['krag', 'krag_ot'].includes(p.componentType)) {
            kragCount += item.quantity;
        }
    });
    return kragCount + 1;
}

function _excelCountProductInConfig(well, componentType, height, productId) {
    let count = 0;
    (well.config || []).forEach(item => {
        const p = (typeof studnieProducts !== 'undefined') ? studnieProducts.find(pr => pr.id === item.productId) : null;
        if (!p) return;
        if (productId) { if (item.productId !== productId) return; }
        else {
            if (p.componentType !== componentType) return;
            if (height !== undefined && parseInt(p.height) !== parseInt(height)) return;
        }
        count += item.quantity;
    });
    return count;
}

function _excelGetWlazFromConfig(well) {
    for (const item of (well.config || [])) {
        const p = (typeof studnieProducts !== 'undefined') ? studnieProducts.find(pr => pr.id === item.productId) : null;
        if (p && p.componentType === 'wlaz') return p.id;
    }
    return '';
}

/* ===== CELL STYLES (Excel-like) ===== */
function _excelCellTxt(isRight, color) {
    return `padding:${_EXCEL_CELL_PADD};border:${_EXCEL_BORDER};${_EXCEL_FONT}white-space:nowrap;${isRight ? 'text-align:right;' : ''}${color ? 'color:' + color + ';' : ''}`;
}
function _excelCellInp(width) {
    return `width:${width || 65}px;background:transparent;border:1px solid transparent;border-radius:0;padding:0.15rem 0.3rem;color:var(--text-primary);${_EXCEL_FONT}text-align:right;outline:none;transition:border-color 0.1s;background:transparent;`;
}

/* ===== OPEN MODAL ===== */
function openExcelTableModal() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) {
        window.wells = [];
    }

    _excelMaxTransitions = _excelGetMaxTransitions();

    let existing = document.getElementById('excel-table-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-table-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';

    overlay.addEventListener('click', e => { if (e.target === overlay) closeExcelTableModal(); });
    overlay.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeExcelTableModal();
        if (e.key === 'Tab') _excelHandleTab(e);
        if (e.key.startsWith('Arrow')) _excelHandleArrow(e);
    });

    const modal = document.createElement('div');
    modal.style.cssText = 'width:96vw;height:96vh;background:#0c0e14;border:1px solid rgba(255,255,255,0.06);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);';

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:0.6rem;">
                <i data-lucide="table" style="width:16px;height:16px;color:#10b981;"></i>
                <span style="font-size:0.75rem;font-weight:700;color:#e2e8f0;letter-spacing:0.3px;">Tabela konfiguracyjna</span>
                <span id="excel-well-count" style="font-size:0.6rem;color:#64748b;padding:0.1rem 0.5rem;background:rgba(255,255,255,0.04);border-radius:3px;"></span>
            </div>
            <div style="display:flex;gap:0.4rem;align-items:center;">
                <button onclick="excelAddWellToTab()" id="excel-add-btn" title="Dodaj studnię do bieżącej zakładki" style="background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.3rem;"><i data-lucide="plus" style="width:12px;height:12px;"></i> Dodaj</button>
                <button onclick="excelSaveAll()" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.9rem;border-radius:3px;font-size:0.65rem;font-weight:700;cursor:pointer;">Zapisz</button>
                <button onclick="closeExcelTableModal()" style="background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;">✕</button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0;padding:0;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;"></div>
        <div id="excel-table-container" style="flex:1;overflow:auto;background:#0c0e14;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    _excelActiveTab = DN_TABS[0];
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
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
    wells.forEach(w => {
        const key = w.dn === 'styczna' ? 'styczne' : String(w.dn);
        dnCounts[key] = (dnCounts[key] || 0) + 1;
    });

    let html = '';
    DN_TABS.forEach(tab => {
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
        well = createNewWell(null, dn);
    } else {
        well = {
            id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            name: (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) + ' (#' + (wells.length + 1) + ')',
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
    _excelMaxTransitions = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    showToast('Dodano: ' + well.name, 'success');
}

/* ===== TABLE RENDER (Excel-style) ===== */
function _excelRenderTable(dn) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;

    const tabWells = wells.filter(w => _excelWellMatchesTab(w, dn));
    const maxTr = _excelMaxTransitions;
    const compCols = _excelBuildComponentColumns(dn);
    const hasReduction = tabWells.some(w => w.redukcjaDN1000);

    const dnColor = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).border;

    let html = '<table style="width:100%;border-collapse:collapse;table-layout:auto;">';

    /* THEAD — sticky */
    html += `<thead><tr style="position:sticky;top:0;z-index:20;">`;

    const thBase = `padding:0.35rem 0.5rem;border-bottom:2px solid rgba(255,255,255,0.1);border-right:1px solid rgba(255,255,255,0.04);font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;`;

    html += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:130px;text-align:left;border-right:2px solid rgba(255,255,255,0.08);">Nr Studni</th>`;
    html += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">Rz. Włazu</th>`;
    html += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:78px;text-align:right;">Rz. Dna</th>`;
    html += `<th style="${thBase}background:#161923;color:${dnColor};min-width:65px;text-align:center;">Wys.</th>`;

    for (let i = 0; i < maxTr; i++) {
        html += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:78px;text-align:right;">Rz. wlot ${i}</th>`;
        html += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:55px;text-align:center;">Kąt ${i}°</th>`;
        html += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:125px;text-align:left;">Połącze ${i}</th>`;
    }

    html += `<th style="${thBase}background:#0f1a15;color:#6ee7b7;min-width:130px;text-align:left;">Właz</th>`;

    compCols.forEach(col => {
        if (col.type === 'auto' || col.type === 'select') return; /* uszczelka + właz — osobne nagłówki niżej */
        const ct = col.componentType;
        const hc = ct === 'avr' ? '#fbbf24' : (ct === 'krag' || ct === 'krag_ot') ? '#34d399'
            : ct === 'dennica' ? '#f97316' : ct === 'konus' ? '#fb923c'
            : (ct === 'plyta_din' || ct === 'plyta_najazdowa' || ct === 'plyta_zamykajaca' || ct === 'pierscien_odciazajacy') ? '#60a5fa'
            : ct === 'plyta_redukcyjna' ? '#f472b6' : ct === 'osadnik' ? '#a78bfa'
            : ct === 'styczna' ? '#f472b6' : '#93c5fd';
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
    html += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:50px;text-align:center;">Param</th>`;

    html += '</tr></thead><tbody>';

    tabWells.forEach((well, idx) => {
        const wIdx = wells.indexOf(well);
        const isEven = idx % 2 === 0;
        const rowBg = isEven ? '#0e1017' : '#11131b';
        const przejscia = well.przejscia || [];

        html += `<tr data-widx="${wIdx}" style="background:${rowBg};transition:background 0.08s;" onmouseenter="this.style.background='#1a1d2e'" onmouseleave="this.style.background='${rowBg}'">`;

        const tdBase = `padding:${_EXCEL_CELL_PADD};border-bottom:1px solid rgba(255,255,255,0.03);border-right:1px solid rgba(255,255,255,0.04);${_EXCEL_FONT}`;

        /* Nr. Studni — sticky left */
        html += `<td style="${tdBase}font-weight:600;color:#cbd5e1;position:sticky;left:0;z-index:5;background:inherit;border-right:2px solid rgba(255,255,255,0.08);" title="${escapeHtml(well.name)}"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:125px;">${escapeHtml(well.name)}</span></td>`;

        /* Rz. Włazu */
        html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" value="${well.rzednaWlazu != null ? well.rzednaWlazu : ''}" onchange="excelOnRzednaChange(${wIdx})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;

        /* Rz. Dna */
        html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" value="${well.rzednaDna != null ? well.rzednaDna : ''}" onchange="excelOnRzednaChange(${wIdx})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;

        /* Wys. — auto */
        const height = _excelCalcWellHeight(well);
        html += `<td style="${tdBase}text-align:center;color:${dnColor};font-weight:600;background:rgba(255,255,255,0.015);" data-cell="height-${wIdx}">${height || '—'}</td>`;

        /* Przejścia */
        for (let i = 0; i < maxTr; i++) {
            const prz = przejscia[i] || {};
            const przProducts = (typeof studnieProducts !== 'undefined')
                ? studnieProducts.filter(p => p.componentType === 'przejscie' && p.active !== 0 && parseInt(p.dn) === parseInt(well.dn))
                : [];

            let selHtml = `<select onchange="excelOnPrzejscieChange(${wIdx},${i},'productId',this.value)" style="${_excelCellInp(120)}text-align:left;cursor:pointer;">`;
            selHtml += `<option value="">—</option>`;
            przProducts.forEach(p => {
                const nm = p.name.length > 18 ? p.name.substring(0, 16) + '…' : p.name;
                selHtml += `<option value="${p.id}"${prz.productId === p.id ? ' selected' : ''}>${nm}</option>`;
            });
            selHtml += `</select>`;

            html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" value="${prz.rzednaWlaczenia || ''}" onchange="excelOnPrzejscieChange(${wIdx},${i},'rzednaWlaczenia',this.value)" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(72)}" /></td>`;
            html += `<td style="${tdBase}text-align:center;"><input type="number" step="1" value="${prz.angle != null ? prz.angle : ''}" onchange="excelOnPrzejscieChange(${wIdx},${i},'angle',this.value)" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(50)}text-align:center;" /></td>`;
            html += `<td style="${tdBase}text-align:left;">${selHtml}</td>`;
        }

        /* Właz */
        const wlazVal = _excelGetWlazFromConfig(well);
        const wlazProducts = (typeof studnieProducts !== 'undefined')
            ? studnieProducts.filter(p => p.componentType === 'wlaz' && parseInt(p.dn) === parseInt(well.dn))
            : [];
        let wlazSel = `<select onchange="excelOnWlazChange(${wIdx},this.value)" style="${_excelCellInp(125)}text-align:left;cursor:pointer;">`;
        wlazSel += `<option value="">—</option>`;
        wlazProducts.forEach(p => {
            const nm = p.name.length > 20 ? p.name.substring(0, 18) + '…' : p.name;
            wlazSel += `<option value="${p.id}"${wlazVal === p.id ? ' selected' : ''}>${nm}</option>`;
        });
        wlazSel += `</select>`;
        html += `<td style="${tdBase}text-align:left;">${wlazSel}</td>`;

        /* Komponenty — ilości */
        compCols.forEach(col => {
            if (col.type === 'select' || col.type === 'auto') return;
            const count = _excelCountProductInConfig(well, col.componentType, col.height, col.productId);
            const pidArg = col.productId ? `'${col.productId}'` : 'null';
            const hArg = col.height != null ? col.height : 'null';
            html += `<td style="${tdBase}text-align:center;"><input type="number" min="0" step="1" value="${count || ''}" onchange="excelOnCompChange(${wIdx},'${col.componentType}',${hArg},this.value,${pidArg})" onfocus="excelCellFocus(this)" onblur="excelCellBlur(this)" style="${_excelCellInp(50)}text-align:center;" /></td>`;
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
        kinSel += `</select>`;
        html += `<td style="${tdBase}text-align:left;">${kinSel}</td>`;

        /* Psia buda */
        html += `<td style="${tdBase}text-align:center;"><input type="checkbox"${well.psiaBuda ? ' checked' : ''} onchange="excelOnPsiaBudaChange(${wIdx},this.checked)" style="accent-color:#f59e0b;cursor:pointer;" /></td>`;

        /* Param. */
        html += `<td style="${tdBase}text-align:center;"><button onclick="excelOpenWellParams(${wIdx})" style="background:transparent;color:#818cf8;border:1px solid rgba(129,140,248,0.2);padding:0.15rem 0.4rem;border-radius:2px;font-size:0.58rem;cursor:pointer;font-weight:600;transition:all 0.1s;" onmouseenter="this.style.background='rgba(129,140,248,0.1)'" onmouseleave="this.style.background='transparent'">⋯</button></td>`;

        html += '</tr>';
    });

    /* ===== EMPTY ROW — wiersz na nową studnię ===== */
    const emptyRowBg = '#0a0c10';
    html += `<tr id="excel-empty-row" style="background:${emptyRowBg};border-top:2px dashed rgba(255,255,255,0.08);">`;

    const tdBase = `padding:${_EXCEL_CELL_PADD};border-bottom:1px solid rgba(255,255,255,0.03);border-right:1px solid rgba(255,255,255,0.04);${_EXCEL_FONT}`;
    const tdEmpty = `${tdBase}color:#334155;`;

    /* Nazwa — sticky left */
    html += `<td style="${tdEmpty}position:sticky;left:0;z-index:5;background:${emptyRowBg};border-right:2px solid rgba(255,255,255,0.08);"><input type="text" placeholder="Nazwa studni…" id="excel-empty-name" onkeydown="if(event.key==='Enter')excelCreateFromEmpty()" onfocus="excelCellFocus(this)" style="${_excelCellInp(125)}text-align:left;color:#94a3b8;" /></td>`;

    /* Rz. Włazu */
    html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzw" onkeydown="if(event.key==='Enter')excelCreateFromEmpty()" onfocus="excelCellFocus(this)" style="${_excelCellInp(72)}" /></td>`;

    /* Rz. Dna */
    html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzd" onkeydown="if(event.key==='Enter')excelCreateFromEmpty()" onfocus="excelCellFocus(this)" style="${_excelCellInp(72)}" /></td>`;

    /* Wys. — placeholder */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="height-empty">—</td>`;

    /* Przejścia — puste */
    for (let i = 0; i < maxTr; i++) {
        html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" disabled style="${_excelCellInp(72)}opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:center;"><input type="number" step="1" placeholder="—" disabled style="${_excelCellInp(50)}opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(120)}opacity:0.3;"><option value="">—</option></select></td>`;
    }

    /* Właz */
    html += `<td style="${tdEmpty}text-align:left;"><select disabled style="${_excelCellInp(125)}opacity:0.3;"><option value="">—</option></select></td>`;

    /* Komponenty */
    compCols.forEach(col => {
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

    /* Param */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;font-size:0.6rem;">nowa</td>`;

    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
}

/* ===== EMPTY ROW HANDLER — tworzenie studni z wiersza ===== */
function excelCreateFromEmpty() {
    const nameEl = document.getElementById('excel-empty-name');
    const rzwEl = document.getElementById('excel-empty-rzw');
    const rzdEl = document.getElementById('excel-empty-rzd');
    if (!nameEl) return;

    const name = (nameEl.value || '').trim();
    const rzw = rzwEl ? parseFloat(rzwEl.value) : null;
    const rzd = rzdEl ? parseFloat(rzdEl.value) : null;

    if (!name && rzw === null && rzd === null) return;

    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);
    const autoName = name || ((dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) + ' (#' + (wells.length + 1) + ')');

    let well;
    if (typeof createNewWell === 'function') {
        well = createNewWell(autoName, dn);
    } else {
        well = {
            id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            name: autoName, dn: dn, config: [], przejscia: [],
            rzednaWlazu: rzw, rzednaDna: rzd,
            kineta: 'brak', psiaBuda: false,
            redukcjaDN1000: false, redukcjaMinH: 2500
        };
    }

    if (rzw !== null) well.rzednaWlazu = rzw;
    if (rzd !== null) well.rzednaDna = rzd;

    wells.push(well);
    _excelMaxTransitions = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    showToast('Dodano: ' + autoName, 'success');

    setTimeout(() => {
        const el = document.getElementById('excel-empty-name');
        if (el) el.focus();
    }, 50);
}

/* ===== CELL FOCUS (Excel highlight) ===== */
function excelCellFocus(el) {
    el.style.borderColor = 'rgba(99,102,241,0.5)';
    el.style.background = 'rgba(99,102,241,0.06)';
    el.parentElement.style.background = 'rgba(99,102,241,0.04)';
}
function excelCellBlur(el) {
    el.style.borderColor = 'transparent';
    el.style.background = 'transparent';
    const tr = el.closest('tr');
    if (tr) el.parentElement.style.background = '';
}

/* ===== TAB KEY NAVIGATION ===== */
function _excelHandleTab(e) {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const inputs = Array.from(container.querySelectorAll('input[type="number"], select'));
    const idx = inputs.indexOf(target);
    if (idx === -1) return;

    e.preventDefault();
    const next = e.shiftKey ? inputs[idx - 1] : inputs[idx + 1];
    if (next) { next.focus(); next.select(); }
}

/* ===== ARROW KEY NAVIGATION (Excel-like) ===== */
function _excelHandleArrow(e) {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;

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
            const nextEls = Array.from(nextRow.querySelectorAll('input:not([disabled]), select:not([disabled])'));
            next = nextEls[Math.min(colIdx, nextEls.length - 1)] || null;
        }
    } else if (e.key === 'ArrowUp') {
        const prevRow = rows[currentRowIdx - 1];
        if (prevRow) {
            const prevEls = Array.from(prevRow.querySelectorAll('input:not([disabled]), select:not([disabled])'));
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
    const inputs = row.querySelectorAll('input[type="number"]');
    const rzWlazu = parseFloat(inputs[0]?.value) || null;
    const rzDna = parseFloat(inputs[1]?.value) || null;
    wells[wIdx].rzednaWlazu = rzWlazu;
    wells[wIdx].rzednaDna = rzDna;
    _excelRefreshAutoCells(wIdx, row);
}

function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    while (wells[wIdx].przejscia.length <= trIdx) {
        wells[wIdx].przejscia.push({ id: 'prz-' + Date.now() + '-' + Math.floor(Math.random() * 1000), productId: '', rzednaWlaczenia: null, angle: 0 });
    }
    wells[wIdx].przejscia[trIdx][field] = field === 'angle' ? (parseFloat(value) || 0) : (value || null);
}

function excelOnWlazChange(wIdx, productId) {
    const well = wells[wIdx];
    well.config = (well.config || []).filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return !(p && p.componentType === 'wlaz');
    });
    if (productId) well.config.push({ productId, quantity: 1, autoAdded: false });
}

function excelOnCompChange(wIdx, componentType, height, value, productId) {
    const well = wells[wIdx];
    const newQty = parseInt(value) || 0;

    well.config = (well.config || []).filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (!p) return true;
        if (productId) return item.productId !== productId;
        if (p.componentType !== componentType) return true;
        if (height !== undefined && parseInt(p.height) !== parseInt(height)) return true;
        return false;
    });

    if (newQty > 0) {
        let candidates;
        if (productId) {
            candidates = studnieProducts.filter(p => p.id === productId);
        } else {
            candidates = (typeof getAvailableProducts === 'function' ? getAvailableProducts(well) : studnieProducts)
                .filter(p => p.componentType === componentType && parseInt(p.dn) === parseInt(well.dn));
            if (height !== undefined) candidates = candidates.filter(p => parseInt(p.height) === parseInt(height));
            if (typeof filterByWellParams === 'function') candidates = candidates.filter(p => filterByWellParams(p, well));
        }
        for (let i = 0; i < newQty && i < candidates.length; i++) {
            well.config.push({ productId: candidates[i].id, quantity: 1, autoAdded: false });
        }
    }

    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) _excelRefreshAutoCells(wIdx, row);
}

function excelOnKinetaChange(wIdx, value) {
    wells[wIdx].kineta = value;
    if (typeof syncKineta === 'function') syncKineta(wells[wIdx]);
}

function excelOnPsiaBudaChange(wIdx, checked) {
    wells[wIdx].psiaBuda = checked;
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) _excelRefreshAutoCells(wIdx, row);
}

function excelOnReductionChange(wIdx, checked) {
    wells[wIdx].redukcjaDN1000 = checked;
}

function excelOnReductionMinHChange(wIdx, value) {
    wells[wIdx].redukcjaMinH = parseInt(value) || 2500;
}

function _excelRefreshAutoCells(wIdx, row) {
    const well = wells[wIdx];
    if (!well) return;

    const dnColor = (DN_COLORS[well.dn === 'styczna' ? 'styczne' : String(well.dn)] || DN_COLORS['1000']).border;

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

/* ===== PARAM. BUTTON ===== */
function excelOpenWellParams(wIdx) {
    const well = wells[wIdx];
    if (!well) return;
    if (typeof currentWellIndex !== 'undefined') window.currentWellIndex = wIdx;
    if (typeof renderWellsList === 'function') renderWellsList();
    if (typeof renderWellParams === 'function') renderWellParams();
    if (typeof renderTiles === 'function') renderTiles();
    showToast(`Przełączono na: ${well.name}`, 'info');
    closeExcelTableModal();
}
