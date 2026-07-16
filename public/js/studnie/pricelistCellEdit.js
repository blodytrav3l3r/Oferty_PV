/* ===== PRZEŁĄCZANIE POLA MAGAZYNU ===== */
function toggleMagazynField(el, field, id) {
    const product = /** @type {any} */ (studnieProducts.find((p) => p.id === id));
    if (!product) return;
    product[field] = product[field] === 1 ? 0 : 1;

    // Natychmiastowa aktualizacja UI bez pełnego re-renderu
    const newVal = product[field];
    el.textContent = String(newVal);
    el.style.color = newVal === 1 ? '#34d399' : 'var(--danger-hover)';

    _studniePricelistDirty = true;
    updateStudnieSaveBtn();
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

        product[field] = val;
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
