import fs from 'fs';
import path from 'path';
import vm from 'vm';

// F1: updateSummary fast path — brak JSON.stringify(wells) bez mutacji;
// slow path (dotychczasowa logika) po mutacji: rev bump, zmiana długości,
// zmiana rabatów (cheap-sig safety net).
describe('F1 summary rev-cache (fast/slow path)', () => {
    let ctx: any;
    let els: Record<string, any>;
    let bigStringify = 0;
    const realJSON = JSON;

    function el() {
        return {
            value: '',
            textContent: '',
            style: {} as Record<string, string>,
            title: '',
            classList: { toggle() {}, add() {}, remove() {} },
            removeAttribute() {},
            addEventListener() {},
            setAttribute() {},
            getAttribute() {
                return null;
            }
        };
    }

    function loadContext() {
        bigStringify = 0;
        els = {};
        const wells: any[] = [];
        for (let i = 0; i < 150; i++) {
            wells.push({
                id: 'w' + i,
                dn: 1000,
                name: 's' + i,
                config: [
                    { productId: 'KDB-10-10-D', quantity: 1 },
                    { productId: 'DDD-10-095', quantity: 1 }
                ],
                przejscia: [],
                doplata: 0,
                rzednaWlazu: 5,
                rzednaDna: 0
            });
        }
        const context: any = {
            wells,
            wellDiscounts: {},
            studnieProducts: [
                { id: 'KDB-10-10-D', price: 540, weight: 100, height: 1000 },
                { id: 'DDD-10-095', price: 880, weight: 200, height: 950 }
            ],
            JSON: {
                parse: (s: string) => realJSON.parse(s),
                stringify: (v: unknown, rep?: unknown, sp?: unknown) => {
                    const s = realJSON.stringify(v, rep as never, sp as never);
                    if (typeof s === 'string' && s.length > 10000) bigStringify++;
                    return s;
                }
            },
            document: {
                readyState: 'complete',
                hidden: false,
                getElementById: (id: string) => {
                    if (!els[id]) els[id] = el();
                    return els[id];
                },
                addEventListener: () => {},
                createElement: () => el()
            },
            setInterval: () => 0,
            clearInterval: () => {},
            setTimeout: () => 0,
            clearTimeout: () => {},
            requestAnimationFrame: () => 0,
            getCurrentWell: () => wells[0],
            safeCalcWellStats: (w: any) => ({
                price: (w.config || []).reduce(
                    (a: number, it: any) => a + (Number(it.quantity) || 0) * 100,
                    0
                ),
                weight: 10,
                height: 5000,
                areaInt: 1,
                areaExt: 1
            }),
            calculateOfferTotals: () => ({ globalWeight: 0, totalTransportCost: 0 }),
            updateHeightIndicator: () => {},
            renderWellsList: () => {},
            fmt: (n: unknown) => String(Math.round(Number(n) || 0)),
            fmtInt: (n: unknown) => String(Math.round(Number(n) || 0)),
            RangeError,
            window: {
                emitExcelMutated: () => {},
                refreshAll: () => {},
                applyDiscount: () => {}
            }
        };
        vm.createContext(context);
        vm.runInContext(
            fs.readFileSync(path.join(__dirname, '../../public/js/studnie', 'wellUI.js'), 'utf8'),
            context,
            { filename: 'wellUI.js' }
        );
        return { context, wells, els };
    }

    function summary() {
        return vm.runInContext('window.updateSummary()', ctx);
    }

    function priceTile() {
        return els['sum-price'] ? els['sum-price'].textContent : null;
    }

    beforeEach(() => {
        const loaded = loadContext();
        ctx = loaded.context;
    });

    test('drugi updateSummary bez mutacji nie stringifyuje wells (fast path)', () => {
        summary();
        expect(bigStringify).toBe(1);
        summary();
        expect(bigStringify).toBe(1);
    });

    test('mutacja + bump rev (emitExcelMutated) przelicza i pokazuje nową cenę', () => {
        summary();
        expect(priceTile()).toBe('200 PLN');
        ctx.wells[0].config[0].quantity = 5;
        vm.runInContext('window.emitExcelMutated()', ctx);
        summary();
        expect(bigStringify).toBe(2);
        expect(priceTile()).toBe('600 PLN');
        summary();
        expect(bigStringify).toBe(2);
    });

    test('zmiana rabatów bez bumpa i tak trafia w slow path (cheap-sig net)', () => {
        summary();
        expect(bigStringify).toBe(1);
        vm.runInContext(
            `wellDiscounts = {'1000': {dennica: 10, nadbudowa: 0, preco: 0, pehd: 0}};`,
            ctx
        );
        summary();
        expect(bigStringify).toBe(2);
    });

    test('zmiana długości wells wymusza slow path', () => {
        summary();
        expect(bigStringify).toBe(1);
        vm.runInContext(`wells.push({id:'w-new',dn:1000,name:'n',config:[],przejscia:[]});`, ctx);
        summary();
        expect(bigStringify).toBe(2);
    });
});
