import { observeStudnieOrderDto } from '../../src/validators/orderSchemas';

function cleanOrder() {
    return {
        id: 'order-1',
        wells: [
            {
                id: 'well-1',
                name: 'S1',
                dn: '1000',
                rzednaDna: 100,
                configSource: 'AUTO',
                config: [{ productId: 'k-1', quantity: 2, _elemId: 'el-1' }],
                przejscia: [{ productId: 'p-1', angle: 90 }]
            }
        ]
    };
}

describe('observeStudnieOrderDto — P0.3 observe (non-blocking)', () => {
    test('czyste DTO: zero unknown, zero leaków', () => {
        const obs = observeStudnieOrderDto(cleanOrder());
        expect(obs.wellsChecked).toBe(1);
        expect(obs.unknownWellKeys).toEqual([]);
        expect(obs.unknownConfigKeys).toEqual([]);
        expect(obs.unknownPrzejscieKeys).toEqual([]);
        expect(obs.runtimeLeaked).toEqual([]);
    });

    test('wykrywa runtime leak i unknown keys bez rzucania', () => {
        const order = cleanOrder() as any;
        order.wells[0]._lastAutoConfig = 'x';
        order.wells[0].solverCache = {};
        order.wells[0].config[0].isPlaceholder = true;
        order.wells[0].przejscia[0].weirdField = 1;
        const obs = observeStudnieOrderDto(order);
        expect(obs.runtimeLeaked).toContain('_lastAutoConfig');
        expect(obs.unknownWellKeys).toContain('solverCache');
        expect(obs.unknownConfigKeys).toContain('isPlaceholder');
        expect(obs.unknownPrzejscieKeys).toContain('weirdField');
    });

    test('odporne na śmieciowe wejście (null, brak wells)', () => {
        expect(() => observeStudnieOrderDto(null)).not.toThrow();
        expect(() => observeStudnieOrderDto({})).not.toThrow();
        expect(observeStudnieOrderDto(null).wellsChecked).toBe(0);
    });
});
