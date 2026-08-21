import { generateKartaBudowyPDF } from '../src/services/pdf/kartaBudowy';
import prisma from '../src/prismaClient';
import * as pdfEngine from '../src/services/pdf/pdfEngine';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: { findUnique: jest.fn() },
        orders_rury_rel: { findUnique: jest.fn() },
        productsStudnieDefault: { findMany: jest.fn().mockResolvedValue([]) }
    }
}));

jest.mock('../src/services/pdf/pdfEngine', () => ({
    generatePDF: jest.fn().mockResolvedValue(Buffer.from('PDFDATA'.repeat(100)))
}));

describe('kartaBudowy - Z-71', () => {
    beforeEach(() => jest.clearAllMocks());

    it('generuje PDF kartaBudowy jako Buffer', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order1',
            data: JSON.stringify({
                kartaBudowy: { uwagiOgolne: 'test' },
                wells: [],
                orderNumber: 'ZAM/001'
            })
        });
        const buf = await generateKartaBudowyPDF('order1');
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(buf.length).toBeGreaterThan(100);
        expect(pdfEngine.generatePDF).toHaveBeenCalled();
    });

    it('obsługuje duży payload', async () => {
        const largeWells = Array.from({ length: 20 }, (_, i) => ({
            dn: 1000 + i * 100,
            config: []
        }));
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order1',
            data: JSON.stringify({
                kartaBudowy: { uwagiOgolne: 'x'.repeat(1000) },
                wells: largeWells,
                orderNumber: 'ZAM/001'
            })
        });
        const buf = await generateKartaBudowyPDF('order1');
        expect(buf.length).toBeGreaterThan(100);
    });

    it('rzuca gdy zamówienie nie istnieje', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(generateKartaBudowyPDF('missing')).rejects.toThrow();
    });
});
