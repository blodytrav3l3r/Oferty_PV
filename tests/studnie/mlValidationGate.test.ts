import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * P1.3: brama walidacji ML (window.isValidatedMlSolution).
 * Invariant: ML output must never become persisted configuration
 * before domain validation succeeds. Zwycięzca spoza kandydatów
 * solvera jest odrzucany — liczy się referencja, nie kształt.
 * Test ładuje prawdziwy solverAutoSelect.js w vm (wzorzec aiSelection.test.ts).
 */
describe('isValidatedMlSolution (brama ML)', () => {
    let isValidatedMlSolution: (candidates: any, winner: any) => boolean;

    beforeAll(() => {
        const sandbox: any = {
            window: {},
            logger: { info: () => {}, warn: () => {}, error: () => {} }
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/solverAutoSelect.js'),
            'utf8'
        );
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox);
        isValidatedMlSolution = sandbox.window.isValidatedMlSolution;
        expect(typeof isValidatedMlSolution).toBe('function');
    });

    const solA = { id: 'A' };
    const solB = { id: 'B' };
    const candidates = [
        { id: 0, solution: solA },
        { id: 1, solution: solB }
    ];

    test('zwycięzca z puli (referencja) -> true', () => {
        expect(isValidatedMlSolution(candidates, solA)).toBe(true);
        expect(isValidatedMlSolution(candidates, solB)).toBe(true);
    });

    test('obcy obiekt o tym samym kształcie -> false', () => {
        expect(isValidatedMlSolution(candidates, { id: 'A' })).toBe(false);
    });

    test('null/undefined/pusta pula -> false', () => {
        expect(isValidatedMlSolution(candidates, null)).toBe(false);
        expect(isValidatedMlSolution(candidates, undefined)).toBe(false);
        expect(isValidatedMlSolution([], solA)).toBe(false);
        expect(isValidatedMlSolution(null, solA)).toBe(false);
    });
});
