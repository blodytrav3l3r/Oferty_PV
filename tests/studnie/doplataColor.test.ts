// @ts-nocheck
/* Kolor dopłaty sterowany wyłącznie klasami utility (inline color nadpisywał czerwień). */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('applyDoplataColor (actionsElevation.js)', () => {
    function loadScript() {
        const context = {
            wells: [],
            currentWellIndex: 0,
            getCurrentWell: () => null,
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

    function makeInput() {
        const classes = new Set();
        return {
            classes,
            classList: {
                add: (...names) => names.forEach((n) => classes.add(n)),
                remove: (...names) => names.forEach((n) => classes.delete(n))
            }
        };
    }

    test('wartość ujemna dostaje color-danger i traci pozostałe kolory', () => {
        const ctx = loadScript();
        const input = makeInput();
        input.classList.add('color-success', 'color-accent', 'fw-700');

        ctx.applyDoplataColor(input, -100);

        expect([...input.classes].sort()).toEqual(['color-danger', 'fw-700']);
    });

    test('wartość dodatnia dostaje color-success', () => {
        const ctx = loadScript();
        const input = makeInput();
        input.classList.add('color-danger', 'fw-700');

        ctx.applyDoplataColor(input, 50);

        expect([...input.classes].sort()).toEqual(['color-success', 'fw-700']);
    });

    test('zero dostaje color-accent bez pogrubienia', () => {
        const ctx = loadScript();
        const input = makeInput();
        input.classList.add('color-danger', 'fw-700');

        ctx.applyDoplataColor(input, 0);

        expect([...input.classes]).toEqual(['color-accent']);
    });
});
