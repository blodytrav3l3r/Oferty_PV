/**
 * P1-B parity: Excel virtual OFF vs ON — ten sam scenariusz, ten sam stan.
 * SSoT: wells + undo. Operacje na logicznych indeksach, nie na elementach DOM.
 *
 * Pokrycie macierzy: render slice (logicalRow<->wIdx), scroll, edit widocznego
 * wiersza, undo (Faza 1) + selection/copy/paste (Faza 2) + search/tab/sort
 * + selection-po-filtrze/edit-po-sorcie (Faza 3/3b). Sticky: przez parytet
 * DOM (slice == prefiks OFF), nie osobny case.
 *
 * Run:   node tests/playwright/excelVirtualParity.cjs
 * Env:   BASE_URL=http://localhost:3000
 * Wymaga: backend na localhost:3000
 * Exit:  0 = parity OK, 1 = rozjazd lub blad
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const N = 600; // >500 = virtual auto-ON (bez flagi)

const fs = require('fs');
const path = require('path');
const {
    chromeLaunchOptions,
    getLaunchArgs,
    resolveOutPath,
    applyThrottle
} = require('./throttleHelper.cjs');

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    console.error('Cannot find playwright.');
    process.exitCode = 1;
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();

const OUT_DEFAULT = path.join(__dirname, '../../docs/plans/parity-excel-virtual-600.json');
const OUT = resolveOutPath(OUT_DEFAULT);

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function buildWells(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        arr.push({
            id: 'vp' + i,
            name: 'VP-' + String(i + 1).padStart(3, '0'),
            dn: '1000',
            rzednaWlazu: 2.0 + i,
            rzednaDna: 0.5,
            przejscia: [],
            config: [],
            autoSelect: false,
            configSource: 'MANUAL',
            kineta: '',
            psiaBuda: false,
            magazyn: 'Kluczbork'
        });
    }
    return arr;
}

/** Faza 2 (wywolywana z Node dla prawdziwych trusted events): selection + copy + paste. */
async function runSelectionPhase(frame, page) {
    const sel = (w, c) => `tr[data-widx="${w}"] td:nth-child(${c + 1})`;
    await frame.click(sel(0, 4));
    // przyczyna: DOM — stan selekcji (_excelSelectedCells) po clicku; warunek zamiast snu.
    await frame
        .waitForFunction(
            () => {
                try {
                    return (
                        typeof _excelSelectedCells !== 'undefined' &&
                        _excelSelectedCells.length === 1
                    );
                } catch (_) {
                    return false;
                }
            },
            null,
            { timeout: 10000 }
        )
        .catch(() => {});
    await frame.click(sel(3, 4), { modifiers: ['Shift'] });
    // przyczyna: DOM — zakres Shift-click (4 komórki) zamiast snu.
    await frame
        .waitForFunction(
            () => {
                try {
                    return (
                        typeof _excelSelectedCells !== 'undefined' &&
                        _excelSelectedCells.length === 4
                    );
                } catch (_) {
                    return false;
                }
            },
            null,
            { timeout: 10000 }
        )
        .catch(() => {});
    const selState = await frame.evaluate(() => ({
        count: typeof _excelSelectedCells !== 'undefined' ? _excelSelectedCells.length : -1,
        cells: (typeof _excelSelectedCells !== 'undefined' ? _excelSelectedCells : [])
            .map((c) => c.wIdx + ':' + c.colIdx)
            .sort()
            .join(',')
    }));
    await frame.evaluate(() => {
        window.__excelParityClipboard = '';
        document.addEventListener(
            'copy',
            (event) => {
                window.__excelParityClipboard = event.clipboardData
                    ? event.clipboardData.getData('text/plain')
                    : '';
            },
            { once: true }
        );
    });
    await page.keyboard.press('Control+c');
    const copyText = await frame.evaluate(() => window.__excelParityClipboard);
    await frame.click(sel(10, 4));
    // przyczyna: DOM — nowa kotwica selekcji przed paste; warunek zamiast snu.
    await frame
        .waitForFunction(
            () => {
                try {
                    return (
                        typeof _excelSelectedCells !== 'undefined' &&
                        _excelSelectedCells.length === 1
                    );
                } catch (_) {
                    return false;
                }
            },
            null,
            { timeout: 10000 }
        )
        .catch(() => {});
    const targetRowsBefore = await frame.evaluate(() => {
        const canonicalize = (value) => {
            if (Array.isArray(value)) return value.map(canonicalize);
            if (!value || typeof value !== 'object') return value;
            return Object.keys(value)
                .filter(
                    (key) =>
                        !key.startsWith('__') &&
                        key !== '_discountCorrupt' &&
                        key !== '_pricingError'
                )
                .sort()
                .reduce((result, key) => {
                    result[key] = canonicalize(value[key]);
                    return result;
                }, {});
        };
        return JSON.stringify(canonicalize(wells.slice(10, 14)));
    });
    await page.keyboard.press('Control+v');
    await frame.waitForFunction(
        () =>
            typeof _excelPasteInProgress !== 'undefined' &&
            !_excelPasteInProgress &&
            wells[10]?.rzednaWlazu === 2 &&
            wells[13]?.rzednaWlazu === 5,
        null,
        { timeout: 10000 }
    );
    const after = await frame.evaluate(() => {
        const djb2 = (s) => {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return String(h >>> 0);
        };
        const canonicalize = (value) => {
            if (Array.isArray(value)) return value.map(canonicalize);
            if (!value || typeof value !== 'object') return value;
            return Object.keys(value)
                .filter(
                    (key) =>
                        !key.startsWith('__') &&
                        key !== '_discountCorrupt' &&
                        key !== '_pricingError'
                )
                .sort()
                .reduce((result, key) => {
                    result[key] = canonicalize(value[key]);
                    return result;
                }, {});
        };
        return {
            wellsHashAfterPaste: djb2(JSON.stringify(canonicalize(wells))),
            undoLen: typeof _excelUndoStack !== 'undefined' ? _excelUndoStack.length : -1,
            pastedValues: [10, 11, 12, 13].map((i) => wells[i] && wells[i].rzednaWlazu),
            targetRowsAfterPaste: JSON.stringify(canonicalize(wells.slice(10, 14)))
        };
    });
    const undone = await frame.evaluate((beforeRows) => {
        const djb2 = (s) => {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return String(h >>> 0);
        };
        const canonicalize = (value) => {
            if (Array.isArray(value)) return value.map(canonicalize);
            if (!value || typeof value !== 'object') return value;
            return Object.keys(value)
                .filter(
                    (key) =>
                        !key.startsWith('__') &&
                        key !== '_discountCorrupt' &&
                        key !== '_pricingError'
                )
                .sort()
                .reduce((result, key) => {
                    result[key] = canonicalize(value[key]);
                    return result;
                }, {});
        };
        _excelUndo();
        return {
            wellsHashAfterUndo2: djb2(JSON.stringify(canonicalize(wells))),
            undoLenAfterUndo: _excelUndoStack.length,
            undoRestoredTargets: JSON.stringify(canonicalize(wells.slice(10, 14))) === beforeRows,
            targetRowsAfterUndo: JSON.stringify(canonicalize(wells.slice(10, 14)))
        };
    }, targetRowsBefore);
    const redone = await frame.evaluate((expectedRows) => {
        const canonicalize = (value) => {
            if (Array.isArray(value)) return value.map(canonicalize);
            if (!value || typeof value !== 'object') return value;
            return Object.keys(value)
                .filter(
                    (key) =>
                        !key.startsWith('__') &&
                        key !== '_discountCorrupt' &&
                        key !== '_pricingError'
                )
                .sort()
                .reduce((result, key) => {
                    result[key] = canonicalize(value[key]);
                    return result;
                }, {});
        };
        _excelRedo();
        return {
            redoRestoredPaste: JSON.stringify(canonicalize(wells.slice(10, 14))) === expectedRows,
            redoLen: _excelRedoStack.length
        };
    }, after.targetRowsAfterPaste);
    await frame.evaluate(() => {
        const container = document.getElementById('excel-table-container');
        container.scrollTop = 0;
        _excelUndoStack = [];
        _excelRedoStack = [];
    });
    await frame.waitForFunction(() => !!document.querySelector('tr[data-widx="23"]'), null, {
        timeout: 10000
    });
    await frame.click(sel(20, 4));
    await frame.waitForFunction(() => _excelSelectedCells.length === 1, null, { timeout: 10000 });
    await frame.click(sel(23, 4), { modifiers: ['Shift'] });
    await frame.waitForFunction(() => _excelSelectedCells.length === 4, null, { timeout: 10000 });
    await page.keyboard.press('Control+c');
    await frame.evaluate(() => {
        const container = document.getElementById('excel-table-container');
        container.scrollTop = container.scrollHeight;
    });
    await frame
        .waitForFunction(
            () => {
                const row = document.querySelector('#excel-table-container tbody tr[data-widx]');
                return row && parseInt(row.getAttribute('data-widx'), 10) > 0;
            },
            null,
            { timeout: 10000 }
        )
        .catch(() => {});
    const columnPaste = await frame.evaluate(() => {
        _excelSelectedCells = [];
        _excelSelectCol(4, false, false);
        const visible = _excelGetVisibleRows();
        const startWIdx =
            visible.length > 0 ? parseInt(visible[0].getAttribute('data-widx'), 10) : 0;
        const canonicalize = (value) => {
            if (Array.isArray(value)) return value.map(canonicalize);
            if (!value || typeof value !== 'object') return value;
            return Object.keys(value)
                .filter(
                    (key) =>
                        !key.startsWith('__') &&
                        key !== '_discountCorrupt' &&
                        key !== '_pricingError'
                )
                .sort()
                .reduce((result, key) => {
                    result[key] = canonicalize(value[key]);
                    return result;
                }, {});
        };
        return {
            startWIdx,
            targetRowsBefore: JSON.stringify(canonicalize(wells.slice(startWIdx, startWIdx + 4)))
        };
    });
    await page.keyboard.press('Control+v');
    await frame.waitForFunction(
        ({ startWIdx }) =>
            !_excelPasteInProgress &&
            wells[startWIdx]?.rzednaWlazu === 22 &&
            wells[startWIdx + 3]?.rzednaWlazu === 25,
        columnPaste,
        { timeout: 10000 }
    );
    const columnUndo = await frame.evaluate((target) => {
        const canonicalize = (value) => {
            if (Array.isArray(value)) return value.map(canonicalize);
            if (!value || typeof value !== 'object') return value;
            return Object.keys(value)
                .filter(
                    (key) =>
                        !key.startsWith('__') &&
                        key !== '_discountCorrupt' &&
                        key !== '_pricingError'
                )
                .sort()
                .reduce((result, key) => {
                    result[key] = canonicalize(value[key]);
                    return result;
                }, {});
        };
        const changed = JSON.stringify(
            canonicalize(wells.slice(target.startWIdx, target.startWIdx + 4))
        );
        _excelUndo();
        return {
            changed,
            restored:
                JSON.stringify(
                    canonicalize(wells.slice(target.startWIdx, target.startWIdx + 4))
                ) === target.targetRowsBefore,
            undoLen: _excelUndoStack.length
        };
    }, columnPaste);
    const transitionPaste = await frame.evaluate(() => {
        const before = wells.map((well) =>
            well && Array.isArray(well.przejscia) ? structuredClone(well.przejscia) : null
        );
        const activeTab = _excelActiveTab;
        _excelMaxTransitions[activeTab] = 1;
        const matchingCount = wells.filter((well) => _excelWellMatchesTab(well, activeTab)).length;
        const header = ['Rz. Wlazu', 'Rz. Dna'];
        const values = ['2', '0.5'];
        for (let index = 0; index < 4; index++) {
            header.push(`Rz wlot ${index}`, `Kat ${index}`, `Rodzaj ${index}`, `Średnica ${index}`);
            values.push('', '', '', '');
        }
        const text = header.join('\t') + '\n' + values.join('\t');
        _excelSelectedCells = [];
        _excelSelectedCols = [3];
        _excelUndoStack = [];
        _excelRedoStack = [];
        _excelHandlePaste({
            clipboardData: { getData: () => text },
            preventDefault() {},
            stopPropagation() {}
        });
        return {
            before,
            activeTab,
            matchingCount,
            maxTransitions: _excelMaxTransitions[activeTab]
        };
    });
    await frame.waitForFunction(
        () => typeof _excelPasteInProgress !== 'undefined' && !_excelPasteInProgress,
        null,
        { timeout: 10000 }
    );
    const transitionAfterPaste = await frame.evaluate(() => ({
        count: wells.filter((well) => well && well.przejscia && well.przejscia.length >= 4).length,
        undoLen: _excelUndoStack.length
    }));
    const transitionUndo = await frame.evaluate((state) => {
        const before = state.before;
        _excelUndo();
        const restored = before.every((passages, index) => {
            const current =
                wells[index] && Array.isArray(wells[index].przejscia)
                    ? wells[index].przejscia
                    : null;
            return JSON.stringify(current) === JSON.stringify(passages);
        });
        const restoredCount = wells.filter(
            (well) => well && well.przejscia && well.przejscia.length >= 4
        ).length;
        const maxTransitionsAfterUndo = _excelMaxTransitions[state.activeTab];
        _excelRedo();
        const redoCount = wells.filter(
            (well) => well && well.przejscia && well.przejscia.length >= 4
        ).length;
        return {
            restored,
            restoredCount,
            redoCount,
            maxTransitionsAfterUndo,
            maxTransitionsAfterRedo: _excelMaxTransitions[state.activeTab]
        };
    }, transitionPaste);
    return {
        ...selState,
        copyText,
        ...after,
        ...undone,
        ...redone,
        columnPaste,
        columnUndo,
        transitionPaste,
        transitionAfterPaste,
        transitionUndo
    };
}

/** Faza 3: search/tab/sort/selection-after-filter/edit-after-sort (model/hash). */
async function runFilterSortPhase(frame) {
    const out = await frame.evaluate(async () => {
        const res = { errors: [] };
        const djb2 = (s) => {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return String(h >>> 0);
        };
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const domOrder = () =>
            [...document.querySelectorAll('#excel-table-container tbody tr[data-widx]')]
                .filter((r) => r.style.display !== 'none')
                .map((r) => r.getAttribute('data-widx'));
        const top = async () => {
            const cont = document.getElementById('excel-table-container');
            if (cont) cont.scrollTop = 0;
            await wait(400);
        };
        const filtLen = () =>
            typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes().length : -1;
        const data = [];
        for (let i = 0; i < 600; i++) {
            const scramble = (i * 137) % 600;
            data.push({
                id: 'mx' + i,
                name: 'VP-' + String(scramble + 1).padStart(3, '0'),
                dn: i % 2 === 0 ? '1000' : '1500',
                rzednaWlazu: 2.0,
                rzednaDna: 0.5,
                przejscia: [],
                config: [],
                autoSelect: false,
                configSource: 'MANUAL',
                kineta: '',
                psiaBuda: false,
                magazyn: 'Kluczbork'
            });
        }
        try {
            if (typeof _excelCloseOverlay === 'function') _excelCloseOverlay();
            await wait(400);
            // eslint-disable-next-line no-global-assign
            wells = data;
            openExcelTableModal();
            await wait(1500);
            excelSwitchTab('1500');
            await wait(600);
            res.tab1500 = { filt: filtLen(), domCount: domOrder().length };
            excelSwitchTab('1000');
            await wait(600);
            res.tab1000 = { filt: filtLen(), domCount: domOrder().length };
            const doSearch = async (q) => {
                const si = document.getElementById('excel-search-input');
                if (si) {
                    si.value = q;
                    si.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    excelFilterWells(q);
                }
                await wait(700);
            };
            await doSearch('VP-1');
            await top();
            res.search = { filt: filtLen(), dom: domOrder() };
            excelClearSearch();
            await wait(600);
            res.clearSearch = { filt: filtLen() };
            _excelSetSort(3);
            await wait(400);
            await top();
            res.sortAsc = { dom: domOrder() };
            _excelSetSort(3);
            await wait(400);
            await top();
            res.sortDesc = { dom: domOrder() };
            _excelSetSort(3);
            await wait(400);
            res.sortClear = { dom: domOrder().slice(0, 5) };
            await doSearch('VP-1');
            _excelSetSort(3);
            await wait(400);
            await top();
            res.searchSort = { filt: filtLen(), dom: domOrder() };
            excelClearSearch();
            await wait(500);
            // Normalizacja kolejnosci przed dalszymi krokami (re-render naturalny).
            excelSwitchTab('1500');
            await wait(500);
            excelSwitchTab('1000');
            await wait(500);
            res.visNatural = domOrder().slice(0, 5);
        } catch (e) {
            res.errors.push(String((e && e.stack) || (e && e.message) || e));
        }
        return res;
    });
    return out;
}

/** Faza 3b (Node, trusted clicki): selection po filtrze + edit pierwszego wiersza. */
async function runFilterSortInteract(frame, page) {
    const out = {};
    const sel = (w, c) => `tr[data-widx="${w}"] td:nth-child(${c + 1})`;
    const vis = await frame.evaluate(() =>
        [...document.querySelectorAll('#excel-table-container tbody tr[data-widx]')]
            .slice(0, 5)
            .map((r) => r.getAttribute('data-widx'))
    );
    await frame.click(sel(vis[0], 3));
    // przyczyna: DOM — kotwica selekcji po filtrze; warunek zamiast snu.
    await frame
        .waitForFunction(
            () => {
                try {
                    return (
                        typeof _excelSelectedCells !== 'undefined' &&
                        _excelSelectedCells.length === 1
                    );
                } catch (_) {
                    return false;
                }
            },
            null,
            { timeout: 10000 }
        )
        .catch(() => {});
    await frame.click(sel(vis[2], 3), { modifiers: ['Shift'] });
    // przyczyna: DOM — zakres Shift-click po filtrze (3 komórki); warunek zamiast snu.
    await frame
        .waitForFunction(
            () => {
                try {
                    return (
                        typeof _excelSelectedCells !== 'undefined' &&
                        _excelSelectedCells.length === 3
                    );
                } catch (_) {
                    return false;
                }
            },
            null,
            { timeout: 10000 }
        )
        .catch(() => {});
    const fin = await frame.evaluate(() => {
        const djb2 = (s) => {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return String(h >>> 0);
        };
        const firstW = document
            .querySelector('#excel-table-container tbody tr[data-widx]')
            .getAttribute('data-widx');
        const row = document.querySelector('tr[data-widx="' + firstW + '"]');
        const inpW = row ? row.querySelector('input[data-field="rzednaWlazu"]') : null;
        const inpD = row ? row.querySelector('input[data-field="rzednaDna"]') : null;
        if (inpW) inpW.value = '9.9';
        if (inpD) inpD.value = '1.0';
        excelOnRzednaChange(parseInt(firstW, 10));
        return { editWidx: firstW, wellsHash: null, _w: firstW };
    });
    // przyczyna: debounce — excelOnRzednaChange z odroczonym refreshem;
    // brak pojedynczego warunku DOM (re-render + przeliczenie błędów).
    await page.waitForTimeout(1200);
    const hash = await frame.evaluate(() => {
        const djb2 = (s) => {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return String(h >>> 0);
        };
        return {
            wellsHash: djb2(
                JSON.stringify(wells, function (k, v) {
                    return k && k.indexOf('__') === 0 ? undefined : v;
                })
            ),
            selCells: (typeof _excelSelectedCells !== 'undefined' ? _excelSelectedCells : [])
                .map((cl) => cl.wIdx + ':' + cl.colIdx)
                .sort()
                .join(',')
        };
    });
    return { ...fin, ...hash };
}

async function runMode(frame, page, virtualOn, wellsData) {
    const state = await frame.evaluate(
        async ({ vOn, data }) => {
            const out = { errors: [] };
            const djb2 = (s) => {
                let h = 5381;
                for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
                return String(h >>> 0);
            };
            try {
                if (vOn) localStorage.removeItem('sok_excel_virtual');
                else localStorage.setItem('sok_excel_virtual', '0');
                // eslint-disable-next-line no-global-assign
                wells = data;
                openExcelTableModal();
                await new Promise((r) => setTimeout(r, 1500));
                const virtActive =
                    typeof window._excelVirtualIsEnabled === 'function'
                        ? !!window._excelVirtualIsEnabled()
                        : null;
                out.virtActive = virtActive;

                const rows = () => [
                    ...document.querySelectorAll('#excel-table-container tbody tr[data-widx]')
                ];
                out.rowsInitial = rows().length;
                const first = rows()[0];
                out.firstWidx = first ? first.getAttribute('data-widx') : null;
                out.firstLogical = first ? first.getAttribute('data-logical-row') : null;

                // scroll na dol
                const cont = document.getElementById('excel-table-container');
                if (cont) {
                    cont.scrollTop = cont.scrollHeight;
                    await new Promise((r) => setTimeout(r, 500));
                }
                const rowsAfter = rows();
                out.rowsAfterScroll = rowsAfter.length;
                out.firstWidxAfterScroll = rowsAfter[0]
                    ? rowsAfter[0].getAttribute('data-widx')
                    : null;
                out.scrollTop = cont ? cont.scrollTop : -1;

                // wroc na gore, edytuj wiersz logiczny 0 (wIdx z pierwszego TR)
                if (cont) {
                    cont.scrollTop = 0;
                    await new Promise((r) => setTimeout(r, 500));
                }
                const topRows = rows();
                const wIdx = topRows[0] ? parseInt(topRows[0].getAttribute('data-widx'), 10) : -1;
                out.editWidx = wIdx;
                const row = document.querySelector('tr[data-widx="' + wIdx + '"]');
                const inpW = row ? row.querySelector('input[data-field="rzednaWlazu"]') : null;
                const inpD = row ? row.querySelector('input[data-field="rzednaDna"]') : null;
                if (inpW) inpW.value = '5.5';
                if (inpD) inpD.value = '1.0';
                const undoBefore =
                    typeof _excelUndoStack !== 'undefined' ? _excelUndoStack.length : -1;
                excelOnRzednaChange(wIdx);
                await new Promise((r) => setTimeout(r, 1200)); // debounced refresh
                out.undoAfterEdit =
                    typeof _excelUndoStack !== 'undefined' ? _excelUndoStack.length : -1;
                out.undoBefore = undoBefore;
                out.wellsHashAfterEdit = djb2(
                    JSON.stringify(wells, function (k, v) {
                        return k && k.indexOf('__') === 0 ? undefined : v;
                    })
                );
                out.editedWell = { rzednaWlazu: wells[wIdx] && wells[wIdx].rzednaWlazu };

                _excelUndo();
                await new Promise((r) => setTimeout(r, 600));
                out.wellsHashAfterUndo = djb2(
                    JSON.stringify(wells, function (k, v) {
                        return k && k.indexOf('__') === 0 ? undefined : v;
                    })
                );
                out.wellsHashInitial = null; // liczone na swiezych danych przed modalem
            } catch (e) {
                out.errors.push(String((e && e.stack) || (e && e.message) || e));
            }
            return out;
        },
        { vOn: virtualOn, data: wellsData }
    );
    return state;
}

(async () => {
    const launchOptions = chromeLaunchOptions({
        headless: true,
        args: getLaunchArgs(['--no-sandbox', '--disable-setuid-sandbox'])
    });
    const browser = await chromium.launch(launchOptions);
    let failed = false;
    const problems = [];
    const check = (name, cond, detail) => {
        if (!cond) {
            failed = true;
            problems.push(name + (detail ? ' :: ' + detail : ''));
        }
        console.log(
            (cond ? 'PASS' : 'FAIL') + ' ' + name + (detail && !cond ? ' :: ' + detail : '')
        );
    };

    try {
        // Token pobrany raz (osobny lekki kontekst), potem swiezy kontekst na tryb:
        // czyste dokumenty + czysty localStorage (decyzja load-time patcha).
        const loginCtx = await browser.newContext();
        const loginPage = await loginCtx.newPage();
        await applyThrottle(loginPage);
        const loginResp = await loginPage.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        const loginSetCookie = loginResp.headers()['set-cookie'] || '';
        const loginCookieMatch = /authToken=([^;]+)/.exec(loginSetCookie);
        const authToken = loginCookieMatch ? loginCookieMatch[1] : null;
        if (!authToken) throw new Error('Login failed');
        await loginCtx.close();

        const results = {};
        const modes = process.env.MODES ? process.env.MODES.split(',') : ['OFF', 'ON'];
        for (const mode of modes) {
            let done = false;
            for (let attempt = 1; attempt <= 2 && !done; attempt++) {
                // Swiezy kontekst na tryb: czyste dokumenty + czysty localStorage
                // (load-time patch virtual czyta flage przy ladowaniu skryptow).
                const context = await browser.newContext({
                    viewport: { width: 1600, height: 1000 }
                });
                const page = await context.newPage();
                await applyThrottle(page);
                try {
                    // Wariant A: cookie httpOnly do jara kontekstu; flaga
                    // virtual zostaje w localStorage (nie-auth, bez zmian).
                    await context.addCookies([
                        { name: 'authToken', value: authToken, domain: 'localhost', path: '/' }
                    ]);
                    await page.addInitScript(
                        ({ m }) => {
                            if (m === 'OFF') localStorage.setItem('sok_excel_virtual', '0');
                        },
                        { m: mode }
                    );
                    const hash = mode === 'OFF' ? '#/studnie?virtual=0' : '#/studnie';
                    await page.goto(`${BASE}/app.html${hash}`, {
                        waitUntil: 'load',
                        timeout: 30000
                    });
                    // przyczyna: DOM — iframe SPA wpinany asynchronicznie; warunkiem jest
                    // waitForSelector poniżej (sztywny sen przed nim zbędny).
                    const iframeEl = await page.waitForSelector('#spa-iframe-studnie', {
                        timeout: 30000,
                        state: 'attached'
                    });
                    // przyczyna: DOM — kontekst JS iframe gotowy, gdy produkty załadowane;
                    // warunkiem jest waitForFunction poniżej (sen po selektorze zbędny).
                    let frame = await iframeEl.contentFrame();
                    for (let i = 0; i < 20 && !frame; i++) {
                        // przyczyna: polling — contentFrame podpina się asynchronicznie po
                        // attach iframe; brak selektora na gotowy kontekst.
                        await page.waitForTimeout(1000);
                        frame = await iframeEl.contentFrame();
                        if (!frame) frame = page.frames().find((f) => f.url().includes('studnie'));
                    }
                    if (!frame) frame = page.frames().find((f) => f.url().includes('studnie'));
                    if (!frame) throw new Error('Cannot find studnie iframe');
                    // przyczyna: backend — produkty/cennik ładowane asynchronicznie; polling
                    // pętlą zastąpiony jednym warunkiem (timeout jak suma pętli: 15×~2 s).
                    await frame
                        .waitForFunction(
                            () => {
                                try {
                                    return studnieProducts.length > 0;
                                } catch (_) {
                                    return false;
                                }
                            },
                            null,
                            { timeout: 30000 }
                        )
                        .catch(() => {});
                    results[mode] = await runMode(frame, page, mode === 'ON', buildWells(N));
                    results[mode].phase2 = await runSelectionPhase(frame, page);
                    results[mode].phase3 = await runFilterSortPhase(frame);
                    results[mode].phase3b = await runFilterSortInteract(frame, page);
                    console.log('--- ' + mode + ' ---', JSON.stringify(results[mode]));
                    done = true;
                } catch (e) {
                    console.log(
                        'RETRY ' + mode + ' attempt ' + attempt + ': ' + ((e && e.message) || e)
                    );
                } finally {
                    try {
                        await context.close();
                    } catch (_) {}
                }
            }
            if (!results[mode]) throw new Error('Tryb ' + mode + ' nie zakonczyl sie po 2 probach');
        }

        const off = results.OFF;
        const on = results.ON;
        if (!off || !on) throw new Error('Brak wynikow obu trybow (MODES=OFF,ON)');
        check('brak bledow OFF', off.errors.length === 0, off.errors.join(';'));
        check('brak bledow ON', on.errors.length === 0, on.errors.join(';'));
        // UWAGA: live _excelVirtualIsEnabled()==true przy >500 nawet w OFF
        // (fallback n>500) — SSoT trybu to sciezka rendera (load-time patch),
        // wiec asercja na liczbie wierszy DOM, nie na fladze.
        check(
            'OFF: legacy render wszystkich wierszy',
            off.rowsInitial >= N,
            String(off.rowsInitial)
        );
        check(
            'ON renderuje slice (<=100 wierszy)',
            on.rowsAfterScroll <= 100,
            String(on.rowsAfterScroll)
        );
        check(
            'scroll ON przesuwa widok (pierwszy wiersz > 0)',
            parseInt(on.firstWidxAfterScroll || '0', 10) > 0,
            String(on.firstWidxAfterScroll)
        );
        check(
            'ten sam wiersz logiczny edytowany',
            String(off.editWidx) === String(on.editWidx),
            off.editWidx + ' vs ' + on.editWidx
        );
        check(
            'wells po edycji identyczne OFF=ON',
            off.wellsHashAfterEdit === on.wellsHashAfterEdit,
            off.wellsHashAfterEdit + ' vs ' + on.wellsHashAfterEdit
        );
        check(
            'edycja zapisala wartosc',
            off.editedWell && String(off.editedWell.rzednaWlazu) === '5.5',
            JSON.stringify(off.editedWell)
        );
        check(
            'wells po undo identyczne OFF=ON',
            off.wellsHashAfterUndo === on.wellsHashAfterUndo,
            off.wellsHashAfterUndo + ' vs ' + on.wellsHashAfterUndo
        );
        check(
            'undo cofa edycje (hash rozny od po-edycji)',
            off.wellsHashAfterUndo !== off.wellsHashAfterEdit,
            ''
        );
        const pOff = off.phase2;
        const pOn = on.phase2;
        check(
            'selection: 4 komorki w obu trybach',
            pOff.count === 4 && pOn.count === 4,
            JSON.stringify(pOff.count) + '/' + JSON.stringify(pOn.count)
        );
        check(
            'selection: te same wspolrzedne logiczne',
            pOff.cells === pOn.cells,
            pOff.cells + ' vs ' + pOn.cells
        );
        const expectedCopyText = '2\n3\n4\n5\n';
        check(
            'copy payload ma oczekiwane dane',
            pOff.copyText === expectedCopyText && pOn.copyText === expectedCopyText,
            JSON.stringify(pOff.copyText) + ' vs ' + JSON.stringify(pOn.copyText)
        );
        check(
            'copy payload parity OFF=ON',
            pOff.copyText === pOn.copyText,
            JSON.stringify(pOff.copyText) + ' vs ' + JSON.stringify(pOn.copyText)
        );
        check(
            'copy niesie wartości z edytowalnej kolumny',
            JSON.stringify(pOff.pastedValues) === JSON.stringify([2, 3, 4, 5]),
            JSON.stringify(pOff.pastedValues)
        );
        check(
            'paste: te same wartości w wierszach 10-13',
            JSON.stringify(pOff.pastedValues) === JSON.stringify(pOn.pastedValues),
            JSON.stringify(pOff.pastedValues) + ' vs ' + JSON.stringify(pOn.pastedValues)
        );
        check(
            'paste: wells hash identyczny',
            pOff.wellsHashAfterPaste === pOn.wellsHashAfterPaste,
            pOff.wellsHashAfterPaste + ' vs ' + pOn.wellsHashAfterPaste
        );
        check(
            'paste na 600 studniach tworzy pojedynczy undo patch',
            pOff.undoLen === 1 && pOn.undoLen === 1,
            pOff.undoLen + '/' + pOn.undoLen
        );
        check(
            'undo przywraca wszystkie dotkniete studnie',
            pOff.undoRestoredTargets && pOn.undoRestoredTargets,
            String(pOff.undoRestoredTargets) + '/' + String(pOn.undoRestoredTargets)
        );
        // Rerender może dopisać runtime diagnostics (_discountCorrupt/_pricingError)
        // tylko do renderowanych rekordów; porównujemy snapshot undo z baseline każdego trybu.
        check(
            'undo opróżnia stack w obu trybach',
            pOff.undoLenAfterUndo === 0 && pOn.undoLenAfterUndo === 0,
            pOff.undoLenAfterUndo + '/' + pOn.undoLenAfterUndo
        );
        check(
            'redo przywraca stan po wklejeniu',
            pOff.redoRestoredPaste && pOn.redoRestoredPaste,
            String(pOff.redoRestoredPaste) + '/' + String(pOn.redoRestoredPaste)
        );
        check(
            'column paste start odpowiada widocznemu wierszowi',
            pOff.columnPaste.startWIdx === 0 && pOn.columnPaste.startWIdx > 0,
            pOff.columnPaste.startWIdx + '/' + pOn.columnPaste.startWIdx
        );
        check(
            'undo column paste przywraca wiersze obu trybów',
            pOff.columnUndo.restored &&
                pOn.columnUndo.restored &&
                pOff.columnUndo.undoLen === 0 &&
                pOn.columnUndo.undoLen === 0,
            JSON.stringify([pOff.columnUndo, pOn.columnUndo])
        );
        check(
            'semantic paste rozszerza przejścia dla aktywnej zakładki',
            pOff.transitionAfterPaste.count === pOff.transitionPaste.matchingCount &&
                pOn.transitionAfterPaste.count === pOn.transitionPaste.matchingCount,
            pOff.transitionAfterPaste.count +
                '/' +
                pOff.transitionPaste.matchingCount +
                ' vs ' +
                pOn.transitionAfterPaste.count +
                '/' +
                pOn.transitionPaste.matchingCount
        );
        check(
            'undo/redo rozszerzenia przywraca przejścia wszystkich studni',
            pOff.transitionUndo.restored &&
                pOn.transitionUndo.restored &&
                pOff.transitionUndo.restoredCount === 0 &&
                pOn.transitionUndo.restoredCount === 0 &&
                pOff.transitionUndo.redoCount === pOff.transitionAfterPaste.count &&
                pOn.transitionUndo.redoCount === pOn.transitionAfterPaste.count &&
                pOff.transitionUndo.maxTransitionsAfterUndo === 1 &&
                pOn.transitionUndo.maxTransitionsAfterUndo === 1 &&
                pOff.transitionUndo.maxTransitionsAfterRedo === 4 &&
                pOn.transitionUndo.maxTransitionsAfterRedo === 4,
            JSON.stringify([pOff.transitionUndo, pOn.transitionUndo])
        );
        // ---- Faza 3: search/tab/sort (model MUST, DOM order raportowany) ----
        const fOff = off.phase3;
        const fOn = on.phase3;
        check('f3 brak bledow OFF', fOff.errors.length === 0, fOff.errors.join(';').slice(0, 300));
        check('f3 brak bledow ON', fOn.errors.length === 0, fOn.errors.join(';').slice(0, 300));
        check(
            'f3 tab1500 model rowny',
            fOff.tab1500.filt === fOn.tab1500.filt,
            JSON.stringify(fOff.tab1500) + ' vs ' + JSON.stringify(fOn.tab1500)
        );
        check(
            'f3 tab1000 model rowny',
            fOff.tab1000.filt === fOn.tab1000.filt,
            JSON.stringify(fOff.tab1000) + ' vs ' + JSON.stringify(fOn.tab1000)
        );
        check(
            'f3 search model rowny',
            fOff.search.filt === fOn.search.filt,
            'filt ' + fOff.search.filt + '/' + fOn.search.filt
        );
        check(
            'f3 search DOM==prefiks OFF',
            JSON.stringify(fOn.search.dom) ===
                JSON.stringify(fOff.search.dom.slice(0, fOn.search.dom.length)),
            'ON.len=' + fOn.search.dom.length
        );
        check(
            'f3 clear search model rowny',
            fOff.clearSearch.filt === fOn.clearSearch.filt,
            fOff.clearSearch.filt + '/' + fOn.clearSearch.filt
        );
        // Sort po modelu: ON slice == prefiks globalnie posortowanego OFF.
        const ascOk =
            JSON.stringify(fOn.sortAsc.dom) ===
            JSON.stringify(fOff.sortAsc.dom.slice(0, fOn.sortAsc.dom.length));
        const descOk =
            JSON.stringify(fOn.sortDesc.dom) ===
            JSON.stringify(fOff.sortDesc.dom.slice(0, fOn.sortDesc.dom.length));
        check(
            'f3 sortAsc ON==prefiks OFF',
            ascOk,
            'ON[0..4]=' + JSON.stringify(fOn.sortAsc.dom.slice(0, 5))
        );
        check(
            'f3 sortDesc ON==prefiks OFF',
            descOk,
            'ON[0..4]=' + JSON.stringify(fOn.sortDesc.dom.slice(0, 5))
        );
        const ssOk =
            JSON.stringify(fOn.searchSort.dom) ===
            JSON.stringify(fOff.searchSort.dom.slice(0, fOn.searchSort.dom.length));
        check('f3 search+sort ON==prefiks OFF', ssOk, '');
        check(
            'f3 search+sort model rowny',
            fOff.searchSort.filt === fOn.searchSort.filt,
            fOff.searchSort.filt + '/' + fOn.searchSort.filt
        );
        const bOff = off.phase3b;
        const bOn = on.phase3b;
        check(
            'f3 selection po filtrze rowna',
            bOff.selCells === bOn.selCells,
            bOff.selCells.slice(0, 60) + ' vs ' + bOn.selCells.slice(0, 60)
        );
        check(
            'f3 ten sam wIdx edytowany po normalizacji',
            String(bOff.editWidx) === String(bOn.editWidx),
            bOff.editWidx + ' vs ' + bOn.editWidx
        );
        check(
            'f3 wells hash po edycji rowny',
            bOff.wellsHash === bOn.wellsHash,
            bOff.wellsHash + ' vs ' + bOn.wellsHash
        );
        try {
            fs.mkdirSync(path.dirname(OUT), { recursive: true });
            fs.writeFileSync(
                OUT,
                JSON.stringify(
                    {
                        generated: new Date().toISOString(),
                        throttleX4: process.env.THROTTLE_X4 === '1',
                        results
                    },
                    null,
                    2
                ) + '\n'
            );
            console.log('PARITY zapisany: ' + OUT);
        } catch (_) {}
    } catch (e) {
        failed = true;
        problems.push('fatal: ' + ((e && e.message) || e));
        console.log('FATAL', (e && e.message) || e);
    } finally {
        await browser.close();
    }
    if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));
    console.log(failed ? 'PARITY FAIL' : 'PARITY OK');
    process.exit(failed ? 1 : 0);
})();
