import re

def update_render(content):
    target = """function renderZleceniaList() {
    const container = document.getElementById('zlecenia-elements-list');
    const countEl = document.getElementById('zlecenia-el-count');
    if (!container) return;

    const search = (document.getElementById('zlecenia-search')?.value || '').toLowerCase();

    let html = '';
    zleceniaElementsList.forEach((el, i) => {
        const matchesSearch = !search ||
            el.product.name.toLowerCase().includes(search) ||
            el.well.name.toLowerCase().includes(search) ||
            ('dn' + el.well.dn).toLowerCase().includes(search);
        if (!matchesSearch) return;

        const isSaved = productionOrders.some(po => po.wellId === el.well.id && po.elementIndex === el.elementIndex);
        const savedOrder = productionOrders.find(po => po.wellId === el.well.id && po.elementIndex === el.elementIndex);
        const isAccepted = savedOrder && savedOrder.status === 'accepted';
        const isActive = i === zleceniaSelectedIdx;
        html += `<div class="zlecenia-el-item ${isActive ? 'active' : ''} ${isSaved ? 'saved' : ''} ${isAccepted ? 'accepted' : ''}" onclick="selectZleceniaElement(${i})">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary);">${el.product.name}</div>
            <div style="display:flex; gap:0.6rem; margin-top:0.15rem; font-size:0.62rem; color:var(--text-muted);">
                <span>📍 ${el.well.name}</span>
                <span>DN${el.well.dn}</span>
                ${el.product.height ? '<span>H: ' + el.product.height + 'mm</span>' : ''}
            </div>
            ${isAccepted ? '<div style="font-size:0.55rem; color:#34d399; margin-top:0.1rem; font-weight:700;">🔒 Zaakceptowane — studnia zablokowana</div>' : (isSaved ? '<div style="font-size:0.55rem; color:#fbbf24; margin-top:0.1rem; font-weight:700;">⏳ Wersja robocza</div>' : '')}
        </div>`;
    });

    if (html === '') html = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.72rem;">Brak elementów (dennic / kręgów z otworem)</div>';
    container.innerHTML = html;
    if (countEl) countEl.textContent = zleceniaElementsList.length + ' elementów';
}"""

    replacement = """function renderZleceniaList() {
    const container = document.getElementById('zlecenia-elements-list');
    const countEl = document.getElementById('zlecenia-el-count');
    if (!container) return;

    const search = (document.getElementById('zlecenia-search')?.value || '').toLowerCase();

    const groupedElements = {};
    let visibleCount = 0;

    zleceniaElementsList.forEach((el, i) => {
        const matchesSearch = !search ||
            el.product.name.toLowerCase().includes(search) ||
            el.well.name.toLowerCase().includes(search) ||
            ('dn' + el.well.dn).toLowerCase().includes(search);
        if (!matchesSearch) return;

        if (!groupedElements[el.wellIndex]) {
            groupedElements[el.wellIndex] = {
                wellName: el.well.name,
                wellDn: el.well.dn,
                elements: []
            };
        }
        groupedElements[el.wellIndex].elements.push({ el, index: i });
        visibleCount++;
    });

    let html = '';
    
    Object.keys(groupedElements).forEach(wIdx => {
        const group = groupedElements[wIdx];
        
        // Well Header
        html += `<div style="background:var(--bg-secondary); padding:0.6rem 0.8rem; border-bottom:1px solid var(--border-glass); border-top:1px solid var(--border-glass); position:sticky; top:0; z-index:5; display:flex; justify-content:space-between; align-items:center; margin-top:-1px;">
            <div style="font-size:0.75rem; font-weight:800; color:#818cf8; text-transform:uppercase; letter-spacing:0.5px;">🏷️ ${group.wellName}</div>
            <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); background:var(--bg-primary); padding:0.2rem 0.5rem; border-radius:12px; border:1px solid var(--border-glass);">DN${group.wellDn}</div>
        </div>
        <div style="padding: 0.4rem;">`; // wrapper for elements in this well

        group.elements.forEach(item => {
            const el = item.el;
            const i = item.index;
            const isSaved = productionOrders.some(po => po.wellId === el.well.id && po.elementIndex === el.elementIndex);
            const savedOrder = productionOrders.find(po => po.wellId === el.well.id && po.elementIndex === el.elementIndex);
            const isAccepted = savedOrder && savedOrder.status === 'accepted';
            const isActive = i === zleceniaSelectedIdx;
            
            html += `<div class="zlecenia-el-item ${isActive ? 'active' : ''} ${isSaved ? 'saved' : ''} ${isAccepted ? 'accepted' : ''}" onclick="selectZleceniaElement(${i})" style="margin-bottom:0.3rem;">
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary);">${el.product.name}</div>
                <div style="display:flex; gap:0.6rem; margin-top:0.15rem; font-size:0.62rem; color:var(--text-muted);">
                    ${el.product.height ? '<span>📐 Wyskokość: ' + el.product.height + 'mm</span>' : ''}
                </div>
                ${isAccepted ? '<div style="font-size:0.55rem; color:#34d399; margin-top:0.2rem; font-weight:700;">🔒 Zaakceptowane — studnia zablokowana</div>' : (isSaved ? '<div style="font-size:0.55rem; color:#fbbf24; margin-top:0.2rem; font-weight:700;">⏳ Wersja robocza</div>' : '')}
            </div>`;
        });
        
        html += `</div>`;
    });

    if (html === '') html = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.72rem;">Brak elementów (dennic / kręgów z otworem)</div>';
    
    // Remove default padding from the container if we bring our own wrappers
    container.style.padding = '0';
    container.innerHTML = html;
    
    if (countEl) countEl.textContent = visibleCount + ' elementów';
}"""

    # Do a strict replacement
    if target in content:
        return content.replace(target, replacement)
    else:
        # Provide fallback if Exact Match fails due to spaces
        return content

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    text = f.read()

new_text = update_render(text)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Grouping completed!")
