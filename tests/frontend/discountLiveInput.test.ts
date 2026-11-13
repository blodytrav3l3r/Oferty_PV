import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Live-commit rabatów DN z debounce: parsowanie, jeden commit po pauzie,
// ciche pomijanie invalid/bez-zmian, kasowanie timera.
const ROOT = path.join(__dirname, '..', '..');
const readPub = (rel: string) => fs.readFileSync(path.join(ROOT, 'public', rel), 'utf8');

describe('podgląd rabatu PEHD za m²', () => {
    test('rabat 50% od bazowych 270,20 PLN/m² pokazuje 135,10 PLN/m²', () => {
        const priceAfterDiscount = { innerText: '' };
        const modal = { classList: { contains: () => true } };
        const sandbox: any = {
            console,
            wells: [{ id: 'w1', pehdDiscount: 0 }],
            studnieProducts: [{ id: 'krag-1', componentType: 'krag', area: 2, doplataPEHD: 540.4 }],
            getPehdEffectiveArea: () => 2,
            document: {
                getElementById: (id: string) =>
                    id === 'offer-discounts-modal'
                        ? modal
                        : id === 'offer-pehd-price-after-discount'
                          ? priceAfterDiscount
                          : null
            },
            updateOfferDiscountsPopupPrices: () => {},
            renderDiscountPanel: () => {},
            updateSummary: () => {},
            renderOfferSummary: () => {},
            renderWellConfig: () => {},
            window: {}
        };
        sandbox.window = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/studnie/actionsWellDiscounts.js'), sandbox);
        vm.runInContext('updateGlobalPehdDiscount(50)', sandbox);

        expect(priceAfterDiscount.innerText).toBe('135.10');
    });
});

describe('zaokrąglenie w renderze rabatu PEHD', () => {
    test('stosuje zaokrąglenie half-up dla wartości 1,005 PLN/m²', () => {
        const body = { innerHTML: '' };
        const sandbox: any = {
            console,
            window: {},
            document: {
                getElementById: (id: string) => (id === 'offer-discounts-modal-body' ? body : null)
            },
            wells: [
                {
                    id: 'w1',
                    dn: '1000',
                    wkladkaNadbudowa: '3mm',
                    pehdDiscount: 49.75
                }
            ],
            studnieProducts: [{ id: 'krag-1', componentType: 'krag', area: 1, doplataPEHD: 2 }],
            wellDiscounts: {},
            getPehdEffectiveArea: () => 1,
            safeCalcWellStats: () => ({ weight: 0, price: 1 }),
            escapeHtml: (value: unknown) => String(value),
            escapeHtmlAttr: (value: unknown) => String(value)
        };
        sandbox.window = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/shared/formatters.js'), sandbox);
        vm.runInContext(readPub('js/studnie/offerDiscountsPopup.js'), sandbox);
        vm.runInContext('renderOfferDiscountsPopupContent()', sandbox);

        expect(body.innerHTML).toContain('<span id="offer-pehd-price-after-discount">1.01</span>');
    });
});

describe('parseLiveDiscount: macierz', () => {
    function loadParse() {
        const sandbox: any = { window: {}, console };
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/studnie/actionsWellDiscounts.js'), sandbox, {
            filename: 'actionsWellDiscounts.js'
        });
        return sandbox;
    }

    test.each([
        ['50', 50],
        ['  50  ', 50],
        ['12,5', 12.5],
        ['0', 0],
        ['100', 100],
        ['50.', 50],
        ['.5', 0.5]
    ])('%p → %p', (input, expected) => {
        const sb = loadParse();
        expect(vm.runInContext(`parseLiveDiscount(${JSON.stringify(input)})`, sb)).toBe(expected);
    });

    test.each([[''], ['   '], ['abc'], ['101'], ['-1'], ['NaN'], ['1e400'], [null], [undefined]])(
        '%p → null (ciche pominięcie)',
        (input) => {
            const sb = loadParse();
            expect(vm.runInContext(`parseLiveDiscount(${JSON.stringify(input)})`, sb)).toBeNull();
        }
    );
});

describe('scheduleOfferDiscountLive: debounce i skipy', () => {
    function loadCtx() {
        const timers: Array<(() => void) | null> = [];
        const calls: Record<string, number> = {
            renderDiscountPanel: 0,
            updateSummary: 0,
            renderOfferSummary: 0
        };
        const sandbox: any = {
            console,
            document: { getElementById: () => null },
            wellDiscounts: {},
            wells: [],
            safeCalcWellStats: () => ({ weight: 0, price: 0 }),
            renderDiscountPanel: () => calls.renderDiscountPanel++,
            updateSummary: () => calls.updateSummary++,
            renderOfferSummary: () => calls.renderOfferSummary++,
            renderWellConfig: () => {},
            setTimeout: (fn: () => void) => {
                timers.push(fn);
                return timers.length - 1;
            },
            clearTimeout: (id: number) => {
                timers[id] = null;
            }
        };
        // window === global jak w przeglądarce (window.* ląduje w globalu).
        sandbox.window = sandbox;
        sandbox.window.isPreviewMode = false;
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/studnie/actionsWellDiscounts.js'), sandbox, {
            filename: 'actionsWellDiscounts.js'
        });
        vm.runInContext(readPub('js/studnie/offerDiscountsPopup.js'), sandbox, {
            filename: 'offerDiscountsPopup.js'
        });
        const fire = () => {
            timers.splice(0).forEach((fn) => fn && fn());
        };
        const schedule = (e: any) => {
            sandbox.el = e;
            vm.runInContext('scheduleOfferDiscountLive(el, "1000", "dennica")', sandbox);
        };
        const cancel = (e: any) => {
            sandbox.el = e;
            vm.runInContext('cancelOfferDiscountLive(el)', sandbox);
        };
        const discOf = () => vm.runInContext('wellDiscounts["1000"].dennica', sandbox);
        return { sb: sandbox, calls, fire, schedule, cancel, discOf };
    }

    function el(value: string) {
        return { value, dataset: {}, _discountTimer: null };
    }

    function seed(ctx: any, dennica: number) {
        vm.runInContext(`wellDiscounts = { 1000: { dennica: ${dennica} } }`, ctx.sb);
    }

    test('poprawna wartość commituje po pauzie (raz)', () => {
        const ctx = loadCtx();
        seed(ctx, 0);
        ctx.schedule(el('50'));
        ctx.fire();
        expect(ctx.discOf()).toBe(50);
        expect(ctx.calls.renderDiscountPanel).toBe(1);
        // applyDiscount renderuje + handleOfferDiscountChange dokłada tabelę.
        expect(ctx.calls.renderOfferSummary).toBe(2);
    });

    test('szybkie pisanie "5" → "50": jeden commit z końcową wartością', () => {
        const ctx = loadCtx();
        seed(ctx, 0);
        const input = el('5');
        ctx.schedule(input);
        input.value = '50';
        ctx.schedule(input);
        ctx.fire();
        expect(ctx.discOf()).toBe(50);
        expect(ctx.calls.renderDiscountPanel).toBe(1);
    });

    test('śmieć w trakcie pisania: brak commita, brak renderów, brak throw', () => {
        const ctx = loadCtx();
        seed(ctx, 10);
        const input = el('abc');
        expect(() => ctx.schedule(input)).not.toThrow();
        ctx.fire();
        expect(ctx.discOf()).toBe(10);
        expect(ctx.calls.renderDiscountPanel).toBe(0);
        expect(ctx.calls.renderOfferSummary).toBe(0);
    });

    test('puste pole: brak commita (revert robi blur)', () => {
        const ctx = loadCtx();
        seed(ctx, 10);
        ctx.schedule(el(''));
        ctx.fire();
        expect(ctx.discOf()).toBe(10);
        expect(ctx.calls.renderDiscountPanel).toBe(0);
    });

    test('ta sama wartość: brak renderów (zero migotania)', () => {
        const ctx = loadCtx();
        seed(ctx, 50);
        ctx.schedule(el('50'));
        ctx.fire();
        expect(ctx.calls.renderDiscountPanel).toBe(0);
        expect(ctx.calls.updateSummary).toBe(0);
        expect(ctx.calls.renderOfferSummary).toBe(0);
    });

    test('cancel przed pauzą (blur/zamknięcie): nic nie strzela', () => {
        const ctx = loadCtx();
        seed(ctx, 0);
        const input = el('50');
        ctx.schedule(input);
        ctx.cancel(input);
        ctx.fire();
        expect(ctx.discOf()).toBe(0);
        expect(ctx.calls.renderDiscountPanel).toBe(0);
    });
});

describe('static: wiring live-input', () => {
    test('buildInputBlock ma data-csp-4=$discountLive on=input', () => {
        const src = readPub('js/studnie/offerDiscountsPopup.js');
        expect(src).toContain('data-csp-4="$discountLive"');
        expect(src).toContain('data-csp-4-on="input"');
    });

    test('cspActions: $discountLive i kasowanie timera w $discountBlur', () => {
        const src = readPub('js/shared/cspActions.js');
        expect(src).toContain("name === '$discountLive'");
        expect(src).toContain('scheduleOfferDiscountLive');
        expect(src).toContain('cancelOfferDiscountLive');
    });
});
