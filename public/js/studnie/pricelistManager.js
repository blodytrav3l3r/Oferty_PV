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
        osadnik: '🪣 Osadniki',
        konus: '<i data-lucide="diamond"></i> Konusy',
        krag: '<i data-lucide="square"></i> Kręgi',
        krag_ot: '<i data-lucide="square"></i> Kręgi z otworami (OT)',
        plyta_din: '<i data-lucide="triangle-right"></i> Płyty DIN',
        plyta_najazdowa: '🪨 Płyty odciążające',
        plyta_zamykajaca: '🪨 Płyta odciążająca',
        pierscien_odciazajacy: '⭕ Pierścienie odciążające',
        plyta_redukcyjna: '⬛ Płyty redukcyjne',
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
        ${!isPrzejscia && !isKinety ? `<div style="display:flex; align-items:center; gap:0.3rem; margin-right:auto;"><label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">Cena PEHD (PLN/m²):</label><input type="number" id="pehd-price-input" value="${currentPehdPrice}" style="width:70px; padding:0.3rem; font-size:0.8rem; border:1px solid var(--border); border-radius:4px; background:var(--bg-input); color:var(--text-primary);"><button class="btn btn-secondary btn-sm" onclick="recalculatePEHD()" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-left:0.3rem;">Przelicz</button></div>` : ''}
        ${isPrzejscia ? `<button class="btn btn-secondary" onclick="addPrzejsciaCategory()" class="pill-sm"><i data-lucide="plus" aria-hidden="true"></i> Dodaj kategorię przejść</button>` : `<button class="btn btn-secondary" onclick="addStudnieCategory()" class="pill-sm"><i data-lucide="plus" aria-hidden="true"></i> Dodaj kategorię</button>`}
        <button class="btn btn-secondary" onclick="addStudnieElement()" class="pill-sm"><i data-lucide="plus" aria-hidden="true"></i> Dodaj element</button>
        ${isKinety ? `<button class="btn btn-secondary" disabled title="Generuje szablon 20 kinet (5 średnic × 4 wys.) z ceną domyślną 100 zł. Nie nadpisuje istniejących. Przycisk nieaktywny — kinety są dodawane automatycznie przy starcie. Użyj Resetu cennika by przywrócić domyślne." style="font-size:0.8rem; padding:0.4rem 0.8rem; opacity:0.5; cursor:not-allowed;"><i data-lucide="plug" aria-hidden="true"></i> Generuj puste Kinety</button>` : ''}
    </div>
    <table style="table-layout: fixed; width: 100%;">
      <thead>
        <tr>
          <th style="width: 10%;">Indeks</th>
          <th style="width: ${isPrzejscia ? '18' : isKinety ? '12' : '15'}%;">${isPrzejscia ? 'Rodzaj przejścia' : isKinety ? 'Nazwa kinety' : 'Nazwa elementu'}</th>
          ${
              isPrzejscia
                  ? `
          <th class="text-center ui-col-8">Średnica (DN)</th>
          <th class="text-right" style="width: 7%;">Waga kg</th>
          <th class="text-right ui-col-8">Zap. dół</th>
          <th class="text-right ui-col-8">Zap. góra</th>
          <th class="text-right ui-col-8">Zap. dół min</th>
          <th class="text-right ui-col-8">Zap. góra min</th>
          <th class="text-center" style="width: 4%;" title="Czy przejście jest widoczne w konfiguratorze (1=Tak, 0=Nie)">Dost.</th>
          `
                  : isKinety
                    ? `
          <th class="text-center" style="width: 4%;">DN</th>
          <th class="text-center ui-col-6">Wys.Sp.</th>
          <th class="text-center ui-col-5">Pow. m²</th>
          <th class="text-center" style="width: 4%;">Hmin1 mm</th>
          <th class="text-center" style="width: 4%;">Hmax1 mm</th>
          <th class="text-right ui-col-6">Cena1</th>
          <th class="text-center ui-col-5">Hmin2 mm</th>
          <th class="text-center ui-col-5">Hmax2 mm</th>
          <th class="text-right ui-col-6">Cena2</th>
          <th class="text-center ui-col-5">Hmin3 mm</th>
          <th class="text-center ui-col-5">Hmax3 mm</th>
          <th class="text-right ui-col-6">Cena3</th>
          `
                    : `
          <th class="text-right ui-col-5" title="Wysokość [mm]">Wys.</th>
          <th class="text-right ui-col-5" title="Waga [kg]">Waga</th>
          <th class="text-right ui-col-5" title="Powierzchnia wewnętrzna [m2]">P.wew</th>
          <th class="text-right ui-col-5" title="Powierzchnia zewnętrzna [m2]">P.zew</th>
          <th class="text-right" style="width: 4%;" title="Maksymalna ilość sztuk na naczepie 24t">Szt</th>
          <th class="text-right ui-col-6" title="Dopłata do wkładki PEHD [PLN] — elementy płytowe (płyty, pierścienie) doliczane z kwadratowego wykroju (×4/π ≈ +27%)">PEHD <i data-lucide="info" style="width:10px;height:10px;opacity:0.5;cursor:help;" aria-hidden="true"></i></th>
          <th class="text-right ui-col-5" title="Dopłata za malowanie wewnątrz [PLN]">Mal W.</th>
          <th class="text-right ui-col-5" title="Dopłata za malowanie zewnątrz [PLN]">Mal Z.</th>
          <th class="text-right ui-col-5" title="Dopłata dla dennicy za Żelbet [PLN]">Żelbet</th>
          <th class="text-right ui-col-5" title="Dopłata za stopnie nierdzewne zamiast drabinki [PLN]">Dr.Ni.</th>
          <th class="text-center" style="width: 3%;" title="Dostępne na magazynie Włocławek (1=Tak, 0=Nie)">M.WL</th>
          <th class="text-center" style="width: 3%;" title="Dostępne na magazynie Kluczbork (1=Tak, 0=Nie)">M.KLB</th>
          <th class="text-center" style="width: 3%;" title="Forma Standardowa: Włocławek (1=Tak, 0=Nie)">FS.WL</th>
          <th class="text-center" style="width: 4%;" title="Forma Standardowa: Kluczbork (1=Tak, 0=Nie)">FS.KLB</th>
          `
          }
          <th class="text-right ui-col-6">Cena PLN</th>
          <th class="text-center ui-col-6">Akcje</th>
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
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.5rem; background:rgba(99,102,241,0.06); font-size:0.85rem;">
            <span style="font-weight:700; color:var(--text-primary);">${label} <span style="opacity:.5">(${items.length})</span></span>
            <div style="display:flex;gap:0.3rem;">
              <button class="btn-icon" title="Dodaj element do tej kategorii" aria-label="Dodaj element" onclick="addStudnieElement('${groupKey.replace(/'/g, "\\'")}')"
                style="padding:0.2rem 0.5rem; font-size:0.75rem;"><i data-lucide="plus" aria-hidden="true"></i></button>
              <button class="btn-icon del" title="Usuń całą kategorię" aria-label="Usuń kategorię" onclick="deleteStudnieCategory('${groupKey.replace(/'/g, "\\'")}')"
                style="padding:0.2rem 0.5rem; font-size:0.75rem;"><i data-lucide="trash-2" aria-hidden="true"></i></button>
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
        <td onclick="editStudnieCell(this,'id','${p.id}')" style="cursor:pointer; font-size:0.78rem; color:var(--text-muted);">${p.id}</td>
        <td onclick="editStudnieCell(this,'name','${p.id}')" style="cursor:pointer; font-weight:500;">${p.name}</td>`;

            if (isPrzejscia) {
                html += `
        <td class="text-center" style="font-weight:600; color:#818cf8; cursor:pointer;" onclick="editStudnieCell(this,'dn','${p.id}')">${p.dn != null ? (typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'weight','${p.id}')" class="ui-pointer-bold">${p.weight != null ? fmtInt(p.weight) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'zapasDol','${p.id}')" style="cursor:pointer;">${p.zapasDol != null ? fmtInt(p.zapasDol) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'zapasGora','${p.id}')" style="cursor:pointer;">${p.zapasGora != null ? fmtInt(p.zapasGora) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'zapasDolMin','${p.id}')" style="cursor:pointer; color:#fbbf24;">${p.zapasDolMin != null ? fmtInt(p.zapasDolMin) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'zapasGoraMin','${p.id}')" style="cursor:pointer; color:#fbbf24;">${p.zapasGoraMin != null ? fmtInt(p.zapasGoraMin) : '—'}</td>
        <td class="text-center" onclick="toggleMagazynField(this,'active','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.active !== 0 ? '#34d399' : '#f87171'};">${p.active !== 0 ? '1' : '0'}</td>
               `;
            } else if (isKinety) {
                html += `
        <td class="text-center" style="font-weight:600; color:#818cf8; cursor:pointer;" onclick="editStudnieCell(this,'dn','${p.id}')">${p.dn != null ? (typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'spocznikH','${p.id}')" class="ui-pointer-bold">${p.spocznikH || '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'area','${p.id}')" class="ui-pointer-bold">${p.area != null ? fmt(p.area) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMin1','${p.id}')" class="ui-pointer-bold">${p.hMin1 != null ? fmtInt(p.hMin1) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMax1','${p.id}')" class="ui-pointer-bold">${p.hMax1 != null ? fmtInt(p.hMax1) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'cena1','${p.id}')" style="cursor:pointer; font-weight:600; color:var(--success);">${p.cena1 != null ? fmtInt(p.cena1) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMin2','${p.id}')" class="ui-pointer-bold">${p.hMin2 != null ? fmtInt(p.hMin2) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMax2','${p.id}')" class="ui-pointer-bold">${p.hMax2 != null ? fmtInt(p.hMax2) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'cena2','${p.id}')" style="cursor:pointer; font-weight:600; color:var(--success);">${p.cena2 != null ? fmtInt(p.cena2) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMin3','${p.id}')" class="ui-pointer-bold">${p.hMin3 != null ? fmtInt(p.hMin3) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMax3','${p.id}')" class="ui-pointer-bold">${p.hMax3 != null ? fmtInt(p.hMax3) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'cena3','${p.id}')" style="cursor:pointer; font-weight:600; color:var(--success);">${p.cena3 != null ? fmtInt(p.cena3) : '—'}</td>
                `;
            } else {
                html += `
        <td class="text-right" onclick="editStudnieCell(this,'height','${p.id}')" style="cursor:pointer; font-weight:600; color:#818cf8;">${p.height != null ? fmtInt(p.height) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'weight','${p.id}')" style="cursor:pointer;">${p.weight != null ? fmtInt(p.weight) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'area','${p.id}')" style="cursor:pointer;">${p.area != null ? fmt(p.area) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'areaExt','${p.id}')" style="cursor:pointer;">${p.areaExt != null ? fmt(p.areaExt) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'transport','${p.id}')" style="cursor:pointer;">${p.transport != null ? fmtInt(p.transport) : '—'}</td>
        <td class="text-right" style="color:var(--success); cursor:help;" title="${p.area > 0 && p.componentType !== 'przejscie' && p.componentType !== 'kineta' ? getPehdTooltip(p, currentPehdPrice) : ''}">${p.area > 0 && p.componentType !== 'przejscie' && p.componentType !== 'kineta' ? '+' + fmtInt(Math.round(getPehdEffectiveArea(p) * currentPehdPrice)) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'malowanieWewnetrzne','${p.id}')" style="cursor:pointer; color:var(--success);">${p.malowanieWewnetrzne != null ? '+' + fmtInt(p.malowanieWewnetrzne) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'malowanieZewnetrzne','${p.id}')" style="cursor:pointer; color:var(--success);">${p.malowanieZewnetrzne != null ? '+' + fmtInt(p.malowanieZewnetrzne) : '—'}</td>
        <td class="text-right" ${p.componentType === 'dennica' ? `onclick="editStudnieCell(this,'doplataZelbet','${p.id}')" style="cursor:pointer; color:var(--success);"` : `class="ui-text-mute"`}>${p.componentType === 'dennica' ? (p.doplataZelbet != null ? '+' + fmtInt(p.doplataZelbet) : '—') : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'doplataDrabNierdzewna','${p.id}')" style="cursor:pointer; color:var(--success);">${p.doplataDrabNierdzewna != null ? '+' + fmtInt(p.doplataDrabNierdzewna) : '—'}</td>
        <td class="text-center" onclick="toggleMagazynField(this,'magazynWL','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.magazynWL === 1 ? '#34d399' : '#f87171'};">${p.magazynWL === 1 ? '1' : '0'}</td>
        <td class="text-center" onclick="toggleMagazynField(this,'magazynKLB','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.magazynKLB === 1 ? '#34d399' : '#f87171'};">${p.magazynKLB === 1 ? '1' : '0'}</td>
        <td class="text-center" onclick="toggleMagazynField(this,'formaStandardowa','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.formaStandardowa === 1 ? '#34d399' : '#f87171'};">${p.formaStandardowa === 1 ? '1' : '0'}</td>
        <td class="text-center" onclick="toggleMagazynField(this,'formaStandardowaKLB','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.formaStandardowaKLB === 1 ? '#34d399' : '#f87171'};">${p.formaStandardowaKLB === 1 ? '1' : '0'}</td>
               `;
            }

            html += `
        <td class="text-right" onclick="editStudnieCell(this,'price','${p.id}')" style="cursor:pointer; font-weight:700; color:var(--success);">${fmtInt(p.price)}</td>
        <td class="text-center" style="white-space:nowrap;">
          <button class="btn-icon" title="Powiel" aria-label="Powiel" onclick="copyStudnieProduct('${p.id}')"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
          <button class="btn-icon" title="Usuń" aria-label="Usuń" onclick="deleteStudnieProduct('${p.id}')"><i data-lucide="x" aria-hidden="true"></i></button>
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
