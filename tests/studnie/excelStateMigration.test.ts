// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('excelState.js — migracja kluczy localStorage (witros_* -> sok_*)', () => {
    let ctx: any;
    let storage: Record<string, string>;

    beforeAll(() => {
        storage = {};
        const context: any = {
            localStorage: {
                getItem: (k: string) => (k in storage ? storage[k] : null),
                setItem: (k: string, v: string) => (storage[k] = String(v)),
                removeItem: (k: string) => delete storage[k]
            }
        };
        vm.createContext(context);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelState.js'),
            'utf8'
        );
        vm.runInContext(code, context);
        ctx = context;
    });

    beforeEach(() => {
        Object.keys(storage).forEach((k) => delete storage[k]);
    });

    it('przenosi ukryte kolumny ze starego klucza do nowego przy ładowaniu', () => {
        storage['witros_excel_hidden_columns'] = JSON.stringify(['przejscie', 'kineta']);
        ctx._excelLoadColumnVisibility();
        expect(storage['sok_excel_hidden_columns']).toBe(JSON.stringify(['przejscie', 'kineta']));
        expect(storage['witros_excel_hidden_columns']).toBeUndefined();
    });

    it('przenosi szerokości kolumn ze starego klucza do nowego', () => {
        storage['witros_excel_col_widths'] = JSON.stringify({ '1000-3': 220 });
        ctx._excelLoadColWidths();
        expect(storage['sok_excel_col_widths']).toBe(JSON.stringify({ '1000-3': 220 }));
        expect(storage['witros_excel_col_widths']).toBeUndefined();
    });

    it('nie nadpisuje danych w nowym kluczu gdy legacy istnieje (nowy ma priorytet)', () => {
        storage['sok_excel_hidden_columns'] = JSON.stringify(['psia_buda']);
        storage['witros_excel_hidden_columns'] = JSON.stringify(['przejscie']);
        ctx._excelLoadColumnVisibility();
        expect(storage['sok_excel_hidden_columns']).toBe(JSON.stringify(['psia_buda']));
        expect(storage['witros_excel_hidden_columns']).toBeUndefined();
    });

    it('nie tworzy nowego klucza gdy nie ma danych legacy', () => {
        ctx._excelLoadColumnVisibility();
        expect(storage['sok_excel_hidden_columns']).toBeUndefined();
        expect(storage['witros_excel_hidden_columns']).toBeUndefined();
    });
});
