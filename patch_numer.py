import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''                <!-- Numer Studni -->
                <div class="form-group-sm">
                    <label class="form-label-sm" style="color:var(--text-secondary);">Numer studni</label>
                    <input type="text" class="form-input form-input-sm" value="${well.name || ''}" readonly style="background:transparent; border-color:transparent; padding-left:0; font-weight:bold; color:#818cf8;">
                </div>'''

replacement = '''                <!-- Numer Studni -->
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase; font-weight:600;">Numer studni</span>
                    <span style="font-weight:bold; color:#818cf8; font-size:0.85rem;">${well.name || ''}</span>
                </div>'''

code = code.replace(target, replacement)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Numer studni layout updated!")
