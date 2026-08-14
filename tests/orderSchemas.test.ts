import {
    ruryOrderItemSchema,
    ruryOrdersBatchSchema,
    ruryOrderUpdateSchema,
    studnieOrderItemSchema,
    studnieOrdersBatchSchema,
    studnieOrderUpdateSchema,
    productionOrderItemSchema,
    productionOrdersBatchSchema,
    productionOrderCreateSchema,
    ruryOfferExportItemSchema,
    ruryOfferExportSchema,
    studnieOfferExportItemSchema,
    studnieOfferExportSchema
} from '../src/validators/orderSchemas';

describe('ruryOrderItemSchema', () => {
    it('akceptuje minimalny element zamówienia rur', () => {
        const result = ruryOrderItemSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('akceptuje pełny element z id/offerId/status', () => {
        const result = ruryOrderItemSchema.safeParse({
            id: 'or-1',
            offerId: 'off-1',
            status: 'new'
        });
        expect(result.success).toBe(true);
    });

    it('przepuszcza dodatkowe pola (passthrough) — np. clientName', () => {
        const result = ruryOrderItemSchema.safeParse({ clientName: 'ACME', totalPrice: 250 });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.clientName).toBe('ACME');
        }
    });
});

describe('ruryOrdersBatchSchema', () => {
    it('akceptuje tablicę data', () => {
        const result = ruryOrdersBatchSchema.safeParse({ data: [{ id: 'or-1' }] });
        expect(result.success).toBe(true);
    });

    it('odrzuca brakującą tablicę data', () => {
        const result = ruryOrdersBatchSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

describe('ruryOrderUpdateSchema', () => {
    it('akceptuje status i userId', () => {
        const result = ruryOrderUpdateSchema.safeParse({ status: 'accepted', userId: 'u1' });
        expect(result.success).toBe(true);
    });

    it('odrzuca nie-liczbowy elementIndex w data', () => {
        const result = ruryOrderUpdateSchema.safeParse({ status: 'new' });
        expect(result.success).toBe(true);
    });
});

describe('studnieOrderItemSchema', () => {
    it('akceptuje element zamówienia studni', () => {
        const result = studnieOrderItemSchema.safeParse({
            id: 'os-1',
            offerStudnieId: 'so-1',
            status: 'new'
        });
        expect(result.success).toBe(true);
    });

    it('przepuszcza dodatkowe pola studni (wells)', () => {
        const result = studnieOrderItemSchema.safeParse({
            wells: [{ dn: '1000', quantity: 1 }]
        });
        expect(result.success).toBe(true);
    });
});

describe('studnieOrdersBatchSchema', () => {
    it('akceptuje tablicę data', () => {
        const result = studnieOrdersBatchSchema.safeParse({ data: [{ id: 'os-1' }] });
        expect(result.success).toBe(true);
    });

    it('odrzuca puste body', () => {
        const result = studnieOrdersBatchSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

describe('studnieOrderUpdateSchema', () => {
    it('akceptuje status i data', () => {
        const result = studnieOrderUpdateSchema.safeParse({
            status: 'accepted',
            data: { transport: 10 }
        });
        expect(result.success).toBe(true);
    });
});

describe('productionOrderItemSchema', () => {
    it('akceptuje element z wellId i elementIndex', () => {
        const result = productionOrderItemSchema.safeParse({
            wellId: 'w-1',
            elementIndex: 3,
            orderId: 'o-1'
        });
        expect(result.success).toBe(true);
    });

    it('odrzuca niecałkowity elementIndex', () => {
        const result = productionOrderItemSchema.safeParse({ wellId: 'w-1', elementIndex: 3.5 });
        expect(result.success).toBe(false);
    });

    it('akceptuje puste body (wszystko opcjonalne)', () => {
        const result = productionOrderItemSchema.safeParse({});
        expect(result.success).toBe(true);
    });
});

describe('productionOrdersBatchSchema', () => {
    it('akceptuje tablicę data', () => {
        const result = productionOrdersBatchSchema.safeParse({
            data: [{ wellId: 'w-1', elementIndex: 0 }]
        });
        expect(result.success).toBe(true);
    });

    it('odrzuca brak data', () => {
        const result = productionOrdersBatchSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

describe('productionOrderCreateSchema', () => {
    it('wymaga wellId', () => {
        const result = productionOrderCreateSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('akceptuje wellId + opcjonalne pola', () => {
        const result = productionOrderCreateSchema.safeParse({
            wellId: 'w-1',
            orderId: 'o-1',
            elementIndex: 2
        });
        expect(result.success).toBe(true);
    });

    it('odrzuca pusty wellId', () => {
        const result = productionOrderCreateSchema.safeParse({ wellId: '' });
        expect(result.success).toBe(false);
    });
});

describe('ruryOfferExportItemSchema', () => {
    it('wymaga productId i name', () => {
        const result = ruryOfferExportItemSchema.safeParse({ unitPrice: 10, quantity: 1 });
        expect(result.success).toBe(false);
    });

    it('odrzuca ujemną ilość', () => {
        const result = ruryOfferExportItemSchema.safeParse({
            productId: 'p1',
            name: 'Rura',
            unitPrice: 10,
            quantity: -1
        });
        expect(result.success).toBe(false);
    });

    it('akceptuje quantity=0 jako błąd (positive)', () => {
        const result = ruryOfferExportItemSchema.safeParse({
            productId: 'p1',
            name: 'Rura',
            quantity: 0
        });
        expect(result.success).toBe(false);
    });

    it('odrzuca nieprawidłowy pehdType', () => {
        const result = ruryOfferExportItemSchema.safeParse({
            productId: 'p1',
            name: 'Rura',
            quantity: 1,
            pehdType: 'PEHD-9MM'
        });
        expect(result.success).toBe(false);
    });

    it('akceptuje poprawny pehdType', () => {
        const result = ruryOfferExportItemSchema.safeParse({
            productId: 'p1',
            name: 'Rura',
            unitPrice: 10,
            quantity: 1,
            pehdType: 'PEHD-4MM'
        });
        expect(result.success).toBe(true);
    });
});

describe('ruryOfferExportSchema', () => {
    it('wymaga co najmniej jednej pozycji w items', () => {
        const result = ruryOfferExportSchema.safeParse({ items: [] });
        expect(result.success).toBe(false);
    });

    it('odrzuca validityDays poza zakresem 1-365', () => {
        const result = ruryOfferExportSchema.safeParse({
            items: [{ productId: 'p1', name: 'Rura', unitPrice: 10, quantity: 1 }],
            validityDays: 400
        });
        expect(result.success).toBe(false);
    });

    it('przyjmuje domyślne validityDays=30', () => {
        const result = ruryOfferExportSchema.safeParse({
            items: [{ productId: 'p1', name: 'Rura', unitPrice: 10, quantity: 1 }]
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.validityDays).toBe(30);
        }
    });
});

describe('studnieOfferExportItemSchema', () => {
    it('wymaga productName', () => {
        const result = studnieOfferExportItemSchema.safeParse({ quantity: 1 });
        expect(result.success).toBe(false);
    });

    it('odrzuca ujemną cenę', () => {
        const result = studnieOfferExportItemSchema.safeParse({
            productName: 'Studnia',
            price: -5
        });
        expect(result.success).toBe(false);
    });

    it('akceptuje minimalną studnię', () => {
        const result = studnieOfferExportItemSchema.safeParse({
            productName: 'Studnia',
            quantity: 1,
            price: 100
        });
        expect(result.success).toBe(true);
    });
});

describe('studnieOfferExportSchema', () => {
    it('wymaga co najmniej jednej studni w items', () => {
        const result = studnieOfferExportSchema.safeParse({ items: [] });
        expect(result.success).toBe(false);
    });

    it('akceptuje poprawny eksport studni', () => {
        const result = studnieOfferExportSchema.safeParse({
            items: [{ productName: 'Studnia', quantity: 2, price: 100 }],
            clientName: 'ACME'
        });
        expect(result.success).toBe(true);
    });
});
