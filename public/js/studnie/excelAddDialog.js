// @ts-check
/* ===== EXCEL ADD DIALOG — Okienka dialogowe dodawania studni ===== */

/* ===== DROPDOWN MENU DODAJ ===== */
function _excelToggleAddMenu() {
    var menu = document.getElementById('excel-add-dropdown');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    if (menu.style.display === 'block') {
        var close = function (e) {
            if (!e.target.closest('#excel-add-menu-container')) {
                menu.style.display = 'none';
                document.removeEventListener('click', close);
            }
        };
        setTimeout(function () {
            document.addEventListener('click', close);
        }, 10);
    }
}

/* ===== DODAWANIE RĘCZNE — DIALOG ===== */
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
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">' +
        '<strong style="color:#e2e8f0;font-size:0.75rem;">Dodaj studnię</strong>' +
        '<button onclick="document.getElementById(\'excel-add-dialog-overlay\').remove()" style="background:none;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:80px 1fr;gap:0.5rem 0.7rem;font-size:0.65rem;color:#94a3b8;margin-bottom:1rem;">' +
        '<label>Nazwa</label><input id="dlg-name" type="text" placeholder="np. a1" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '<label>DN</label><select id="dlg-dn" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;">' +
        dnOpts +
        '</select>' +
        '<label>Rz. włazu</label><input id="dlg-rzw" type="number" step="0.01" placeholder="np. 5.00" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '<label>Rz. dna</label><input id="dlg-rzd" type="number" step="0.01" placeholder="np. 0.00" value="0" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '</div>' +
        '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:0.7rem;display:flex;gap:0.5rem;justify-content:flex-end;">' +
        '<button onclick="document.getElementById(\'excel-add-dialog-overlay\').remove()" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#94a3b8;font-size:0.65rem;cursor:pointer;">Anuluj</button>' +
        '<button onclick="_excelCreateFromDialog()" style="padding:0.3rem 1rem;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.3);border-radius:3px;color:#6ee7b7;font-size:0.65rem;font-weight:700;cursor:pointer;">Dodaj</button>' +
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

function _excelCreateFromDialog() {
    var name = (document.getElementById('dlg-name')?.value || '').trim();
    var dn = document.getElementById('dlg-dn')?.value || '1000';
    var rzwParsed = parseFloat(document.getElementById('dlg-rzw')?.value);
    var rzdParsed = parseFloat(document.getElementById('dlg-rzd')?.value);
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

/* ===== WKLEJ LISTĘ STUDNI ===== */
function excelShowPasteDialog() {
    if (!document.getElementById('excel-table-overlay')) return;
    var html =
        '<div id="excel-paste-dialog-overlay" style="position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:1.2rem;min-width:420px;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;">' +
        '<strong style="color:#e2e8f0;font-size:0.75rem;">Wklej listę studni</strong>' +
        '<button onclick="document.getElementById(\'excel-paste-dialog-overlay\').remove()" style="background:none;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="font-size:0.6rem;color:#64748b;margin-bottom:0.5rem;">Wklej dane z arkusza (TAB, przecinek, średnik, | lub odstęp)</div>' +
        '<textarea id="paste-textarea" style="width:100%;height:140px;padding:0.5rem;background:#0c0e14;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;font-family:Consolas,Menlo,monospace;resize:vertical;white-space:pre;tab-size:2;" placeholder="Nazwa	DN	Rz.włazu	Rz.dna&#10;a1	1000	5.00	0.00&#10;a2	1000	4.50	0.00"></textarea>' +
        '<div id="paste-preview" style="font-size:0.6rem;color:#64748b;max-height:60px;overflow-y:auto;margin:0.3rem 0;padding:0.2rem;background:#0c0e14;border-radius:3px;"></div>' +
        '<div style="display:flex;gap:0.5rem;justify-content:flex-end;">' +
        '<button onclick="document.getElementById(\'excel-paste-dialog-overlay\').remove()" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#94a3b8;font-size:0.65rem;cursor:pointer;">Anuluj</button>' +
        '<button onclick="_excelImportPasteList()" style="padding:0.3rem 1rem;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);border-radius:3px;color:#93c5fd;font-size:0.65rem;font-weight:700;cursor:pointer;">Importuj</button>' +
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

function _excelUpdatePastePreview() {
    var ta = document.getElementById('paste-textarea');
    var prev = document.getElementById('paste-preview');
    if (!ta || !prev) return;
    var text = ta.value.trim();
    if (!text) {
        prev.textContent = '';
        return;
    }
    var rows = _excelParsePasteData(text);
    prev.innerHTML =
        rows.length > 0
            ? 'Rozpoznano <strong>' + rows.length + '</strong> studni'
            : '(brak danych)';
}

function _excelParsePasteData(text) {
    var lines = text
        .split('\n')
        .map(function (l) {
            return l.trim();
        })
        .filter(function (l) {
            return l;
        });
    if (lines.length === 0) return [];
    var sep = '\t';
    if (!lines[0].includes('\t')) {
        if (lines[0].includes('|')) sep = '|';
        else if (lines[0].includes(';')) sep = ';';
        else if (lines[0].includes(',')) sep = ',';
        else sep = null;
    }
    var rows = [],
        headerKeys = null;
    for (var i = 0; i < lines.length; i++) {
        var parts = sep
            ? lines[i].split(sep).map(function (p) {
                  return p.trim();
              })
            : lines[i].split(/\s+/).filter(function (p) {
                  return p;
              });
        if (parts.length < 2) continue;
        var lower = parts.map(function (p) {
            return p.toLowerCase();
        });
        if (
            lower.some(function (p) {
                return p === 'nazwa' || p === 'nr' || p === 'lp';
            })
        ) {
            headerKeys = parts.map(function (p) {
                return _excelDetectColumn(p);
            });
            continue;
        }
        var row = {};
        if (headerKeys) {
            for (var j = 0; j < Math.min(parts.length, headerKeys.length); j++) {
                if (headerKeys[j]) row[headerKeys[j]] = parts[j];
            }
        } else {
            row.name = parts[0];
            row.dn = parts[1];
            row.rzednaWlazu = parts[2];
            row.rzednaDna = parts[3];
        }
        if (row.name) rows.push(row);
    }
    return rows;
}

function _excelDetectColumn(label) {
    var l = label.toLowerCase();
    if (l === 'nazwa' || l === 'name' || l === 'nr' || l === 'lp' || l === 'studnia') return 'name';
    if (l === 'dn' || l === 'średnica' || l === 'srednica') return 'dn';
    if (
        l === 'rz.włazu' ||
        l === 'rz wlazu' ||
        l === 'rzędna włazu' ||
        l === 'rz.w' ||
        l === 'wlazu'
    )
        return 'rzednaWlazu';
    if (l === 'rz.dna' || l === 'rz dna' || l === 'rzędna dna' || l === 'rz.d' || l === 'dna')
        return 'rzednaDna';
    return null;
}

function _excelImportPasteList() {
    var ta = document.getElementById('paste-textarea');
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) {
        showToast('Wklej dane studni', 'error');
        return;
    }
    var rows = _excelParsePasteData(text);
    if (rows.length === 0) {
        showToast('Nie rozpoznano danych', 'error');
        return;
    }
    var added = 0;
    rows.forEach(function (row) {
        var name = String(row.name || '');
        if (!name) return;
        if (
            wells.some(function (w) {
                return w.name === name;
            })
        )
            return;
        var dn = row.dn || String(_excelActiveTab);
        var dnVal = dn === 'styczne' || dn === 'styczna' ? 'styczna' : parseInt(dn, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        var rzw = row.rzednaWlazu ? parseFloat(String(row.rzednaWlazu).replace(',', '.')) : null;
        var rzd = row.rzednaDna ? parseFloat(String(row.rzednaDna).replace(',', '.')) : 0;
        var well =
            typeof createNewWell === 'function'
                ? createNewWell(name, dnVal)
                : {
                      id: 'well_' + Date.now() + '_' + added,
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
        if (rzw !== null) well.rzednaWlazu = rzw;
        if (rzd !== null) well.rzednaDna = rzd;
        wells.push(well);
        _excelAutoSetWlaz(well);
        added++;
    });
    var overlay = document.getElementById('excel-paste-dialog-overlay');
    if (added === 0) {
        showToast('Nie dodano żadnej studni (duplikaty?)', 'info');
        return;
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    if (_excelAutoSelectEnabled) {
        for (let k = 0; k < added; k++) {
            setTimeout(
                function () {
                    var nwi = wells.length - added + k;
                    var w = wells[nwi];
                    if (w && w.rzednaWlazu != null && w.rzednaDna != null) {
                        _excelAutoSelectForWell(nwi).catch(function (e) {
                            if (window.logger)
                                window.logger.warn(
                                    'AutoSelect pominiety dla nowej studni:',
                                    e.message || e
                                );
                        });
                    }
                },
                200 + k * 300
            );
        }
    }
    _excelDebouncedRefresh();
}
