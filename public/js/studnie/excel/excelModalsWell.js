// @ts-check
/* ===== EXCEL MODALS — Operacje na studniach (zamykanie, selekcja, parametry, dodawanie) ===== */

function closeExcelTableModal() {
    if (_excelDirty && typeof appConfirm === 'function') {
        if (!appConfirm('Są niezapisane zmiany. Czy na pewno zamknąć?')) return;
    }
    _excelStopPolling();
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) {
        if (/** @type {any} */ (overlay)._resizeHandler) {
            window.removeEventListener('resize', /** @type {any} */ (overlay)._resizeHandler);
        }
        var _container = document.getElementById('excel-table-container');
        if (_container && /** @type {any} */ (_container)._arrowHandler) {
            document.removeEventListener(
                'keydown',
                /** @type {any} */ (_container)._arrowHandler,
                true
            );
        }
        document.removeEventListener('copy', _excelHandleCopy);
        document.removeEventListener('paste', _excelHandlePaste);
        if (_container) _container.removeEventListener('paste', _excelHandlePaste, true);
        if (_container) _container.removeEventListener('mousedown', _excelOnMouseDown);
        document.removeEventListener('mousemove', _excelOnMouseMove);
        document.removeEventListener('mouseup', _excelOnMouseUp);
        if (_container) {
            _container.removeEventListener('focusin', _excelOnFocusIn);
            _container.removeEventListener('focusout', _excelOnFocusOut);
            _container.removeEventListener('change', _excelOnRowSelectChange);
        }
        document.removeEventListener('scroll', _excelOnOverlayScroll, true);
        window.removeEventListener('resize', _excelOnOverlayScroll);
        if (_excelFocusOverlayEl) _excelFocusOverlayEl.style.display = 'none';
        overlay.remove();
    }
    _excelDirty = false;
}

function excelSelectRow(wIdx) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const prevIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    currentWellIndex = wIdx;

    if (prevIdx >= 0) {
        const prevRow = container.querySelector(`tr[data-widx="${prevIdx}"]`);
        if (prevRow) {
            const base = prevRow.getAttribute('data-base-bg');
            if (base) {
                prevRow.style.background = base;
                prevRow.setAttribute('data-orig-bg', base);
            }
            var prevStickyTds = prevRow.querySelectorAll('td:nth-child(-n+5)');
            var baseBg = prevRow.getAttribute('data-base-bg') || '#0a0d16';
            prevStickyTds.forEach(function (td) {
                td.style.background = baseBg;
            });
        }
    }

    const newRow = container.querySelector(`tr[data-widx="${wIdx}"]`);
    if (newRow) {
        const activeBg = newRow.getAttribute('data-active-bg');
        if (activeBg) {
            newRow.style.background = activeBg;
            newRow.setAttribute('data-orig-bg', activeBg);
            var stickyTds = newRow.querySelectorAll('td:nth-child(-n+5)');
            stickyTds.forEach(function (td) {
                td.style.background = activeBg;
            });
        }
    }

    _excelUpdateLeftPreview(wIdx);
    _excelUpdateHeaderProdCodes();
}

function _excelUpdateLeftPreview(wIdx) {
    const well = typeof wells !== 'undefined' && wells[wIdx] ? wells[wIdx] : null;
    if (!well) return;
    if (typeof currentWellIndex !== 'undefined') {
        currentWellIndex = wIdx;
    }
    if (typeof renderWellDiagram === 'function') {
        renderWellDiagram();
    }
}

function excelOpenWellParams(wIdx) {
    const well = wells[wIdx];
    if (!well) return;

    const existing = document.getElementById('excel-params-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-params-popup';
    overlay.style.cssText =
        'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    const maxOptions = Math.max(...WELL_PARAM_DEFS.map((d) => d.options.length));
    const TILE_W = 90;
    const gapPx = 5.6;
    const gridW = maxOptions * TILE_W + (maxOptions - 1) * gapPx;
    const popupW = Math.min(Math.round(gridW + 185 + 42), 1200);

    const modal = document.createElement('div');
    modal.style.cssText = `width:${popupW}px;max-height:90vh;background:var(--bg-primary);border:1px solid rgba(255,255,255,0.06);border-radius:6px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);`;

    let bodyHtml = `<div style="display:flex;flex-direction:column;gap:0.55rem;">`;
    if (typeof WELL_PARAM_DEFS !== 'undefined') {
        const isOsadnik = typeof isSettlingWell === 'function' && isSettlingWell(well);
        WELL_PARAM_DEFS.forEach((def) => {
            if (
                def.key === 'precoFullHeight' &&
                well.kineta !== 'preco' &&
                well.kineta !== 'precotop'
            )
                return;

            let isGreyedOut = false;
            if (def.key === 'wkladkaOsadnikPreco' && !isOsadnik) isGreyedOut = true;
            if (def.key === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop'))
                isGreyedOut = true;
            if (
                well.wkladkaOsadnikPreco === 'tak' &&
                (def.key === 'kineta' || def.key === 'spocznik')
            )
                return;

            const currentVal = well[def.key] || '';
            bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;${isGreyedOut ? 'opacity:0.5;' : ''}">`;
            bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">${def.label}</span>`;
            const cols = def.options.length;
            bodyHtml += `<div style="display:grid;grid-template-columns:repeat(${cols}, ${TILE_W}px);gap:0.35rem;flex:1;">`;
            def.options.forEach(([val, lbl]) => {
                const active = val === currentVal;
                bodyHtml += `<button data-action="excelUpdateWellParam" data-active="${active}" data-w-idx="${wIdx}" data-param-key="${def.key}" data-param-val="${val}" style="height:34px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:${active ? '800' : '600'};border:1px solid ${active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};background:${active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'};color:${active ? '#a5b4fc' : 'var(--text-secondary)'};display:flex;align-items:center;justify-content:center;${active ? 'box-shadow:0 0 10px rgba(99,102,241,0.2);' : ''}">${lbl}</button>`;
            });
            bodyHtml += `</div></div>`;

            if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. wew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameW || '')}" data-select-on-click="true" data-action="excelUpdateWellParamAndRefresh" data-param-field="powlokaNameW" data-w-idx="${wIdx}" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. wew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" data-select-on-click="true" data-action="excelUpdateWellParamAndRefresh" data-param-field="malowanieWewCena" data-w-idx="${wIdx}" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
            if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. zew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameZ || '')}" data-select-on-click="true" data-action="excelUpdateWellParamAndRefresh" data-param-field="powlokaNameZ" data-w-idx="${wIdx}" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. zew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" data-select-on-click="true" data-action="excelUpdateWellParamAndRefresh" data-param-field="malowanieZewCena" data-w-idx="${wIdx}" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
        });
    }
    bodyHtml += `</div>`;

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">Parametry: ${escapeHtml(well.name)}</span>
            <button data-action="closeExcelParamsPopup" style="background:#13151f;color:var(--text-muted);border:none;cursor:pointer;font-size:1.1rem;">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0.8rem;">
            ${bodyHtml}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.5rem 0.8rem;background:#10131a;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <button data-action="closeExcelParamsPopup" style="background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid rgba(255,255,255,0.1);padding:0.4rem 1.2rem;border-radius:6px;font-size:0.8rem;cursor:pointer;font-weight:600;">Zamknij</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function excelRefreshParamsPopup(wIdx) {
    _excelDebouncedRefresh();
    _excelRenderTable(_excelActiveTab);
    const existing = document.getElementById('excel-params-popup');
    if (existing) {
        existing.remove();
        excelOpenWellParams(wIdx);
    }
}

function excelShowAddDialog() {
    var dns = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
    var dnOpts = dns
        .map(function (d) {
            var label = d === 'styczne' ? 'Styczna' : 'DN' + d;
            var sel =
                d === _excelActiveTab || (d === 'styczne' && _excelActiveTab === 'styczne')
                    ? ' selected'
                    : '';
            return '<option value="' + d + '"' + sel + '>' + label + '</option>';
        })
        .join('');

    var html =
        '<div id="excel-add-dialog-overlay" style="position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:1.2rem;min-width:380px;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;"><strong style="color:#e2e8f0;font-size:0.75rem;">Dodaj studnię</strong>' +
        '<button data-action="closeExcelAddDialog" style="background:none;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;">✕</button></div>' +
        '<div style="display:grid;grid-template-columns:80px 1fr;gap:0.5rem 0.7rem;font-size:0.65rem;color:#94a3b8;margin-bottom:1rem;">' +
        '<label>Nazwa</label><input id="dlg-name" type="text" placeholder="np. a1" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '<label>DN</label><select id="dlg-dn" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;">' +
        dnOpts +
        '</select>' +
        '<label>Rz. włazu</label><input id="dlg-rzw" type="number" step="0.01" placeholder="np. 5.00" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '<label>Rz. dna</label><input id="dlg-rzd" type="number" step="0.01" placeholder="np. 0.00" value="0" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '</div>' +
        '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:0.7rem;display:flex;gap:0.5rem;justify-content:flex-end;">' +
        '<button data-action="closeExcelAddDialog" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#94a3b8;font-size:0.65rem;cursor:pointer;">Anuluj</button>' +
        '<button data-action="_excelCreateFromDialog" style="padding:0.3rem 1rem;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.3);border-radius:3px;color:#6ee7b7;font-size:0.65rem;font-weight:700;cursor:pointer;">Dodaj</button>' +
        '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(function () {
        var inp = document.getElementById('dlg-name');
        if (inp) inp.focus();
    }, 100);
    var container = document.getElementById('excel-add-dialog-overlay');
    if (container) {
        container.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') _excelCreateFromDialog();
            if (e.key === 'Escape') container.remove();
        });
    }
}

function excelShowPasteDialog() {
    if (!document.getElementById('excel-table-overlay')) return;
    var html =
        '<div id="excel-paste-dialog-overlay" style="position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:1.2rem;min-width:420px;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;"><strong style="color:#e2e8f0;font-size:0.75rem;">Wklej listę studni</strong>' +
        '<button data-action="closeExcelPasteDialog" style="background:none;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;">✕</button></div>' +
        '<div style="font-size:0.6rem;color:#64748b;margin-bottom:0.5rem;">Wklej dane z arkusza (TAB, przecinek, średnik, | lub odstęp)</div>' +
        '<textarea id="paste-textarea" style="width:100%;height:140px;padding:0.5rem;background:#0c0e14;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;font-family:Consolas,Menlo,monospace;resize:vertical;white-space:pre;tab-size:2;" placeholder="Nazwa\tDN\tRz.włazu\tRz.dna\na1\t1000\t5.00\t0.00\na2\t1000\t4.50\t0.00"></textarea>' +
        '<div id="paste-preview" style="font-size:0.6rem;color:#64748b;max-height:60px;overflow-y:auto;margin:0.3rem 0;padding:0.2rem;background:#0c0e14;border-radius:3px;"></div>' +
        '<div style="display:flex;gap:0.5rem;justify-content:flex-end;">' +
        '<button data-action="closeExcelPasteDialog" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#94a3b8;font-size:0.65rem;cursor:pointer;">Anuluj</button>' +
        '<button data-action="_excelImportPasteList" style="padding:0.3rem 1rem;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);border-radius:3px;color:#93c5fd;font-size:0.65rem;font-weight:700;cursor:pointer;">Importuj</button>' +
        '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    var ta = document.getElementById('paste-textarea');
    if (ta) {
        ta.addEventListener('input', _excelUpdatePastePreview);
        ta.focus();
    }
    var c = document.getElementById('excel-paste-dialog-overlay');
    if (c)
        c.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') c.remove();
        });
}

function _excelCreateFromDialog() {
    var name = (document.getElementById('dlg-name')?.value || '').trim();
    var dn = document.getElementById('dlg-dn')?.value || '1000';
    var rzwParsed = parseDecimal(document.getElementById('dlg-rzw')?.value);
    var rzdParsed = parseDecimal(document.getElementById('dlg-rzd')?.value);
    var rzw = isNaN(rzwParsed) ? null : rzwParsed;
    var rzd = isNaN(rzdParsed) ? null : rzdParsed;
    if (!name) {
        showToast('Podaj nazwę studni', 'error');
        return;
    }
    if (
        wells.some(function (w) {
            return w.name === name;
        })
    ) {
        showToast('Nazwa "' + name + '" już istnieje', 'error');
        return;
    }
    if (rzw === null) {
        showToast('Podaj rządną włazu', 'error');
        return;
    }
    if (rzd === null) rzd = 0;
    if (rzw <= rzd) {
        showToast('Rzędna włazu musi być > rzędnej dna', 'error');
        return;
    }
    var dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn);
    var well =
        typeof createNewWell === 'function'
            ? createNewWell(name, dnVal)
            : {
                  id: 'well_' + Date.now(),
                  name: name,
                  dn: dnVal,
                  config: [],
                  przejscia: [],
                  rzednaWlazu: rzw,
                  rzednaDna: rzd,
                  kineta: 'brak',
                  psiaBuda: false,
                  redukcjaDN1000: false,
                  redukcjaMinH: 2500
              };
    well.name = name;
    well.rzednaWlazu = rzw;
    well.rzednaDna = rzd;
    wells.push(well);
    _excelAutoSetWlaz(well);
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    var overlay = document.getElementById('excel-add-dialog-overlay');
    if (overlay) overlay.remove();
    var newWIdx = wells.length - 1;
    if (_excelAutoSelectEnabled && rzw != null && rzd != null) {
        setTimeout(function () {
            _excelAutoSelectForWell(newWIdx);
        }, 100);
    }
    setTimeout(function () {
        excelSelectRow(newWIdx);
    }, 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + name, 'success');
}

function excelCreateFromEmpty() {
    if (_excelCreatingLock) return;
    _excelCreatingLock = true;

    const nameEl = document.getElementById('excel-empty-name');
    const rzwEl = document.getElementById('excel-empty-rzw');
    const rzdEl = document.getElementById('excel-empty-rzd');
    if (!nameEl) {
        _excelCreatingLock = false;
        return;
    }

    const name = (nameEl.value || '').trim();
    const rzwRaw = rzwEl ? rzwEl.value : '';
    const rzdRaw = rzdEl ? rzdEl.value : '';
    const rzw = rzwRaw !== '' ? parseDecimal(rzwRaw) : null;
    const rzd = rzdRaw !== '' ? parseDecimal(rzdRaw) : null;

    if (!name && rzw === null && rzd === null) {
        _excelCreatingLock = false;
        return;
    }

    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);
    const autoName =
        name ||
        (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
            ' (#' +
            (wells.length + 1) +
            ')';

    let well;
    try {
        if (typeof createNewWell === 'function') {
            well = createNewWell(autoName, /** @type {any} */ (dn));
            if (name) {
                well.numer = name;
                well.name = name;
            }
        } else {
            well = {
                id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                name: autoName,
                dn: dn,
                config: [],
                przejscia: [],
                rzednaWlazu: rzw,
                rzednaDna: rzd,
                kineta: 'brak',
                psiaBuda: false,
                redukcjaDN1000: false,
                redukcjaMinH: 2500
            };
        }
        if (rzw !== null) well.rzednaWlazu = rzw;
        if (rzd !== null) well.rzednaDna = rzd;

        wells.push(well);
        _excelAutoSetWlaz(well);
        _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
        _excelRenderTabs();
        _excelRenderTable(_excelActiveTab);
        _excelUpdateWellCount();
        _excelDebouncedRefresh();
        var newWIdx = wells.length - 1;
        if (_excelAutoSelectEnabled && rzw !== null && rzd !== null && rzw > rzd) {
            setTimeout(function () {
                _excelAutoSelectForWell(newWIdx);
            }, 200);
        }
        showToast('Dodano: ' + autoName, 'success');
    } finally {
        setTimeout(() => {
            _excelCreatingLock = false;
            const newIdx = wells.length - 1;
            const row = document.querySelector(`tr[data-widx="${newIdx}"]`);
            const rzwEl = row && row.querySelector('input[data-field="rzednaWlazu"]');
            if (rzwEl) {
                rzwEl.focus();
                rzwEl.select();
            }
        }, 100);
    }
}

function excelSwitchTab(tab) {
    _excelActiveTab = tab;
    _excelRenderTabs();
    _excelRenderTable(tab);
    _excelUpdateHeaderProdCodes();
    if (typeof wells !== 'undefined' && wells.length > 0) {
        var hasWellsInTab = false;
        for (var _st = 0; _st < wells.length; _st++) {
            if (_excelWellMatchesTab(wells[_st], tab)) {
                hasWellsInTab = true;
                break;
            }
        }
        if (!hasWellsInTab) {
            setTimeout(function () {
                var nameEl = document.getElementById('excel-empty-name');
                if (nameEl) nameEl.focus();
            }, 150);
        }
    }
}

function excelAddWellToTab() {
    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);

    let well;
    if (typeof createNewWell === 'function') {
        well = createNewWell(null, /** @type {any} */ (dn));
    } else {
        well = {
            id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            name:
                (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
                ' (#' +
                (wells.length + 1) +
                ')',
            dn: dn,
            config: [],
            przejscia: [],
            rzednaWlazu: null,
            rzednaDna: null,
            kineta: 'brak',
            psiaBuda: false,
            redukcjaDN1000: false,
            redukcjaMinH: 2500
        };
    }

    wells.push(well);
    _excelAutoSetWlaz(well);
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    const newWIdx = wells.length - 1;
    setTimeout(() => excelSelectRow(newWIdx), 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + well.name, 'success');
}
