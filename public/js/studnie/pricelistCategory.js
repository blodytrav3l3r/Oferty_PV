/* ===== ZARZĄDZANIE KATEGORIAMI PRZEJŚĆ ===== */
function addPrzejsciaCategory() {
    let name = prompt('Podaj nazwę nowej kategorii (np. GRP, Incor):');
    if (!name) return;
    name = name.trim();
    if (!name) return;

    const catName = name;

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

    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
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
    const existingKey = catName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

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
    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
    renderStudniePriceList();
    showToast(`Utworzono kategorię "${catName}" z 1 elementem`, 'success');
}

async function addStudnieElement(groupKey) {
    const defaults = _tabDefaults();

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
    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
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
        const tabFilter = CENNIK_TAB_FILTERS[defaults.tab];
        studnieProducts = studnieProducts.filter((p) => {
            if (!tabFilter || !tabFilter(p)) return true;
            if (defaults.tab === 'kinety') {
                return p.category !== groupKey;
            }
            return p.componentType !== groupKey;
        });
    }

    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
    renderStudniePriceList();
    showToast(`Usunięto kategorię ${label}`, 'info');
}
