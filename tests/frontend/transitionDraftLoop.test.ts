// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * P0: renderTransitionTileHTML nie mutuje live (koniec losowych `prz-legacy-*`).
 * - render 2× → identyczny HTML i identyczny live (brak klucza id),
 * - istniejące id nietknięte i użyte w HTML,
 * - Math.random=throw nie psuje renderu (guard przeciw regresji),
 * - statycznie: brak Math.random/Date.now w pliku.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function loadRenderer(extra: object = {}) {
    const sandbox: any = {
        console,
        FLOW_TYPES: { WYLOT: 'WYLOT', WLOT: 'WLOT' },
        escapeHtml: (s: any) => String(s === null || s === undefined ? '' : s),
        window: {},
        ...extra
    };
    vm.createContext(sandbox);
    vm.runInContext(readJs('studnie/transitionRenderer.js'), sandbox, {
        filename: 'transitionRenderer.js'
    });
    return sandbox;
}

const ITEM = () => ({ productId: 'p1', angle: 90, rzednaWlaczenia: 10 });
const PRODUCT = { category: 'KAT', dn: '200', price: 100 };
const OPTS = (item: any) => ({ well: { przejscia: [item] }, showPrice: false });

describe('transitionRenderer — brak mutacji live (P0)', () => {
    it('render 2×: identyczny HTML, live bez klucza id', () => {
        const sb = loadRenderer();
        // flowType ustawia deterministyczny classifyFlowType (pre-existing, poza P0)
        const item = { ...ITEM(), flowType: 'WLOT' };
        const before = JSON.stringify(item);
        const h1 = sb.renderTransitionTileHTML(item, 0, PRODUCT, OPTS(item));
        const h2 = sb.renderTransitionTileHTML(item, 1, PRODUCT, OPTS(item));
        expect(JSON.stringify(item)).toBe(before);
        expect('id' in item).toBe(false);
        // ten sam obiekt i indeks → ten sam HTML (deterministyczny tileId)
        const h1b = sb.renderTransitionTileHTML(item, 0, PRODUCT, OPTS(item));
        expect(h1b).toBe(h1);
        expect(h1).toContain('prz-legacy-0');
        expect(h2).toContain('prz-legacy-1');
    });

    it('istniejące id: nietknięte i użyte w data-qe-id', () => {
        const sb = loadRenderer();
        const item = { ...ITEM(), id: 'abc123' };
        const h = sb.renderTransitionTileHTML(item, 0, PRODUCT, OPTS(item));
        expect(item.id).toBe('abc123');
        expect(h).toContain('data-qe-id="abc123"');
        expect(h).not.toContain('undefined');
    });

    it('Math.random=throw: render działa (guard przeciw losowości)', () => {
        const sb = loadRenderer({
            Math: {
                ...Math,
                random: () => {
                    throw new Error('RANDOM_FORBIDDEN');
                }
            }
        });
        const item = ITEM();
        expect(() => sb.renderTransitionTileHTML(item, 0, PRODUCT, OPTS(item))).not.toThrow();
        expect('id' in item).toBe(false);
    });

    it('statycznie: brak Math.random/Date.now w pliku', () => {
        const src = readJs('studnie/transitionRenderer.js');
        expect(src).not.toMatch(/Math\.random/);
        expect(src).not.toMatch(/Date\.now/);
    });
});

describe('ensureStudnieCatalogReady — deterministyczne wejście (P0b)', () => {
    function loadHelpers(extra: object = {}) {
        const warns: any[] = [];
        const sandbox: any = {
            console,
            window: { logger: { warn: (...a: any[]) => void warns.push(a) } },
            ...extra
        };
        vm.createContext(sandbox);
        vm.runInContext(readJs('studnie/orderHelpers.js'), sandbox, {
            filename: 'orderHelpers.js'
        });
        return { sandbox, warns };
    }

    it('cennik gotowy → true natychmiast', async () => {
        const { sandbox } = loadHelpers();
        sandbox.window.studnieProducts = [{ id: 'p1' }];
        await expect(sandbox.ensureStudnieCatalogReady(5000)).resolves.toBe(true);
    });

    it('settled bez cennika → false bez czekania na timeout', async () => {
        const { sandbox, warns } = loadHelpers();
        sandbox.window.studnieProducts = [];
        sandbox.window.__studnieProductsSettled = true;
        await expect(sandbox.ensureStudnieCatalogReady(15000)).resolves.toBe(false);
        expect(warns.length).toBe(0);
    });

    it('timeout → false + warn (best-effort, bez deadlocku)', async () => {
        const { sandbox, warns } = loadHelpers();
        sandbox.window.studnieProducts = [];
        await expect(sandbox.ensureStudnieCatalogReady(0)).resolves.toBe(false);
        expect(warns.length).toBe(1);
    });
});
