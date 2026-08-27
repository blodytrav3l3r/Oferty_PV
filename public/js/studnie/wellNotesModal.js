// @ts-check
/* ===== UWAGI PER-STUDNIA — modal edycji (TASK uwagi-per-well) ===== */

function openWellNotesModal(idx) {
    // Diagnostyka — pomaga gdy użytkownik zgłasza "nie pojawia się"
    try {
        console.log(
            '[wellNotes] open idx',
            idx,
            'wells',
            typeof wells !== 'undefined' ? wells.length : 'no wells'
        );
    } catch (_e) {}
    const well = typeof wells !== 'undefined' ? wells[idx] : null;
    if (!well) {
        if (typeof showToast === 'function') showToast('Nie znaleziono studni #' + idx, 'error');
        else alert('Nie znaleziono studni #' + idx);
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
    <div class="modal" style="width:90vw; max-width:1040px; min-height:380px; display:flex; flex-direction:column; justify-space-between;">
      <div class="modal-header">
        <h3 id="well-uwagi-title"><i data-lucide="file-text" aria-hidden="true"></i> Uwagi: ${esc(titleText)}</h3>
        <button type="button" class="btn-icon" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.6rem; flex:1; margin-bottom:1rem;">
        <label for="well-uwagi-input" style="font-size:var(--fs-sm); color:var(--text-muted);">Treść uwag dla tej studni (widoczna w ofercie i na wydruku, w sekcji „Uwagi do oferty”):</label>
        <textarea id="well-uwagi-input" class="form-textarea" rows="8" placeholder="Wpisz uwagi do tej studni..." style="min-height:180px; flex:1; resize:vertical; font-size:var(--fs-base); line-height:1.5;">${esc(currentVal)}</textarea>
        ${preview ? `<div style="font-size:var(--fs-xs); color:var(--text-muted);">Podgląd: ${esc(preview)}</div>` : ''}
      </div>
      <div class="modal-footer" style="margin-top:auto;">
        <button type="button" class="btn btn-secondary" data-action="closeModal">Anuluj</button>
        <button type="button" class="btn btn-primary" id="well-uwagi-save"><i data-lucide="check" aria-hidden="true"></i> Zapisz</button>
      </div>
    </div>`;

    let overlay = null;
    try {
        const fn =
            typeof window.showModal === 'function'
                ? window.showModal
                : typeof showModal === 'function'
                  ? showModal
                  : null;
        if (fn) overlay = fn({ id: 'well-uwagi-modal', titleId: 'well-uwagi-title', html });
        else throw new Error('showModal missing');
    } catch (e) {
        // Fallback: ręczne utworzenie overlay (gdy showModal niezaładowany lub rzuca)

        console.warn('[wellNotes] showModal fallback', e);
        let el = document.getElementById('well-uwagi-modal');
        if (el) el.remove();
        el = document.createElement('div');
        el.className = 'modal-overlay js-modal-overlay';
        el.id = 'well-uwagi-modal';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'well-uwagi-title');
        el.style.zIndex = '11000';
        el.innerHTML = html;
        el.addEventListener('click', function (ev) {
            if (ev.target === el) {
                el.remove();
                document.body.style.overflow = document.querySelector('.js-modal-overlay')
                    ? 'hidden'
                    : '';
            }
        });
        document.body.appendChild(el);
        document.body.style.overflow = 'hidden';
        overlay = el;
    }
    if (overlay) {
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '11000';
        overlay.style.background = 'rgba(0, 0, 0, 0.7)';
        if (window.lucide) window.lucide.createIcons({ root: overlay });
        // Delegacja close dla data-action="closeModal" gdy fallback (showModal robi to sam)
        overlay.addEventListener('click', function (ev) {
            const btn = ev.target.closest('[data-action="closeModal"]');
            if (btn) {
                const m = document.getElementById('well-uwagi-modal');
                if (m) {
                    m.remove();
                    if (!document.querySelector('.js-modal-overlay'))
                        document.body.style.overflow = '';
                }
            }
        });
    }

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
    let idx = -1;
    // 1. Checkboxy w Excelu
    if (typeof _excelRowSelectStates !== 'undefined') {
        for (let i = 0; i < (typeof wells !== 'undefined' ? wells.length : 0); i++) {
            if (_excelRowSelectStates[i]) {
                idx = i;
                break;
            }
        }
    }
    // 2. Ostatnio kliknięta komórka w Excelu
    if (
        idx === -1 &&
        typeof _excelLastClickedCell !== 'undefined' &&
        _excelLastClickedCell &&
        typeof _excelLastClickedCell.wIdx === 'number'
    ) {
        idx = _excelLastClickedCell.wIdx;
    }
    // 3. Zaznaczone komórki
    if (
        idx === -1 &&
        typeof _excelSelectedCells !== 'undefined' &&
        Array.isArray(_excelSelectedCells) &&
        _excelSelectedCells.length > 0
    ) {
        const first = _excelSelectedCells[0];
        if (first && typeof first.wIdx === 'number') idx = first.wIdx;
    }
    // 4. Aktywny index studni
    if (
        idx === -1 &&
        typeof currentWellIndex !== 'undefined' &&
        currentWellIndex >= 0 &&
        typeof wells !== 'undefined' &&
        currentWellIndex < wells.length
    ) {
        idx = currentWellIndex;
    }
    // 5. Domyślnie pierwsza studnia z listy
    if (idx === -1 && typeof wells !== 'undefined' && wells.length > 0) {
        idx = 0;
    }

    if (idx === -1 || typeof wells === 'undefined' || !wells[idx]) {
        if (typeof showToast === 'function') showToast('Dodaj najpierw studnię', 'warning');
        return;
    }
    openWellNotesModal(idx);
}

window.openWellNotesModal = openWellNotesModal;
window.openWellNotesForCurrent = openWellNotesForCurrent;
window.openWellNotesForExcelSelection = openWellNotesForExcelSelection;
