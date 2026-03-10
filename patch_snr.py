import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''                <!-- SNr and Numer Studni -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; align-items:end;">
                    <div class="form-group-sm">
                        <label class="form-label-sm" style="color:var(--text-secondary);">SNr</label>
                        <input type="text" id="zl-snr" class="form-input form-input-sm" value="${well.numer || ''}" placeholder="Wpisz SNr..." style="font-weight:bold; color:var(--text-primary);">
                    </div>
                    <div class="form-group-sm">
                        <label class="form-label-sm" style="color:var(--text-secondary);">Numer studni</label>
                        <input type="text" class="form-input form-input-sm" value="${well.name || ''}" readonly style="background:transparent; border-color:transparent; padding-left:0; font-weight:bold; color:#818cf8;">
                    </div>
                </div>'''

replacement = '''                <!-- Numer Studni -->
                <div class="form-group-sm">
                    <label class="form-label-sm" style="color:var(--text-secondary);">Numer studni</label>
                    <input type="text" class="form-input form-input-sm" value="${well.name || ''}" readonly style="background:transparent; border-color:transparent; padding-left:0; font-weight:bold; color:#818cf8;">
                </div>'''

code = code.replace(target, replacement)

# We must also ensure `zl-snr` defaults to empty string gracefully in `order` payload
# since the input is removed.
target2 = '''        // Well specs
        snr: document.getElementById('zl-snr')?.value || well.numer || '','''

replacement2 = '''        // Well specs
        snr: well.numer || '','''

code = code.replace(target2, replacement2)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("SNr deleted!")
