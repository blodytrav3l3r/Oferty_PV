// @ts-nocheck
/* Walidacja PRECO w UI: błędne pola i niespójne zakresy dostają klasę
 * `preco-input--invalid` już przy edycji, a nie dopiero po zapisie (422 z BE).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = fs.readFileSync(
    path.join(ROOT, 'public', 'js', 'studnie', 'pricelistPreco.js'),
    'utf8'
);

function load(precoPricing: Record<string, unknown>) {
    const sandbox: Record<string, unknown> = {
        window: {},
        document,
        console,
        // jsdom/jest nie eksponuje structuredClone; w przeglądarce jest globalny.
        structuredClone: (value: unknown) => JSON.parse(JSON.stringify(value)),
        precoPricing,
        showToast: jest.fn(),
        logger: { error: jest.fn() }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, { filename: 'pricelistPreco.js' });
    return sandbox as {
        window: { collectPrecoFromUI: () => Record<string, unknown> };
    };
}

function rangeInputs(dn: string, table: string, rows: Array<[string, string]>): void {
    document.body.innerHTML = rows
        .map(
            ([min, max], i) =>
                `<input data-preco-field="${table}.${i}.min" data-preco-dn="${dn}" value="${min}">
                 <input data-preco-field="${table}.${i}.max" data-preco-dn="${dn}" value="${max}">`
        )
        .join('');
}

const isInvalid = (field: string): boolean =>
    document
        .querySelector(`[data-preco-field="${field}"]`)
        .classList.contains('preco-input--invalid');

const pricingWith = (table: string, rows: Array<{ min: number; max: number }>) => ({
    '1200': { [table]: rows.map((r) => ({ ...r, grupy: {} })) }
});

describe('PRECO — kolorowanie błędnych wartości', () => {
    it('zakres nachodzący na poprzedni (DN1200 uniesienie 301-600 / 401-500)', () => {
        const api = load(
            pricingWith('uniesienie', [
                { min: 301, max: 600 },
                { min: 401, max: 500 }
            ])
        );
        rangeInputs('1200', 'uniesienie', [
            ['301', '600'],
            ['401', '500']
        ]);

        api.window.collectPrecoFromUI();

        expect(isInvalid('uniesienie.0.max')).toBe(true);
        expect(isInvalid('uniesienie.1.min')).toBe(true);
        expect(
            document
                .querySelector('[data-preco-field="uniesienie.0.max"]')
                .getAttribute('aria-invalid')
        ).toBe('true');
    });

    it('zakres z max < min', () => {
        const api = load(pricingWith('redukcja', [{ min: 901, max: 10 }]));
        rangeInputs('1200', 'redukcja', [['901', '10']]);

        api.window.collectPrecoFromUI();

        expect(isInvalid('redukcja.0.min')).toBe(true);
        expect(isInvalid('redukcja.0.max')).toBe(true);
    });

    it('zakres z max = 0', () => {
        const api = load(pricingWith('uniesienie', [{ min: 401, max: 0 }]));
        rangeInputs('1200', 'uniesienie', [['401', '0']]);

        api.window.collectPrecoFromUI();

        expect(isInvalid('uniesienie.0.max')).toBe(true);
    });

    it('poprawne, rozłączne zakresy nie są kolorowane', () => {
        const api = load(
            pricingWith('uniesienie', [
                { min: 301, max: 400 },
                { min: 401, max: 500 }
            ])
        );
        rangeInputs('1200', 'uniesienie', [
            ['301', '400'],
            ['401', '500']
        ]);

        api.window.collectPrecoFromUI();

        expect(isInvalid('uniesienie.0.min')).toBe(false);
        expect(isInvalid('uniesienie.0.max')).toBe(false);
        expect(isInvalid('uniesienie.1.min')).toBe(false);
        expect(isInvalid('uniesienie.1.max')).toBe(false);
    });

    it('puste pole liczby jest kolorowane', () => {
        const api = load({ '1200': { skrzynkaWlazowa: 400 } });
        document.body.innerHTML =
            '<input data-preco-field="skrzynkaWlazowa" data-preco-dn="1200" value="">';

        api.window.collectPrecoFromUI();

        expect(isInvalid('skrzynkaWlazowa')).toBe(true);
    });

    it('spadek kinety nie jest traktowany jak nachodzenie', () => {
        const api = load(
            pricingWith('spadekKineta', [
                { min: 16, max: 20 },
                { min: 20, max: 360 }
            ])
        );
        rangeInputs('1200', 'spadekKineta', [
            ['16', '20'],
            ['20', '360']
        ]);

        api.window.collectPrecoFromUI();

        expect(isInvalid('spadekKineta.1.min')).toBe(false);
    });
});
