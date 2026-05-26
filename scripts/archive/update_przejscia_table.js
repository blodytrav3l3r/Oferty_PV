const fs = require('fs');

const content = fs.readFileSync('public/js/studnie/orderManager.js', 'utf-8');

const regex = /function buildPrzejscieRowHTML\(row, idx, source\) \{[\s\S]*?return `<tr[\s\S]*?<\/tr>`;\r?\n\}/;
const newFunc = `function buildPrzejscieRowHTML(row, idx, source) {
    const prefix = \`step4-psz-\${source}-\${idx}\`;
    const isCustom = source === 'custom';
    const rowBg = isCustom ? 'rgba(245,158,11,0.04)' : 'transparent';
    const borderLeft = isCustom ? '2px solid rgba(245,158,11,0.3)' : 'none';

    let rodzajCell = '';
    let dnOdCell = '';
    let dnDoCell = '';

    if (isCustom) {
        // Collect unique categories and DNs from studnieProducts
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

        rodzajCell = \`
            <div style="display:flex; gap:0.4rem; flex-direction:column;">
                <select id="\${prefix}-rodzaj-select" class="form-input" style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="document.getElementById('\${prefix}-rodzaj').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('\${prefix}-rodzaj').value = this.value;">
                    <option value="" disabled \${!row.rodzaj ? 'selected' : ''}>Wybierz rodzaj...</option>
                    \${catOptions.map(c => \`<option value="\${c}" \${row.rodzaj === c ? 'selected' : ''}>\${c}</option>\`).join('')}
                    <option value="Inne" \${isRodzajInne ? 'selected' : ''}>Inne</option>
                </select>
                <input type="text" id="\${prefix}-rodzaj" class="form-input" value="\${escapeAttr(row.rodzaj || '')}" placeholder="Wpisz własny rodzaj..." style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); display:\${isRodzajInne ? 'block' : 'none'};">
            </div>\`;

        dnOdCell = \`
            <div style="display:flex; gap:0.4rem; flex-direction:column;">
                <select id="\${prefix}-dnod-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="document.getElementById('\${prefix}-dnod').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('\${prefix}-dnod').value = this.value;">
                    <option value="" \${!row.dnOd ? 'selected' : ''}>—</option>
                    \${dnOptions.map(d => \`<option value="\${d}" \${parseFloat(row.dnOd) === d ? 'selected' : ''}>\${d}</option>\`).join('')}
                    <option value="Inne" \${isDnOdInne ? 'selected' : ''}>Inne</option>
                </select>
                <input type="number" id="\${prefix}-dnod" class="form-input" value="\${row.dnOd || ''}" placeholder="DN od" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:\${isDnOdInne ? 'block' : 'none'};">
            </div>\`;

        dnDoCell = \`
            <div style="display:flex; gap:0.4rem; flex-direction:column;">
                <select id="\${prefix}-dndo-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="document.getElementById('\${prefix}-dndo').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('\${prefix}-dndo').value = this.value;">
                    <option value="" \${!row.dnDo ? 'selected' : ''}>—</option>
                    \${dnOptions.map(d => \`<option value="\${d}" \${parseFloat(row.dnDo) === d ? 'selected' : ''}>\${d}</option>\`).join('')}
                    <option value="Inne" \${isDnDoInne ? 'selected' : ''}>Inne</option>
                </select>
                <input type="number" id="\${prefix}-dndo" class="form-input" value="\${row.dnDo || ''}" placeholder="DN do" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:\${isDnDoInne ? 'block' : 'none'};">
            </div>\`;
    } else {
        rodzajCell = \`<span style="font-weight:700; color:var(--text-primary); font-size:0.78rem;">\${escapeHTML(row.rodzaj)}</span>\`;
        dnOdCell = \`<span style="font-weight:700; color:var(--text-primary); font-size:0.78rem;">\${row.dnOd || '—'}</span><input type="hidden" id="\${prefix}-dnod" value="\${row.dnOd || ''}">\`;
        dnDoCell = \`<span style="font-weight:700; color:var(--text-primary); font-size:0.78rem;">\${row.dnDo || '—'}</span><input type="hidden" id="\${prefix}-dndo" value="\${row.dnDo || ''}">\`;
    }

    return \`<tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:\${rowBg}; border-left:\${borderLeft};" data-psz-source="\${source}" data-psz-idx="\${idx}">
        <td style="padding:0.4rem 0.5rem; white-space:nowrap; vertical-align:top;">\${rodzajCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">\${dnOdCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">\${dnDoCell}</td>
        <td style="padding:0.4rem 0.5rem; vertical-align:top;">
            <input type="text" id="\${prefix}-uwagi" class="form-input" value="\${escapeAttr(row.uwagi || '')}" placeholder="Uwagi..." style="width:100%; font-size:0.75rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);">
        </td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">
            <select id="\${prefix}-czy" class="form-input" style="width:80px; font-size:0.75rem; padding:0.3rem; text-align:center; font-weight:700; border-radius:4px; \${row.czyPrzejscie === 'TAK' ? 'color:#4ade80; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3);' : 'color:#f87171; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);'}" onchange="updatePrzejscieSelectStyle(this)">
                <option value="TAK"\${row.czyPrzejscie === 'TAK' ? ' selected' : ''}>TAK</option>
                <option value="NIE"\${row.czyPrzejscie === 'NIE' ? ' selected' : ''}>NIE</option>
            </select>
        </td>
        <td style="padding:0.4rem 0.2rem; text-align:center; vertical-align:top;">
            \${isCustom ? \`<button type="button" onclick="removeCustomPrzejscieRow(\${idx})" title="Usuń" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#f87171; width:26px; height:26px; border-radius:5px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s;" onmouseenter="this.style.background='rgba(239,68,68,0.25)'" onmouseleave="this.style.background='rgba(239,68,68,0.1)'"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>\` : ''}
        </td>
    </tr>\`;
}`;

const newContent = content.replace(regex, newFunc);
fs.writeFileSync('public/js/studnie/orderManager.js', newContent);
