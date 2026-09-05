// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// Korekta 1 recenzji P0: PZ Map === legacy findPzForElement (key, potem index).
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadBulkCtx(productionOrders: any[]) {
    const context: any = {
        productionOrders,
        wells: [],
        zleceniaElementsList: [],
        getElementStatus: () => 'open',
        window: {} as any,
        document: { getElementById: () => null, createElement: () => null, body: {} },
        showToast: () => {},
        console
    };
    context.window = context.window || {};
    vm.createContext(context);
    const pzCode = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/pzGuard.js'),
        'utf8'
    );
    vm.runInContext(pzCode, context);
    const bulkCode = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/orderBulk.js'),
        'utf8'
    );
    vm.runInContext(bulkCode, context);
    return context;
}

describe('bulk PZ Map parity z findPzForElement', () => {
    test('key match, index fallback, brak PZ — identycznie jak legacy', () => {
        const productionOrders = [
            { wellId: 'w1', elementKey: 'e1', elementIndex: 0, status: 'draft' },
            { wellId: 'w1', elementIndex: 5, status: 'accepted' }
        ];
        const ctx = loadBulkCtx(productionOrders);
        const pzMap = ctx._bulkBuildPzMap();

        const cases = [
            {
                el: { well: { id: 'w1' }, configItem: { _elemId: 'e1' }, elementIndex: 0 },
                want: 'saved'
            },
            {
                el: { well: { id: 'w1' }, configItem: { _elemId: 'other' }, elementIndex: 5 },
                want: 'accepted'
            },
            { el: { well: { id: 'w1' }, configItem: {}, elementIndex: 5 }, want: 'accepted' },
            {
                el: { well: { id: 'w1' }, configItem: { _elemId: 'nope' }, elementIndex: 9 },
                want: 'open'
            },
            {
                el: { well: { id: 'wX' }, configItem: { _elemId: 'e1' }, elementIndex: 0 },
                want: 'open'
            }
        ];
        for (const c of cases) {
            const viaMap = ctx._bulkElementStatus(c.el, pzMap);
            const legacy = ctx.window.pzGuard.findPzForElement(
                productionOrders,
                c.el.well.id,
                (c.el.configItem && c.el.configItem._elemId) || '',
                c.el.elementIndex
            );
            const legacyStatus =
                legacy && legacy.status === 'accepted' ? 'accepted' : legacy ? 'saved' : 'open';
            expect(viaMap).toBe(legacyStatus);
            expect(viaMap).toBe(c.want);
        }
    });

    test('flaga OFF — Map pomija key jak legacy (tylko index)', () => {
        const productionOrders = [
            { wellId: 'w3', elementKey: 'k1', elementIndex: 1, status: 'draft' },
            { wellId: 'w3', elementKey: 'k2', elementIndex: 2, status: 'accepted' }
        ];
        const ctx = loadBulkCtx(productionOrders);
        ctx.window.pzGuard.setPzStableIdEnabled(false);
        const pzMap = ctx._bulkBuildPzMap();
        // Po key (k1) legacy nic nie znajduje — index 9 nie istnieje → open.
        const el = { well: { id: 'w3' }, configItem: { _elemId: 'k1' }, elementIndex: 9 };
        expect(ctx._bulkElementStatus(el, pzMap)).toBe('open');
        expect(
            ctx.window.pzGuard.findPzForElement(productionOrders, 'w3', 'k1', 9)
        ).toBeUndefined();
        ctx.window.pzGuard.setPzStableIdEnabled(true);
    });

    test('legacy PZ bez elementKey (fallback index) — Map trafia tak samo', () => {
        const productionOrders = [{ wellId: 'w2', elementIndex: 3, status: 'draft' }];
        const ctx = loadBulkCtx(productionOrders);
        const pzMap = ctx._bulkBuildPzMap();
        const el = { well: { id: 'w2' }, configItem: {}, elementIndex: 3 };
        expect(ctx._bulkElementStatus(el, pzMap)).toBe('saved');
        expect(
            ctx.window.pzGuard.findPzForElement(productionOrders, 'w2', '', 3)?.elementIndex
        ).toBe(3);
    });
});
