/**
 * D-014 (P2-9): nieparsowalny JSON bloba oferty/zamówienia nie może dać
 * myląco-poprawnego PDF. Kontrakt best-effort (pdfGenerator.test.ts:
 * "fallback dla uszkodzonych danych JSON") zostaje — dokument jest
 * generowany, ale jawnie oznaczony stemplem DANE_USZKODZONE.
 */
import fs from 'fs';
import {
    buildRuryOfferContextFromOfferId,
    buildRuryOrderContextFromOrderId,
    buildStudnieOfferContextFromOfferId,
    buildStudnieOrderContextFromOrderId
} from '../src/services/pdf/context';
import { generateRuryHTML } from '../src/services/pdf/ruryHtml';
import { generateStudnieHTML } from '../src/services/pdf/studnieHtml';
import { generateCombinedHTML } from '../src/services/pdf/combinedHtml';
import { clearPdfTemplateCache } from '../src/services/pdf/templateCache';
import { clearLetterheadCache } from '../src/services/pdf/letterhead';
import prisma from '../src/prismaClient';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    existsSync: jest.fn(() => true)
}));

jest.mock('puppeteer', () => ({
    launch: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
            setJavaScriptEnabled: jest.fn(),
            setContent: jest.fn(),
            pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf'))
        }),
        close: jest.fn()
    })
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn() },
        offer_items_rel: { findMany: jest.fn() },
        clients_rel: { findUnique: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn() },
        orders_rury_rel: { findUnique: jest.fn() },
        orders_studnie_rel: { findUnique: jest.fn() },
        users: { findUnique: jest.fn() }
    }
}));

// Etap 2: kategoria rury z ACTIVE/seed, nie z tabeli LIVE.
jest.mock('../src/services/pricelist/catalog', () => ({
    getRuryCategoryMap: jest.fn(async () => new Map())
}));

const TEMPLATE =
    '<html><body>{{TYTUL_DOKUMENTU}}{{VALIDITY_SECTION}}{{NR_OFERTY}}' +
    '{{DATA_OFERTY}}{{DATA_WAZNOSCI}}{{DANE_KLIENTA}}{{DANE_INWESTYCJI}}' +
    '{{TABELE_DN}}{{TABELA_RUR}}{{TABELA_POZYCJI}}{{TABELA_TRANSPORTU}}' +
    '{{PODSUMOWANIE}}{{SEKCJA_UWAGI}}{{WARUNKI_STATYCZNE}}{{DANE_KONTAKTOWE}}</body></html>';

describe('D-014: corrupt blob → oznaczony dokument, valid → bez zmian', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPdfTemplateCache();
        clearLetterheadCache();
        (fs.readFileSync as jest.Mock).mockImplementation((p: string) => {
            if (String(p).includes('.png')) return Buffer.from('fake-image-base64');
            return TEMPLATE;
        });
        (prisma.clients_rel.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('rury oferta: corrupt JSON → flaga + stempel, render best-effort', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'r-1',
            offer_number: 'R/1',
            data: 'bad-json{',
            clientId: null,
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        const ctx = await buildRuryOfferContextFromOfferId('r-1');
        expect(ctx.dataCorrupted).toBe(true);
        const html = await generateRuryHTML(ctx);
        expect(html).toContain('DANE_USZKODZONE');
    });

    it('studnie oferta: corrupt JSON → flaga + stempel, render best-effort', async () => {
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 's-1',
            offer_number: 'S/1',
            data: 'bad-json{',
            clientId: null,
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        const ctx = await buildStudnieOfferContextFromOfferId('s-1');
        expect(ctx.dataCorrupted).toBe(true);
        const html = await generateStudnieHTML(ctx);
        expect(html).toContain('DANE_USZKODZONE');
    });

    it('rury zamówienie: corrupt JSON → flaga + stempel', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-r-1',
            data: 'bad-json{',
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        const ctx = await buildRuryOrderContextFromOrderId('order-r-1');
        expect(ctx.dataCorrupted).toBe(true);
        const html = await generateRuryHTML(ctx);
        expect(html).toContain('DANE_USZKODZONE');
    });

    it('rury zamówienie: PDF zachowuje osobny transport z importu', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-r-2',
            userId: 'u1',
            createdAt: new Date().toISOString(),
            data: JSON.stringify({
                transportSeparate: true,
                externalTransportCost: 100,
                transportCount: 3,
                items: []
            })
        });
        const ctx = await buildRuryOrderContextFromOrderId('order-r-2');
        expect(ctx.transportCost).toBe(100);
        expect(ctx.transportCount).toBe(3);
        expect(await generateRuryHTML(ctx)).toContain('100,00');
    });

    it('rury zamówienie: PDF używa zapisanej częściowej alokacji zamiast pełnego kursu', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-r-partial',
            userId: 'u1',
            createdAt: new Date().toISOString(),
            data: JSON.stringify({
                transportSeparate: false,
                transportKm: 100,
                transportRate: 10,
                transportCost: 0.34,
                transportAllocation: {
                    version: 1,
                    items: [
                        {
                            itemUid: 'partial-item',
                            totalCents: 34,
                            segments: [{ quantity: 1, transportCentsPerUnit: 34 }]
                        }
                    ]
                },
                items: [
                    {
                        uid: 'partial-item',
                        productId: 'RTB-0-03-25-K00',
                        name: 'Rura betonowa DN300',
                        unitPrice: 100,
                        quantity: 1,
                        weight: 500
                    }
                ]
            })
        });
        const ctx = await buildRuryOrderContextFromOrderId('order-r-partial');
        expect(ctx.transportCost).toBe(0.34);
        const html = await generateRuryHTML(ctx);
        expect(html).toContain('100,34');
        expect(html).not.toContain('1 100,00');
    });

    it('rury zamówienie: uszkodzona alokacja nie przerywa PDF i zachowuje koszt zapisany', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-r-bad-allocation',
            userId: 'u1',
            createdAt: new Date().toISOString(),
            data: JSON.stringify({
                transportSeparate: false,
                transportKm: 100,
                transportRate: 10,
                transportCost: 0.34,
                transportAllocation: {},
                items: [
                    {
                        uid: 'bad-allocation-item',
                        productId: 'RTB-0-03-25-K00',
                        name: 'Rura betonowa DN300',
                        unitPrice: 100,
                        quantity: 1,
                        weight: 500
                    }
                ]
            })
        });
        const ctx = await buildRuryOrderContextFromOrderId('order-r-bad-allocation');
        expect(ctx.transportCost).toBe(0.34);
        expect(await generateRuryHTML(ctx)).toContain('100,34');
    });

    it('studnie zamówienie: corrupt JSON → flaga + stempel', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-s-1',
            data: 'bad-json{',
            userId: 'u1',
            offerStudnieId: null,
            createdAt: new Date().toISOString()
        });
        const ctx = await buildStudnieOrderContextFromOrderId('order-s-1');
        expect(ctx.dataCorrupted).toBe(true);
        const html = await generateStudnieHTML(ctx);
        expect(html).toContain('DANE_USZKODZONE');
    });

    it('poprawny blob → brak flagi i brak stempla (render bez zmian)', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'r-2',
            offer_number: 'R/2',
            data: JSON.stringify({ clientName: 'Acme', items: [] }),
            clientId: null,
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        const ruryCtx = await buildRuryOfferContextFromOfferId('r-2');
        expect(ruryCtx.dataCorrupted).toBeUndefined();
        expect(await generateRuryHTML(ruryCtx)).not.toContain('DANE_USZKODZONE');

        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 's-2',
            offer_number: 'S/2',
            data: JSON.stringify({ clientName: 'Acme', wellsExport: [] }),
            clientId: null,
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        const studnieCtx = await buildStudnieOfferContextFromOfferId('s-2');
        expect(studnieCtx.dataCorrupted).toBeUndefined();
        expect(await generateStudnieHTML(studnieCtx)).not.toContain('DANE_USZKODZONE');
    });

    it('wydruk łączny: corrupt po jednej stronie → cały dokument oznaczony', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'r-3',
            offer_number: 'R/3',
            data: 'bad-json{',
            clientId: null,
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 's-3',
            offer_number: 'S/3',
            data: JSON.stringify({ clientName: 'Acme', wellsExport: [] }),
            clientId: null,
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        const ruryCtx = await buildRuryOfferContextFromOfferId('r-3');
        const studnieCtx = await buildStudnieOfferContextFromOfferId('s-3');
        const html = await generateCombinedHTML(studnieCtx, ruryCtx);
        expect(html).toContain('DANE_USZKODZONE');
    });

    it('rury: numer oferty i ważność są escapowane (brak HTML injection)', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'r-x',
            offer_number: '<img src=x onerror=alert(1)>',
            data: JSON.stringify({ validity: '<script>alert(1)</script>' }),
            clientId: null,
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        const ctx = await buildRuryOfferContextFromOfferId('r-x');
        const html = await generateRuryHTML(ctx);
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;img');
        expect(html).toContain('&lt;script&gt;');
    });

    it('studnie: numer oferty i ważność są escapowane (brak HTML injection)', async () => {
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 's-x',
            offer_number: '<img src=x onerror=alert(1)>',
            data: JSON.stringify({
                validity: '<script>alert(1)</script>',
                clientName: 'Acme',
                wellsExport: []
            }),
            clientId: null,
            userId: 'u1',
            createdAt: new Date().toISOString()
        });
        const ctx = await buildStudnieOfferContextFromOfferId('s-x');
        const html = await generateStudnieHTML(ctx);
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;img');
        expect(html).toContain('&lt;script&gt;');
    });
});
