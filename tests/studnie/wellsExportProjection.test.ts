// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// P1-A DoD: projekcja wellsExport deterministyczna i niewrazliwa na runtime/config.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadEntry() {
    const context: any = { window: {} as any, document: { querySelectorAll: () => [] } };
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/studnie/orderCrud.js'), 'utf8'),
        context
    );
    return context.buildWellsExportEntry;
}

describe('buildWellsExportEntry — deterministycznosc projekcji', () => {
    test('ten sam input → identyczny wpis (deep equal)', () => {
        const build = loadEntry();
        const well = { name: 'S1', dn: '1000', config: [{ productId: 'x', quantity: 2 }] };
        const stats = { height: 3, weight: 1500, price: 5000 };
        expect(build(well, stats, 100, 'A')).toEqual(build(well, stats, 100, 'A'));
    });

    test('runtime i tresc config nie zmieniaja wpisu', () => {
        const build = loadEntry();
        const stats = { height: 3, weight: 1500, price: 5000 };
        const base = { name: 'S1', dn: '1000', config: [{ productId: 'x', quantity: 2 }] };
        const dirty = {
            ...base,
            _xp: 999,
            _addedAt: 123,
            isPlaceholder: true,
            config: [{ productId: 'TOTALLY-DIFFERENT', quantity: 99, _xp: 1 }],
            przejscia: [{ whatever: 1 }]
        };
        expect(build(dirty, stats, 100, 'A')).toEqual(build(base, stats, 100, 'A'));
    });

    test('wpis ma dokladnie 8 skalarow (guard przed rozdmuchaniem)', () => {
        const build = loadEntry();
        const entry = build(
            { name: 'S1', dn: '1000', config: [] },
            { height: 1, weight: 2, price: 3 },
            4,
            'Z'
        );
        expect(Object.keys(entry).sort()).toEqual(
            [
                'dn',
                'height',
                'name',
                'price',
                'transportCost',
                'totalPrice',
                'weight',
                'zwienczenie'
            ].sort()
        );
        expect(entry.totalPrice).toBe(7);
    });
});
