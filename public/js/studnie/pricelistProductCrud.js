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
    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
    renderStudniePriceList();
    showToast('Element usunięty', 'info');
}

async function copyStudnieProduct(id) {
    const original = studnieProducts.find((p) => p.id === id);
    if (!original) return;
    let finalId = original.id + '-KOP';
    let counter = 1;
    while (studnieProducts.some((p) => p.id === finalId)) {
        finalId = `${original.id}-KOP${counter}`;
        counter++;
    }
    const copied = structuredClone(original);
    copied.id = finalId;
    copied.name = copied.name + ' (Kopia)';
    const index = studnieProducts.findIndex((p) => p.id === id);
    studnieProducts.splice(index + 1, 0, copied);
    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
    renderStudniePriceList();
    showToast('Element skopiowany', 'success');
}

function showAddStudnieProductModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay js-modal-overlay';
    overlay.id = 'add-product-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3><i data-lucide="plus" aria-hidden="true"></i> Dodaj element</h3><button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button></div>
      <div class="form-group"><label class="form-label">Kategoria</label>
        <select class="form-select" id="np-category" onchange="togglePrzejsciaFields()">${CATEGORIES_STUDNIE.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
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
                .map((c) => `<option value="${escapeHtml(c)}">`)
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

async function addStudnieProduct() {
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

        const n = name.toUpperCase();
        if (n.includes('REDUKCYJNA')) newProduct.componentType = 'plyta_redukcyjna';
        else if (n.includes('DENNICA')) newProduct.componentType = 'dennica';
        else if (n.includes('KONUS') || n.includes('STOŻEK')) newProduct.componentType = 'konus';
        else if (n.includes('PŁYTA DIN') || n.includes('NAKR'))
            newProduct.componentType = 'plyta_din';
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
    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
    closeModal();
    renderStudniePriceList();
    showToast('Dodano nowy element', 'success');
}

/* closeModal — przeniesione do shared/ui.js */
