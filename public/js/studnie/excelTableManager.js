/* ===== EXCEL TABLE MANAGER — Tabela konfiguracyjna studni ===== */

let _excelMaxTransitions = 1;
let _excelActiveTab = '1000';

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
    '1000': { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#93c5fd' },
    '1200': { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#6ee7b7' },
    '1500': { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#fbbf24' },
    '2000': { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)', text: '#c4b5fd' },
    '2500': { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#fca5a5' },
    'styczne': { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.4)', text: '#f9a8d4' }
};

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
    if (typeof studnieProducts === 'undefined' || !studnieProducts) return [];
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

    const wlazProducts = groups['wlaz'] || [];
    if (wlazProducts.length > 0) {
        cols.push({ key: 'wlaz', label: 'Właz', type: 'select', componentType: 'wlaz', products: wlazProducts });
    }

    const avrProducts = groups['avr'] || [];
    if (avrProducts.length > 0) {
        avrProducts.forEach(p => {
            const nameShort = p.name.replace(/AVR\s*/i, '').trim() || p.id;
            cols.push({ key: 'avr_' + p.id, label: 'AVR ' + nameShort, type: 'number', componentType: 'avr', productId: p.id, height: p.height });
        });
    }

    const plytaDin = groups['plyta_din'] || [];
    if (plytaDin.length > 0) {
        cols.push({ key: 'plyta_din', label: 'Płyta DIN', type: 'number', componentType: 'plyta_din', products: plytaDin });
    }

    const pierscienOdc = groups['pierscien_odciazajacy'] || [];
    if (pierscienOdc.length > 0) {
        cols.push({ key: 'pierscien_odciazajacy', label: 'Pierśc. odciąż.', type: 'number', componentType: 'pierscien_odciazajacy', products: pierscienOdc });
    }

    const kregProducts = (groups['krag'] || []).sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
    const seenHeights = new Set();
    kregProducts.forEach(p => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenHeights.has(h)) {
            seenHeights.add(h);
            const matching = kregProducts.filter(k => parseInt(k.height) === h);
            cols.push({ key: 'krag_' + h, label: 'Krąg H=' + h, type: 'number', componentType: 'krag', height: h, products: matching });
        }
    });

    const kragOtProducts = (groups['krag_ot'] || []).sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
    const seenOtHeights = new Set();
    kragOtProducts.forEach(p => {
        const h = parseInt(p.height) || 0;
        if (h > 0 && !seenOtHeights.has(h)) {
            seenOtHeights.add(h);
            const matching = kragOtProducts.filter(k => parseInt(k.height) === h);
            cols.push({ key: 'krag_ot_' + h, label: 'Krąg OT H=' + h, type: 'number', componentType: 'krag_ot', height: h, products: matching });
        }
    });

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

function openExcelTableModal() {
    if (typeof wells === 'undefined' || !Array.isArray(wells) || wells.length === 0) {
        showToast('Brak studni do wyświetlenia', 'error');
        return;
    }

    _excelMaxTransitions = _excelGetMaxTransitions();

    const dnCounts = {};
    wells.forEach(w => {
        const key = w.dn === 'styczna' ? 'styczne' : String(w.dn);
        dnCounts[key] = (dnCounts[key] || 0) + 1;
    });

    const firstTab = DN_TABS.find(t => dnCounts[t]) || '1000';
    _excelActiveTab = firstTab;

    let existing = document.getElementById('excel-table-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-table-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeExcelTableModal();
    });

    const modal = document.createElement('div');
    modal.style.cssText = 'width:95vw;height:95vh;background:var(--bg-secondary,#0f172a);border:1px solid var(--border-glass,rgba(255,255,255,0.08));border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.5);';

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.8rem 1.2rem;border-bottom:1px solid var(--border-glass,rgba(255,255,255,0.08));flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <i data-lucide="table" style="width:20px;height:20px;color:var(--success,#10b981);"></i>
                <span style="font-size:0.85rem;font-weight:800;color:var(--text-primary);">Tabela konfiguracyjna studni</span>
                <span style="font-size:0.65rem;color:var(--text-muted);margin-left:0.5rem;">${wells.length} studni</span>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center;">
                <button onclick="excelSaveAll()" style="background:rgba(16,185,129,0.2);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:0.4rem 1rem;border-radius:6px;font-size:0.72rem;font-weight:700;cursor:pointer;">Zapisz</button>
                <button onclick="closeExcelTableModal()" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);padding:0.4rem 0.8rem;border-radius:6px;font-size:0.72rem;font-weight:700;cursor:pointer;">Anuluj</button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0.3rem;padding:0.5rem 1.2rem;border-bottom:1px solid var(--border-glass,rgba(255,255,255,0.06));flex-shrink:0;flex-wrap:wrap;"></div>
        <div id="excel-table-container" style="flex:1;overflow:auto;padding:0;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    _excelRenderTabs(dnCounts);
    _excelRenderTable(_excelActiveTab);

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

function closeExcelTableModal() {
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) overlay.remove();
}

function _excelRenderTabs(dnCounts) {
    const container = document.getElementById('excel-tabs');
    if (!container) return;

    let html = '';
    DN_TABS.forEach(tab => {
        const count = dnCounts[tab] || 0;
        if (count === 0) return;
        const c = DN_COLORS[tab] || DN_COLORS['1000'];
        const isActive = tab === _excelActiveTab;
        html += `<button onclick="excelSwitchTab('${tab}')" style="
            padding:0.35rem 0.8rem;border-radius:6px;font-size:0.68rem;font-weight:700;cursor:pointer;
            border:1px solid ${isActive ? c.border : 'rgba(255,255,255,0.08)'};
            background:${isActive ? c.bg : 'rgba(255,255,255,0.03)'};
            color:${isActive ? c.text : 'var(--text-muted)'};
            transition:all 0.15s;">
            DN${tab === 'styczne' ? ' Styczne' : tab} <span style="opacity:0.6;">(${count})</span>
        </button>`;
    });
    container.innerHTML = html;
}

function excelSwitchTab(tab) {
    _excelActiveTab = tab;
    const dnCounts = {};
    wells.forEach(w => {
        const key = w.dn === 'styczna' ? 'styczne' : String(w.dn);
        dnCounts[key] = (dnCounts[key] || 0) + 1;
    });
    _excelRenderTabs(dnCounts);
    _excelRenderTable(tab);
}

function _excelRenderTable(dn) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;

    const tabWells = wells.filter(w => _excelWellMatchesTab(w, dn));
    if (tabWells.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);font-size:0.8rem;">Brak studni dla tego DN</div>';
        return;
    }

    const maxTr = _excelMaxTransitions;
    const compCols = _excelBuildComponentColumns(dn);
    const hasReduction = tabWells.some(w => w.redukcjaDN1000);

    let html = '<table style="width:100%;border-collapse:collapse;font-size:0.68rem;white-space:nowrap;">';

    html += '<thead><tr style="position:sticky;top:0;z-index:10;background:var(--bg-secondary,#0f172a);">';

    html += '<th style="padding:0.4rem 0.6rem;text-align:left;border-bottom:2px solid var(--border-glass,rgba(255,255,255,0.1));min-width:140px;color:var(--text-muted);font-weight:800;">Nr. Studni</th>';
    html += '<th style="padding:0.4rem 0.6rem;text-align:right;border-bottom:2px solid var(--border-glass,rgba(255,255,255,0.1));min-width:80px;color:var(--text-muted);font-weight:800;">Rz. Włazu [m]</th>';
    html += '<th style="padding:0.4rem 0.6rem;text-align:right;border-bottom:2px solid var(--border-glass,rgba(255,255,255,0.1));min-width:80px;color:var(--text-muted);font-weight:800;">Rz. Dna [m]</th>';
    html += '<th style="padding:0.4rem 0.6rem;text-align:right;border-bottom:2px solid var(--border-glass,rgba(255,255,255,0.1));min-width:70px;color:var(--accent,#818cf8);font-weight:800;">Wys. [mm]</th>';

    for (let i = 0; i < maxTr; i++) {
        const col = 'var(--accent-hover,rgba(99,102,241,0.3))';
        html += `<th style="padding:0.4rem 0.6rem;text-align:right;border-bottom:2px solid ${col};min-width:80px;color:var(--accent,#818cf8);font-weight:800;">Rz. wlot ${i} [m]</th>`;
        html += `<th style="padding:0.4rem 0.6rem;text-align:right;border-bottom:2px solid ${col};min-width:60px;color:var(--accent,#818cf8);font-weight:800;">Kąt ${i} [°]</th>`;
        html += `<th style="padding:0.4rem 0.6rem;text-align:left;border-bottom:2px solid ${col};min-width:130px;color:var(--accent,#818cf8);font-weight:800;">Połącze ${i}</th>`;
    }

    html += '<th style="padding:0.4rem 0.6rem;border-bottom:2px solid var(--border-glass,rgba(255,255,255,0.1));min-width:140px;color:#6ee7b7;font-weight:800;">Właz</th>';

    compCols.forEach(col => {
        const hdr = col.componentType === 'avr' ? '#fbbf24' : (col.componentType === 'krag' || col.componentType === 'krag_ot') ? '#34d399' : '#93c5fd';
        html += `<th style="padding:0.4rem 0.6rem;text-align:center;border-bottom:2px solid ${hdr}33;min-width:65px;color:${hdr};font-weight:800;">${col.label}</th>`;
    });

    if (hasReduction) {
        html += '<th style="padding:0.4rem 0.6rem;text-align:center;border-bottom:2px solid #f8717133;min-width:70px;color:#fca5a5;font-weight:800;">Red.</th>';
        html += '<th style="padding:0.4rem 0.6rem;text-align:center;border-bottom:2px solid #f8717133;min-width:75px;color:#fca5a5;font-weight:800;">Min H red.</th>';
    }

    html += '<th style="padding:0.4rem 0.6rem;text-align:right;border-bottom:2px solid #f59e0b33;min-width:75px;color:#fbbf24;font-weight:800;">H denn.</th>';
    html += '<th style="padding:0.4rem 0.6rem;text-align:center;border-bottom:2px solid #f59e0b33;min-width:60px;color:#fbbf24;font-weight:800;">Uszcz.</th>';
    html += '<th style="padding:0.4rem 0.6rem;text-align:left;border-bottom:2px solid #c084fc33;min-width:100px;color:#c4b5fd;font-weight:800;">Kineta</th>';
    html += '<th style="padding:0.4rem 0.6rem;text-align:center;border-bottom:2px solid rgba(255,255,255,0.1);min-width:60px;color:var(--text-muted);font-weight:800;">Psia buda</th>';
    html += '<th style="padding:0.4rem 0.6rem;text-align:center;border-bottom:2px solid rgba(255,255,255,0.1);min-width:70px;color:var(--text-muted);font-weight:800;">Param.</th>';

    html += '</tr></thead><tbody>';

    tabWells.forEach((well, idx) => {
        const wIdx = wells.indexOf(well);
        const rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
        const przejscia = well.przejscia || [];

        html += `<tr data-widx="${wIdx}" style="background:${rowBg};">`;

        html += `<td style="padding:0.3rem 0.6rem;border-bottom:1px solid rgba(255,255,255,0.04);font-weight:700;color:var(--text-primary);">${well.name}</td>`;

        html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);"><input type="number" step="0.01" value="${well.rzednaWlazu != null ? well.rzednaWlazu : ''}" onchange="excelOnRzednaChange(${wIdx})" style="width:75px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);text-align:right;font-size:0.68rem;"></td>`;

        html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);"><input type="number" step="0.01" value="${well.rzednaDna != null ? well.rzednaDna : ''}" onchange="excelOnRzednaChange(${wIdx})" style="width:75px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);text-align:right;font-size:0.68rem;"></td>`;

        const height = _excelCalcWellHeight(well);
        html += `<td style="padding:0.3rem 0.6rem;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;color:var(--accent,#818cf8);font-weight:700;background:rgba(99,102,241,0.05);" data-cell="height-${wIdx}">${height || '—'}</td>`;

        for (let i = 0; i < maxTr; i++) {
            const prz = przejscia[i] || {};
            const przProducts = (typeof studnieProducts !== 'undefined')
                ? studnieProducts.filter(p => p.componentType === 'przejscie' && p.active !== 0 && parseInt(p.dn) === parseInt(well.dn))
                : [];

            let selectHtml = `<select onchange="excelOnPrzejscieChange(${wIdx},${i},'productId',this.value)" style="width:125px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);font-size:0.65rem;">`;
            selectHtml += `<option value="">— brak —</option>`;
            przProducts.forEach(p => {
                const sel = prz.productId === p.id ? ' selected' : '';
                selectHtml += `<option value="${p.id}"${sel}>${p.name}</option>`;
            });
            selectHtml += `</select>`;

            html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);"><input type="number" step="0.01" value="${prz.rzednaWlaczenia || ''}" onchange="excelOnPrzejscieChange(${wIdx},${i},'rzednaWlaczenia',this.value)" style="width:75px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);text-align:right;font-size:0.68rem;"></td>`;
            html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);"><input type="number" step="1" value="${prz.angle != null ? prz.angle : ''}" onchange="excelOnPrzejscieChange(${wIdx},${i},'angle',this.value)" style="width:55px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);text-align:right;font-size:0.68rem;"></td>`;
            html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);">${selectHtml}</td>`;
        }

        const wlazVal = _excelGetWlazFromConfig(well);
        const wlazProducts = (typeof studnieProducts !== 'undefined')
            ? studnieProducts.filter(p => p.componentType === 'wlaz' && parseInt(p.dn) === parseInt(well.dn))
            : [];
        let wlazSelect = `<select onchange="excelOnWlazChange(${wIdx},this.value)" style="width:135px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);font-size:0.65rem;">`;
        wlazSelect += `<option value="">— brak —</option>`;
        wlazProducts.forEach(p => {
            const sel = wlazVal === p.id ? ' selected' : '';
            wlazSelect += `<option value="${p.id}"${sel}>${p.name}</option>`;
        });
        wlazSelect += `</select>`;
        html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);">${wlazSelect}</td>`;

        compCols.forEach(col => {
            if (col.type === 'select') return;
            const count = _excelCountProductInConfig(well, col.componentType, col.height, col.productId);
            const pidArg = col.productId ? `'${col.productId}'` : 'null';
            const hArg = col.height != null ? col.height : 'null';
            html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);"><input type="number" min="0" step="1" value="${count || ''}" onchange="excelOnCompChange(${wIdx},'${col.componentType}',${hArg},this.value,${pidArg})" style="width:55px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);text-align:center;font-size:0.68rem;"></td>`;
        });

        if (hasReduction) {
            const redChecked = well.redukcjaDN1000 ? ' checked' : '';
            html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;"><input type="checkbox"${redChecked} onchange="excelOnReductionChange(${wIdx},this.checked)" style="accent-color:#f87171;"></td>`;
            html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);"><input type="number" min="0" step="100" value="${well.redukcjaMinH || 2500}" onchange="excelOnReductionMinHChange(${wIdx},this.value)" style="width:65px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);text-align:center;font-size:0.68rem;"></td>`;
        }

        const dennH = _excelCalcDennicaHeight(well);
        html += `<td style="padding:0.3rem 0.6rem;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;color:#fbbf24;font-weight:600;background:rgba(245,158,11,0.05);" data-cell="denn-${wIdx}">${dennH || '—'}</td>`;

        const uszczCount = _excelCalcUszczelkaCount(well);
        html += `<td style="padding:0.3rem 0.6rem;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;color:#fbbf24;font-weight:600;background:rgba(245,158,11,0.05);" data-cell="uszcz-${wIdx}">${uszczCount}</td>`;

        let kinetaSelect = `<select onchange="excelOnKinetaChange(${wIdx},this.value)" style="width:95px;background:var(--bg-input,rgba(0,0,0,0.3));border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.2rem 0.3rem;color:var(--text-primary);font-size:0.65rem;">`;
        KINETA_OPTIONS.forEach(([val, label]) => {
            const sel = well.kineta === val ? ' selected' : '';
            kinetaSelect += `<option value="${val}"${sel}>${label}</option>`;
        });
        kinetaSelect += `</select>`;
        html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);">${kinetaSelect}</td>`;

        const pbChecked = well.psiaBuda ? ' checked' : '';
        html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;"><input type="checkbox"${pbChecked} onchange="excelOnPsiaBudaChange(${wIdx},this.checked)" style="accent-color:#f59e0b;"></td>`;

        html += `<td style="padding:0.2rem;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;"><button onclick="excelOpenWellParams(${wIdx})" style="background:rgba(168,85,247,0.2);color:#c4b5fd;border:1px solid rgba(168,85,247,0.3);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.6rem;cursor:pointer;font-weight:600;">Param.</button></td>`;

        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function excelOnRzednaChange(wIdx) {
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (!row) return;
    const inputs = row.querySelectorAll('input[type="number"]');
    const rzWlazu = parseFloat(inputs[0]?.value) || null;
    const rzDna = parseFloat(inputs[1]?.value) || null;
    wells[wIdx].rzednaWlazu = rzWlazu;
    wells[wIdx].rzednaDna = rzDna;

    const height = _excelCalcWellHeight(wells[wIdx]);
    const heightCell = row.querySelector(`[data-cell="height-${wIdx}"]`);
    if (heightCell) heightCell.textContent = height || '—';

    _excelRefreshAutoCells(wIdx, row);
}

function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    while (wells[wIdx].przejscia.length <= trIdx) {
        wells[wIdx].przejscia.push({ id: 'prz-' + Date.now() + '-' + Math.floor(Math.random() * 1000), productId: '', rzednaWlaczenia: null, angle: 0 });
    }
    if (field === 'angle') {
        wells[wIdx].przejscia[trIdx][field] = parseFloat(value) || 0;
    } else {
        wells[wIdx].przejscia[trIdx][field] = value || null;
    }
}

function excelOnWlazChange(wIdx, productId) {
    const well = wells[wIdx];
    well.config = (well.config || []).filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return !(p && p.componentType === 'wlaz');
    });
    if (productId) {
        well.config.push({ productId, quantity: 1, autoAdded: false });
    }
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
            if (height !== undefined) {
                candidates = candidates.filter(p => parseInt(p.height) === parseInt(height));
            }
            if (typeof filterByWellParams === 'function') {
                candidates = candidates.filter(p => filterByWellParams(p, well));
            }
        }
        for (let i = 0; i < newQty && i < candidates.length; i++) {
            well.config.push({ productId: candidates[i].id, quantity: 1, autoAdded: false });
        }
    }

    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) _excelRefreshAutoCells(wIdx, row);
}

function excelOnKinetaChange(wIdx, value) {
    const well = wells[wIdx];
    well.kineta = value;
    if (typeof syncKineta === 'function') syncKineta(well);
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

function excelSaveAll() {
    if (typeof refreshAll === 'function') refreshAll();

    showToast('Zapisano zmiany w tabeli', 'success');
    closeExcelTableModal();
}

function excelOpenWellParams(wIdx) {
    const well = wells[wIdx];
    if (!well) return;

    if (typeof currentWellIndex !== 'undefined') {
        window.currentWellIndex = wIdx;
    }

    if (typeof renderWellsList === 'function') renderWellsList();
    if (typeof renderWellParams === 'function') renderWellParams();
    if (typeof renderTiles === 'function') renderTiles();

    showToast(`Przełączono na: ${well.name}`, 'info');
    closeExcelTableModal();
}
