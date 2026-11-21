// @ts-nocheck -- lekkie testy vm dla natywnych handlerów Vanilla JS.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('limit kąta przejścia do 360°', () => {
    test.each([
        ['wellTransitionsInline.js', 'inlineUpdateAngles', 'inl-angle-main'],
        ['wellTransitionsHelpers.js', 'editUpdateAngles', 'edit-angle-0']
    ])('%s poprawia wpisaną wartość w formularzu', (file, handler, inputId) => {
        const input = { value: '450' };
        const exec = { textContent: '' };
        const gons = { innerHTML: '' };
        const context = {
            window: {},
            document: {
                getElementById: (id) => (id === inputId ? input : id.includes('exec') ? exec : gons)
            }
        };
        vm.createContext(context);
        vm.runInContext(
            fs.readFileSync(path.join(__dirname, '../../public/js/studnie', file), 'utf8'),
            context
        );

        context.window[handler](file === 'wellTransitionsInline.js' ? 'main' : 0);

        expect(input.value).toBe('360');
        expect(exec.textContent).toBe('0°');
        expect(gons.innerHTML).toContain('400.00');
    });

    test('ręczna zmiana w Excelu i wklejenie ograniczają kąt do 360°', () => {
        const well = {
            przejscia: [
                {
                    angle: 90,
                    angleExecution: 270,
                    angleGony: '100.00',
                    flowType: 'WLOT'
                }
            ]
        };
        const context: any = {
            wells: [well],
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1 },
            window: {},
            _excelGuardWellLocked: () => true,
            _excelSaveUndoSnapshot: () => {},
            _excelMarkAsManual: () => {},
            _excelPasteQuiet: () => true,
            _excelPasteInProgress: true,
            _excelIsWellLocked: () => false,
            _excelModelLogicalIsPrzejscie: (logical: number) => logical >= 7,
            _excelCreatePrzejscie: () => ({ angle: 0 })
        };
        context.window = context;
        vm.createContext(context);
        vm.runInContext(
            fs.readFileSync(
                path.join(__dirname, '../../public/js/studnie/excelChangeHandlers.js'),
                'utf8'
            ),
            context
        );
        vm.runInContext(
            fs.readFileSync(
                path.join(__dirname, '../../public/js/studnie/excelCopyPaste.js'),
                'utf8'
            ),
            context
        );

        context.window.excelOnPrzejscieChange(0, 0, 'angle', '450');
        expect(well.przejscia[0].angle).toBe(360);
        context._excelSetModelCellValue(0, 8, '450', {}, null);
        expect(well.przejscia[0].angle).toBe(360);
    });
});
