// @ts-nocheck
// RED: heurystyka naglowka traktuje wiersz danych z 2 slowami-kluczami jak naglowek
// (Wlaz betonowy, Plyta najazdowa) - taki wiersz znika w _excelParsePasteData (startLine=1).
// Wzor loaderow: excelPasteBulk (tu wystarcza excelState + excelCopyPaste).
// Wszystkie RED ponizej zweryfikowane na HEAD skryptem dbg (DetectHeader === true).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
describe('excel header heur - dane z 2 slowami-kluczami to nie naglowek (RED)', () => {
    function createCtx() {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: [],
            studnieProducts: [],
            _excelActiveTab: '1000',
            _excelMaxTransitions: {
                '1000': 2,
                '1200': 1,
                '1500': 1,
                '2000': 1,
                '2500': 1,
                styczne: 1
            },
            _excelHiddenColumnIds: [],
            _excelSelectedCells: [],
            _excelSelectedCols: [],
            document: {
                querySelectorAll: () => [],
                querySelector: () => null,
                getElementById: () => null,
                createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
                body: { appendChild: () => {} },
                activeElement: null
            },
            window: {},
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            escapeHtml: (s: string) => String(s),
            escapeHtmlAttr: (s: string) => String(s),
            showToast: () => {},
            lucide: { createIcons: () => {} }
        };
        context.window = context;
        vm.createContext(context);
        for (const f of ['excelState.js', 'excelCopyPaste.js']) {
            vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), context);
        }
        return context;
    }
    test('T1 pojedyncza wartosc Wlaz betonowy to nie naglowek (RED)', () => {
        const ctx = createCtx();
        expect(ctx._excelDetectHeader(['Wlaz betonowy'])).toBe(false);
    });
    test('T2 wiersz 2 kol z danymi to nie naglowek (RED)', () => {
        const ctx = createCtx();
        expect(ctx._excelDetectHeader(['Wlaz betonowy', 'Plyta najazdowa'])).toBe(false);
    });
    test('T3 wiersz 7 kol z danymi to nie naglowek (RED)', () => {
        const ctx = createCtx();
        expect(
            ctx._excelDetectHeader(['S1', 'Wlaz betonowy', '10', '5', 'Plyta', 'PCV', '160'])
        ).toBe(false);
    });
    test('T4 wiersz 11 kol z danymi to nie naglowek (RED)', () => {
        const ctx = createCtx();
        expect(
            ctx._excelDetectHeader([
                'S1',
                '1000',
                'Wlaz betonowy',
                '5',
                '0',
                'Plyta najazdowa',
                'PCV',
                '160',
                '1',
                'GRP',
                '200'
            ])
        ).toBe(false);
    });
    test('T5 wiersz 15 kol z danymi to nie naglowek (RED)', () => {
        const ctx = createCtx();
        expect(
            ctx._excelDetectHeader([
                'S1',
                '1000',
                '10',
                '5',
                '0',
                'Wlaz betonowy',
                'PCV',
                '160',
                '1',
                'GRP',
                '200',
                '2',
                'Plyta',
                '160',
                '3'
            ])
        ).toBe(false);
    });
    test('T6 prawdziwy naglowek wykryty (kontrakt zielony)', () => {
        const ctx = createCtx();
        expect(
            ctx._excelDetectHeader([
                'Nazwa',
                'Rz wlazu',
                'Rz dna',
                'Rz wlot',
                'Kat',
                'Rodzaj',
                'Srednica'
            ])
        ).toBe(true);
    });
    test('T7 wiersz liczbowy to nie naglowek (kontrakt zielony)', () => {
        const ctx = createCtx();
        expect(ctx._excelDetectHeader(['10', '5', '7'])).toBe(false);
    });
});
