/**
 * A-01/A-02: DOCX DANE_USZKODZONE + share-aware combined export.
 * - corrupt blob JSON → DOCX (single rury/studnie + combined) ze stemplem,
 *   valid → bez stempla;
 * - stranger z share → combined 200 (route + buildery), bez share → 404,
 *   brak wycieku danych w 404.
 */
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import { Packer } from 'docx';
import JSZip from 'jszip';

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() }
}));

jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        // default '' — pusty config dla cosmiconfig (puppeteer) przy imporcie;
        // per-test nadpisywane w beforeEach (png/TEMPLATE).
        readFileSync: jest.fn(() => ''),
        existsSync: jest.fn(() => true)
    };
});

const sharesDb: Array<{ sharedWithUserId: string; documentType: string; documentId: string }> = [];

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn() },
        offer_items_rel: { findMany: jest.fn(async () => []) },
        clients_rel: { findUnique: jest.fn(async () => null) },
        users: { findUnique: jest.fn(async () => null) },
        productsRury: { findMany: jest.fn(async () => []) },
        document_shares: {
            findFirst: jest.fn(async ({ where }: any) =>
                sharesDb.find(
                    (s) =>
                        s.sharedWithUserId === where.sharedWithUserId &&
                        s.documentType === where.documentType &&
                        s.documentId === where.documentId
                )
            )
        }
    }
}));

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...(global as any).__cu };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/services/combinedExport', () => ({
    generateCombinedOfferPDF: jest.fn(async () => Buffer.from('PDF-MOCK')),
    generateCombinedOfferDOCX: jest.fn(async () => Buffer.from('DOCX-MOCK'))
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const exportCombinedRouter = require('../src/routes/exportCombined').default;
import prisma from '../src/prismaClient';
import { buildCombinedDocument } from '../src/services/docx/combined';
import { buildRuryOfferDocument } from '../src/services/docx/rury';
import { buildStudnieOfferDocument } from '../src/services/docx/studnie';
import { buildRuryOfferContextFromOfferId } from '../src/services/pdf/context';
import { OfferAccessDeniedError } from '../src/services/pdf/context';

const OWNER = { id: 'owner1', username: 'owner1', role: 'user', subUsers: [] };
const STRANGER = { id: 'user9', username: 'user9', role: 'user', subUsers: [] };

const ruryOffer = (data: string) => ({
    id: 'r1',
    offer_number: 'R/1',
    userId: 'owner1',
    clientId: null,
    createdAt: '2026-01-01',
    data
});
const studnieOffer = (data: string) => ({
    id: 's1',
    offer_number: 'S/1',
    userId: 'owner1',
    clientId: null,
    createdAt: '2026-01-01',
    data
});
const VALID_WELLS = JSON.stringify({
    wellsExport: [{ name: 'S DN1000', dn: '1000', height: 1500, price: 2000, totalPrice: 2000 }]
});

async function docxXml(doc: unknown): Promise<string> {
    const buf = await Packer.toBuffer(doc as Parameters<typeof Packer.toBuffer>[0]);
    const zip = await JSZip.loadAsync(buf);
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('brak word/document.xml w DOCX');
    return file.async('string');
}

function buildApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use('/api/export-combined', exportCombinedRouter);
    return app;
}

describe('A-01 DOCX DANE_USZKODZONE', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sharesDb.length = 0;
        (fs.readFileSync as jest.Mock).mockImplementation((p: string) =>
            String(p).includes('.png') ? Buffer.from('fake-image') : 'TEMPLATE'
        );
    });

    test('corrupt rury blob → combined DOCX ze stemplem', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(ruryOffer('{broken'));
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(
            studnieOffer(VALID_WELLS)
        );
        const xml = await docxXml(await buildCombinedDocument('r1', 's1'));
        expect(xml).toContain('DANE_USZKODZONE');
    });

    test('corrupt studnie blob → combined DOCX ze stemplem', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(
            ruryOffer(JSON.stringify({ items: [] }))
        );
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(
            studnieOffer('{broken')
        );
        const xml = await docxXml(await buildCombinedDocument('r1', 's1'));
        expect(xml).toContain('DANE_USZKODZONE');
    });

    test('valid bloby → combined DOCX bez stempla', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(
            ruryOffer(JSON.stringify({ items: [] }))
        );
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(
            studnieOffer(VALID_WELLS)
        );
        const xml = await docxXml(await buildCombinedDocument('r1', 's1'));
        expect(xml).not.toContain('DANE_USZKODZONE');
    });

    test('single DOCX rury/studnie: corrupt → stempel, valid → brak', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(ruryOffer('{broken'));
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(
            studnieOffer('{broken')
        );
        expect(await docxXml(await buildRuryOfferDocument('r1'))).toContain('DANE_USZKODZONE');
        expect(await docxXml(await buildStudnieOfferDocument('s1'))).toContain('DANE_USZKODZONE');

        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(
            ruryOffer(JSON.stringify({ items: [] }))
        );
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(
            studnieOffer(VALID_WELLS)
        );
        expect(await docxXml(await buildRuryOfferDocument('r1'))).not.toContain('DANE_USZKODZONE');
    });
});

describe('A-02 share-aware combined export', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sharesDb.length = 0;
        (fs.readFileSync as jest.Mock).mockImplementation((p: string) =>
            String(p).includes('.png') ? Buffer.from('fake-image') : 'TEMPLATE'
        );
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(
            ruryOffer(JSON.stringify({ items: [] }))
        );
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(
            studnieOffer(VALID_WELLS)
        );
    });

    test('buildery: stranger z share → brak throw; bez share → OfferAccessDeniedError', async () => {
        sharesDb.push(
            { sharedWithUserId: 'user9', documentType: 'offer', documentId: 'r1' },
            { sharedWithUserId: 'user9', documentType: 'offer_studnie', documentId: 's1' }
        );
        await expect(
            buildRuryOfferContextFromOfferId('r1', STRANGER as any)
        ).resolves.toBeDefined();

        sharesDb.length = 0;
        await expect(
            buildRuryOfferContextFromOfferId('r1', STRANGER as any)
        ).rejects.toBeInstanceOf(OfferAccessDeniedError);
    });

    test('route: stranger z share → 200; bez share → 404 bez danych', async () => {
        const app = buildApp();
        (global as any).__cu = STRANGER;

        sharesDb.push(
            { sharedWithUserId: 'user9', documentType: 'offer', documentId: 'r1' },
            { sharedWithUserId: 'user9', documentType: 'offer_studnie', documentId: 's1' }
        );
        const ok = await request(app)
            .post('/api/export-combined/pdf')
            .send({ offerRuryId: 'r1', offerStudnieId: 's1' });
        expect(ok.status).toBe(200);

        sharesDb.length = 0;
        const deny = await request(app)
            .post('/api/export-combined/pdf')
            .send({ offerRuryId: 'r1', offerStudnieId: 's1' });
        expect(deny.status).toBe(404);
        expect(JSON.stringify(deny.body)).not.toContain('owner1');
    });

    test('route: owner bez share → 200 (regresja właściciela)', async () => {
        const app = buildApp();
        (global as any).__cu = OWNER;
        const res = await request(app)
            .post('/api/export-combined/pdf')
            .send({ offerRuryId: 'r1', offerStudnieId: 's1' });
        expect(res.status).toBe(200);
    });
});
