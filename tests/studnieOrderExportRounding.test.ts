import prisma from '../src/prismaClient';
import { buildStudnieOrderContextFromOrderId } from '../src/services/pdf/context';
import { buildStudnieSectionHTML } from '../src/services/pdf/studnieHtml';
import { buildWellTables } from '../src/services/docx/studnie/tables';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: { findUnique: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn() },
        users: { findUnique: jest.fn() }
    }
}));

describe('suma transportu w eksporcie zamówienia studni', () => {
    const wells = Array.from({ length: 3 }, () => ({
        dn: '1000',
        price: 1,
        transportCost: 0.105 / 3,
        totalPrice: 1 + 0.105 / 3
    }));

    it.each([false, true])(
        'używa sumy własnego snapshotu, transport osobno: %s',
        async (separate) => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
                data: JSON.stringify({
                    wellsExport: wells,
                    totalNetto: 3.11,
                    transportSeparate: separate
                }),
                createdAt: new Date(0)
            });

            const ctx = await buildStudnieOrderContextFromOrderId('order-id');
            const pdf = buildStudnieSectionHTML(ctx);
            const docx = buildWellTables(ctx.items, separate);

            expect(pdf.grandTotal).toBe(3.11);
            expect(docx.grandTotal + docx.transportTotal).toBeCloseTo(3.11, 8);
        }
    );

    it.each([false, true])(
        'nie dopasowuje sumy zamówienia do pozycji z oferty: %s',
        async (separate) => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
                data: JSON.stringify({ totalNetto: 3.11, transportSeparate: separate }),
                offerStudnieId: 'offer-id',
                createdAt: new Date(0)
            });
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
                data: JSON.stringify({ wellsExport: wells })
            });

            const ctx = await buildStudnieOrderContextFromOrderId('order-id');
            expect(buildStudnieSectionHTML(ctx).grandTotal).toBe(3.1);
            const docx = buildWellTables(ctx.items, separate);
            expect(docx.grandTotal + docx.transportTotal).toBeCloseTo(3.1, 8);
        }
    );
});
