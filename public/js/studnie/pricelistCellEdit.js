/* ===== POLA DOSTĘPNOŚCI ===== */
function setStudnieAvailability(input, field, id) {
    const allowed = [
        'active',
        'magazynWL',
        'magazynKLB',
        'formaStandardowa',
        'formaStandardowaKLB'
    ];
    if (!allowed.includes(field)) return;
    const product = /** @type {any} */ (
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(id)
            : studnieProducts.find((p) => p.id === id)
    );
    if (!product) return;
    if (window.pricelistVersions?.isEditing?.('studnie') !== true) {
        input.checked = product[field] === 1 || product[field] === true;
        return;
    }
    const newVal = input.checked ? 1 : 0;
    window.studnieProducts = studnieProducts.map((p) =>
        p === product ? { ...p, [field]: newVal } : p
    );

    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
}

function setStudnieCategoryAvailability(input) {
    if (window.pricelistVersions?.isEditing?.('studnie') !== true) return;
    const field = input.dataset.field;
    const allowed = [
        'active',
        'magazynWL',
        'magazynKLB',
        'formaStandardowa',
        'formaStandardowaKLB'
    ];
    if (!allowed.includes(field)) return;
    const group = input.closest('tbody');
    if (!group) return;
    const checkboxes = [
        ...group.querySelectorAll(
            `input[data-action="setStudnieAvailability"][data-field="${field}"]`
        )
    ];
    const ids = new Set(checkboxes.map((checkbox) => checkbox.dataset.id));
    if (ids.size === 0) return;
    const value = input.checked ? 1 : 0;
    window.studnieProducts = studnieProducts.map((product) =>
        ids.has(product.id) ? { ...product, [field]: value } : product
    );
    checkboxes.forEach((checkbox) => {
        checkbox.checked = input.checked;
    });
    input.indeterminate = false;
    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
}

/* ===== EDYCJA W MIEJSCU ===== */
function editStudnieCell(el, field, id) {
    if (el.querySelector('input')) return;
    const product =
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(id)
            : studnieProducts.find((p) => p.id === id);
    if (!product) return;
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

    const save = () => {
        let val = /** @type {any} */ (input.value.trim());
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

        window.studnieProducts = studnieProducts.map((p) =>
            p === product ? { ...p, [field]: val } : p
        );
        _studniePricelistDirty = true;
        updateStudnieSaveBtn();
        renderStudniePriceList();
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') renderStudniePriceList();
    });
}

/* ===== Rejestracja globali ===== */
window.setStudnieAvailability = setStudnieAvailability;
window.setStudnieCategoryAvailability = setStudnieCategoryAvailability;
window.editStudnieCell = editStudnieCell;
