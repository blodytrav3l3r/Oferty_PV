// @ts-check
/* ===== CENNIK UI (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: renderowanie cennika, edycja inline, import/eksport Excel */
/* Zależności: products, CATEGORIES (globalne), saveProducts z dataService.js */
/* renderOfferItems z offerItems.js; fmt, fmtInt z shared/formatters.js */
/* showToast, appConfirm, closeModal z shared/ui.js; authHeaders z shared/auth.js */

let _pricelistDirty = false;

function updateSaveBtn() {
    const btn = document.getElementById('btn-save-pricelist');
    if (!btn) return;
    btn.innerHTML = _pricelistDirty
        ? '<i data-lucide="save"></i> Zapisz <span style="color:var(--warn)">(!)</span>'
        : '<i data-lucide="save"></i> Zapisz';
    if (window.lucide) lucide.createIcons({ root: btn });
}

/* ===== RENDEROWANIE CENNIKA ===== */

function renderPriceList() {
    const container = document.getElementById('pricelist-body');
    if (!container) return;
    const searchVal = document.getElementById('pricelist-search')?.value?.toLowerCase() || '';

    let html = `<div class="table-wrap">
    <table style="table-layout: fixed; width: 100%;">
      <thead>
        <tr>
          <th style="width: 15%;">Indeks</th>
          <th style="width: 35%;">Nazwa produktu</th>
          <th class="text-right" style="width: 12%;">Cena PLN</th>
          <th class="text-right" style="width: 10%;">Pole pow.<br><span style="font-size:0.7em">(m²)</span></th>
          <th class="text-right" style="width: 10%;">Szt./transp.</th>
          <th class="text-right" style="width: 10%;">Waga (kg)</th>
          <th class="text-center" style="width: 8%;">Akcje</th>
        </tr>
      </thead>`;

    let hasAnyItems = false;

    CATEGORIES.forEach((cat) => {
        const items = products.filter(
            (p) =>
                p.category === cat &&
                (!searchVal ||
                    p.id.toLowerCase().includes(searchVal) ||
                    p.name.toLowerCase().includes(searchVal))
        );
        if (items.length === 0) return;

        hasAnyItems = true;

        html += `<tbody>
      <tr>
        <td colspan="7" style="padding: 0; border: none;">
          <div class="cat-header" style="margin: 1rem 0 0.4rem 0;">
            ${cat} <span class="cat-count">(${items.length} produktów)</span>
          </div>
        </td>
      </tr>`;

        items.forEach((p) => {
            html += `<tr data-id="${p.id}">
        <td class="text-nowrap" style="overflow: hidden; text-overflow: ellipsis;"><code style="color:var(--accent-hover);font-size:.78rem" class="editable" onclick="editCell(this,'id','${escapeHtml(p.id)}')">${escapeHtml(p.id)}</code></td>
        <td style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span class="editable" onclick="editCell(this,'name','${escapeHtml(p.id)}')">${escapeHtml(p.name)}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'price','${escapeHtml(p.id)}')">${fmt(p.price)}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'area','${escapeHtml(p.id)}')">${p.area != null ? fmt(p.area) : '—'}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'transport','${escapeHtml(p.id)}')">${p.transport != null ? fmtInt(p.transport) : '—'}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'weight','${escapeHtml(p.id)}')">${p.weight != null ? fmtInt(p.weight) : '—'}</span></td>
        <td class="text-center" style="white-space:nowrap;">
          <button class="btn-icon" title="Powiel" aria-label="Powiel" onclick="copyProduct('${escapeHtml(p.id)}')"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
          <button class="btn-icon" title="Usuń" aria-label="Usuń" onclick="deleteProduct('${escapeHtml(p.id)}')"><i data-lucide="x" aria-hidden="true"></i></button>
        </td>
      </tr>`;
        });

        html += `</tbody>`;
    });

    html += `</table></div>`;

    if (!hasAnyItems) {
        html = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Brak wyników do wyświetlenia...</div>`;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

/* ===== EDYCJA INLINE ===== */

function editCell(el, field, id) {
    if (el.querySelector('input')) return;
    const product = products.find((p) => p.id === id);
    const oldVal = product[field] ?? '';
    const input = document.createElement('input');
    input.type = field === 'name' || field === 'id' ? 'text' : 'number';
    input.className = 'edit-input';
    input.value = oldVal;
    input.style.width = field === 'name' ? '100%' : field === 'id' ? '120px' : '80px';
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    const save = () => {
        const val =
            field === 'name' || field === 'id'
                ? input.value.trim()
                : input.value === ''
                  ? null
                  : Number(input.value);

        if (field === 'id') {
            if (!val) {
                showToast('Indeks nie może być pusty', 'error');
                renderPriceList();
                return;
            }
            if (val !== id && products.some((p) => p.id === val)) {
                showToast('Taki indeks już istnieje', 'error');
                renderPriceList();
                return;
            }
        }

        product[field] = val;
        _pricelistDirty = true;
        updateSaveBtn();
        renderPriceList();
        renderOfferItems();
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') renderPriceList();
    });
}

/* ===== OPERACJE NA PRODUKTACH ===== */

function copyProduct(id) {
    const original = products.find((p) => p.id === id);
    if (!original) return;

    const newId = original.id + '-KOP';
    let counter = 1;
    let finalId = newId;

    while (products.some((p) => p.id === finalId)) {
        finalId = `${newId}${counter}`;
        counter++;
    }

    const copied = structuredClone(original);
    copied.id = finalId;
    copied.name = copied.name + ' (Kopia)';

    const index = products.findIndex((p) => p.id === id);
    products.splice(index + 1, 0, copied);

    _pricelistDirty = true;
    updateSaveBtn();
    renderPriceList();
    showToast('Produkt skopiowany', 'success');
}

async function deleteProduct(id) {
    if (
        !(await appConfirm('Czy na pewno usunąć ten produkt z cennika?', {
            title: 'Usuwanie produktu',
            type: 'danger'
        }))
    )
        return;
    products = products.filter((p) => p.id !== id);
    _pricelistDirty = true;
    updateSaveBtn();
    renderPriceList();
    showToast('Produkt usunięty', 'info');
}

async function resetPriceList() {
    try {
        const json = await api.get('/api/products/default');
        if (!json) throw new Error('Nie udało się pobrać domyślnego cennika');
        const customDefault = /** @type {any} */ (json).data;
        if (customDefault && customDefault.length > 0) {
            if (
                !(await appConfirm(
                    'Przywrócić cennik do Twojego zapisanego cennika domyślnego? Utracisz niezapisane i najnowsze zmiany.',
                    { title: 'Reset cennika', type: 'warning' }
                ))
            )
                return;
            products = structuredClone(customDefault);
        } else {
            showToast('Brak zapisanych wartości fabrycznych cennika', 'error');
            return;
        }
    } catch {
        showToast('Nie udało się pobrać domyślnego cennika z serwera', 'error');
        return;
    }
    _pricelistDirty = true;
    updateSaveBtn();
    renderPriceList();
    showToast('Cennik przywrócony — kliknij Zapisz by zachować', 'info');
}

async function savePriceList() {
    if (!_pricelistDirty) {
        showToast('Brak zmian do zapisania', 'info');
        return;
    }
    try {
        const ok = await saveProducts(products);
        if (!ok) {
            showToast('Błąd zapisu cennika', 'error');
            return;
        }
        _pricelistDirty = false;
        updateSaveBtn();
        renderPriceList();
        if (typeof renderTiles === 'function') renderTiles();
        showToast('Zapisano cennik', 'success');
    } catch (err) {
        logger.error('pricelistUi', 'savePriceList: wyjątek', err);
        showToast('Błąd zapisu: ' + err.message, 'error');
    }
}

/* ===== MODAL DODAWANIA PRODUKTU ===== */

function showAddProductModal() {
    showModal({
        id: 'add-product-modal',
        titleId: 'add-product-title',
        html: `
    <div class="modal">
      <div class="modal-header"><h3 id="add-product-title"><i data-lucide="plus" aria-hidden="true"></i> Dodaj nowy produkt</h3><button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button></div>
      <div class="form-group"><label class="form-label">Kategoria</label>
        <select class="form-select" id="np-category">${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Indeks</label><input class="form-input" id="np-id" placeholder="np. RTB-0-10-25-K00"></div>
      <div class="form-group"><label class="form-label">Nazwa produktu</label><input class="form-input" id="np-name" placeholder="np. RURA WITROS..."></div>
      <div class="form-row form-row-4">
        <div class="form-group"><label class="form-label">Cena PLN</label><input class="form-input" id="np-price" type="number" step="0.01"></div>
        <div class="form-group"><label class="form-label">Pole (m²)</label><input class="form-input" id="np-area" type="number" step="0.01"></div>
        <div class="form-group"><label class="form-label">Szt./trans.</label><input class="form-input" id="np-transport" type="number"></div>
        <div class="form-group"><label class="form-label">Waga (kg)</label><input class="form-input" id="np-weight" type="number"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Anuluj</button>
        <button class="btn btn-primary" onclick="addProduct()">Dodaj produkt</button>
      </div>
    </div>`
    });
    if (window.lucide) lucide.createIcons();
}

function addProduct() {
    const g = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    const id = g('np-id').trim();
    const name = g('np-name').trim();
    const price = parseFloat(g('np-price'));
    const area = g('np-area') ? parseFloat(g('np-area')) : null;
    const transport = g('np-transport') ? parseInt(g('np-transport')) : null;
    const weight = g('np-weight') ? parseInt(g('np-weight')) : null;
    const category = g('np-category');

    if (!id || !name || isNaN(price)) {
        showToast('Wypełnij wymagane pola (indeks, nazwa, cena)', 'error');
        return;
    }
    if (products.some((p) => p.id === id)) {
        showToast('Produkt o takim indeksie już istnieje', 'error');
        return;
    }

    products.push({ id, name, price, area, transport, weight, category });
    _pricelistDirty = true;
    updateSaveBtn();
    closeModal();
    renderPriceList();
    showToast('Dodano nowy produkt', 'success');
}

/* ===== IMPORT / EKSPORT CENNIKA EXCEL ===== */

const RURY_EXPORT_COLUMNS = [
    { header: 'Indeks', key: 'id' },
    { header: 'Nazwa produktu', key: 'name' },
    { header: 'Cena PLN (netto)', key: 'price' },
    { header: 'Kategoria', key: 'category' },
    { header: 'Waga (kg)', key: 'weight' },
    { header: 'Szt./transport', key: 'transport' },
    { header: 'Powierzchnia (m2)', key: 'area' }
];

const RURY_HEADER_TO_KEY = {};
RURY_EXPORT_COLUMNS.forEach((col) => {
    RURY_HEADER_TO_KEY[col.header] = col.key;
});

function exportRuryToExcel() {
    if (!products || products.length === 0) {
        showToast('Brak danych do eksportu', 'error');
        return;
    }
    try {
        const wb = XLSX.utils.book_new();

        const rows = products.map((p) => {
            const row = {};
            RURY_EXPORT_COLUMNS.forEach((col) => {
                row[col.header] = p[col.key] ?? '';
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = RURY_EXPORT_COLUMNS.map((col) => ({
            wch: Math.max(col.header.length + 2, 15)
        }));

        XLSX.utils.book_append_sheet(wb, ws, 'Cennik Rury');
        XLSX.writeFile(wb, 'Cennik_Rury_Export.xlsx');
        showToast(
            'Wyeksportowano cennik rur do Excela (' + products.length + ' pozycji)',
            'success'
        );
    } catch (err) {
        logger.error('pricelistUi', 'Export error:', err);
        showToast('Błąd podczas eksportu do Excela', 'error');
    }
}

function importRuryFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(/** @type {ArrayBuffer} */ (e.target.result));
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!json || json.length === 0) {
                showToast('Skoroszyt jest pusty lub ma zły format', 'error');
                return;
            }

            const numericFields = ['price', 'weight', 'transport', 'area'];
            const seenIds = new Set();
            const normalized = json
                .map((raw, index) => {
                    const product = {};

                    // Mapuj kolumny - obsługuj zarówno polskie nagłówki, jak i surowe klucze
                    Object.keys(raw).forEach((col) => {
                        const key = RURY_HEADER_TO_KEY[col] || col;
                        product[key] = raw[col];
                    });

                    // Podstawowa normalizacja
                    product.id = String(product.id || '').trim();
                    product.name = String(product.name || '').trim();
                    product.category = String(product.category || '').trim() || 'Inne';

                    // Sprawdź wymagane pola
                    if (!product.id || !product.name) {
                        logger.warn(
                            'pricelistUi',
                            `[Import] Wiersz ${index + 2} pominięty: brak ID lub Nazwy`
                        );
                        return null;
                    }

                    // Sprawdź duplikaty w pliku importu
                    if (seenIds.has(product.id)) {
                        logger.warn(
                            'pricelistUi',
                            `[Import] Wiersz ${index + 2} pominięty: duplikat ID ${product.id}`
                        );
                        return null;
                    }
                    seenIds.add(product.id);

                    // Solidne parsowanie liczb
                    numericFields.forEach((f) => {
                        let val = product[f];
                        if (val === '' || val === undefined || val === null || val === '-') {
                            product[f] = null;
                        } else if (typeof val === 'string') {
                            val = val.replace(/\s/g, '').replace(',', '.');
                            const num = parseFloat(val);
                            product[f] = isNaN(num) ? null : num;
                        } else {
                            const num = parseFloat(val);
                            product[f] = isNaN(num) ? null : num;
                        }
                    });

                    return product;
                })
                .filter((p) => p !== null);

            if (normalized.length === 0) {
                showToast('Brak prawidłowych wierszy do importu (sprawdź Indeks i Nazwę)', 'error');
                return;
            }

            const confirmImport = await appConfirm(
                `Zaimportować ${normalized.length} pozycji? Aktualny cennik zostanie zastąpiony.`,
                { title: 'Import cennika', type: 'warning' }
            );
            if (!confirmImport) return;

            products = normalized;
            _pricelistDirty = true;
            updateSaveBtn();
            renderPriceList();
            showToast(
                'Pomyślnie zaimportowano ' +
                    normalized.length +
                    ' pozycji — kliknij Zapisz by zachować',
                'success'
            );
        } catch (err) {
            logger.error('pricelistUi', 'Import error:', err);
            showToast('Błąd podczas importu pliku Excel', 'error');
        }
        event.target.value = ''; // Reset input
    };
    reader.onerror = () => showToast('Błąd odczytu pliku', 'error');
    reader.readAsArrayBuffer(file);
}

window.savePriceList = savePriceList;
window.resetPriceList = resetPriceList;
