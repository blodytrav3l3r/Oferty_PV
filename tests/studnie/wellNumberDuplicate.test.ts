// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('checkWellNumerDuplicate (actionsElevation.js)', () => {
    function makeInput() {
        return {
            classList: { add: jest.fn(), remove: jest.fn() },
            style: {}
        };
    }

    function runScript(wells, currentWellIndex, extraGlobals = {}) {
        const context = {
            wells,
            currentWellIndex,
            getCurrentWell: () => wells[currentWellIndex] || wells[0] || null,
            showToast: jest.fn(),
            window: { debounce: null },
            _excelPasteInProgress: false,
            ...extraGlobals
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/actionsElevation.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        return context;
    }

    test('nie zgłasza fałszywego duplikatu gdy currentWellIndex=-1 (po zamknięciu modala Excel)', () => {
        const wells = [
            { id: 'w1', name: 's3', numer: 's3' },
            { id: 'w2', name: 's4', numer: 's4' }
        ];
        const ctx = runScript(wells, -1);
        const input = makeInput();
        expect(ctx.checkWellNumerDuplicate('s3', input)).toBe(false);
        expect(ctx.showToast).not.toHaveBeenCalled();
    });

    test('wykrywa prawdziwy duplikat innej studni (case-insensitive)', () => {
        const wells = [
            { id: 'w1', name: 's3', numer: 's3' },
            { id: 'w2', name: 'S3', numer: 'S3' }
        ];
        const ctx = runScript(wells, 0);
        const input = makeInput();
        expect(ctx.checkWellNumerDuplicate('s3', input)).toBe(true);
        expect(ctx.showToast).toHaveBeenCalled();
    });

    test('brak fałszywego duplikatu przy poprawnym indeksie', () => {
        const wells = [
            { id: 'w1', name: 's3', numer: 's3' },
            { id: 'w2', name: 's4', numer: 's4' }
        ];
        const ctx = runScript(wells, 0);
        const input = makeInput();
        expect(ctx.checkWellNumerDuplicate('s3', input)).toBe(false);
    });

    test('Ss1 / ss2 / ss3 → brak duplikatów (paste wielu numerów)', () => {
        const wells = [
            { id: 'w1', name: 'Ss1', numer: 'Ss1' },
            { id: 'w2', name: 'ss2', numer: 'ss2' },
            { id: 'w3', name: 'ss3', numer: 'ss3' }
        ];
        const ctx0 = runScript(wells, 0);
        expect(ctx0.checkWellNumerDuplicate('Ss1', makeInput())).toBe(false);
        const ctx1 = runScript(wells, 1);
        expect(ctx1.checkWellNumerDuplicate('ss2', makeInput())).toBe(false);
        const ctx2 = runScript(wells, 2);
        expect(ctx2.checkWellNumerDuplicate('ss3', makeInput())).toBe(false);
        // perspektywa w1 nie powinna widzieć ss2/ss3 jako własnego duplikatu — ale ss2 JEST duplikatem innej studni
        // więc self-check musi być per-well
        expect(ctx0.showToast).not.toHaveBeenCalled();
        expect(ctx1.showToast).not.toHaveBeenCalled();
        expect(ctx2.showToast).not.toHaveBeenCalled();
        // a sprawdzenie Ss1 z perspektywy w2 → duplikat (bo w1 ma Ss1)
        expect(ctx1.checkWellNumerDuplicate('Ss1', makeInput())).toBe(true);
    });

    test('stale reference (kopia obiektu currentWell) nie powoduje self-duplicate', () => {
        const wells = [
            { id: 'w1', name: 'Ss1', numer: 'Ss1' },
            { id: 'w2', name: 'ss2', numer: 'ss2' }
        ];
        // currentWell to kopia (inny obiekt, to samo id) — symuluje stale ref po paste
        const stale = { id: 'w1', name: 'Ss1', numer: 'Ss1' };
        const ctx = runScript(wells, 0);
        ctx.getCurrentWell = () => stale;
        const input = makeInput();
        expect(ctx.checkWellNumerDuplicate('Ss1', input)).toBe(false);
        expect(ctx.showToast).not.toHaveBeenCalled();
        // prawdziwy duplikat innej studni nadal wykryty
        expect(ctx.checkWellNumerDuplicate('ss2', input)).toBe(true);
    });

    test('case-insensitive: Ss1 vs SS1 to duplikat innej studni', () => {
        const wells = [
            { id: 'w1', name: 'Ss1', numer: 'Ss1' },
            { id: 'w2', name: 'SS1', numer: 'SS1' }
        ];
        const ctx = runScript(wells, 0);
        expect(ctx.checkWellNumerDuplicate('SS1', makeInput())).toBe(true);
        expect(ctx.checkWellNumerDuplicate('ss1', makeInput())).toBe(true);
    });

    test('trim: " Ss1 " traktowane jak "Ss1"', () => {
        const wells = [
            { id: 'w1', name: 'Ss1', numer: 'Ss1' },
            { id: 'w2', name: 'other', numer: 'other' }
        ];
        const ctx = runScript(wells, 1);
        expect(ctx.checkWellNumerDuplicate(' Ss1 ', makeInput())).toBe(true);
        expect(ctx.checkWellNumerDuplicate(' Ss1', makeInput())).toBe(true);
    });

    test('bulk paste: toast wyciszony gdy _excelPasteInProgress true, detekcja nadal true', () => {
        const wells = [
            { id: 'w1', name: 'Ss1', numer: 'Ss1' },
            { id: 'w2', name: 'Ss1', numer: 'Ss1' }
        ];
        const ctx = runScript(wells, 0, { _excelPasteInProgress: true });
        const input = makeInput();
        expect(ctx.checkWellNumerDuplicate('Ss1', input)).toBe(true);
        expect(ctx.showToast).not.toHaveBeenCalled();
        expect(input.classList.add).toHaveBeenCalledWith('border-danger-subtle', 'color-danger');
        // po zakończeniu paste toast wraca
        ctx._excelPasteInProgress = false;
        const input2 = makeInput();
        // need fresh showToast mock
        ctx.showToast.mockClear();
        expect(ctx.checkWellNumerDuplicate('Ss1', input2)).toBe(true);
        expect(ctx.showToast).toHaveBeenCalled();
    });

    test('suffix PRE/UTH zawsze prezentacyjny: Ss1 PRE == Ss1', () => {
        const wells = [
            { id: 'w1', name: 'Ss1 PRE', numer: 'Ss1' },
            { id: 'w2', name: 'other', numer: 'other' }
        ];
        const ctx = runScript(wells, 1);
        expect(ctx.checkWellNumerDuplicate('Ss1 PRE', makeInput())).toBe(true);
        expect(ctx.checkWellNumerDuplicate('Ss1 UTH', makeInput())).toBe(true);
        expect(ctx.checkWellNumerDuplicate('Ss1 pre', makeInput())).toBe(true);
        expect(ctx.checkWellNumerDuplicate('ss1', makeInput())).toBe(true);
        // własna studnia nie widzi siebie jako duplikatu mimo suffixu
        const ctx0 = runScript(wells, 0);
        expect(ctx0.checkWellNumerDuplicate('Ss1', makeInput())).toBe(false);
        expect(ctx0.checkWellNumerDuplicate('Ss1 PRE', makeInput())).toBe(false);
    });
});
