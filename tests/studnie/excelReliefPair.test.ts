// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('para odciazajaca plyta<->pierscien w Excelu (SSoT _excelSyncReliefPair)', () => {
    const products: any[] = [
        {
            id: 'plyta-zam-1000-150',
            componentType: 'plyta_zamykajaca',
            dn: '1000',
            height: 150,
            name: 'Płyta zamykająca DN1000 H=150'
        },
        {
            id: 'pierscien-1000-150',
            componentType: 'pierscien_odciazajacy',
            dn: '1000',
            height: 150,
            name: 'Pierścień odciążający DN1000 H=150'
        },
        {
            id: 'krag-1000-500',
            componentType: 'krag',
            dn: '1000',
            height: 500,
            name: 'Krąg DN1000 H=500'
        }
    ];

    function loadCtx() {
        const context: any = {
            window: {},
            studnieProducts: products,
            _excelClearResCache: () => {},
            showToast: () => {},
            getAvailableProducts: () => products,
            filterByWellParams: () => true
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelConfigManager.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        return context;
    }

    function wellWith(config: any[]) {
        return { id: 'w1', dn: '1000', config: config.map((c) => ({ ...c })) };
    }

    test('dodanie plyty dobiera pierscien qty 1', () => {
        const ctx = loadCtx();
        const well = wellWith([{ productId: 'plyta-zam-1000-150', quantity: 1 }]);
        const mutated = ctx._excelSyncReliefPair(well, 'plyta_zamykajaca', 1, true);
        expect(mutated).toBe(true);
        const ring = well.config.find((x: any) => x.productId === 'pierscien-1000-150');
        expect(ring).toBeDefined();
        expect(ring.quantity).toBe(1);
    });

    test('dodanie pierscienia dobiera plyte qty 1', () => {
        const ctx = loadCtx();
        const well = wellWith([{ productId: 'pierscien-1000-150', quantity: 1 }]);
        const mutated = ctx._excelSyncReliefPair(well, 'pierscien_odciazajacy', 1, true);
        expect(mutated).toBe(true);
        const plate = well.config.find((x: any) => x.productId === 'plyta-zam-1000-150');
        expect(plate).toBeDefined();
        expect(plate.quantity).toBe(1);
    });

    test('usuniecie plyty (0) usuwa pierscien', () => {
        const ctx = loadCtx();
        // model juz usunal plyte (zostal sam pierscien), sync z hadChanged=true
        const well = wellWith([{ productId: 'pierscien-1000-150', quantity: 1 }]);
        const mutated = ctx._excelSyncReliefPair(well, 'plyta_zamykajaca', 0, true);
        expect(mutated).toBe(true);
        expect(well.config.length).toBe(0);
    });

    test('usuniecie pierscienia (0) usuwa plyte', () => {
        const ctx = loadCtx();
        const well = wellWith([{ productId: 'plyta-zam-1000-150', quantity: 1 }]);
        const mutated = ctx._excelSyncReliefPair(well, 'pierscien_odciazajacy', 0, true);
        expect(mutated).toBe(true);
        expect(well.config.length).toBe(0);
    });

    test('czyszczenie pustej komorki pierscienia nie usuwa plyty', () => {
        const ctx = loadCtx();
        const well = wellWith([{ productId: 'plyta-zam-1000-150', quantity: 1 }]);
        const mutated = ctx._excelSyncReliefPair(well, 'pierscien_odciazajacy', 0, false);
        expect(mutated).toBe(false);
        expect(well.config.length).toBe(1);
    });

    test('komplet 1+1 jest stabilny (brak duplikatow)', () => {
        const ctx = loadCtx();
        const well = wellWith([
            { productId: 'plyta-zam-1000-150', quantity: 1 },
            { productId: 'pierscien-1000-150', quantity: 1 }
        ]);
        expect(ctx._excelSyncReliefPair(well, 'plyta_zamykajaca', 1, true)).toBe(false);
        expect(ctx._excelSyncReliefPair(well, 'pierscien_odciazajacy', 1, true)).toBe(false);
        expect(well.config.length).toBe(2);
    });
});

describe('excelOnCompChange relief: brak re-rendera, partner w miejscu (fokus/strzalki)', () => {
    const products: any[] = [
        {
            id: 'plyta-zam-1000-150',
            componentType: 'plyta_zamykajaca',
            dn: '1000',
            height: 150,
            name: 'Płyta zamykająca DN1000 H=150'
        },
        {
            id: 'pierscien-1000-150',
            componentType: 'pierscien_odciazajacy',
            dn: '1000',
            height: 150,
            name: 'Pierścień odciążający DN1000 H=150'
        }
    ];
    const byId = (id: string) => products.find((p) => p.id === id) || null;

    function loadHandlerCtx(well: any, inputs: any[]) {
        const children: any[] = [];
        for (let i = 0; i < 12; i++) {
            children.push({ querySelector: () => inputs[i] || null });
        }
        const fakeRow = { querySelector: () => null, children };
        const calls: any = { markManual: 0, renderTable: 0 };
        const context: any = {
            window: {},
            document: { querySelector: () => fakeRow },
            wells: [well],
            studnieProducts: products,
            _excelActiveTab: '1000',
            _excelPasteInProgress: false,
            _excelBatchKragTouched: false,
            _excelBatchReliefTouched: false,
            getStudnieProductById: byId,
            getAvailableProducts: () => products,
            filterByWellParams: () => true,
            _excelGuardWellLocked: () => true,
            _excelSaveUndoSnapshot: () => {},
            _excelMarkAsManual: () => {},
            _excelClearResCache: () => {},
            _excelCleanEmptyPrzejscia: () => {},
            showToast: () => {},
            _excelMarkManual: () => {
                calls.markManual++;
            },
            _excelRenderTable: () => {
                calls.renderTable++;
            },
            _excelRefreshAutoCells: () => {},
            _excelUpdateLeftPreview: () => {},
            _excelUpdateHeaderProdCodes: () => {},
            _excelDebouncedRefresh: () => {},
            _excelGetVisibleComponentColumns: () => [
                {
                    id: 'plyta_zamykajaca_150',
                    type: 'number',
                    componentType: 'plyta_zamykajaca',
                    height: 150
                },
                {
                    id: 'pierscien_odciazajacy_150',
                    type: 'number',
                    componentType: 'pierscien_odciazajacy',
                    height: 150
                }
            ],
            _excelCountProductInConfig: (w: any, ct: string, h: any) => {
                let n = 0;
                for (const it of w.config || []) {
                    const p = byId(it.productId);
                    if (p && p.componentType === ct && parseInt(p.height) === parseInt(h))
                        n += it.quantity || 0;
                }
                return n;
            },
            _excelBuildVisibleSeq: () => [
                { vis: 10, logical: 10, id: 'plyta_zamykajaca_150' },
                { vis: 11, logical: 11, id: 'pierscien_odciazajacy_150' }
            ],
            calls
        };
        const codeManager = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelConfigManager.js'),
            'utf8'
        );
        const codeChange = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/excelChangeHandlers.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(codeManager, context);
        vm.runInContext(codeChange, context);
        return context;
    }

    function mkInputs(plateVal: string, ringVal: string) {
        const inputs: any[] = [];
        for (let i = 0; i < 12; i++) inputs.push({ value: '' });
        inputs[10] = { value: plateVal };
        inputs[11] = { value: ringVal };
        return inputs;
    }

    test('wpisanie 1 w plyte: para w modelu, brak rendera, pierscien=1 w miejscu', () => {
        const well = { id: 'w1', dn: '1000', config: [] };
        const inputs = mkInputs('1', '');
        const ctx = loadHandlerCtx(well, inputs);
        ctx.excelOnCompChange(0, 'plyta_zamykajaca', 150, '1');
        const ids = well.config.map((x: any) => x.productId).sort();
        expect(ids).toEqual(['pierscien-1000-150', 'plyta-zam-1000-150']);
        expect(ctx.calls.markManual).toBe(0);
        expect(ctx.calls.renderTable).toBe(0);
        expect(inputs[11].value).toBe('1');
    });

    test('wpisanie 1 w pierscien: para w modelu, brak rendera, plyta=1 w miejscu', () => {
        const well = { id: 'w1', dn: '1000', config: [] };
        const inputs = mkInputs('', '1');
        // edytowana komorka to pierscien (vis 11) — inputs[11] ma '1' od usera
        const ctx = loadHandlerCtx(well, inputs);
        ctx.excelOnCompChange(0, 'pierscien_odciazajacy', 150, '1');
        const ids = well.config.map((x: any) => x.productId).sort();
        expect(ids).toEqual(['pierscien-1000-150', 'plyta-zam-1000-150']);
        expect(ctx.calls.markManual).toBe(0);
        expect(ctx.calls.renderTable).toBe(0);
        expect(inputs[10].value).toBe('1');
    });

    test('wyzerowanie plyty: pierscien znika z modelu i z komorki, brak rendera', () => {
        const well = {
            id: 'w1',
            dn: '1000',
            config: [
                { productId: 'plyta-zam-1000-150', quantity: 1 },
                { productId: 'pierscien-1000-150', quantity: 1 }
            ]
        };
        const inputs = mkInputs('', '1');
        const ctx = loadHandlerCtx(well, inputs);
        ctx.excelOnCompChange(0, 'plyta_zamykajaca', 150, '');
        expect(well.config.length).toBe(0);
        expect(ctx.calls.markManual).toBe(0);
        expect(ctx.calls.renderTable).toBe(0);
        expect(inputs[11].value).toBe('');
    });
});
