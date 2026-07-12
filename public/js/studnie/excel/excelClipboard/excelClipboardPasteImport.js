// @ts-check
/* ===== EXCEL CLIPBOARD — Wklejanie i import studni ===== */

function _excelPasteCreateWells(text) {
    const parsed = _excelParsePasteData(text);
    /* Jesli parser nie rozpoznal danych, sprobuj prostrzy format: kazda linia = nazwa studni */
    if (parsed.length === 0) {
        const lines = text
            .trim()
            .split(String.fromCharCode(10))
            .map(function (l) {
                return l.replace(String.fromCharCode(13), '').trim();
            })
            .filter(function (l) {
                return l;
            });
        if (lines.length > 0) {
            var dn = _excelActiveTab || '1000';
            _excelSaveUndoSnapshot();
            var added = 0;
            for (let fi = 0; fi < lines.length; fi++) {
                const name = lines[fi];
                if (!name) continue;
                let dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn, 10);
                if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
                const well =
                    typeof createNewWell === 'function'
                        ? createNewWell(name, dnVal)
                        : {
                              id: 'well_' + Date.now() + '_' + added,
                              name: name,
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
                well.name = name; /* pozwól na duplikaty */
                wells.push(well);
                _excelAutoSetWlaz(well);
                added++;
            }
            if (added > 0) {
                _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
                _excelRenderTabs();
                _excelRenderTable(_excelActiveTab);
                _excelUpdateWellCount();
                _excelDebouncedRefresh();
                showToast('Dodano ' + added + ' studni', 'success');
                return;
            }
            showToast('Brak danych do wklejenia', 'info');
            return;
        }
        showToast('Nie rozpoznano danych', 'error');
        return;
    }
    var dn = _excelActiveTab || '1000';
    _excelSaveUndoSnapshot();
    var added = 0;
    parsed.forEach(function (row) {
        const name = String(row.name || '').trim();
        if (!name) return;
        /* pozwól na duplikaty — nie sprawdzamy 'wells.some' */
        let dnVal = row.dn || String(dn);
        dnVal = dnVal === 'styczne' || dnVal === 'styczna' ? 'styczna' : parseInt(dnVal, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        const rzw = row.rzednaWlazu ? parseDecimal(String(row.rzednaWlazu)) : null;
        const rzd = row.rzednaDna ? parseDecimal(String(row.rzednaDna)) : 0;
        const well =
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
    if (added === 0) {
        showToast('Nie dodano żadnej studni', 'info');
        return;
    }
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    if (_excelAutoSelectEnabled) {
        for (let k = 0; k < added; k++) {
            (function (idx) {
                setTimeout(
                    function () {
                        const nwi = wells.length - added + idx;
                        const w = wells[nwi];
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
                    200 + idx * 300
                );
            })(k);
        }
    }
    _excelDebouncedRefresh();
    showToast('Dodano ' + added + ' studni', 'success');
}

function _excelImportPasteList() {
    const ta = document.getElementById('paste-textarea');
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) {
        showToast('Wklej dane studni', 'error');
        return;
    }
    const rows = _excelParsePasteData(text);
    if (rows.length === 0) {
        showToast('Nie rozpoznano danych', 'error');
        return;
    }
    let added = 0;
    rows.forEach(function (row) {
        const name = String(row.name || '');
        if (!name) return;
        if (
            wells.some(function (w) {
                return w.name === name;
            })
        )
            return;
        const dn = row.dn || String(_excelActiveTab);
        let dnVal = dn === 'styczne' || dn === 'styczna' ? 'styczna' : parseInt(dn, 10);
        if (typeof dnVal === 'number' && isNaN(dnVal)) dnVal = 1000;
        const rzw = row.rzednaWlazu ? parseDecimal(String(row.rzednaWlazu)) : null;
        const rzd = row.rzednaDna ? parseDecimal(String(row.rzednaDna)) : 0;
        const well =
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
    const overlay = document.getElementById('excel-paste-dialog-overlay');
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
            (function (idx) {
                setTimeout(
                    function () {
                        const nwi = wells.length - added + idx;
                        const w = wells[nwi];
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
                    200 + idx * 300
                );
            })(k);
        }
    }
    _excelDebouncedRefresh();
}

function _excelUpdatePastePreview() {
    const ta = document.getElementById('paste-textarea');
    const prev = document.getElementById('paste-preview');
    if (!ta || !prev) return;
    const text = ta.value.trim();
    if (!text) {
        prev.textContent = '';
        return;
    }
    const rows = _excelParsePasteData(text);
    prev.innerHTML =
        rows.length > 0
            ? 'Rozpoznano <strong>' + rows.length + '</strong> studni'
            : '(brak danych)';
}

function _excelParsePasteData(text) {
    const lines = text
        .split('\n')
        .map(function (l) {
            return l.trim();
        })
        .filter(function (l) {
            return l;
        });
    if (lines.length === 0) return [];
    let sep = '\t';
    if (!lines[0].includes('\t')) {
        if (lines[0].includes('|')) sep = '|';
        else if (lines[0].includes(';')) sep = ';';
        else if (lines[0].includes(',')) sep = ',';
        else sep = null;
    }
    let rows = [],
        headerKeys = null;
    for (let i = 0; i < lines.length; i++) {
        const parts = sep
            ? lines[i].split(sep).map(function (p) {
                  return p.trim();
              })
            : lines[i].split(/\s+/).filter(function (p) {
                  return p;
              });
        if (parts.length < 2) continue;
        const lower = parts.map(function (p) {
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
        const row = {};
        if (headerKeys) {
            for (let j = 0; j < Math.min(parts.length, headerKeys.length); j++) {
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
    const l = label.toLowerCase();
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
