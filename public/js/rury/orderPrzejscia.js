// @ts-check
/* ===== ZAMÓWIENIA RUR — PRZEJŚCIA SZCZELNE TABELA ===== */

let _customPrzejscieRows = [];
let _offerPrzejscieRows = [];
let _przejsciaInitialized = false;

function renderPrzejsciaDetailsTable(existingData) {
    const container = document.getElementById('step4-przejscia-details-table');
    if (!container) return;

    const allRows = [
        ..._offerPrzejscieRows.map((r, i) => ({ ...r, source: 'offer', _idx: i })),
        ..._customPrzejscieRows.map((r, i) => ({ ...r, source: 'custom', _idx: i }))
    ];

    if (allRows.length === 0) {
        container.innerHTML =
            '<div style="font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem;">Brak przej\u015B\u0107. Kliknij "Dodaj niestandardowe" aby doda\u0107.</div>';
        return;
    }

    let html = `<table class="rury-table" class="text-xs">
        <thead>
            <tr>
                <th style="width:22%;">Rodzaj przej\u015Bcia</th>
                <th style="width:12%;">DN OD</th>
                <th style="width:12%;">DN DO</th>
                <th style="width:12%;">Ilo\u015B\u0107</th>
                <th style="width:22%;">Uwagi</th>
                <th style="width:10%;">Czy przej\u015Bcie?</th>
                <th style="width:10%;">Akcje</th>
            </tr>
        </thead>
        <tbody>`;

    allRows.forEach((row, idx) => {
        const isCustom = row.source === 'custom';
        html += `<tr>
            <td>
                ${
                    isCustom
                        ? `<input type="text" class="form-input" value="${row.rodzaj || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="rodzaj" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" />`
                        : `<span class="fw-600">${row.rodzaj || '\u2014'}</span>`
                }
            </td>
            <td><input type="text" class="form-input" value="${row.dnOd || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="dnOd" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="text" class="form-input" value="${row.dnDo || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="dnDo" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="number" class="form-input" value="${row.ilosc || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="ilosc" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td><input type="text" class="form-input" value="${row.uwagi || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="uwagi" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)" /></td>
            <td>
                <select class="form-input" style="width:100%;font-size:0.7rem;padding:0.2rem;" data-field="czyPrzejscie" data-source="${row.source}" data-idx="${row._idx}" onchange="_syncCustomRow(this)">
                    <option value="TAK" ${row.czyPrzejscie === 'TAK' ? 'selected' : ''}>TAK</option>
                    <option value="NIE" ${row.czyPrzejscie === 'NIE' ? 'selected' : ''}>NIE</option>
                </select>
            </td>
            <td>
                ${
                    isCustom
                        ? `<button class="btn btn-sm btn-danger" onclick="removePrzejscieRow('custom', ${row._idx})" style="font-size:0.65rem;padding:0.15rem 0.4rem;"><i data-lucide="x" style="width:12px;height:12px;"></i></button>`
                        : '<span style="color:var(--text-muted);font-size:0.65rem;">z oferty</span>'
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
    _customPrzejscieRows.push({
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
        _customPrzejscieRows.splice(idx, 1);
    } else {
        _offerPrzejscieRows.splice(idx, 1);
    }
    renderPrzejsciaDetailsTable();
}
window.removePrzejscieRow = removePrzejscieRow;

function _syncCustomRow(input) {
    const field = input.dataset.field;
    const source = input.dataset.source;
    const idx = parseInt(input.dataset.idx);
    const target = source === 'custom' ? _customPrzejscieRows : _offerPrzejscieRows;
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
        ..._offerPrzejscieRows.map((r) => ({ ...r, source: 'offer' })),
        ..._customPrzejscieRows.map((r) => ({ ...r, source: 'custom' }))
    ];
}

function handlePrzejsciaZamowioneChange(select) {
    const dataInput = document.getElementById('step4-data-zamowienia');
    if (select.value === 'Tak' && dataInput && !dataInput.value) {
        dataInput.value = new Date().toISOString().slice(0, 10);
    }
}
window.handlePrzejsciaZamowioneChange = handlePrzejsciaZamowioneChange;
