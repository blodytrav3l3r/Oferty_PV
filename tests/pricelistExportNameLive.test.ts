/**
 * Eksport cennika z edytora (LIVE): nazwa pliku i arkusz `_Cennik` niosą numer
 * cennika, a plik zostaje re-importowalny (arkusz techniczny pomijany).
 */
import express from 'express';
import request from 'supertest';
import JSZip from 'jszip';
import ruryRouter from '../src/routes/productsV2';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin1', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    PRICELIST_WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next(),
    PRECO_PRICING_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/auditService', () => ({ logAudit: jest.fn(async () => undefined) }));

jest.mock('../src/services/pricelist/writeTarget', () => ({
    ...jest.requireActual('../src/services/pricelist/writeTarget'),
    getPricelistWriteTarget: () => 'live'
}));

const ACTIVE = {
    id: 'v-active',
    type: 'rury',
    seq: 1,
    version: 'Rv1-20260927',
    status: 'APPROVED',
    effectiveFrom: '2026-09-27T10:00:00.000Z'
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        productsRury: {
            findMany: jest.fn(async () => [
                { id: 'R1', name: 'Rura', category: 'Rury', price: 10, transport: 1 }
            ])
        },
        settings: { findUnique: jest.fn(async () => null) },
        pricelistVersion: {
            // DRAFT brak (najnowszy szkic), active: Rv1.
            findFirst: jest.fn(async ({ where }: any) =>
                where && where.status === 'DRAFT' ? null : ACTIVE
            )
        }
    }
}));

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/products', ruryRouter);
    return a;
}

const binaryParser = (res: any, cb: any) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
};

function getExport() {
    return request(app())
        .get('/api/products/export.xlsx?source=live')
        .buffer(true)
        .parse(binaryParser);
}

describe('GET /api/products/export.xlsx (LIVE): numer cennika w nazwie i w pliku', () => {
    it('nazwa pliku = numer obowiązującego cennika', async () => {
        const res = await getExport();
        expect(res.status).toBe(200);
        expect(String(res.headers['content-disposition'])).toContain(
            'Cennik_Rury_Rv1-20260927_Export.xlsx'
        );
    });

    it('plik zawiera arkusz `_Cennik` z numerem (obok arkusza danych)', async () => {
        const res = await getExport();
        const zip = await JSZip.loadAsync(res.body);
        const workbook = await zip.file('xl/workbook.xml')!.async('string');
        expect(workbook).toContain('_Cennik');
        const sheet2 = await zip.file('xl/worksheets/sheet2.xml')!.async('string');
        expect(sheet2).toContain('Numer cennika');
        expect(sheet2).toContain('Rv1-20260927');
    });
});
