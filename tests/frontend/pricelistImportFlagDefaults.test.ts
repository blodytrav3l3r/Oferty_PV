import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Import XLSX studni: brak kolumny flagi = pozycja niedostępna (0) dla
 * WSZYSTKICH czterech flag + ostrzeżenie o brakujących kolumnach.
 * Regresja: magazyn dostawał 0, a forma 1 — ten sam plik raz wyłączał,
 * raz włączał pozycje, bez informacji dla użytkownika.
 */

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/studnie/pricelistImportExport.js'), 'utf8');

function load(): any {
    const sandbox: any = {
        window: {},
        document: { getElementById: () => null, querySelectorAll: () => [] },
        console,
        HEADER_TO_KEY: {},
        showToast: () => {},
        logger: { error: () => {} }
    };
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'pricelistImportExport.js' });
    return sandbox;
}

describe('postCoerce: brak kolumny flagi = 0 dla wszystkich flag', () => {
    test('domyślne wartości są symetryczne', () => {
        const sb = load();
        const product: any = { id: 'A', name: 'B', category: 'C', componentType: 'd' };
        sb.window.studnieImportOptions([]).postCoerce(product, {});
        expect(product).toMatchObject({
            magazynWL: 0,
            magazynKLB: 0,
            formaStandardowa: 0,
            formaStandardowaKLB: 0
        });
    });
});

describe('findMissingFlagColumns', () => {
    test('pusty wiersz = wszystkie kolumny brakują', () => {
        const sb = load();
        expect(sb.findMissingFlagColumns([])).toEqual([
            'Mag WL',
            'Mag KLB',
            'Forma std. WL',
            'Forma std. KLB'
        ]);
    });

    test('komplet kolumn = brak ostrzeżeń', () => {
        const sb = load();
        const row = {
            magazynWL: 1,
            magazynKLB: 0,
            formaStandardowa: 1,
            formaStandardowaKLB: 1
        };
        expect(sb.findMissingFlagColumns([row])).toEqual([]);
    });

    test('zgłasza tylko brakujące kolumny', () => {
        const sb = load();
        expect(sb.findMissingFlagColumns([{ magazynWL: 1, formaStandardowa: 0 }])).toEqual([
            'Mag KLB',
            'Forma std. KLB'
        ]);
    });
});
