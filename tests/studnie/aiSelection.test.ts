import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Testy regresyjne decyzji "studnia dobrana przez AI" (well.configSource = 'AUTO_AI').
 * Logika została wydzielona z sekcji AI DUAL-RANKING w runJsAutoSelection()
 * do czystej funkcji window.shouldMarkAiSelection(rankResult, aiWinner, explorationTriggered)
 * (public/js/studnie/solverAutoSelect.js). Test ładuje prawdziwy plik solvera
 * w sandboxie vm (konwencja jak w excelDrilledRings.test.ts) i testuje REALNĄ
 * funkcję — bez replikacji logiki w teście.
 */
describe('shouldMarkAiSelection (oznaczanie wyboru AI)', () => {
    let shouldMarkAiSelection: (
        rankResult: any,
        aiWinner: any,
        explorationTriggered?: boolean
    ) => boolean;

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

    const techWinner = { productId: 'kreg-1000-500' };
    const aiWinner = { productId: 'kreg-1000-750' };

    test('realny flip (aiWinner !== technicalWinner) + model online ? true (AUTO_AI)', () => {
        const rankResult = {
            aiInfluencePct: 80,
            technicalWinner: techWinner,
            ranked: [
                { id: 0, aiScore: 0.92 },
                { id: 1, aiScore: -1 },
                { id: 2, aiScore: 0.5 }
            ]
        };
        expect(shouldMarkAiSelection(rankResult, aiWinner)).toBe(true);
    });

    test('brak flipu (aiWinner === technicalWinner) ? false — AI nie zmieniło wyboru', () => {
        const rankResult = {
            aiInfluencePct: 80,
            technicalWinner: techWinner,
            ranked: [
                { id: 0, aiScore: 0.92 },
                { id: 1, aiScore: 0.5 }
            ]
        };
        expect(shouldMarkAiSelection(rankResult, techWinner)).toBe(false);
    });

    test('brak technicalWinner w rankResult ? false — nie deklarujemy wpływu AI', () => {
        const rankResult = {
            aiInfluencePct: 80,
            ranked: [
                { id: 0, aiScore: 0.92 },
                { id: 1, aiScore: -1 },
                { id: 2, aiScore: 0.5 }
            ]
        };
        expect(shouldMarkAiSelection(rankResult, aiWinner)).toBe(false);
    });

    test('eksploracja (explorationTriggered=true) ? false nawet przy flipie', () => {
        const rankResult = {
            aiInfluencePct: 80,
            technicalWinner: techWinner,
            ranked: [
                { id: 0, aiScore: 0.92 },
                { id: 1, aiScore: -1 },
                { id: 2, aiScore: 0.5 }
            ]
        };
        expect(shouldMarkAiSelection(rankResult, aiWinner, true)).toBe(false);
    });

    test('aiInfluencePct>0 + wszystkie aiScore=-1 (ML offline) ? false', () => {
        const rankResult = {
            aiInfluencePct: 80,
            technicalWinner: techWinner,
            ranked: [
                { id: 0, aiScore: -1 },
                { id: 1, aiScore: -1 },
                { id: 2, aiScore: -1 }
            ]
        };
        expect(shouldMarkAiSelection(rankResult, aiWinner)).toBe(false);
    });

    test('aiInfluencePct=0 (shadow mode) ? false nawet z aiScore>=0 i aiWinner', () => {
        const rankResult = {
            aiInfluencePct: 0,
            technicalWinner: techWinner,
            ranked: [{ id: 0, aiScore: 0.9 }]
        };
        expect(shouldMarkAiSelection(rankResult, aiWinner)).toBe(false);
    });

    test('brak aiWinner (null/undefined) ? false', () => {
        const rankResult = {
            aiInfluencePct: 80,
            technicalWinner: techWinner,
            ranked: [{ id: 0, aiScore: 0.9 }]
        };
        expect(shouldMarkAiSelection(rankResult, null)).toBe(false);
        expect(shouldMarkAiSelection(rankResult, undefined)).toBe(false);
    });

    test('guard: null/undefined rankResult lub brak ranked ? false (bez throw)', () => {
        expect(shouldMarkAiSelection(null, aiWinner)).toBe(false);
        expect(shouldMarkAiSelection(undefined, aiWinner)).toBe(false);
        expect(shouldMarkAiSelection({}, aiWinner)).toBe(false);
    });
});
