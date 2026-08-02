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

    function runScript(wells, currentWellIndex) {
        const context = {
            wells,
            currentWellIndex,
            getCurrentWell: () => wells[currentWellIndex] || wells[0] || null,
            showToast: jest.fn(),
            window: { debounce: null }
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
});
