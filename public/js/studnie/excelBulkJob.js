// @ts-check
/* ===== EXCEL BULK JOB — unified pipeline dla 10k (Faza3) =====
 * Jeden scheduler dla paste / create / solver / delete / update.
 * Zasada: max ~16-50ms pracy między yieldami, progress + cancel + abort signal.
 * Ponytail: 1 plik zamiast 5 chunkerów.
 */
let _excelBulkAbort = null;
let _excelBulkRaf = null;

function _excelBulkIsAborted(signal) {
    return signal && signal.aborted;
}

function _excelBulkShowProgress(label, done, total, onCancel) {
    let el = document.getElementById('excel-paste-progress');
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    if (!el) {
        el = document.createElement('div');
        el.id = 'excel-paste-progress';
        el.style.cssText =
            'position:fixed;bottom:1rem;right:1rem;z-index:' +
            (typeof LAYERS !== 'undefined' ? LAYERS.TOAST : 9999) +
            ';background:var(--bg-card, #1e293b);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.75rem 1rem;min-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
        document.body.appendChild(el);
    }
    el.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;"><span style="font-size:12px;color:#94a3b8;">' +
        (label || 'Przetwarzanie...') +
        ' <span id="excel-paste-pct">' +
        pct +
        '%</span></span><span style="font-size:12px;color:#94a3b8;" id="excel-paste-count">' +
        done +
        ' / ' +
        total +
        '</span></div><div style="height:4px;background:#0f172a;border-radius:2px;overflow:hidden;margin-bottom:0.5rem;"><div id="excel-paste-bar" style="height:100%;width:' +
        pct +
        '%;background:linear-gradient(90deg,var(--accent, #3b82f6),var(--success, #22c55e));transition:width 0.15s;"></div></div>' +
        (onCancel
            ? '<button id="excel-bulk-cancel" style="font-size:11px;padding:0.25rem 0.6rem;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#e2e8f0;cursor:pointer;">Anuluj</button>'
            : '');
    const cancelBtn = document.getElementById('excel-bulk-cancel');
    if (cancelBtn && onCancel) cancelBtn.onclick = onCancel;
}

function _excelBulkHideProgress() {
    const el = document.getElementById('excel-paste-progress');
    if (el) el.remove();
}

function _excelBulkCancel() {
    if (_excelBulkAbort && !_excelBulkAbort.aborted) _excelBulkAbort.abort();
    if (_excelBulkRaf) {
        cancelAnimationFrame(_excelBulkRaf);
        _excelBulkRaf = null;
    }
    _excelBulkHideProgress();
}

/**
 * Uruchom pipeline chunkowany. processChunk(start,end,signal) może być async.
 * Yielduje co chunk via rAF, sprawdza abort, aktualizuje progress.
 * @returns {Promise<{aborted:boolean, done:number}>}
 */
async function _excelRunBulkJob(opts) {
    const total = opts.total || 0;
    const chunkSize = opts.chunkSize || 200;
    const label = opts.label || 'Przetwarzanie...';
    const onChunk = opts.onChunk;
    const signal = opts.signal || (_excelBulkAbort ? _excelBulkAbort.signal : null);
    const onProgress = opts.onProgress;
    if (total <= 0) return { aborted: false, done: 0 };
    let done = 0;
    let aborted = false;
    const updateProgress = function () {
        if (onProgress) onProgress(done, total);
        _excelBulkShowProgress(label, done, total, function () {
            if (_excelBulkAbort) _excelBulkAbort.abort();
        });
    };
    updateProgress();
    for (let start = 0; start < total; start += chunkSize) {
        if (_excelBulkIsAborted(signal)) {
            aborted = true;
            break;
        }
        if (!document.getElementById('excel-table-overlay')) {
            aborted = true;
            break;
        }
        const end = Math.min(start + chunkSize, total);

        await onChunk(start, end, signal);
        done = end;
        updateProgress();
        if (end < total) {
            // yield do następnej klatki

            await new Promise(function (resolve) {
                _excelBulkRaf = requestAnimationFrame(function () {
                    _excelBulkRaf = null;
                    resolve();
                });
            });
        }
        if (_excelBulkIsAborted(signal)) {
            aborted = true;
            break;
        }
    }
    _excelBulkHideProgress();
    return { aborted: aborted, done: done };
}

function _excelNewBulkAbort() {
    if (typeof AbortController !== 'undefined') {
        _excelBulkAbort = new AbortController();
        return _excelBulkAbort;
    }
    // fallback dla środowisk bez AbortController — signal jako prosty obiekt
    const sig = { aborted: false };
    _excelBulkAbort = {
        signal: sig,
        get aborted() {
            return sig.aborted;
        },
        abort: function () {
            sig.aborted = true;
            this.aborted = true;
        }
    };
    return _excelBulkAbort;
}

if (typeof window !== 'undefined') {
    window._excelBulkShowProgress = _excelBulkShowProgress;
    window._excelBulkHideProgress = _excelBulkHideProgress;
    window._excelBulkCancel = _excelBulkCancel;
    window._excelRunBulkJob = _excelRunBulkJob;
    window._excelNewBulkAbort = _excelNewBulkAbort;
    window._excelBulkIsAborted = _excelBulkIsAborted;
}
