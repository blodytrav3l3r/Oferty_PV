// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * precoErrorPropagation.test.ts — PRECO error-state nie wchodzi cicho do totalu.
 *
 * calcWellStats przy bledzie PRECO zwraca price:0 + error (nie throw).
 * Callery braly .price bez checka (ciche 0 w totalu). Gate:
 * - helpery isWellPricingError/pricingErrorBadge dzialaja (runtime, vm),
 * - kontrakt throw E2 nietkniety (assertDiscountPct rzuca RangeError),
 * - kazdy z 5 callerow sprawdza stats.error i oznacza UI (source assert).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

function loadPricing(): any {
    const sb: any = {
        console,
        window: {},
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        escapeHtmlAttr: (s: string) => String(s).replace(/"/g, '&quot;')
    };
    sb.window = sb;
    sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'actionsWellPricing.js'), 'utf8'), sb, {
        filename: 'actionsWellPricing.js'
    });
    return sb;
}

function readSrc(f: string): string {
    return fs.readFileSync(path.join(JS_DIR, f), 'utf8');
}

describe('precoErrorPropagation', () => {
    test('E2 nietkniety: invalid rabat rzuca RangeError, valid przechodzi', () => {
        const sb = loadPricing();
        expect(typeof sb.assertDiscountPct).toBe('function');
        expect(sb.assertDiscountPct(10)).toBe(10);
        expect(sb.assertDiscountPct(0)).toBe(0);
        expect(sb.assertDiscountPct(100)).toBe(100);
        // vm ma osobny realm — RangeError porownuj po name/message, nie referencji.
        for (const bad of [150, -1, NaN, '10', Infinity]) {
            let err: any = null;
            try {
                sb.assertDiscountPct(bad);
            } catch (e) {
                err = e;
            }
            expect(err).not.toBeNull();
            expect(err.name).toBe('RangeError');
            expect(String(err.message)).toMatch(/Invalid discountPct/);
        }
    });

    test('isWellPricingError: true tylko przy stats.error', () => {
        const sb = loadPricing();
        expect(typeof sb.isWellPricingError).toBe('function');
        expect(sb.isWellPricingError({}, { price: 0, error: 'Błąd PRECO' })).toBe(true);
        expect(sb.isWellPricingError({}, { price: 100, error: null })).toBe(false);
        expect(sb.isWellPricingError({}, { price: 100 })).toBe(false);
        expect(sb.isWellPricingError({}, null)).toBe(false);
    });

    test('pricingErrorBadge: widoczny badge, atrybut escapowany', () => {
        const sb = loadPricing();
        expect(typeof sb.pricingErrorBadge).toBe('function');
        const b = sb.pricingErrorBadge('Błąd "PRECO"');
        expect(b).toMatch(/warn-glyph/);
        expect(b).not.toMatch(/Błąd "PRECO"/);
        expect(b).toMatch(/&quot;/);
    });

    test('calcWellStats: error-state to price:0 + error (nie throw, nie ciche)', () => {
        const src = readSrc('actionsWellPricing.js');
        expect(src).toMatch(/price:\s*hasError \? 0 : price/);
        expect(src).toMatch(/error:\s*errorMessage/);
        // safeCalcWellStats oznacza studnie flaga (propagacja do UI).
        expect(src).toMatch(/markWellPricingError\(well, s\.error\)/);
    });

    test('pricingCalculator: hasPricingError/errorWells + flaga per studnia', () => {
        const src = readSrc('pricingCalculator.js');
        expect(src).toMatch(/hasPricingError/);
        expect(src).toMatch(/errorWells/);
        expect(src).toMatch(/pricingError/);
        expect(src).toMatch(/isWellPricingError/);
    });

    test('offerDiscountsPopup: badge bledu w obu sciezkach (update + render)', () => {
        const src = readSrc('offerDiscountsPopup.js');
        const hits = src.match(/_popBadge2?\(/g) || [];
        expect(hits.length).toBeGreaterThanOrEqual(3);
        expect(src).toMatch(/popupHasPricingError/);
        expect(src).toMatch(/dnHasError/);
    });

    test('offerTransport: stan bledu w modalu (nie ciche 0)', () => {
        const src = readSrc('offerTransport.js');
        expect(src).toMatch(/trHasPricingError/);
        expect(src).toMatch(/BŁĄD CENY/);
    });

    test('offerSummaryTable + wiersz: flaga w RAZEM i badge w naglowku', () => {
        const tbl = readSrc('offerSummaryTable.js');
        expect(tbl).toMatch(/tblHasPricingError/);
        expect(tbl).toMatch(/pricingErrorBadge/);
        const rows = readSrc('offerWellComponents.js');
        expect(rows).toMatch(/isWellPricingError/);
        expect(rows).toMatch(/pricingErrorBadge/);
    });
});
