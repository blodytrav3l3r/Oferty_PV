// @ts-check
/* ===== KARTA BUDOWY — Przejścia ===== */

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

/* ===== SEKCJA PRZEJĹšÄ† SZCZELNYCH â€” SZCZEGĂ“ĹY Z OFERTY ===== */

let _customPrzejscieRows = [];
let _offerPrzejscieRows = [];
let _przejsciaInitialized = false;

function buildOfferPrzejsciaTypes() {
    const usedProductIds = new Set();
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (w.przejscia && Array.isArray(w.przejscia)) {
                w.przejscia.forEach((pr) => {
                    if (pr.productId) {
                        usedProductIds.add(pr.productId);
                    }
                });
            }
        });
    }

    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0 && usedProductIds.has(p.id)
    );
    const typeMap = new Map();
    const stringDnMap = new Map();

    przejsciaProducts.forEach((p) => {
        const cat = p.category;
        if (!cat) return;

        if (typeof p.dn === 'string' && p.dn.includes('/')) {
            if (!stringDnMap.has(cat)) {
                stringDnMap.set(cat, { dnStrings: [] });
            }
            stringDnMap.get(cat).dnStrings.push(p.dn);
        } else {
            const dn = parseFloat(p.dn) || 0;
            if (!typeMap.has(cat)) {
                typeMap.set(cat, { dnMin: dn, dnMax: dn });
            } else {
                const entry = typeMap.get(cat);
                if (dn < entry.dnMin) entry.dnMin = dn;
                if (dn > entry.dnMax) entry.dnMax = dn;
            }
        }
    });

    const result = [];
    typeMap.forEach((val, key) => {
        result.push({
            rodzaj: key,
            dnOd: val.dnMin,
            dnDo: val.dnMax,
            ilosc: 1,
            uwagi: '',
            czyPrzejscie: 'TAK',
            source: 'offer'
        });
    });
    stringDnMap.forEach((val, key) => {
        val.dnStrings = [...val.dnStrings].sort((a, b) => {
            const aFirst = parseFloat(a.split('/')[0]) || 0;
            const bFirst = parseFloat(b.split('/')[0]) || 0;
            return aFirst - bFirst;
        });
        const uniqueDns = [...new Set(val.dnStrings)];
        uniqueDns.forEach((dn) => {
            result.push({
                rodzaj: key,
                dnOd: dn,
                dnDo: dn,
                ilosc: 1,
                uwagi: '',
                czyPrzejscie: 'TAK',
                source: 'offer'
            });
        });
    });
    return result.sort((a, b) => a.rodzaj.localeCompare(b.rodzaj));
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
            '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.72rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak przejĹ›Ä‡ szczelnych w cenniku. Dodaj niestandardowe przejĹ›cie przyciskiem powyĹĽej.</div>';
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
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:var(--accent2-hover); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Czy przejĹ›cie?</th>
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

function updatePrzejscieDnOptions(prefix, category) {
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

    if (hasStringDn && category && category !== 'Inne') {
        const sortedStr = Array.from(dnsStr).sort((a, b) => {
            const aFirst = parseFloat(a.split('/')[0]) || 0;
            const bFirst = parseFloat(b.split('/')[0]) || 0;
            return aFirst - bFirst;
        });
        const minStr = sortedStr[0] || '';
        const maxStr = sortedStr[sortedStr.length - 1] || minStr;

        ['dnod', 'dndo'].forEach((type) => {
            const select = document.getElementById(`${prefix}-${type}-select`);
            const input = document.getElementById(`${prefix}-${type}`);
            if (!select || !input) return;
            const val = type === 'dndo' ? maxStr : minStr;
            input.type = 'text';
            input.value = val;
            input.style.display = 'block';
            input.readOnly = true;
            input.style.opacity = '0.7';
            input.style.cursor = 'default';
            select.style.display = 'none';
        });
        return;
    }

    const dnOptions = Array.from(dns)
        .filter((d) => !isNaN(d) && d > 0)
        .sort((a, b) => a - b);

    ['dnod', 'dndo'].forEach((type) => {
        const select = document.getElementById(`${prefix}-${type}-select`);
        const input = document.getElementById(`${prefix}-${type}`);
        if (!select || !input) return;

        const currVal = input.value;
        const forceInne = category === 'Inne';
        const isCurrInne = forceInne || (currVal && !dnOptions.includes(parseFloat(currVal)));

        let html = `<option value="" ${!currVal && !forceInne ? 'selected' : ''}>â€”</option>`;
        html += dnOptions
            .map(
                (d) =>
                    `<option value="${d}" ${!forceInne && parseFloat(currVal) === d ? 'selected' : ''}>${d}</option>`
            )
            .join('');
        html += `<option value="Inne" ${isCurrInne ? 'selected' : ''}>Inne</option>`;

        select.innerHTML = html;
        if (isCurrInne) {
            select.value = 'Inne';
            input.style.display = 'block';
        } else if (currVal && dnOptions.includes(parseFloat(currVal))) {
            select.value = String(parseFloat(currVal));
            input.style.display = 'none';
        } else {
            select.value = '';
            input.value = '';
            input.style.display = 'none';
        }
    });
}

function buildPrzejscieRowHTML(row, idx, source) {
    const prefix = `step4-psz-${source}-${idx}`;
    const rowBg = source === 'custom' ? 'rgba(var(--warn-rgb),0.04)' : 'transparent';
    const borderLeft = source === 'custom' ? '2px solid rgba(var(--warn-rgb),0.3)' : 'none';

    const cats = new Set();
    const dns = new Set();
    const dnsStr = new Set();
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach((p) => {
            if (p.componentType === 'przejscie' && p.active !== 0) {
                if (p.category) cats.add(p.category);
                if (!row.rodzaj || row.rodzaj === 'Inne' || p.category === row.rodzaj) {
                    if (typeof p.dn === 'string' && p.dn.includes('/')) {
                        dnsStr.add(p.dn);
                        dns.add(
                            parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0
                        );
                    } else if (p.dn) {
                        dns.add(parseFloat(p.dn) || 0);
                    }
                }
            }
        });
    }

    const catOptions = Array.from(cats).sort();
    const dnOptions = Array.from(dns)
        .filter((d) => !isNaN(d) && d > 0)
        .sort((a, b) => a - b);

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
            <input type="text" id="${prefix}-rodzaj" class="form-input" value="${(row.rodzaj || '').toString().replace(/"/g, '&quot;')}" placeholder="Wpisz wĹ‚asny rodzaj..." style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); display:${isRodzajInne ? 'block' : 'none'};" data-action="pszRodzajCustomChange"${pszWarnAttr}>
        </div>`;

    const dnOdCell = rowHasStringDn
        ? `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <input type="text" id="${prefix}-dnod" class="form-input" value="${(row.dnOd || '').toString().replace(/"/g, '&quot;')}" readonly style="width:100%; min-width:90px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; opacity:0.7; cursor:default;">
        </div>`
        : `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-dnod-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" data-action="pszDnSelectChange" data-psz-field="dnod"${pszWarnAttr}>
                <option value="" ${!row.dnOd ? 'selected' : ''}>â€”</option>
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
                <option value="" ${!row.dnDo ? 'selected' : ''}>â€”</option>
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
            <button type="button" class="btn-icon-danger btn-icon-sm" data-action="pszDeleteRow" title="UsuĹ„"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
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
                'Usuwasz przejĹ›cie przepisane z oferty. Czy na pewno chcesz to zrobiÄ‡?',
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

function _syncCustomRowsFromDOM() {
    const rows = document.querySelectorAll('tr[data-psz-source]');
    rows.forEach((tr) => {
        const source = tr.dataset.pszSource;
        const idx = parseInt(tr.dataset.pszIdx);
        const prefix = `step4-psz-${source}-${idx}`;

        const rodzajEl = document.getElementById(`${prefix}-rodzaj`);
        const dnOdEl = document.getElementById(`${prefix}-dnod`);
        const dnDoEl = document.getElementById(`${prefix}-dndo`);
        const iloscEl = document.getElementById(`${prefix}-ilosc`);
        const uwagiEl = document.getElementById(`${prefix}-uwagi`);
        const czyEl = document.getElementById(`${prefix}-czy`);

        if (!rodzajEl) return;

        const data = {
            rodzaj: rodzajEl.value.trim(),
            dnOd:
                dnOdEl && dnOdEl.value
                    ? dnOdEl.value.includes('/')
                        ? dnOdEl.value
                        : parseFloat(dnOdEl.value)
                    : '',
            dnDo:
                dnDoEl && dnDoEl.value
                    ? dnDoEl.value.includes('/')
                        ? dnDoEl.value
                        : parseFloat(dnDoEl.value)
                    : '',
            ilosc: iloscEl ? parseInt(iloscEl.value) || 1 : 1,
            uwagi: uwagiEl ? uwagiEl.value.trim() : '',
            czyPrzejscie: czyEl ? czyEl.value : 'TAK',
            source: source
        };

        if (source === 'custom') {
            _customPrzejscieRows[idx] = data;
        } else if (source === 'offer') {
            _offerPrzejscieRows[idx] = data;
        }
    });
}

function collectPrzejsciaDetailsFromTable() {
    _syncCustomRowsFromDOM();
    const result = [];
    _offerPrzejscieRows.forEach((r) => {
        if (r.rodzaj && r.rodzaj.trim() !== '') {
            result.push({
                rodzaj: r.rodzaj.trim(),
                dnOd:
                    r.dnOd !== ''
                        ? String(r.dnOd).includes('/')
                            ? String(r.dnOd)
                            : parseFloat(r.dnOd)
                        : 0,
                dnDo:
                    r.dnDo !== ''
                        ? String(r.dnDo).includes('/')
                            ? String(r.dnDo)
                            : parseFloat(r.dnDo)
                        : 0,
                ilosc: r.ilosc || 1,
                uwagi: r.uwagi || '',
                czyPrzejscie: r.czyPrzejscie || 'TAK',
                source: 'offer'
            });
        }
    });
    _customPrzejscieRows.forEach((r) => {
        if (r.rodzaj && r.rodzaj.trim() !== '') {
            result.push({
                rodzaj: r.rodzaj.trim(),
                dnOd:
                    r.dnOd !== ''
                        ? String(r.dnOd).includes('/')
                            ? String(r.dnOd)
                            : parseFloat(r.dnOd)
                        : 0,
                dnDo:
                    r.dnDo !== ''
                        ? String(r.dnDo).includes('/')
                            ? String(r.dnDo)
                            : parseFloat(r.dnDo)
                        : 0,
                ilosc: r.ilosc || 1,
                uwagi: r.uwagi || '',
                czyPrzejscie: r.czyPrzejscie || 'TAK',
                source: 'custom'
            });
        }
    });
    return result;
}
