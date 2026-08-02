import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('_excelShortLabel / _excelWrapDetail — etykiety nagłówków Excel', () => {
    let ctx: any;

    beforeAll(() => {
        const context: any = {
            studnieProducts: [],
            logger: { info: () => {}, warn: () => {}, error: () => {} }
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelHelpers.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        ctx = context;
    });

    test("krag_ot: 'Krąg DN2000/750 z otworem' → detail '750' (przypadek z buga)", () => {
        const lbl = ctx._excelShortLabel('Krąg DN2000/750 z otworem', 'krag_ot');
        expect(lbl.short).toBe('Kr. OT');
        expect(lbl.detail).toBe('750');
    });

    test("krag_ot: 'Krąg żelbetowy DN2500/750 z otworem' → detail '750' (wariant żelbetowy)", () => {
        const lbl = ctx._excelShortLabel('Krąg żelbetowy DN2500/750 z otworem', 'krag_ot');
        expect(lbl.short).toBe('Kr.OT żelb');
        expect(lbl.detail).toBe('750');
    });

    test("krag_ot: 'Krąg DN1000/500 z otworami' → detail '500' (liczba mnoga)", () => {
        const lbl = ctx._excelShortLabel('Krąg DN1000/500 z otworami', 'krag_ot');
        expect(lbl.short).toBe('Kr. OT');
        expect(lbl.detail).toBe('500');
    });

    test("krag_ot: 'Krąg żelbetowy DN1500/750 z otworami' → detail '750'", () => {
        const lbl = ctx._excelShortLabel('Krąg żelbetowy DN1500/750 z otworami', 'krag_ot');
        expect(lbl.short).toBe('Kr.OT żelb');
        expect(lbl.detail).toBe('750');
    });

    test("_excelWrapDetail sanity: '750' bez zmian, '750 z otworem/ami' łamane <br>", () => {
        expect(ctx._excelWrapDetail('750')).toBe('750');
        expect(ctx._excelWrapDetail('750 z otworem')).toBe('750<br>z otworem');
        expect(ctx._excelWrapDetail('750 z otworami')).toBe('750<br>z otworami');
    });
});
