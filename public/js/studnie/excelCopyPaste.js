// @ts-check
/* ===== EXCEL COPY / PASTE (Excel-like) ===== */
let _excelPasteRafId = null;

function _excelGetPasteColIdx(row) {
    if (!row) return 2;
    const active = document.activeElement;
    if (active && row.contains(active)) {
        const td = active.closest('td');
        if (td) {
            const ci = Array.from(row.children).indexOf(td);
            if (ci >= 2) return ci;
        }
    }
    return 2; /* fallback: pierwsza kolumna po Lp+NrStudni */
}
/* Widoczne wiersze (pomija display:none z filtra wyszukiwarki), posortowane po data-widx */
function _excelGetVisibleRows() {
    const rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    /** @type {HTMLElement[]} */
    const out = [];
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].style.display !== 'none') out.push(/** @type {HTMLElement} */ (rows[i]));
    }
    return out;
}

if (typeof window !== 'undefined') {
    window._excelPasteMismatches = [];
}
function _excelRecordMismatch(item) {
    if (typeof window === 'undefined') return;
    if (!window._excelPasteMismatches) window._excelPasteMismatches = [];
    const key = item.wIdx + '_' + item.colIdx;
    const existingIdx = window._excelPasteMismatches.findIndex(
        (m) => m.wIdx + '_' + m.colIdx === key
    );
    if (existingIdx >= 0) window._excelPasteMismatches[existingIdx] = item;
    else window._excelPasteMismatches.push(item);
}
function _excelLevenshteinDistance(a, b) {
    const s1 = String(a).toLowerCase();
    const s2 = String(b).toLowerCase();
    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
        }
    }
    return matrix[s2.length][s1.length];
}
function _excelFindClosestCategory(val, categories) {
    if (!categories || categories.length === 0) return '';
    const norm = String(val).trim().toLowerCase();
    if (!norm) return categories[0];
    const exact = categories.find((c) => String(c).trim().toLowerCase() === norm);
    if (exact) return exact;
    let bestCat = '';
    let bestScore = -1;
    categories.forEach((c) => {
        const cNorm = String(c).trim().toLowerCase();
        if (cNorm.includes(norm) || norm.includes(cNorm)) {
            const score = 100 - Math.abs(cNorm.length - norm.length);
            if (score > bestScore) {
                bestScore = score;
                bestCat = c;
            }
        }
    });
    if (bestCat) return bestCat;
    let minDist = Infinity;
    categories.forEach((c) => {
        const dist = _excelLevenshteinDistance(norm, String(c).trim().toLowerCase());
        if (dist < minDist) {
            minDist = dist;
            bestCat = c;
        }
    });
    return bestCat || categories[0];
}
function _excelFindClosestProduct(val, products) {
    if (!products || products.length === 0) return null;
    const valStr = String(val).trim();
    const numVal = parseFloat(valStr.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!isNaN(numVal)) {
        let bestProd = products[0];
        let minDist = Infinity;
        products.forEach((p) => {
            const pDn = parseFloat(String(p.dn).replace(/[^\d.]/g, ''));
            if (!isNaN(pDn)) {
                const dist = Math.abs(pDn - numVal);
                if (dist < minDist) {
                    minDist = dist;
                    bestProd = p;
                }
            }
        });
        return bestProd;
    }
    const names = products.map((p) => p.name || p.id);
    const closestName = _excelFindClosestCategory(valStr, names);
    return products.find((p) => (p.name || p.id) === closestName) || products[0];
}
function _excelFindClosestOption(options, val) {
    const optsArr = Array.from(options).filter(
        (o) => o.value !== '' && o.value !== '-- wybierz --'
    );
    if (optsArr.length === 0) return null;
    const valStr = String(val).trim();
    const numVal = parseFloat(valStr.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!isNaN(numVal)) {
        let bestOpt = optsArr[0];
        let minDist = Infinity;
        optsArr.forEach((o) => {
            const oNum = parseFloat((o.text || o.value).replace(/[^\d.]/g, ''));
            if (!isNaN(oNum)) {
                const dist = Math.abs(oNum - numVal);
                if (dist < minDist) {
                    minDist = dist;
                    bestOpt = o;
                }
            }
        });
        return bestOpt;
    }
    const catList = optsArr.map((o) => o.text);
    const closestText = _excelFindClosestCategory(valStr, catList);
    return optsArr.find((o) => o.text === closestText) || optsArr[0];
}
function _excelShowMismatchModal(mismatches) {
    if (typeof window === 'undefined' || !mismatches || mismatches.length === 0) return;
    let rowsHtml = '';
    mismatches.forEach((m, idx) => {
        const trIdx = Math.floor((m.colIdx - 7) / 4);
        const subType = (m.colIdx - 7) % 4;
        let colName = 'Przejście ' + (trIdx + 1);
        if (subType === 2) colName += ' (Rodzaj)';
        else if (subType === 3) colName += ' (Średnica)';
        else if (m.colIdx === 3) colName = 'Nazwa studni';
        let selectHtml = `<select class="excel-mismatch-select" data-m-idx="${idx}" style="padding:0.4rem 0.6rem; border-radius:var(--radius-sm); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-glass); font-size:var(--fs-sm); width:100%;">`;
        m.options.forEach((opt) => {
            const isSel = opt.value === m.matchedVal ? 'selected' : '';
            const safeVal =
                typeof escapeHtmlAttr === 'function' ? escapeHtmlAttr(opt.value) : opt.value;
            const safeText = typeof escapeHtml === 'function' ? escapeHtml(opt.text) : opt.text;
            selectHtml += `<option value="${safeVal}" ${isSel}>${safeText}</option>`;
        });
        selectHtml += `</select>`;
        const safeWellName = typeof escapeHtml === 'function' ? escapeHtml(m.wellName) : m.wellName;
        const safeColName = typeof escapeHtml === 'function' ? escapeHtml(colName) : colName;
        const safeOrigVal =
            typeof escapeHtml === 'function' ? escapeHtml(m.originalVal) : m.originalVal;
        rowsHtml += `<tr style="border-bottom:1px solid var(--border-glass);"><td style="padding:0.6rem; font-weight:var(--fw-bold);">${safeWellName}</td><td style="padding:0.6rem; color:var(--accent-text);">${safeColName}</td><td style="padding:0.6rem; color:var(--warn-hover);"><code style="background:rgba(var(--warn-rgb),0.15); padding:0.15rem 0.4rem; border-radius:4px;">${safeOrigVal}</code></td><td style="padding:0.6rem;">${selectHtml}</td></tr>`;
    });
    const html = `<div class="modal modal--lg" style="max-width:750px; width:92vw; background:var(--bg-secondary); border:1px solid var(--border-glass); border-radius:var(--radius-md); padding:1.5rem; color:var(--text-primary);"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border-glass); padding-bottom:0.8rem;"><h3 style="margin:0; font-size:var(--fs-xl); font-weight:var(--fw-bold); display:flex; align-items:center; gap:0.5rem; color:var(--text-heading);"><i data-lucide="alert-triangle" style="color:var(--warn);"></i> Weryfikacja wklejonych przejść i średnic</h3><button onclick="closeModal('excel-paste-mismatch-modal')" class="btn-icon" aria-label="Zamknij" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem;">✕</button></div><p style="font-size:var(--fs-sm); color:var(--text-secondary); margin-bottom:1rem; line-height:1.4;">Poniższe wartości z wklejonych danych nie miały dokładnego odpowiednika w systemie. Automatycznie wybrano najbardziej zbliżone opcje. Możesz je zweryfikować i zmienić przed zatwierdzeniem:</p><div style="max-height:360px; overflow-y:auto; border:1px solid var(--border-glass); border-radius:var(--radius-sm); margin-bottom:1.2rem;"><table style="width:100%; border-collapse:collapse; font-size:var(--fs-sm); text-align:left;"><thead style="background:var(--bg-tertiary); position:sticky; top:0; z-index:2;"><tr><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Studnia</th><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Pole</th><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Wklejona wartość</th><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Wybierz zbliżoną opcję</th></tr></thead><tbody>${rowsHtml}</tbody></table></div><div style="display:flex; justify-content:flex-end; gap:0.8rem;"><button type="button" class="btn btn-secondary" onclick="closeModal('excel-paste-mismatch-modal')" style="padding:0.5rem 1rem;">Anuluj</button><button type="button" class="btn btn-primary" onclick="excelConfirmPasteMismatches()" style="padding:0.5rem 1.2rem; background:var(--accent); color:#fff; border:none; border-radius:var(--radius-sm); font-weight:var(--fw-bold); cursor:pointer;">Zatwierdź zmiany</button></div></div>`;
    if (typeof window.showModal === 'function') {
        window.showModal({
            id: 'excel-paste-mismatch-modal',
            title: 'Weryfikacja wklejonych przejść i średnic',
            html: html
        });
        if (typeof lucide !== 'undefined' && lucide.createIcons)
            lucide.createIcons({ root: document.getElementById('excel-paste-mismatch-modal') });
    }
}
function excelConfirmPasteMismatches() {
    const modal = document.getElementById('excel-paste-mismatch-modal');
    if (!modal) return;
    const selects = modal.querySelectorAll('.excel-mismatch-select');
    selects.forEach((sel) => {
        const idx = parseInt(sel.getAttribute('data-m-idx') || '-1', 10);
        if (idx >= 0 && window._excelPasteMismatches && window._excelPasteMismatches[idx]) {
            const m = window._excelPasteMismatches[idx];
            const newVal = sel.value;
            const wIdx = m.wIdx;
            const colIdx = m.colIdx;
            if (!isNaN(wIdx) && wells[wIdx]) {
                const trIdx = Math.floor((colIdx - 7) / 4);
                const subType = (colIdx - 7) % 4;
                if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
                while (wells[wIdx].przejscia.length <= trIdx)
                    if (typeof _excelCreatePrzejscie === 'function')
                        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
                const prz = wells[wIdx].przejscia[trIdx];
                if (subType === 2) prz.tempCategory = newVal;
                else if (subType === 3) {
                    prz.productId = newVal;
                    const prod =
                        typeof studnieProducts !== 'undefined'
                            ? studnieProducts.find((p) => p.id === newVal)
                            : null;
                    if (prod) prz.tempCategory = prod.category;
                }
            }
        }
    });
    if (typeof closeModal === 'function') closeModal('excel-paste-mismatch-modal');
    window._excelPasteMismatches = [];
    if (typeof _excelMarkDirty === 'function') _excelMarkDirty();
    if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
    if (typeof showToast === 'function') showToast('Zatwierdzono dopasowania przejść', 'success');
}
if (typeof window !== 'undefined') {
    window.excelConfirmPasteMismatches = excelConfirmPasteMismatches;
    window._excelShowMismatchModal = _excelShowMismatchModal;
}
function _excelNormalizeHeader(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function _excelDetectHeader(firstParts) {
    if (!firstParts || firstParts.length === 0) return false;
    const norms = firstParts.map(_excelNormalizeHeader);
    const kws = [
        'stu',
        'nr',
        'nazwa',
        'rz wlazu',
        'rz dna',
        'srednica',
        'rz wlot',
        'rzedna wlot',
        'kat',
        'rodzaj',
        'wlaz',
        'krag',
        'plyta',
        'kineta',
        'psia buda'
    ];
    let hits = 0;
    for (const n of norms) {
        if (!n) continue;
        for (const kw of kws)
            if (n.includes(kw) || kw.includes(n)) {
                hits++;
                break;
            }
    }
    if (hits >= 2) return true;
    if (firstParts.length === 1 && hits >= 1) return true;
    if (hits >= 1 && firstParts.length >= 3) {
        const nonNum = norms.filter((v) => v && isNaN(parseFloat(v.replace(',', '.')))).length;
        if (nonNum >= 2) return true;
    }
    return false;
}
function _excelBuildSemanticMap(headerParts, dn) {
    const norms = headerParts.map(_excelNormalizeHeader);
    const wew = [];
    wew.push({ norm: 'stu', col: 3 });
    wew.push({ norm: 'nr', col: 3 });
    wew.push({ norm: 'nazwa', col: 3 });
    wew.push({ norm: 'nr studni', col: 3 });
    wew.push({ norm: 'nazwa studni', col: 3 });
    wew.push({ norm: 'numer', col: 3 });
    wew.push({ norm: 'numer studni', col: 3 });
    wew.push({ norm: 'studnia', col: 3 });
    wew.push({ norm: 'rz wlazu', col: 4 });
    wew.push({ norm: 'rz dna', col: 5 });
    const maxTr = (typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[dn]) || 1;
    const headerN = norms.filter((n) => n.includes('srednica')).length || maxTr;
    const N = Math.max(maxTr, headerN, 1);
    for (let i = 0; i < N; i++) {
        wew.push({ norm: `rz wlot ${i}`, col: 7 + i * 4 });
        wew.push({ norm: `kat ${i}`, col: 8 + i * 4 });
        wew.push({ norm: `rodzaj ${i}`, col: 9 + i * 4 });
        wew.push({ norm: `srednica ${i}`, col: 10 + i * 4 });
    }
    const map = {};
    for (let extIdx = 0; extIdx < norms.length; extIdx++) {
        const e = norms[extIdx];
        if (!e) continue;
        let f = wew.find((x) => x.norm === e);
        if (!f) f = wew.find((x) => e.includes(x.norm) || x.norm.includes(e));
        if (!f) {
            const mS = e.match(/srednica\s*(\d+)/);
            if (mS) f = wew.find((x) => x.col === 10 + parseInt(mS[1], 10) * 4);
            else {
                const mR = e.match(/rz\s*wlot\s*(\d+)/);
                if (mR) f = wew.find((x) => x.col === 7 + parseInt(mR[1], 10) * 4);
                else {
                    const mK = e.match(/kat\s*(\d+)/);
                    if (mK) f = wew.find((x) => x.col === 8 + parseInt(mK[1], 10) * 4);
                    else {
                        const mRo = e.match(/rodzaj\s*(\d+)/);
                        if (mRo) f = wew.find((x) => x.col === 9 + parseInt(mRo[1], 10) * 4);
                    }
                }
            }
        }
        if (!f && e === 'srednica') f = wew.find((x) => x.norm === 'srednica 0');
        if (!f && e === 'rz wlot') f = wew.find((x) => x.norm === 'rz wlot 0');
        if (!f && e === 'kat') f = wew.find((x) => x.norm === 'kat 0');
        if (!f && e === 'rodzaj') f = wew.find((x) => x.norm === 'rodzaj 0');
        if (f) map[extIdx] = f.col;
    }
    return map;
}
function _excelPasteSemantic(lines, visibleRows, map) {
    for (let si = 0; si < lines.length; si++) {
        const parts = lines[si].split('\t');
        const row = visibleRows[si];
        if (!row) continue;
        for (let ci = 0; ci < parts.length; ci++) {
            const targetCol = map[ci];
            if (targetCol == null) continue;
            const tdEl = row.children[targetCol];
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, parts[ci].replace(/\r/g, '').trim());
        }
    }
}
function _excelPasteSemanticBatch(lines, visibleRows, map, doneCallback) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    if (total < 100) {
        _excelPasteSemantic(lines, visibleRows, map);
        if (doneCallback) doneCallback();
        return;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        if (!document.getElementById('excel-table-overlay')) {
            _excelCancelPasteBatch();
            return;
        }
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            const parts = lines[idx].split('\t');
            const row = visibleRows[idx];
            if (!row) continue;
            for (let ci = 0; ci < parts.length; ci++) {
                const targetCol = map[ci];
                if (targetCol == null) continue;
                const tdEl = row.children[targetCol];
                const target = tdEl ? tdEl.querySelector('input, select') : null;
                if (target) _excelSetCellValue(target, parts[ci].replace(/\r/g, '').trim());
            }
        }
        _excelShowPasteProgress(idx, total);
        if (idx < total) _excelPasteRafId = requestAnimationFrame(tick);
        else {
            _excelPasteRafId = null;
            _excelHidePasteProgress();
            if (doneCallback) doneCallback();
        }
    }
    _excelPasteRafId = requestAnimationFrame(tick);
}
function _excelHandleCopy(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    e.preventDefault();
    const rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
    if (rows.length === 0) return;
    let text = '';
    if (_excelSelectedCells.length > 0) {
        const cellMap = {};
        let minR = Infinity,
            maxR = -Infinity,
            minC = Infinity,
            maxC = -Infinity;
        _excelSelectedCells.forEach(function (cell) {
            if (!cellMap[cell.wIdx]) cellMap[cell.wIdx] = {};
            cellMap[cell.wIdx][cell.colIdx] = true;
            if (cell.wIdx < minR) minR = cell.wIdx;
            if (cell.wIdx > maxR) maxR = cell.wIdx;
            if (cell.colIdx < minC) minC = cell.colIdx;
            if (cell.colIdx > maxC) maxC = cell.colIdx;
        });
        /* Mapa data-widx -> wiersz (wIdx z selekcji = indeks globalny, nie pozycja DOM) */
        const rowMap = {};
        for (let i = 0; i < rows.length; i++) {
            rowMap[rows[i].getAttribute('data-widx')] = rows[i];
        }
        for (let r = minR; r <= maxR; r++) {
            const line = [];
            for (let c = minC; c <= maxC; c++) {
                let val = '';
                if (cellMap[r] && cellMap[r][c]) {
                    const row = rowMap[r];
                    if (row) {
                        const td = row.children[c];
                        const target = td ? td.querySelector('input, select') : null;
                        if (target) {
                            const _sel = /** @type {HTMLSelectElement} */ (target);
                            val =
                                _sel.tagName === 'SELECT'
                                    ? _sel.options[_sel.selectedIndex]
                                        ? _sel.options[_sel.selectedIndex].text
                                        : ''
                                    : /** @type {HTMLInputElement} */ (target).value || '';
                        }
                    }
                }
                line.push(val);
            }
            text += line.join('\t') + '\n';
        }
    } else if (_excelSelectedCols.length > 0) {
        const cols = [..._excelSelectedCols].sort(function (a, b) {
            return a - b;
        });
        _excelGetVisibleRows().forEach(function (row) {
            const line = [];
            cols.forEach(function (colIdx) {
                const td = row.children[colIdx];
                const target = td ? td.querySelector('input, select') : null;
                line.push(
                    target
                        ? (function (t) {
                              const _s = /** @type {HTMLSelectElement} */ (t);
                              return _s.tagName === 'SELECT'
                                  ? _s.options[_s.selectedIndex]
                                      ? _s.options[_s.selectedIndex].text
                                      : ''
                                  : /** @type {HTMLInputElement} */ (t).value || '';
                          })(target)
                        : ''
                );
            });
            text += line.join('\t') + '\n';
        });
    }
    if (text) {
        if (e.clipboardData) {
            e.clipboardData.setData('text/plain', text);
        } else if (window.clipboardData) {
            window.clipboardData.setData('text', text);
        }
    }
}

function _excelHandleCut(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    /* ClipboardEvent ma clipboardData — wypełnij schowek (wzorzec jak Ctrl+C) */
    _excelHandleCopy(e);
    _excelSaveUndoSnapshot();
    _excelPasteInProgress = true;
    try {
        if (_excelSelectedCells.length > 0) {
            _excelSelectedCells.forEach(function (cell) {
                if (cell.colIdx === 3) return; /* nazwa studni — nigdy nie kasuj */
                const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
                if (!row) return;
                const td = row.children[cell.colIdx];
                const target = td ? td.querySelector('input, select') : null;
                if (!target) return;
                _excelSetCellValue(target, '');
            });
        } else {
            /* Zaznaczone kolumny — czyść we wszystkich widocznych wierszach */
            _excelGetVisibleRows().forEach(function (row) {
                _excelSelectedCols.forEach(function (colIdx) {
                    if (colIdx === 3) return; /* nazwa studni — nigdy nie kasuj */
                    const td = row.children[colIdx];
                    const target = td ? td.querySelector('input, select') : null;
                    if (target) _excelSetCellValue(target, '');
                });
            });
        }
        showToast('Wycinto: ' + _excelSelectedCells.length + ' komorek', 'info');
    } finally {
        _excelPasteInProgress = false;
    }
}

function _excelHandlePaste(e) {
    /* Tylko gdy Excel otwarty */
    if (!document.getElementById('excel-table-overlay')) return;
    const cb = e.clipboardData || window.clipboardData;
    if (!cb) return;
    const text = cb.getData('text');
    if (!text || !text.trim()) return;
    /* Zawsze przejmij event gdy jesteśmy w kontenerze (capture phase) */
    e.preventDefault();
    e.stopPropagation();

    /* Paste w pusty wiersz → utwórz nowe studnie */
    const _emptyInput = document.getElementById('excel-empty-name');
    if (_emptyInput && _emptyInput === document.activeElement) {
        _excelPasteCreateWells(text);
        return;
    }

    /* Jeden snapshot undo dla CAŁEGO wklejenia; flaga blokuje indywidualne
       snapshoty w handlerach zmian (per komórka) — inaczej stack undo
       przepełnia się po 20 komórkach i Ctrl+Z nie cofa wklejenia. */
    _excelSaveUndoSnapshot();
    _excelPasteInProgress = true;
    window._excelPasteMismatches = [];
    let _batched = false;
    const _finishPaste = function () {
        _excelPasteInProgress = false;
        /* W4: wyczyść martwą selekcję (tablice i klasy) + pełny re-render. */
        if (typeof _excelResetLayoutDependentState === 'function')
            _excelResetLayoutDependentState();
        _excelRenderTable(_excelActiveTab);
        if (typeof _excelMarkDirty === 'function')
            try {
                _excelMarkDirty();
            } catch (_e) {}
        if (typeof window.refreshAll === 'function') {
            try {
                window.refreshAll();
            } catch (_e) {}
        } else {
            if (typeof window.updateSummary === 'function')
                try {
                    window.updateSummary();
                } catch (_e) {}
            if (typeof window.renderWellsList === 'function')
                try {
                    window.renderWellsList();
                } catch (_e) {}
            if (typeof window.renderWellDiagram === 'function')
                try {
                    window.renderWellDiagram();
                } catch (_e) {}
        }
        if (window._excelPasteMismatches && window._excelPasteMismatches.length > 0) {
            setTimeout(() => {
                if (window._excelPasteMismatches && window._excelPasteMismatches.length > 0)
                    _excelShowMismatchModal(window._excelPasteMismatches);
            }, 120);
        }
        if (typeof _excelAutoSelectEnabled !== 'undefined' && _excelAutoSelectEnabled) {
            const toAuto = [];
            for (let i = 0; i < wells.length; i++) {
                const w = wells[i];
                if (!w || w.autoSelect === false) continue;
                if (_excelIsWellLocked(i)) continue;
                if (w.rzednaWlazu == null || w.rzednaDna == null) continue;
                if (parseFloat(w.rzednaWlazu) <= parseFloat(w.rzednaDna)) continue;
                toAuto.push(i);
            }
            const recent = toAuto.slice(-5);
            recent.forEach((wIdx, k) => {
                setTimeout(
                    () => {
                        if (typeof _excelAutoSelectForWell === 'function')
                            _excelAutoSelectForWell(wIdx).catch(() => {});
                    },
                    200 + k * 300
                );
            });
        }
    };
    try {
        const rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        if (rows.length === 0) return;
        let lines = text.trim().split('\n');
        for (let _pi = 0; _pi < lines.length; _pi++) {
            lines[_pi] = lines[_pi].replace(/\r$/, '');
        }
        // Wklejanie z nagłówkiem (zewnętrzny Excel): wykryj i zbuduj mapę semantyczną
        let _hasHeader = false;
        let _semanticMap = null;
        if (lines.length > 1) {
            const _firstParts = lines[0].split('\t');
            if (_excelDetectHeader(_firstParts)) {
                _hasHeader = true;
                _semanticMap = _excelBuildSemanticMap(_firstParts, _excelActiveTab || '1000');
                lines = lines.slice(1);
                // Rozszerz liczbę kolumn przejść jeśli nagłówek ma więcej niż tabela
                const _maxNeeded = Math.max(
                    ...Object.values(_semanticMap).map((c) => Math.floor((c - 7) / 4)),
                    -1
                );
                if (_maxNeeded >= 0) {
                    const _needTr = _maxNeeded + 1;
                    const _curTr =
                        (_excelMaxTransitions && _excelMaxTransitions[_excelActiveTab]) || 1;
                    if (_needTr > _curTr) {
                        _excelMaxTransitions[_excelActiveTab] = _needTr;
                        // Upewnij się że wells mają przejścia dla nowych kolumn
                        if (typeof wells !== 'undefined')
                            wells.forEach((w) => {
                                if (!_excelWellMatchesTab(w, _excelActiveTab)) return;
                                if (!w.przejscia) w.przejscia = [];
                                while (w.przejscia.length < _needTr)
                                    w.przejscia.push(_excelCreatePrzejscie());
                            });
                        _excelRenderTable(_excelActiveTab);
                    }
                }
            }
        }
        // Fallback: dane bez nagłówka ale cała tabela (np. 7/15 kol) — zbuduj mapę pseudonagłówka
        if (!_hasHeader && lines.length > 0) {
            const _firstParts = lines[0].split('\t');
            if (_firstParts.length >= 7) {
                const _firstCell = _firstParts[0].replace(/\r/g, '').trim();
                const _isName =
                    _firstCell &&
                    /[a-zA-Z]/.test(_firstCell) &&
                    isNaN(parseFloat(_firstCell.replace(',', '.')));
                if (_isName) {
                    const _colCount = _firstParts.length;
                    let _N = 1;
                    if ((_colCount - 3) % 4 === 0) _N = (_colCount - 3) / 4;
                    else if ((_colCount - 3) % 3 === 0) _N = (_colCount - 3) / 3;
                    else _N = Math.floor((_colCount - 3) / 4) || 1;
                    const _pseudo = ['Nr Studni', 'Rz. Wlazu', 'Rz. Dna'];
                    for (let _pi = 0; _pi < _N; _pi++) {
                        if ((_colCount - 3) % 4 === 0)
                            _pseudo.push(
                                `Średnica ${_pi}`,
                                `Rz.wlot ${_pi}`,
                                `Kąt ${_pi}`,
                                `Rodzaj ${_pi}`
                            );
                        else _pseudo.push(`Średnica ${_pi}`, `Rz.wlot ${_pi}`, `Kąt ${_pi}`);
                    }
                    if (_pseudo.length === _colCount) {
                        _semanticMap = _excelBuildSemanticMap(_pseudo, _excelActiveTab || '1000');
                        _hasHeader = true;
                        const _maxNeeded2 = Math.max(
                            ...Object.values(_semanticMap).map((c) => Math.floor((c - 7) / 4)),
                            -1
                        );
                        if (_maxNeeded2 >= 0) {
                            const _needTr2 = _maxNeeded2 + 1;
                            const _curTr2 =
                                (_excelMaxTransitions && _excelMaxTransitions[_excelActiveTab]) ||
                                1;
                            if (_needTr2 > _curTr2) {
                                _excelMaxTransitions[_excelActiveTab] = _needTr2;
                                if (typeof wells !== 'undefined')
                                    wells.forEach((w) => {
                                        if (!_excelWellMatchesTab(w, _excelActiveTab)) return;
                                        if (!w.przejscia) w.przejscia = [];
                                        while (w.przejscia.length < _needTr2)
                                            w.przejscia.push(_excelCreatePrzejscie());
                                    });
                                _excelRenderTable(_excelActiveTab);
                            }
                        }
                    }
                }
            }
        }
        if (_excelSelectedCells.length > 0) {
            const cellList = [..._excelSelectedCells].sort(function (a, b) {
                return a.wIdx - b.wIdx || a.colIdx - b.colIdx;
            });
            const cellRows = {};
            cellList.forEach(function (c) {
                if (!cellRows[c.wIdx]) cellRows[c.wIdx] = [];
                cellRows[c.wIdx].push(c.colIdx);
            });
            const widxArr = Object.keys(cellRows)
                .map(Number)
                .sort(function (a, b) {
                    return a - b;
                });
            const _baseWIdx = widxArr.length > 0 ? widxArr[0] : 0;
            const _baseCols =
                widxArr.length > 0 && cellRows[_baseWIdx]
                    ? cellRows[_baseWIdx]
                    : [_excelGetPasteColIdx(rows[0])];
            /* Przy cell-selection NIE dodawaj nowych wierszy — obetnij do dostępnej liczby.
               Licz tylko WIDOCZNE wiersze o wIdx >= start (pomija wiersze ukryte filtrem) */
            const visibleRows = _excelGetVisibleRows().filter(function (r) {
                const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                return !isNaN(rWIdx) && rWIdx >= _baseWIdx;
            });
            const availableRows = visibleRows.length;
            if (lines.length > availableRows) {
                lines = lines.slice(0, availableRows);
                if (lines.length === 0) {
                    showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning');
                    return;
                }
                showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
            }
            const _firstCol = _baseCols.length > 0 ? _baseCols[0] : 0;
            /* Użyj batch/sync paste — obsłuż duże zestawy */
            _batched = lines.length > 100;
            const _pasteFn = _batched ? _excelPasteBatch : _excelPasteSync;
            _pasteFn(lines, visibleRows, _firstCol, _batched ? _finishPaste : null);
        } else if (_excelSelectedCols.length > 0) {
            const cols = [..._excelSelectedCols].sort(function (a, b) {
                return a - b;
            });
            /* Przy column-selection NIE dodawaj nowych wierszy — obetnij (tylko widoczne) */
            const visibleRows = _excelGetVisibleRows();
            if (lines.length > visibleRows.length) {
                lines = lines.slice(0, visibleRows.length);
                showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
            }
            if (_hasHeader && _semanticMap) {
                lines.forEach(function (line, i) {
                    const parts = line.split('\t');
                    for (let ci = 0; ci < parts.length; ci++) {
                        const targetCol = _semanticMap[ci];
                        if (targetCol == null) continue;
                        if (cols.indexOf(targetCol) < 0) continue;
                        const tdInner = visibleRows[i] ? visibleRows[i].children[targetCol] : null;
                        const target = tdInner ? tdInner.querySelector('input, select') : null;
                        if (!target) continue;
                        _excelSetCellValue(target, parts[ci].replace(/\r/g, '').trim());
                    }
                });
            } else {
                lines.forEach(function (line, i) {
                    const parts = line.split('	');
                    cols.forEach(function (colIdx, ci) {
                        if (ci >= parts.length) return;
                        const tdInner = visibleRows[i] ? visibleRows[i].children[colIdx] : null;
                        const target = tdInner ? tdInner.querySelector('input, select') : null;
                        if (!target) return;
                        _excelSetCellValue(target, parts[ci].replace(/\r/g, '').trim());
                    });
                });
            }
        } else {
            /* Wykryj startowy wiersz z aktywnego elementu w tabeli */
            let startWIdx = -1; // -1 = nie wykryto aktywnego wiersza
            const _ae = document.activeElement;
            if (_ae) {
                const _tr = _ae.closest('tr[data-widx]');
                if (_tr) startWIdx = parseInt(_tr.getAttribute('data-widx') || '0') || 0;
            }
            if (startWIdx < 0) {
                /* brak fokusu w konkretnym wierszu — szukaj input/select wewnatrz kontenera jako fallback */
                const focusedInput = document.querySelector(
                    '#excel-table-container input:focus, #excel-table-container select:focus, #excel-table-container .excel-sel-wrap:focus-within'
                );
                if (focusedInput) {
                    const _ftr = focusedInput.closest('tr[data-widx]');
                    if (_ftr) startWIdx = parseInt(_ftr.getAttribute('data-widx') || '0') || 0;
                }
            }
            if (startWIdx < 0) {
                /* nadal brak — paste do wszystkich istniejących wierszy od 0 */
                startWIdx = 0;
            }
            const colIdx = _excelGetPasteColIdx(
                document.querySelector('tr[data-widx="' + startWIdx + '"]') || rows[0]
            );
            /* Pomija wiersze ukryte filtrem wyszukiwarki. */
            let visibleRows = _excelGetVisibleRows().filter(function (r) {
                const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                return !isNaN(rWIdx) && rWIdx >= startWIdx;
            });
            let availableRows = visibleRows.length;
            /* Jeśli wklejamy więcej wierszy niż mamy — auto-utwórz brakujące studnie (paste z zewn. Excela).
               Dotyczy głównie paste w kolumnę nazw (colIdx 3), ale działa dla dowolnej kolumny startowej. */
            if (lines.length > availableRows) {
                if (colIdx === 3) {
                    const surplus = lines.slice(availableRows);
                    let created = 0;
                    for (let si = 0; si < surplus.length; si++) {
                        const parts = surplus[si].split('	');
                        const rawName = (parts[0] || '').replace(/\r/g, '').trim();
                        if (!rawName) continue;
                        const dn = _excelActiveTab || '1000';
                        let dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn, 10);
                        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
                        const well =
                            typeof createNewWell === 'function'
                                ? createNewWell(rawName, dnVal)
                                : {
                                      id: 'well_' + Date.now() + '_' + created + '_' + si,
                                      name: rawName,
                                      dn: dnVal,
                                      config: [],
                                      przejscia: [],
                                      rzednaWlazu: null,
                                      rzednaDna: null,
                                      kineta: 'brak',
                                      psiaBuda: false,
                                      redukcjaDN1000: false,
                                      redukcjaMinH: 2500
                                  };
                        well.name = rawName;
                        well.numer = rawName.replace(/ (PRE|UTH)$/, '');
                        if (typeof autoUpdateWellName === 'function') {
                            try {
                                autoUpdateWellName(well, wells.length);
                            } catch (_e) {}
                        }
                        wells.push(well);
                        if (typeof _excelAutoSetWlaz === 'function') {
                            try {
                                _excelAutoSetWlaz(well);
                            } catch (_e) {}
                        }
                        created++;
                    }
                    if (created > 0) {
                        if (typeof _excelGetMaxTransitions === 'function')
                            _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
                        // Re-render by dopisać wiersze do DOM przed dalszym paste reszty kolumn
                        if (typeof _excelRenderTable === 'function')
                            _excelRenderTable(_excelActiveTab);
                        // Odśwież listę widocznych po dodaniu
                        visibleRows = _excelGetVisibleRows().filter(function (r) {
                            const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                            return !isNaN(rWIdx) && rWIdx >= startWIdx;
                        });
                        availableRows = visibleRows.length;
                        // Jeśli wciąż nadmiar (np. puste nazwy), obetnij
                        if (lines.length > availableRows) {
                            lines = lines.slice(0, availableRows);
                        }
                    } else {
                        lines = lines.slice(0, availableRows);
                    }
                } else {
                    lines = lines.slice(0, availableRows);
                    if (lines.length === 0) {
                        showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning');
                        return;
                    }
                    showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
                }
            }
            /* Użyj batch/sync paste — obsłuż duże zestawy; header-aware via semantic map */
            _batched = lines.length > 100;
            if (_hasHeader && _semanticMap && Object.keys(_semanticMap).length > 0) {
                if (_batched)
                    _excelPasteSemanticBatch(lines, visibleRows, _semanticMap, _finishPaste);
                else _excelPasteSemantic(lines, visibleRows, _semanticMap);
                if (!_batched) _finishPaste();
                _batched = true; // suppress duplicate _finishPaste in finally
            } else {
                (_batched ? _excelPasteBatch : _excelPasteSync)(
                    lines,
                    visibleRows,
                    colIdx,
                    _batched ? _finishPaste : null
                );
            }
        }
    } finally {
        /* Batch (async, >100 wierszy) finalizuje flagę + re-render w doneCallback
           (_excelPasteBatch) — inaczej guard _excelPasteInProgress wygasłby przed
           pierwszym tickiem i każda komórka pchała osobny snapshot undo. */
        if (!_batched) _finishPaste();
    }
    showToast('Wklejono', 'info');
}

/* ===== BATCH PASTE (async chunked) ===== */
function _excelShowPasteProgress(now, total) {
    const pct = Math.min(100, Math.round((now / total) * 100));
    let el = document.getElementById('excel-paste-progress');
    if (!el) {
        el = document.createElement('div');
        el.id = 'excel-paste-progress';
        el.style.cssText =
            'position:fixed;bottom:1rem;right:1rem;z-index:' +
            LAYERS.TOAST +
            ';background:var(--bg-card);border:1px solid rgba(var(--white-rgb), 0.1);border-radius: var(--radius-sm);padding:0.75rem 1rem;min-width:260px;box-shadow:0 4px 20px rgba(var(--black-rgb), 0.5);';
        el.innerHTML =
            '<div style="font-size: var(--fs-xs);color:var(--slate-400);margin-bottom:0.35rem;">Wklejanie... <span id="excel-paste-pct">0%</span></div>' +
            '<div style="height:4px;background:var(--slate-950);border-radius:2px;overflow:hidden;">' +
            '<div id="excel-paste-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),var(--success));transition:width 0.15s;"></div></div>';
        document.body.appendChild(el);
    }
    const bar = document.getElementById('excel-paste-bar');
    const pctEl = document.getElementById('excel-paste-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
}

function _excelHidePasteProgress() {
    const el = document.getElementById('excel-paste-progress');
    if (el) el.remove();
}

function _excelCancelPasteBatch() {
    if (_excelPasteRafId !== null) {
        cancelAnimationFrame(_excelPasteRafId);
        _excelPasteRafId = null;
    }
    _excelHidePasteProgress();
    _excelPasteInProgress = false;
    _excelBatchKragTouched = false;
}

/**
 * Wkleja dane wsadowo w chunkach przez requestAnimationFrame.
 * Nie blokuje UI.
 * @param {string[]} lines
 * @param {HTMLElement[]} visibleRows — widoczne wiersze docelowe (pomijają display:none)
 * @param {number} startColIdx
 * @param {Function|null} doneCallback
 */
function _excelPasteBatch(lines, visibleRows, startColIdx, doneCallback) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    if (total < 100) {
        _excelPasteSync(lines, visibleRows, startColIdx);
        if (doneCallback) doneCallback();
        return;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        if (!document.getElementById('excel-table-overlay')) {
            _excelCancelPasteBatch();
            return;
        }
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            const line = lines[idx];
            const parts = line.split('	');
            const row = visibleRows[idx];
            if (!row) continue;
            parts.forEach(function (v, ci) {
                const colIdx = startColIdx + ci;
                const tdEl = row.children[colIdx];
                const target = tdEl ? tdEl.querySelector('input, select') : null;
                if (target) _excelSetCellValue(target, v.replace(/\r/g, '').trim());
            });
        }
        _excelShowPasteProgress(idx, total);
        if (idx < total) {
            _excelPasteRafId = requestAnimationFrame(tick);
        } else {
            _excelPasteRafId = null;
            _excelHidePasteProgress();
            if (doneCallback) doneCallback();
        }
    }
    _excelPasteRafId = requestAnimationFrame(tick);
}

/** Synchroniczne wklejenie (do 99 wierszy).
 * @param {string[]} lines
 * @param {HTMLElement[]} visibleRows — widoczne wiersze docelowe (pomijają display:none)
 * @param {number} startColIdx
 */
function _excelPasteSync(lines, visibleRows, startColIdx) {
    for (let si = 0; si < lines.length; si++) {
        const parts = lines[si].split('	');
        const row = visibleRows[si];
        if (!row) continue;
        parts.forEach(function (v, ci) {
            const colIdx = startColIdx + ci;
            const tdEl = row.children[colIdx];
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, v.replace(/\r/g, '').trim());
        });
    }
}

/**
 * Ustawia wartość komórki (input lub select) i dispatchuje eventy.
 * @param {Element} target
 * @param {string} val
 */
function _excelSetCellValue(target, val) {
    /* Centralny punkt mutacji — blokada studni z PZ accepted / zamówieniem.
       Obejmuje paste, Delete, Ctrl+X, Ctrl+D, Ctrl+R (wszystkie ida przez to miejsce). */
    const tr = target && target.closest ? target.closest('tr[data-widx]') : null;
    const wIdx = tr ? parseInt(tr.getAttribute('data-widx'), 10) : -1;
    if (!isNaN(wIdx) && _excelIsWellLocked(wIdx)) return;
    const td = target && target.closest ? target.closest('td') : null;
    const colIdx =
        td && td.parentElement ? Array.prototype.indexOf.call(td.parentElement.children, td) : -1;
    /* Nazwa studni (colIdx 3) — przez paste/fill dozwolona (excelOnNameChange logic), blokuj tylko delete/cut (pusty val). */
    if (colIdx === 3) {
        const clean = String(val || '')
            .replace(/\r/g, '')
            .trim();
        if (!clean) return;
        if (isNaN(wIdx) || !wells[wIdx]) return;
        const well = wells[wIdx];
        well.name = clean;
        well.numer = clean.replace(/ (PRE|UTH)$/, '');
        if (typeof autoUpdateWellName === 'function') {
            try {
                autoUpdateWellName(well, wIdx);
            } catch (_e) {}
        }
        if (typeof _excelMarkDirty === 'function') {
            try {
                _excelMarkDirty();
            } catch (_e) {}
        }
        return;
    }
    if (target.tagName === 'SELECT') {
        const _sel = /** @type {HTMLSelectElement} */ (target);
        let opt = Array.from(_sel.options).find(function (o) {
            return o.value === val || o.text === val;
        });
        if (!opt) {
            const normVal = String(val).trim().toLowerCase();
            opt = Array.from(_sel.options).find(function (o) {
                return o.text.trim().toLowerCase() === normVal;
            });
        }
        if (!opt) {
            const numVal = String(val).replace(/\D/g, '');
            if (numVal) {
                opt = Array.from(_sel.options).find(function (o) {
                    return (
                        o.text.replace(/\D/g, '') === numVal ||
                        o.value.replace(/\D/g, '') === numVal
                    );
                });
            }
        }
        // Najbliższa opcja gdy brak dokładnego dopasowania — wybierz closest i pokaż popup do weryfikacji
        let isClosest = false;
        if (!opt) {
            const closest = _excelFindClosestOption(_sel.options, val);
            if (closest) {
                opt = closest;
                isClosest = true;
            }
        }
        if (opt) {
            const isExact =
                String(val).trim().toLowerCase() === opt.text.trim().toLowerCase() ||
                String(val).trim() === opt.value;
            if (isClosest || !isExact) {
                const wellForName =
                    !isNaN(wIdx) && wells[wIdx]
                        ? wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '')
                        : '';
                _excelRecordMismatch({
                    wIdx: wIdx,
                    colIdx: colIdx,
                    wellName: wellForName,
                    originalVal: String(val),
                    matchedVal: opt.value,
                    matchedText: opt.text,
                    options: Array.from(_sel.options).map((o) => ({ value: o.value, text: o.text }))
                });
            }
            _sel.value = opt.value;
            _sel.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (!isNaN(wIdx) && wells[wIdx] && colIdx >= 7) {
            const valStr = String(val).trim();
            if (!valStr) return;
            /* Fallback dla selectów wklejanych w trakcie batch/paste: jeśli opcji nie ma w obecnym stanie,
               znajdź produkt w studnieProducts i ustaw w modelu przejście. */
            const trIdx = Math.floor((colIdx - 7) / 4);
            const subType = (colIdx - 7) % 4; // 0: rzedna, 1: angle, 2: category, 3: productId
            if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
            while (wells[wIdx].przejscia.length <= trIdx) {
                if (typeof _excelCreatePrzejscie === 'function')
                    wells[wIdx].przejscia.push(_excelCreatePrzejscie());
            }
            const prz = wells[wIdx].przejscia[trIdx];
            if (subType === 2) {
                // Rodzaj przejścia (category) — najbliższy
                let catToSet = valStr;
                let isClosest = false;
                if (typeof studnieProducts !== 'undefined') {
                    const cats = [
                        ...new Set(
                            studnieProducts
                                .filter((p) => p.componentType === 'przejscie')
                                .map((p) => p.category)
                        )
                    ];
                    const closest = _excelFindClosestCategory(valStr, cats);
                    if (closest && closest.toLowerCase() !== valStr.toLowerCase()) {
                        catToSet = closest;
                        isClosest = true;
                    }
                }
                prz.tempCategory = catToSet;
                if (isClosest) {
                    const catOpts =
                        typeof studnieProducts !== 'undefined'
                            ? [
                                  ...new Set(
                                      studnieProducts
                                          .filter((p) => p.componentType === 'przejscie')
                                          .map((p) => ({ value: p.category, text: p.category }))
                                  )
                              ]
                            : [];
                    const wellForName2 = wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                    _excelRecordMismatch({
                        wIdx: wIdx,
                        colIdx: colIdx,
                        wellName: wellForName2,
                        originalVal: valStr,
                        matchedVal: catToSet,
                        matchedText: catToSet,
                        options: catOpts
                    });
                }
            } else if (subType === 3) {
                // Średnica (productId/DN) — najbliższa
                const valStr = String(val).trim();
                const numVal = valStr.replace(/\D/g, '');
                let matched = null;
                if (typeof studnieProducts !== 'undefined') {
                    const pool = studnieProducts.filter((p) => p.componentType === 'przejscie');
                    let exact = pool.find((p) => p.id === valStr || p.name === valStr);
                    if (!exact && numVal)
                        exact = pool.find(
                            (p) => String(p.dn) === numVal || p.name.indexOf(numVal) >= 0
                        );
                    matched = exact || _excelFindClosestProduct(valStr, pool);
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                        const isExact =
                            matched.id === valStr ||
                            matched.name === valStr ||
                            String(matched.dn) === numVal;
                        if (!isExact) {
                            const opts = pool.map((p) => ({
                                value: p.id,
                                text: p.name || 'DN ' + p.dn
                            }));
                            const wellForName3 =
                                wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                            _excelRecordMismatch({
                                wIdx: wIdx,
                                colIdx: colIdx,
                                wellName: wellForName3,
                                originalVal: valStr,
                                matchedVal: matched.id,
                                matchedText: matched.name || 'DN ' + matched.dn,
                                options: opts
                            });
                        }
                    }
                }
            }
        }
    } else if (target.tagName === 'INPUT') {
        /* Normalizuj separator dziesietny — MS Excel z PL wysyla przecinek, input type=number wymaga kropki */
        let normalizedVal = val;
        const inputType = /** @type {HTMLInputElement} */ (target).type;
        if (
            inputType === 'number' &&
            typeof normalizedVal === 'string' &&
            normalizedVal.indexOf(',') >= 0 &&
            normalizedVal.indexOf('.') < 0
        ) {
            normalizedVal = normalizedVal.replace(',', '.');
        }
        /** @type {HTMLInputElement} */ (target).value = normalizedVal;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/* ===== FILL ZAZNACZENIA (Ctrl+Enter) ===== */

/* Czysta funkcja budująca plan wypełnienia — bez DOM, testowalna.
   Pomija: kolumny strukturalne + nazwę (colIdx <= 3), aktywną komórkę
   (źródło wartości), wiersze ukryte filtrem (rowsMeta[w].hidden) i
   zablokowane (rowsMeta[w].locked). Zwraca posortowane, zdduplikowane komórki. */
function _excelBuildFillPlan(opts) {
    const cells = opts && opts.cells ? opts.cells : [];
    const cols = opts && opts.cols ? opts.cols : [];
    const active = opts && opts.active ? opts.active : null;
    const rowsMeta = (opts && opts.rowsMeta) || {};
    const plan = [];
    const seen = {};
    const add = function (wIdx, colIdx) {
        if (colIdx <= 3) return; /* strukturalne + nazwa studni — nigdy */
        const meta = rowsMeta[wIdx] || {};
        if (meta.hidden || meta.locked) return;
        if (active && wIdx === active.wIdx && colIdx === active.colIdx) return;
        const key = wIdx + ':' + colIdx;
        if (seen[key]) return;
        seen[key] = true;
        plan.push({ wIdx: wIdx, colIdx: colIdx });
    };
    cells.forEach(function (c) {
        add(c.wIdx, c.colIdx);
    });
    cols.forEach(function (ci) {
        Object.keys(rowsMeta).forEach(function (wk) {
            const wIdx = parseInt(wk, 10);
            if (!isNaN(wIdx)) add(wIdx, ci);
        });
    });
    plan.sort(function (a, b) {
        return a.wIdx - b.wIdx || a.colIdx - b.colIdx;
    });
    return plan;
}

/* Wypełnia zaznaczony zakres wartością komórki aktywnej (Ctrl+Enter).
   Jeden snapshot undo + flaga _excelPasteInProgress (wzorzec wklejania, #29). */
function _excelHandleFillDown() {
    if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
    const activeEl = document.activeElement;
    let value = undefined;
    if (activeEl) {
        if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT') {
            /* Źródło NIE może być checkboxem (wartość "on") ani kolumną
               strukturalną (checkbox 0, A/M 1, Lp 2, nazwa 3) — nadpisałoby
               komórki danych bezsensowną wartością (S1). */
            if (activeEl.tagName === 'INPUT' && activeEl.type === 'checkbox') return;
            const srcTd = activeEl.closest('td');
            let srcColIdx = -1;
            if (srcTd && srcTd.parentElement) {
                srcColIdx = Array.from(srcTd.parentElement.children).indexOf(srcTd);
            }
            if (srcColIdx >= 0 && srcColIdx <= 3) return;
            value = /** @type {HTMLInputElement | HTMLSelectElement} */ (activeEl).value;
        } else {
            const wrap = activeEl.closest ? activeEl.closest('td') : null;
            if (wrap) {
                const t = wrap.querySelector('input, select');
                if (t) value = /** @type {HTMLInputElement | HTMLSelectElement} */ (t).value;
            }
        }
    }
    if (value === undefined) return;
    /* rowsMeta: ukrycie filtrem + blokada PZ per wiersz */
    const rowsMeta = {};
    document.querySelectorAll('#excel-table-container tbody tr[data-widx]').forEach(function (row) {
        const wIdx = parseInt(row.getAttribute('data-widx'), 10);
        if (isNaN(wIdx)) return;
        rowsMeta[wIdx] = {
            hidden: row.style.display === 'none',
            locked: typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(wIdx)
        };
    });
    const active =
        _excelLastClickedCell && _excelLastClickedCell.wIdx !== undefined
            ? _excelLastClickedCell
            : null;
    const plan = _excelBuildFillPlan({
        cells: _excelSelectedCells,
        cols: _excelSelectedCols,
        active: active,
        rowsMeta: rowsMeta
    });
    if (plan.length === 0) return;
    if (typeof _excelBatchKragTouched !== 'undefined') _excelBatchKragTouched = false;
    _excelSaveUndoSnapshot();
    _excelPasteInProgress = true;
    try {
        plan.forEach(function (cell) {
            const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            const td = row.children[cell.colIdx];
            const target = td ? td.querySelector('input, select') : null;
            if (target) _excelSetCellValue(target, value);
        });
        /* Krag/krag_ot: jeden pełny render po całym fill (konwersja musi pokazać
           finalny config), zamiast re-rendera po każdej komórce (H1). */
        if (typeof _excelBatchKragTouched !== 'undefined' && _excelBatchKragTouched) {
            _excelBatchKragTouched = false;
            if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
        }
        _excelDebouncedRefresh();
        showToast('Wypełniono ' + plan.length + ' komórek', 'info');
    } finally {
        _excelPasteInProgress = false;
    }
}
