import * as pdfGen from '../src/services/pdfGenerator';
import fs from 'fs';
import puppeteer from 'puppeteer';
import prisma from '../src/prismaClient';

// Mock fs
jest.mock('fs', () => ({
    readFileSync: jest.fn()
}));

// Mock path to avoid actual path resolution issues in tests
jest.mock('path', () => ({
    join: (...args: string[]) => args.join('/')
}));

// Mock puppeteer
jest.mock('puppeteer', () => ({
    launch: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
            setContent: jest.fn(),
            pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf'))
        }),
        close: jest.fn()
    })
}));

import { buildContactSectionHTML } from '../src/services/pdf/offerUsers';

// Mock logger
jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        error: jest.fn()
    }
}));

// Mock prisma
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn() },
        offer_items_rel: { findMany: jest.fn() },
        clients_rel: { findUnique: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn() },
        orders_studnie_rel: { findUnique: jest.fn() },
        users: { findUnique: jest.fn() }
    }
}));

describe('pdfGenerator Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default fs mock returns some basic HTML template
        (fs.readFileSync as jest.Mock).mockImplementation((path: string) => {
            if (path.includes('.png')) {
                return Buffer.from('fake-image-base64');
            }
            return '<html><body>{{NR_OFERTY}} {{TABELE_DN}} {{PODSUMOWANIE}}</body></html>';
        });
    });

    describe('generateOfferRuryPDF', () => {
        it('powinien zgłosić błąd jeśli oferta nie istnieje', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);

            await expect(pdfGen.generateOfferRuryPDF('bad-id')).rejects.toThrow(
                'Oferta nie znaleziona'
            );
        });

        it('powinien wygenerować PDF dla rur', async () => {
            const mockOffer = {
                id: 'o-1',
                offer_number: 'R/1',
                clientId: 'c-1',
                transportCost: 150
            };
            const mockClient = { id: 'c-1', name: 'Test Client', nip: '123' };
            const mockItems = [{ id: 'i-1', productId: 'p-1', quantity: 2, price: 100 }];

            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(mockOffer);
            (prisma.clients_rel.findUnique as jest.Mock).mockResolvedValue(mockClient);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue(mockItems);

            const result = await pdfGen.generateOfferRuryPDF('o-1');
            expect(result).toBeInstanceOf(Buffer);
            expect(result.toString()).toBe('mock-pdf');
            expect(puppeteer.launch).toHaveBeenCalled();
        });
    });

    describe('generateOfferStudniePDF', () => {
        it('powinien zgłosić błąd dla braku oferty', async () => {
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(pdfGen.generateOfferStudniePDF('bad-id')).rejects.toThrow(
                'Oferta studni nie znaleziona'
            );
        });

        it('powinien wygenerować PDF dla studni przetwarzając wellsExport', async () => {
            const mockOfferStudnie = {
                id: 's-1',
                offer_number: 'S/1',
                data: JSON.stringify({
                    transportKm: 100,
                    transportRate: 5,
                    totalWeight: 30000, // triggers math ceil 30000/24000 = 2 * 100 * 5 = 1000 transport cost
                    wellsExport: [
                        {
                            name: 'Studnia 1',
                            dn: '1000',
                            totalPrice: 2000,
                            height: 1500,
                            zwienczenie: 'Wlaz'
                        }
                    ]
                })
            };

            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOfferStudnie);

            const result = await pdfGen.generateOfferStudniePDF('s-1');
            expect(result).toBeInstanceOf(Buffer);
            expect(result.toString()).toBe('mock-pdf');
        });

        it('powinien użyć fallback dla uszkodzonych danych JSON', async () => {
            const mockOfferStudnie = {
                id: 's-1',
                data: 'bad-json{' // Invalid JSON
            };
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOfferStudnie);
            const result = await pdfGen.generateOfferStudniePDF('s-1');
            expect(result).toBeInstanceOf(Buffer); // Still generates a blank-ish pdf
        });
    });

    describe('lookupOfferUsers', () => {
        it('wyszukuje danych autora i opiekuna', async () => {
            const offerData = { createdByUserId: 'u-auth', userId: 'u-guard' };

            (prisma.users.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
                if (where.id === 'u-guard')
                    return Promise.resolve({ username: 'guard', email: 'g@g.com' });
                if (where.id === 'u-auth')
                    return Promise.resolve({ firstName: 'A', lastName: 'Auth', email: 'a@a.com' });
                return Promise.resolve(null);
            });

            const result = await pdfGen.lookupOfferUsers(offerData, null);
            expect(result.guardianUser?.name).toBe('guard'); // Fallbacks to username
            expect(result.authorUser?.name).toBe('A Auth');
        });

        it('obsługuje brak bazy / loguje błędy poprawnie bez rzucania', async () => {
            const offerData = { createdByUserId: 'u-auth', userId: 'u-guard' };
            (prisma.users.findUnique as jest.Mock).mockRejectedValue(new Error('Db error user'));
            const result = await pdfGen.lookupOfferUsers(offerData, null);
            expect(result.guardianUser).toBeNull();
            expect(result.authorUser).toBeNull();
        });
    });

    describe('buildContactSectionHTML', () => {
        it('zwraca html bez autorów', () => {
            const html = buildContactSectionHTML(null, null);
            expect(html).toContain('W razie pytań prosimy o kontakt z opiekunem oferty.');
        });

        it('zwraca testowych autorów z numerem', () => {
            const auth = { name: 'Aut', email: 'a@a.com', phone: '123' };
            const html = buildContactSectionHTML(auth, null);
            expect(html).toContain('Aut');
            expect(html).toContain('123');
        });
    });

    describe('buildStudnieOrderContextFromOrderId (Zamowienie PDF items)', () => {
        it('uses wellsExport from order.data when present (items populated)', async () => {
            const orderWithExport = {
                id: 'order-1',
                userId: 'user1',
                offerStudnieId: '',
                data: JSON.stringify({
                    wellsExport: [
                        {
                            name: 'Studnia DN1000',
                            dn: '1000',
                            height: 2000,
                            weight: 1500,
                            zwienczenie: 'Płyta',
                            price: 5000,
                            transportCost: 500,
                            totalPrice: 5500,
                            config: [],
                            przejscia: []
                        }
                    ]
                }),
                createdAt: new Date().toISOString(),
                status: 'confirmed'
            };
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(orderWithExport);

            const ctx = await pdfGen.buildStudnieOrderContextFromOrderId('order-1');

            expect(ctx.items).toHaveLength(1);
            expect(ctx.items[0].productName).toBe('Studnia DN1000');
            expect(ctx.items[0].price).toBe(5500);
            expect(ctx.items[0].DN).toBe('1000');
            expect(ctx.items[0].height).toBe(2000);
            expect(ctx.items[0].zwienczenie).toBe('Płyta');
            expect((ctx.items[0] as Record<string, unknown>).transportCost).toBe(500);
        });

        it('returns empty items when order.data has no wellsExport and no offerStudnieId column (regression)', async () => {
            const orderEmpty = {
                id: 'order-2',
                userId: 'user1',
                offerStudnieId: '',
                data: JSON.stringify({ wells: [] }),
                createdAt: new Date().toISOString(),
                status: 'confirmed'
            };
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(orderEmpty);

            const ctx = await pdfGen.buildStudnieOrderContextFromOrderId('order-2');

            expect(ctx.items).toEqual([]);
        });

        it('renders all wells when wellsExport is updated (e.g. new well added in order edit mode)', async () => {
            const orderWithUpdatedExport = {
                id: 'order-3',
                userId: 'user1',
                offerStudnieId: '',
                data: JSON.stringify({
                    wellsExport: [
                        {
                            name: 'Studnia DN1000 #1',
                            dn: '1000',
                            height: 2000,
                            weight: 1500,
                            zwienczenie: 'Płyta',
                            price: 5000,
                            transportCost: 250,
                            totalPrice: 5250,
                            config: [],
                            przejscia: []
                        },
                        {
                            name: 'Studnia DN1500 #2 (nowa)',
                            dn: '1500',
                            height: 2200,
                            weight: 2000,
                            zwienczenie: 'Właz',
                            price: 7000,
                            transportCost: 350,
                            totalPrice: 7350,
                            config: [],
                            przejscia: []
                        }
                    ]
                }),
                createdAt: new Date().toISOString(),
                status: 'confirmed'
            };
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(
                orderWithUpdatedExport
            );

            const ctx = await pdfGen.buildStudnieOrderContextFromOrderId('order-3');

            expect(ctx.items).toHaveLength(2);
            const dns = ctx.items.map((i) => i.DN).sort();
            expect(dns).toEqual(['1000', '1500']);
            const newWell = ctx.items.find((i) => i.DN === '1500');
            expect(newWell?.productName).toBe('Studnia DN1500 #2 (nowa)');
            expect(newWell?.price).toBe(7350);
        });
    });
});
