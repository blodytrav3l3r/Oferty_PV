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

let _studniePricelistDirty = false;

function updateStudnieSaveBtn() {
    const btn = document.getElementById('btn-save-studnie-pricelist');
    if (!btn) return;
    btn.innerHTML = _studniePricelistDirty
        ? '<i data-lucide="save"></i> Zapisz <span style="color:var(--warn)">(!)</span>'
        : '<i data-lucide="save"></i> Zapisz';
    if (window.lucide) lucide.createIcons({ root: btn });
}

function selectCennikTab(tab) {
    currentCennikTab = tab;
    document.querySelectorAll('.cennik-tab').forEach((/** @type {HTMLElement} */ b) => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    if (tab === 'preco') {
        renderPrecoPriceList();
    } else {
        renderStudniePriceList();
    }
}

/* ===== KOLUMNY EKSPORTU ===== */

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
