// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/* =============================================================
   F0 (opcja C): kontrakt public/js/import-export/shared/
   xlsxImportShared.js w izolacji vm — bez DOM, bez zmiany kodu.
   Pinuje zachowanie przed F1 (parser liczb) i F2 (guard limitow).
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

function loadShared() {
    const code = fs.readFileSync(
        path.join(ROOT, 'public', 'js', 'import-export', 'shared', 'xlsxImportShared.js'),
        'utf8'
    );
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'xlsxImportShared.js' });
    return { S: sandbox.window.XlsxImportShared, keys: Object.keys(sandbox.window) };
}

function makeRow(i, num = 'OF/1') {
    return {
        NUMER_OFERTY: num,
        NR_STUDNI: 'S' + i,
        GLEBOKOSC: '3',
        INDEKS_CZESCI: 'ABC-' + i,
        ILOSC: '2',
        CENA_JEDNOSTKOWA: '100',
        WERSJA: '1',
        RABAT: '10',
        SREDNICA: '1000',
        ZAKONCZENIE: 'X',
        MAGAZYN: 'WL',
        LP: String(i)
    };
}

describe('xlsxImportShared: rejestracja', () => {
    test('jeden namespace, zero nowych window.*', () => {
        const { S, keys } = loadShared();
        expect(keys).toEqual(['XlsxImportShared']);
        expect(S.REQUIRED_COLS).toHaveLength(12);
        for (const fn of [
            'validateHeaders',
            'normalizeHeader',
            'parseExternalXlsx',
            'groupRowsIntoOffers',
            'getLoadedOffers',
            'generateExternalXlsx',
            'escapeHtml'
        ]) {
            expect(typeof S[fn]).toBe('function');
        }
    });
});

describe('xlsxImportShared: naglowki', () => {
    test('komplet przechodzi, brak 4 krytycznych zwraca missing', () => {
        const { S } = loadShared();
        expect(
            S.validateHeaders(['NUMER_OFERTY', 'INDEKS_CZESCI', 'ILOSC', 'CENA_JEDNOSTKOWA'])
        ).toEqual([]);
        expect(S.validateHeaders(['NUMER_OFERTY', 'ILOSC'])).toEqual([
            'INDEKS_CZESCI',
            'CENA_JEDNOSTKOWA'
        ]);
        expect(S.validateHeaders([])).toHaveLength(4);
    });

    test('normalizeHeader: trim + UPPER, puste -> ""', () => {
        const { S } = loadShared();
        expect(S.normalizeHeader('  ilosc ')).toBe('ILOSC');
        expect(S.normalizeHeader('Cena_jednostkowa')).toBe('CENA_JEDNOSTKOWA');
        expect(S.normalizeHeader('')).toBe('');
        expect(S.normalizeHeader(null)).toBe('');
    });
});

describe('xlsxImportShared: grupowanie', () => {
    test('grupuje po NUMER_OFERTY, brak numeru -> BRAK_NUMERU', () => {
        const { S } = loadShared();
        const rows = [makeRow(0, 'OF/1'), makeRow(1, 'OF/1'), makeRow(2, 'OF/2'), makeRow(3, '')];
        const groups = S.groupRowsIntoOffers(rows);
        expect(groups).toHaveLength(3);
        const g1 = groups.find((g) => g.number === 'OF/1');
        expect(g1.rows).toHaveLength(2);
        const fallback = groups.find((g) => g.number === 'BRAK_NUMERU');
        expect(fallback.rows).toHaveLength(1);
    });

    test('5k wierszy grupuje szybko (czyste O(N), guard nalezy do F2 przed XLSX.read)', () => {
        const { S } = loadShared();
        const rows = [];
        for (let i = 0; i < 5000; i++) rows.push(makeRow(i, 'OF/' + (i % 50)));
        const t0 = Date.now();
        const groups = S.groupRowsIntoOffers(rows);
        const ms = Date.now() - t0;
        expect(groups).toHaveLength(50);
        expect(groups[0].rows).toHaveLength(100);
        expect(ms).toBeLessThan(3000);
    });
});

describe('xlsxImportShared: escapeHtml', () => {
    test('XSS z komorki XLSX neutralizowany', () => {
        const { S } = loadShared();
        expect(S.escapeHtml('<script>alert(1)</script>')).toBe(
            '&lt;script&gt;alert(1)&lt;/script&gt;'
        );
        expect(S.escapeHtml('a"b\'c&d')).toBe('a&quot;b&#039;c&amp;d');
        expect(S.escapeHtml(123)).toBe('123');
    });
});
