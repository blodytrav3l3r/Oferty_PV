// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Parytet cen: "Konfiguracja betonowa" liczy wiersze tym samym SSoT
 * calculateLinePricing co zakładka Oferta (transport + dopłata + PRECO +
 * przejścia), a kineta idzie podwierszem, nie osobnym wierszem.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

const PRODUCTS: Record<string, any> = {
    DEN: { id: 'DEN', name: 'Dennica DN1000', componentType: 'dennica', dn: 1000, weight: 100 },
    KRG: { id: 'KRG', name: 'Krąg DN1000', componentType: 'krag', dn: 1000, weight: 50 },
    KIN: { id: 'KIN', name: 'Kineta DN1000', componentType: 'kineta', dn: 1000, weight: 10 }
};

function loadRender(well: any) {
    const sandbox: any = { window: {}, console };
    vm.createContext(sandbox);
    const lineCalls: any[] = [];
    let tbodyHtml = '';
    sandbox.document = {
        getElementById: (id: string) =>
            id === 'well-config-body'
                ? {
                      set innerHTML(v: string) {
                          tbodyHtml = v;
                      },
                      get innerHTML() {
                          return tbodyHtml;
                      }
                  }
                : null
    };
    sandbox.ensureElemIds = () => {};
    sandbox.getCurrentWell = () => well;
    sandbox.resolveEffectiveProduct = (_w: any, pid: string) => PRODUCTS[pid];
    sandbox.getStudnieProductById = (pid: string) => PRODUCTS[pid];
    sandbox.studnieProducts = Object.values(PRODUCTS);
    sandbox.isFrozenPriceCtx = () => false;
    sandbox.getItemAssessedPriceSafe = () => 10;
    sandbox.getWellActiveDiscounts = () => ({});
    sandbox.calculateAssignedPrzejscia = () => [[{ productId: 'P1' }], [], []];
    sandbox.calculateOfferTotals = () => ({ globalWeight: 100, totalTransportCost: 200 });
    sandbox.safeCalcWellStats = () => ({ weight: 50 });
    sandbox.computePrecoWellContext = () => undefined;
    sandbox.calculatePrecoAllocationForItem = () => ({
        hasPreco: false,
        fraction: 0,
        isBottomMostDennica: false
    });
    sandbox.getPehdTypeForComponent = () => 'brak';
    sandbox.getWellDiscountPctSafe = () => 10;
    sandbox.getItemPriceBreakdownSafe = () => ({ malowanieW: 50, malowanieZ: 0 });
    sandbox.calculateLinePricing = (
        w: any,
        p: any,
        item: any,
        transport: number,
        disc: any,
        assigned: any,
        index: number,
        precoCtx: any
    ) => {
        lineCalls.push({ p, item, transport, disc, assigned, index, precoCtx });
        return { totalLinePrice: 1000 * (index + 1), totalLineWeight: 10 };
    };
    sandbox.fmtInt = (v: number) => String(Math.round(v));
    sandbox.fmt = (v: number) => String(v);
    sandbox.escapeHtml = (s: unknown) => String(s);
    sandbox.escapeHtmlAttr = (s: unknown) => String(s);
    vm.runInContext(readJs('studnie/actionsConfigRender.js'), sandbox, {
        filename: 'actionsConfigRender.js'
    });
    return { sandbox, lineCalls, html: () => tbodyHtml };
}

function baseWell() {
    return {
        dn: 1000,
        kineta: 'beton',
        spocznik: 'beton',
        config: [
            { productId: 'DEN', quantity: 1 },
            { productId: 'KRG', quantity: 2 },
            { productId: 'KIN', quantity: 1 }
        ]
    };
}

describe('konfiguracja betonowa: ceny jak w ofercie', () => {
    it('wiersz = calculateLinePricing z transportem, rabatem i przejsciem', () => {
        const well = baseWell();
        const { sandbox, lineCalls, html } = loadRender(well);
        sandbox.renderWellConfig();
        // Tylko nie-kinetowe: dennica + krąg.
        expect(lineCalls.map((c) => c.index)).toEqual([0, 1]);
        for (const c of lineCalls) {
            expect(c.transport).toBe(100); // 200 * (50/100)
            expect(c.disc).toEqual({ dennica: 0, nadbudowa: 0 });
            expect(c.precoCtx).toBeUndefined();
        }
        expect(lineCalls[0].assigned).toEqual([{ productId: 'P1' }]);
        expect(lineCalls[0].item).toBe(well.config[0]);
        expect(html()).toContain('1000 PLN');
        expect(html()).toContain('2000 PLN');
    });

    it('kineta bez osobnego wiersza, podwiersz pod dennicą', () => {
        const { sandbox, html } = loadRender(baseWell());
        sandbox.renderWellConfig();
        const rows = (html().match(/data-cfg-idx="/g) || []).length;
        expect(rows).toBe(2);
        expect(html()).toContain('↳ + Kineta DN1000');
        expect(html()).toContain('w cenie: malowanie kinety');
    });
});
