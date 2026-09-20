import request from 'supertest';
import express from 'express';
import exportCombinedRouter from '../src/routes/exportCombined';

interface MockUser {
    id: string;
    role: 'admin' | 'pro' | 'user';
    subUsers: string[];
}

let currentUser: MockUser = { id: 'user1', role: 'user', subUsers: [] };

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
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
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
    })
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: {
            findUnique: jest.fn()
        },
        offers_studnie_rel: {
            findUnique: jest.fn()
        }
    }
}));

jest.mock('../src/services/combinedExport', () => ({
    generateCombinedOfferPDF: jest.fn().mockResolvedValue(Buffer.from('PDF-LACZNY-MOCK')),
    generateCombinedOfferDOCX: jest.fn().mockResolvedValue(Buffer.from('DOCX-LACZNY-MOCK'))
}));

import prisma from '../src/prismaClient';
import { canReadDoc } from '../src/utils/ownership';
import {
    generateCombinedOfferPDF,
    generateCombinedOfferDOCX
} from '../src/services/combinedExport';

const RURY_UUID = '123e4567-e89b-12d3-a456-426614174001';
const STUDNIE_UUID = '123e4567-e89b-12d3-a456-426614174002';
const mockRuryOffer = { id: RURY_UUID, userId: 'user1' };
const mockStudnieOffer = { id: STUDNIE_UUID, userId: 'user1' };

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/export-combined', exportCombinedRouter);
    return app;
}

describe('Export Combined (Wydruk łączny) — POST /api/export-combined', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        currentUser = { id: 'user1', role: 'user', subUsers: [] };
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(mockRuryOffer);
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockStudnieOffer);
        app = createApp();
    });

    const validBody = { offerRuryId: RURY_UUID, offerStudnieId: STUDNIE_UUID };

    describe('POST /pdf', () => {
        it('owner CAN export combined PDF (200 + application/pdf + niepusty buffer)', async () => {
            const res = await request(app).post('/api/export-combined/pdf').send(validBody);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/application\/pdf/);
            expect(res.headers['content-disposition']).toMatch(/attachment/);
            expect(res.headers['content-disposition']).toMatch(/oferta_laczna_/);
            expect(res.headers['content-disposition']).toMatch(/\.pdf/);
            expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
            expect(generateCombinedOfferPDF).toHaveBeenCalledWith(RURY_UUID, STUDNIE_UUID);
        });

        it('walidacja: brak obu ID -> 400', async () => {
            const res = await request(app).post('/api/export-combined/pdf').send({});

            expect(res.statusCode).toBe(400);
            expect(generateCombinedOfferPDF).not.toHaveBeenCalled();
        });

        it('walidacja: brak ID studni -> 400', async () => {
            const res = await request(app)
                .post('/api/export-combined/pdf')
                .send({ offerRuryId: 'offer_rury_1' });

            expect(res.statusCode).toBe(400);
            expect(generateCombinedOfferPDF).not.toHaveBeenCalled();
        });

        it('non-owner gets 404 (nie ujawnia istnienia oferty)', async () => {
            currentUser = { id: 'user2', role: 'user', subUsers: [] };

            const res = await request(app).post('/api/export-combined/pdf').send(validBody);

            expect(res.statusCode).toBe(404);
            expect(res.body).toEqual({ error: 'Not found' });
            expect(generateCombinedOfferPDF).not.toHaveBeenCalled();
        });

        it('brak oferty rur w bazie -> 404', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app).post('/api/export-combined/pdf').send(validBody);

            expect(res.statusCode).toBe(404);
            expect(generateCombinedOfferPDF).not.toHaveBeenCalled();
        });
    });

    describe('POST /docx', () => {
        it('owner CAN export combined DOCX (200 + wordprocessingml + niepusty buffer)', async () => {
            const res = await request(app).post('/api/export-combined/docx').send(validBody);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/wordprocessingml\.document/);
            expect(res.headers['content-disposition']).toMatch(/oferta_laczna_/);
            expect(res.headers['content-disposition']).toMatch(/\.docx/);
            expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
            expect(generateCombinedOfferDOCX).toHaveBeenCalledWith(RURY_UUID, STUDNIE_UUID);
        });

        it('walidacja: brak obu ID -> 400', async () => {
            const res = await request(app).post('/api/export-combined/docx').send({});

            expect(res.statusCode).toBe(400);
            expect(generateCombinedOfferDOCX).not.toHaveBeenCalled();
        });

        it('non-owner gets 404', async () => {
            currentUser = { id: 'user2', role: 'user', subUsers: [] };

            const res = await request(app).post('/api/export-combined/docx').send(validBody);

            expect(res.statusCode).toBe(404);
            expect(generateCombinedOfferDOCX).not.toHaveBeenCalled();
        });
    });

    describe('canReadDoc dla OBIU ofert', () => {
        it('sprawdza uprawnienia do obu ofert (rur i studni)', async () => {
            await request(app).post('/api/export-combined/pdf').send(validBody);

            expect(prisma.offers_rel.findUnique).toHaveBeenCalledWith({
                where: { id: RURY_UUID },
                select: { userId: true, offer_number: true }
            });
            expect(prisma.offers_studnie_rel.findUnique).toHaveBeenCalledWith({
                where: { id: STUDNIE_UUID },
                select: { userId: true, offer_number: true }
            });
            expect(canReadDoc).toHaveBeenCalled();
        });
    });

    describe('legacy ID ofert (nie-UUID) — regresja 400 z wydruku łącznego', () => {
        const LEGACY_RURY = 'offer_1789903931590';
        const LEGACY_STUDNIE = 'offer_studnie_1789827260384';

        it('POST /pdf: legacy ID przechodzą walidację (200, nie 400)', async () => {
            const res = await request(app)
                .post('/api/export-combined/pdf')
                .send({ offerRuryId: LEGACY_RURY, offerStudnieId: LEGACY_STUDNIE });

            expect(res.statusCode).toBe(200);
            expect(generateCombinedOfferPDF).toHaveBeenCalledWith(LEGACY_RURY, LEGACY_STUDNIE);
        });

        it('POST /docx: legacy ID przechodzą walidację (200, nie 400)', async () => {
            const res = await request(app)
                .post('/api/export-combined/docx')
                .send({ offerRuryId: LEGACY_RURY, offerStudnieId: LEGACY_STUDNIE });

            expect(res.statusCode).toBe(200);
            expect(generateCombinedOfferDOCX).toHaveBeenCalledWith(LEGACY_RURY, LEGACY_STUDNIE);
        });

        it('wstrzyknięte znaki (ścieżka/spacja) dalej -> 400 bez dotykania generatora', async () => {
            const res = await request(app)
                .post('/api/export-combined/pdf')
                .send({ offerRuryId: '../../etc/passwd', offerStudnieId: 'id ze spacją' });

            expect(res.statusCode).toBe(400);
            expect(generateCombinedOfferPDF).not.toHaveBeenCalled();
        });

        it('puste ID po trim dalej -> 400', async () => {
            const res = await request(app)
                .post('/api/export-combined/pdf')
                .send({ offerRuryId: '   ', offerStudnieId: STUDNIE_UUID });

            expect(res.statusCode).toBe(400);
            expect(generateCombinedOfferPDF).not.toHaveBeenCalled();
        });

        it('nagłówek filename z numerów ofert (nie z ID)', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
                ...mockRuryOffer,
                offer_number: 'OF/000001/SA/2026'
            });
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
                ...mockStudnieOffer,
                offer_number: 'OS/000001/SA/2026'
            });

            const res = await request(app).post('/api/export-combined/pdf').send(validBody);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-disposition']).toContain(
                'oferta_laczna_OF-000001-SA-2026_OS-000001-SA-2026.pdf'
            );
        });

        it('nagłówek filename fallback do ID gdy brak numerów', async () => {
            const res = await request(app).post('/api/export-combined/pdf').send(validBody);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-disposition']).toContain(
                'oferta_laczna_123e4567-e89b-12d3-a456-426614174001_123e4567-e89b-12d3-a456-426614174002.pdf'
            );
        });
    });
});
