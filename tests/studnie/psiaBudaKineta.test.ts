// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('syncKineta — psia buda wymusza dennicę bez dna (kineta/spocznik/spocznikH = brak)', () => {
    const products = [
        {
            id: 'dennica-1000-1000',
            name: 'Dennica DN1000 H=1000',
            componentType: 'dennica',
            dn: '1000',
            height: 1000
        },
        {
            id: 'kineta-1000-12',
            name: 'Kineta DN1000 H=1/2',
            componentType: 'kineta',
            dn: '1000'
        }
    ];

    function loadCtx() {
        const context = {
            studnieProducts: products,
            showToast: () => {},
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            window: {}
        };
        vm.createContext(context);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/actionsWellSync.js'),
            'utf8'
        );
        vm.runInContext(code, context);
        return context;
    }

    test('psiaBuda=true → kineta/spocznik/spocznikH wymuszone na brak, produkt kineta usunięty', () => {
        const ctx = loadCtx();
        const well = {
            dn: '1000',
            psiaBuda: true,
            kineta: 'beton',
            spocznik: 'beton',
            spocznikH: '1/2',
            config: [
                { productId: 'kineta-1000-12', quantity: 1 },
                { productId: 'dennica-1000-1000', quantity: 1 }
            ]
        };
        ctx.syncKineta(well);

        expect(well.kineta).toBe('brak');
        expect(well.spocznik).toBe('brak');
        expect(well.spocznikH).toBe('brak');
        expect(well.config).toEqual([{ productId: 'dennica-1000-1000', quantity: 1 }]);
    });

    test('psiaBuda=false → zachowanie standardowe, kineta zostaje zachowana', () => {
        const ctx = loadCtx();
        const well = {
            dn: '1000',
            kineta: 'beton',
            spocznik: 'beton',
            spocznikH: '1/2',
            config: [
                { productId: 'kineta-1000-12', quantity: 1 },
                { productId: 'dennica-1000-1000', quantity: 1 }
            ]
        };
        ctx.syncKineta(well);

        expect(well.kineta).toBe('beton');
        expect(well.spocznik).toBe('beton');
        expect(well.spocznikH).toBe('1/2');
        expect(well.config.some((i) => i.productId === 'kineta-1000-12')).toBe(true);
    });
});
