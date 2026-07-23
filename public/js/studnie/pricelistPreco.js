/* ===== CENNIK PRECO — RENDEROWANIE ZAKŁADKI ===== */
let _precoDirty = false;

function updatePrecoSaveBtn() {
    const btn = document.querySelector('#studnie-pricelist-body button.btn-primary');
    if (!btn) return;
    btn.disabled = !_precoDirty;
}

/**
 * Renderuje zakładkę cennika PRECO z edytowalnymi tabelami accordion per DN studni.
 */
function renderPrecoPriceList() {
    const container = document.getElementById('studnie-pricelist-body');
    if (!container) return;

    if (!precoPricing || Object.keys(precoPricing).length === 0) {
        container.innerHTML =
            '<div style="padding:2rem; text-align:center; color:var(--muted);">Brak cennika PRECO. <button class="btn btn-secondary" onclick="loadPrecoDefaults()" style="font-size:0.8rem;">Reset</button></div>';
        return;
    }

    const dns = Object.keys(precoPricing)
        .map(Number)
        .filter((dn) => !isNaN(dn))
        .sort((a, b) => a - b);

    let html = `
    <div style="padding:0.5rem; display:flex; gap:0.5rem; justify-content:flex-end;">
        <button class="btn btn-secondary pill-sm" onclick="loadPrecoDefaults()">
            <i data-lucide="refresh-cw" aria-hidden="true"></i> Reset
        </button>
        <button class="btn btn-primary pill-sm" id="btn-save-preco" onclick="savePrecoFromUI()" disabled>
            <i data-lucide="save" aria-hidden="true"></i> Zapisz cennik PRECO
        </button>
    </div>`;

    dns.forEach((dn) => {
        const data = precoPricing[dn];
        if (!data) return;

        window.openPrecoAccordions = window.openPrecoAccordions || new Set();
        const isOpen = window.openPrecoAccordions.has(dn);
        const displayStyle = isOpen ? 'block' : 'none';
        const iconName = isOpen ? 'chevron-down' : 'chevron-right';

        html += `<div class="preco-accordion" style="margin-bottom:0.5rem; border:1px solid var(--border-glass); border-radius:8px; overflow:hidden;">`;
        html += `<div onclick="togglePrecoAccordion(this, ${dn})" style="cursor:pointer; padding:0.6rem 0.8rem; background:rgba(244,63,94,0.08); display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:0.85rem; color:#f43f5e;">`;
        html += `<span><i data-lucide="${iconName}" class="icon-xs"></i> DN${dn}</span>`;
        html += `<span style="font-size:0.7rem; color:var(--text-muted);">${data.kinety.length} pozycji</span>`;
        html += `</div>`;
        html += `<div class="preco-accordion-body" style="display:${displayStyle}; padding:0.5rem 0.8rem;">`;

        // Tabela kinet
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">`;
        html += `<div style="font-weight:600; font-size:0.78rem; color:var(--text-secondary);">Kinety — cena prosta / dod. wlot</div>`;
        html += `<button class="btn btn-secondary btn-sm" onclick="addPrecoKinetaRow(${dn})" style="font-size:0.7rem; padding:0.2rem 0.5rem;"><i data-lucide="plus" class="icon-xxs" aria-hidden="true"></i> Dodaj Kinetę</button>`;
        html += `</div>`;
        html += `<table style="width:100%; font-size:0.75rem; margin-bottom:0.8rem;"><thead><tr>
            <th style="width:20%;">DN rury</th>
            <th class="text-right" style="width:35%;">Cena prosta (PLN)</th>
            <th class="text-right" style="width:35%;">Dod. wlot (PLN)</th>
            <th class="text-center" style="width:10%;">Akcje</th>
        </tr></thead><tbody>`;
        data.kinety.forEach((k, i) => {
            html += `<tr>
                <td style="font-weight:600; color:#818cf8;"><input type="number" class="edit-input" style="width:100px;" value="${k.dn}" data-preco-field="kinety.${i}.dn" data-preco-dn="${dn}"></td>
                <td class="text-right"><input type="number" class="edit-input" style="width:110px; text-align:right;" value="${k.prosta}" data-preco-field="kinety.${i}.prosta" data-preco-dn="${dn}"></td>
                <td class="text-right"><input type="number" class="edit-input" style="width:110px; text-align:right;" value="${k.dodWlot}" data-preco-field="kinety.${i}.dodWlot" data-preco-dn="${dn}"></td>
                <td class="text-center"><button class="btn-icon del" onclick="removePrecoKinetaRow(${dn}, ${i})" title="Usuń" aria-label="Usuń" style="padding:0.2rem;"><i data-lucide="trash-2" class="icon-xs" aria-hidden="true"></i></button></td>
            </tr>`;
        });
        html += `</tbody></table>`;

        html += renderPrecoRangeTable(
            'Spadek w kinecie (%)',
            data.spadekKineta,
            dn,
            'spadekKineta'
        );
        html += renderPrecoRangeTable('Spadek w mufie (%)', data.spadekMufa, dn, 'spadekMufa');
        html += renderPrecoRangeTable('Uniesienie kinety (mm)', data.uniesienie, dn, 'uniesienie');
        html += renderPrecoRangeTable('Redukcja kinety (mm)', data.redukcja, dn, 'redukcja');

        html += `<div style="font-weight:600; font-size:0.78rem; margin:0.5rem 0 0.3rem; color:var(--text-secondary);">Skrzynka włazowa</div>`;
        html += `<div style="display:flex; gap:0.5rem; align-items:center; font-size:0.75rem;">`;
        html += `<span>Cena/szt:</span>`;
        html += `<input type="number" class="edit-input" style="width:110px; text-align:right;" value="${data.skrzynkaWlazowa || 0}" data-preco-field="skrzynkaWlazowa" data-preco-dn="${dn}">`;
        html += `<span class="text-muted">PLN</span>`;
        html += `</div>`;

        html += `<div style="font-weight:600; font-size:0.78rem; margin:0.5rem 0 0.3rem; color:var(--text-secondary);">Wkładka na całej wysokości dennicy (uzupełnienie)</div>`;
        html += `<div style="display:flex; gap:0.5rem; align-items:center; font-size:0.75rem;">`;
        html += `<span>Cena/mb:</span>`;
        html += `<input type="number" class="edit-input" style="width:110px; text-align:right;" value="${data.cenaPelnaWysMB || 0}" data-preco-field="cenaPelnaWysMB" data-preco-dn="${dn}">`;
        html += `<span class="text-muted">PLN</span>`;
        html += `</div>`;

        html += `<div style="font-weight:600; font-size:0.78rem; margin:0.5rem 0 0.3rem; color:var(--text-secondary);">Wkładka dna osadnika</div>`;
        html += `<div style="display:flex; gap:0.5rem; align-items:center; font-size:0.75rem;">`;
        html += `<span>Cena dna:</span>`;
        html += `<input type="number" class="edit-input" style="width:110px; text-align:right;" value="${data.cenaDnoOsadnika || 0}" data-preco-field="cenaDnoOsadnika" data-preco-dn="${dn}">`;
        html += `<span class="text-muted">PLN</span>`;
        html += `</div>`;

        html += `</div></div>`;
    });

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons({ root: container });

    container.querySelectorAll('[data-preco-field]').forEach(function (input) {
        input.addEventListener('input', function () {
            _precoDirty = true;
            updatePrecoSaveBtn();
        });
    });
}

function renderPrecoRangeTable(title, table, dn, fieldBase) {
    let grupyKeys = [];
    if (table && table.length > 0) {
        grupyKeys = Object.keys(table[0].grupy);
    } else {
        if (fieldBase === 'spadekKineta' || fieldBase === 'spadekMufa')
            grupyKeys = ['150-200', '250-300', '400-600'];
        else grupyKeys = ['150-300', '400-600'];
    }

    let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin:0.5rem 0 0.3rem;">`;
    html += `<div style="font-weight:600; font-size:0.78rem; color:var(--text-secondary);">${title}</div>`;
    html += `<button class="btn btn-secondary btn-sm" onclick="addPrecoRangeRow(${dn}, '${fieldBase}')" style="font-size:0.7rem; padding:0.2rem 0.5rem;"><i data-lucide="plus" class="icon-xxs" aria-hidden="true"></i> Dodaj Zakres</button>`;
    html += `</div>`;

    html += `<table style="width:100%; font-size:0.75rem; margin-bottom:0.8rem;"><thead><tr>`;
    html += `<th style="width:25%; padding-left:0.5rem;">Zakres min-max</th>`;
    grupyKeys.forEach((g) => {
        const sg = window.escapeHtml(g);
        const sgJs = encodeURIComponent(g);
        html += `<th style="padding:0.2rem 0.5rem;">
            <div style="display:flex; justify-content:flex-end; align-items:center; gap:0.3rem;">
                <span style="color:var(--text-muted); font-size:0.7rem;">DN</span>
                <input type="text" class="edit-input" style="width:75px; text-align:center; font-weight:bold; background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:0.2rem;" value="${sg}" onchange="updatePrecoGrupaKey(${dn}, '${fieldBase}', decodeURIComponent('${sgJs}'), this.value)" title="Edytuj nazwę grupy">
                <button class="btn-icon del" onclick="removePrecoGrupaCol(${dn}, '${fieldBase}', decodeURIComponent('${sgJs}'))" title="Usuń grupę" aria-label="Usuń grupę" style="padding:0.15rem; margin:0;"><i data-lucide="x" class="icon-xxs" aria-hidden="true"></i></button>
            </div>
        </th>`;
    });
    html += `<th class="text-center" style="width:15%;">
        <div style="display:flex; justify-content:center; align-items:center; gap:0.3rem;">
            <button class="btn btn-secondary btn-sm" onclick="addPrecoGrupaCol(${dn}, '${fieldBase}')" style="padding:0.1rem 0.3rem;" title="Dodaj grupę DN"><i data-lucide="plus" class="icon-xxs" aria-hidden="true"></i></button>
            <span>Akcje</span>
        </div>
    </th>`;
    html += `</tr></thead><tbody>`;

    if (table && table.length > 0) {
        table.forEach((row, ri) => {
            html += `<tr><td style="font-weight:600; color:#818cf8; padding-left:0.5rem;">
                <div style="display:flex; gap:0.5rem; align-items:center; justify-content:flex-start;">
                    <input type="number" class="edit-input" style="width:70px; text-align:center; padding:0.2rem;" value="${row.min}" data-preco-field="${fieldBase}.${ri}.min" data-preco-dn="${dn}">
                    <span style="color:var(--text-muted); font-weight:normal;">–</span> 
                    <input type="number" class="edit-input" style="width:70px; text-align:center; padding:0.2rem;" value="${row.max}" data-preco-field="${fieldBase}.${ri}.max" data-preco-dn="${dn}">
                </div>
            </td>`;
            grupyKeys.forEach((g) => {
                const sg = window.escapeHtml(g);
                html += `<td class="text-right" style="padding:0.2rem 0.5rem;"><input type="number" class="edit-input" style="width:100%; max-width:90px; text-align:right; float:right;" value="${row.grupy[g] || 0}" data-preco-field="${fieldBase}.${ri}.grupy.${sg}" data-preco-dn="${dn}"></td>`;
            });
            html += `<td class="text-center"><button class="btn-icon del" onclick="removePrecoRangeRow(${dn}, '${fieldBase}', ${ri})" title="Usuń" aria-label="Usuń" style="padding:0.2rem;"><i data-lucide="trash-2" class="icon-xs" aria-hidden="true"></i></button></td>`;
            html += `</tr>`;
        });
    } else {
        html += `<tr><td colspan="${grupyKeys.length + 2}" class="text-center" style="color:var(--text-muted); padding:1rem;">Brak zakresów</td></tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

function addPrecoKinetaRow(dn) {
    precoPricing = collectPrecoFromUI();
    if (!precoPricing[dn]) return;
    if (!precoPricing[dn].kinety) precoPricing[dn].kinety = [];
    precoPricing[dn].kinety.push({ dn: 0, prosta: 0, dodWlot: 0 });
    _precoDirty = true;
    renderPrecoPriceList();
}

async function removePrecoKinetaRow(dn, index) {
    if (!(await appConfirm('Usunąć tę kinetę?', { title: 'Potwierdzenie', type: 'danger' })))
        return;
    precoPricing = collectPrecoFromUI();
    if (!precoPricing[dn] || !precoPricing[dn].kinety) return;
    precoPricing[dn].kinety.splice(index, 1);
    _precoDirty = true;
    renderPrecoPriceList();
}

function addPrecoRangeRow(dn, fieldBase) {
    precoPricing = collectPrecoFromUI();
    if (!precoPricing[dn]) return;
    if (!precoPricing[dn][fieldBase]) precoPricing[dn][fieldBase] = [];

    const table = precoPricing[dn][fieldBase];
    let grupyKeys = [];
    if (table.length > 0) {
        grupyKeys = Object.keys(table[0].grupy);
    } else {
        if (fieldBase === 'spadekKineta' || fieldBase === 'spadekMufa')
            grupyKeys = ['150-200', '250-300', '400-600'];
        else grupyKeys = ['150-300', '400-600'];
    }

    const newRow = { min: 0, max: 0, grupy: {} };
    grupyKeys.forEach((g) => (newRow.grupy[g] = 0));
    table.push(newRow);
    _precoDirty = true;
    renderPrecoPriceList();
}

async function removePrecoRangeRow(dn, fieldBase, index) {
    if (!(await appConfirm('Usunąć ten zakres?', { title: 'Potwierdzenie', type: 'danger' })))
        return;
    precoPricing = collectPrecoFromUI();
    if (!precoPricing[dn] || !precoPricing[dn][fieldBase]) return;
    precoPricing[dn][fieldBase].splice(index, 1);
    _precoDirty = true;
    renderPrecoPriceList();
}

function updatePrecoGrupaKey(dn, fieldBase, oldKey, newKey) {
    if (!newKey || oldKey === newKey) return;
    precoPricing = collectPrecoFromUI();
    if (!precoPricing[dn] || !precoPricing[dn][fieldBase]) return;

    precoPricing[dn][fieldBase].forEach((row) => {
        if (row.grupy && row.grupy[oldKey] !== undefined) {
            row.grupy[newKey] = row.grupy[oldKey];
            delete row.grupy[oldKey];
        }
    });
    _precoDirty = true;
    renderPrecoPriceList();
}

function addPrecoGrupaCol(dn, fieldBase) {
    const newDn = prompt("Podaj nazwę nowej grupy DN (np. '800-1000'):");
    if (!newDn || !/^\d+-\d+$/.test(newDn)) {
        if (newDn) showToast('Dozwolony format: liczby-liczby (np. 150-200)', 'error');
        return;
    }
    precoPricing = collectPrecoFromUI();
    if (!precoPricing[dn] || !precoPricing[dn][fieldBase]) return;

    precoPricing[dn][fieldBase].forEach((row) => {
        if (!row.grupy) row.grupy = {};
        row.grupy[newDn] = 0;
    });
    _precoDirty = true;
    renderPrecoPriceList();
}

async function removePrecoGrupaCol(dn, fieldBase, g) {
    if (!(await appConfirm(`Usunąć grupę DN ${g}?`, { title: 'Potwierdzenie', type: 'danger' })))
        return;
    precoPricing = collectPrecoFromUI();
    if (!precoPricing[dn] || !precoPricing[dn][fieldBase]) return;

    precoPricing[dn][fieldBase].forEach((row) => {
        if (row.grupy && row.grupy[g] !== undefined) {
            delete row.grupy[g];
        }
    });
    _precoDirty = true;
    renderPrecoPriceList();
}

function togglePrecoAccordion(headerEl, dn) {
    const body = headerEl.nextElementSibling;
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';

    window.openPrecoAccordions = window.openPrecoAccordions || new Set();
    if (dn) {
        if (isOpen) window.openPrecoAccordions.delete(dn);
        else window.openPrecoAccordions.add(dn);
    }

    const icon = headerEl.querySelector('[data-lucide]');
    if (icon) {
        icon.setAttribute('data-lucide', isOpen ? 'chevron-right' : 'chevron-down');
        if (window.lucide) lucide.createIcons();
    }
}

function collectPrecoFromUI() {
    const data = structuredClone(precoPricing);
    document.querySelectorAll('[data-preco-field]').forEach((/** @type {HTMLElement} */ input) => {
        const dn = input.dataset.precoDn;
        const fieldPath = input.dataset.precoField;
        const val = parseFloat(input.value) || 0;

        if (!data[dn]) return;

        const parts = fieldPath.split('.');
        let target = data[dn];
        for (let i = 0; i < parts.length - 1; i++) {
            const key = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
            if (target[key] === undefined) continue;
            target = target[key];
        }
        const lastKey = parts[parts.length - 1];
        target[lastKey] = val;
    });
    return data;
}

async function savePrecoFromUI() {
    if (!_precoDirty) {
        showToast('Brak zmian do zapisania', 'info');
        return;
    }
    const btns = document.querySelectorAll('[onclick*="savePrecoFromUI"]');
    btns.forEach((b) => b.setAttribute('disabled', 'true'));
    try {
        const data = collectPrecoFromUI();
        precoPricing = data;
        const ok = await savePrecoPricing(data);
        if (ok) {
            _precoDirty = false;
            updatePrecoSaveBtn();
            await refreshAll();
        }
    } finally {
        btns.forEach((b) => b.removeAttribute('disabled'));
    }
}

async function loadPrecoDefaults() {
    const btns = document.querySelectorAll('[onclick*="loadPrecoDefaults"]');
    btns.forEach((b) => b.setAttribute('disabled', 'true'));
    if (
        !(await appConfirm('Przywrócić cennik PRECO do wartości fabrycznych?', {
            title: 'Reset cennika PRECO',
            type: 'warning'
        }))
    ) {
        btns.forEach((b) => b.removeAttribute('disabled'));
        return;
    }
    try {
        const res = await fetchWithTimeout('/api/preco-pricing/default');
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            precoPricing = json.data[0];
            _precoDirty = true;
            updatePrecoSaveBtn();
            renderPrecoPriceList();
            showToast('Cennik PRECO przywrócony — kliknij Zapisz by zachować', 'info');
        } else {
            showToast('Brak fabrycznych wartości cennika PRECO', 'error');
        }
    } catch (e) {
        logger.error('pricelistManager', 'Błąd ładowania cennika PRECO:', e);
        showToast('Błąd sieci przy ładowaniu cennika PRECO', 'error');
    } finally {
        btns.forEach((b) => b.removeAttribute('disabled'));
    }
}

window.renderPrecoPriceList = renderPrecoPriceList;
window.savePrecoFromUI = savePrecoFromUI;
window.loadPrecoDefaults = loadPrecoDefaults;
window.togglePrecoAccordion = togglePrecoAccordion;
window.addPrecoKinetaRow = addPrecoKinetaRow;
window.removePrecoKinetaRow = removePrecoKinetaRow;
window.addPrecoRangeRow = addPrecoRangeRow;
window.removePrecoRangeRow = removePrecoRangeRow;
window.updatePrecoGrupaKey = updatePrecoGrupaKey;
window.addPrecoGrupaCol = addPrecoGrupaCol;
window.removePrecoGrupaCol = removePrecoGrupaCol;
