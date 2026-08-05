// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Excel lock guards (PZ accepted / zamówienie)', () => {
    function runContext(locked) {
        const well = {
            dn: '1000',
            rzednaWlazu: 2.5,
            rzednaDna: 0.0,
            kineta: 'brak',
            przejscia: [],
            config: [{ productId: 'krag-1000-500', quantity: 1 }]
        };
        const wells = [well];
        let snapshotCalls = 0;
        const context = {
            window: {},
            document: { querySelector: () => null },
            wells,
            currentWellIndex: 0,
            locked,
            isWellLocked: () => locked,
            showToast: () => {},
            _excelIsWellLocked: null, // zdefiniowane w excelHelpers.js
            _excelSaveUndoSnapshot: () => {
                snapshotCalls++;
            },
            _excelMarkAsManual: () => {},
            _excelClearResCache: () => {},
            _excelInsertConfigItem: (w, ct, pid, q) => {
                w.config.unshift({ productId: pid, quantity: q });
            },
            _excelCleanEmptyPrzejscia: () => {},
            _excelMarkManual: () => {},
            _excelRefreshAutoCells: () => {},
            _excelUpdateLeftPreview: () => {},
            _excelUpdateHeaderProdCodes: () => {},
            _excelDebouncedRefresh: () => {},
            _excelMarkDirty: () => {},
            _excelRenderTable: () => {},
            _excelSortConfig: () => {},
            getAvailableProducts: () => [],
            filterByWellParams: () => true,
            syncKineta: () => {}
        };
        const files = ['excelHelpers.js', 'excelChangeHandlers.js'];
        vm.createContext(context);
        for (const f of files) {
            const code = fs.readFileSync(
                path.join(__dirname, '../../public/js/studnie/' + f),
                'utf8'
            );
            vm.runInContext(code, context);
        }
        return { context, well, snapshotCalls: () => snapshotCalls };
    }

    test('kineta: zablokowana studnia nie zmienia wartości', () => {
        const { context, well } = runContext(true);
        context.excelOnKinetaChange(0, 'preco');
        expect(well.kineta).toBe('brak');
    });

    test('kineta: odblokowana studnia zmienia wartość (kontrola)', () => {
        const { context, well } = runContext(false);
        context.excelOnKinetaChange(0, 'preco');
        expect(well.kineta).toBe('preco');
    });

    test('comp: zablokowana studnia nie modyfikuje config ani snapshotu', () => {
        const { context, well, snapshotCalls } = runContext(true);
        context.excelOnCompChange(0, 'krag', 500, '2');
        expect(well.config).toEqual([{ productId: 'krag-1000-500', quantity: 1 }]);
        expect(snapshotCalls()).toBe(0);
    });

    test('rzedna: zablokowana studnia nie zmienia wartości', () => {
        const { context, well } = runContext(true);
        context.excelOnRzednaChange(0);
        expect(well.rzednaWlazu).toBe(2.5);
        expect(well.rzednaDna).toBe(0.0);
    });
});
