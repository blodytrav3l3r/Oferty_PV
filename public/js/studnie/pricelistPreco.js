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
            '<div class="empty-state">Brak cennika PRECO. <button class="btn btn-secondary fs-md" data-action="loadPrecoDefaults" title="Przywróć domyślne wartości PRECO">Reset</button></div>';
        return;
    }

    const dns = Object.keys(precoPricing)
        .map(Number)
        .filter((dn) => !isNaN(dn))
        .sort((a, b) => a - b);

    let html = `
    <div class="preco-toolbar">
        <button class="btn btn-secondary pill-sm" data-action="loadPrecoDefaults" title="Przywróć domyślne wartości PRECO">
            <i data-lucide="refresh-cw" aria-hidden="true"></i> Reset
        </button>
        <button class="btn btn-primary pill-sm" id="btn-save-preco" data-action="savePrecoFromUI" disabled title="Zapisz zmiany w cenniku PRECO">
            <i data-lucide="save" aria-hidden="true"></i> Zapisz cennik PRECO
        </button>
    </div>`;

    dns.forEach((dn) => {
        const data = precoPricing[dn];
        if (!data) return;

        window.openPrecoAccordions = window.openPrecoAccordions || new Set();
        // Stan zwinięcia: pamięć sesji (Set) jako default, localStorage per-user wygrywa.
        let isOpen = window.openPrecoAccordions.has(dn);
        try {
            if (typeof collapseGet === 'function') isOpen = collapseGet('preco:' + dn, isOpen);
        } catch (_e) {}
        const displayStyle = isOpen ? 'block' : 'none';
        const iconName = isOpen ? 'chevron-down' : 'chevron-right';

        html += `<div class="preco-accordion">`;
        html += `<div class="preco-accordion-head" data-action="togglePrecoAccordion" data-dn="${dn}">`;
        html += `<span class="preco-accordion-title"><i data-lucide="${iconName}" class="icon-xs"></i> DN${dn}</span>`;
        html += `<span class="preco-accordion-count">${data.kinety.length} pozycji</span>`;
        html += `</div>`;
        html += `<div class="preco-accordion-body" style="display:${displayStyle};">`;

        // Tabela kinet
        html += `<div class="preco-section-head">`;
        html += `<div class="preco-section-title">Kinety — cena prosta / dod. wlot</div>`;
        html += `<button class="btn btn-secondary btn-sm" data-action="addPrecoKinetaRow" data-dn="${dn}" ><i data-lucide="plus" class="icon-xxs" aria-hidden="true"></i> Dodaj Kinetę</button>`;
        html += `</div>`;
        html += `<div class="table-wrap preco-wrap"><table class="preco-table preco-table--kinety"><thead><tr>
            <th scope="col" class="preco-col-id">DN rury</th>
            <th scope="col" class="preco-col-num" >Cena prosta (PLN)</th>
            <th scope="col" class="preco-col-num" >Dod. wlot (PLN)</th>
            <th scope="col" class="preco-col-actions" >Akcje</th>
        </tr></thead><tbody>`;
        data.kinety.forEach((k, i) => {
            html += `<tr>
                <td class="preco-cell-id"><input type="number" class="edit-input preco-input preco-input--id"  value="${k.dn}" data-preco-field="kinety.${i}.dn" data-preco-dn="${dn}" aria-label="DN rury"></td>
                <td class="preco-cell-num"><input type="number" class="edit-input preco-input preco-input--num"  value="${k.prosta}" data-preco-field="kinety.${i}.prosta" data-preco-dn="${dn}" aria-label="Cena prosta"></td>
                <td class="preco-cell-num"><input type="number" class="edit-input preco-input preco-input--num"  value="${k.dodWlot}" data-preco-field="kinety.${i}.dodWlot" data-preco-dn="${dn}" aria-label="Dodatkowy wlot"></td>
                <td class="preco-cell-actions"><button class="btn-icon del p-02" data-action="removePrecoKinetaRow" data-dn="${dn}" data-i="${i}" title="Usuń" aria-label="Usuń" ><i data-lucide="trash-2" class="icon-xs" aria-hidden="true"></i></button></td>
            </tr>`;
        });
        html += `</tbody></table></div>`;

        html += renderPrecoRangeTable(
            'Spadek w kinecie (%)',
            data.spadekKineta,
            dn,
            'spadekKineta'
        );
        html += renderPrecoRangeTable('Spadek w mufie (%)', data.spadekMufa, dn, 'spadekMufa');
        html += renderPrecoRangeTable('Uniesienie kinety (mm)', data.uniesienie, dn, 'uniesienie');
        html += renderPrecoRangeTable('Redukcja kinety (mm)', data.redukcja, dn, 'redukcja');

        html += `<div class="preco-meta">`;
        html += `<div class="preco-meta-item">`;
        html += `<span class="preco-meta-label">Skrzynka włazowa · cena/szt:</span>`;
        html += `<input type="number" class="edit-input preco-input preco-input--num"  value="${data.skrzynkaWlazowa || 0}" data-preco-field="skrzynkaWlazowa" data-preco-dn="${dn}" aria-label="Skrzynka włazowa cena za sztukę">`;
        html += `<span class="preco-meta-unit">PLN</span>`;
        html += `</div>`;

        html += `<div class="preco-meta-item">`;
        html += `<span class="preco-meta-label">Wkładka na całej wysokości · cena/mb:</span>`;
        html += `<input type="number" class="edit-input preco-input preco-input--num"  value="${data.cenaPelnaWysMB || 0}" data-preco-field="cenaPelnaWysMB" data-preco-dn="${dn}" aria-label="Wkładka na całej wysokości cena za metr">`;
        html += `<span class="preco-meta-unit">PLN</span>`;
        html += `</div>`;

        html += `<div class="preco-meta-item">`;
        html += `<span class="preco-meta-label">Wkładka dna osadnika · cena dna:</span>`;
        html += `<input type="number" class="edit-input preco-input preco-input--num"  value="${data.cenaDnoOsadnika || 0}" data-preco-field="cenaDnoOsadnika" data-preco-dn="${dn}" aria-label="Wkładka dna osadnika cena">`;
        html += `<span class="preco-meta-unit">PLN</span>`;
        html += `</div>`;
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

    let html = `<div class="preco-section-head">`;
    html += `<div class="preco-section-title">${title}</div>`;
    html += `<button class="btn btn-secondary btn-sm" data-action="addPrecoRangeRow" data-dn="${dn}" data-fb="${fieldBase}" ><i data-lucide="plus" class="icon-xxs" aria-hidden="true"></i> Dodaj Zakres</button>`;
    html += `</div>`;

    html += `<div class="table-wrap preco-wrap"><table class="preco-table preco-table--range"><thead><tr>`;
    html += `<th scope="col" class="preco-col-range">Zakres min-max</th>`;
    grupyKeys.forEach((g) => {
        const sg = window.escapeHtml(g);
        const sgJs = encodeURIComponent(g);
        html += `<th scope="col" class="preco-col-group">
            <div class="preco-group-head">
                <span class="preco-group-prefix">DN</span>
                <input type="text" class="edit-input preco-group-input" value="${sg}" onchange="updatePrecoGrupaKey(${dn}, '${fieldBase}', decodeURIComponent('${sgJs}'), this.value)" title="Edytuj nazwę grupy" aria-label="Nazwa grupy DN">
                <button class="btn-icon del" data-action="removePrecoGrupaCol" data-dn="${dn}" data-fb="${fieldBase}" data-sg="${sgJs}" title="Usuń grupę" aria-label="Usuń grupę"><i data-lucide="x" class="icon-xxs" aria-hidden="true"></i></button>
            </div>
        </th>`;
    });
    html += `<th scope="col" class="preco-col-actions" >
        <div class="preco-actions-head">
            <button class="btn btn-secondary btn-sm preco-mini-btn" data-action="addPrecoGrupaCol" data-dn="${dn}" data-fb="${fieldBase}" title="Dodaj grupę DN" aria-label="Dodaj grupę DN"><i data-lucide="plus" class="icon-xxs" aria-hidden="true"></i></button>
            <span>Akcje</span>
        </div>
    </th>`;
    html += `</tr></thead><tbody>`;

    if (table && table.length > 0) {
        table.forEach((row, ri) => {
            html += `<tr><td class="preco-cell-range">
                <div class="preco-range-pair">
                    <input type="number" class="edit-input preco-input preco-input--num"  value="${row.min}" data-preco-field="${fieldBase}.${ri}.min" data-preco-dn="${dn}" aria-label="Zakres od">
                    <span class="preco-range-dash">–</span> 
                    <input type="number" class="edit-input preco-input preco-input--num"  value="${row.max}" data-preco-field="${fieldBase}.${ri}.max" data-preco-dn="${dn}" aria-label="Zakres do">
                </div>
            </td>`;
            grupyKeys.forEach((g) => {
                const sg = window.escapeHtmlAttr(g);
                html += `<td class="preco-cell-num" ><input type="number" class="edit-input preco-input preco-input--num" value="${row.grupy[g] || 0}" data-preco-field="${fieldBase}.${ri}.grupy.${sg}" data-preco-dn="${dn}" aria-label="Cena zakresu"></td>`;
            });
            html += `<td class="preco-cell-actions"><button class="btn-icon del p-02" data-action="removePrecoRangeRow" data-dn="${dn}" data-fb="${fieldBase}" data-ri="${ri}" title="Usuń" aria-label="Usuń" ><i data-lucide="trash-2" class="icon-xs" aria-hidden="true"></i></button></td>`;
            html += `</tr>`;
        });
    } else {
        html += `<tr><td colspan="${grupyKeys.length + 2}" class="preco-empty">Brak zakresów</td></tr>`;
    }

    html += `</tbody></table></div>`;
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

async function addPrecoGrupaCol(dn, fieldBase) {
    const newDn = await appPrompt("Podaj nazwę nowej grupy DN (np. '800-1000'):", '');
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
        try {
            if (typeof collapseSet === 'function') collapseSet('preco:' + dn, !isOpen);
        } catch (_e) {}
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

/* ===== Delegacja kliknięć (data-action) — TASK-036 ===== */
if (typeof document !== 'undefined' && !window.__precoDelegated) {
    window.__precoDelegated = true;
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action') || '';
        const dn = el.getAttribute('data-dn');
        const i = el.getAttribute('data-i');
        const fb = el.getAttribute('data-fb');
        const sg = el.getAttribute('data-sg');
        const ri = el.getAttribute('data-ri');
        if (action === 'loadPrecoDefaults') {
            window.loadPrecoDefaults();
        } else if (action === 'savePrecoFromUI') {
            window.savePrecoFromUI();
        } else if (action === 'togglePrecoAccordion') {
            window.togglePrecoAccordion(el, dn);
        } else if (action === 'addPrecoKinetaRow') {
            window.addPrecoKinetaRow(dn);
        } else if (action === 'removePrecoKinetaRow') {
            window.removePrecoKinetaRow(dn, parseInt(i, 10));
        } else if (action === 'addPrecoRangeRow') {
            window.addPrecoRangeRow(dn, fb);
        } else if (action === 'removePrecoGrupaCol') {
            window.removePrecoGrupaCol(dn, fb, decodeURIComponent(sg));
        } else if (action === 'addPrecoGrupaCol') {
            window.addPrecoGrupaCol(dn, fb);
        } else if (action === 'removePrecoRangeRow') {
            window.removePrecoRangeRow(dn, fb, parseInt(ri, 10));
        }
    });
}
