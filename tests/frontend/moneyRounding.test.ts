// @ts-nocheck -- vm sandbox dla public/js + import helpera backendu
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/* =============================================================
   Reguła projektu: każda kwota PLN ma 2 miejsca po przecinku.
   SSoT: public/js/shared/formatters.js → roundMoney
        src/utils/money.ts → roundMoney
   ============================================================= */

function loadFormatters() {
    const context: any = { window: {}, console };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/shared/formatters.js'), 'utf8'),
        context
    );
    return context;
}

describe('roundMoney (frontend SSoT)', () => {
    const ctx = loadFormatters();
    const cases: Array<[any, number]> = [
        [0, 0],
        [1, 1],
        [1.004, 1],
        [1.005, 1.01],
        [1.015, 1.02],
        [2.675, 2.68],
        [10.555, 10.56],
        [1234.5678, 1234.57],
        [0.005, 0.01],
        [-1.005, -1.01],
        [-2.675, -2.68],
        ['10.555', 10.56],
        [null, 0],
        [undefined, 0],
        [NaN, 0],
        [Infinity, 0]
    ];

    test.each(cases)('roundMoney(%p) === %p', (input, expected) => {
        expect(ctx.roundMoney(input)).toBe(expected);
    });

    test('każdy wynik ma najwyżej 2 miejsca (brak artefaktów binarnych)', () => {
        for (let i = 0; i < 200; i++) {
            const v = ctx.roundMoney(i * 0.037 + 0.005);
            expect(Number(v.toFixed(2))).toBe(v);
        }
    });
});

describe('konsumenci mają ten sam fallback co SSoT', () => {
    const SRC = path.join(__dirname, '../../public/js');

    const consumers: Array<{ file: string; constName: string }> = [
        { file: 'studnie/actionsWellPricing.js', constName: '_moneyRoundPricing' },
        { file: 'rury/transport.js', constName: '_moneyRoundTransport' },
        { file: 'rury/offerCrud.js', constName: '_moneyRoundOfferCrud' },
        { file: 'rury/offerExports.js', constName: '_moneyRoundExports' },
        { file: 'studnie/offerSave.js', constName: '_moneyRoundOfferSave' },
        { file: 'studnie/pricingCalculator.js', constName: '_moneyRoundPricingCalc' },
        { file: 'studnie/orderCrud.js', constName: '_moneyRoundOrder' }
    ];

    test.each(consumers)('$file ($constName) bez formatters = to samo zaokrąglenie', (c) => {
        const context: any = { window: {}, console };
        context.window = context;
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(path.join(SRC, c.file), 'utf8'), context);
        const fn = vm.runInContext(c.constName, context);
        expect(typeof fn).toBe('function');
        const ssoT = loadFormatters().roundMoney;
        for (const v of [1.005, 2.675, 0.005, 1234.5678, -1.005, 999.999]) {
            expect(fn(v)).toBe(ssoT(v));
        }
    });
});
