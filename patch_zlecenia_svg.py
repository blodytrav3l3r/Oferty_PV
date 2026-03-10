import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update openZleceniaProdukcyjne
target_open = '''function openZleceniaProdukcyjne() {
    if (wells.length === 0) {
        showToast('Najpierw dodaj studnie', 'error');
        return;
    }
    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.add('active');
    buildZleceniaWellList();
    // Auto select first element
    if (zleceniaElementsList.length > 0) {
        selectZleceniaElement(0);
    }
}'''

replacement_open = '''function openZleceniaProdukcyjne() {
    if (wells.length === 0) {
        showToast('Najpierw dodaj studnie', 'error');
        return;
    }
    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.add('active');
    
    // MOVEMENT OF MAIN SVG DIAGRAM TO MODAL
    const zwp = document.getElementById('zlecenia-well-preview');
    const dz = document.getElementById('drop-zone-diagram');
    if (zwp && dz) {
        zwp.innerHTML = '';
        zwp.appendChild(dz);
        dz.style.flex = '1';
        dz.style.border = 'none'; // remove outer border if any
        dz.style.background = 'transparent';
    }

    buildZleceniaWellList();
    // Auto select first element
    if (zleceniaElementsList.length > 0) {
        selectZleceniaElement(0);
    }
}'''
code = code.replace(target_open, replacement_open)

# 2. Update closeZleceniaModal
target_close = '''function closeZleceniaModal() {
    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.remove('active');
}'''

replacement_close = '''function closeZleceniaModal() {
    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.remove('active');
    
    // RESTORE MAIN SVG DIAGRAM TO MAIN LAYOUT
    const mainLayout = document.querySelector('.well-app-layout');
    const dz = document.getElementById('drop-zone-diagram');
    if (mainLayout && dz) {
        dz.style.flex = '';
        dz.style.border = '';
        dz.style.background = '';
        mainLayout.insertBefore(dz, mainLayout.firstChild);
    }
}'''
code = code.replace(target_close, replacement_close)

# 3. Update selectZleceniaElement
target_select = '''function selectZleceniaElement(idx) {
    zleceniaSelectedIdx = idx;
    renderZleceniaList();
    const el = zleceniaElementsList[idx];
    if (!el) return;
    populateZleceniaForm(el);
    renderZleceniaSvgPreview(el.well);
}'''

replacement_select = '''function selectZleceniaElement(idx) {
    zleceniaSelectedIdx = idx;
    renderZleceniaList();
    const el = zleceniaElementsList[idx];
    if (!el) return;
    
    // Set global well context to the order's well
    if (currentWellIndex !== el.wellIndex) {
        currentWellIndex = el.wellIndex;
    }
    
    // Ensure the diagram updates with correct index and UI gets refreshed
    renderWellDiagram();
    
    populateZleceniaForm(el);
}'''
code = code.replace(target_select, replacement_select)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Modal patched to reuse main diagram!")
