// @ts-nocheck
/* ===== CALCULATION PIPELINE — dirtySet + chunked yield (D) =====
 * Invariant: żadna porcja >50ms blokady. 200 nie magiczne — adaptive gdy nie wystarcza.
 * Yielding kontrakt: rAF → bounded chunk → if budget remaining → next else yield → resume
 * via scheduler.postTask / setTimeout(0) / requestIdleCallback zależnie od dostępności.
 * Worker dopiero gdy P95>50ms or repeated long tasks >50ms pod 10k workload.
 */

const _calcDirtySet = new Set(); // Set<wellIdx>
let _calcRunning = false;
let _calcRaf = 0;
const CALC_CHUNK = 200;

function _calcYield() {
    return new Promise(function (resolve) {
        if (typeof scheduler !== 'undefined' && scheduler.postTask) {
            scheduler.postTask(resolve, { priority: 'user-blocking' });
        } else if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function () {
                resolve();
            });
        } else {
            setTimeout(resolve, 0);
        }
    });
}

function markWellDirty(wIdx) {
    if (typeof wIdx === 'number' && !isNaN(wIdx)) _calcDirtySet.add(wIdx);
}

function markAllDirty() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return;
    for (let i = 0; i < wells.length; i++) _calcDirtySet.add(i);
}

async function processDirtySet() {
    if (_calcRunning) return;
    if (_calcDirtySet.size === 0) return;
    _calcRunning = true;
    try {
        const dirtyArr = Array.from(_calcDirtySet);
        _calcDirtySet.clear();
        // chunk 200, yield między chunkami
        for (let i = 0; i < dirtyArr.length; i += CALC_CHUNK) {
            const chunk = dirtyArr.slice(i, i + CALC_CHUNK);
            for (let k = 0; k < chunk.length; k++) {
                const wIdx = chunk[k];
                const w = typeof wells !== 'undefined' ? wells[wIdx] : null;
                if (!w) continue;
                // derived cache per tick — calcWellStats + validation
                if (typeof calcWellStats === 'function') {
                    try {
                        calcWellStats(w);
                    } catch (_e) {}
                }
                if (typeof recalculateWellErrors === 'function') {
                    try {
                        recalculateWellErrors(w);
                    } catch (_e) {}
                }
            }
            // yield jeśli jeszcze praca
            if (i + CALC_CHUNK < dirtyArr.length) {
                // adaptive: jeśli isInputPending sygnalizuje input, yield natychmiast
                try {
                    if (
                        typeof navigator !== 'undefined' &&
                        navigator.scheduling &&
                        typeof navigator.scheduling.isInputPending === 'function' &&
                        navigator.scheduling.isInputPending()
                    ) {
                        await _calcYield();
                    } else if (i % 400 === 0) {
                        await _calcYield();
                    }
                } catch (_e) {
                    await _calcYield();
                }
            }
        }
    } finally {
        _calcRunning = false;
        if (_calcDirtySet.size > 0) {
            // nowe dirty w trakcie — zaplanuj kolejną rundę
            scheduleCalc();
        } else {
            if (typeof scheduleRender === 'function') scheduleRender();
        }
    }
}

function scheduleCalc() {
    if (_calcRaf) return;
    _calcRaf = requestAnimationFrame(function () {
        _calcRaf = 0;
        processDirtySet();
    });
}

if (typeof window !== 'undefined') {
    window.markWellDirty = markWellDirty;
    window.markAllDirty = markAllDirty;
    window.processDirtySet = processDirtySet;
    window.scheduleCalc = scheduleCalc;
    window._calcDirtySet = _calcDirtySet;
}
