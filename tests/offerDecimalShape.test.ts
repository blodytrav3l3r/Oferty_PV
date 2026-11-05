import { Prisma } from '../generated/prisma-postgres/client';
import { decimalMoneyRowsToNumbers } from '../src/services/pricelist/moneySerialization';
import { offerCreateSchema, offerStudnieCreateSchema } from '../src/validators/offerSchemas';
import { mapOfferRow } from '../src/utils/searchUtils';

describe('offer money Decimal API boundary', () => {
    it('serializes relational money columns as JSON numbers and preserves nulls', () => {
        const rows = decimalMoneyRowsToNumbers(
            [
                {
                    id: 'item-1',
                    price: new Prisma.Decimal('12.34'),
                    quantity: 1.5,
                    discount: 10,
                    optionalPrice: null
                }
            ],
            ['price', 'optionalPrice']
        );

        expect(rows).toEqual([
            { id: 'item-1', price: 12.34, quantity: 1.5, discount: 10, optionalPrice: null }
        ]);
        expect(JSON.parse(JSON.stringify(rows))).toEqual([
            { id: 'item-1', price: 12.34, quantity: 1.5, discount: 10, optionalPrice: null }
        ]);
    });

    it('rounds validated relational offer money while preserving quantity and discount', () => {
        const rury = offerCreateSchema.parse({
            clientId: 'client-1',
            transportCost: 2.675,
            items: [{ productId: 'product-1', quantity: 1.125, discount: 3.333, price: 4.005 }]
        });
        const studnie = offerStudnieCreateSchema.parse({
            clientId: 'client-1',
            transportCost: 2.675,
            totalPrice: 4.005,
            wells: []
        });

        expect(rury.transportCost).toBe(2.68);
        expect(rury.items[0]).toMatchObject({
            quantity: 1.125,
            discount: 3.333,
            price: 4.01
        });
        expect(studnie).toMatchObject({ transportCost: 2.68, totalPrice: 4.01 });
    });

    it('keeps search API transport cost numeric when raw SQL returns Decimal', () => {
        const mapped = mapOfferRow({
            id: 'offer-1',
            transportCost: new Prisma.Decimal('12.34'),
            _type: 'rury',
            _orderCount: 0,
            offer_number: null,
            history: '[]',
            _fu_outcome: null,
            _fu_next: null,
            _fu_last: null
        } as never);

        expect(mapped.transportCost).toBe(12.34);
        expect(JSON.parse(JSON.stringify(mapped)).transportCost).toBe(12.34);
    });
});
