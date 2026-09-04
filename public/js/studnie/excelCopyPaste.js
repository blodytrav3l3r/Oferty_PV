// @ts-check
/* ===== EXCEL COPY / PASTE (Excel-like) ===== */
let _excelPasteRafId = null;

/* ===== F1 PASTE CACHE - lokalny ctx jednego paste (nie global) ===== */
function _excelIsPrzejscieRodzajCol(colIdx) {
    if (colIdx < 7 || (colIdx - 7) % 4 !== 2) return false;
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
            ? _excelMaxTransitions[_excelActiveTab]
            : 1;
    return colIdx < 7 + maxTr * 4;
}
function _excelIsPrzejscieSrednicaCol(colIdx) {
    if (colIdx < 7 || (colIdx - 7) % 4 !== 3) return false;
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
            ? _excelMaxTransitions[_excelActiveTab]
            : 1;
    return colIdx < 7 + maxTr * 4;
}
function _excelBuildVisibleSeq() {
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
            ? _excelMaxTransitions[_excelActiveTab]
            : 1;
    const prefixLen = 10 + maxTr * 4;
    const seq = [];
    for (let logical = 0; logical < prefixLen; logical++) {
        seq.push({ vis: logical, logical: logical, id: 'prefix_' + logical });
    }
    let allComp = [];
    let visibleComp = [];
    try {
        if (
            typeof _excelBuildComponentColumns === 'function' &&
            typeof _excelGetReferenceWell === 'function'
        ) {
            allComp =
                _excelBuildComponentColumns(
                    _excelActiveTab,
                    _excelGetReferenceWell(_excelActiveTab)
                ) || [];
            visibleComp =
                typeof _excelFilterVisibleColumns === 'function'
                    ? _excelFilterVisibleColumns(allComp)
                    : allComp;
        }
    } catch (_e) {}
    visibleComp.forEach(function (col, visPos) {
        const allIdx = allComp.findIndex(function (c) {
            return c.id === col.id;
        });
        if (allIdx < 0) return;
        const logical = prefixLen + allIdx;
        const vis = prefixLen + visPos;
        seq.push({ vis: vis, logical: logical, id: col.id });
    });
    // tail: Hdenn, Uszcz, Reduction?, Kineta, PsiaBuda, Akcje — stale, nigdy ukryte
    const hasReduction =
        ['1200', '1500', '2000', '2500', 'styczne'].indexOf(String(_excelActiveTab)) >= 0;
    const tailCount = 2 + (hasReduction ? 1 : 0) + 2 + 1;
    const tailLogicalBase = prefixLen + allComp.length;
    const tailVisBase = prefixLen + visibleComp.length;
    for (let t = 0; t < tailCount; t++) {
        seq.push({ vis: tailVisBase + t, logical: tailLogicalBase + t, id: 'tail_' + t });
    }
    return seq;
}
function _excelRebuildPasteSeq(ctx) {
    if (!ctx) return;
    try {
        ctx.seq = _excelBuildVisibleSeq();
    } catch (_e) {}
}
function _excelFindSeqPosByVis(seq, visIdx) {
    if (!seq || !Array.isArray(seq)) return -1;
    for (let i = 0; i < seq.length; i++) if (seq[i].vis === visIdx) return i;
    return -1;
}
function _excelBuildPasteCache() {
    const all =
        typeof studnieProducts !== 'undefined' && Array.isArray(studnieProducts)
            ? studnieProducts.filter(function (p) {
                  return p.componentType === 'przejscie';
              })
            : [];
    const cats = [
        ...new Set(
            all
                .map(function (p) {
                    return p.category;
                })
                .filter(Boolean)
        )
    ].sort();
    const catLowerMap = new Map();
    cats.forEach(function (c) {
        catLowerMap.set(String(c).trim().toLowerCase(), c);
    });
    const prodById = new Map();
    const prodByLower = new Map();
    const prodByDigits = new Map();
    const catToProducts = new Map();
    all.forEach(function (p) {
        if (p.id) prodById.set(String(p.id), p);
        const nm = String(p.name || p.id || '')
            .trim()
            .toLowerCase();
        if (nm && !prodByLower.has(nm)) prodByLower.set(nm, p);
        const d = String(p.dn || '').replace(/\D/g, '');
        if (d) {
            if (!prodByDigits.has(d)) prodByDigits.set(d, []);
            prodByDigits.get(d).push(p);
        }
        const c = p.category || '';
        if (!catToProducts.has(c)) catToProducts.set(c, []);
        catToProducts.get(c).push(p);
    });
    catToProducts.forEach(function (arr) {
        arr.sort(function (a, b) {
            return parseFloat(a.dn) - parseFloat(b.dn);
        });
    });
    return {
        all: all,
        cats: cats,
        catLowerMap: catLowerMap,
        prodById: prodById,
        prodByLower: prodByLower,
        prodByDigits: prodByDigits,
        catToProducts: catToProducts,
        affected: new Set(),
        seq: _excelBuildVisibleSeq()
    };
}
function _excelFinalizePasteAffected(ctx) {
    if (!ctx || !ctx.affected || ctx.affected.size === 0) return;
    ctx.affected.forEach(function (wIdx) {
        const w = typeof wells !== 'undefined' ? wells[wIdx] : null;
        if (!w) return;
        if (typeof _excelClearResCache === 'function')
            try {
                _excelClearResCache(w);
            } catch (_e) {}
        w.autoSelect = false;
        w.configSource = 'MANUAL';
        w.autoLocked = true;
    });
    if (typeof _excelSyncAutoManualUI === 'function')
        try {
            _excelSyncAutoManualUI();
        } catch (_e) {}
    if (typeof window.updateAutoLockUI === 'function')
        try {
            window.updateAutoLockUI();
        } catch (_e) {}
}

function _excelGetPasteColIdx(row) {
    if (!row) return 3;
    const active = document.activeElement;
    if (active && row.contains(active)) {
        const td = active.closest('td');
        if (td) {
            const ci = Array.from(row.children).indexOf(td);
            if (ci >= 3) return ci;
            if (ci >= 2) return 3;
        }
    }
    return 3; /* fallback: Nr Studni (3) — nigdy Lp (2) */
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

/* ===== CENTRALNY HELPER: logical -> visible TD (semantyka A: wklej do widocznych) =====
   Model operuje na logical column index, DOM na visible TD index.
   Po ukryciu kolumn ( _excelHiddenColumnIds ) te indeksy sie rozjezdzaja.
   Helper mapuje logical -> visible i zwraca null dla ukrytej kolumny (skip, nie gubi danych).
   Dla kolumn stałych (< prefixLen) logical == visible. Dla komponentów i kolumn po nich
   przelicza przez _excelBuildComponentColumns / _excelHiddenColumnIds. */
function _excelGetComponentPrefixLen() {
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
            ? _excelMaxTransitions[_excelActiveTab]
            : 1;
    return 10 + maxTr * 4; // 7 stałych + maxTr*4 przejścia +2 gap +1 właz
}
function _excelGetCellByLogical(row, logicalIdx) {
    if (!row || logicalIdx < 0) return null;
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
            ? _excelMaxTransitions[_excelActiveTab]
            : 1;
    const prefixLen = 10 + maxTr * 4;
    if (logicalIdx < prefixLen) return row.children[logicalIdx] || null;
    if (
        typeof _excelHiddenColumnIds === 'undefined' ||
        !_excelHiddenColumnIds ||
        _excelHiddenColumnIds.length === 0
    )
        return row.children[logicalIdx] || null;
    try {
        const all =
            typeof _excelBuildComponentColumns === 'function' &&
            typeof _excelGetReferenceWell === 'function'
                ? _excelBuildComponentColumns(
                      _excelActiveTab,
                      _excelGetReferenceWell(_excelActiveTab)
                  )
                : null;
        if (!all || all.length === 0) return row.children[logicalIdx] || null;
        const visible =
            typeof _excelFilterVisibleColumns === 'function'
                ? _excelFilterVisibleColumns(all)
                : all;
        const totalHidden = all.length - visible.length;
        const compEnd = prefixLen + all.length;
        if (logicalIdx >= prefixLen && logicalIdx < compEnd) {
            const compLogicalPos = logicalIdx - prefixLen;
            const target = all[compLogicalPos];
            if (!target) return null;
            if (_excelHiddenColumnIds.indexOf(target.id) >= 0) return null;
            let vp = -1;
            for (let i = 0; i < visible.length; i++)
                if (visible[i].id === target.id) {
                    vp = i;
                    break;
                }
            if (vp < 0) return null;
            return row.children[prefixLen + vp] || null;
        }
        if (logicalIdx >= compEnd) return row.children[logicalIdx - totalHidden] || null;
    } catch (_e) {}
    return row.children[logicalIdx] || null;
}
function _excelGetVisibleCell(row, visibleIdx) {
    if (!row || visibleIdx < 0) return null;
    return row.children[visibleIdx] || null;
}

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
function _excelPasteSemantic(lines, visibleRows, map, ctx) {
    // ctx opcjonalny — F1 lokalny cache dla Rodzaj/Średnica
    const _filtered =
        typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
    let _startFilteredIdx = 0;
    if (
        visibleRows &&
        visibleRows.length > 0 &&
        visibleRows[0] &&
        typeof visibleRows[0].getAttribute === 'function'
    ) {
        const firstWIdx = parseInt(visibleRows[0].getAttribute('data-widx'), 10);
        const pos = _filtered.indexOf(firstWIdx);
        if (pos >= 0) _startFilteredIdx = pos;
    }
    for (let si = 0; si < lines.length; si++) {
        const modelWIdx = _filtered[_startFilteredIdx + si];
        if (modelWIdx === undefined || !wells[modelWIdx]) continue;
        const parts = lines[si].split('\t');
        const row = visibleRows ? visibleRows[si] : null;
        for (let ci = 0; ci < parts.length; ci++) {
            const targetCol = map[ci];
            if (targetCol == null) continue;
            const targetVal = parts[ci].replace(/\r/g, '').trim();
            const tdEl = row ? _excelGetCellByLogical(row, targetCol) : null;
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            _excelSetModelCellValue(modelWIdx, targetCol, targetVal, ctx, target);
        }
    }
}
function _excelPasteSemanticBatch(lines, visibleRows, map, doneCallback, ctx) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    if (total < 100) {
        _excelPasteSemantic(lines, visibleRows, map, ctx);
        if (doneCallback) doneCallback();
        return;
    }
    const _filtered =
        typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
    let _startFilteredIdx = 0;
    if (
        visibleRows &&
        visibleRows.length > 0 &&
        visibleRows[0] &&
        typeof visibleRows[0].getAttribute === 'function'
    ) {
        const firstWIdx = parseInt(visibleRows[0].getAttribute('data-widx'), 10);
        const pos = _filtered.indexOf(firstWIdx);
        if (pos >= 0) _startFilteredIdx = pos;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        if (!document.getElementById('excel-table-overlay')) {
            _excelCancelPasteBatch();
            return;
        }
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            const modelWIdx = _filtered[_startFilteredIdx + idx];
            if (modelWIdx === undefined || !wells[modelWIdx]) continue;
            const parts = lines[idx].split('\t');
            const row = visibleRows ? visibleRows[idx] : null;
            for (let ci = 0; ci < parts.length; ci++) {
                const targetCol = map[ci];
                if (targetCol == null) continue;
                const targetVal = parts[ci].replace(/\r/g, '').trim();
                const tdEl = row ? _excelGetCellByLogical(row, targetCol) : null;
                const target = tdEl ? tdEl.querySelector('input, select') : null;
                _excelSetModelCellValue(modelWIdx, targetCol, targetVal, ctx, target);
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
    /* Tylko gdy Excel otwarty i brak innego aktywnego modala */
    if (!document.getElementById('excel-table-overlay')) return;
    if (
        document.activeElement &&
        document.activeElement.closest('.modal-overlay:not(#excel-table-overlay)')
    )
        return;
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
    /* Tylko gdy Excel otwarty i brak innego aktywnego modala */
    if (!document.getElementById('excel-table-overlay')) return;
    if (
        document.activeElement &&
        document.activeElement.closest('.modal-overlay:not(#excel-table-overlay)')
    )
        return;
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
    _excelResetMismatches();
    let _batched = false;
    // F1 lokalny ctx jednego paste — nie global, przekazywany do Sync/Batch/Semantic
    const _pasteCtx = typeof _excelBuildPasteCache === 'function' ? _excelBuildPasteCache() : null;
    const _finishPaste = function () {
        // batch finalize: zachowaj semantykę change handlerów raz dla affected wells (Q1)
        if (_pasteCtx)
            try {
                _excelFinalizePasteAffected(_pasteCtx);
            } catch (_e) {}
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
        // Geometria schowka: pusta komórka = "" nie brak — trim() zjadał wiodące puste wiersze (bug Średnica 2)
        const _raw = text.replace(/\r/g, '');
        let lines = _raw.split('\n');
        if (_raw.endsWith('\n')) lines.pop();
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
                        if (typeof _pasteCtx !== 'undefined' && _pasteCtx)
                            _excelRebuildPasteSeq(_pasteCtx);
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
                                `Rz.wlot ${_pi}`,
                                `Kąt ${_pi}`,
                                `Rodzaj ${_pi}`,
                                `Średnica ${_pi}`
                            );
                        else _pseudo.push(`Rz.wlot ${_pi}`, `Kąt ${_pi}`, `Średnica ${_pi}`);
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
                                if (typeof _pasteCtx !== 'undefined' && _pasteCtx)
                                    _excelRebuildPasteSeq(_pasteCtx);
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
            // Faza A: sort/min origin — najnizszy colIdx wsrod wszystkich zaznaczonych, nie insertion order
            const _allColsFlat = cellList.map(function (c) {
                return c.colIdx;
            });
            const _minCol =
                _allColsFlat.length > 0
                    ? Math.min.apply(null, _allColsFlat)
                    : _excelGetPasteColIdx(rows[0]);
            const _baseColsSorted =
                widxArr.length > 0 && cellRows[_baseWIdx]
                    ? [...cellRows[_baseWIdx]].sort(function (a, b) {
                          return a - b;
                      })
                    : [_minCol];
            const _baseCols = _baseColsSorted;
            /* Przy cell-selection NIE dodawaj nowych wierszy — obetnij do dostępnej liczby W MODELU.
               Licz od _baseWIdx do końca odfiltrowanych studni w modelu. */
            const _filteredSel =
                typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
            const _startPosInFiltered = Math.max(0, _filteredSel.indexOf(_baseWIdx));
            const availableRows = Math.max(0, _filteredSel.length - _startPosInFiltered);
            const visibleRows = _excelGetVisibleRows().filter(function (r) {
                const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                return !isNaN(rWIdx) && rWIdx >= _baseWIdx;
            });
            if (lines.length > availableRows) {
                lines = lines.slice(0, availableRows);
                if (lines.length === 0) {
                    showToast('Kliknij w istniejący wiersz — tu nie ma miejsca', 'warning');
                    return;
                }
                showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
            }
            // Faza A: base row min (nie global) — globalMin dawał poziomy shift przy nieprostokątnej selekcji (H2)
            const _firstCol =
                _baseColsSorted.length > 0 ? Math.min.apply(null, _baseColsSorted) : _minCol;
            /* Użyj batch/sync paste — obsłuż duże zestawy (F1 ctx przekazany, seq w ctx) */
            _batched = lines.length > 100;
            if (_batched) {
                if (_pasteCtx)
                    _excelPasteBatch(lines, visibleRows, _firstCol, _finishPaste, _pasteCtx);
                else _excelPasteBatch(lines, visibleRows, _firstCol, _finishPaste);
            } else {
                if (_pasteCtx) _excelPasteSync(lines, visibleRows, _firstCol, _pasteCtx);
                else _excelPasteSync(lines, visibleRows, _firstCol);
            }
        } else if (_excelSelectedCols.length > 0) {
            const cols = [..._excelSelectedCols].sort(function (a, b) {
                return a - b;
            });
            /* Przy column-selection NIE dodawaj nowych wierszy — obetnij do liczby studni w modelu */
            const _filteredCols =
                typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
            const availableRows = _filteredCols.length;
            if (lines.length > availableRows) {
                lines = lines.slice(0, availableRows);
                if (lines.length === 0) {
                    showToast('Brak studni na tej zakładce', 'warning');
                    return;
                }
                showToast('Wklejono ' + lines.length + ' (obcięte — koniec tabeli)', 'warning');
            }
            const visibleRows = _excelGetVisibleRows();
            _batched = lines.length > 100;
            if (_hasHeader && _semanticMap) {
                if (_batched) {
                    if (_pasteCtx)
                        _excelPasteSemanticBatch(
                            lines,
                            visibleRows,
                            _semanticMap,
                            _finishPaste,
                            _pasteCtx
                        );
                    else _excelPasteSemanticBatch(lines, visibleRows, _semanticMap, _finishPaste);
                } else {
                    if (_pasteCtx) _excelPasteSemantic(lines, visibleRows, _semanticMap, _pasteCtx);
                    else _excelPasteSemantic(lines, visibleRows, _semanticMap);
                }
                if (!_batched) _finishPaste();
                _batched = true;
            } else {
                if (_batched) {
                    if (_pasteCtx)
                        _excelPasteBatch(lines, visibleRows, cols[0] || 3, _finishPaste, _pasteCtx);
                    else _excelPasteBatch(lines, visibleRows, cols[0] || 3, _finishPaste);
                } else {
                    if (_pasteCtx) _excelPasteSync(lines, visibleRows, cols[0] || 3, _pasteCtx);
                    else _excelPasteSync(lines, visibleRows, cols[0] || 3);
                }
                if (!_batched) _finishPaste();
                _batched = true;
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
            /* Pomija wiersze ukryte filtrem wyszukiwarki. Licz wiersze W MODELU od startWIdx. */
            const _filteredDef =
                typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
            const _startPosInFiltered = Math.max(0, _filteredDef.indexOf(startWIdx));
            let availableRows = Math.max(0, _filteredDef.length - _startPosInFiltered);
            const visibleRows = _excelGetVisibleRows().filter(function (r) {
                const rWIdx = parseInt(r.getAttribute('data-widx'), 10);
                return !isNaN(rWIdx) && rWIdx >= startWIdx;
            });
            /* Jeśli wklejamy więcej wierszy niż mamy — auto-utwórz brakujące studnie (paste z zewn. Excela).
               Dotyczy głównie paste w kolumnę nazw (colIdx 3) lub danych z nagłówkiem/zewnętrznym formatem. */
            if (lines.length > availableRows) {
                if (colIdx === 3 || (_hasHeader && _semanticMap)) {
                    const surplus = lines.slice(availableRows);
                    let created = 0;
                    for (let si = 0; si < surplus.length; si++) {
                        const parts = surplus[si].split('\t');
                        const rawName =
                            (parts[0] || '').replace(/\r/g, '').trim() ||
                            'Studnia (' + (wells.length + 1) + ')';
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
                        if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
                        if (typeof _excelInvalidateFilteredIndexes === 'function')
                            _excelInvalidateFilteredIndexes();
                        if (typeof _excelGetMaxTransitions === 'function')
                            _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
                        const _updatedFiltered =
                            typeof _excelGetFilteredIndexes === 'function'
                                ? _excelGetFilteredIndexes()
                                : [];
                        availableRows = Math.max(0, _updatedFiltered.length - _startPosInFiltered);
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
            /* Użyj batch/sync paste — obsłuż duże zestawy; header-aware via semantic map (F1 ctx) */
            _batched = lines.length > 100;
            if (_hasHeader && _semanticMap && Object.keys(_semanticMap).length > 0) {
                if (_batched) {
                    if (_pasteCtx)
                        _excelPasteSemanticBatch(
                            lines,
                            visibleRows,
                            _semanticMap,
                            _finishPaste,
                            _pasteCtx
                        );
                    else _excelPasteSemanticBatch(lines, visibleRows, _semanticMap, _finishPaste);
                } else {
                    if (_pasteCtx) _excelPasteSemantic(lines, visibleRows, _semanticMap, _pasteCtx);
                    else _excelPasteSemantic(lines, visibleRows, _semanticMap);
                }
                if (!_batched) _finishPaste();
                _batched = true; // suppress duplicate _finishPaste in finally
            } else {
                if (_pasteCtx)
                    (_batched ? _excelPasteBatch : _excelPasteSync)(
                        lines,
                        visibleRows,
                        colIdx,
                        _batched ? _finishPaste : null,
                        _pasteCtx
                    );
                else
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
 * @param {*} [ctx] - F1 lokalny cache, przekazywany do _excelSetCellValue
 */
function _excelPasteBatch(lines, visibleRows, startColIdx, doneCallback, ctx) {
    const CHUNK = 50;
    let idx = 0;
    const total = lines.length;
    const seqBatch = ctx && ctx.seq ? ctx.seq : null;
    const startPosBatch = seqBatch ? _excelFindSeqPosByVis(seqBatch, startColIdx) : -1;
    if (total < 100) {
        _excelPasteSync(lines, visibleRows, startColIdx, ctx);
        if (doneCallback) doneCallback();
        return;
    }
    const _filtered =
        typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
    let _startFilteredIdx = 0;
    if (visibleRows && visibleRows.length > 0 && visibleRows[0]) {
        const firstWIdx = parseInt(visibleRows[0].getAttribute('data-widx'), 10);
        const pos = _filtered.indexOf(firstWIdx);
        if (pos >= 0) _startFilteredIdx = pos;
    }
    _excelShowPasteProgress(0, total);
    function tick() {
        if (!document.getElementById('excel-table-overlay')) {
            _excelCancelPasteBatch();
            return;
        }
        const end = Math.min(idx + CHUNK, total);
        for (; idx < end; idx++) {
            const modelWIdx = _filtered[_startFilteredIdx + idx];
            if (modelWIdx === undefined || !wells[modelWIdx]) continue;
            const line = lines[idx];
            const parts = line.split('\t');
            const row = visibleRows ? visibleRows[idx] : null;
            parts.forEach(function (v, ci) {
                let visIdx, logical;
                if (seqBatch && startPosBatch >= 0) {
                    const entry = seqBatch[startPosBatch + ci];
                    if (!entry) return;
                    visIdx = entry.vis;
                    logical = entry.logical;
                } else {
                    visIdx = startColIdx + ci;
                    logical = visIdx;
                }
                const targetVal = v.replace(/\r/g, '').trim();
                const tdEl = row && row.children ? row.children[visIdx] : null;
                const target = tdEl ? tdEl.querySelector('input, select') : null;
                _excelSetModelCellValue(modelWIdx, logical, targetVal, ctx, target);
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

/** Synchroniczne wklejenie (do 99 wierszy). Semantyka A: wklej sekwencyjnie do widocznych TD.
 * @param {string[]} lines
 * @param {HTMLElement[]} visibleRows — widoczne wiersze docelowe (pomijają display:none)
 * @param {number} startColIdx — visibleIdx (row.children index, nie logical)
 * @param {*} [ctx] - F1 lokalny cache
 */
function _excelPasteSync(lines, visibleRows, startColIdx, ctx) {
    const seq = ctx && ctx.seq ? ctx.seq : null;
    const startPos = seq ? _excelFindSeqPosByVis(seq, startColIdx) : -1;
    const _filtered =
        typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : [];
    let _startFilteredIdx = 0;
    if (
        visibleRows &&
        visibleRows.length > 0 &&
        visibleRows[0] &&
        typeof visibleRows[0].getAttribute === 'function'
    ) {
        const firstWIdx = parseInt(visibleRows[0].getAttribute('data-widx'), 10);
        const pos = _filtered.indexOf(firstWIdx);
        if (pos >= 0) _startFilteredIdx = pos;
    }
    for (let si = 0; si < lines.length; si++) {
        const modelWIdx = _filtered[_startFilteredIdx + si];
        if (modelWIdx === undefined || !wells[modelWIdx]) continue;
        const parts = lines[si].split('\t');
        const row = visibleRows ? visibleRows[si] : null;
        parts.forEach(function (v, ci) {
            let visIdx, logical;
            if (seq && startPos >= 0) {
                const entry = seq[startPos + ci];
                if (!entry) return;
                visIdx = entry.vis;
                logical = entry.logical;
            } else {
                visIdx = startColIdx + ci;
                logical = visIdx;
            }
            const targetVal = v.replace(/\r/g, '').trim();
            const tdEl = row && row.children ? row.children[visIdx] : null;
            const target = tdEl ? tdEl.querySelector('input, select') : null;
            _excelSetModelCellValue(modelWIdx, logical, targetVal, ctx, target);
        });
    }
}

/** Zapewnia bezpośredni zapis wartości do modelu studni (obsługuje wirtualizację, gdy brak elementu TR w DOM) */
function _excelSetModelCellValue(wIdx, effLogical, val, ctx, targetElement) {
    if (isNaN(wIdx) || wIdx < 0 || typeof wells === 'undefined' || !wells[wIdx]) return;
    if (typeof _excelIsWellLocked === 'function' && _excelIsWellLocked(wIdx)) return;

    if (targetElement) {
        _excelSetCellValue(targetElement, val, ctx, effLogical);
        return;
    }

    const well = wells[wIdx];
    const valStr = String(val || '').trim();

    if (effLogical === 3) {
        if (valStr) {
            well.name = valStr;
            well.numer = valStr.replace(/ (PRE|UTH)$/i, '').trim();
            if (typeof autoUpdateWellName === 'function') {
                try {
                    autoUpdateWellName(well, wIdx);
                } catch (_e) {}
            }
        }
    } else if (effLogical === 4) {
        const num = parseFloat(valStr.replace(',', '.'));
        well.rzednaWlazu = !isNaN(num) ? num : null;
    } else if (effLogical === 5) {
        const num = parseFloat(valStr.replace(',', '.'));
        well.rzednaDna = !isNaN(num) ? num : null;
    } else if (effLogical >= 7) {
        const maxTr =
            typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
                ? _excelMaxTransitions[_excelActiveTab]
                : 1;
        const trIdx = Math.floor((effLogical - 7) / 4);
        if (trIdx < maxTr) {
            const subType = (effLogical - 7) % 4;
            if (!well.przejscia) well.przejscia = [];
            while (well.przejscia.length <= trIdx) {
                if (typeof _excelCreatePrzejscie === 'function')
                    well.przejscia.push(_excelCreatePrzejscie());
                else
                    well.przejscia.push({
                        productId: '',
                        tempCategory: '',
                        rzednaWlaczenia: null,
                        angle: 0,
                        angleExecution: 0,
                        angleGony: 0,
                        flowType: 'PRZELOT'
                    });
            }
            const prz = well.przejscia[trIdx];
            if (subType === 0) {
                const num = parseFloat(valStr.replace(',', '.'));
                prz.rzednaWlaczenia = !isNaN(num) ? num : null;
            } else if (subType === 1) {
                const num = parseFloat(valStr.replace(',', '.'));
                if (!isNaN(num)) {
                    prz.angle = num;
                    prz.angleExecution = num;
                    prz.angleGony =
                        typeof window !== 'undefined' && typeof window.degToGon === 'function'
                            ? window.degToGon(num)
                            : ((num * 400) / 360).toFixed(2);
                }
            } else if (subType === 2) {
                if (!valStr) {
                    prz.tempCategory = '';
                    prz.productId = '';
                } else if (ctx && (ctx.catLowerMap || ctx.cats)) {
                    // Kanoniczne dopasowanie jak fast-path. Martwe ctx.allCatToCat usunięte —
                    // pole nie istnieje w _excelBuildPasteCache, więc gałąź nigdy nie działała
                    // i surowy tekst ("k2kan") trafiał do tempCategory, psując zakres średnic.
                    const lower = valStr.toLowerCase();
                    let cat = ctx.catLowerMap ? ctx.catLowerMap.get(lower) || null : null;
                    let isExact = !!cat;
                    if (!cat && typeof _excelFindPasteCategory === 'function') {
                        const _fc = _excelFuzzyCatCache(ctx);
                        const _fck = 'paste|' + lower;
                        if (_fc && _fc.has(_fck)) {
                            const _hit = _fc.get(_fck);
                            cat = _hit.cat;
                            isExact = !!cat && cat.toLowerCase() === lower;
                        } else {
                            cat = _excelFindPasteCategory(valStr, ctx.cats);
                            isExact = !!cat && cat.toLowerCase() === lower;
                            if (_fc) _fc.set(_fck, { cat: cat });
                        }
                    }
                    if (!cat) {
                        prz.tempCategory = '';
                        prz.productId = '';
                        _excelRecordMismatch({
                            wIdx: wIdx,
                            colIdx: effLogical,
                            wellName: well.name || 'Studnia DN' + (well.dn || ''),
                            originalVal: String(val),
                            matchedVal: '',
                            matchedText: '',
                            optionsKind: 'cats'
                        });
                    } else {
                        prz.tempCategory = cat;
                        // order-independence jak fast-path: remap productId na ten sam DN
                        // w nowej kategorii zamiast czyszczenia.
                        if (prz.productId && ctx.prodById) {
                            const curProd = ctx.prodById.get(String(prz.productId));
                            if (curProd && curProd.category !== cat) {
                                const curDn = String(curProd.dn || '').replace(/\D/g, '');
                                let remapped = null;
                                if (curDn && ctx.catToProducts) {
                                    const catPool = ctx.catToProducts.get(cat) || [];
                                    for (let _ri = 0; _ri < catPool.length; _ri++) {
                                        if (String(catPool[_ri].dn).replace(/\D/g, '') === curDn) {
                                            remapped = catPool[_ri];
                                            break;
                                        }
                                    }
                                }
                                prz.productId = remapped ? remapped.id : '';
                            }
                        }
                        if (!isExact) {
                            _excelRecordMismatch({
                                wIdx: wIdx,
                                colIdx: effLogical,
                                wellName: well.name || 'Studnia DN' + (well.dn || ''),
                                originalVal: String(val),
                                matchedVal: cat,
                                matchedText: cat,
                                optionsKind: 'cats'
                            });
                        }
                    }
                } else if (typeof _excelFindPasteCategory === 'function') {
                    prz.tempCategory = _excelFindPasteCategory(valStr) || valStr;
                } else {
                    prz.tempCategory = valStr;
                }
            } else if (subType === 3) {
                if (!valStr) {
                    prz.productId = '';
                } else if (ctx && ctx.all) {
                    const poolAll = ctx.all;
                    const curCat = prz.tempCategory;
                    const catPool =
                        curCat && ctx.catToProducts.get(curCat)
                            ? ctx.catToProducts.get(curCat)
                            : null;
                    const searchPool = catPool && catPool.length > 0 ? catPool : poolAll;
                    const poolScoped = !!(catPool && catPool.length > 0);
                    let matched = null;
                    let isExact = false;
                    // exact by id / name — tylko w zakresie kategorii (guard jak fast-path,
                    // inaczej id z obcej kategorii nadpisywało tempCategory).
                    if (ctx.prodById.has(valStr)) {
                        const cand = ctx.prodById.get(valStr);
                        if (searchPool.indexOf(cand) >= 0) {
                            matched = cand;
                            isExact = true;
                        }
                    }
                    if (!matched && ctx.prodByLower.has(valStr.toLowerCase())) {
                        const cand = ctx.prodByLower.get(valStr.toLowerCase());
                        if (searchPool.indexOf(cand) >= 0) {
                            matched = cand;
                            isExact = true;
                        }
                    }
                    const numVal = valStr.replace(/\D/g, '');
                    if (!matched && numVal) {
                        const hits = [];
                        for (let i = 0; i < searchPool.length; i++) {
                            const p = searchPool[i];
                            if (
                                String(p.dn) === numVal ||
                                (p.name && p.name.indexOf(numVal) >= 0)
                            ) {
                                hits.push(p);
                                // Bez zakresu kategorii nie zgadujemy "pierwszego z seeda" —
                                // GRP jest przed K2KAN i cichy strzał psuł dane.
                                if (hits.length > 1 && !poolScoped) break;
                            }
                        }
                        if (hits.length === 1 || (hits.length > 1 && poolScoped)) {
                            matched = hits[0];
                            isExact = String(hits[0].dn) === numVal;
                        }
                    }
                    if (!matched && typeof _excelFindClosestProduct === 'function' && poolScoped) {
                        matched = _excelFindClosestProduct(valStr, searchPool);
                    }
                    if (matched && isExact && _excelForeignIdSignal(ctx, valStr, matched))
                        isExact = false;
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                    }
                    // Gałąź model-only nigdy nie raportowała nie-exact — stąd ciche GRP
                    // omijające modal weryfikacji. Każde nie-exact ląduje w grupach.
                    if (!isExact) {
                        _excelRecordMismatch({
                            wIdx: wIdx,
                            colIdx: effLogical,
                            wellName: well.name || 'Studnia DN' + (well.dn || ''),
                            originalVal: String(val),
                            matchedVal: matched ? matched.id : '',
                            matchedText: matched ? matched.name || 'DN ' + matched.dn : '',
                            optionsKind: 'products',
                            optionsLimit: 300,
                            optionsCat: matched ? matched.category : curCat || null
                        });
                    }
                } else if (
                    typeof _excelFindClosestProduct === 'function' &&
                    typeof studnieProducts !== 'undefined'
                ) {
                    const matched = _excelFindClosestProduct(valStr, studnieProducts);
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                    }
                }
            }
        }
    }

    if (typeof _excelMarkDirty === 'function') {
        try {
            _excelMarkDirty();
        } catch (_e) {}
    }
}

/**
 * Ustawia wartość komórki (input lub select) i dispatchuje eventy.
 * @param {Element} target
 * @param {string} val
 * @param {*} [ctx] - lokalny paste ctx z _excelBuildPasteCache (F1); gdy podany, Rodzaj/Srednica ida fast-path bez dispatch
 * @param {number} [logicalCol] - logical column (dla seq mapping), gdy brak uzyj colIdx
 */
function _excelSetCellValue(target, val, ctx, logicalCol) {
    /* Centralny punkt mutacji — blokada studni z PZ accepted / zamowieniem.
       Obejmuje paste, Delete, Ctrl+X, Ctrl+D, Ctrl+R (wszystkie ida przez to miejsce). */
    const tr = target && target.closest ? target.closest('tr[data-widx]') : null;
    const wIdx = tr ? parseInt(tr.getAttribute('data-widx'), 10) : -1;
    if (!isNaN(wIdx) && _excelIsWellLocked(wIdx)) return;
    const td = target && target.closest ? target.closest('td') : null;
    const colIdx =
        td && td.parentElement ? Array.prototype.indexOf.call(td.parentElement.children, td) : -1;
    const effLogical = typeof logicalCol === 'number' && !isNaN(logicalCol) ? logicalCol : colIdx;
    // F1 fast-path: Rodzaj (2) / Srednica (3) via ctx cache - direct model, bez dispatch, zbierz affected
    if (ctx && ctx.affected && !isNaN(wIdx) && wells[wIdx] && effLogical >= 7) {
        const maxTr =
            typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
                ? _excelMaxTransitions[_excelActiveTab]
                : 1;
        const trIdx = Math.floor((effLogical - 7) / 4);
        if (trIdx >= maxTr) {
            // poza zakresem przejść (gap/Wlaz) — nie traktuj jako Rodzaj/Średnica
        } else {
            const subType = (effLogical - 7) % 4;
            if (subType === 2 || subType === 3) {
                const _valEmpty = !String(val || '').trim();
                const _hasExisting = wells[wIdx].przejscia && trIdx < wells[wIdx].przejscia.length;
                if (!_hasExisting && _valEmpty) return;
                if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
                while (wells[wIdx].przejscia.length <= trIdx) {
                    if (typeof _excelCreatePrzejscie === 'function')
                        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
                    else wells[wIdx].przejscia.push({ productId: '', tempCategory: '' });
                }
                const prz = wells[wIdx].przejscia[trIdx];
                const valStr = String(val || '').trim();
                if (subType === 2) {
                    // Rodzaj — Map exact przed fuzzy
                    if (!valStr) {
                        prz.tempCategory = '';
                        // wyczyść productId gdy kategoria wyczyszczona (jak handler)
                        prz.productId = '';
                        ctx.affected.add(wIdx);
                        return;
                    }
                    const lower = valStr.toLowerCase();
                    let cat = ctx.catLowerMap.get(lower) || null;
                    let isExact = !!cat;
                    if (!cat) {
                        // Cache fuzzy per unikalna wartość — nie per komórka.
                        const _fc = _excelFuzzyCatCache(ctx);
                        const _fck = 'paste|' + lower;
                        if (_fc && _fc.has(_fck)) {
                            const _hit = _fc.get(_fck);
                            cat = _hit.cat;
                            isExact = !!cat && cat.toLowerCase() === lower;
                        } else {
                            cat = _excelFindPasteCategory(valStr, ctx.cats);
                            isExact = !!cat && cat.toLowerCase() === lower;
                            if (_fc) _fc.set(_fck, { cat: cat });
                        }
                    }
                    if (!cat) {
                        prz.tempCategory = '';
                        prz.productId = '';
                        const wellForUnmatchedCategory =
                            wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                        _excelRecordMismatch({
                            wIdx: wIdx,
                            colIdx: colIdx,
                            wellName: wellForUnmatchedCategory,
                            originalVal: String(val),
                            matchedVal: '',
                            matchedText: '',
                            optionsKind: 'cats'
                        });
                        ctx.affected.add(wIdx);
                        return;
                    }
                    prz.tempCategory = cat;
                    // order-independence: gdy kategoria zmienia się po wklejeniu średnicy,
                    // spróbuj remapować istniejący productId na ten sam DN w nowej kategorii
                    // zamiast czyścić (E2/E3). Dzięki temu Paste(Średnica)→Paste(Rodzaj)
                    // daje ten sam wynik co Paste(Rodzaj)→Paste(Średnica).
                    if (prz.productId) {
                        const curProd = ctx.prodById.get(String(prz.productId));
                        if (curProd && curProd.category !== cat) {
                            const curDn = String(curProd.dn || '').replace(/\D/g, '');
                            let remapped = null;
                            if (curDn) {
                                const catPool = ctx.catToProducts.get(cat) || [];
                                for (let _ri = 0; _ri < catPool.length; _ri++) {
                                    if (String(catPool[_ri].dn).replace(/\D/g, '') === curDn) {
                                        remapped = catPool[_ri];
                                        break;
                                    }
                                }
                            }
                            prz.productId = remapped ? remapped.id : '';
                        }
                    }
                    if (!isExact) {
                        const wellForName =
                            wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                        // thin: options leniwie per grupa (modal), nie per komórka
                        _excelRecordMismatch({
                            wIdx: wIdx,
                            colIdx: colIdx,
                            wellName: wellForName,
                            originalVal: String(val),
                            matchedVal: cat,
                            matchedText: cat,
                            optionsKind: 'cats'
                        });
                    }
                    ctx.affected.add(wIdx);
                    return;
                }
                if (subType === 3) {
                    if (!valStr) {
                        prz.productId = '';
                        ctx.affected.add(wIdx);
                        return;
                    }
                    const poolAll = ctx.all;
                    const curCat = prz.tempCategory;
                    const catPool =
                        curCat && ctx.catToProducts.get(curCat)
                            ? ctx.catToProducts.get(curCat)
                            : null;
                    const searchPool = catPool && catPool.length > 0 ? catPool : poolAll;
                    let matched = null;
                    let isExact = false;
                    // exact by id / name lower
                    if (ctx.prodById.has(valStr)) {
                        const cand = ctx.prodById.get(valStr);
                        if (searchPool.indexOf(cand) >= 0) {
                            matched = cand;
                            isExact = true;
                        }
                    }
                    if (!matched) {
                        const low = valStr.toLowerCase();
                        if (ctx.prodByLower.has(low)) {
                            const cand = ctx.prodByLower.get(low);
                            if (searchPool.indexOf(cand) >= 0) {
                                matched = cand;
                                isExact = true;
                            }
                        }
                    }
                    const numVal = valStr.replace(/\D/g, '');
                    // Cache fuzzy per (kategoria, wartość) — linear scan + Levenshtein raz, nie per komórka.
                    const _fpc = _excelFuzzyProdCache(ctx);
                    const _fpk = String(curCat || '') + '|' + valStr.toLowerCase() + '|' + numVal;
                    const _fpHit = _fpc && _fpc.has(_fpk) ? _fpc.get(_fpk) : undefined;
                    if (_fpHit !== undefined && !matched) {
                        if (_fpHit) {
                            const _cand =
                                ctx.prodById.get(_fpHit) ||
                                (typeof getStudnieProductById === 'function'
                                    ? getStudnieProductById(_fpHit)
                                    : null);
                            if (_cand && searchPool.indexOf(_cand) >= 0) {
                                matched = _cand;
                                isExact = _cand.id === valStr || String(_cand.dn) === numVal;
                            }
                        }
                    }
                    if (!matched && numVal && _fpHit === undefined) {
                        // exact digits w searchPool
                        for (let i = 0; i < searchPool.length; i++) {
                            const p = searchPool[i];
                            if (
                                String(p.dn) === numVal ||
                                (p.name && p.name.indexOf(numVal) >= 0)
                            ) {
                                matched = p;
                                isExact = String(p.dn) === numVal;
                                break;
                            }
                        }
                    }
                    if (!matched && _fpHit === undefined) {
                        matched = _excelFindClosestProduct(valStr, searchPool);
                        isExact =
                            matched &&
                            (matched.id === valStr ||
                                matched.name === valStr ||
                                String(matched.dn) === numVal);
                    }
                    if (matched && isExact && _excelForeignIdSignal(ctx, valStr, matched))
                        isExact = false;
                    if (_fpc && _fpHit === undefined) _fpc.set(_fpk, matched ? matched.id : '');
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                        if (!isExact) {
                            const wellForName =
                                wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                            // thin: opcje leniwie per grupa w modalu (pełna lista jak dziś)
                            _excelRecordMismatch({
                                wIdx: wIdx,
                                colIdx: colIdx,
                                wellName: wellForName,
                                originalVal: String(val),
                                matchedVal: matched.id,
                                matchedText: matched.name || 'DN ' + matched.dn,
                                optionsKind: 'products',
                                optionsLimit: 300,
                                optionsCat: matched.category
                            });
                        }
                        ctx.affected.add(wIdx);
                    }
                    return;
                }
            }
        }
    }
    /* Nazwa studni (colIdx 3) — przez paste/fill dozwolona (excelOnNameChange logic), blokuj tylko delete/cut (pusty val). */
    if (colIdx === 3) {
        const clean = String(val || '')
            .replace(/\r/g, '')
            .trim();
        if (!clean) return;
        if (isNaN(wIdx) || !wells[wIdx]) return;
        const well = wells[wIdx];
        well.name = clean;
        well.numer = clean.replace(/ (PRE|UTH)$/i, '').trim();
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
        // Jeśli to Średnica (subType 3) i przejście ma już kategorię (np. PVC SN8 z poprzedniej kolumny paste),
        // a znaleziony opt nie pasuje kategorią — odrzuć go, by fallback wybrał produkt z właściwej kategorii
        if (opt && !isNaN(wIdx) && wells[wIdx] && colIdx >= 7) {
            const _trIdxTmp = Math.floor((colIdx - 7) / 4);
            const _subTypeTmp = (colIdx - 7) % 4;
            if (_subTypeTmp === 3) {
                const _przTmp = wells[wIdx].przejscia && wells[wIdx].przejscia[_trIdxTmp];
                if (_przTmp && _przTmp.tempCategory) {
                    const _prodTmp =
                        typeof studnieProducts !== 'undefined'
                            ? typeof getStudnieProductById === 'function'
                                ? getStudnieProductById(opt.value)
                                : studnieProducts.find((p) => p.id === opt.value)
                            : null;
                    if (_prodTmp && _prodTmp.category !== _przTmp.tempCategory) {
                        opt = null;
                        isClosest = false;
                    }
                }
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
            const maxTrFb =
                typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
                    ? _excelMaxTransitions[_excelActiveTab]
                    : 1;
            const trIdx = Math.floor((colIdx - 7) / 4);
            if (trIdx >= maxTrFb) return; // gap/Wlaz — nie przejście
            const subType = (colIdx - 7) % 4; // 0: rzedna, 1: angle, 2: category, 3: productId
            if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
            while (wells[wIdx].przejscia.length <= trIdx) {
                if (typeof _excelCreatePrzejscie === 'function')
                    wells[wIdx].przejscia.push(_excelCreatePrzejscie());
            }
            const prz = wells[wIdx].przejscia[trIdx];
            const valStr = String(val).trim();
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
                    const wellForName2 = wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                    _excelRecordMismatch({
                        wIdx: wIdx,
                        colIdx: colIdx,
                        wellName: wellForName2,
                        originalVal: valStr,
                        matchedVal: catToSet,
                        matchedText: catToSet,
                        optionsKind: 'cats'
                    });
                }
            } else if (subType === 3) {
                // Średnica (productId/DN) — najbliższa (preferuj kategorię z tego samego przejścia)
                const numVal = valStr.replace(/\D/g, '');
                let matched = null;
                if (typeof studnieProducts !== 'undefined') {
                    const pool = studnieProducts.filter((p) => p.componentType === 'przejscie');
                    const cat = prz.tempCategory;
                    const catPool =
                        cat && pool.some((p) => p.category === cat)
                            ? pool.filter((p) => p.category === cat)
                            : null;
                    const searchPool = catPool && catPool.length > 0 ? catPool : pool;
                    let exact = searchPool.find((p) => p.id === valStr || p.name === valStr);
                    if (!exact && numVal)
                        exact = searchPool.find(
                            (p) => String(p.dn) === numVal || p.name.indexOf(numVal) >= 0
                        );
                    matched = exact || _excelFindClosestProduct(valStr, searchPool);
                    if (matched) {
                        prz.productId = matched.id;
                        prz.tempCategory = matched.category;
                        const isExact =
                            matched.id === valStr ||
                            matched.name === valStr ||
                            String(matched.dn) === numVal;
                        if (!isExact) {
                            const wellForName3 =
                                wells[wIdx].name || 'Studnia DN' + (wells[wIdx].dn || '');
                            _excelRecordMismatch({
                                wIdx: wIdx,
                                colIdx: colIdx,
                                wellName: wellForName3,
                                originalVal: valStr,
                                matchedVal: matched.id,
                                matchedText: matched.name || 'DN ' + matched.dn,
                                optionsKind: 'products',
                                optionsLimit: 0,
                                optionsCat: matched.category
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
