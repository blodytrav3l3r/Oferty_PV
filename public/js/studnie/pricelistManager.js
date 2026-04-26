/* ===== ZAKŁADKI CENNIKA ===== */
const CENNIK_TAB_FILTERS = {
    dn1000: (p) => p.category === 'Studnie DN1000',
    dn1200: (p) => p.category === 'Studnie DN1200',
    dn1500: (p) => p.category === 'Studnie DN1500',
    dn2000: (p) => p.category === 'Studnie DN2000',
    dn2500: (p) => p.category === 'Studnie DN2500',
    styczne: (p) => p.category === 'Studnie styczne',
    dennicy: (p) => p.componentType === 'dennica',
    akcesoria: (p) => p.category === 'Akcesoria studni' || p.category === 'Uszczelki studni',
    przejscia: (p) => p.componentType === 'przejscie',
    kinety: (p) => p.componentType === 'kineta' || (p.category && p.category.startsWith('Kinety'))
};

function selectCennikTab(tab) {
    currentCennikTab = tab;
    document.querySelectorAll('.cennik-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderStudniePriceList();
}

/* ===== LISTA CENOWA ===== */
function renderStudniePriceList() {
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

    let html = `<div class="table-wrap">
    <div style="padding:0.5rem; text-align:right; display:flex; gap:0.5rem; justify-content:flex-end;">
        ${isPrzejscia ? `<button class="btn btn-secondary" onclick="addPrzejsciaCategory()" style="font-size:0.8rem; padding:0.4rem 0.8rem;"><i data-lucide="plus"></i> Dodaj kategorię przejść</button>` : `<button class="btn btn-secondary" onclick="addStudnieCategory()" style="font-size:0.8rem; padding:0.4rem 0.8rem;"><i data-lucide="plus"></i> Dodaj kategorię</button>`}
        <button class="btn btn-secondary" onclick="addStudnieElement()" style="font-size:0.8rem; padding:0.4rem 0.8rem;"><i data-lucide="plus"></i> Dodaj element</button>
        ${isKinety ? `<button class="btn btn-secondary" onclick="generateDefaultKinety()" style="font-size:0.8rem; padding:0.4rem 0.8rem;"><i data-lucide="plug"></i> Generuj puste Kinety</button>` : ''}
    </div>
    <table style="table-layout: fixed; width: 100%;">
      <thead>
        <tr>
          <th style="width: 10%;">Indeks</th>
          <th style="width: ${isPrzejscia ? '18' : isKinety ? '12' : '15'}%;">${isPrzejscia ? 'Rodzaj przejścia' : isKinety ? 'Nazwa kinety' : 'Nazwa elementu'}</th>
          ${
              isPrzejscia
                  ? `
          <th class="text-center" class="ui-col-8">Średnica (DN)</th>
          <th class="text-right" style="width: 7%;">Waga kg</th>
          <th class="text-right" class="ui-col-8">Zap. dół</th>
          <th class="text-right" class="ui-col-8">Zap. góra</th>
          <th class="text-right" class="ui-col-8">Zap. dół min</th>
          <th class="text-right" class="ui-col-8">Zap. góra min</th>
          <th class="text-center" style="width: 4%;" title="Czy przejście jest widoczne w konfiguratorze (1=Tak, 0=Nie)">Dost.</th>
          `
                  : isKinety
                    ? `
          <th class="text-center" style="width: 4%;">DN</th>
          <th class="text-center" class="ui-col-6">Wys.Sp.</th>
          <th class="text-center" class="ui-col-5">Pow. m²</th>
          <th class="text-center" style="width: 4%;">Hmin1 mm</th>
          <th class="text-center" style="width: 4%;">Hmax1 mm</th>
          <th class="text-right" class="ui-col-6">Cena1</th>
          <th class="text-center" class="ui-col-5">Hmin2 mm</th>
          <th class="text-center" class="ui-col-5">Hmax2 mm</th>
          <th class="text-right" class="ui-col-6">Cena2</th>
          <th class="text-center" class="ui-col-5">Hmin3 mm</th>
          <th class="text-center" class="ui-col-5">Hmax3 mm</th>
          <th class="text-right" class="ui-col-6">Cena3</th>
          `
                    : `
          <th class="text-right" class="ui-col-5" title="Wysokość [mm]">Wys.</th>
          <th class="text-right" class="ui-col-5" title="Waga [kg]">Waga</th>
          <th class="text-right" class="ui-col-5" title="Powierzchnia wewnętrzna [m2]">P.wew</th>
          <th class="text-right" class="ui-col-5" title="Powierzchnia zewnętrzna [m2]">P.zew</th>
          <th class="text-right" style="width: 4%;" title="Maksymalna ilość sztuk na naczepie 24t">Szt</th>
          <th class="text-right" class="ui-col-6" title="Dopłata do wkładki PEHD [PLN]">PEHD</th>
          <th class="text-right" class="ui-col-5" title="Dopłata za malowanie wewnątrz [PLN]">Mal W.</th>
          <th class="text-right" class="ui-col-5" title="Dopłata za malowanie zewnątrz [PLN]">Mal Z.</th>
          <th class="text-right" class="ui-col-5" title="Dopłata dla dennicy za Żelbet [PLN]">Żelbet</th>
          <th class="text-right" class="ui-col-5" title="Dopłata za stopnie nierdzewne zamiast drabinki [PLN]">Dr.Ni.</th>
          <th class="text-center" style="width: 3%;" title="Dostępne na magazynie Włocławek (1=Tak, 0=Nie)">M.WL</th>
          <th class="text-center" style="width: 3%;" title="Dostępne na magazynie Kluczbork (1=Tak, 0=Nie)">M.KLB</th>
          <th class="text-center" style="width: 3%;" title="Forma Standardowa: Włocławek (1=Tak, 0=Nie)">FS.WL</th>
          <th class="text-center" style="width: 4%;" title="Forma Standardowa: Kluczbork (1=Tak, 0=Nie)">FS.KLB</th>
          `
          }
          <th class="text-right" class="ui-col-6">Cena PLN</th>
          <th class="text-center" class="ui-col-6">Akcje</th>
        </tr>
      </thead>`;

    let hasAnyItems = false;

    groupOrder.forEach((groupKey) => {
        const items = groups[groupKey];
        if (!items || items.length === 0) return;
        hasAnyItems = true;
        const label = groupLabels[groupKey] || groupKey;

        html += `<tbody>
      <tr>
        <td colspan="${isPrzejscia ? '11' : isKinety ? '16' : '18'}" style="padding:0; border-bottom:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.5rem; background:rgba(99,102,241,0.06); font-size:0.85rem;">
            <span style="font-weight:700; color:var(--text-primary);">${label} <span style="opacity:.5">(${items.length})</span></span>
            <div style="display:flex;gap:0.3rem;">
              <button class="btn-icon" title="Dodaj element do tej kategorii" onclick="addStudnieElement('${groupKey.replace(/'/g, "\\'")}')"
                style="padding:0.2rem 0.5rem; font-size:0.75rem;"><i data-lucide="plus"></i></button>
              <button class="btn-icon del" title="Usuń całą kategorię" onclick="deleteStudnieCategory('${groupKey.replace(/'/g, "\\'")}')"
                style="padding:0.2rem 0.5rem; font-size:0.75rem;"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </td>
      </tr>`;

        // Sortuj rosnąco według DN dla przejść
        if (isPrzejscia) {
            items.sort((a, b) => {
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
        <td class="text-right" onclick="editStudnieCell(this,'doplataPEHD','${p.id}')" style="cursor:pointer; color:var(--success);">${p.doplataPEHD != null ? '+' + fmtInt(p.doplataPEHD) : '—'}</td>
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
          <button class="btn-icon" title="Powiel" onclick="copyStudnieProduct('${p.id}')"><i data-lucide="clipboard-list"></i></button>
          <button class="btn-icon" title="Usuń" onclick="deleteStudnieProduct('${p.id}')"><i data-lucide="x"></i></button>
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

/* ===== ZARZĄDZANIE KATEGORIAMI KINET ===== */
async function generateDefaultKinety(auto = false) {
    if (
        !auto &&
        !(await appConfirm(
            'Wygenerować szablon cennika kinet dla wszystkich średnic? (nie nadpisze to istniejących ze zgodnym id)',
            { title: 'Generowanie kinet', type: 'info' }
        ))
    )
        return;

    const dns = [1000, 1200, 1500, 2000, 2500];
    const heights = ['1/2', '2/3', '3/4', '1/1'];
    let added = 0;

    dns.forEach((dn) => {
        heights.forEach((h) => {
            const hId = h.replace('/', '');
            const id = `KINETA-DN${dn}-${hId}`;

            if (!studnieProducts.find((p) => p.id === id)) {
                studnieProducts.push({
                    id: id,
                    name: `Kineta DN${dn} wys. ${h}`,
                    category: `Kinety DN${dn}`,
                    componentType: 'kineta',
                    dn: dn,
                    spocznikH: h,
                    area: 0,
                    hMin1: null,
                    hMax1: null,
                    cena1: 100,
                    hMin2: null,
                    hMax2: null,
                    cena2: 100,
                    hMin3: null,
                    hMax3: null,
                    cena3: 100,
                    price: 100
                });
                added++;
            }
        });
    });

    if (added > 0) {
        saveStudnieProducts(studnieProducts);
        renderStudniePriceList();
        if (!auto) showToast(`Dodano ${added} elementów kinet do uzupełnienia.`, 'success');
    } else {
        if (!auto) showToast('Wszystkie kinety już istnieją.', 'info');
    }
}

/* ===== ZARZĄDZANIE KATEGORIAMI PRZEJŚĆ ===== */
function addPrzejsciaCategory() {
    let name = prompt('Podaj nazwę nowej kategorii (np. GRP, Incor):');
    if (!name) return;
    name = name.trim();
    if (!name) return;

    const catName = name.startsWith('W + ') ? name : `W + ${name}`;

    if (studnieProducts.some((p) => p.componentType === 'przejscie' && p.category === catName)) {
        showToast('Taka kategoria już istnieje', 'error');
        return;
    }

    const defaultSizes = [110, 160, 200, 250, 315, 400];
    defaultSizes.forEach((dn) => {
        studnieProducts.push({
            id: `${catName.replace(/ /g, '-')}-${dn}`,
            name: `${catName}`,
            category: catName,
            dn: dn,
            componentType: 'przejscie',
            zapasDol: 300,
            zapasGora: 300,
            zapasDolMin: 150,
            zapasGoraMin: 150,
            price: 0,
            weight: -1 * Math.round(dn / 15),
            area: null,
            areaExt: null,
            transport: null
        });
    });

    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast(`Utworzono kategorię ${catName}`, 'success');
}

function deletePrzejsciaCategory(cat) {
    deleteStudnieCategory(cat);
}

/* ===== GENERYCZNE ZARZĄDZANIE KATEGORIAMI / ELEMENTAMI ===== */

// Mapuj zakładkę -> { kategoria, dn, domyślne componentType }
function _tabDefaults() {
    const tab = currentCennikTab;
    const dnMap = { dn1000: 1000, dn1200: 1200, dn1500: 1500, dn2000: 2000, dn2500: 2500 };
    const catMap = {
        dn1000: 'Studnie DN1000',
        dn1200: 'Studnie DN1200',
        dn1500: 'Studnie DN1500',
        dn2000: 'Studnie DN2000',
        dn2500: 'Studnie DN2500',
        akcesoria: 'Akcesoria studni'
    };

    return {
        category: catMap[tab] || null,
        dn: dnMap[tab] || null,
        isPrzejscia: tab === 'przejscia',
        isDennicy: tab === 'dennicy',
        tab
    };
}

function addStudnieCategory() {
    const defaults = _tabDefaults();

    if (defaults.isPrzejscia) {
        addPrzejsciaCategory();
        return;
    }

    const name = prompt('Podaj nazwę nowej kategorii elementów:');
    if (!name || !name.trim()) return;

    const catName = name.trim();
    // Sprawdź, czy jakiekolwiek produkty mają to już jako componentType
    const existingKey = catName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    // Utwórz jeden element zastępczy w tej kategorii
    const newProduct = {
        id: existingKey + '_1',
        name: catName,
        category: defaults.category || catName,
        dn: defaults.dn || null,
        componentType: existingKey,
        height: null,
        price: 0,
        weight: 0,
        area: null,
        areaExt: null,
        transport: null,
        magazynWL: 0,
        magazynKLB: 0,
        doplataDrabNierdzewna: null,
        formaStandardowa: 1,
        formaStandardowaKLB: 1
    };

    studnieProducts.push(newProduct);
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast(`Utworzono kategorię "${catName}" z 1 elementem`, 'success');
}

function addStudnieElement(groupKey) {
    const defaults = _tabDefaults();

    // Jeśli podano groupKey, znajdź przykładowy produkt w tej grupie, aby skopiować domyślne wartości
    let template = null;
    if (groupKey) {
        if (defaults.isPrzejscia) {
            template = studnieProducts.find(
                (p) => p.componentType === 'przejscie' && p.category === groupKey
            );
        } else if (defaults.isDennicy) {
            template = studnieProducts.find(
                (p) => p.componentType === 'dennica' && 'dn' + p.dn === groupKey
            );
        } else {
            template = studnieProducts.find(
                (p) => p.componentType === groupKey && CENNIK_TAB_FILTERS[defaults.tab]?.(p)
            );
            if (!template) {
                template = studnieProducts.find((p) => p.componentType === groupKey);
            }
        }
    }

    // Wycofanie: znajdź dowolny produkt w bieżącej zakładce
    if (!template) {
        const tabFilter = CENNIK_TAB_FILTERS[defaults.tab];
        if (tabFilter) {
            template = studnieProducts.find(tabFilter);
        }
    }

    const id = prompt('Podaj indeks nowego elementu:', template ? '' : '');
    if (!id || !id.trim()) return;

    const name = prompt('Podaj nazwę nowego elementu:', '');
    if (!name) return;

    const newProduct = {
        id: id.trim(),
        name: name.trim(),
        category: template?.category || defaults.category || '',
        dn: template?.dn || defaults.dn || null,
        componentType: template?.componentType || groupKey || 'inne',
        height: null,
        price: 0,
        weight: 0,
        area: null,
        areaExt: null,
        transport: null,
        magazynWL: 0,
        magazynKLB: 0,
        doplataDrabNierdzewna: null,
        formaStandardowa: 1,
        formaStandardowaKLB: 1
    };

    if (defaults.isPrzejscia || template?.componentType === 'przejscie') {
        newProduct.componentType = 'przejscie';
        newProduct.zapasDol = template?.zapasDol || 300;
        newProduct.zapasGora = template?.zapasGora || 300;
        newProduct.zapasDolMin = template?.zapasDolMin || 150;
        newProduct.zapasGoraMin = template?.zapasGoraMin || 150;
        const dnStr = prompt('Średnica DN:', template?.dn?.toString() || '200');
        if (dnStr) newProduct.dn = isNaN(Number(dnStr)) ? dnStr : Number(dnStr);
    }

    studnieProducts.push(newProduct);
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast(`Dodano element "${name.trim()}"`, 'success');
}

async function deleteStudnieCategory(groupKey) {
    const defaults = _tabDefaults();
    const label = groupKey;

    if (
        !(await appConfirm(
            `Czy na pewno chcesz usunąć całą kategorię: ${label} oraz wszystkie jej elementy z cennika?`,
            { title: 'Usuwanie kategorii', type: 'danger' }
        ))
    )
        return;

    if (defaults.isPrzejscia) {
        studnieProducts = studnieProducts.filter(
            (p) => !(p.componentType === 'przejscie' && p.category === groupKey)
        );
    } else if (defaults.isDennicy) {
        const dn = parseInt(groupKey.replace('dn', ''), 10);
        studnieProducts = studnieProducts.filter(
            (p) => !(p.componentType === 'dennica' && p.dn === dn)
        );
    } else {
        // Usuń według componentType w obrębie bieżącego filtra zakładki
        const tabFilter = CENNIK_TAB_FILTERS[defaults.tab];
        studnieProducts = studnieProducts.filter((p) => {
            if (!tabFilter || !tabFilter(p)) return true; // keep items not in this tab
            return p.componentType !== groupKey;
        });
    }

    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast(`Usunięto kategorię ${label}`, 'info');
}

/* ===== PRZEŁĄCZANIE POLA MAGAZYNU ===== */
function toggleMagazynField(el, field, id) {
    const product = studnieProducts.find((p) => p.id === id);
    if (!product) return;
    product[field] = product[field] === 1 ? 0 : 1;

    // Natychmiastowa aktualizacja UI bez pełnego re-renderu
    const newVal = product[field];
    el.textContent = newVal;
    el.style.color = newVal === 1 ? '#34d399' : '#f87171';

    saveStudnieProducts(studnieProducts);
    // Usuwamy renderStudniePriceList() tutaj, aby uniknąć mignięcia tabeli
}

/* ===== EDYCJA W MIEJSCU ===== */
function editStudnieCell(el, field, id) {
    if (el.querySelector('input')) return;
    const product = studnieProducts.find((p) => p.id === id);
    const oldVal = product[field] ?? '';
    const input = document.createElement('input');
    const isTextField = ['name', 'id', 'dn', 'spocznikH', 'category'].includes(field);
    input.type = isTextField ? 'text' : 'number';
    if (input.type === 'number') input.step = 'any';
    input.className = 'edit-input';
    input.value = oldVal;
    input.style.width = field === 'name' ? '100%' : field === 'id' ? '120px' : '80px';
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    let isSaving = false;
    const save = () => {
        if (isSaving) return;
        isSaving = true;
        let val = input.value.trim();
        if (!isTextField) {
            val = val === '' ? null : Number(val);
        } else if (field === 'dn' && val !== '' && !val.includes('/')) {
            const numDn = Number(val);
            if (!isNaN(numDn)) val = numDn;
        }

        if (field === 'id') {
            if (!val) {
                showToast('Indeks nie może być pusty', 'error');
                renderStudniePriceList();
                return;
            }
            if (val !== id && studnieProducts.some((p) => p.id === val)) {
                showToast('Taki indeks już istnieje', 'error');
                renderStudniePriceList();
                return;
            }
        }

        product[field] = val;
        saveStudnieProducts(studnieProducts);
        renderStudniePriceList();
        showToast('Zaktualizowano cennik studni', 'success');
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') renderStudniePriceList();
    });
}

/* ===== CRUD PRODUKTÓW ===== */
async function deleteStudnieProduct(id) {
    if (
        !(await appConfirm('Usunąć ten element z cennika?', {
            title: 'Usuwanie elementu',
            type: 'danger'
        }))
    )
        return;
    studnieProducts = studnieProducts.filter((p) => p.id !== id);
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast('Element usunięty', 'info');
}

function copyStudnieProduct(id) {
    const original = studnieProducts.find((p) => p.id === id);
    if (!original) return;
    let finalId = original.id + '-KOP';
    let counter = 1;
    while (studnieProducts.some((p) => p.id === finalId)) {
        finalId = `${original.id}-KOP${counter}`;
        counter++;
    }
    const copied = JSON.parse(JSON.stringify(original));
    copied.id = finalId;
    copied.name = copied.name + ' (Kopia)';
    const index = studnieProducts.findIndex((p) => p.id === id);
    studnieProducts.splice(index + 1, 0, copied);
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast('Element skopiowany', 'success');
}

function showAddStudnieProductModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'add-product-modal';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3><i data-lucide="plus"></i> Dodaj element</h3><button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button></div>
      <div class="form-group"><label class="form-label">Kategoria</label>
        <select class="form-select" id="np-category" onchange="togglePrzejsciaFields()">${CATEGORIES_STUDNIE.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
        <input type="text" class="form-input" id="np-custom-category" placeholder="Nazwa nowej kategorii (np. W + PVC)" style="display:none; margin-top:0.5rem;" list="przejscia-cats-list">
        <datalist id="przejscia-cats-list">
            ${[
                ...new Set(
                    studnieProducts
                        .filter((p) => p.componentType === 'przejscie' && p.active !== 0)
                        .map((p) => p.category)
                )
            ]
                .filter(Boolean)
                .map((c) => `<option value="${c}">`)
                .join('')}
        </datalist>
      </div>
      <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
        <div class="form-group"><label class="form-label">Indeks</label><input class="form-input" id="np-id" placeholder="Indeks"></div>
        <div class="form-group"><label class="form-label">Nazwa</label><input class="form-input" id="np-name" placeholder="Nazwa"></div>
      </div>
      <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.8rem;">
        <div class="form-group"><label class="form-label">Cena PLN</label><input class="form-input" id="np-price" type="number"></div>
        <div class="form-group non-przejscia"><label class="form-label">Wysokość mm</label><input class="form-input" id="np-height" type="number"></div>
        <div class="form-group"><label class="form-label">Waga kg</label><input class="form-input" id="np-weight" type="number"></div>
      </div>
      <div class="form-row non-przejscia" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.8rem;">
        <div class="form-group"><label class="form-label">Pow. wewn. m²</label><input class="form-input" id="np-area" type="number" step="0.01"></div>
        <div class="form-group"><label class="form-label">Pow. zewn. m²</label><input class="form-input" id="np-areaExt" type="number" step="0.01"></div>
        <div class="form-group"><label class="form-label">Ilość/transp.</label><input class="form-input" id="np-transport" type="number"></div>
      </div>
      <div class="form-row non-przejscia" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:0.8rem;margin-top:0.8rem;">
        <div class="form-group"><label class="form-label">Dopłata PEHD PLN</label><input class="form-input" id="np-pehd" type="number"></div>
        <div class="form-group"><label class="form-label">Malow. wewn. PLN</label><input class="form-input" id="np-malW" type="number"></div>
        <div class="form-group"><label class="form-label">Malow. zewn. PLN</label><input class="form-input" id="np-malZ" type="number"></div>
        <div class="form-group"><label class="form-label">Dopłata Żelbet PLN</label><input class="form-input" id="np-zelbet" type="number" placeholder="Tylko dennice"></div>
        <div class="form-group"><label class="form-label">Drab. Nierdzewna PLN</label><input class="form-input" id="np-drabNierdzewna" type="number"></div>
      </div>
      <div class="form-row przejscia-only" style="display:none;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.8rem;margin-top:0.8rem;">
        <div class="form-group"><label class="form-label">Zapas dół mm</label><input class="form-input" id="np-zapasDol" type="number" value="300"></div>
        <div class="form-group"><label class="form-label">Zapas góra mm</label><input class="form-input" id="np-zapasGora" type="number" value="300"></div>
        <div class="form-group"><label class="form-label">Zapas dół min mm</label><input class="form-input" id="np-zapasDolMin" type="number" value="150"></div>
        <div class="form-group"><label class="form-label">Zapas góra min mm</label><input class="form-input" id="np-zapasGoraMin" type="number" value="150"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Anuluj</button>
        <button class="btn btn-primary" onclick="addStudnieProduct()">Dodaj element</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    window.togglePrzejsciaFields = () => {
        const cat = document.getElementById('np-category').value;
        const isPrzejscia = cat === 'Przejścia';
        const customCatEl = document.getElementById('np-custom-category');
        if (customCatEl) customCatEl.style.display = isPrzejscia ? 'block' : 'none';
        document
            .querySelectorAll('.non-przejscia')
            .forEach((el) => (el.style.display = isPrzejscia ? 'none' : ''));
        document
            .querySelectorAll('.przejscia-only')
            .forEach((el) => (el.style.display = isPrzejscia ? 'grid' : 'none'));
    };
    setTimeout(() => window.togglePrzejsciaFields(), 10);
}

function addStudnieProduct() {
    const id = document.getElementById('np-id').value.trim();
    const name = document.getElementById('np-name').value.trim();
    const price = parseFloat(document.getElementById('np-price').value);
    const height = document.getElementById('np-height').value
        ? parseInt(document.getElementById('np-height').value)
        : 0;
    const area = document.getElementById('np-area').value
        ? parseFloat(document.getElementById('np-area').value)
        : null;
    const areaExt = document.getElementById('np-areaExt').value
        ? parseFloat(document.getElementById('np-areaExt').value)
        : null;
    const transport = document.getElementById('np-transport').value
        ? parseInt(document.getElementById('np-transport').value)
        : null;
    const weight = document.getElementById('np-weight').value
        ? parseInt(document.getElementById('np-weight').value)
        : null;
    let category = document.getElementById('np-category').value;
    const isPrzejscia = category === 'Przejścia';

    if (isPrzejscia) {
        const customCat = document.getElementById('np-custom-category')?.value.trim();
        if (!customCat) {
            showToast('Wpisz nazwę kategorii przejścia', 'error');
            return;
        }
        category = customCat;
    }
    const zapasDol = document.getElementById('np-zapasDol')?.value
        ? parseInt(document.getElementById('np-zapasDol').value)
        : null;
    const zapasGora = document.getElementById('np-zapasGora')?.value
        ? parseInt(document.getElementById('np-zapasGora').value)
        : null;
    const zapasDolMin = document.getElementById('np-zapasDolMin')?.value
        ? parseInt(document.getElementById('np-zapasDolMin').value)
        : null;
    const zapasGoraMin = document.getElementById('np-zapasGoraMin')?.value
        ? parseInt(document.getElementById('np-zapasGoraMin').value)
        : null;
    const pehd = document.getElementById('np-pehd').value
        ? parseFloat(document.getElementById('np-pehd').value)
        : null;
    const malW = document.getElementById('np-malW').value
        ? parseFloat(document.getElementById('np-malW').value)
        : null;
    const malZ = document.getElementById('np-malZ').value
        ? parseFloat(document.getElementById('np-malZ').value)
        : null;
    const zelbet = document.getElementById('np-zelbet').value
        ? parseFloat(document.getElementById('np-zelbet').value)
        : null;
    const drabNierdzewna = document.getElementById('np-drabNierdzewna')?.value
        ? parseFloat(document.getElementById('np-drabNierdzewna').value)
        : null;

    if (!id || !name || isNaN(price)) {
        showToast('Wypełnij wymagane pola (indeks, nazwa, cena)', 'error');
        return;
    }
    if (studnieProducts.some((p) => p.id === id)) {
        showToast('Element o takim indeksie już istnieje', 'error');
        return;
    }

    const newProduct = {
        id,
        name,
        price,
        height: isPrzejscia ? null : height,
        area: isPrzejscia ? null : area,
        areaExt: isPrzejscia ? null : areaExt,
        transport: isPrzejscia ? null : transport,
        weight: weight,
        category,
        dn: null,
        componentType: isPrzejscia ? 'przejscie' : 'krag',
        magazynKLB: 1,
        magazynWL: 1,
        active: 1
    };

    if (isPrzejscia) {
        newProduct.zapasDol = zapasDol;
        newProduct.zapasGora = zapasGora;
        newProduct.zapasDolMin = zapasDolMin;
        newProduct.zapasGoraMin = zapasGoraMin;
    } else {
        newProduct.doplataPEHD = pehd;
        newProduct.malowanieWewnetrzne = malW;
        newProduct.malowanieZewnetrzne = malZ;
        newProduct.doplataZelbet = zelbet;
        newProduct.doplataDrabNierdzewna = drabNierdzewna;

        // Inteligentne wykrywanie typu i DN
        const n = name.toUpperCase();
        if (n.includes('REDUKCYJNA')) newProduct.componentType = 'plyta_redukcyjna';
        else if (n.includes('DENNICA')) newProduct.componentType = 'dennica';
        else if (n.includes('KONUS') || n.includes('STOŻEK')) newProduct.componentType = 'konus';
        else if (n.includes('PŁYTA DIN') || n.includes('NAKR')) newProduct.componentType = 'plyta_din';
        else if (n.includes('NAJAZDOWA')) newProduct.componentType = 'plyta_najazdowa';
        else if (n.includes('ZAMYKAJĄCA')) newProduct.componentType = 'plyta_zamykajaca';
        else if (n.includes('ODCIĄŻAJĄCY')) newProduct.componentType = 'pierscien_odciazajacy';
        else if (n.includes('USZCZELKA')) newProduct.componentType = 'uszczelka';
        else if (n.includes('WŁAZ')) newProduct.componentType = 'wlaz';
        else if (n.includes('AVR')) newProduct.componentType = 'avr';

        const dnMatch = (category + ' ' + name).match(/DN(\d+)/i);
        if (dnMatch) newProduct.dn = parseInt(dnMatch[1]);
        else if (n.includes('STYCZNA')) newProduct.dn = 'styczna';
    }

    studnieProducts.push(newProduct);
    saveStudnieProducts(studnieProducts);
    closeModal();
    renderStudniePriceList();
    showToast('Dodano nowy element', 'success');
}

/* closeModal — przeniesione do shared/ui.js */

/* ===== RESET / ZAPIS DOMYŚLNYCH ===== */
async function resetStudniePriceList() {
    try {
        const res = await fetch('/api/products-studnie/default');
        const json = await res.json();
        const customDefault = json.data;
        if (customDefault && customDefault.length > 0) {
            if (
                !(await appConfirm('Przywrócić cennik studni do zapisanego cennika domyślnego?', {
                    title: 'Reset cennika',
                    type: 'warning'
                }))
            )
                return;
            studnieProducts = JSON.parse(JSON.stringify(customDefault));
        } else {
            if (
                !(await appConfirm('Brak własnego cennika. Przywrócić do wartości fabrycznych?', {
                    title: 'Reset cennika',
                    type: 'warning'
                }))
            )
                return;
            const defaultData1 = await getDefaultProductsStudnie();
            studnieProducts = JSON.parse(JSON.stringify(defaultData1));
        }
    } catch {
        if (
            !(await appConfirm('Przywrócić cennik do wartości fabrycznych?', {
                title: 'Reset cennika',
                type: 'warning'
            }))
        )
            return;
        const defaultData2 = await getDefaultProductsStudnie();
        studnieProducts = JSON.parse(JSON.stringify(defaultData2));
    }
    await saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    renderTiles();
    showToast('Cennik studni przywrócony', 'info');
}

async function manuallySaveStudnieProductsDB() {
    if (
        !(await appConfirm(
            'Czy na pewno chcesz zapisać listę produktów studni jako wartości fabryczne (do resetu)?',
            { title: 'Zapis fabr.', type: 'warning' }
        ))
    )
        return;
    try {
        await saveStudnieProducts(studnieProducts);
        await fetch('/api/products-studnie/default', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data: studnieProducts })
        });
        renderStudniePriceList();
        renderTiles();
        showToast('Zapisano produkty studni jako wartości fabryczne', 'success');
    } catch (err) {
        showToast('Błąd zapisu jako wartości fabryczne', 'error');
    }
}

/* ===== IMPORT / EKSPORT EXCEL ===== */

// Definicje kolumn dla eksportu/importu - kolejność ma znaczenie
const EXPORT_COLUMNS = [
    { key: 'id', header: 'Indeks' },
    { key: 'name', header: 'Nazwa' },
    { key: 'category', header: 'Kategoria' },
    { key: 'componentType', header: 'Typ komponentu' },
    { key: 'dn', header: 'DN' },
    { key: 'height', header: 'Wysokość mm' },
    { key: 'weight', header: 'Waga kg' },
    { key: 'area', header: 'Pow. wewn. m²' },
    { key: 'areaExt', header: 'Pow. zewn. m²' },
    { key: 'transport', header: 'Ilość/transport' },
    { key: 'price', header: 'Cena PLN' },
    { key: 'doplataPEHD', header: 'Dopłata PEHD' },
    { key: 'malowanieWewnetrzne', header: 'Malow. wewn.' },
    { key: 'malowanieZewnetrzne', header: 'Malow. zewn.' },
    { key: 'doplataZelbet', header: 'Dopłata Żelbet' },
    { key: 'doplataDrabNierdzewna', header: 'Drab. Nierdzewna' },
    { key: 'magazynWL', header: 'Mag WL' },
    { key: 'magazynKLB', header: 'Mag KLB' },
    { key: 'formaStandardowa', header: 'Forma std. WL' },
    { key: 'formaStandardowaKLB', header: 'Forma std. KLB' },
    { key: 'zapasDol', header: 'Zapas dół mm' },
    { key: 'zapasGora', header: 'Zapas góra mm' },
    { key: 'zapasDolMin', header: 'Zapas dół min mm' },
    { key: 'zapasGoraMin', header: 'Zapas góra min mm' },
    { key: 'spocznikH', header: 'Wys. spocznika' },
    { key: 'hMin1', header: 'Hmin 1 mm' },
    { key: 'hMax1', header: 'Hmax 1 mm' },
    { key: 'cena1', header: 'Cena 1 PLN' },
    { key: 'hMin2', header: 'Hmin 2 mm' },
    { key: 'hMax2', header: 'Hmax 2 mm' },
    { key: 'cena2', header: 'Cena 2 PLN' },
    { key: 'hMin3', header: 'Hmin 3 mm' },
    { key: 'hMax3', header: 'Hmax 3 mm' },
    { key: 'cena3', header: 'Cena 3 PLN' }
];

// Budowanie odwrotnego wyszukiwania: polski nagłówek -> klucz
const HEADER_TO_KEY = {};
EXPORT_COLUMNS.forEach((c) => {
    HEADER_TO_KEY[c.header] = c.key;
    HEADER_TO_KEY[c.key] = c.key;
});
// Kompatybilność wsteczna: stary nagłówek 'Forma std.' mapuje do formaStandardowa (WL)
HEADER_TO_KEY['Forma std.'] = 'formaStandardowa';

function exportStudnieToExcel() {
    if (!studnieProducts || studnieProducts.length === 0) {
        showToast('Brak danych do eksportu', 'error');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();

        function getSheetName(p) {
            const c = (p.category || '').toLowerCase();
            const ct = (p.componentType || '').toLowerCase();

            if (
                c.includes('akcesoria') ||
                c.includes('chemia') ||
                c.includes('stopnie') ||
                c.includes('uszczelki') ||
                ct === 'wlaz' ||
                ct === 'osadnik'
            )
                return 'Akcesoria';
            if (
                c.includes('przejścia') ||
                c.includes('przejscia') ||
                c.includes('otwór') ||
                c.includes('otwor') ||
                ct === 'przejscie'
            )
                return 'Przejścia';
            if (c.includes('kinet') || ct === 'kineta') return 'Kinety';
            if (c.includes('dennic') || ct === 'dennica') return 'Dennicy';

            if (p.dn) {
                return 'DN' + p.dn;
            }

            return 'Inne';
        }

        // Grupuj produkty według niestandardowej kategorii
        const categories = {};
        studnieProducts.forEach((p) => {
            const cat = getSheetName(p);
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(p);
        });

        Object.keys(categories).forEach((cat) => {
            // Sortuj przejścia rosnąco według DN w każdym arkuszu
            if (cat === 'Przejścia') {
                categories[cat].sort((a, b) => {
                    // Grupuj najpierw według kategorii, a następnie sortuj według DN
                    if (a.category !== b.category)
                        return (a.category || '').localeCompare(b.category || '');
                    const dnA = typeof a.dn === 'string' ? parseInt(a.dn) || 0 : a.dn || 0;
                    const dnB = typeof b.dn === 'string' ? parseInt(b.dn) || 0 : b.dn || 0;
                    return dnA - dnB;
                });
            }

            // Buduj wiersze eksportu z uporządkowanymi kolumnami i polskimi nagłówkami
            const rows = categories[cat].map((p) => {
                const row = {};
                EXPORT_COLUMNS.forEach((col) => {
                    row[col.header] = p[col.key] ?? '';
                });
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(rows);

            // Ustaw szerokości kolumn
            ws['!cols'] = EXPORT_COLUMNS.map((col) => ({
                wch: Math.max(col.header.length + 2, 15)
            }));

            // Upewnij się, że nazwa arkuszu jest poprawna (maks. 31 znaków, brak zakazanych znaków)
            let sheetName = cat.replace(/[\[\]\*\/\\\?\:]/g, '_').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        XLSX.writeFile(wb, 'Cennik_Studni_Export.xlsx');
        showToast(
            'Wyeksportowano cennik do Excela (' +
                studnieProducts.length +
                ' pozycji w ' +
                Object.keys(categories).length +
                ' zakładkach)',
            'success'
        );
    } catch (err) {
        console.error('Export error:', err);
        showToast('Błąd podczas eksportu do Excela', 'error');
    }
}

function importStudnieFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            let allJson = [];
            workbook.SheetNames.forEach((sheetName) => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                if (sheetJson && sheetJson.length > 0) {
                    allJson = allJson.concat(sheetJson);
                }
            });

            if (allJson.length === 0) {
                showToast('Skoroszyt jest pusty lub ma zły format', 'error');
                return;
            }

            // Normalizuj zaimportowane dane — mapuj polskie nagłówki na klucze i ustaw wartości domyślne
            const numericFields = [
                'height',
                'weight',
                'area',
                'areaExt',
                'transport',
                'price',
                'doplataPEHD',
                'malowanieWewnetrzne',
                'malowanieZewnetrzne',
                'doplataZelbet',
                'doplataDrabNierdzewna',
                'magazynWL',
                'magazynKLB',
                'formaStandardowa',
                'formaStandardowaKLB',
                'zapasDol',
                'zapasGora',
                'zapasDolMin',
                'zapasGoraMin',
                'dn',
                'hMin1',
                'hMax1',
                'cena1',
                'hMin2',
                'hMax2',
                'cena2',
                'hMin3',
                'hMax3',
                'cena3'
            ];

            const seenIds = new Set();
            const normalized = allJson
                .map((raw, index) => {
                    const product = {};

                    // Map columns - support both Polish headers and raw keys
                    Object.keys(raw).forEach((col) => {
                        const key = HEADER_TO_KEY[col] || col;
                        product[key] = raw[col];
                    });

                    // Walidacja wymaganych pól
                    product.id = String(product.id || '').trim();
                    product.name = String(product.name || '').trim();

                    if (!product.id || !product.name) {
                        console.warn(
                            `[Import Studnie] Row ${index + 2} skipped: missing ID or Name`
                        );
                        return null;
                    }

                    if (seenIds.has(product.id)) {
                        console.warn(
                            `[Import Studnie] Row ${index + 2} skipped: duplicate ID ${product.id}`
                        );
                        return null;
                    }
                    seenIds.add(product.id);

                    product.category = String(product.category || '').trim() || 'Inne';
                    product.componentType = String(product.componentType || '').trim();
                    if (product.category.startsWith('Kinety') && !product.componentType) {
                        product.componentType = 'kineta';
                    }

                    // Solidne parsowanie pól numerycznych
                    numericFields.forEach((f) => {
                        let valValue = product[f];
                        if (
                            valValue === '' ||
                            valValue === undefined ||
                            valValue === null ||
                            valValue === '—' ||
                            valValue === '-'
                        ) {
                            // Specjalne wartości domyślne dla magazynu i formaStandardowa
                            if (
                                [
                                    'magazynWL',
                                    'magazynKLB',
                                    'formaStandardowa',
                                    'formaStandardowaKLB'
                                ].includes(f)
                            ) {
                                product[f] = 1;
                            } else {
                                product[f] = null;
                            }
                        } else if (typeof valValue === 'string') {
                            valValue = valValue.replace(/\s/g, '').replace(',', '.');
                            const num = parseFloat(valValue);
                            product[f] = isNaN(num) ? null : num;
                        } else {
                            const num = parseFloat(valValue);
                            product[f] = isNaN(num) ? null : num;
                        }
                    });

                    // DN może być ciągiem znaków dla rur jajowych ("600/900")
                    const rawDn = raw[HEADER_TO_KEY['dn'] || 'dn'];
                    if (product.dn !== null && typeof rawDn === 'string' && rawDn.includes('/')) {
                        product.dn = rawDn;
                    }

                    // Zapewnij ostateczne sprawdzenie poprawności wartości domyślnych
                    if (product.magazynWL == null) product.magazynWL = 0;
                    if (product.magazynKLB == null) product.magazynKLB = 0;
                    if (product.formaStandardowa == null) product.formaStandardowa = 1;
                    if (product.formaStandardowaKLB == null) product.formaStandardowaKLB = 1;

                    if (typeof renamePłyty === 'function') {
                        renamePłyty(product);
                    }

                    return product;
                })
                .filter((p) => p !== null);

            if (normalized.length === 0) {
                showToast('Brak prawidłowych wierszy do importu (sprawdź Indeks i Nazwę)', 'error');
                return;
            }

            const confirmImport = await appConfirm(
                `Zaimportować ${normalized.length} pozycji? Aktualny cennik studni zostanie zastąpiony.`,
                { title: 'Import cennika', type: 'warning' }
            );
            if (!confirmImport) return;

            studnieProducts = normalized;
            saveStudnieProducts(studnieProducts);
            renderStudniePriceList();
            renderTiles();
            showToast(`Pomyślnie zaimportowano ${normalized.length} pozycji z Excela`, 'success');
        } catch (err) {
            console.error('Import error:', err);
            showToast('Błąd podczas importu pliku Excel', 'error');
        }
        event.target.value = ''; // Reset input
    };
    reader.onerror = () => showToast('Błąd odczytu pliku', 'error');
    reader.readAsArrayBuffer(file);
}

/* ===== INICJALIZACJA ===== */
document.addEventListener('DOMContentLoaded', async () => {
    // Sprawdzenie autoryzacji
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    try {
        const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
        const authData = await authRes.json();
        if (!authData.user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = authData.user;
    } catch {
        window.location.href = 'index.html';
        return;
    }

    // Wyświetlanie informacji o użytkowniku
    const userEl = document.getElementById('header-username');
    const roleEl = document.getElementById('header-role-badge');
    if (userEl)
        userEl.textContent = currentUser.firstName
            ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
            : currentUser.username;
    if (roleEl) {
        roleEl.textContent = currentUser.role;
        roleEl.style.background =
            currentUser.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)';
        roleEl.style.color = currentUser.role === 'admin' ? '#f59e0b' : '#60a5fa';
        roleEl.style.border =
            currentUser.role === 'admin'
                ? '1px solid rgba(245,158,11,0.3)'
                : '1px solid rgba(59,130,246,0.3)';
    }

    // ── Ustaw najpierw nawigację (przed asynchronicznym ładowaniem danych) ──
    document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    // Ustawianie wyszukiwania
    document
        .getElementById('studnie-pricelist-search')
        ?.addEventListener('input', renderStudniePriceList);

    // Ustawianie domyślnych parametrów oferty
    document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);

    // Kreator: zacznij od kroku 1
    wizardConfirmedParams = new Set();
    goToWizardStep(1);

    // ── Ładowanie danych (opakowane w try-catch, aby błędy nie przerywały nawigacji) ──
    try {
        // Ładowanie produktów
        studnieProducts = await loadStudnieProducts();

        if (!studnieProducts.some((p) => p.componentType === 'kineta')) {
            generateDefaultKinety(true);
        }

        // Dodanie kategorii Otwór KPED jeśli nie istnieje
        if (!studnieProducts.some((p) => p.id === 'Otwor-KPED' || p.category === 'Otwór KPED')) {
            studnieProducts.push({
                id: 'Otwor-KPED',
                name: 'Otwór KPED',
                category: 'Otwór KPED',
                dn: '1020/500', // szerokość/wysokość
                componentType: 'przejscie',
                zapasDol: 300,
                zapasGora: 300,
                zapasDolMin: 150,
                zapasGoraMin: 150,
                price: 500,
                weight: 0
            });
            saveStudnieProducts(studnieProducts);
        }

        // Zacznij bez studni — użytkownik sam dodaje pierwszą studnię
        wells = [];
        wellCounter = 0;
        currentWellIndex = 0;
        offerDefaultZakonczenie = null;
        offerDefaultRedukcja = false;
        offerDefaultRedukcjaMinH = 2500;
        offerDefaultRedukcjaZak = null;

        // Wstępne renderowanie
        refreshAll();

        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        const orderParam = urlParams.get('order');

        offersStudnie = await loadOffersStudnie();
        ordersStudnie = await loadOrdersStudnie();
        clientsDb = await loadClientsDb();
        renderSavedOffersStudnie();

        // Sprawdź, czy otwieramy zamówienie do edycji
        if (orderParam) {
            await enterOrderEditMode(orderParam);
        } else if (tab) {
            showSection(tab);
        }

        // Ustaw odpowiednio początkowy numer oferty na podstawie załadowanych ofert
        if (!orderEditMode) {
            document.getElementById('offer-number').value = generateOfferNumberStudnie();
        }
    } catch (err) {
        console.error('Błąd podczas inicjalizacji danych:', err);
        showToast('Wystąpił błąd podczas ładowania danych. Nawigacja jest dostępna.', 'error');
    }
});
/**
 * Automatycznie naprawia brakujące metadane w produktach (np. dodanych wcześniej ręcznie)
 */
function fixIncompleteProducts() {
    let changed = false;
    studnieProducts.forEach((p) => {
        // Napraw magazyny
        if (p.magazynKLB === undefined) { p.magazynKLB = 1; changed = true; }
        if (p.magazynWL === undefined) { p.magazynWL = 1; changed = true; }
        if (p.active === undefined) { p.active = 1; changed = true; }

        // Napraw typ i DN (jeśli typ to domyślny 'krag' lub brak typu/dn)
        const n = (p.name || '').toUpperCase();
        const cat = (p.category || '').toUpperCase();

        if (!p.componentType || p.componentType === 'krag') {
            let newType = p.componentType || 'krag';
            if (n.includes('REDUKCYJNA')) newType = 'plyta_redukcyjna';
            else if (n.includes('DENNICA')) newType = 'dennica';
            else if (n.includes('KONUS') || n.includes('STOŻEK')) newType = 'konus';
            else if (n.includes('PŁYTA DIN') || n.includes('NAKR')) newType = 'plyta_din';
            else if (n.includes('NAJAZDOWA')) newType = 'plyta_najazdowa';
            else if (n.includes('ZAMYKAJĄCA')) newType = 'plyta_zamykajaca';
            else if (n.includes('ODCIĄŻAJĄCY')) newType = 'pierscien_odciazajacy';
            else if (n.includes('USZCZELKA')) newType = 'uszczelka';
            else if (n.includes('WŁAZ')) newType = 'wlaz';
            else if (n.includes('AVR')) newType = 'avr';

            if (newType !== p.componentType) {
                p.componentType = newType;
                changed = true;
            }
        }

        if (!p.dn || p.dn === null) {
            const dnMatch = (cat + ' ' + n).match(/DN(\d+)/i);
            if (dnMatch) {
                p.dn = parseInt(dnMatch[1]);
                changed = true;
            } else if (n.includes('STYCZNA')) {
                p.dn = 'styczna';
                changed = true;
            }
        }
    });

    if (changed) {
        saveStudnieProducts(studnieProducts);
        console.log('Zastosowano automatyczne poprawki metadanych do produktów studni');
    }
}

// Wywołaj naprawę przy inicjalizacji (z opóźnieniem aby upewnić się, że dane są załadowane)
setTimeout(fixIncompleteProducts, 1000);
