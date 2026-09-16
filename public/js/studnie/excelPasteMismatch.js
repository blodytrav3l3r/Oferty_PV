// @ts-check
/* ===== EXCEL PASTE MISMATCH (modal weryfikacji niedopasowan wklejania) ===== */
if (typeof window !== 'undefined') {
    window._excelPasteMismatches = [];
    window._excelMismatchIndex = null;
}
/* Indeks O(1) dla klucza wIdx_colIdx — zastępuje findIndex (O(N²) w pętli paste).
   Semantyka bez zmian: jeden wpis per komórka, nadpisanie przy powtórce. */
function _excelRecordMismatch(item) {
    if (typeof window === 'undefined') return;
    if (!window._excelPasteMismatches) window._excelPasteMismatches = [];
    if (!window._excelMismatchIndex) window._excelMismatchIndex = new Map();
    const key = item.wIdx + '_' + item.colIdx;
    const arr = window._excelPasteMismatches;
    // Guard na zewnętrzny reset array (testy) — zweryfikuj wpis przed nadpisaniem.
    const known = window._excelMismatchIndex.get(key);
    if (
        known !== undefined &&
        known < arr.length &&
        arr[known] &&
        arr[known].wIdx === item.wIdx &&
        arr[known].colIdx === item.colIdx
    ) {
        arr[known] = item;
    } else {
        window._excelMismatchIndex.set(key, arr.length);
        arr.push(item);
    }
}
function _excelResetMismatches() {
    if (typeof window === 'undefined') return;
    window._excelPasteMismatches = [];
    window._excelMismatchIndex = new Map();
}

/* ===== GRUPOWANIE MISMATCHÓW (model dla modala, nie DOM) =====
 * Klucz: (colKind, originalVal_norm, matchedVal). matchedVal niesie kontekst
 * kategorii — ta sama wklejona wartość w różnych kategoriach to osobne grupy.
 * Invariant: weryfikacja kompletna — każda grupa aplikowana do wszystkich targets,
 * żaden cap nie powoduje cichego auto-accept. */
function _excelMismatchGroupKey(item) {
    const norm = String(item.originalVal == null ? '' : item.originalVal)
        .trim()
        .toLowerCase();
    const mv = String(item.matchedVal == null ? '' : item.matchedVal);
    if (item.colIdx >= 7) {
        const sub = (item.colIdx - 7) % 4;
        return 't' + sub + '|' + norm + '|' + mv;
    }
    return 'c' + item.colIdx + '|' + norm + '|' + mv;
}
function _excelMismatchColKind(colIdx) {
    if (colIdx >= 7) {
        const sub = (colIdx - 7) % 4;
        if (sub === 2) return 'rodzaj';
        if (sub === 3) return 'srednica';
    }
    return 'other';
}
function _excelGroupMismatches(list) {
    const groups = [];
    const byKey = new Map();
    (list || []).forEach(function (m) {
        const key = _excelMismatchGroupKey(m);
        let g = byKey.get(key);
        if (!g) {
            g = {
                key: key,
                colKind: _excelMismatchColKind(m.colIdx),
                colIdx: m.colIdx,
                originalVal: m.originalVal,
                matchedVal: m.matchedVal,
                matchedText: m.matchedText,
                options: m.options || null,
                optionsKind: m.optionsKind || null,
                optionsLimit: typeof m.optionsLimit === 'number' ? m.optionsLimit : 0,
                optionsCat: m.optionsCat || null,
                count: 0,
                sampleWellName: m.wellName,
                targets: []
            };
            byKey.set(key, g);
            groups.push(g);
        }
        g.targets.push({ wIdx: m.wIdx, colIdx: m.colIdx });
        g.count++;
    });
    return groups;
}
/* Leniwe opcje per grupa — budowane raz, tylko dla widocznych wierszy modala.
 * optionsKind: 'cats' (rodzaj), 'products' (średnica, pełna lista jak dziś). */
const _excelMismatchOptionsCache = new Map();
function _excelResolveMismatchOptions(group) {
    if (!group) return [];
    if (group.options) return group.options;
    const cacheKey =
        (group.key || String(group.matchedVal || '') + '|' + String(group.originalVal || '')) +
        '|' +
        (group.optionsKind || '') +
        '|' +
        (group.optionsLimit || 0);
    if (_excelMismatchOptionsCache.has(cacheKey)) return _excelMismatchOptionsCache.get(cacheKey);
    let opts = [];
    if (typeof studnieProducts !== 'undefined' && Array.isArray(studnieProducts)) {
        if (group.optionsKind === 'cats') {
            const cats = [
                ...new Set(
                    studnieProducts
                        .filter(function (p) {
                            return p.componentType === 'przejscie';
                        })
                        .map(function (p) {
                            return p.category;
                        })
                        .filter(Boolean)
                )
            ];
            opts = _excelBuildUnmatchedOptions(
                cats.map(function (c) {
                    return { value: c, text: c };
                })
            );
        } else if (group.optionsKind === 'products') {
            // Średnica: wybór DN, nie materiału. Jedna opcja per DN (sort numerycznie),
            // value = auto-dopasowany produkt o tym DN (reprezentant), inaczej pierwszy z puli.
            // Zapis (productId) kompatybilny z confirm bez zmian.
            const pool = studnieProducts.filter(function (p) {
                return p.componentType === 'przejscie';
            });
            const scoped =
                group.optionsCat &&
                pool.some(function (p) {
                    return p.category === group.optionsCat;
                })
                    ? pool.filter(function (p) {
                          return p.category === group.optionsCat;
                      })
                    : pool;
            const dnLabel = function (dnKey) {
                return /^dn/i.test(dnKey) ? dnKey : 'DN' + dnKey;
            };
            const byDn = {};
            const dnOrder = [];
            scoped.forEach(function (p) {
                const dnKey = p.dn != null ? String(p.dn).trim() : '';
                if (!dnKey) return;
                if (!byDn[dnKey]) {
                    byDn[dnKey] = [];
                    dnOrder.push(dnKey);
                }
                byDn[dnKey].push(p);
            });
            dnOrder.sort(function (a, b) {
                const na = parseFloat(String(a).replace(/[^\d.]/g, ''));
                const nb = parseFloat(String(b).replace(/[^\d.]/g, ''));
                if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
                return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
            });
            const repForDn = function (dnKey) {
                const cands = byDn[dnKey] || [];
                if (group.matchedVal) {
                    for (let i = 0; i < cands.length; i++) {
                        if (cands[i].id === group.matchedVal) return cands[i];
                    }
                }
                return cands[0] || null;
            };
            const limitedDns =
                group.optionsLimit > 0 ? dnOrder.slice(0, group.optionsLimit) : dnOrder.slice();
            opts = [];
            limitedDns.forEach(function (dnKey) {
                const rep = repForDn(dnKey);
                if (rep) opts.push({ value: rep.id, text: dnLabel(dnKey) });
            });
            // matched-DN zawsze obecny (gdy limit uciął), inaczej select pokazałby złą wartość.
            if (group.matchedVal) {
                const matchedProd = pool.find(function (p) {
                    return p.id === group.matchedVal;
                });
                const matchedDn = matchedProd
                    ? String(matchedProd.dn || '').trim()
                    : (String(group.matchedText || '').match(/DN\s*([\d]+(?:\/[\d]+)?)/i) ||
                          [])[1] || '';
                if (matchedDn) {
                    const present = opts.some(function (o) {
                        const op = pool.find(function (p) {
                            return p.id === o.value;
                        });
                        return op && String(op.dn || '').trim() === matchedDn;
                    });
                    if (!present) {
                        const rep = matchedProd || repForDn(matchedDn);
                        opts.push({
                            value: rep ? rep.id : group.matchedVal,
                            text: dnLabel(matchedDn)
                        });
                    }
                } else if (
                    !opts.some(function (o) {
                        return o.value === group.matchedVal;
                    })
                ) {
                    opts.push({
                        value: group.matchedVal,
                        text: group.matchedText || group.matchedVal
                    });
                }
            }
        }
    }
    if (group.optionsKind === 'cats' && opts.length === 0 && group.options) opts = group.options;
    _excelMismatchOptionsCache.set(cacheKey, opts);
    return opts;
}
/* Sygnał obcej kategorii: wklejone id/nazwa istnieje globalnie w innej kategorii
 * niż zakres wyszukiwania. Rozwiązanie w zakresie zostaje, ale flaga exact spada
 * i trafia do modala ("wklejono GRP-400, użyto K2KAN DN400"). */
function _excelForeignIdSignal(ctx, valStr, matched) {
    if (!ctx || !matched) return false;
    try {
        if (ctx.prodById && ctx.prodById.has(valStr)) {
            const g = ctx.prodById.get(valStr);
            if (g && g !== matched && g.category !== matched.category) return true;
        }
        const low = String(valStr).toLowerCase();
        if (ctx.prodByLower && ctx.prodByLower.has(low)) {
            const g = ctx.prodByLower.get(low);
            if (g && g !== matched && g.category !== matched.category) return true;
        }
    } catch (_e) {}
    return false;
}
/* Cache fuzzy per unikalna wartość w ctx paste — jeden Levenshtein/linear-scan
 * per wartość, nie per komórka. Mapy leniwie (testy vm mogą mieć ctx bez nich). */
function _excelFuzzyCatCache(ctx) {
    if (!ctx) return null;
    if (!ctx.fuzzyCat) ctx.fuzzyCat = new Map();
    return ctx.fuzzyCat;
}
function _excelFuzzyProdCache(ctx) {
    if (!ctx) return null;
    if (!ctx.fuzzyProd) ctx.fuzzyProd = new Map();
    return ctx.fuzzyProd;
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

/* Wklejanie nie może zmieniać przypadkowej liczby w kategorię (np. 300 → GRP).
   Dopuszczamy wyłącznie dokładne dopasowanie lub drobną literówkę w nazwie. */
function _excelFindPasteCategory(val, categories) {
    if (!categories || categories.length === 0) return null;
    const raw = String(val || '').trim();
    if (!/[a-ząćęłńóśźż]/i.test(raw)) return null;
    const normalize = function (value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9ąćęłńóśźż]/gi, '');
    };
    const normalized = normalize(raw);
    if (!normalized) return null;
    const exact = categories.find(function (category) {
        return normalize(category) === normalized;
    });
    if (exact) return exact;
    const prefixMatch = categories.find(function (category) {
        const normalizedCategory = normalize(category);
        return (
            normalized.length >= 4 &&
            (normalizedCategory.startsWith(normalized) || normalized.startsWith(normalizedCategory))
        );
    });
    if (prefixMatch) return prefixMatch;
    let closest = null;
    let minDistance = Infinity;
    categories.forEach(function (category) {
        const distance = _excelLevenshteinDistance(normalized, normalize(category));
        if (distance < minDistance) {
            minDistance = distance;
            closest = category;
        }
    });
    const maxDistance = normalized.length >= 6 ? 2 : 1;
    return minDistance <= maxDistance ? closest : null;
}

function _excelBuildUnmatchedOptions(options) {
    return [{ value: '', text: '— nie dopasowano —' }].concat(options);
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
/* ===== MODAL WERYFIKACJI — grupy, pager, lazy select =====
 * Invarianty:
 * 1. DOM nigdy nie zawiera N × pełna lista <option> (grupy + lazy select + pager).
 * 2. Weryfikacja kompletna — soft-cap to tylko ostrzeżenie UX, zero auto-accept.
 * Jedna decyzja per (colKind, originalVal_norm, matchedVal) → wszystkie targets. */
const _EXCEL_MISMATCH_PAGE = 40;
const _EXCEL_MISMATCH_SOFT_CAP = 200;
let _excelMismatchView = null;
/* ===== MODAL WERYFIKACJI — pełna lista per wiersz (studnia × pole) =====
 * 1 wiersz = 1 pozycja z window._excelPasteMismatches. Decyzje dwupoziomowe:
 * per wiersz (select) + globalnie per wartość ("Do wszystkich z tą wartością").
 * Invarianty: max 40 wierszy w DOM (pager), selecty tylko na żądanie,
 * soft-cap to tylko ostrzeżenie UX — zero auto-accept. */
function _excelMismatchRowLabel(m) {
    if (!m) return '';
    if (m.colIdx >= 7) {
        const trIdx = Math.floor((m.colIdx - 7) / 4);
        const sub = (m.colIdx - 7) % 4;
        if (sub === 2) return 'Przejście ' + (trIdx + 1) + ' (Rodzaj)';
        if (sub === 3) return 'Przejście ' + (trIdx + 1) + ' (Średnica)';
        return 'Przejście ' + (trIdx + 1);
    }
    if (m.colIdx === 3) return 'Nazwa studni';
    return 'Pole ' + m.colIdx;
}
/* Lp studni jak w gridzie Excela (pozycja w aktywnej zakładce DN, 1-based).
 * Fallback wIdx+1 gdy brak filteredIndexes (np. testy vm). */
function _excelMismatchWellLp(wIdx) {
    try {
        if (typeof _excelGetFilteredIndexes === 'function') {
            const arr = _excelGetFilteredIndexes();
            if (Array.isArray(arr)) {
                const pos = arr.indexOf(wIdx);
                if (pos >= 0) return pos + 1;
            }
        }
    } catch (_e) {}
    return (typeof wIdx === 'number' && !isNaN(wIdx) ? wIdx : 0) + 1;
}
/* Czy pozycja to średnica przejścia (sub==3) — etykieta zawsze z widocznym DN. */
function _excelMismatchIsDiameter(entry) {
    return (
        !!entry &&
        typeof entry.colIdx === 'number' &&
        entry.colIdx >= 7 &&
        (entry.colIdx - 7) % 4 === 3
    );
}
/* DN dopasowanego produktu: lookup po id, fallback regex z nazwy. */
function _excelMismatchProductDn(value, text) {
    try {
        if (value && typeof studnieProducts !== 'undefined' && Array.isArray(studnieProducts)) {
            let p = null;
            if (typeof getStudnieProductById === 'function') {
                try {
                    p = getStudnieProductById(value);
                } catch (_e) {
                    p = null;
                }
            } else {
                for (let i = 0; i < studnieProducts.length; i++) {
                    if (studnieProducts[i] && studnieProducts[i].id === value) {
                        p = studnieProducts[i];
                        break;
                    }
                }
            }
            if (p && p.dn != null && String(p.dn).trim() !== '') return String(p.dn).trim();
        }
    } catch (_e) {}
    const t = String(text || '');
    const m = t.match(/DN\s*([\d]+(?:\/[\d]+)?)/i) || t.match(/([\d]{2,4}(?:\/[\d]{2,4})?)/);
    return m ? m[1] : '';
}
/* Etykieta średnicy: sam dobrany DN, nie rodzaj rury (zmiana przez select Zmień…).
 * Zwraca { text, title }: text to "DNxxx", title to pełna nazwa produktu (tooltip). */
function _excelMismatchDiameterLabel(cur) {
    const name = String((cur && (cur.text || cur.value)) || '');
    if (!name) return { text: '', title: '' };
    const dn = _excelMismatchProductDn(cur && cur.value, name);
    if (!dn) return { text: name, title: '' };
    const disp = /^dn/i.test(dn) ? dn : 'DN' + dn;
    return { text: disp, title: name === disp ? '' : name };
}
/* Zwraca listę flatIdx po filtrze (Lp / wellName / wklejona / dopasowanie). */
function _excelMismatchFilteredRows() {
    if (!_excelMismatchView) return [];
    const rows = _excelMismatchView.rows || [];
    const f = (_excelMismatchView.filter || '').trim().toLowerCase();
    const out = [];
    for (let i = 0; i < rows.length; i++) {
        if (!f) {
            out.push(i);
            continue;
        }
        const m = rows[i];
        const ov = _excelMismatchView.overrides && _excelMismatchView.overrides[i];
        if (
            String(_excelMismatchWellLp(m.wIdx)).indexOf(f) >= 0 ||
            String(m.wellName || '')
                .toLowerCase()
                .indexOf(f) >= 0 ||
            String(m.originalVal || '')
                .toLowerCase()
                .indexOf(f) >= 0 ||
            String(m.matchedText || '')
                .toLowerCase()
                .indexOf(f) >= 0 ||
            (ov &&
                String(ov.text || '')
                    .toLowerCase()
                    .indexOf(f) >= 0)
        )
            out.push(i);
    }
    return out;
}
/* Aktualna (ew. nadpisana) wartość pozycji: { value, text }. */
function _excelMismatchRowValue(flatIdx) {
    const view = _excelMismatchView;
    const rows =
        (view && view.rows) ||
        (typeof window !== 'undefined' ? window._excelPasteMismatches : []) ||
        [];
    const m = rows[flatIdx];
    if (!m) return { value: '', text: '' };
    if (view && view.overrides && view.overrides[flatIdx] !== undefined)
        return view.overrides[flatIdx];
    return { value: m.matchedVal, text: m.matchedText || m.matchedVal };
}
function _excelMismatchRowHtml(entry, flatIdx, visIdx) {
    const esc =
        typeof escapeHtml === 'function'
            ? escapeHtml
            : function (s) {
                  return s;
              };
    const escAttr =
        typeof escapeHtmlAttr === 'function'
            ? escapeHtmlAttr
            : function (s) {
                  return esc(s).replace(/"/g, '&quot;');
              };
    const cur = _excelMismatchRowValue(flatIdx);
    const wellTxt = esc(entry.wellName || '');
    const colTxt = esc(_excelMismatchRowLabel(entry));
    const origTxt = esc(String(entry.originalVal == null ? '' : entry.originalVal));
    const curRaw = String(cur.text || cur.value || '');
    // Średnica: sam dobrany DN (pełna nazwa produktu w tooltipie).
    const diamLabel = _excelMismatchIsDiameter(entry) ? _excelMismatchDiameterLabel(cur) : null;
    const curDisplay = diamLabel ? diamLabel.text : curRaw;
    const curTitle = diamLabel ? diamLabel.title : '';
    const titleAttr = curTitle ? ' title="' + escAttr(curTitle) + '"' : '';
    // Dopasowanie bez powtórki Wklejonej (wartość wklejona widoczna w osobnej kolumnie).
    let matchHtml;
    if (!curDisplay) {
        matchHtml = esc('— nie dopasowano —');
    } else if (titleAttr) {
        matchHtml = '<b' + titleAttr + '>' + esc(curDisplay) + '</b>';
    } else {
        matchHtml = esc(curDisplay);
    }
    const opts = _excelResolveMismatchOptions(entry);
    let selHtml =
        '<select class="excel-mismatch-select" data-m-idx="' +
        visIdx +
        '" data-flat="' +
        flatIdx +
        '" onchange="_excelMismatchPick(this)" style="padding:0.35rem 0.6rem; border-radius:var(--radius-sm); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-glass); font-size:var(--fs-sm); flex:0 0 auto; max-width:240px;">';
    opts.forEach(function (opt) {
        const isSel = String(opt.value) === String(cur.value) ? 'selected' : '';
        selHtml +=
            '<option value="' +
            escAttr(String(opt.value)) +
            '" ' +
            isSel +
            '>' +
            esc(opt.text) +
            '</option>';
    });
    selHtml += '</select>';

    const lpTxt = esc(String(_excelMismatchWellLp(entry.wIdx)));
    return (
        '<tr style="border-bottom:1px solid var(--border-glass);" data-mrow="' +
        visIdx +
        '" data-flat="' +
        flatIdx +
        '"><td style="padding:0.6rem; text-align:center; color:var(--text-muted);">' +
        lpTxt +
        '</td><td style="padding:0.6rem; font-weight:var(--fw-bold);">' +
        wellTxt +
        '</td><td style="padding:0.6rem; color:var(--accent-text);">' +
        colTxt +
        '</td><td style="padding:0.6rem; color:var(--warn-hover);"><code style="background:rgba(var(--warn-rgb),0.15); padding:0.15rem 0.4rem; border-radius:4px;">' +
        origTxt +
        '</code></td><td style="padding:0.6rem; white-space:nowrap;"><div style="display:flex; align-items:center; gap:0.6rem; white-space:nowrap; flex-wrap:nowrap;"><span class="excel-mismatch-current" style="min-width:60px; font-weight:var(--fw-bold); color:var(--text-heading);">' +
        matchHtml +
        '</span>' +
        selHtml +
        '<button type="button" class="btn btn-secondary excel-mismatch-bulk" data-m-idx="' +
        visIdx +
        '" onclick="_excelMismatchApplyToKey(this)" style="padding:0.3rem 0.6rem; font-size:var(--fs-xs); flex:0 0 auto; white-space:nowrap;" title="Zastosuj ten wybór do wszystkich pozycji z tą samą wklejoną wartością">Do wszystkich z tą wartością</button></div></td></tr>'
    );
}
function _excelMismatchRenderRows(append) {
    if (typeof document === 'undefined' || !_excelMismatchView) return;
    const modal = document.getElementById('excel-paste-mismatch-modal');
    const tbody = modal ? modal.querySelector('#excel-mismatch-tbody') : null;
    const list = _excelMismatchFilteredRows();
    _excelMismatchView.visible = list;
    const rows = _excelMismatchView.rows || [];
    const from = append ? _excelMismatchView.shown : 0;
    const to = append
        ? Math.min(list.length, _excelMismatchView.shown + _EXCEL_MISMATCH_PAGE)
        : Math.min(list.length, _EXCEL_MISMATCH_PAGE);
    let html = '';
    for (let i = from; i < to; i++) html += _excelMismatchRowHtml(rows[list[i]], list[i], i);
    if (tbody) {
        if (append) tbody.insertAdjacentHTML('beforeend', html);
        else tbody.innerHTML = html;
    }
    _excelMismatchView.shown = to;
    if (modal) {
        const countEl = modal.querySelector('#excel-mismatch-count');
        if (countEl)
            countEl.textContent =
                'Pozycja ' + to + ' z ' + list.length + ' (' + rows.length + ' pól)';
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons && tbody)
        try {
            lucide.createIcons({ root: /** @type {HTMLElement} */ (tbody) });
        } catch (_e) {}
}
function _excelMismatchOnScroll(container) {
    if (!container || typeof document === 'undefined' || !_excelMismatchView) return;
    const list = _excelMismatchView.visible || [];
    if (_excelMismatchView.shown >= list.length) return;
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (scrollBottom < 150) {
        _excelMismatchRenderRows(true);
    }
}
function _excelMismatchFilter(input) {
    if (!_excelMismatchView) return;
    _excelMismatchView.filter = input && input.value ? input.value : '';
    _excelMismatchView.shown = 0;
    _excelMismatchRenderRows(false);
}
/* Leniwy select — pełne opcje budowane dopiero po kliknięciu "Zmień…", tylko ten wiersz. */
function _excelMismatchExpand(btn) {
    if (!btn || typeof document === 'undefined' || !_excelMismatchView) return;
    const visIdx = parseInt(btn.getAttribute('data-m-idx') || '-1', 10);
    const list = _excelMismatchView.visible || [];
    const rows = _excelMismatchView.rows || [];
    if (isNaN(visIdx) || visIdx < 0 || visIdx >= list.length) return;
    const flatIdx = list[visIdx];
    const entry = rows[flatIdx];
    if (!entry) return;
    const row = btn.closest ? btn.closest('tr') : null;
    const editor = row ? row.querySelector('.excel-mismatch-editor') : null;
    if (!editor) return;
    if (editor.querySelector('select')) return;
    const cur = _excelMismatchRowValue(flatIdx);
    const opts = _excelResolveMismatchOptions(entry);
    const escAttr =
        typeof escapeHtmlAttr === 'function'
            ? escapeHtmlAttr
            : function (s) {
                  return s;
              };
    const esc =
        typeof escapeHtml === 'function'
            ? escapeHtml
            : function (s) {
                  return s;
              };
    let selHtml =
        '<select class="excel-mismatch-select" data-m-idx="' +
        visIdx +
        '" data-flat="' +
        flatIdx +
        '" onchange="_excelMismatchPick(this)" style="padding:0.4rem 0.6rem; border-radius:var(--radius-sm); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-glass); font-size:var(--fs-sm); flex:1 1 180px; min-width:180px;">';
    opts.forEach(function (opt) {
        const isSel = String(opt.value) === String(cur.value) ? 'selected' : '';
        selHtml +=
            '<option value="' +
            escAttr(String(opt.value)) +
            '" ' +
            isSel +
            '>' +
            esc(opt.text) +
            '</option>';
    });
    selHtml += '</select>';
    selHtml +=
        ' <button type="button" class="btn btn-secondary excel-mismatch-bulk" data-m-idx="' +
        visIdx +
        '" onclick="_excelMismatchApplyToKey(this)" style="padding:0.2rem 0.6rem; font-size:var(--fs-xs); flex:0 0 auto;" title="Zastosuj ten wybór do wszystkich pozycji z tą samą wklejoną wartością">Do wszystkich z tą wartością</button>';
    editor.innerHTML = selHtml;
    btn.style.display = 'none';
    const sel = editor.querySelector('select');
    if (sel) sel.focus();
}
/* Wybór per wiersz — zapis do overrides, labelka na bieżąco. */
function _excelMismatchPick(sel) {
    if (!sel || !_excelMismatchView) return;
    const visIdx = parseInt(sel.getAttribute('data-m-idx') || '-1', 10);
    const list = _excelMismatchView.visible || [];
    if (isNaN(visIdx) || visIdx < 0 || visIdx >= list.length) return;
    const flatIdx = list[visIdx];
    const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    if (!_excelMismatchView.overrides) _excelMismatchView.overrides = {};
    _excelMismatchView.overrides[flatIdx] = {
        value: sel.value,
        text: opt ? opt.text : sel.value
    };
    const row = sel.closest ? sel.closest('tr') : null;
    const label = row ? row.querySelector('.excel-mismatch-current') : null;
    if (label) {
        // Średnica: sam DN + pełna nazwa w tooltipie (zapis id bez zmian).
        const rows = _excelMismatchView.rows || [];
        const picked = { value: sel.value, text: opt ? opt.text : sel.value };
        if (_excelMismatchIsDiameter(rows[flatIdx])) {
            const lab = _excelMismatchDiameterLabel(picked);
            label.textContent = lab.text || picked.text;
            if (lab.title) label.setAttribute('title', lab.title);
            else label.removeAttribute('title');
        } else {
            label.textContent = picked.text;
        }
    }
}
/* Czysta część bulk: flatIdx pozycji z tym samym kluczem wartości. */
function _excelMismatchFlatByKey(rows, key) {
    const out = [];
    for (let f = 0; f < (rows || []).length; f++) {
        if (_excelMismatchGroupKey(rows[f]) === key) out.push(f);
    }
    return out;
}
/* Zmiana globalna: wybór z tego wiersza do wszystkich pozycji z tą samą wartością. */
function _excelMismatchApplyToKey(btn) {
    if (!btn || !_excelMismatchView || typeof document === 'undefined') return;
    const visIdx = parseInt(btn.getAttribute('data-m-idx') || '-1', 10);
    const list = _excelMismatchView.visible || [];
    const rows = _excelMismatchView.rows || [];
    if (isNaN(visIdx) || visIdx < 0 || visIdx >= list.length) return;
    const srcFlat = list[visIdx];
    const src = rows[srcFlat];
    if (!src) return;
    const row = btn.closest ? btn.closest('tr') : null;
    const sel = row ? row.querySelector('.excel-mismatch-select') : null;
    if (!sel) return;
    const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    const picked = { value: sel.value, text: opt ? opt.text : sel.value };
    const key = _excelMismatchGroupKey(src);
    if (!_excelMismatchView.overrides) _excelMismatchView.overrides = {};
    const targets = _excelMismatchFlatByKey(rows, key);
    targets.forEach(function (f) {
        _excelMismatchView.overrides[f] = picked;
    });
    const n = targets.length;
    // Odśwież widoczne wiersze z tym kluczem (labelki + rozwinięte selecty).
    const modal = document.getElementById('excel-paste-mismatch-modal');
    if (modal) {
        const trs = modal.querySelectorAll('#excel-mismatch-tbody tr[data-flat]');
        trs.forEach(function (tr) {
            const f = parseInt(tr.getAttribute('data-flat') || '-1', 10);
            if (isNaN(f) || !rows[f] || _excelMismatchGroupKey(rows[f]) !== key) return;
            const label = tr.querySelector('.excel-mismatch-current');
            if (label) {
                if (_excelMismatchIsDiameter(rows[f])) {
                    const lab = _excelMismatchDiameterLabel(picked);
                    label.textContent = lab.text || picked.text || picked.value;
                    if (lab.title) label.setAttribute('title', lab.title);
                    else label.removeAttribute('title');
                } else {
                    label.textContent = picked.text || picked.value;
                }
            }
            const s = /** @type {HTMLSelectElement} */ (tr.querySelector('.excel-mismatch-select'));
            if (s && s.value !== picked.value) {
                const has = Array.from(s.options).some(function (o) {
                    return o.value === picked.value;
                });
                if (has) s.value = picked.value;
            }
        });
    }
    if (typeof showToast === 'function') showToast('Zastosowano do ' + n + ' pozycji', 'success');
}
function _excelShowMismatchModal(mismatches) {
    if (typeof window === 'undefined' || !mismatches || mismatches.length === 0) return;
    _excelMismatchView = { rows: mismatches, filter: '', shown: 0, visible: [], overrides: {} };
    const warnHtml =
        mismatches.length > _EXCEL_MISMATCH_SOFT_CAP
            ? '<div style="font-size:var(--fs-sm); color:var(--warn-hover); background:rgba(var(--warn-rgb),0.12); border:1px solid rgba(var(--warn-rgb),0.4); border-radius:var(--radius-sm); padding:0.5rem 0.8rem; margin-bottom:0.8rem;">Dużo pozycji (' +
              mismatches.length +
              ') — lista stronicowana, pełna. Wszystkie pozycje są widoczne strona po stronie, nic nie jest pomijane.</div>'
            : '';
    const html = `<div class="modal modal--lg" style="max-width:1400px; width:96vw; background:var(--bg-secondary); border:1px solid var(--border-glass); border-radius:var(--radius-md); padding:1.5rem; color:var(--text-primary);"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border-glass); padding-bottom:0.8rem;"><h3 style="margin:0; font-size:var(--fs-xl); font-weight:var(--fw-bold); display:flex; align-items:center; gap:0.5rem; color:var(--text-heading);"><i data-lucide="alert-triangle" style="color:var(--warn);"></i> Weryfikacja wklejonych przejść i średnic</h3><button onclick="closeModal('excel-paste-mismatch-modal')" class="btn-icon" aria-label="Zamknij" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem;">✕</button></div><p style="font-size:var(--fs-sm); color:var(--text-secondary); margin-bottom:1rem; line-height:1.4;">Wartości nie miały dokładnego odpowiednika w systemie. Automatycznie wybrano najbardziej zbliżone opcje — każdy wiersz to jedna studnia i jedno pole. Popraw pojedynczo w wybranej pozycji (wybierając opcję z listy obok) albo wybór zastosuj dla wszystkich pozycji z tą samą wklejoną wartością:</p>${warnHtml}<div style="display:flex; gap:0.8rem; align-items:center; margin-bottom:0.8rem;"><input id="excel-mismatch-search" type="text" placeholder="Filtruj pozycje… (studnia, wartość)" oninput="_excelMismatchFilter(this)" style="flex:1; padding:0.4rem 0.6rem; border-radius:var(--radius-sm); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-glass); font-size:var(--fs-sm);" /><span id="excel-mismatch-count" style="font-size:var(--fs-xs); color:var(--text-muted); white-space:nowrap;"></span></div><div id="excel-mismatch-scroll-container" style="max-height:min(520px, 62vh); overflow-y:auto; border:1px solid var(--border-glass); border-radius:var(--radius-sm); margin-bottom:1.2rem;" onscroll="_excelMismatchOnScroll(this)"><table style="width:100%; border-collapse:collapse; font-size:var(--fs-sm); text-align:left;"><thead style="background:var(--bg-tertiary); position:sticky; top:0; z-index:2;"><tr><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Lp.</th><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Studnia</th><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Pole</th><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Wklejona wartość</th><th style="padding:0.6rem; border-bottom:1px solid var(--border-glass);">Dopasowanie i zmiana</th></tr></thead><tbody id="excel-mismatch-tbody"></tbody></table></div><div style="display:flex; justify-content:flex-end; gap:0.8rem;"><button type="button" class="btn btn-secondary" onclick="closeModal('excel-paste-mismatch-modal')" style="padding:0.5rem 1rem;">Anuluj</button><button type="button" class="btn btn-primary" onclick="excelConfirmPasteMismatches()" style="padding:0.5rem 1.2rem; background:var(--accent); color:#fff; border:none; border-radius:var(--radius-sm); font-weight:var(--fw-bold); cursor:pointer;">Zatwierdź zmiany</button></div></div>`;
    if (typeof window.showModal === 'function') {
        window.showModal({
            id: 'excel-paste-mismatch-modal',
            title: 'Weryfikacja wklejonych przejść i średnic',
            html: html
        });
        _excelMismatchRenderRows(false);
        if (typeof lucide !== 'undefined' && lucide.createIcons)
            try {
                lucide.createIcons({ root: document.getElementById('excel-paste-mismatch-modal') });
            } catch (_e) {}
    }
}
/* Jedna decyzja grupy → wszystkie targets (ta sama semantyka co stary confirm per komórka). */
function _excelApplyMismatchChoice(target, newVal) {
    const wIdx = target.wIdx;
    const colIdx = target.colIdx;
    if (isNaN(wIdx) || typeof wells === 'undefined' || !wells[wIdx]) return;
    if (colIdx < 7) return;
    const trIdx = Math.floor((colIdx - 7) / 4);
    const subType = (colIdx - 7) % 4;
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    while (wells[wIdx].przejscia.length <= trIdx) {
        if (typeof _excelCreatePrzejscie === 'function')
            wells[wIdx].przejscia.push(_excelCreatePrzejscie());
        else wells[wIdx].przejscia.push({ productId: '', tempCategory: '' });
    }
    const prz = wells[wIdx].przejscia[trIdx];
    if (subType === 2) prz.tempCategory = newVal;
    else if (subType === 3) {
        prz.productId = newVal;
        const prod =
            typeof studnieProducts !== 'undefined'
                ? typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(newVal)
                    : studnieProducts.find((p) => p.id === newVal)
                : null;
        if (prod) prz.tempCategory = prod.category;
    }
}
/* Confirm per wiersz: select w DOM ? wartość : overrides (per-wiersz/global) : matchedVal. */
function excelConfirmPasteMismatches() {
    const modal =
        typeof document !== 'undefined'
            ? document.getElementById('excel-paste-mismatch-modal')
            : null;
    const rows =
        _excelMismatchView && _excelMismatchView.rows
            ? _excelMismatchView.rows
            : (typeof window !== 'undefined' ? window._excelPasteMismatches : []) || [];
    const overrides = (_excelMismatchView && _excelMismatchView.overrides) || {};
    rows.forEach(function (m, f) {
        let newVal = m.matchedVal;
        if (overrides[f] !== undefined) newVal = overrides[f].value;
        if (modal) {
            const sel = /** @type {HTMLSelectElement} */ (
                modal.querySelector('.excel-mismatch-select[data-flat="' + f + '"]')
            );
            if (sel) {
                newVal = sel.value;
                const opt =
                    sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
                overrides[f] = { value: sel.value, text: opt ? opt.text : sel.value };
            }
        }
        _excelApplyMismatchChoice({ wIdx: m.wIdx, colIdx: m.colIdx }, newVal);
    });
    if (typeof closeModal === 'function') closeModal('excel-paste-mismatch-modal');
    _excelResetMismatches();
    _excelMismatchView = null;
    if (typeof _excelMarkDirty === 'function')
        try {
            _excelMarkDirty();
        } catch (_e) {}
    if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
    if (typeof showToast === 'function') showToast('Zatwierdzono dopasowania przejść', 'success');
}
if (typeof window !== 'undefined') {
    window.excelConfirmPasteMismatches = excelConfirmPasteMismatches;
    window._excelShowMismatchModal = _excelShowMismatchModal;
    window._excelGroupMismatches = _excelGroupMismatches;
    window._excelApplyMismatchChoice = _excelApplyMismatchChoice;
    window._excelMismatchOnScroll = _excelMismatchOnScroll;
    window._excelMismatchFilter = _excelMismatchFilter;
    window._excelMismatchExpand = _excelMismatchExpand;
    window._excelMismatchPick = _excelMismatchPick;
    window._excelMismatchApplyToKey = _excelMismatchApplyToKey;
    window._excelMismatchFlatByKey = _excelMismatchFlatByKey;
    window._excelMismatchRowLabel = _excelMismatchRowLabel;
    window._excelResetMismatches = _excelResetMismatches;
    window._excelResolveMismatchOptions = _excelResolveMismatchOptions;
}
