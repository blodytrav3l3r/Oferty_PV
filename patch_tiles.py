import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Change grid columns
target1 = '''    <!-- Dane studni + Przejścia side by side -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-bottom:0.6rem;">'''
replacement1 = '''    <!-- Dane studni + Przejścia side by side -->
    <div style="display:grid; grid-template-columns:0.8fr 1.8fr; gap:0.6rem; margin-bottom:0.6rem;">'''
code = code.replace(target1, replacement1)

# 2. Change tiles for Beton/Żelbet
target2 = '''                <!-- Rodzaj studni -->
                <div class="form-group-sm" style="margin-top:0.2rem;">
                    <label class="form-label-sm" style="color:var(--text-secondary);">Rodzaj studni</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${rodzajStudniOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === rodzajStudniVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                </div>'''

replacement2 = '''                <!-- Rodzaj studni -->
                <div class="form-group-sm" style="margin-top:0.3rem;">
                    <label class="form-label-sm" style="color:var(--text-secondary);">Rodzaj studni</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.3rem;" class="zl-param-group">
                        ${rodzajStudniOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === rodzajStudniVal ? 'active' : ''}" style="padding:0.8rem; font-size:0.95rem; font-weight:800; letter-spacing:0.5px; border-radius:8px;" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                </div>'''
code = code.replace(target2, replacement2)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Tiles scaled successfully!")
