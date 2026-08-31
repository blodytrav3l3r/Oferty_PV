import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('excel patch undo — B+ fuzz oracle', () => {
    let ctx: any;
    beforeAll(() => {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: [],
            currentWellIndex: 0,
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1 },
            _excelUndoStack: [],
            _excelRedoStack: [],
            _EXCEL_UNDO_LIMIT: 50,
            _excelWellIndexById: new Map(),
            structuredClone: global.structuredClone,
            _excelMarkDirty: () => {},
            _excelRenderTable: () => {},
            _excelRebuildWellIndex: () => {},
            _excelSnapshotLockedWells: () => ({}),
            _excelRestoreLockedWells: () => {},
            _excelDebouncedRefresh: () => {},
            showToast: () => {},
            console,
            logger: { warn() {}, error() {} },
            document: {
                getElementById: () => null,
                addEventListener: () => {},
                querySelector: () => null,
                querySelectorAll: () => [],
                createElement: () => ({})
            },
            window: null as any,
            localStorage: { getItem: () => null },
            location: { search: '' }
        };
        context.window = context;
        vm.createContext(context);
        for (const f of ['excelState.js', 'excelTableManager.js']) {
            const code = fs.readFileSync(path.join(base, f), 'utf8');
            try {
                vm.runInContext(code, context);
            } catch {}
        }
        ctx = context;
        // ensure wells global
        ctx.wells = [
            { id: 'well-0', name: 'Ss0', dn: '1000', config: [], rzednaWlazu: 10, rzednaDna: 5 },
            { id: 'well-1', name: 'Ss1', dn: '1000', config: [], rzednaWlazu: 11, rzednaDna: 6 }
        ];
        if (ctx._excelBuildWellIndex) ctx._excelBuildWellIndex();
    });

    test('cell-edit patch undo/redo vs full snapshot', () => {
        for (let i = 0; i < 100; i++) {
            const wIdx = i % 2;
            const well = ctx.wells[wIdx];
            const before = well.name;
            const after = 'Ss' + wIdx + '-edit-' + i;
            // save cell-edit patch
            ctx._excelSaveCellPatch(well.id, 'name', before, after);
            // apply edit
            well.name = after;
            expect(well.name).toBe(after);
            // undo should restore before
            ctx._excelUndo();
            expect(well.name).toBe(before);
            // redo should reapply after
            ctx._excelRedo();
            expect(well.name).toBe(after);
            // cleanup for next iter: undo to before for determinism
            ctx._excelUndo();
            expect(well.name).toBe(before);
            // clear stacks for next
            ctx._excelUndoStack.length = 0;
            ctx._excelRedoStack.length = 0;
        }
    });

    test('batch patch undo/redo', () => {
        const w0Before = ctx.wells[0].name;
        const w1Before = ctx.wells[1].name;
        const changes = [
            { wellId: 'well-0', path: 'name', before: w0Before, after: 'batch0' },
            { wellId: 'well-1', path: 'name', before: w1Before, after: 'batch1' }
        ];
        ctx._excelSaveBatchPatch(changes);
        ctx.wells[0].name = 'batch0';
        ctx.wells[1].name = 'batch1';
        expect(ctx.wells[0].name).toBe('batch0');
        ctx._excelUndo();
        expect(ctx.wells[0].name).toBe(w0Before);
        expect(ctx.wells[1].name).toBe(w1Before);
        ctx._excelRedo();
        expect(ctx.wells[0].name).toBe('batch0');
        expect(ctx.wells[1].name).toBe('batch1');
    });
});
