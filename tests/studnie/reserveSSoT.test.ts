// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/* =============================================================
   SSoT zapasów przejścia (300/150 mm) — jedno źródło: transitionZones.js.
   ringOptimizer.js i ruleEngine.js nie mogą mieć własnych literałów.
   ============================================================= */

const SRC = path.join(__dirname, '../../public/js/studnie');
const readSrc = (name: string) => fs.readFileSync(path.join(SRC, name), 'utf8');

const PRODUKT = {
    id: 'prz-160',
    componentType: 'przejscie',
    dn: '160',
    name: 'Przejście DN160'
};

function loadRuleEngine(products: any[] = [PRODUKT]) {
    const context: any = {
        studnieProducts: products,
        getStudnieProductById: (id: string) => products.find((x) => x.id === id) || null,
        console
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(readSrc('transitionZones.js'), context);
    vm.runInContext(readSrc('ruleEngine.js'), context);
    return context;
}

describe('zapasy przejścia — bez własnych literałów w konsumentach', () => {
    test.each(['ruleEngine.js', 'ringOptimizer.js'])(
        '%s nie ma lokalnych || 300 / || 150',
        (file) => {
            const code = readSrc(file);
            expect(code).not.toMatch(/\|\|\s*300/);
            expect(code).not.toMatch(/\|\|\s*150/);
        }
    );

    test('zmiana stałej TRANSITION_RESERVE_STD_MM zmienia wynik ruleEngine', () => {
        const ctx = loadRuleEngine();
        const transitions = [{ productId: PRODUKT.id, rzednaWlaczenia: 1.0 }];

        const before = ctx.calculateConnectionRequirements(transitions, 0);
        expect(before.pipes[0].zapasDol).toBe(300);
        expect(before.pipes[0].zapasDolMin).toBe(150);

        ctx.TRANSITION_RESERVE_STD_MM = 400;
        ctx.TRANSITION_RESERVE_MIN_MM = 250;
        const after = ctx.calculateConnectionRequirements(transitions, 0);
        expect(after.pipes[0].zapasDol).toBe(400);
        expect(after.pipes[0].zapasGora).toBe(400);
        expect(after.pipes[0].zapasDolMin).toBe(250);
        expect(after.pipes[0].zapasGoraMin).toBe(250);
    });

    test('zapas z produktu ma pierwszeństwo przed stałą', () => {
        const ctx = loadRuleEngine([{ ...PRODUKT, zapasDol: '220' }]);
        const res = ctx.calculateConnectionRequirements(
            [{ productId: PRODUKT.id, rzednaWlaczenia: 1.0 }],
            0
        );
        expect(res.pipes[0].zapasDol).toBe(220);
        expect(res.pipes[0].zapasGora).toBe(300);
    });
});
