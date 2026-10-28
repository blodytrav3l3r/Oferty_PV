/**
 * GET /api/pricelist-versions/:id/export — plik eksportu wersji niesie jej numer
 * (arkusz techniczny `_Cennik`), obok arkuszy danych.
 */
import express from 'express';
import request from 'supertest';
import JSZip from 'jszip';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin1', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    READ_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next(),
    PRICELIST_WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/pricelistVersionService', () => {
    const actual = jest.requireActual('../src/services/pricelistVersionService');
    return {
        ...actual,
        getVersionExportSheets: jest.fn(async () => ({
            version: { id: 'v1', type: 'rury', version: 'Rv1-20260927' },
            sheets: {
                Rury: [{ Indeks: 'R1', 'Nazwa produktu': 'Rura', 'Cena PLN (netto)': 10 }]
            },
            precoIncluded: false
        }))
    };
});

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: { pricelistVersion: { findUnique: jest.fn(async () => null) } }
}));

jest.mock('../src/services/pricelist/checks', () => ({
    getVersionChecks: jest.fn(async () => []),
    isChecksStale: jest.fn(() => false)
}));

import pricelistVersionsRouter from '../src/routes/pricelistVersions';

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/pricelist-versions', pricelistVersionsRouter);
    return a;
}

const binaryParser = (res: any, cb: any) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
};

function getExport() {
    return request(app()).get('/api/pricelist-versions/v1/export').buffer(true).parse(binaryParser);
}

describe('GET /api/pricelist-versions/:id/export', () => {
    it('nazwa pliku = numer cennika', async () => {
        const res = await getExport();
        expect(res.status).toBe(200);
        expect(String(res.headers['content-disposition'])).toContain(
            'Cennik_Rury_Rv1-20260927_Export.xlsx'
        );
    });

    it('plik ma arkusz `_Cennik` z numerem wersji', async () => {
        const res = await getExport();
        const zip = await JSZip.loadAsync(res.body);
        const workbook = await zip.file('xl/workbook.xml')!.async('string');
        expect(workbook).toContain('_Cennik');
        const meta = await zip.file('xl/worksheets/sheet2.xml')!.async('string');
        expect(meta).toContain('Numer cennika');
        expect(meta).toContain('Rv1-20260927');
    });
});
