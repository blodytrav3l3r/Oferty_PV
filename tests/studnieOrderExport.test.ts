import request from 'supertest';
import express from 'express';
import studnieOrdersRouter from '../src/routes/orders/studnieOrders';

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

jest.mock('../src/db', () => ({
    logAudit: jest.fn()
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
    canWriteDoc: jest.fn().mockImplementation((user: any, ownerId: string | null) => {
        if (user?.role === 'admin') return true;
        if (user?.id === ownerId) return true;
        if (user?.role === 'pro' && Array.isArray(user?.subUsers) && ownerId) {
            return user.subUsers.includes(ownerId);
        }
        return false;
    }),
    canReadDoc: jest.fn().mockReturnValue(true)
}));

jest.mock('../src/utils/roleFilter', () => ({
    buildRoleWhereSql: jest.fn().mockReturnValue('')
}));

jest.mock('../src/services/pdf/pdfStudnieBuilder', () => ({
    generateKartaBudowyPDF: jest.fn().mockResolvedValue(Buffer.from('KARTA-PDF-MOCK'))
}));

jest.mock('../src/services/pdfGenerator', () => ({
    generateStudniePDFFromContext: jest.fn().mockResolvedValue(Buffer.from('PDF-MOCK')),
    generateStudnieOrderPDF: jest.fn().mockResolvedValue(Buffer.from('ORDER-PDF-MOCK')),
    lookupOfferUsers: jest.fn().mockResolvedValue({
        authorUser: null,
        guardianUser: null
    })
}));

jest.mock('../src/services/docx', () => ({
    generateKartaBudowyDOCX: jest.fn().mockResolvedValue(Buffer.from('KARTA-DOCX-MOCK')),
    generateStudnieDOCXFromContext: jest.fn().mockResolvedValue(Buffer.from('DOCX-MOCK')),
    generateStudnieOrderDOCX: jest.fn().mockResolvedValue(Buffer.from('ORDER-DOCX-MOCK'))
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        },
        users: {
            findUnique: jest.fn()
        }
    }
}));

jest.mock('../src/services/pdf/pdfStudnieBuilder', () => ({
    generateKartaBudowyPDF: jest.fn().mockResolvedValue(Buffer.from('KARTA-PDF-MOCK'))
}));

jest.mock('../src/services/pdfGenerator', () => ({
    generateStudnieOrderPDF: jest.fn().mockResolvedValue(Buffer.from('ZAM-PDF-MOCK')),
    generateStudniePDFFromContext: jest.fn().mockResolvedValue(Buffer.from('PDF-MOCK')),
    lookupOfferUsers: jest.fn().mockResolvedValue({
        authorUser: null,
        guardianUser: null
    })
}));

jest.mock('../src/services/docx', () => ({
    generateStudnieOrderDOCX: jest.fn().mockResolvedValue(Buffer.from('ZAM-DOCX-MOCK')),
    generateKartaBudowyDOCX: jest.fn().mockResolvedValue(Buffer.from('KARTA-DOCX-MOCK')),
    generateStudnieDOCXFromContext: jest.fn().mockResolvedValue(Buffer.from('DOCX-MOCK'))
}));

import prisma from '../src/prismaClient';
import { generateStudnieOrderPDF } from '../src/services/pdfGenerator';
import { generateKartaBudowyPDF } from '../src/services/pdf/pdfStudnieBuilder';
import { generateStudnieOrderDOCX, generateKartaBudowyDOCX } from '../src/services/docx';

const mockOrder = {
    id: '1700000000000_abcde',
    userId: 'user1',
    offerId: 'off-1',
    orderNumber: 'ZAM-001',
    data: JSON.stringify({ items: [], clientName: 'ACME' }),
    createdAt: new Date().toISOString(),
    status: 'new'
};

const otherUserOrder = {
    ...mockOrder,
    id: '1700000000000_other',
    userId: 'other-user',
    offerId: 'off-other',
    orderNumber: 'ZAM-OTHER'
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-studnie', studnieOrdersRouter);
    return app;
}

describe('Studnie Order Export (Zamowienie) — GET /:id/export-pdf|docx', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        currentUser = { id: 'user1', role: 'user', subUsers: [] };
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockReset();
        app = createApp();
    });

    describe('GET /:id/export-pdf', () => {
        it('owner CAN export own order as Zamowienie PDF (200 + application/pdf + zamowienie_ filename)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app).get(
                '/api/orders-studnie/1700000000000_abcde/export-pdf'
            );

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/application\/pdf/);
            expect(res.headers['content-disposition']).toMatch(/attachment/);
            expect(res.headers['content-disposition']).toMatch(/zamowienie_studnie_/);
            expect(res.headers['content-disposition']).toMatch(/\.pdf/);
            expect(generateStudnieOrderPDF).toHaveBeenCalledWith('1700000000000_abcde');
        });

        it('admin CAN export any order as PDF (200)', async () => {
            currentUser = { id: 'admin1', role: 'admin', subUsers: [] };
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(otherUserOrder);

            const res = await request(app).get(
                '/api/orders-studnie/1700000000000_other/export-pdf'
            );

            expect(res.statusCode).toBe(200);
            expect(generateStudnieOrderPDF).toHaveBeenCalled();
        });

        it('pro CAN export sub-user order as PDF (200)', async () => {
            currentUser = { id: 'pro1', role: 'pro', subUsers: ['sub-user'] };
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
                ...otherUserOrder,
                id: '1700000000000_sub',
                userId: 'sub-user'
            });

            const res = await request(app).get('/api/orders-studnie/1700000000000_sub/export-pdf');

            expect(res.statusCode).toBe(200);
            expect(generateStudnieOrderPDF).toHaveBeenCalled();
        });

        it('non-owner gets 404 (does NOT leak existence)', async () => {
            currentUser = { id: 'user1', role: 'user', subUsers: [] };
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(otherUserOrder);

            const res = await request(app).get(
                '/api/orders-studnie/1700000000000_other/export-pdf'
            );

            expect(res.statusCode).toBe(404);
            expect(res.body).toEqual({ error: 'Zamówienie studni nie znalezione' });
            expect(generateStudnieOrderPDF).not.toHaveBeenCalled();
        });

        it('non-existent order returns 404', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/orders-studnie/nonexistent/export-pdf');

            expect(res.statusCode).toBe(404);
            expect(generateStudnieOrderPDF).not.toHaveBeenCalled();
        });
    });

    describe('GET /:id/export-docx', () => {
        it('owner CAN export own order as DOCX (200 + .docx)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app).get(
                '/api/orders-studnie/1700000000000_abcde/export-docx'
            );

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/wordprocessingml\.document/);
            expect(res.headers['content-disposition']).toMatch(/zamowienie_studnie_/);
            expect(res.headers['content-disposition']).toMatch(/\.docx/);
            expect(generateStudnieOrderDOCX).toHaveBeenCalledWith('1700000000000_abcde');
        });

        it('non-owner gets 404', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(otherUserOrder);

            const res = await request(app).get(
                '/api/orders-studnie/1700000000000_other/export-docx'
            );

            expect(res.statusCode).toBe(404);
            expect(generateStudnieOrderDOCX).not.toHaveBeenCalled();
        });

        it('non-existent order returns 404', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/orders-studnie/nonexistent/export-docx');

            expect(res.statusCode).toBe(404);
            expect(generateStudnieOrderDOCX).not.toHaveBeenCalled();
        });
    });

    describe('Regressja — stare endpointy karta działają (mirror)', () => {
        it('GET /:id/export-karta-pdf nadal działa (200)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app).get(
                '/api/orders-studnie/1700000000000_abcde/export-karta-pdf'
            );

            expect(res.statusCode).toBe(200);
            expect(generateKartaBudowyPDF).toHaveBeenCalledWith('1700000000000_abcde');
        });

        it('GET /:id/export-karta-docx nadal działa (200)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app).get(
                '/api/orders-studnie/1700000000000_abcde/export-karta-docx'
            );

            expect(res.statusCode).toBe(200);
            expect(generateKartaBudowyDOCX).toHaveBeenCalledWith('1700000000000_abcde');
        });
    });
});
