// @ts-check
/* ===== KARTA BUDOWY — Przejścia (warstwa UI) ===== */

function handlePrzejsciaZamowioneChange(selectElement) {
    const dataInput = document.getElementById('step4-data-zamowienia');
    if (!dataInput) return;

    if (selectElement.value === 'Tak') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dataInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

function getPrzejsciaDnSelect(category) {
    const dns = new Set();
    const dnsStr = new Set();
    let hasStringDn = false;
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach((p) => {
            if (
                p.componentType === 'przejscie' &&
                p.active !== 0 &&
                (!category || category === 'Inne' || p.category === category)
            ) {
                if (typeof p.dn === 'string' && p.dn.includes('/')) {
                    hasStringDn = true;
                    dnsStr.add(p.dn);
                    dns.add(parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0);
                } else if (p.dn) {
                    dns.add(parseFloat(p.dn) || 0);
                }
            }
        });
    }
    return {
        dns: Array.from(dns)
            .filter((d) => !isNaN(d) && d > 0)
            .sort((a, b) => a - b),
        dnsStr,
        hasStringDn
    };
}

function buildPrzejscieRowHTML(row, idx, source) {
    const prefix = `step4-psz-${source}-${idx}`;
    const rowBg = source === 'custom' ? 'rgba(var(--warn-rgb),0.04)' : 'transparent';
    const borderLeft = source === 'custom' ? '2px solid rgba(var(--warn-rgb),0.3)' : 'none';

    const cats = new Set();
    const dnOpts = getPrzejsciaDnSelect(row.rodzaj);
    const dns = new Set(dnOpts.dns);
    const dnsStr = dnOpts.dnsStr;
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach((p) => {
            if (p.componentType === 'przejscie' && p.active !== 0 && p.category) {
                cats.add(p.category);
            }
        });
    }

    const catOptions = Array.from(cats).sort();
    const dnOptions = Array.from(dns);

    const isRodzajInne = row.rodzaj && !catOptions.includes(row.rodzaj);
    const rowHasStringDn = typeof row.dnOd === 'string' && row.dnOd.includes('/');
    const isDnOdInne = !rowHasStringDn && row.dnOd && !dnOptions.includes(parseFloat(row.dnOd));
    const isDnDoInne = !rowHasStringDn && row.dnDo && !dnOptions.includes(parseFloat(row.dnDo));

    const pszWarnAttr = source === 'offer' ? ' data-psz-warn="1"' : '';

    const rodzajCell = `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-rodzaj-select" class="form-input" style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszRodzajCatChange"${pszWarnAttr}>
                <option value="" disabled ${!row.rodzaj ? 'selected' : ''}>Wybierz rodzaj...</option>
                ${catOptions.map((c) => `<option value="${c}" ${row.rodzaj === c ? 'selected' : ''}>${c}</option>`).join('')}
                <option value="Inne" ${isRodzajInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="text" id="${prefix}-rodzaj" class="form-input" value="${(row.rodzaj || '').toString().replace(/"/g, '&quot;')}" placeholder="Wpisz własny rodzaj..." style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); display:${isRodzajInne ? 'block' : 'none'};" data-action="pszRodzajCustomChange"${pszWarnAttr}>
        </div>`;

    const dnOdCell = rowHasStringDn
        ? `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <input type="text" id="${prefix}-dnod" class="form-input" value="${(row.dnOd || '').toString().replace(/"/g, '&quot;')}" readonly style="width:100%; min-width:90px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; opacity:0.7; cursor:default;">
        </div>`
        : `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-dnod-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszDnSelectChange" data-psz-field="dnod"${pszWarnAttr}>
                <option value="" ${!row.dnOd ? 'selected' : ''}>—</option>
                ${dnOptions.map((d) => `<option value="${d}" ${parseFloat(row.dnOd) === d ? 'selected' : ''}>${d}</option>`).join('')}
                <option value="Inne" ${isDnOdInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="number" id="${prefix}-dnod" class="form-input" value="${row.dnOd || ''}" placeholder="DN od" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:${isDnOdInne ? 'block' : 'none'};" data-action="pszDnInputChange" data-psz-field="dnod"${pszWarnAttr}>
        </div>`;

    const dnDoCell = rowHasStringDn
        ? `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <input type="text" id="${prefix}-dndo" class="form-input" value="${(row.dnDo || '').toString().replace(/"/g, '&quot;')}" readonly style="width:100%; min-width:90px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; opacity:0.7; cursor:default;">
        </div>`
        : `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-dndo-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszDnSelectChange" data-psz-field="dndo"${pszWarnAttr}>
                <option value="" ${!row.dnDo ? 'selected' : ''}>—</option>
                ${dnOptions.map((d) => `<option value="${d}" ${parseFloat(row.dnDo) === d ? 'selected' : ''}>${d}</option>`).join('')}
                <option value="Inne" ${isDnDoInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="number" id="${prefix}-dndo" class="form-input" value="${row.dnDo || ''}" placeholder="DN do" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:${isDnDoInne ? 'block' : 'none'};" data-action="pszDnInputChange" data-psz-field="dndo"${pszWarnAttr}>
        </div>`;

    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:${rowBg}; border-left:${borderLeft};" data-psz-source="${source}" data-psz-idx="${idx}">
        <td style="padding:0.4rem 0.5rem; white-space:nowrap; vertical-align:top;">${rodzajCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">${dnOdCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">${dnDoCell}</td>
        <td style="padding:0.4rem 0.5rem; vertical-align:top;">
            <input type="text" id="${prefix}-uwagi" class="form-input" value="${(row.uwagi || '').toString().replace(/"/g, '&quot;')}" placeholder="Uwagi..." style="width:100%; font-size:0.75rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszUwagiChange"${pszWarnAttr}>
        </td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">
            <select id="${prefix}-czy" class="form-input" style="width:80px; font-size:0.75rem; padding:0.3rem; text-align:center; font-weight:700; border-radius:4px; ${row.czyPrzejscie === 'TAK' ? 'color:var(--success-hover); background:rgba(var(--success-rgb),0.1); border:1px solid rgba(var(--success-rgb),0.3);' : 'color:var(--danger-hover); background:rgba(var(--danger-rgb),0.1); border:1px solid rgba(var(--danger-rgb),0.3);'}" data-action="pszCzyChange"${pszWarnAttr}>
                <option value="TAK"${row.czyPrzejscie === 'TAK' ? ' selected' : ''}>TAK</option>
                <option value="NIE"${row.czyPrzejscie === 'NIE' ? ' selected' : ''}>NIE</option>
            </select>
        </td>
        <td style="padding:0.4rem 0.2rem; text-align:center; vertical-align:top;">
            <button type="button" class="btn-icon-danger btn-icon-sm" data-action="pszDeleteRow" title="Usuń"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
        </td>
    </tr>`;
}

function updatePrzejscieSelectStyle(selectEl) {
    if (selectEl.value === 'TAK') {
        selectEl.style.color = 'var(--success-hover)';
        selectEl.style.background = 'rgba(var(--success-rgb),0.1)';
        selectEl.style.border = '1px solid rgba(var(--success-rgb),0.3)';
    } else {
        selectEl.style.color = 'var(--danger-hover)';
        selectEl.style.background = 'rgba(var(--danger-rgb),0.1)';
        selectEl.style.border = '1px solid rgba(var(--danger-rgb),0.3)';
    }
}

function addCustomPrzejscieRow() {
    _syncCustomRowsFromDOM();

    _customPrzejscieRows.push({
        rodzaj: '',
        dnOd: '',
        dnDo: '',
        ilosc: 1,
        uwagi: '',
        czyPrzejscie: 'TAK',
        source: 'custom'
    });

    renderPrzejsciaDetailsTable(null);
    setTimeout(() => {
        const newIdx = _customPrzejscieRows.length - 1;
        const rodzajInput = document.getElementById(`step4-psz-custom-${newIdx}-rodzaj`);
        if (rodzajInput) rodzajInput.focus();
    }, 50);
}

async function removePrzejscieRow(source, idx) {
    _syncCustomRowsFromDOM();
    if (source === 'offer') {
        if (
            !(await appConfirm(
                'Usuwasz przejście przepisane z oferty. Czy na pewno chcesz to zrobić?',
                { title: 'Potwierdzenie', type: 'warning' }
            ))
        )
            return;
        _offerPrzejscieRows.splice(idx, 1);
    } else {
        _customPrzejscieRows.splice(idx, 1);
    }
    renderPrzejsciaDetailsTable(null);
}

function renderPrzejsciaDetailsTable(existingData) {
    const container = document.getElementById('step4-przejscia-details-table');
    if (!container) return;

    if (!_przejsciaInitialized || existingData) {
        _offerPrzejscieRows = buildOfferPrzejsciaTypes();
        _customPrzejscieRows = [];
        if (existingData && Array.isArray(existingData)) {
            _customPrzejscieRows = existingData.filter((r) => r.source === 'custom');
            const savedOffers = existingData.filter((r) => r.source === 'offer');
            if (savedOffers.length > 0) {
                _offerPrzejscieRows = savedOffers;
            } else {
                _offerPrzejscieRows.forEach((ot) => {
                    const saved = existingData.find(
                        (s) => s.source === 'offer' && s.rodzaj === ot.rodzaj
                    );
                    if (saved) {
                        ot.dnOd = saved.dnOd ?? ot.dnOd;
                        ot.dnDo = saved.dnDo ?? ot.dnDo;
                        ot.ilosc = saved.ilosc || 1;
                        ot.uwagi = saved.uwagi || '';
                        ot.czyPrzejscie = saved.czyPrzejscie || 'TAK';
                    }
                });
            }
        }
        _przejsciaInitialized = true;
    }

    const allRows = [..._offerPrzejscieRows, ..._customPrzejscieRows];

    if (allRows.length === 0) {
        container.innerHTML =
            '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.72rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak przejść szczelnych w cenniku. Dodaj niestandardowe przejście przyciskiem powyżej.</div>';
        return;
    }

    let html = `<div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
            <thead>
                <tr style="border-bottom:1px solid rgba(var(--accent2-rgb),0.2);">
                    <th style="text-align:left; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Rodzaj</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">DN od</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">DN do</th>
                    <th style="text-align:left; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Uwagi</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Czy przejście?</th>
                    <th style="width:36px;"></th>
                </tr>
            </thead>
            <tbody>`;

    _offerPrzejscieRows.forEach((row, idx) => {
        html += buildPrzejscieRowHTML(row, idx, 'offer');
    });

    _customPrzejscieRows.forEach((row, idx) => {
        html += buildPrzejscieRowHTML(row, idx, 'custom');
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}
