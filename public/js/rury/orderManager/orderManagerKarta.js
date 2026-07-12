// @ts-check
/* ===== ZAMÓWIENIA RUR — KARTA BUDOWY + PRZEJŚCIA ===== */

function getKartaBudowyCopyOrders() {
    if (!pendingOrderCreationData || !pendingOrderCreationData.kartaBudowyTemplateOrders) return [];
    return pendingOrderCreationData.kartaBudowyTemplateOrders;
}

function renderKartaBudowyCopyOptions() {
    const select = document.getElementById('step4-copy-order-select');
    if (!select) return;

    const orders = getKartaBudowyCopyOrders();
    select.innerHTML = '<option value="">Wybierz kartę budowy do skopiowania</option>';

    if (orders.length === 0) {
        const help = document.getElementById('step4-copy-order-help');
        if (help) help.textContent = 'Brak wcześniejszych zamówień dla tej oferty.';
        return;
    }

    orders.forEach((order) => {
        const opt = document.createElement('option');
        opt.value = order.id;
        const offerNum = order.orderNumber || order.offerNumber || order.number || '—';
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('pl-PL') : '—';
        opt.textContent = `${offerNum} (${date})`;
        select.appendChild(opt);
    });
}

function copyKartaBudowyFromOrder() {
    const select = document.getElementById('step4-copy-order-select');
    if (!select || !select.value) {
        showToast('Wybierz zamówienie do skopiowania', 'error');
        return;
    }

    const sourceOrder = getKartaBudowyCopyOrders().find((o) => o.id === select.value);
    if (!sourceOrder || !sourceOrder.kartaBudowy) {
        showToast('Brak danych Karty Budowy w wybranym zamówieniu', 'error');
        return;
    }

    applyCopiedKartaBudowyData(sourceOrder.kartaBudowy);
    showToast('Skopiowano dane Karty Budowy', 'success');
}
window.copyKartaBudowyFromOrder = copyKartaBudowyFromOrder;

function applyCopiedKartaBudowyData(sourceData) {
    const map = {
        'step4-email-faktura': 'emailFaktura',
        'step4-email-efaktura': 'emailEfaktura',
        'step4-offer-nr-input': 'offerNumbers',
        'step4-adres-wysylki': 'adresWysylki',
        'step4-ilosc-dni': 'iloscDni',
        'step4-ubezpieczenie': 'ubezpieczenie',
        'step4-osoba-kontakt': 'osobaKontakt',
        'step4-wyliczony-transport': 'wyliczonyTransport',
        'step4-kaskada-uwagi': 'kaskadaUwagi',
        'step4-slepa-kineta-uwagi': 'slepaKinetaUwagi',
        'step4-data-zamowienia': 'dataZamowienia',
        'step4-pozostale-wlasciwosci': 'pozostaleWlasciwosci',
        'step4-uwagi-ogolne': 'uwagiOgolne'
    };

    for (const [elId, field] of Object.entries(map)) {
        const el = document.getElementById(elId);
        if (el && sourceData[field] !== undefined && sourceData[field] !== null) {
            el.value = sourceData[field];
        }
    }

    const selectMap = {
        'step4-warunki-platnosci': 'warunkiPlatnosci',
        'step4-zabezpieczenie-transportu': 'zabezpieczenieTransportu',
        'step4-rodzaj-transportu': 'rodzajTransportu',
        'step4-rodzaj-stopni': 'rodzajStopni',
        'step4-rodzaj-studni': 'rodzajStudni',
        'step4-uszczelka-studni': 'uszczelkaStudni',
        'step4-kineta': 'kineta',
        'step4-wysokosc-spocznika': 'wysokoscSpocznika',
        'step4-usytuowanie': 'usytuowanie',
        'step4-kaskada': 'kaskada',
        'step4-slepa-kineta': 'slepaKineta',
        'step4-redukcja-kinety': 'redukcjaKinety',
        'step4-przejscia-tulejowe': 'przejsciaTulejowe',
        'step4-przejscia-szczelne': 'przejsciaSzczelne',
        'step4-przejscia-zamowione': 'przejsciaZamowione',
        'step4-wlasciwosci-betonu': 'wlasciwosciBetonu'
    };

    for (const [elId, field] of Object.entries(selectMap)) {
        const el = document.getElementById(elId);
        if (el && sourceData[field] !== undefined && sourceData[field] !== null) {
            el.value = sourceData[field];
            const event = new Event('change', { bubbles: true });
            el.dispatchEvent(event);
        }
    }

    if (Array.isArray(sourceData.przejsciaDetails)) {
        _customPrzejscieRows = sourceData.przejsciaDetails.filter((p) => p.source === 'custom');
        _offerPrzejscieRows = sourceData.przejsciaDetails.filter((p) => p.source === 'offer');
        renderPrzejsciaDetailsTable();
    }
}

/* ===== PRZEJŚCIA SZCZELNE — TABELA ===== */

function renderPrzejsciaDetailsTable() {
    const container = document.getElementById('step4-przejscia-details-table');
    if (!container) return;

    const allRows = [
        ..._offerPrzejscieRows.map((r, i) => ({ ...r, source: 'offer', _idx: i })),
        ..._customPrzejscieRows.map((r, i) => ({ ...r, source: 'custom', _idx: i }))
    ];

    if (allRows.length === 0) {
        container.innerHTML =
            '<div style="font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem;">Brak przejść. Kliknij "Dodaj niestandardowe" aby dodać.</div>';
        return;
    }

    let html = `<table class="rury-table" class="text-xs">
        <thead>
            <tr>
                <th style="width:22%;">Rodzaj przejścia</th>
                <th style="width:12%;">DN OD</th>
                <th style="width:12%;">DN DO</th>
                <th style="width:12%;">Ilość</th>
                <th style="width:22%;">Uwagi</th>
                <th style="width:10%;">Czy przejście?</th>
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
                        ? `<input type="text" class="form-input" value="${row.rodzaj || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="rodzaj" data-source="${row.source}" data-idx="${row._idx}" data-action="syncCustomRow" />`
                        : `<span class="fw-600">${row.rodzaj || '—'}</span>`
                }
            </td>
            <td><input type="text" class="form-input" value="${row.dnOd || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="dnOd" data-source="${row.source}" data-idx="${row._idx}" data-action="syncCustomRow" /></td>
            <td><input type="text" class="form-input" value="${row.dnDo || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="dnDo" data-source="${row.source}" data-idx="${row._idx}" data-action="syncCustomRow" /></td>
            <td><input type="number" class="form-input" value="${row.ilosc || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="ilosc" data-source="${row.source}" data-idx="${row._idx}" data-action="syncCustomRow" /></td>
            <td><input type="text" class="form-input" value="${row.uwagi || ''}" style="width:100%;font-size:0.7rem;padding:0.2rem 0.4rem;" data-field="uwagi" data-source="${row.source}" data-idx="${row._idx}" data-action="syncCustomRow" /></td>
            <td>
                <select class="form-input" style="width:100%;font-size:0.7rem;padding:0.2rem;" data-field="czyPrzejscie" data-source="${row.source}" data-idx="${row._idx}" data-action="syncCustomRow">
                    <option value="TAK" ${row.czyPrzejscie === 'TAK' ? 'selected' : ''}>TAK</option>
                    <option value="NIE" ${row.czyPrzejscie === 'NIE' ? 'selected' : ''}>NIE</option>
                </select>
            </td>
            <td>
                ${
                    isCustom
                        ? `<button class="btn btn-sm btn-danger" data-action="removeCustomPrzejscieRow" data-idx="${row._idx}" style="font-size:0.65rem;padding:0.15rem 0.4rem;"><i data-lucide="x" style="width:12px;height:12px;"></i></button>`
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

function syncOrderTableIfNeeded() {
    if (typeof currentWizardStep === 'undefined' || currentWizardStep !== 5) return;
    if (typeof updateRuryOrderSummary !== 'function') return;
    const order =
        window.orderEditMode && typeof getCurrentRuryOrder === 'function'
            ? getCurrentRuryOrder()
            : null;
    updateRuryOrderSummary(order);
}
window.syncOrderTableIfNeeded = syncOrderTableIfNeeded;

if (typeof registerCspAction === 'function') {
    registerCspAction('syncCustomRow', function (t) {
        _syncCustomRow(t);
    });
    registerCspAction('navigateToPhase5', function () {
        goToPhase(5);
    });
    registerCspAction('removeCustomPrzejscieRow', {
        handler: function ({ idx }) {
            removePrzejscieRow('custom', parseInt(idx, 10));
        },
        params: ['idx']
    });
    registerCspAction('toggleOrderTransportBreakdown', window.toggleOrderTransportBreakdown);
}
