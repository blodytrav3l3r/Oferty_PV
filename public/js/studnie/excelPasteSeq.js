// @ts-check
/* ===== EXCEL PASTE SEQ (mapowanie kolumn logicznych na TD + cache wklejania) ===== */

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
    // SSoT layoutu TD (baza #47, kotwica XL-02): vis tylko dla renderowanych
    // (widoczne minus select/auto), logical po all[] bez zmian. Para: _excelGetCellByLogical.
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
    let renderedCount = 0;
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
    visibleComp.forEach(function (col) {
        const allIdx = allComp.findIndex(function (c) {
            return c.id === col.id;
        });
        if (allIdx < 0) return;
        const logical = prefixLen + allIdx;
        // Kolumny select/auto (np. Wlaz) NIE maja wlasnego TD w sekcji komponentow
        // (tbody je pomija, Wlaz siedzi w prefiksie) — nie dostaja vis, inaczej
        // kazda kolumna za nimi adresowalaby zly TD (off-by-N, baza #47).
        if (col.type === 'select' || col.type === 'auto') return;
        const vis = prefixLen + renderedCount;
        renderedCount++;
        seq.push({ vis: vis, logical: logical, id: col.id });
    });
    // tail: Hdenn, Uszcz, Reduction?, Kineta, PsiaBuda, Akcje — stale, nigdy ukryte
    const hasReduction =
        ['1200', '1500', '2000', '2500', 'styczne'].indexOf(String(_excelActiveTab)) >= 0;
    const tailCount = 2 + (hasReduction ? 1 : 0) + 2 + 1;
    const tailLogicalBase = prefixLen + allComp.length;
    const tailVisBase = prefixLen + renderedCount;
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
    // SSoT layoutu TD (baza #47, kotwica XL-02): ta sama reguła co _excelBuildVisibleSeq
    // (tail korygowany o ukryte + select/auto). Nie zmieniać jednej bez drugiej.
    if (!row || logicalIdx < 0) return null;
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
            ? _excelMaxTransitions[_excelActiveTab]
            : 1;
    const prefixLen = 10 + maxTr * 4;
    if (logicalIdx < prefixLen) return row.children[logicalIdx] || null;
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
        // Renderowane TD sekcji komponentow = widoczne MINUS select/auto
        // (tbody je pomija, Wlaz siedzi w prefiksie) — baza #47.
        const rendered = visible.filter(function (c) {
            return c && c.type !== 'select' && c.type !== 'auto';
        });
        const compEnd = prefixLen + all.length;
        if (logicalIdx >= prefixLen && logicalIdx < compEnd) {
            const target = all[logicalIdx - prefixLen];
            if (!target) return null;
            if (target.type === 'select' || target.type === 'auto') return null;
            if (
                typeof _excelHiddenColumnIds !== 'undefined' &&
                _excelHiddenColumnIds &&
                _excelHiddenColumnIds.indexOf(target.id) >= 0
            )
                return null;
            let vp = -1;
            for (let i = 0; i < rendered.length; i++)
                if (rendered[i].id === target.id) {
                    vp = i;
                    break;
                }
            if (vp < 0) return null;
            return row.children[prefixLen + vp] || null;
        }
        // Tail (staly, nigdy ukryty): korekta o ukryte + pomijane select/auto.
        const hiddenCount = all.length - visible.length;
        const skippedCount = visible.length - rendered.length;
        return row.children[logicalIdx - hiddenCount - skippedCount] || null;
    } catch (_e) {}
    return row.children[logicalIdx] || null;
}
function _excelGetVisibleCell(row, visibleIdx) {
    if (!row || visibleIdx < 0) return null;
    return row.children[visibleIdx] || null;
}

/* ===== BULK-PASTE GUARD: snapshot + rowMap + liczniki (anti-loss) =====
 * SSoT podczas paste: wells[] + pasteFiltered[] (zamrożona mapa adresowania).
 * DOM służy tylko do odczytu aktualnego TR. Brak TR ≠ utrata danych (model-only).
 * Invariant raportu: applied + locked + unsupported === total (mismatches to flaga
 * jakości części applied, nie osobna partycja). */
function _excelSnapshotFiltered() {
    try {
        if (typeof _excelGetFilteredIndexes === 'function') return [..._excelGetFilteredIndexes()];
    } catch (_e) {}
    return [];
}
/* Jednorazowy skan kontenera tabeli na tick → Map<wIdx, TR>. Zakres ograniczony do
 * kontenera (nie document-global), odświeżany co tick (chunk 50). */
function _excelBuildRowMap() {
    const map = new Map();
    try {
        if (typeof document === 'undefined') return map;
        const scope = document.getElementById && document.getElementById('excel-table-container');
        const list =
            scope && scope.querySelectorAll
                ? scope.querySelectorAll('tr[data-widx]')
                : document.querySelectorAll('tr[data-widx]');
        for (let i = 0; i < (list ? list.length : 0); i++) {
            const tr = list[i];
            const w = tr && tr.getAttribute ? parseInt(tr.getAttribute('data-widx'), 10) : NaN;
            if (!isNaN(w) && !map.has(w)) map.set(w, tr);
        }
    } catch (_e) {}
    return map;
}
/* Adresowanie wiersza: najpierw rowMap; pozycyjny fallback TYLKO gdy data-widx
 * się zgadza (bez weryfikacji przy wirtualizacji/filtrze wskazywałby złą studnię). */
function _excelResolvePasteRow(rowMap, visibleRows, si, modelWIdx) {
    if (rowMap) {
        const hit = rowMap.get(modelWIdx);
        if (hit) return hit;
    }
    const cand = visibleRows ? visibleRows[si] : null;
    if (cand && typeof cand.getAttribute === 'function') {
        const w = parseInt(cand.getAttribute('data-widx'), 10);
        if (w === modelWIdx) return cand;
    }
    return null;
}
/* Logical → deskryptor kolumny (układ: 0-6 stałe, 7.. przejścia, 2 gap, właz,
 * komponenty, Hdenn, Uszczelki, [redukcja], kineta, psia buda, akcje). */
function _excelLogicalToColumn(logical) {
    if (typeof logical !== 'number' || isNaN(logical) || logical < 0) return { kind: 'unknown' };
    if (logical <= 2) return { kind: 'structural' };
    if (logical === 3) return { kind: 'name' };
    if (logical === 4) return { kind: 'rzWlazu' };
    if (logical === 5) return { kind: 'rzDna' };
    if (logical === 6) return { kind: 'readonly' };
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
            ? _excelMaxTransitions[_excelActiveTab]
            : 1;
    const prefixLen = 10 + maxTr * 4;
    if (logical >= 7 && logical < 7 + maxTr * 4) {
        return {
            kind: 'przejscie',
            trIdx: Math.floor((logical - 7) / 4),
            subType: (logical - 7) % 4
        };
    }
    if (logical === 7 + maxTr * 4 || logical === 8 + maxTr * 4) return { kind: 'readonly' }; // gap +/- (brak danych)
    if (logical === prefixLen - 1) {
        let products = null;
        try {
            if (
                typeof _excelBuildComponentColumns === 'function' &&
                typeof _excelGetReferenceWell === 'function'
            ) {
                const all = _excelBuildComponentColumns(
                    _excelActiveTab,
                    _excelGetReferenceWell(_excelActiveTab)
                );
                const wlaz = (all || []).find(function (c) {
                    return c.componentType === 'wlaz';
                });
                if (wlaz) products = wlaz.products || [];
            }
        } catch (_e) {}
        return { kind: 'wlaz', products: products };
    }
    try {
        const all =
            typeof _excelBuildComponentColumns === 'function' &&
            typeof _excelGetReferenceWell === 'function'
                ? _excelBuildComponentColumns(
                      _excelActiveTab,
                      _excelGetReferenceWell(_excelActiveTab)
                  )
                : null;
        const compLen = all ? all.length : 0;
        if (logical >= prefixLen && logical < prefixLen + compLen)
            return { kind: 'comp', col: all[logical - prefixLen] };
        const compEnd = prefixLen + compLen;
        if (logical >= compEnd) {
            const hasReduction =
                ['1200', '1500', '2000', '2500', 'styczne'].indexOf(String(_excelActiveTab)) >= 0;
            let t = logical - compEnd; // 0 Hdenn, 1 Uszczelki, … (auto, readonly)
            if (t === 0 || t === 1) return { kind: 'readonly' };
            t -= 2;
            if (hasReduction) {
                if (t === 0) return { kind: 'redukcja' };
                t -= 1;
            }
            if (t === 0) return { kind: 'kineta' };
            if (t === 1) return { kind: 'psia' };
            return { kind: 'readonly' }; // akcje i poza zakresem
        }
    } catch (_e) {}
    return { kind: 'unknown' };
}
function _excelPasteStatsNew() {
    return { total: 0, applied: 0, locked: 0, unsupported: 0 };
}
/* Zliczanie per komórka do ctx.stats (brak ctx = ścieżki fill/cut — bez liczenia). */
function _excelPasteCount(ctx, status) {
    if (!ctx) return status;
    if (!ctx.stats) ctx.stats = _excelPasteStatsNew();
    ctx.stats.total++;
    if (status === 'locked') ctx.stats.locked++;
    else if (status === 'unsupported') ctx.stats.unsupported++;
    else ctx.stats.applied++;
    return status;
}
/* Ciche pominięcia też wchodzą do partycji (jako unsupported — niezastosowane).
 * Obejmuje: wiersz poza snapshotem, kolumnę bez mapy semantycznej, lukę w seq.
 * Bez ctx (fill/cut, stare testy) — no-op. */
function _excelPasteCountSkipped(ctx, n) {
    if (!ctx || !n || n <= 0) return;
    if (!ctx.stats) ctx.stats = _excelPasteStatsNew();
    ctx.stats.total += n;
    ctx.stats.unsupported += n;
}
function _excelResolveWlazProductId(desc, valStr) {
    const v = String(valStr == null ? '' : valStr).trim();
    if (!v) return '';
    const pool = (desc && desc.products) || [];
    for (let i = 0; i < pool.length; i++) if (String(pool[i].id) === v) return pool[i].id;
    const low = v.toLowerCase();
    for (let i = 0; i < pool.length; i++) {
        if (
            String(pool[i].name || '')
                .trim()
                .toLowerCase() === low
        )
            return pool[i].id;
    }
    return null;
}
/* Czy logical leży w zakresie kolumn przejść (7 .. 7+maxTr*4-1).
 * Strażnik ścieżki model-only: bez niego gałąź przejść łapała też kolumny
 * komponentów i tail (wszystkie >= 7) i po cichu gubiła wklejane ilości. */
function _excelModelLogicalIsPrzejscie(effLogical) {
    if (typeof effLogical !== 'number' || isNaN(effLogical) || effLogical < 7) return false;
    const maxTr =
        typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[_excelActiveTab]
            ? _excelMaxTransitions[_excelActiveTab]
            : 1;
    return effLogical < 7 + maxTr * 4;
}
function _excelParsePasteBoolean(valStr) {
    const v = String(valStr == null ? '' : valStr)
        .trim()
        .toLowerCase();
    if (['true', '1', 'tak', 't', 'x', '✓', '✔', 'yes', 'y', 'on'].indexOf(v) >= 0) return true;
    if (['', 'false', '0', 'nie', 'n', 'no', 'off'].indexOf(v) >= 0) return false;
    return null;
}
