import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update inline template to add fields after Kąt
target_inline_grid = '''                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Kąt [°]</label>
                    <input type="number" class="form-input" id="inl-angle" value="0" min="0" max="360" oninput="window.inlineUpdateAngles()" style="padding:0.3rem 0.4rem; font-size:0.7rem; color:#818cf8; font-weight:700;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Uwagi</label>
                    <input type="text" class="form-input" id="inl-notes" placeholder="np. Wlot A" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
                </div>'''

repl_inline_grid = '''                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Kąt [°]</label>
                    <input type="number" class="form-input" id="inl-angle" value="0" min="0" max="360" oninput="window.inlineUpdateAngles()" style="padding:0.3rem 0.4rem; font-size:0.7rem; color:#818cf8; font-weight:700;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Spadek w kinecie [%]</label>
                    <input type="number" class="form-input" id="inl-spadek-kineta" step="0.1" placeholder="np. 0.5" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Spadek w mufie [%]</label>
                    <input type="number" class="form-input" id="inl-spadek-mufa" step="0.1" placeholder="np. 1.0" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Uwagi</label>
                    <input type="text" class="form-input" id="inl-notes" placeholder="np. Wlot A" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
                </div>'''

# Adjust grid columns for inline
text = text.replace(
    'grid-template-columns:1fr 1fr 1fr; gap:0.3rem; align-items:end;',
    'grid-template-columns:1fr 1fr 1fr 1fr 1fr; gap:0.3rem; align-items:end;'
)
text = text.replace(target_inline_grid, repl_inline_grid)

# 2. Update inlineFinish
target_inline_finish = '''    const notes = document.getElementById('inl-notes').value.trim();'''
repl_inline_finish = '''    const notes = document.getElementById('inl-notes').value.trim();
    const spadekKineta = document.getElementById('inl-spadek-kineta').value.trim();
    const spadekMufa = document.getElementById('inl-spadek-mufa').value.trim();'''

text = text.replace(target_inline_finish, repl_inline_finish)

target_inline_push = '''        angleGony: gons,
        notes: notes,
        flowType: flowType'''
repl_inline_push = '''        angleGony: gons,
        notes: notes,
        flowType: flowType,
        spadekKineta: spadekKineta ? parseFloat(spadekKineta).toFixed(1) : null,
        spadekMufa: spadekMufa ? parseFloat(spadekMufa).toFixed(1) : null'''
text = text.replace(target_inline_push, repl_inline_push)

# 3. Update syncEditState
target_sync = '''    if (notesEl) editPrzejscieState.notes = notesEl.value;'''
repl_sync = '''    if (notesEl) editPrzejscieState.notes = notesEl.value;
    const spKEl = document.getElementById('edit-spadek-kineta-' + editPrzejscieIdx);
    const spMEl = document.getElementById('edit-spadek-mufa-' + editPrzejscieIdx);
    if (spKEl) editPrzejscieState.spadekKineta = spKEl.value;
    if (spMEl) editPrzejscieState.spadekMufa = spMEl.value;'''
text = text.replace(target_sync, repl_sync)

# 4. Update editPrzejscie
target_edit_prs = '''        angle: item.angle,
        notes: item.notes || '''''
repl_edit_prs = '''        angle: item.angle,
        notes: item.notes || '',
        spadekKineta: item.spadekKineta || '',
        spadekMufa: item.spadekMufa || '''''
text = text.replace(target_edit_prs, repl_edit_prs)

# 5. editPrzejscieState init
text = text.replace(
    "let editPrzejscieState = { type: null, dnId: null, rzedna: '', angle: 0, notes: '' };",
    "let editPrzejscieState = { type: null, dnId: null, rzedna: '', angle: 0, notes: '', spadekKineta: '', spadekMufa: '' };"
)

# 6. savePrzejscieEdit
target_save_vars = '''    const notes = editPrzejscieState.notes.trim();'''
repl_save_vars = '''    const notes = editPrzejscieState.notes.trim();
    const spadekKineta = editPrzejscieState.spadekKineta;
    const spadekMufa = editPrzejscieState.spadekMufa;'''
text = text.replace(target_save_vars, repl_save_vars)

target_save_obj = '''        angleGony: gons,
        notes: notes'''
repl_save_obj = '''        angleGony: gons,
        notes: notes,
        spadekKineta: spadekKineta ? parseFloat(spadekKineta).toFixed(1) : null,
        spadekMufa: spadekMufa ? parseFloat(spadekMufa).toFixed(1) : null'''
text = text.replace(target_save_obj, repl_save_obj)

# 7. Edit mode HTML form additions
target_edit_html = '''              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Rzędna włączenia [m]</label>
                  <input type="number" class="form-input" id="edit-rzedna-${index}" step="0.01" value="${editPrzejscieState.rzedna}" placeholder="142.50" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Kąt włączenia [°]</label>
                  <input type="number" class="form-input" id="edit-angle-${index}" value="${editPrzejscieState.angle}" min="0" max="360" oninput="editUpdateAngles(${index}); window.syncEditState()" style="padding:0.35rem; font-size:0.75rem; color:#818cf8; font-weight:800; text-align:center;">
                </div>
              </div>'''
              
repl_edit_html = '''              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Rzędna [m]</label>
                  <input type="number" class="form-input" id="edit-rzedna-${index}" step="0.01" value="${editPrzejscieState.rzedna}" placeholder="142.50" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Kąt [°]</label>
                  <input type="number" class="form-input" id="edit-angle-${index}" value="${editPrzejscieState.angle}" min="0" max="360" oninput="editUpdateAngles(${index}); window.syncEditState()" style="padding:0.35rem; font-size:0.75rem; color:#818cf8; font-weight:800; text-align:center;">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spad.Kin [%]</label>
                  <input type="number" class="form-input" id="edit-spadek-kineta-${index}" step="0.1" value="${editPrzejscieState.spadekKineta}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spad.Muf [%]</label>
                  <input type="number" class="form-input" id="edit-spadek-mufa-${index}" step="0.1" value="${editPrzejscieState.spadekMufa}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
              </div>'''
text = text.replace(target_edit_html, repl_edit_html)

# 8. Display mode HTML
# We should add the Spadek kineta and Spadek mufy values next to Rzedna and Kat
target_disp_html = '''              <div style="text-align:center; min-width:80px; position:relative; padding-bottom:0.1rem;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Kąt</div>
                <div onclick="window.activateQuickEdit(this, ${index}, 'angle')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.05rem; font-weight:800; color:${angleColor}; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.5rem; transition:transform 0.2s; display:inline-block;" onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform='scale(1)'">${item.angle}°</div>
              </div>'''

repl_disp_html = '''              <div style="text-align:center; min-width:80px; position:relative; padding-bottom:0.1rem;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Kąt</div>
                <div onclick="window.activateQuickEdit(this, ${index}, 'angle')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.05rem; font-weight:800; color:${angleColor}; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.5rem; transition:transform 0.2s; display:inline-block;" onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform='scale(1)'">${item.angle}°</div>
              </div>
              ${item.spadekKineta !== undefined && item.spadekKineta !== null && item.spadekKineta !== '' ? `
              <div style="text-align:center; min-width:60px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;" title="Spadek w kinecie">Spadek K.</div>
                <div style="font-size:0.9rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3);">${item.spadekKineta}%</div>
              </div>` : ''}
              ${item.spadekMufa !== undefined && item.spadekMufa !== null && item.spadekMufa !== '' ? `
              <div style="text-align:center; min-width:60px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;" title="Spadek w mufie">Spadek M.</div>
                <div style="font-size:0.9rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3);">${item.spadekMufa}%</div>
              </div>` : ''}'''
text = text.replace(target_disp_html, repl_disp_html)

# Let's also fallback state initialization in editPrzejscie
target_fallback = '''                editPrzejscieState.rzedna = item.rzednaWlaczenia || '';
                editPrzejscieState.angle = item.angle || 0;
                editPrzejscieState.notes = item.notes || '';'''
repl_fallback = '''                editPrzejscieState.rzedna = item.rzednaWlaczenia || '';
                editPrzejscieState.angle = item.angle || 0;
                editPrzejscieState.notes = item.notes || '';
                editPrzejscieState.spadekKineta = item.spadekKineta || '';
                editPrzejscieState.spadekMufa = item.spadekMufa || '';'''
text = text.replace(target_fallback, repl_fallback)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch applied successfully!")
