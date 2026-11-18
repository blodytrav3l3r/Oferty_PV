// @ts-nocheck
/* Regresja: DN jest tekstem ('1000/1500') i nie może zostać ucięty do liczby
   przy normalizacji wierszy cennika studni (import XLSX i widok wersji
   w siatce korzystają z tych samych opcji). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.join(__dirname, '..', '..');

function loadStudnieNormalizer() {
    const ctx = vm.createContext({
        console,
        logger: { warn() {}, error() {}, info() {} },
        showToast() {},
        document: {
            getElementById: () => null,
            addEventListener() {},
            querySelectorAll: () => []
        }
    });
    ctx.window = ctx;
    for (const file of [
        'public/js/studnie/pricelistState.js',
        'public/js/shared/pricelistXlsx.js',
        'public/js/studnie/pricelistImportExport.js'
    ]) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
    }
    return ctx;
}

function normalize(ctx, rows) {
    const issues = [];
    const out = ctx.window.pricelistXlsx.normalizeRows(rows, ctx.studnieImportOptions(issues));
    return { rows: out, issues };
}

describe('normalizacja DN cennika studni', () => {
    const sheetRow = (dn) => ({
        Indeks: 'Jajowa-10001500',
        Nazwa: 'Jajowa 1000/1500',
        'Typ komponentu': 'przejscie',
        DN: dn,
        'Cena PLN': 2600
    });

    it('zachowuje DN tekstowe z arkusza', () => {
        const { rows, issues } = normalize(loadStudnieNormalizer(), [sheetRow('1000/1500')]);
        expect(rows[0].dn).toBe('1000/1500');
        expect(issues).toHaveLength(0);
    });

    it('zachowuje DN tekstowe z wiersza API (klucz dn)', () => {
        const { rows } = normalize(loadStudnieNormalizer(), [
            {
                id: 'Jajowa-600900',
                name: 'Jajowa 600/900',
                componentType: 'przejscie',
                dn: '600/900',
                price: 1700
            }
        ]);
        expect(rows[0].dn).toBe('600/900');
    });

    it('czystą liczbę podaje jako number (kształt legacy)', () => {
        const { rows, issues } = normalize(loadStudnieNormalizer(), [sheetRow('1000')]);
        expect(rows[0].dn).toBe(1000);
        expect(issues).toHaveLength(0);
    });

    it('puste DN daje null', () => {
        const { rows } = normalize(loadStudnieNormalizer(), [sheetRow('')]);
        expect(rows[0].dn).toBeNull();
    });
});

describe('coerceNumerics nie ucina tekstu do liczby', () => {
    it('zgłasza nieprawidłową liczbę zamiast cichego 100', () => {
        const ctx = loadStudnieNormalizer();
        const invalid = [];
        const product = ctx.window.pricelistXlsx.coerceNumerics(
            { price: '100/200' },
            ['price'],
            null,
            (field, value) => invalid.push([field, value])
        );
        expect(product.price).toBeNull();
        expect(invalid).toEqual([['price', '100/200']]);
    });

    it('parsuje polskie separatory', () => {
        const ctx = loadStudnieNormalizer();
        const product = ctx.window.pricelistXlsx.coerceNumerics(
            { price: '1 234,50' },
            ['price'],
            null,
            () => {}
        );
        expect(product.price).toBe(1234.5);
    });
});
