// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Wybór kinety w formularzu zlecenia musi trafiać do modelu studni tak samo jak
 * w konfiguratorze: domyślny spocznikH + pozycja kinety w configu + świeża cena.
 * Regresja: brak spocznikH sprawiał, że syncKineta cofał kinetę na 'brak'.
 */
describe('orderZleceniaForm — kineta aktualizuje parametry i cenę studni', () => {
    const products = [
        {
            id: 'dennica-1000-1000',
            name: 'Dennica DN1000 H=1000',
            componentType: 'dennica',
            dn: '1000',
            height: 1000,
            price: 1000
        },
        {
            id: 'kineta-1000-12',
            name: 'Kineta DN1000 H=1/2',
            componentType: 'kineta',
            dn: '1000',
            price: 250
        }
    ];

    function loadCtx() {
        const calls = { invalidated: 0, refreshed: 0 };
        const inputs: Record<string, any> = {};
        const input = (id: string) => {
            inputs[id] = inputs[id] || { value: '' };
            return inputs[id];
        };
        const context: any = {
            window: {},
            studnieProducts: products,
            productionOrders: [],
            showToast: () => {},
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            invalidateFrozenPricesForWell: () => {
                calls.invalidated++;
            },
            pzGuard: { findPzForElement: () => context.__existing },
            document: {
                getElementById: (id: string) => (id === 'zl-uwagi' ? null : input(id)),
                querySelector: () => null,
                querySelectorAll: () => [],
                addEventListener: () => {}
            },
            refreshAll: () => {
                calls.refreshed++;
            },
            buildZleceniaWellList: () => {},
            selectZleceniaElement: () => {}
        };
        context.window = context;
        vm.createContext(context);
        for (const file of ['actionsWellSync.js', 'orderZleceniaForm.js']) {
            vm.runInContext(
                fs.readFileSync(path.join(__dirname, '../../public/js/studnie', file), 'utf8'),
                context,
                { filename: file }
            );
        }
        return { context, calls };
    }

    function makeWell() {
        return {
            id: 'w1',
            dn: '1000',
            kineta: 'brak',
            spocznik: 'brak',
            spocznikH: 'brak',
            config: [{ productId: 'dennica-1000-1000', quantity: 1 }]
        };
    }

    test('Brak → Beton: spocznikH 1/2, pozycja kinety w configu, cena unieważniona', async () => {
        const { context, calls } = loadCtx();
        const well = makeWell();
        const existing = { kineta: 'brak', spocznik: 'brak', spocznikH: 'brak' };
        context.__existing = existing;
        context.zleceniaSelectedIdx = 0;
        context.zleceniaElementsList = [
            {
                well,
                product: { id: 'krag-1000-500', componentType: 'krag', category: 'KRĄG' },
                elementIndex: 0,
                wellIndex: 0,
                configItem: { _elemId: 'elem-1' }
            }
        ];

        const btn = {
            closest: () => ({ querySelectorAll: () => [] }),
            classList: { add: () => {}, remove: () => {} }
        };
        await context.selectZleceniaTile(btn, 'zl-kineta', 'beton');

        expect(well.kineta).toBe('beton');
        expect(well.spocznik).toBe('beton');
        expect(well.spocznikH).toBe('1/2');
        expect(well.config.some((item: any) => item.productId === 'kineta-1000-12')).toBe(true);
        expect(existing).toEqual({ kineta: 'beton', spocznik: 'beton', spocznikH: '1/2' });
        expect(calls.invalidated).toBe(1);
        expect(calls.refreshed).toBe(1);
    });

    test('Wybór wysokości spocznika przy Brak kinety włącza kinetę (jak w konfiguratorze)', async () => {
        const { context } = loadCtx();
        const well = makeWell();
        context.__existing = null;
        context.zleceniaSelectedIdx = 0;
        context.zleceniaElementsList = [
            {
                well,
                product: { id: 'krag-1000-500', componentType: 'krag', category: 'KRĄG' },
                elementIndex: 0,
                wellIndex: 0,
                configItem: { _elemId: 'elem-1' }
            }
        ];

        const btn = {
            closest: () => ({ querySelectorAll: () => [] }),
            classList: { add: () => {}, remove: () => {} }
        };
        await context.selectZleceniaTile(btn, 'zl-spocznik-h', '1/2');

        expect(well.kineta).toBe('beton');
        expect(well.spocznik).toBe('beton');
        expect(well.spocznikH).toBe('1/2');
        expect(well.config.some((item: any) => item.productId === 'kineta-1000-12')).toBe(true);
    });

    test('PRECO wymusza spocznikH 1/1', () => {
        const { context } = loadCtx();
        const well = makeWell();

        context.applyZleceniaKinetaChange(well, 'preco', null);

        expect(well.kineta).toBe('preco');
        expect(well.spocznikH).toBe('1/1');
    });

    test('Powrót do Brak usuwa pozycję kinety i zeruje spocznik', () => {
        const { context } = loadCtx();
        const well = makeWell();
        well.kineta = 'beton';
        well.spocznik = 'beton';
        well.spocznikH = '1/2';
        well.config.push({ productId: 'kineta-1000-12', quantity: 1, autoAdded: true });

        context.applyZleceniaKinetaChange(well, 'brak', null);

        expect(well.kineta).toBe('brak');
        expect(well.spocznik).toBe('brak');
        expect(well.spocznikH).toBe('brak');
        expect(well.config.some((item: any) => item.productId === 'kineta-1000-12')).toBe(false);
    });
});
