import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Testy regresyjne decyzji "studnia dobrana przez AI" (well.configSource = 'AUTO_AI').
 * Logika zosta?a wydzielona z sekcji AI DUAL-RANKING w runJsAutoSelection()
 * do czystej funkcji window.shouldMarkAiSelection(rankResult, aiWinner)
 * (public/js/studnie/solverAutoSelect.js). Test ?aduje prawdziwy plik solvera
 * w sandboxie vm (konwencja jak w excelDrilledRings.test.ts) i testuje REALN?
 * funkcj? ? bez replikacji logiki w te?cie.
 */
describe('shouldMarkAiSelection (oznaczanie wyboru AI)', () => {
    let shouldMarkAiSelection: (rankResult: any, aiWinner: any) => boolean;

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
        shouldMarkAiSelection = sandbox.window.shouldMarkAiSelection;
        expect(typeof shouldMarkAiSelection).toBe('function');
    });

    test('aiInfluencePct>0 + aiScore>=0 obecny + aiWinner ? true (AUTO_AI)', () => {
        const rankResult = {
            aiInfluencePct: 80,
            ranked: [
                { id: 0, aiScore: 0.92 },
                { id: 1, aiScore: -1 },
                { id: 2, aiScore: 0.5 }
            ]
        };
        expect(shouldMarkAiSelection(rankResult, { productId: 'dennica-1000-1000' })).toBe(true);
    });

    test('aiInfluencePct>0 + wszystkie aiScore=-1 (ML offline) ? false', () => {
        const rankResult = {
            aiInfluencePct: 80,
            ranked: [
                { id: 0, aiScore: -1 },
                { id: 1, aiScore: -1 },
                { id: 2, aiScore: -1 }
            ]
        };
        expect(shouldMarkAiSelection(rankResult, { productId: 'x' })).toBe(false);
    });

    test('aiInfluencePct=0 (shadow mode) ? false nawet z aiScore>=0 i aiWinner', () => {
        const rankResult = {
            aiInfluencePct: 0,
            ranked: [{ id: 0, aiScore: 0.9 }]
        };
        expect(shouldMarkAiSelection(rankResult, { productId: 'x' })).toBe(false);
    });

    test('brak aiWinner (null/undefined) ? false', () => {
        const rankResult = {
            aiInfluencePct: 80,
            ranked: [{ id: 0, aiScore: 0.9 }]
        };
        expect(shouldMarkAiSelection(rankResult, null)).toBe(false);
        expect(shouldMarkAiSelection(rankResult, undefined)).toBe(false);
    });

    test('guard: null/undefined rankResult lub brak ranked ? false (bez throw)', () => {
        expect(shouldMarkAiSelection(null, {})).toBe(false);
        expect(shouldMarkAiSelection(undefined, {})).toBe(false);
        expect(shouldMarkAiSelection({}, {})).toBe(false);
    });
});
