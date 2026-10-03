/**
 * D-010 (P2-4): wiring route — OfferAccessDeniedError z buildera (re-check
 * po revoke/delete między check a fetch) mapowany na 404 (anti-oracle),
 * a user przekazywany do generatora (re-check ma na czym pracować).
 */
import request from 'supertest';
import express from 'express';
import exportCombinedRouter from '../src/routes/exportCombined';
import { OfferAccessDeniedError } from '../src/services/pdf/context';

let currentUser: any = { id: 'user1', username: 'user1', role: 'user', subUsers: [] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...currentUser };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/utils/ownership', () => ({
    canWriteDoc: jest.fn().mockReturnValue(true),
    canReadDoc: jest.fn().mockImplementation((user: any, ownerId: string | null) => {
        if (user?.role === 'admin') return true;
        if (user?.id === ownerId) return true;
        if (user?.role === 'pro' && Array.isArray(user?.subUsers) && ownerId) {
            return user.subUsers.includes(ownerId);
        }
        return false;
    }),
    // A-02: route woła canReadWithShare (share-aware, jak single eksporty).
    canReadWithShare: jest.fn().mockImplementation(() => true)
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn() }
    }
}));

jest.mock('../src/services/combinedExport', () => ({
    generateCombinedOfferPDF: jest.fn(),
    generateCombinedOfferDOCX: jest.fn()
}));

import prisma from '../src/prismaClient';
import {
    generateCombinedOfferPDF,
    generateCombinedOfferDOCX
} from '../src/services/combinedExport';

const RURY_ID = 'rury-1';
const STUDNIE_ID = 'studnie-1';
const validBody = { offerRuryId: RURY_ID, offerStudnieId: STUDNIE_ID };

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/export-combined', exportCombinedRouter);
    return app;
}

describe('D-010 combined export TOCTOU — wiring route', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        currentUser = { id: 'user1', username: 'user1', role: 'user', subUsers: [] };
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            id: RURY_ID,
            userId: 'user1',
            offer_number: 'OF/1'
        });
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: STUDNIE_ID,
            userId: 'user1',
            offer_number: 'OS/1'
        });
        (generateCombinedOfferPDF as jest.Mock).mockResolvedValue(Buffer.from('PDF-MOCK'));
        (generateCombinedOfferDOCX as jest.Mock).mockResolvedValue(Buffer.from('DOCX-MOCK'));
        app = createApp();
    });

    it('(1) authorized: user przekazywany do generatora (re-check ma na czym pracować)', async () => {
        const res = await request(app).post('/api/export-combined/pdf').send(validBody);
        expect(res.statusCode).toBe(200);
        expect(generateCombinedOfferPDF).toHaveBeenCalledWith(
            RURY_ID,
            STUDNIE_ID,
            expect.objectContaining({ id: 'user1' })
        );
    });

    it('(3) pdf: revoke między check a fetch (builder odmawia) → 404, brak PDF', async () => {
        // check w route przechodzi (wiersze właściciela), generator symuluje
        // builder, który na świeżym wierszu wykrył revoke/delete.
        (generateCombinedOfferPDF as jest.Mock).mockRejectedValueOnce(new OfferAccessDeniedError());
        const res = await request(app).post('/api/export-combined/pdf').send(validBody);
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Not found' });
        expect(res.headers['content-type']).not.toMatch(/application\/pdf/);
    });

    it('(3) docx: revoke między check a fetch (builder odmawia) → 404, brak DOCX', async () => {
        (generateCombinedOfferDOCX as jest.Mock).mockRejectedValueOnce(
            new OfferAccessDeniedError()
        );
        const res = await request(app).post('/api/export-combined/docx').send(validBody);
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Not found' });
        expect(res.headers['content-type']).not.toMatch(/wordprocessingml/);
    });
});
