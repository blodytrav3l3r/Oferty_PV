// @ts-check
/* ===== ZAMÓWIENIA RUR — PRZEJŚCIA SZCZELNE TABELA ===== */

window._customPrzejscieRows = [];
window._offerPrzejscieRows = [];
window._przejsciaInitialized = false;

function renderPrzejsciaDetailsTable(_existingData) {
    const container = document.getElementById('step4-przejscia-details-table');
    if (!container) return;

    const allRows = [
        ...window._offerPrzejscieRows.map((r, i) => ({ ...r, source: 'offer', _idx: i })),
        ...window._customPrzejscieRows.map((r, i) => ({ ...r, source: 'custom', _idx: i }))
    ];

    if (allRows.length === 0) {
        container.innerHTML =
            '<div style="font-size: var(--fs-md); color: var(--text-muted); padding: 0.5rem;">Brak przej\u015B\u0107. Kliknij "Dodaj niestandardowe" aby doda\u0107.</div>';
        return;
    }

    let html = `<table class="rury-table" class="text-xs">
        <th scope="col"ead>
            <tr>
                <th scope="col" class="w-22pct">Rodzaj przej\u015Bcia</th>
                <th scope="col" class="w-12pct">DN OD</th>
                <th scope="col" class="w-12pct">DN DO</th>
                <th scope="col" class="w-12pct">Ilo\u015B\u0107</th>
                <th scope="col" class="w-22pct">Uwagi</th>
                <th scope="col" class="w-10pct">Czy przej\u015Bcie?</th>
                <th scope="col" class="w-10pct">Akcje</th>
            </tr>
        </thead>
        <tbody>`;

    allRows.forEach((row, _idx) => {
        const isCustom = row.source === 'custom';
        html += `<tr>
            <td>
                ${
                    isCustom
                        ? `<input type="text" class="form-input" value="${escapeHtml(row.rodzaj || '')}" class="fs-sm-024" data-field="rodzaj" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" />`
                        : `<span class="fw-600">${escapeHtml(row.rodzaj || '\u2014')}</span>`
                }
            </td>
            <td><input type="text" class="form-input" value="${escapeHtml(row.dnOd || '')}" class="fs-sm-024" data-field="dnOd" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="text" class="form-input" value="${escapeHtml(row.dnDo || '')}" class="fs-sm-024" data-field="dnDo" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="number" class="form-input" value="${escapeHtml(row.ilosc || '')}" class="fs-sm-024" data-field="ilosc" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="text" class="form-input" value="${escapeHtml(row.uwagi || '')}" class="fs-sm-024" data-field="uwagi" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td>
                <select class="form-input" style="width:100%;font-size: var(--fs-sm);padding:0.2rem;" data-field="czyPrzejscie" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)">
                    <option value="TAK" ${row.czyPrzejscie === 'TAK' ? 'selected' : ''}>TAK</option>
                    <option value="NIE" ${row.czyPrzejscie === 'NIE' ? 'selected' : ''}>NIE</option>
                </select>
            </td>
            <td>
                ${
                    isCustom
                        ? `<button class="btn btn-sm btn-danger" onclick="removePrzejscieRow('custom', ${row._idx})" style="font-size: var(--fs-xs);padding:0.15rem 0.4rem;"><i data-lucide="x" class="icon-12"></i></button>`
                        : '<span style="color:var(--text-muted);font-size: var(--fs-xs);">z oferty</span>'
                }
            </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

function addCustomPrzejscieRow() {
    _syncCustomRowsFromDOM();
    window._customPrzejscieRows.push({
        rodzaj: '',
        dnOd: '',
        dnDo: '',
        ilosc: 1,
        uwagi: '',
        czyPrzejscie: 'TAK',
        source: 'custom'
    });
    renderPrzejsciaDetailsTable();
}
window.addCustomPrzejscieRow = addCustomPrzejscieRow;

function removePrzejscieRow(source, idx) {
    if (source === 'custom') {
        window._customPrzejscieRows.splice(idx, 1);
    } else {
        window._offerPrzejscieRows.splice(idx, 1);
    }
    renderPrzejsciaDetailsTable();
}
window.removePrzejscieRow = removePrzejscieRow;

function _syncCustomRow(input) {
    const field = input.dataset.field;
    const source = input.dataset.source;
    const idx = parseInt(input.dataset.idx);
    const target = source === 'custom' ? window._customPrzejscieRows : window._offerPrzejscieRows;
    if (target && target[idx] !== undefined) {
        target[idx][field] = input.value;
    }
}

function _syncCustomRowsFromDOM() {
    document
        .querySelectorAll(
            '#step4-przejscia-details-table input, #step4-przejscia-details-table select'
        )
        .forEach((input) => {
            if (input.dataset.field && input.dataset.source && input.dataset.idx !== undefined) {
                _syncCustomRow(input);
            }
        });
}

function collectPrzejsciaDetailsFromTable() {
    _syncCustomRowsFromDOM();
    return [
        ...window._offerPrzejscieRows.map((r) => ({ ...r, source: 'offer' })),
        ...window._customPrzejscieRows.map((r) => ({ ...r, source: 'custom' }))
    ];
}

function handlePrzejsciaZamowioneChange(select) {
    const dataInput = document.getElementById('step4-data-zamowienia');
    if (select.value === 'Tak' && dataInput && !dataInput.value) {
        dataInput.value = new Date().toISOString().slice(0, 10);
    }
}
window.handlePrzejsciaZamowioneChange = handlePrzejsciaZamowioneChange;

/* ===== Rejestracja globali ===== */
window.collectPrzejsciaDetailsFromTable = collectPrzejsciaDetailsFromTable;
