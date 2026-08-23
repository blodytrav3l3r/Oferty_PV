import {
    generateKartaBudowyPDF,
    generateKartaBudowyRuryPDF
} from '../src/services/pdf/kartaBudowy';
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

    // ─── Faza D (plan 2026-08-23): pokrycie przejśćDetails, tabeli rzeczywistej i rur ───

    it('renderuje tabelę Szczegóły przejść z przejsciaDetails', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order2',
            data: JSON.stringify({
                kartaBudowy: {
                    uwagiOgolne: 'x',
                    przejsciaDetails: [
                        { rodzaj: 'Tuliejowe', dnOd: '160', dnDo: '200', uwagi: 'test A' },
                        { rodzaj: 'Szczelne', dnOd: '300', dnDo: '400', czyPrzejscie: 'TAK' }
                    ]
                },
                wells: [],
                orderNumber: 'ZAM/002'
            })
        });
        await generateKartaBudowyPDF('order2');

        const htmlArg = (pdfEngine.generatePDF as jest.Mock).mock.calls[0][0] as string;
        expect(htmlArg).toContain('Szczegóły przejść');
        expect(htmlArg).toContain('Tuliejowe');
        expect(htmlArg).toContain('Szczelne');
        expect(htmlArg).toContain('TAK');
    });

    it('liczy Rzeczywistą ilość przejść (dennica/krag_ot) z konfiguracji studni', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order3',
            data: JSON.stringify({
                kartaBudowy: {},
                orderNumber: 'ZAM/003',
                wells: [
                    {
                        dn: 1000,
                        rzednaDna: '0',
                        rzednaWlazu: '3',
                        config: [
                            { productId: 'DEN-1000', quantity: 1 },
                            { productId: 'KRG-1000-05', quantity: 4 },
                            { productId: 'KRG-1000-05_OT', quantity: 1 }
                        ],
                        przejscia: [{ productId: 'PRZ-0160', rzednaWlaczenia: '1.5' }]
                    }
                ]
            })
        });
        (prisma.productsStudnieDefault.findMany as jest.Mock).mockResolvedValue([
            {
                id: 'DEN-1000',
                componentType: 'dennica',
                category: 'Dennice',
                dn: 1000,
                height: 500
            },
            { id: 'KRG-1000-05', componentType: 'krag', category: 'Kręgi', dn: 1000, height: 500 },
            {
                id: 'KRG-1000-05_OT',
                componentType: 'krag_ot',
                category: 'Kręgi wiercone',
                dn: 1000,
                height: 500
            },
            {
                id: 'PRZ-0160',
                componentType: 'przejscie',
                category: 'Przejścia',
                dn: '160/200',
                height: 100
            }
        ]);
        await generateKartaBudowyPDF('order3');

        const htmlArg = (pdfEngine.generatePDF as jest.Mock).mock.calls[0][0] as string;
        expect(htmlArg).toContain('Rzeczywista ilość przejść w zamówieniu');
        expect(htmlArg).toContain('Kręgi wiercone');
        expect(htmlArg).toContain('Razem');
    });

    it('generuje KartaBudowyRury z tabelą elementów zamówienia', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'rury1',
            data: JSON.stringify({
                kartaBudowy: { uwagiOgolne: 'rury' },
                orderNumber: 'ZR/010',
                items: [
                    {
                        name: 'Rura DN300 2500',
                        productId: 'RTB-0-03-25-K00',
                        quantity: 5,
                        orderedQuantity: 3
                    },
                    {
                        name: 'Rura DN300 auto',
                        productId: 'RTB-0-03-10-K00',
                        quantity: 2,
                        autoAdded: true
                    }
                ]
            })
        });
        const buf = await generateKartaBudowyRuryPDF('rury1');

        expect(Buffer.isBuffer(buf)).toBe(true);
        const htmlArg = (pdfEngine.generatePDF as jest.Mock).mock.calls[0][0] as string;
        expect(htmlArg).toContain('Ilość elementów w zamówieniu');
        expect(htmlArg).toContain('Rura DN300 2500');
        expect(htmlArg).toContain('auto');
        expect(htmlArg).toContain('>3<'); // orderedQuantity
    });
});
