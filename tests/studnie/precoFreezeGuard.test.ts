export {};

/**
 * Zamrażanie ceny PRECO w zamówieniu: błąd calc nie może utrwalić 0 zł.
 * Regresja: `well.frozenPrecoSuma = preco && !preco.error ? preco.suma || 0 : 0`
 * zapisywało trwałe 0 zł, gdy cennik PRECO był niepełny albo calc rzucił.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'public/js/studnie/orderHelpers.js'),
    'utf8'
);

/** Wyciąga samą funkcję — ładuje się bez reszty modułu (globale, DOM). */
function freezeSource(): string {
    const start = SRC.indexOf('function freezeWellPreco');
    expect(start).toBeGreaterThan(-1);
    const end = SRC.indexOf('\n}\n', start);
    expect(end).toBeGreaterThan(start);
    return SRC.slice(start, end + 3);
}

function run(well: Record<string, unknown>, calc: () => unknown): Record<string, unknown> {
    const sandbox: any = { console, calcPrecoPricing: calc };
    vm.createContext(sandbox);
    vm.runInContext(freezeSource(), sandbox, { filename: 'orderHelpers.freeze.js' });
    sandbox.well = well;
    vm.runInContext('freezeWellPreco(well, false)', sandbox);
    return sandbox.well;
}

describe('freezeWellPreco: brak fałszywego 0 zł', () => {
    test('poprawna suma jest zamrażana', () => {
        const well = run({ kineta: 'preco' }, () => ({ suma: 520 }));
        expect(well.frozenPrecoSuma).toBe(520);
    });

    test('błąd cennika nie zamraża 0 i usuwa starą wartość', () => {
        const well = run({ kineta: 'preco', frozenPrecoSuma: 300 }, () => ({
            suma: 0,
            error: 'Brak cennika PRECO dla DN1000'
        }));
        expect(well.frozenPrecoSuma).toBeUndefined();
    });

    test('wyjątek calc nie zamraża 0', () => {
        const well = run({ kineta: 'preco' }, () => {
            throw new Error('boom');
        });
        expect(well.frozenPrecoSuma).toBeUndefined();
    });

    test('suma nie-skończona nie jest zamrażana', () => {
        const well = run({ kineta: 'preco' }, () => ({ suma: NaN }));
        expect(well.frozenPrecoSuma).toBeUndefined();
    });

    test('studnia bez kinety PRECO nie ma zamrożenia', () => {
        const well = run({ kineta: 'pehd', frozenPrecoSuma: 300 }, () => ({ suma: 520 }));
        expect(well.frozenPrecoSuma).toBeUndefined();
    });
});
