import request from 'supertest';
import express from 'express';

const mockUser: any = { id: 'u2', username: 'u2', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/services/pdfGenerator', () => ({
    generateOfferRuryPDF: jest.fn().mockResolvedValue(Buffer.from('PDF-RURY')),
    generateOfferStudniePDF: jest.fn().mockResolvedValue(Buffer.from('PDF-STUDNIE'))
}));

jest.mock('../../src/services/docx', () => ({
    generateOfferRuryDOCX: jest.fn().mockResolvedValue(Buffer.from('DOCX-RURY')),
    generateOfferStudnieDOCX: jest.fn().mockResolvedValue(Buffer.from('DOCX-STUDNIE'))
}));

jest.mock('../../src/services/pdf/pdfEngine', () => ({
    mapPdfError: jest.fn().mockReturnValue(false)
}));

jest.mock('../../src/utils/exportFilenames', () => ({
    exportFilename: jest.fn().mockReturnValue('oferta.pdf')
}));

const prismaMock = {
    offers_rel: { findUnique: jest.fn() },
    offers_studnie_rel: { findUnique: jest.fn() },
    document_shares: { findFirst: jest.fn() }
};

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: prismaMock
}));

import exportsRouter from '../../src/routes/offers/exports';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers-rury', exportsRouter);
    app.use('/api/offers-studnie', exportsRouter);
    return app;
}

/**
 * P2: eksport oferty ma ten sam kontrakt odczytu co GET /:id —
 * odbiorca share (canReadWithShare) czyta i eksportuje; obcy bez
 * share dostaje 404 (bez zdradzania istnienia).
 */
describe('P2 offer export share contract', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.resetAllMocks();
        mockUser.id = 'u2';
        mockUser.role = 'user';
        mockUser.subUsers = [];
        prismaMock.offers_rel.findUnique.mockResolvedValue({
            id: 'off-r',
            userId: 'u1',
            offer_number: '1'
        });
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue({
            id: 'off-s',
            userId: 'u1',
            offer_number: '2'
        });
        prismaMock.document_shares.findFirst.mockResolvedValue(null);
        app = createApp();
    });

    it('rury export-pdf: odbiorca share → 200', async () => {
        prismaMock.document_shares.findFirst.mockResolvedValue({ id: 'share-1' });
        const res = await request(app).get('/api/offers-rury/off-r/export-pdf');
        expect(res.statusCode).toBe(200);
    });

    it('studnie export-docx: odbiorca share → 200', async () => {
        prismaMock.document_shares.findFirst.mockResolvedValue({ id: 'share-1' });
        const res = await request(app).get('/api/offers-studnie/studnie/off-s/export-docx');
        expect(res.statusCode).toBe(200);
    });

    it('obcy bez share → 404, generator nie wołany', async () => {
        const { generateOfferRuryPDF } = await import('../../src/services/pdfGenerator');
        const res = await request(app).get('/api/offers-rury/off-r/export-pdf');
        expect(res.statusCode).toBe(404);
        expect(generateOfferRuryPDF).not.toHaveBeenCalled();
    });
});
