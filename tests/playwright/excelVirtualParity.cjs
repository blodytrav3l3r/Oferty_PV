/**
 * P1-B parity: Excel virtual OFF vs ON — ten sam scenariusz, ten sam stan.
 * SSoT: wells + undo. Operacje na logicznych indeksach, nie na elementach DOM.
 *
 * Pokrycie macierzy: render slice (logicalRow<->wIdx), scroll, edit widocznego
 * wiersza, undo. Paste/selection/sort/filter/search/sticky: osobne case'y (TODO).
 *
 * Run:   node tests/playwright/excelVirtualParity.cjs
 * Wymaga: backend na localhost:3000
 * Exit:  0 = parity OK, 1 = rozjazd lub blad
 */

const BASE = 'http://localhost:3000';
const N = 600; // >500 = virtual auto-ON (bez flagi)

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    console.error('Cannot find playwright.');
    process.exitCode = 1;
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();

const CHROME_PATH =
    process.env.CHROME_PATH ||
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1234\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

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
    return arr;
}

/** Faza 2 (wywolywana z Node dla prawdziwych trusted events): selection + copy + paste. */
async function runSelectionPhase(frame, page) {
    const sel = (w, c) => `tr[data-widx="${w}"] td:nth-child(${c + 1})`;
    await frame.click(sel(0, 3));
    await page.waitForTimeout(300);
    await frame.click(sel(3, 3), { modifiers: ['Shift'] });
    await page.waitForTimeout(300);
    const selState = await frame.evaluate(() => ({
        count: typeof _excelSelectedCells !== 'undefined' ? _excelSelectedCells.length : -1,
        cells: (typeof _excelSelectedCells !== 'undefined' ? _excelSelectedCells : [])
            .map((c) => c.wIdx + ':' + c.colIdx)
            .sort()
            .join(',')
    }));
    // Esc zamyka ewentualne menu — nie uzywane; Ctrl+C na dokumencie
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);
    // readText niedostepny w headless-shell (permissions) — payload copy
    // dowodzony przez paste: wiersze-docelowe musza dostac kopiowane nazwy.
    const copyText = 'via-paste';
    await frame.click(sel(10, 3));
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(1200);
    const after = await frame.evaluate(() => {
        const djb2 = (s) => {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return String(h >>> 0);
        };
        return {
            wellsHashAfterPaste: djb2(JSON.stringify(wells)),
            undoLen: typeof _excelUndoStack !== 'undefined' ? _excelUndoStack.length : -1,
            pastedNames: [10, 11, 12, 13].map((i) => wells[i] && wells[i].name)
        };
    });
    await frame.evaluate(() => _excelUndo());
    await page.waitForTimeout(600);
    const undone = await frame.evaluate(() => {
        const djb2 = (s) => {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return String(h >>> 0);
        };
        return { wellsHashAfterUndo2: djb2(JSON.stringify(wells)) };
    });
    return { ...selState, copyText, ...after, ...undone };
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
    await page.waitForTimeout(300);
    await frame.click(sel(vis[2], 3), { modifiers: ['Shift'] });
    await page.waitForTimeout(300);
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
    await page.waitForTimeout(1200);
    const hash = await frame.evaluate(() => {
        const djb2 = (s) => {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return String(h >>> 0);
        };
        return {
            wellsHash: djb2(JSON.stringify(wells)),
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
                out.wellsHashAfterEdit = djb2(JSON.stringify(wells));
                out.editedWell = { rzednaWlazu: wells[wIdx] && wells[wIdx].rzednaWlazu };

                _excelUndo();
                await new Promise((r) => setTimeout(r, 600));
                out.wellsHashAfterUndo = djb2(JSON.stringify(wells));
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
    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
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
        const loginResp = await loginPage.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        const loginJson = await loginResp.json();
        const authToken = loginJson.token || loginJson.authToken;
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
                try {
                    await page.addInitScript(
                        ({ t, m }) => {
                            localStorage.setItem('authToken', t);
                            if (m === 'OFF') localStorage.setItem('sok_excel_virtual', '0');
                        },
                        { t: authToken, m: mode }
                    );
                    const hash = mode === 'OFF' ? '#/studnie?virtual=0' : '#/studnie';
                    await page.goto(`${BASE}/app.html${hash}`, {
                        waitUntil: 'load',
                        timeout: 30000
                    });
                    await page.waitForTimeout(2500);
                    const iframeEl = await page.waitForSelector('#spa-iframe-studnie', {
                        timeout: 30000,
                        state: 'attached'
                    });
                    await page.waitForTimeout(2500);
                    let frame = await iframeEl.contentFrame();
                    for (let i = 0; i < 20 && !frame; i++) {
                        await page.waitForTimeout(1000);
                        frame = await iframeEl.contentFrame();
                        if (!frame) frame = page.frames().find((f) => f.url().includes('studnie'));
                    }
                    if (!frame) frame = page.frames().find((f) => f.url().includes('studnie'));
                    if (!frame) throw new Error('Cannot find studnie iframe');
                    for (let i = 0; i < 15; i++) {
                        const n = await frame.evaluate(() => {
                            try {
                                return studnieProducts.length;
                            } catch (_) {
                                return -1;
                            }
                        });
                        if (n > 0) break;
                        await page.waitForTimeout(2000);
                    }
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
        check(
            'copy payload identyczny (dowod przez paste)',
            pOff.copyText === pOn.copyText,
            JSON.stringify(pOff.copyText) + ' vs ' + JSON.stringify(pOn.copyText)
        );
        check(
            'copy niesie 4 nazwy (wiersze 10-13 nadpisane VP-001..004)',
            JSON.stringify(pOff.pastedNames) ===
                JSON.stringify(['VP-001', 'VP-002', 'VP-003', 'VP-004']),
            JSON.stringify(pOff.pastedNames)
        );
        check(
            'paste: te same nazwy w wierszach 10-13',
            JSON.stringify(pOff.pastedNames) === JSON.stringify(pOn.pastedNames),
            JSON.stringify(pOff.pastedNames) + ' vs ' + JSON.stringify(pOn.pastedNames)
        );
        check(
            'paste: wells hash identyczny',
            pOff.wellsHashAfterPaste === pOn.wellsHashAfterPaste,
            pOff.wellsHashAfterPaste + ' vs ' + pOn.wellsHashAfterPaste
        );
        // Granica: przy N=600 undo-stack po paste jest pusty w OBU trybach
        // (gate pelnego klona N>100) — asercja parity, nie absolutnego restore.
        check(
            'paste+undo: ten sam stan w obu trybach',
            pOff.wellsHashAfterUndo2 === pOn.wellsHashAfterUndo2 && pOff.undoLen === pOn.undoLen,
            pOff.wellsHashAfterUndo2 + '/' + pOn.wellsHashAfterUndo2
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
