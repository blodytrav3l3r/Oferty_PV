// @ts-check
/* ===== BULK MODEL — 9 czystych _bulk* bez DOM/sieci (E7 split z orderBulk.js, move-intact) ===== */
/* ===== BULK PZ MAP — lookup O(1) o semantyce findPzForElement (parity legacy) ===== */

function _bulkPzKeyFor(wellId, elemKey) {
    return 'k\n' + String(wellId) + '\n' + String(elemKey);
}

function _bulkPzIdxFor(wellId, elementIndex) {
    return 'i\n' + String(wellId) + '\n' + String(elementIndex);
}

function _bulkPzStableIdOn() {
    if (
        typeof window !== 'undefined' &&
        window.pzGuard &&
        typeof window.pzGuard.isPzStableIdEnabled === 'function'
    )
        return window.pzGuard.isPzStableIdEnabled();
    if (typeof isPzStableIdEnabled === 'function') return isPzStableIdEnabled();
    return true;
}

/**
 * Buduje mapę PZ: klucz key (wellId+elementKey) i klucz index (wellId+elementIndex).
 * Pierwsze wystąpienie wygrywa — jak list.find w findPzForElement.
 */
function _bulkBuildPzMap(list) {
    const src =
        typeof list !== 'undefined'
            ? list
            : typeof productionOrders !== 'undefined'
              ? productionOrders
              : [];
    const map = new Map();
    if (!Array.isArray(src)) return map;
    for (const po of src) {
        if (!po) continue;
        if (po.elementKey) {
            const k = _bulkPzKeyFor(po.wellId, po.elementKey);
            if (!map.has(k)) map.set(k, po);
        }
        if (typeof po.elementIndex === 'number') {
            const k = _bulkPzIdxFor(po.wellId, po.elementIndex);
            if (!map.has(k)) map.set(k, po);
        }
    }
    return map;
}

/**
 * Status elementu przez mapę: 'accepted' | 'saved' | 'open' — identycznie jak legacy
 * (key przy włączonej fladze, potem fallback na index).
 */
function _bulkElementStatus(el, pzMap) {
    const wellId = el && el.well ? el.well.id : undefined;
    const elemKey = el && el.configItem ? el.configItem._elemId : undefined;
    const elementIndex = el ? el.elementIndex : undefined;
    let hit;
    if (_bulkPzStableIdOn() && elemKey) hit = pzMap.get(_bulkPzKeyFor(wellId, elemKey));
    if (!hit && typeof elementIndex === 'number')
        hit = pzMap.get(_bulkPzIdxFor(wellId, elementIndex));
    if (!hit) return 'open';
    return hit.status === 'accepted' ? 'accepted' : 'saved';
}

/* ===== BULK SEQ — model kolejności bez DOM (parity z popupem legacy) ===== */

/**
 * Dzieli kolejność na segmenty: active (do generowania) + excluded + disabled.
 * Nieznana studnia lub openCount 0 → disabled (nie generuj).
 */
function _bulkSeqPartition(order, groups, excluded) {
    const active = [];
    const excl = [];
    const dis = [];
    for (const w of order || []) {
        const g = groups ? groups.get(w) : undefined;
        if (!g || g.openCount === 0) dis.push(w);
        else if (excluded && excluded.has(w)) excl.push(w);
        else active.push(w);
    }
    return { active: active, excluded: excl, disabled: dis };
}

/** Ruch drag/drop na kopii kolejności (no-op przy braku from/to lub tym samym). */
function _bulkSeqMove(order, from, to, after) {
    const next = (order || []).slice();
    if (from === to) return next;
    const fromIdx = next.indexOf(from);
    const toIdx = next.indexOf(to);
    if (fromIdx < 0 || toIdx < 0) return next;
    next.splice(fromIdx, 1);
    next.splice(next.indexOf(to) + (after ? 1 : 0), 0, from);
    return next;
}

/** Płaska kolejność: active + excluded + disabled (rosnąco, jak legacy). */
function _bulkSeqFlat(order, groups, excluded) {
    const p = _bulkSeqPartition(order, groups, excluded);
    return p.active.concat(
        p.excluded,
        p.disabled.slice().sort((a, b) => a - b)
    );
}

/** Numery kolejności aktywnych (1-based) do wyświetlenia w popupie. */
function _bulkSeqActiveNumbers(order, groups, excluded) {
    const p = _bulkSeqPartition(order, groups, excluded);
    const nums = new Map();
    p.active.forEach((w, i) => nums.set(w, i + 1));
    return nums;
}

window._bulkBuildPzMap = _bulkBuildPzMap;
window._bulkElementStatus = _bulkElementStatus;
window._bulkSeqPartition = _bulkSeqPartition;
window._bulkSeqMove = _bulkSeqMove;
window._bulkSeqFlat = _bulkSeqFlat;
window._bulkSeqActiveNumbers = _bulkSeqActiveNumbers;
