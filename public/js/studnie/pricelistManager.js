/* ===== LISTA CENOWA ===== */
function renderStudniePriceList() {
    // Zakładka PRECO ma własny renderer
    if (currentCennikTab === 'preco') {
        renderPrecoPriceList();
        return;
    }
    const container = document.getElementById('studnie-pricelist-body');
    const searchVal =
        document.getElementById('studnie-pricelist-search')?.value?.toLowerCase() || '';
    const tabFilter = CENNIK_TAB_FILTERS[currentCennikTab] || (() => true);

    const filteredProducts = studnieProducts.filter(
        (p) =>
            tabFilter(p) &&
            (!searchVal ||
                p.id.toLowerCase().includes(searchVal) ||
                p.name.toLowerCase().includes(searchVal))
    );

    const groups = {};
    const dynamicGroups = new Set();
    filteredProducts.forEach((p) => {
        let groupKey;
        if (currentCennikTab === 'dennicy' && p.dn) {
            groupKey = 'dn' + p.dn;
        } else if (currentCennikTab === 'przejscia') {
            groupKey = p.category || 'inne';
            dynamicGroups.add(groupKey);
        } else if (currentCennikTab === 'kinety') {
            groupKey = p.category || 'Kinety DN' + (p.dn || '');
            dynamicGroups.add(groupKey);
        } else {
            groupKey = p.componentType || 'inne';
        }
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(p);
    });

    const groupLabels = {
        dennica: '<i data-lucide="square"></i> Dennicy',
        osadnik: '<i data-lucide="layers"></i> Osadniki',
        konus: '<i data-lucide="diamond"></i> Konusy',
        krag: '<i data-lucide="square"></i> Kręgi',
        krag_ot: '<i data-lucide="square"></i> Kręgi z otworami (OT)',
        plyta_din: '<i data-lucide="triangle-right"></i> Płyty DIN',
        plyta_najazdowa: '<i data-lucide="square"></i> Płyty odciążające',
        plyta_zamykajaca: '<i data-lucide="square"></i> Płyta odciążająca',
        pierscien_odciazajacy: '<i data-lucide="circle"></i> Pierścienie odciążające',
        plyta_redukcyjna: '<i data-lucide="square"></i> Płyty redukcyjne',
        avr: '<i data-lucide="settings"></i> AVR / Pierścienie wyrównawcze',
        uszczelka: '<i data-lucide="circle-check"></i> Uszczelki',
        inne: '<i data-lucide="package"></i> Inne',
        przejscie: '<i data-lucide="link"></i> Nawiercenia / Przejścia',
        dn1000: '<i data-lucide="circle"></i> DN1000',
        dn1200: '<i data-lucide="circle"></i> DN1200',
        dn1500: '<i data-lucide="circle-x"></i> DN1500',
        dn2000: '<i data-lucide="circle"></i> DN2000',
        dn2500: '<i data-lucide="circle-x"></i> DN2500'
    };

    let groupOrder = [
        'dn1000',
        'dn1200',
        'dn1500',
        'dn2000',
        'dn2500',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'pierscien_odciazajacy',
        'konus',
        'krag',
        'krag_ot',
        'dennica',
        'plyta_redukcyjna',
        'avr',
        'uszczelka',
        'przejscie',
        'inne'
    ];

    const isPrzejscia = currentCennikTab === 'przejscia';
    const isKinety = currentCennikTab === 'kinety';

    if (isPrzejscia || isKinety) {
        groupOrder = Array.from(dynamicGroups).sort();
    } else {
        // Dodaj wszelkie niestandardowe grupy, których nie ma w zdefiniowanej kolejności
        const allGroupKeys = Object.keys(groups);
        allGroupKeys.forEach((k) => {
            if (!groupOrder.includes(k)) groupOrder.push(k);
        });
    }

    const pehdInput = document.getElementById('pehd-price-input');
    const currentPehdPrice = pehdInput ? parseFloat(pehdInput.value) || 270 : 270;

    let html = `<div class="table-wrap">
    <div style="padding:0.5rem; text-align:right; display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
        ${!isPrzejscia && !isKinety ? `<div style="display:flex; align-items:center; gap:0.3rem; margin-right:auto;"><label style="font-size: var(--fs-md); font-weight: var(--fw-semibold); color:var(--text-secondary);">Cena PEHD (PLN/m²):</label><input type="number" id="pehd-price-input" value="${currentPehdPrice}" style="width:70px; padding:0.3rem; font-size: var(--fs-md); border:1px solid var(--border); border-radius: var(--radius-2xs); background:var(--bg-input); color:var(--text-primary);"><button class="btn btn-secondary btn-sm" data-action="recalculatePEHD" style="padding:0.3rem 0.6rem; font-size: var(--fs-md); margin-left:0.3rem;">Przelicz</button></div>` : ''}
        ${isPrzejscia ? `<button class="btn btn-secondary" data-action="addPrzejsciaCategory" class="pill-sm"><i data-lucide="plus" aria-hidden="true"></i> Dodaj kategorię przejść</button>` : `<button class="btn btn-secondary" data-action="addStudnieCategory" class="pill-sm"><i data-lucide="plus" aria-hidden="true"></i> Dodaj kategorię</button>`}
        <button class="btn btn-secondary" data-action="addStudnieElement" class="pill-sm"><i data-lucide="plus" aria-hidden="true"></i> Dodaj element</button>
        ${isKinety ? `<button class="btn btn-secondary" disabled title="Generuje szablon 20 kinet (5 średnic × 4 wys.) z ceną domyślną 100 zł. Nie nadpisuje istniejących. Przycisk nieaktywny — kinety są dodawane automatycznie przy starcie. Użyj Resetu cennika by przywrócić domyślne." style="font-size: var(--fs-md); padding:0.4rem 0.8rem; opacity:0.5; cursor:not-allowed;"><i data-lucide="plug" aria-hidden="true"></i> Generuj puste Kinety</button>` : ''}
    </div>
    <table class="table-fixed">
      <th scope="col"ead>
        <tr>
          <th scope="col" class="w-10pct">Indeks</th>
          <th scope="col" style="width: ${isPrzejscia ? '18' : isKinety ? '12' : '15'}%;">${isPrzejscia ? 'Rodzaj przejścia' : isKinety ? 'Nazwa kinety' : 'Nazwa elementu'}</th>
          ${
              isPrzejscia
                  ? `
          <th scope="col" class="text-center ui-col-8">Średnica (DN)</th>
          <th scope="col" class="text-right" style="width: 7%;">Waga kg</th>
          <th scope="col" class="text-right ui-col-8">Zap. dół</th>
          <th scope="col" class="text-right ui-col-8">Zap. góra</th>
          <th scope="col" class="text-right ui-col-8">Zap. dół min</th>
          <th scope="col" class="text-right ui-col-8">Zap. góra min</th>
          <th scope="col" class="text-center" class="w-4pct" title="Czy przejście jest widoczne w konfiguratorze (1=Tak, 0=Nie)">Dost.</th>
          `
                  : isKinety
                    ? `
          <th scope="col" class="text-center" class="w-4pct">DN</th>
          <th scope="col" class="text-center ui-col-6">Wys.Sp.</th>
          <th scope="col" class="text-center ui-col-5">Pow. m²</th>
          <th scope="col" class="text-center" class="w-4pct">Hmin1 mm</th>
          <th scope="col" class="text-center" class="w-4pct">Hmax1 mm</th>
          <th scope="col" class="text-right ui-col-6">Cena1</th>
          <th scope="col" class="text-center ui-col-5">Hmin2 mm</th>
          <th scope="col" class="text-center ui-col-5">Hmax2 mm</th>
          <th scope="col" class="text-right ui-col-6">Cena2</th>
          <th scope="col" class="text-center ui-col-5">Hmin3 mm</th>
          <th scope="col" class="text-center ui-col-5">Hmax3 mm</th>
          <th scope="col" class="text-right ui-col-6">Cena3</th>
          `
                    : `
          <th scope="col" class="text-right ui-col-5" title="Wysokość [mm]">Wys.</th>
          <th scope="col" class="text-right ui-col-5" title="Waga [kg]">Waga</th>
          <th scope="col" class="text-right ui-col-5" title="Powierzchnia wewnętrzna [m2]">P.wew</th>
          <th scope="col" class="text-right ui-col-5" title="Powierzchnia zewnętrzna [m2]">P.zew</th>
          <th scope="col" class="text-right" class="w-4pct" title="Maksymalna ilość sztuk na naczepie 24t">Szt</th>
          <th scope="col" class="text-right ui-col-6" title="Dopłata do wkładki PEHD [PLN] — elementy płytowe (płyty, pierścienie) doliczane z kwadratowego wykroju (×4/π ≈ +27%)">PEHD <i data-lucide="info" style="width:10px;height:10px;opacity:0.5;cursor:help;" aria-hidden="true"></i></th>
          <th scope="col" class="text-right ui-col-5" title="Dopłata za malowanie wewnątrz [PLN]">Mal W.</th>
          <th scope="col" class="text-right ui-col-5" title="Dopłata za malowanie zewnątrz [PLN]">Mal Z.</th>
          <th scope="col" class="text-right ui-col-5" title="Dopłata dla dennicy za Żelbet [PLN]">Żelbet</th>
          <th scope="col" class="text-right ui-col-5" title="Dopłata za stopnie nierdzewne zamiast drabinki [PLN]">Dr.Ni.</th>
          <th scope="col" class="text-center" class="w-3pct" title="Dostępne na magazynie Włocławek (1=Tak, 0=Nie)">M.WL</th>
          <th scope="col" class="text-center" class="w-3pct" title="Dostępne na magazynie Kluczbork (1=Tak, 0=Nie)">M.KLB</th>
          <th scope="col" class="text-center" class="w-3pct" title="Forma Standardowa: Włocławek (1=Tak, 0=Nie)">FS.WL</th>
          <th scope="col" class="text-center" class="w-4pct" title="Forma Standardowa: Kluczbork (1=Tak, 0=Nie)">FS.KLB</th>
          `
          }
          <th scope="col" class="text-right ui-col-6">Cena PLN</th>
          <th scope="col" class="text-center ui-col-6">Akcje</th>
        </tr>
      </thead>`;

    let hasAnyItems = false;

    groupOrder.forEach((groupKey) => {
        let items = groups[groupKey];
        if (!items || items.length === 0) return;
        hasAnyItems = true;
        const label = groupLabels[groupKey] || groupKey;

        html += `<tbody>
      <tr>
        <td colspan="${isPrzejscia ? '11' : isKinety ? '16' : '18'}" style="padding:0; border-bottom:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.5rem; background:rgba(var(--accent-rgb), 0.05); font-size: var(--fs-lg);">
            <span style="font-weight: var(--fw-bold); color:var(--text-primary);">${label} <span style="opacity:.5">(${items.length})</span></span>
            <div style="display:flex;gap:0.3rem;">
              <button class="btn-icon" title="Dodaj element do tej kategorii" aria-label="Dodaj element" data-action="addStudnieElement" data-group="${escapeHtml(groupKey)}"
                class="fs-base-025"><i data-lucide="plus" aria-hidden="true"></i></button>
              <button class="btn-icon del" title="Usuń całą kategorię" aria-label="Usuń kategorię" data-action="deleteStudnieCategory" data-group="${escapeHtml(groupKey)}"
                class="fs-base-025"><i data-lucide="trash-2" aria-hidden="true"></i></button>
            </div>
          </div>
        </td>
      </tr>`;

        // Sortuj rosnąco według DN dla przejść
        if (isPrzejscia) {
            items = [...items].sort((a, b) => {
                const dnA = typeof a.dn === 'string' ? parseInt(a.dn) || 0 : a.dn || 0;
                const dnB = typeof b.dn === 'string' ? parseInt(b.dn) || 0 : b.dn || 0;
                return dnA - dnB;
            });
        }

        items.forEach((p) => {
            html += `<tr>
        <td data-action="editStudnieCell" data-field="id" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-size: var(--fs-base); color:var(--text-muted);">${p.id}</td>
        <td data-action="editStudnieCell" data-field="name" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-weight: var(--fw-medium);">${escapeHtml(p.name)}</td>`;

            if (isPrzejscia) {
                html += `
        <td class="text-center" class="fw600-accent-cursor" data-action="editStudnieCell" data-field="dn" data-id="${escapeHtml(p.id)}">${p.dn != null ? (typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="weight" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.weight != null ? fmtInt(p.weight) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="zapasDol" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.zapasDol != null ? fmtInt(p.zapasDol) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="zapasGora" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.zapasGora != null ? fmtInt(p.zapasGora) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="zapasDolMin" data-id="${escapeHtml(p.id)}" class="cursor-warn">${p.zapasDolMin != null ? fmtInt(p.zapasDolMin) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="zapasGoraMin" data-id="${escapeHtml(p.id)}" class="cursor-warn">${p.zapasGoraMin != null ? fmtInt(p.zapasGoraMin) : '—'}</td>
        <td class="text-center" data-action="toggleMagazynField" data-field="active" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-weight: var(--fw-bold); color:${p.active !== 0 ? 'var(--success-hover)' : 'var(--danger-hover)'};">${p.active !== 0 ? '1' : '0'}</td>
               `;
            } else if (isKinety) {
                html += `
        <td class="text-center" class="fw600-accent-cursor" data-action="editStudnieCell" data-field="dn" data-id="${escapeHtml(p.id)}">${p.dn != null ? (typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn) : '—'}</td>
        <td class="text-center" data-action="editStudnieCell" data-field="spocznikH" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.spocznikH || '—'}</td>
        <td class="text-center" data-action="editStudnieCell" data-field="area" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.area != null ? fmt(p.area) : '—'}</td>
        <td class="text-center" data-action="editStudnieCell" data-field="hMin1" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.hMin1 != null ? fmtInt(p.hMin1) : '—'}</td>
        <td class="text-center" data-action="editStudnieCell" data-field="hMax1" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.hMax1 != null ? fmtInt(p.hMax1) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="cena1" data-id="${escapeHtml(p.id)}" class="cursor-success">${p.cena1 != null ? fmtInt(p.cena1) : '—'}</td>
        <td class="text-center" data-action="editStudnieCell" data-field="hMin2" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.hMin2 != null ? fmtInt(p.hMin2) : '—'}</td>
        <td class="text-center" data-action="editStudnieCell" data-field="hMax2" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.hMax2 != null ? fmtInt(p.hMax2) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="cena2" data-id="${escapeHtml(p.id)}" class="cursor-success">${p.cena2 != null ? fmtInt(p.cena2) : '—'}</td>
        <td class="text-center" data-action="editStudnieCell" data-field="hMin3" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.hMin3 != null ? fmtInt(p.hMin3) : '—'}</td>
        <td class="text-center" data-action="editStudnieCell" data-field="hMax3" data-id="${escapeHtml(p.id)}" class="ui-pointer-bold">${p.hMax3 != null ? fmtInt(p.hMax3) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="cena3" data-id="${escapeHtml(p.id)}" class="cursor-success">${p.cena3 != null ? fmtInt(p.cena3) : '—'}</td>
                `;
            } else {
                html += `
        <td class="text-right" data-action="editStudnieCell" data-field="height" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-weight: var(--fw-semibold); color:var(--accent-hover);">${p.height != null ? fmtInt(p.height) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="weight" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.weight != null ? fmtInt(p.weight) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="area" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.area != null ? fmt(p.area) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="areaExt" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.areaExt != null ? fmt(p.areaExt) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="transport" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.transport != null ? fmtInt(p.transport) : '—'}</td>
        <td class="text-right" style="color:var(--success); cursor:help;" title="${p.area > 0 && p.componentType !== 'przejscie' && p.componentType !== 'kineta' && p.componentType !== 'konus' ? getPehdTooltip(p, currentPehdPrice) : ''}">${p.area > 0 && p.componentType !== 'przejscie' && p.componentType !== 'kineta' && p.componentType !== 'konus' ? '+' + fmtInt(Math.round(getPehdEffectiveArea(p) * currentPehdPrice)) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="malowanieWewnetrzne" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.malowanieWewnetrzne != null ? '+' + fmtInt(p.malowanieWewnetrzne) : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="malowanieZewnetrzne" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.malowanieZewnetrzne != null ? '+' + fmtInt(p.malowanieZewnetrzne) : '—'}</td>
        <td class="text-right" ${p.componentType === 'dennica' ? `data-action="editStudnieCell" data-field="doplataZelbet" data-id="${escapeHtml(p.id)}" class="cursor-pointer"` : `class="ui-text-mute"`}>${p.componentType === 'dennica' ? (p.doplataZelbet != null ? '+' + fmtInt(p.doplataZelbet) : '—') : '—'}</td>
        <td class="text-right" data-action="editStudnieCell" data-field="doplataDrabNierdzewna" data-id="${escapeHtml(p.id)}" class="cursor-pointer">${p.doplataDrabNierdzewna != null ? '+' + fmtInt(p.doplataDrabNierdzewna) : '—'}</td>
        <td class="text-center" data-action="toggleMagazynField" data-field="magazynWL" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-weight: var(--fw-bold); color:${p.magazynWL === 1 ? 'var(--success-hover)' : 'var(--danger-hover)'};">${p.magazynWL === 1 ? '1' : '0'}</td>
        <td class="text-center" data-action="toggleMagazynField" data-field="magazynKLB" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-weight: var(--fw-bold); color:${p.magazynKLB === 1 ? 'var(--success-hover)' : 'var(--danger-hover)'};">${p.magazynKLB === 1 ? '1' : '0'}</td>
        <td class="text-center" data-action="toggleMagazynField" data-field="formaStandardowa" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-weight: var(--fw-bold); color:${p.formaStandardowa === 1 ? 'var(--success-hover)' : 'var(--danger-hover)'};">${p.formaStandardowa === 1 ? '1' : '0'}</td>
        <td class="text-center" data-action="toggleMagazynField" data-field="formaStandardowaKLB" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-weight: var(--fw-bold); color:${p.formaStandardowaKLB === 1 ? 'var(--success-hover)' : 'var(--danger-hover)'};">${p.formaStandardowaKLB === 1 ? '1' : '0'}</td>
               `;
            }

            html += `
        <td class="text-right" data-action="editStudnieCell" data-field="price" data-id="${escapeHtml(p.id)}" style="cursor:pointer; font-weight: var(--fw-bold); color:var(--success);">${fmtInt(p.price)}</td>
        <td class="text-center" class="text-nowrap">
          <button class="btn-icon" title="Powiel" aria-label="Powiel" data-action="copyStudnieProduct" data-id="${escapeHtml(p.id)}"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
          <button class="btn-icon" title="Usuń" aria-label="Usuń" data-action="deleteStudnieProduct" data-id="${escapeHtml(p.id)}"><i data-lucide="x" aria-hidden="true"></i></button>
        </td>
      </tr>`;
        });

        html += `</tbody>`;
    });

    html += `</table></div>`;

    if (!hasAnyItems) {
        html = `<div style="padding:2rem;text-align:center;color:var(--text-muted);">Brak wyników w tej zakładce...</div>`;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

/* ===== Delegacja kliknięć (data-action) — TASK-036 ===== */
if (typeof document !== 'undefined' && !window.__pricelistDelegated) {
    window.__pricelistDelegated = true;
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action') || '';
        const field = el.getAttribute('data-field');
        const id = el.getAttribute('data-id');
        const group = el.getAttribute('data-group');
        if (action === 'editStudnieCell') {
            window.editStudnieCell(el, field, id);
        } else if (action === 'toggleMagazynField') {
            window.toggleMagazynField(el, field, id);
        } else if (action === 'addStudnieElement') {
            window.addStudnieElement(group);
        } else if (action === 'addStudnieCategory') {
            window.addStudnieCategory();
        } else if (action === 'addPrzejsciaCategory') {
            window.addPrzejsciaCategory();
        } else if (action === 'deleteStudnieCategory') {
            window.deleteStudnieCategory(group);
        } else if (action === 'copyStudnieProduct') {
            window.copyStudnieProduct(id);
        } else if (action === 'deleteStudnieProduct') {
            window.deleteStudnieProduct(id);
        } else if (action === 'recalculatePEHD') {
            window.recalculatePEHD();
        }
    });
}

/* ===== Rejestracja globali ===== */
window.renderStudniePriceList = renderStudniePriceList;
