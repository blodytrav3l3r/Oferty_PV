// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/* =============================================================
   F2 (opcja C): guard limitow UI importu XLSX w toolbar.js.
   Czysty helper _checkXlsxImportLimits — parser nietkniety.
   Limity: 5 MB / 5000 wierszy (F0: tests/importBatchLimits.test.ts).
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadToolbar() {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    const file = path.join(process.cwd(), 'public/js/import-export/toolbar.js');
    vm.runInContext(fs.readFileSync(file, 'utf-8'), sandbox, { filename: 'toolbar.js' });
    return sandbox.window.importExportToolbar;
}

describe('ieImportLimits: stale', () => {
    test('5 MB / 5000 wierszy, zero nowych window.*', () => {
        const tb = loadToolbar();
        expect(tb.XLSX_IMPORT_MAX_BYTES).toBe(5 * 1024 * 1024);
        expect(tb.XLSX_IMPORT_MAX_ROWS).toBe(5000);
        expect(typeof tb._checkXlsxImportLimits).toBe('function');
    });
});

describe('ieImportLimits: plik', () => {
    const tb = loadToolbar();

    test('ponizej i rowno limit -> null', () => {
        expect(tb._checkXlsxImportLimits(1024, null)).toBeNull();
        expect(tb._checkXlsxImportLimits(5 * 1024 * 1024, null)).toBeNull();
    });

    test('powyzej 5 MB -> kind file + komunikat z CLI', () => {
        const hit = tb._checkXlsxImportLimits(6 * 1024 * 1024, null);
        expect(hit.kind).toBe('file');
        expect(hit.message).toMatch(/6,0 MB|6\.0 MB/);
        expect(hit.message).toMatch(/npm run import:offers/);
    });
});

describe('ieImportLimits: wiersze', () => {
    const tb = loadToolbar();

    test('5000 -> null, 5001 -> kind rows + komunikat z CLI', () => {
        expect(tb._checkXlsxImportLimits(null, 5000)).toBeNull();
        const hit = tb._checkXlsxImportLimits(null, 5001);
        expect(hit.kind).toBe('rows');
        expect(hit.message).toMatch(/5001/);
        expect(hit.message).toMatch(/npm run import:offers/);
    });

    test('brak danych (null/null) -> null', () => {
        expect(tb._checkXlsxImportLimits(null, null)).toBeNull();
        expect(tb._checkXlsxImportLimits(undefined, undefined)).toBeNull();
    });
});
