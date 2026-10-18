// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/*
 * Regresja: tint duplikatu ginal po "debounced flush" (sciezka przyrostowa
 * _excelRefreshDupColors) mimo ze pelny render (_excelEnsureDupCache) wlasnie
 * go nalozyl. Reprodukcja: dodanie studni z pustego wiersza (excelCreateFromEmpty)
 * -> render buduje cache A i czysci _excelDupDirty -> flush wola
 * _excelRefreshDupColors, ktory przy dirty=false NIE przebudowuje mapy, uzywa
 * stalej/pustej _excelDupNameCounts i zdejmuje klase excel-row-dup.
 * Objaw: podswietlenie duplikatu wraca dopiero po zmianie zakladki (pelny render).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function fakeRow(wIdx: number) {
    const attrs: Record<string, string> = { 'data-widx': String(wIdx) };
    const classes = new Set<string>();
    return {
        getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
        setAttribute: (k: string, v: string) => {
            attrs[k] = v;
        },
        removeAttribute: (k: string) => {
            delete attrs[k];
        },
        style: {} as Record<string, string>,
        classList: {
            contains: (c: string) => classes.has(c),
            add: (...cs: string[]) => cs.forEach((c) => classes.add(c)),
            remove: (...cs: string[]) => cs.forEach((c) => classes.delete(c))
        },
        querySelectorAll: () => [] as any[],
        _classes: classes,
        _attrs: attrs
    };
}

/*
 * Laduje realny excelTableBody.js z minimalnym DOM.
 * rows: TR per well (indeks = wIdx). Zwraca { ctx, rows }.
 */
function loadBody(wells: any[], activeTab: string) {
    const rows = wells.map((_: any, i: number) => fakeRow(i));
    const indexById = new Map<string, number>();
    wells.forEach((w: any, i: number) => indexById.set(w.id, i));
    const container = { querySelectorAll: () => rows };
    const context: any = {
        window: {},
        console: { warn: () => {} },
        wells,
        currentWellIndex: -1,
        _excelActiveTab: activeTab,
        _excelDupDirty: true,
        DN_COLORS: {},
        _excelWellIndexById: indexById,
        _excelWellMatchesTab: (w: any, dn: any) => String(w.dn) === String(dn),
        _excelIsWellLocked: () => false,
        _excelStickyCellBg: (tint: any, solid: any) =>
            'linear-gradient(' + tint + ',' + tint + '),' + solid,
        document: {
            documentElement: null,
            getElementById: () => container
        }
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelTableBody.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return { ctx: context, rows };
}

function well(id: string, dn: string, numer: string) {
    return { id, dn, numer, name: numer, config: [], przejscia: [], configErrors: [] };
}

describe('excelDupColorSync — tint duplikatu przezywa przyrostowy refresh', () => {
    test('flush (refresh) po dodaniu duplikatu NIE zdejmuje tintu z renderu', () => {
        // a i c maja ten sam numer "s1" w tej samej zakladce DN1200
        const wells = [well('a', '1200', 's1'), well('b', '1200', 's2'), well('c', '1200', 's1')];
        const { ctx, rows } = loadBody(wells, '1200');

        // 1. Pelny render: buduje cache i czysci _excelDupDirty (excelTableBody.js:136).
        ctx._excelEnsureDupCache();

        // 2. Render nalozylby klase na wiersze-duplikaty (a=0, c=2) — emulujemy wynik renderu.
        rows[0]._classes.add('excel-row-dup');
        rows[2]._classes.add('excel-row-dup');

        // 3. Debounced flush -> przyrostowy _excelRefreshDupColors (dirty=false).
        ctx._excelRefreshDupColors();

        // Kontrakt: duplikaty nadal podswietlone, nie-duplikat czysty.
        expect(rows[0]._classes.has('excel-row-dup')).toBe(true);
        expect(rows[2]._classes.has('excel-row-dup')).toBe(true);
        expect(rows[1]._classes.has('excel-row-dup')).toBe(false);
    });

    test('duplikat miedzy zakladkami: refresh zachowuje tint i kolor innego DN', () => {
        // a (DN1200) i c (DN1000) dziela numer "s1" -> widok DN1200 koloruje wg DN1000
        const wells = [well('a', '1200', 's1'), well('c', '1000', 's1')];
        const { ctx, rows } = loadBody(wells, '1200');

        ctx._excelEnsureDupCache();
        rows[0]._classes.add('excel-row-dup');
        rows[1]._classes.add('excel-row-dup');

        ctx._excelRefreshDupColors();

        expect(rows[0]._classes.has('excel-row-dup')).toBe(true);
        expect(rows[1]._classes.has('excel-row-dup')).toBe(true);
        // tint ma byc tlem (background), nie puste
        expect(String(rows[0].style.background || '')).toContain('rgba(');
    });

    test('brak duplikatow: refresh nie maluje tintu', () => {
        const wells = [well('a', '1200', 's1'), well('b', '1200', 's2')];
        const { ctx, rows } = loadBody(wells, '1200');

        ctx._excelEnsureDupCache();
        ctx._excelRefreshDupColors();

        expect(rows[0]._classes.has('excel-row-dup')).toBe(false);
        expect(rows[1]._classes.has('excel-row-dup')).toBe(false);
    });
});
