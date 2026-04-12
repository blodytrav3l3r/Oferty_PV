/* ===== CENNIK UI (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: renderowanie cennika, edycja inline, import/eksport Excel */
/* Zależności: products, CATEGORIES (globalne), saveProducts z dataService.js */
/* renderOfferItems z offerItems.js; fmt, fmtInt z shared/formatters.js */
/* showToast, appConfirm, closeModal z shared/ui.js; authHeaders z shared/auth.js */

/* ===== RENDEROWANIE CENNIKA ===== */

function renderPriceList() {
    const container = document.getElementById('pricelist-body');
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
        <td class="text-nowrap" style="overflow: hidden; text-overflow: ellipsis;"><code style="color:var(--accent-hover);font-size:.78rem" class="editable" onclick="editCell(this,'id','${p.id}')">${p.id}</code></td>
        <td style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span class="editable" onclick="editCell(this,'name','${p.id}')">${p.name}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'price','${p.id}')">${fmt(p.price)}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'area','${p.id}')">${p.area != null ? fmt(p.area) : '—'}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'transport','${p.id}')">${p.transport != null ? fmtInt(p.transport) : '—'}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'weight','${p.id}')">${p.weight != null ? fmtInt(p.weight) : '—'}</span></td>
        <td class="text-center" style="white-space:nowrap;">
          <button class="btn-icon" title="Powiel" onclick="copyProduct('${p.id}')"><i data-lucide="clipboard-list"></i></button>
          <button class="btn-icon" title="Usuń" onclick="deleteProduct('${p.id}')"><i data-lucide="x"></i></button>
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

    let isSaving = false;
    const save = async () => {
        if (isSaving) return;
        isSaving = true;

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
        const ok = await saveProducts(products);
        if (ok) {
            renderPriceList();
            renderOfferItems(); // Przelicz transport na wypadek zmiany wagi lub pojemności
            showToast('Zaktualizowano cennik', 'success');
        } else {
            renderPriceList();
        }
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

    const copied = JSON.parse(JSON.stringify(original));
    copied.id = finalId;
    copied.name = copied.name + ' (Kopia)';

    const index = products.findIndex((p) => p.id === id);
    products.splice(index + 1, 0, copied);

    saveProducts(products);
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
    saveProducts(products);
    renderPriceList();
    showToast('Produkt usunięty', 'info');
}

async function resetPriceList() {
    try {
        const res = await fetch('/api/products/default');
        const json = await res.json();
        const customDefault = json.data;
        if (customDefault && customDefault.length > 0) {
            if (
                !(await appConfirm(
                    'Przywrócić cennik do Twojego zapisanego cennika domyślnego? Utracisz niezapisane i najnowsze zmiany.',
                    { title: 'Reset cennika', type: 'warning' }
                ))
            )
                return;
            products = JSON.parse(JSON.stringify(customDefault));
        } else {
            if (
                !(await appConfirm(
                    'Brak zapisanego własnego cennika. Przywrócić do wartości fabrycznych producenta? Utracisz wszystkie zmiany.',
                    { title: 'Reset cennika', type: 'warning' }
                ))
            )
                return;
            products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
        }
    } catch {
        if (
            !(await appConfirm(
                'Przywrócić cennik do wartości fabrycznych? Utracisz wszystkie zmiany.',
                { title: 'Reset cennika', type: 'warning' }
            ))
        )
            return;
        products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    }
    await saveProducts(products);
    renderPriceList();
    showToast('Cennik przywrócony', 'info');
}

async function manuallySaveProductsDB() {
    if (
        !(await appConfirm(
            'Czy na pewno chcesz zapisać aktualny cennik jako wartości fabryczne (do resetu)?',
            { title: 'Zapis fabr.', type: 'warning' }
        ))
    )
        return;
    try {
        // 1. Zapis bieżącego cennika
        const saveOk = await saveProducts(products);
        if (!saveOk) return;

        // 2. Zapis jako wartości fabryczne
        const res = await fetch('/api/products/default', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data: products })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('manuallySaveProductsDB: błąd zapisu default', res.status, errData);
            showToast(
                'Błąd zapisu wartości fabrycznych: ' + (errData.error || res.status),
                'error'
            );
            return;
        }

        renderPriceList();
        if (typeof renderTiles === 'function') renderTiles();
        showToast('Zapisano produkty jako wartości fabryczne', 'success');
    } catch (err) {
        console.error('manuallySaveProductsDB: wyjątek', err);
        showToast('Błąd zapisu: ' + err.message, 'error');
    }
}

/* ===== MODAL DODAWANIA PRODUKTU ===== */

function showAddProductModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'add-product-modal';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3><i data-lucide="plus"></i> Dodaj nowy produkt</h3><button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button></div>
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
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

function addProduct() {
    const id = document.getElementById('np-id').value.trim();
    const name = document.getElementById('np-name').value.trim();
    const price = parseFloat(document.getElementById('np-price').value);
    const area = document.getElementById('np-area').value
        ? parseFloat(document.getElementById('np-area').value)
        : null;
    const transport = document.getElementById('np-transport').value
        ? parseInt(document.getElementById('np-transport').value)
        : null;
    const weight = document.getElementById('np-weight').value
        ? parseInt(document.getElementById('np-weight').value)
        : null;
    const category = document.getElementById('np-category').value;

    if (!id || !name || isNaN(price)) {
        showToast('Wypełnij wymagane pola (indeks, nazwa, cena)', 'error');
        return;
    }
    if (products.some((p) => p.id === id)) {
        showToast('Produkt o takim indeksie już istnieje', 'error');
        return;
    }

    products.push({ id, name, price, area, transport, weight, category });
    saveProducts(products);
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
        console.error('Export error:', err);
        showToast('Błąd podczas eksportu do Excela', 'error');
    }
}

function importRuryFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
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
                        console.warn(`[Import] Wiersz ${index + 2} pominięty: brak ID lub Nazwy`);
                        return null;
                    }

                    // Sprawdź duplikaty w pliku importu
                    if (seenIds.has(product.id)) {
                        console.warn(
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
            saveProducts(products);
            renderPriceList();
            showToast(
                'Pomyślnie zaimportowano ' + normalized.length + ' pozycji z Excela',
                'success'
            );
        } catch (err) {
            console.error('Import error:', err);
            showToast('Błąd podczas importu pliku Excel', 'error');
        }
        event.target.value = ''; // Reset input
    };
    reader.onerror = () => showToast('Błąd odczytu pliku', 'error');
    reader.readAsArrayBuffer(file);
}
