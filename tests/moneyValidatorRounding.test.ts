import { offerCreateSchema, offerStudnieCreateSchema } from '../src/validators/offerSchemas';
import {
    ruryOfferExportSchema,
    studnieOfferExportSchema,
    ruryOrdersBatchSchema,
    studnieOrdersBatchSchema,
    ruryOrderUpdateSchema
} from '../src/validators/orderSchemas';

test('kwoty studni są zaokrąglane bez zmiany wymiarów i rabatów', () => {
    const result = offerStudnieCreateSchema.parse({
        clientId: 'client',
        wells: [
            {
                price: 10.075,
                totalPrice: 11.075,
                height: 123.456,
                discount: 1.234,
                components: [{ price: 12.075, overwrittenCost: 13.075, height: 45.678 }]
            }
        ]
    });

    expect(result.wells[0]).toMatchObject({
        price: 10.08,
        totalPrice: 11.08,
        height: 123.456,
        discount: 1.234,
        components: [{ price: 12.08, overwrittenCost: 13.08, height: 45.678 }]
    });
});

test('eksport historyczny zachowuje oryginalną precyzję', () => {
    const rury = ruryOfferExportSchema.parse({
        items: [
            {
                productId: 'p',
                name: 'Rura',
                unitPrice: 10.075,
                quantity: 1.234,
                pehdCostPerUnit: 11.075
            }
        ],
        transportKm: 12.345,
        transportRate: 13.075
    });
    const studnie = studnieOfferExportSchema.parse({
        items: [
            {
                productName: 'Studnia',
                price: 10.075,
                transportCost: 11.075,
                quantity: 1.234,
                height: 12.345
            }
        ],
        transportKm: 12.345,
        transportRate: 13.075
    });

    expect(rury.items[0]).toMatchObject({
        unitPrice: 10.075,
        quantity: 1.234,
        pehdCostPerUnit: 11.075
    });
    expect(studnie.items[0]).toMatchObject({
        price: 10.075,
        transportCost: 11.075,
        quantity: 1.234,
        height: 12.345
    });
    expect([
        rury.transportKm,
        rury.transportRate,
        studnie.transportKm,
        studnie.transportRate
    ]).toEqual([12.345, 13.075, 12.345, 13.075]);
});

test('nowe oferty i zamówienia zaokrąglają tylko wskazane pola bieżących danych', () => {
    const history = [{ price: 10.075, items: [{ unitPrice: 10.075 }] }];
    const offer = offerCreateSchema.parse({
        clientId: 'x',
        items: [{ productId: 'p', quantity: 1, unitPrice: 10.075 }]
    });
    const rury = ruryOrdersBatchSchema.parse({
        data: [
            {
                transportCost: 10.075,
                items: [{ price: 11.075, unitPrice: 12.075, quantity: 1.234 }],
                history
            }
        ]
    });
    const studnie = studnieOrdersBatchSchema.parse({
        data: [
            {
                wells: [
                    {
                        frozenTransportCost: 10.075,
                        config: [{ frozenPrice: 11.075, frozenPriceBase: 12.075 }],
                        przejscia: [{ frozenPrice: 13.075 }],
                        height: 1.234
                    }
                ],
                history
            }
        ]
    });
    const patch = ruryOrderUpdateSchema.parse({
        data: { transportCost: 10.075, items: [{ unitPrice: 11.075 }], history }
    });
    const offerStudnie = offerStudnieCreateSchema.parse({
        clientId: 'x',
        wells: [
            {
                config: [{ frozenPrice: 10.075, frozenPriceBase: 11.075 }],
                przejscia: [{ frozenPrice: 12.075 }]
            }
        ]
    });
    expect(offer.items[0].unitPrice).toBe(10.08);
    expect(rury.data[0]).toMatchObject({
        transportCost: 10.08,
        items: [{ price: 11.08, unitPrice: 12.08, quantity: 1.234 }],
        history
    });
    expect(studnie.data[0]).toMatchObject({
        wells: [
            {
                frozenTransportCost: 10.075,
                config: [{ frozenPrice: 11.075, frozenPriceBase: 12.075 }],
                przejscia: [{ frozenPrice: 13.075 }],
                height: 1.234
            }
        ],
        history
    });
    expect(patch.data).toEqual({ transportCost: 10.08, items: [{ unitPrice: 11.08 }], history });
    expect(offerStudnie.wells[0]).toMatchObject({
        config: [{ frozenPrice: 10.075, frozenPriceBase: 11.075 }],
        przejscia: [{ frozenPrice: 12.075 }]
    });
});
