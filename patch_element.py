import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    code = f.read()

target1 = '''    const spocznikMatOptions = [
        ['brak', 'Brak'], ['beton_gfk', 'Beton z GFK'], ['klinkier', 'Klinkier'],
        ['preco', 'Preco'], ['precotop', 'Preco Top'], ['unolith', 'UnoLith'],
        ['predl', 'Predl'], ['kamionka', 'Kamionka']
    ];
    
    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? '';'''

replacement1 = '''    const spocznikMatOptions = [
        ['brak', 'Brak'], ['beton_gfk', 'Beton z GFK'], ['klinkier', 'Klinkier'],
        ['preco', 'Preco'], ['precotop', 'Preco Top'], ['unolith', 'UnoLith'],
        ['predl', 'Predl'], ['kamionka', 'Kamionka']
    ];
    
    const rodzajStudniOptions = [
        ['beton', 'Beton'], ['zelbet', 'Żelbet']
    ];
    
    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? '';
    const rodzajStudniVal = existing?.rodzajStudni ?? '';'''

code = code.replace(target1, replacement1)

target2 = '''    <!-- Dane studni + Przejścia side by side -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-bottom:0.6rem;">
        <div class="card card-compact">
            <div class="card-title-sm">🏗️ Dane elementu</div>
            <div class="well-info-grid" style="grid-template-columns:1fr 1fr;">
                <div class="well-info-field">
                    <label>SNr</label>
                    <input type="text" id="zl-snr" value="${well.numer || ''}" readonly>
                </div>
                <div class="well-info-field">
                    <label>Średnica</label>
                    <div class="computed">DN${well.dn}</div>
                </div>
                <div class="well-info-field">
                    <label>Wysokość</label>
                    <div class="computed">${parsed.wysokosc || (product.height || 0)} mm</div>
                </div>
                <div class="well-info-field">
                    <label>Głębokość</label>
                    <div class="computed">${parsed.glebokosc || '—'} mm</div>
                </div>
                <div class="well-info-field" style="grid-column:1/-1;">
                    <label>Dno wraz z kinetą</label>
                    <div class="computed">${dnoKineta > 0 ? dnoKineta + ' mm' : '—'}</div>
                </div>
            </div>
        </div>'''

replacement2 = '''    <!-- Dane studni + Przejścia side by side -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-bottom:0.6rem;">
        <div class="card card-compact">
            <div class="card-title-sm">🏗️ Dane elementu</div>
            <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.75rem;">
                <!-- SNr and Numer Studni -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; align-items:end;">
                    <div class="form-group-sm">
                        <label class="form-label-sm" style="color:var(--text-secondary);">SNr</label>
                        <input type="text" id="zl-snr" class="form-input form-input-sm" value="${well.numer || ''}" placeholder="Wpisz SNr..." style="font-weight:bold; color:var(--text-primary);">
                    </div>
                    <div class="form-group-sm">
                        <label class="form-label-sm" style="color:var(--text-secondary);">Numer studni</label>
                        <input type="text" class="form-input form-input-sm" value="${well.name || ''}" readonly style="background:transparent; border-color:transparent; padding-left:0; font-weight:bold; color:#818cf8;">
                    </div>
                </div>
                
                <!-- Underneath grid -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.2rem; background:#0d1520; padding:0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border-glass);">
                    <div style="display:flex; flex-direction:column;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Średnica</span>
                        <span style="font-weight:bold; color:var(--text-primary);">DN${well.dn}</span>
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Wysokość</span>
                        <span style="font-weight:bold; color:var(--text-primary);">${parsed.wysokosc || (product.height || 0)} mm</span>
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Głębokość</span>
                        <span style="font-weight:bold; color:var(--text-primary);">${parsed.glebokosc || '—'} mm</span>
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Dno wraz z kinetą</span>
                        <span style="font-weight:bold; color:var(--text-primary);">${dnoKineta > 0 ? dnoKineta + ' mm' : '—'}</span>
                    </div>
                </div>
                
                <!-- Rodzaj studni -->
                <div class="form-group-sm" style="margin-top:0.2rem;">
                    <label class="form-label-sm" style="color:var(--text-secondary);">Rodzaj studni</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${rodzajStudniOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === rodzajStudniVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                </div>

            </div>
        </div>'''

code = code.replace(target2, replacement2)

target3 = '''        // Well specs
        snr: well.numer || '',
        srednica: well.dn,
        wysokosc: document.getElementById('zl-wysokosc')?.value || '',
        glebokosc: document.getElementById('zl-glebokosc')?.value || '',
        dnoKineta: document.getElementById('zl-dno-kineta')?.value || '','''

replacement3 = '''        // Well specs
        snr: document.getElementById('zl-snr')?.value || well.numer || '',
        srednica: well.dn,
        wysokosc: document.getElementById('zl-wysokosc')?.value || '',
        glebokosc: document.getElementById('zl-glebokosc')?.value || '',
        dnoKineta: document.getElementById('zl-dno-kineta')?.value || '',
        rodzajStudni: document.getElementById('zl-rodzaj-studni')?.value || '','''

code = code.replace(target3, replacement3)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Dane Elementu styling updated!")
