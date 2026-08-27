// @ts-check
/* ===== UWAGI PER-STUDNIA — modal edycji (TASK uwagi-per-well) ===== */

function openWellNotesModal(idx) {
    const well = typeof wells !== 'undefined' ? wells[idx] : null;
    if (!well) {
        if (typeof showToast === 'function') showToast('Nie znaleziono studni', 'error');
        return;
    }
    const titleText = well.name || `Studnia DN${well.dn}`;
    const currentVal = well.uwagi || '';
    const preview = currentVal
        ? ` — ${currentVal.slice(0, 40)}${currentVal.length > 40 ? '…' : ''}`
        : '';
    const esc =
        typeof window.escapeHtml === 'function'
            ? window.escapeHtml
            : function (s) {
                  const d = document.createElement('div');
                  d.textContent = s == null ? '' : s;
                  return d.innerHTML;
              };
    const html = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3 id="well-uwagi-title"><i data-lucide="file-text" aria-hidden="true"></i> Uwagi: ${esc(titleText)}</h3>
        <button type="button" class="btn-icon" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.6rem;">
        <label for="well-uwagi-input" style="font-size:var(--fs-sm); color:var(--text-muted);">Treść uwag dla tej studni (widoczna w ofercie i na wydruku, w sekcji „Uwagi do oferty”):</label>
        <textarea id="well-uwagi-input" class="form-textarea" rows="5" placeholder="Wpisz uwagi do tej studni..." style="min-height:90px; resize:vertical;">${esc(currentVal)}</textarea>
        ${preview ? `<div style="font-size:var(--fs-xs); color:var(--text-muted);">Podgląd: ${esc(preview)}</div>` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="closeModal">Anuluj</button>
        <button type="button" class="btn btn-primary" id="well-uwagi-save"><i data-lucide="check" aria-hidden="true"></i> Zapisz</button>
      </div>
    </div>`;

    (typeof window.showModal === 'function' ? window.showModal : showModal)({
        id: 'well-uwagi-modal',
        titleId: 'well-uwagi-title',
        html
    });

    const overlay = document.getElementById('well-uwagi-modal');
    if (overlay && window.lucide) window.lucide.createIcons({ root: overlay });

    const ta = /** @type {HTMLTextAreaElement|null} */ (
        document.getElementById('well-uwagi-input')
    );
    if (ta) {
        ta.focus();
        const len = ta.value.length;
        try {
            ta.setSelectionRange(len, len);
        } catch (_e) {}
    }

    const saveBtn = document.getElementById('well-uwagi-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            const el = document.getElementById('well-uwagi-input');
            const val = el ? el.value.trim() : '';
            well.uwagi = val;
            if (typeof window.closeModal === 'function') window.closeModal('well-uwagi-modal');
            else if (typeof closeModal === 'function') closeModal('well-uwagi-modal');
            if (typeof renderWellsList === 'function') renderWellsList();
            // Odśwież nagłówek edytora jeśli istnieje
            if (typeof renderWellParams === 'function') {
                try {
                    renderWellParams();
                } catch (_e) {}
            }
            if (window.lucide) window.lucide.createIcons();
            if (typeof showToast === 'function')
                showToast(val ? 'Zapisano uwagi' : 'Usunięto uwagi', 'success');
        });
    }
    // Enter+Ctrl save
    if (ta) {
        ta.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                const btn = document.getElementById('well-uwagi-save');
                if (btn) btn.click();
            }
        });
    }
}

function openWellNotesForCurrent() {
    if (typeof currentWellIndex === 'undefined' || currentWellIndex < 0) {
        if (typeof showToast === 'function') showToast('Najpierw wybierz studnię', 'warning');
        return;
    }
    openWellNotesModal(currentWellIndex);
}

function openWellNotesForExcelSelection() {
    // Jeśli zaznaczono checkboxy — bierz pierwszy zaznaczony, inaczej currentWellIndex
    let idx = -1;
    if (typeof _excelRowSelectStates !== 'undefined') {
        for (let i = 0; i < (typeof wells !== 'undefined' ? wells.length : 0); i++) {
            if (_excelRowSelectStates[i]) {
                idx = i;
                break;
            }
        }
    }
    if (idx === -1 && typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0)
        idx = currentWellIndex;
    if (idx === -1) {
        if (typeof showToast === 'function')
            showToast('Zaznacz studnię w tabeli (checkbox) lub wybierz wiersz', 'warning');
        return;
    }
    openWellNotesModal(idx);
}

window.openWellNotesModal = openWellNotesModal;
window.openWellNotesForCurrent = openWellNotesForCurrent;
window.openWellNotesForExcelSelection = openWellNotesForExcelSelection;
