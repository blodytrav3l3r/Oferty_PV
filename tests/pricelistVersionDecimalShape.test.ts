import { Prisma } from '../generated/prisma-postgres/client';
import { loadVersionItems, validateRows } from '../src/services/pricelist/validation';

describe('loadVersionItems public monetary values', () => {
    it('converts Prisma Decimal prices to JSON-safe numbers without changing nulls', async () => {
        const client = {
            pricelistItemRury: {
                findMany: jest
                    .fn()
                    .mockResolvedValue([
                        { id: 'r1', price: new Prisma.Decimal('149.90'), transport: null }
                    ])
            },
            pricelistItemStudnie: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 's1',
                        price: new Prisma.Decimal('1000000.00'),
                        cena1: new Prisma.Decimal('1.005'),
                        weight: new Prisma.Decimal('12.34'),
                        doplataPEHD: null
                    }
                ])
            },
            pricelistItemPrecoKonfig: { findMany: jest.fn() },
            pricelistItemPrecoKinety: {
                findMany: jest
                    .fn()
                    .mockResolvedValue([{ id: 'p1', cena: new Prisma.Decimal('3500.00') }])
            },
            pricelistItemPrecoZakresy: { findMany: jest.fn() }
        } as unknown as Parameters<typeof loadVersionItems>[0];

        const result = await loadVersionItems(client, 'rury', 'v1');

        expect(result.rury).toEqual([{ id: 'r1', price: 149.9, transport: null }]);
        expect(JSON.parse(JSON.stringify(result.rury?.[0]))).toEqual({
            id: 'r1',
            price: 149.9,
            transport: null
        });

        const studnie = await loadVersionItems(client, 'studnie', 'v1');
        expect(studnie.studnie).toEqual([
            {
                id: 's1',
                price: 1000000,
                cena1: 1.005,
                weight: new Prisma.Decimal('12.34'),
                doplataPEHD: null
            }
        ]);

        const preco = await loadVersionItems(client, 'preco', 'v1');
        expect(preco.kinety).toEqual([{ id: 'p1', cena: 3500 }]);
    });
});

describe('validateRows money precision', () => {
    it('rounds Rury money fields with the shared half-up rule only', () => {
        const result = validateRows('rury', [
            {
                id: 'r1',
                name: 'Rura',
                category: 'Rury',
                price: 1.005,
                transport: 2.675,
                weight: 1.005,
                area: 1.005
            }
        ]);

        expect(result).toEqual([
            {
                id: 'r1',
                name: 'Rura',
                category: 'Rury',
                price: 1.01,
                transport: 2.68,
                weight: 1.005,
                area: 1.005
            }
        ]);
    });

    it('rounds Studnie surcharges and PRECO Kinety prices at the shared validation boundary', () => {
        const studnie = validateRows('studnie', [
            {
                id: 's1',
                name: 'Studnia',
                category: 'Studnie',
                componentType: 'base',
                price: 1.005,
                transport: 2.675,
                cena1: 3.005,
                doplataPEHD: 4.675,
                weight: 5.005,
                area: 6.005
            }
        ]);
        expect(studnie).toEqual([
            {
                id: 's1',
                name: 'Studnia',
                category: 'Studnie',
                componentType: 'base',
                price: 1.01,
                transport: 2.68,
                cena1: 3.01,
                doplataPEHD: 4.68,
                weight: 5.005,
                area: 6.005
            }
        ]);

        const preco = validateRows('preco', {
            konfig: [],
            kinety: [{ id: 'k1', order: 1, dn: 1000, wellDn: 1200, height: 500, cena: 8.005 }],
            zakresy: []
        });
        expect(preco).toEqual({
            konfig: [],
            kinety: [{ id: 'k1', order: 1, dn: 1000, wellDn: 1200, height: 500, cena: 8.01 }],
            zakresy: []
        });
    });
});
