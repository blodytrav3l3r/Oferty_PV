const fs = require('fs');

let content = fs.readFileSync('public/js/studnie/orderManager.js', 'utf-8');

// 1. Refactor buildPrzejscieRowHTML
const buildPrzejscieRegex = /function buildPrzejscieRowHTML\(row, idx, source\) \{[\s\S]*?return `<tr[\s\S]*?<\/tr>`;\r?\n\}/;
const newBuildPrzejscie = `function buildPrzejscieRowHTML(row, idx, source) {
    const prefix = \`step4-psz-\${source}-\${idx}\`;
    const rowBg = source === 'custom' ? 'rgba(245,158,11,0.04)' : 'transparent';
    const borderLeft = source === 'custom' ? '2px solid rgba(245,158,11,0.3)' : 'none';

    const cats = new Set();
    const dns = new Set();
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach(p => {
            if (p.componentType === 'przejscie' && p.active !== 0) {
                if (p.category) cats.add(p.category);
                if (typeof p.dn === 'string' && p.dn.includes('/')) {
                    dns.add(parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0);
                } else if (p.dn) {
                    dns.add(parseFloat(p.dn) || 0);
                }
            }
        });
    }
    
    const catOptions = Array.from(cats).sort();
    const dnOptions = Array.from(dns).filter(d => !isNaN(d) && d > 0).sort((a,b)=>a-b);
    
    const isRodzajInne = row.rodzaj && !catOptions.includes(row.rodzaj);
    const isDnOdInne = row.dnOd && !dnOptions.includes(parseFloat(row.dnOd));
    const isDnDoInne = row.dnDo && !dnOptions.includes(parseFloat(row.dnDo));
    
    const warnScript = source === 'offer' ? "if(!this.dataset.warned) { alert('Zmieniasz przejście wyliczone z oferty!'); this.dataset.warned = '1'; }" : "";

    const rodzajCell = \`
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="\${prefix}-rodzaj-select" class="form-input" style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="\${warnScript} document.getElementById('\${prefix}-rodzaj').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('\${prefix}-rodzaj').value = this.value;">
                <option value="" disabled \${!row.rodzaj ? 'selected' : ''}>Wybierz rodzaj...</option>
                \${catOptions.map(c => \`<option value="\${c}" \${row.rodzaj === c ? 'selected' : ''}>\${c}</option>\`).join('')}
                <option value="Inne" \${isRodzajInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="text" id="\${prefix}-rodzaj" class="form-input" value="\${escapeAttr(row.rodzaj || '')}" placeholder="Wpisz własny rodzaj..." style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); display:\${isRodzajInne ? 'block' : 'none'};" onchange="\${warnScript}">
        </div>\`;

    const dnOdCell = \`
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="\${prefix}-dnod-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="\${warnScript} document.getElementById('\${prefix}-dnod').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('\${prefix}-dnod').value = this.value;">
                <option value="" \${!row.dnOd ? 'selected' : ''}>—</option>
                \${dnOptions.map(d => \`<option value="\${d}" \${parseFloat(row.dnOd) === d ? 'selected' : ''}>\${d}</option>\`).join('')}
                <option value="Inne" \${isDnOdInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="number" id="\${prefix}-dnod" class="form-input" value="\${row.dnOd || ''}" placeholder="DN od" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:\${isDnOdInne ? 'block' : 'none'};" onchange="\${warnScript}">
        </div>\`;

    const dnDoCell = \`
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="\${prefix}-dndo-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="\${warnScript} document.getElementById('\${prefix}-dndo').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('\${prefix}-dndo').value = this.value;">
                <option value="" \${!row.dnDo ? 'selected' : ''}>—</option>
                \${dnOptions.map(d => \`<option value="\${d}" \${parseFloat(row.dnDo) === d ? 'selected' : ''}>\${d}</option>\`).join('')}
                <option value="Inne" \${isDnDoInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="number" id="\${prefix}-dndo" class="form-input" value="\${row.dnDo || ''}" placeholder="DN do" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:\${isDnDoInne ? 'block' : 'none'};" onchange="\${warnScript}">
        </div>\`;

    return \`<tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:\${rowBg}; border-left:\${borderLeft};" data-psz-source="\${source}" data-psz-idx="\${idx}">
        <td style="padding:0.4rem 0.5rem; white-space:nowrap; vertical-align:top;">\${rodzajCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">\${dnOdCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">\${dnDoCell}</td>
        <td style="padding:0.4rem 0.5rem; vertical-align:top;">
            <input type="text" id="\${prefix}-uwagi" class="form-input" value="\${escapeAttr(row.uwagi || '')}" placeholder="Uwagi..." style="width:100%; font-size:0.75rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="\${warnScript}">
        </td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">
            <select id="\${prefix}-czy" class="form-input" style="width:80px; font-size:0.75rem; padding:0.3rem; text-align:center; font-weight:700; border-radius:4px; \${row.czyPrzejscie === 'TAK' ? 'color:#4ade80; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3);' : 'color:#f87171; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);'}" onchange="\${warnScript} updatePrzejscieSelectStyle(this)">
                <option value="TAK"\${row.czyPrzejscie === 'TAK' ? ' selected' : ''}>TAK</option>
                <option value="NIE"\${row.czyPrzejscie === 'NIE' ? ' selected' : ''}>NIE</option>
            </select>
        </td>
        <td style="padding:0.4rem 0.2rem; text-align:center; vertical-align:top;">
            <button type="button" onclick="removePrzejscieRow('\${source}', \${idx})" title="Usuń" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#f87171; width:26px; height:26px; border-radius:5px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s;" onmouseenter="this.style.background='rgba(239,68,68,0.25)'" onmouseleave="this.style.background='rgba(239,68,68,0.1)'"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
        </td>
    </tr>\`;
}`;
content = content.replace(buildPrzejscieRegex, newBuildPrzejscie);

// 2. We need to add removePrzejscieRow handling and _deletedOfferRows
const deletedRowsInit = `let _customPrzejscieRows = [];\nlet _deletedOfferRows = new Set();\nlet _modifiedOfferRows = new Map();`;
content = content.replace(/let _customPrzejscieRows = \[\];/, deletedRowsInit);

const removeRowFunc = `
/** Usuwa wiersz przejścia szczelnego */
function removePrzejscieRow(source, idx) {
    _syncCustomRowsFromDOM();
    if (source === 'offer') {
        if (!confirm('Usuwasz przejście wyliczone z oferty. Czy na pewno chcesz to zrobić?')) return;
        const prefix = \`step4-psz-offer-\${idx}\`;
        const rodzajEl = document.getElementById(\`\${prefix}-rodzaj\`);
        if (rodzajEl) _deletedOfferRows.add(rodzajEl.value.trim());
    } else {
        _customPrzejscieRows.splice(idx, 1);
    }
    renderPrzejsciaDetailsTable(null);
}
`;
content = content.replace(/function removeCustomPrzejscieRow\(idx\) \{[\s\S]*?renderPrzejsciaDetailsTable\(null\);\r?\n\}/, removeRowFunc);

// 3. Update _syncCustomRowsFromDOM to sync ALL rows
const syncRowsFuncRegex = /function _syncCustomRowsFromDOM\(\) \{[\s\S]*?\}\r?\n\}/;
const newSyncRowsFunc = `function _syncCustomRowsFromDOM() {
    const rows = document.querySelectorAll('tr[data-psz-source]');
    rows.forEach(tr => {
        const source = tr.dataset.pszSource;
        const idx = tr.dataset.pszIdx;
        const prefix = \`step4-psz-\${source}-\${idx}\`;
        
        const rodzajEl = document.getElementById(\`\${prefix}-rodzaj\`);
        const dnOdEl = document.getElementById(\`\${prefix}-dnod\`);
        const dnDoEl = document.getElementById(\`\${prefix}-dndo\`);
        const uwagiEl = document.getElementById(\`\${prefix}-uwagi\`);
        const czyEl = document.getElementById(\`\${prefix}-czy\`);
        
        if (!rodzajEl) return;
        
        const data = {
            rodzaj: rodzajEl.value.trim(),
            dnOd: dnOdEl.value ? parseFloat(dnOdEl.value) : '',
            dnDo: dnDoEl.value ? parseFloat(dnDoEl.value) : '',
            uwagi: uwagiEl ? uwagiEl.value.trim() : '',
            czyPrzejscie: czyEl ? czyEl.value : 'TAK',
            source: source
        };
        
        if (source === 'custom') {
            _customPrzejscieRows[idx] = data;
        } else if (source === 'offer') {
            _modifiedOfferRows.set(idx.toString(), data);
        }
    });
}`;
content = content.replace(syncRowsFuncRegex, newSyncRowsFunc);

// 4. Update collectPrzejsciaDetailsFromTable to just use DOM elements!
const collectFuncRegex = /function collectPrzejsciaDetailsFromTable\(\) \{[\s\S]*?return result;\r?\n\}/;
const newCollectFunc = `function collectPrzejsciaDetailsFromTable() {
    const result = [];
    const rows = document.querySelectorAll('#step4-przejscia-details-table tr[data-psz-source]');
    rows.forEach(tr => {
        const source = tr.dataset.pszSource;
        const idx = tr.dataset.pszIdx;
        const prefix = \`step4-psz-\${source}-\${idx}\`;
        
        const rodzajEl = document.getElementById(\`\${prefix}-rodzaj\`);
        const dnOdEl = document.getElementById(\`\${prefix}-dnod\`);
        const dnDoEl = document.getElementById(\`\${prefix}-dndo\`);
        const uwagiEl = document.getElementById(\`\${prefix}-uwagi\`);
        const czyEl = document.getElementById(\`\${prefix}-czy\`);
        
        if (rodzajEl && rodzajEl.value.trim() !== '') {
            result.push({
                rodzaj: rodzajEl.value.trim(),
                dnOd: dnOdEl && dnOdEl.value !== '' ? parseFloat(dnOdEl.value) : 0,
                dnDo: dnDoEl && dnDoEl.value !== '' ? parseFloat(dnDoEl.value) : 0,
                uwagi: uwagiEl ? uwagiEl.value.trim() : '',
                czyPrzejscie: czyEl ? czyEl.value : 'TAK',
                source: source
            });
        }
    });
    return result;
}`;
content = content.replace(collectFuncRegex, newCollectFunc);

// 5. Update renderPrzejsciaDetailsTable
const renderRegex = /(const offerTypes = buildOfferPrzejsciaTypes\(\);)/;
const renderInject = "$1\n    let activeOfferTypes = offerTypes.filter(ot => !_deletedOfferRows.has(ot.rodzaj));\n    activeOfferTypes = activeOfferTypes.map((ot, idx) => _modifiedOfferRows.has(idx.toString()) ? _modifiedOfferRows.get(idx.toString()) : ot);";
content = content.replace(renderRegex, renderInject);

content = content.replace(/offerTypes\.forEach\(\(row, idx\) => \{/g, 'activeOfferTypes.forEach((row, idx) => {');
content = content.replace(/const allRows = \[\.\.\.offerTypes, \.\.\._customPrzejscieRows\];/g, 'const allRows = [...activeOfferTypes, ..._customPrzejscieRows];');

fs.writeFileSync('public/js/studnie/orderManager.js', content);
console.log('orderManager.js updated');
