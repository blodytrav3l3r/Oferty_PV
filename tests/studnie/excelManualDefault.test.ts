// Domyślny MANUAL dla studni tworzonych w Excelu — auto-dobór tylko na żądanie.
// Punkty: pusty wiersz (excelCreateFromEmpty), paste-lines x2
// (_excelPasteCreateWells), surplus (paste), backfill przy otwarciu modala.
// Globalny default createNewWell (konfigurator) nietknięty.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f: string) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function loadHelpers() {
    const context: any = { window: {}, console };
    vm.createContext(context);
    vm.runInContext(readStudnie('excelHelpers.js'), context);
    return context;
}

describe('excel MANUAL default (_excelDefaultManual)', () => {
    test('helper stawia trójkę flag MANUAL (idempotentnie)', () => {
        const ctx = loadHelpers();
        expect(typeof ctx._excelDefaultManual).toBe('function');
        const well: any = { autoSelect: true, configSource: 'AUTO', autoLocked: false };
        ctx._excelDefaultManual(well);
        expect(well.autoSelect).toBe(false);
        expect(well.configSource).toBe('MANUAL');
        expect(well.autoLocked).toBe(true);
        expect(ctx._excelDefaultManual(null)).toBeNull();
        expect(ctx._excelDefaultManual(undefined)).toBeUndefined();
    });

    test('pusty wiersz: MANUAL + brak auto-firea solvera', () => {
        const src = readStudnie('excelTabs.js');
        expect(src).toContain('_excelDefaultManual(well)');
        expect(src).not.toContain('_excelAutoSelectForWell(newWIdx)');
    });

    test('paste-lines: obie ścieżki tworzenia wołają helper', () => {
        const src = readStudnie('excelTableManager.js');
        const hits = src.match(/_excelDefaultManual\(well\)/g) || [];
        expect(hits.length).toBeGreaterThanOrEqual(2);
    });

    test('surplus (paste): tworzy przez helper', () => {
        const src = readStudnie('excelCopyPaste.js');
        const surplusPos = src.indexOf('const surplus = lines.slice(availableRows)');
        expect(surplusPos).toBeGreaterThan(-1);
        expect(src.slice(surplusPos)).toContain('_excelDefaultManual(well)');
    });

    test('backfill modala: undefined → MANUAL, solverowe AUTO* → AUTO', () => {
        const src = readStudnie('excelModal.js');
        const pos = src.indexOf('Migracja autoSelect');
        expect(pos).toBeGreaterThan(-1);
        const block = src.slice(pos, pos + 1200);
        expect(block).toContain("w.configSource = 'MANUAL'");
        expect(block).toContain('AUTO_JS');
        expect(src).not.toContain(
            "if (w && typeof w.autoSelect === 'undefined') w.autoSelect = true;"
        );
    });
});
