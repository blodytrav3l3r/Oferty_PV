import request from 'supertest';
import express from 'express';
import vm from 'vm';
import fs from 'fs';
import path from 'path';
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
    canWriteDoc: jest.fn().mockReturnValue(true),
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
    generateStudniePDFFromContext: jest.fn().mockResolvedValue(Buffer.from('PDF-MOCK')),
    lookupOfferUsers: jest.fn().mockResolvedValue({
        authorUser: null,
        guardianUser: null
    })
}));

jest.mock('../src/services/docx', () => ({
    generateStudnieDOCXFromContext: jest.fn().mockResolvedValue(Buffer.from('DOCX-MOCK')),
    generateKartaBudowyDOCX: jest.fn().mockResolvedValue(Buffer.from('KARTA-DOCX-MOCK'))
}));

import prisma from '../src/prismaClient';
import { generateStudniePDFFromContext, lookupOfferUsers } from '../src/services/pdfGenerator';
import { generateKartaBudowyPDF } from '../src/services/pdf/pdfStudnieBuilder';
import { generateStudnieDOCXFromContext, generateKartaBudowyDOCX } from '../src/services/docx';

const mockOrder = {
    id: 'ord-1',
    userId: 'user1',
    offerId: 'off-1',
    orderNumber: 'ZAM-001',
    data: JSON.stringify({ items: [], clientName: 'ACME' }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

const otherUserOrder = {
    ...mockOrder,
    id: 'ord-other',
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

describe('Studnie Order As Offer export — POST /:id/export-offer-pdf|docx', () => {
    let app: express.Application;

    const validPayload = {
        items: [
            {
                productId: 'STUD-1000',
                productName: 'Studnia betonowa DN1000 H2000',
                quantity: 2,
                discount: 5,
                price: 1500,
                DN: '1000',
                height: 2000,
                zwienczenie: 'Płyta najazdowa',
                transportCost: 200,
                dodatkowe_info: 'Króćce boczne'
            }
        ],
        clientName: 'ACME Sp. z o.o.',
        clientNip: '1234567890',
        clientAddress: 'ul. Testowa 1, Warszawa',
        clientContact: '+48 600 000 000',
        investName: 'Inwestor X',
        investAddress: 'ul. Inwestorska 2, Kraków',
        notes: 'Notatka testowa',
        paymentTerms: 'przelew 30 dni',
        validity: '14 dni',
        validityDays: 14,
        date: '2026-06-06',
        transportKm: 50,
        transportRate: 5,
        orderNumber: 'ZAM-001',
        offerNumber: 'OFR-001'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        currentUser = { id: 'user1', role: 'user', subUsers: [] };
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockReset();
        app = createApp();
    });

    describe('POST /:id/export-offer-pdf', () => {
        it('owner CAN export own order as PDF (200 + application/pdf)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);
            (generateStudniePDFFromContext as jest.Mock).mockResolvedValue(Buffer.from('PDF-X'));

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-pdf')
                .send(validPayload);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/application\/pdf/);
            expect(res.headers['content-disposition']).toMatch(
                /oferta_studnie_zamowienie_ZAM-001\.pdf/
            );
            expect(generateStudniePDFFromContext).toHaveBeenCalledTimes(1);
            const ctx = (generateStudniePDFFromContext as jest.Mock).mock.calls[0][0];
            expect(ctx.offerNumber).toBe('ZAM-001');
            expect(ctx.clientName).toBe('ACME Sp. z o.o.');
            expect(ctx.items).toHaveLength(1);
            expect(ctx.items[0].productName).toBe('Studnia betonowa DN1000 H2000');
        });

        it('admin CAN export any order as PDF (200)', async () => {
            currentUser = { id: 'admin1', role: 'admin', subUsers: [] };
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(otherUserOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-other/export-offer-pdf')
                .send(validPayload);

            expect(res.statusCode).toBe(200);
            expect(generateStudniePDFFromContext).toHaveBeenCalled();
        });

        it('pro CAN export sub-user order as PDF (200)', async () => {
            currentUser = { id: 'pro1', role: 'pro', subUsers: ['sub-user'] };
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
                ...otherUserOrder,
                userId: 'sub-user'
            });

            const res = await request(app)
                .post('/api/orders-studnie/ord-sub/export-offer-pdf')
                .send(validPayload);

            expect(res.statusCode).toBe(200);
        });

        it('regular user CANNOT export another user order (404)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(otherUserOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-other/export-offer-pdf')
                .send(validPayload);

            expect(res.statusCode).toBe(404);
            expect(generateStudniePDFFromContext).not.toHaveBeenCalled();
        });

        it('returns 404 for nonexistent order', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/orders-studnie/nonexistent/export-offer-pdf')
                .send(validPayload);

            expect(res.statusCode).toBe(404);
        });

        it('rejects empty items array (400)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-pdf')
                .send({ ...validPayload, items: [] });

            expect(res.statusCode).toBe(400);
            expect(res.body.details).toBeDefined();
            expect(generateStudniePDFFromContext).not.toHaveBeenCalled();
        });

        it('rejects negative transportKm (400)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-pdf')
                .send({ ...validPayload, transportKm: -10 });

            expect(res.statusCode).toBe(400);
        });

        it('rejects invalid productName (empty) (400)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-pdf')
                .send({
                    ...validPayload,
                    items: [{ ...validPayload.items[0], productName: '' }]
                });

            expect(res.statusCode).toBe(400);
        });

        it('uses orderNumber from payload as offerNumber fallback', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-pdf')
                .send({ ...validPayload, orderNumber: 'ZAM-CUSTOM', offerNumber: '' });

            expect(res.statusCode).toBe(200);
            const ctx = (generateStudniePDFFromContext as jest.Mock).mock.calls[0][0];
            expect(ctx.offerNumber).toBe('ZAM-CUSTOM');
        });

        it('falls back to first 8 chars of order id when no orderNumber given', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app)
                .post('/api/orders-studnie/abcdef1234567890/export-offer-pdf')
                .send({ ...validPayload, orderNumber: '', offerNumber: '' });

            expect(res.statusCode).toBe(200);
            const ctx = (generateStudniePDFFromContext as jest.Mock).mock.calls[0][0];
            expect(ctx.offerNumber).toBe('abcdef12');
        });

        it('transportCost is computed as km * rate (250 = 50 * 5)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-pdf')
                .send(validPayload);

            expect(res.statusCode).toBe(200);
            const ctx = (generateStudniePDFFromContext as jest.Mock).mock.calls[0][0];
            expect(ctx.transportCost).toBe(250);
        });

        it('lookupOfferUsers failures are caught (200 still returned)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);
            (lookupOfferUsers as jest.Mock).mockRejectedValue(new Error('users down'));

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-pdf')
                .send(validPayload);

            expect(res.statusCode).toBe(200);
        });
    });

    describe('POST /:id/export-offer-docx', () => {
        it('owner CAN export own order as DOCX (200 + docx content-type)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);
            (generateStudnieDOCXFromContext as jest.Mock).mockResolvedValue(Buffer.from('DOCX-X'));

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-docx')
                .send(validPayload);

            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(
                /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/
            );
            expect(res.headers['content-disposition']).toMatch(
                /oferta_studnie_zamowienie_ZAM-001\.docx/
            );
            expect(generateStudnieDOCXFromContext).toHaveBeenCalledTimes(1);
            const ctx = (generateStudnieDOCXFromContext as jest.Mock).mock.calls[0][0];
            expect(ctx.offerNumber).toBe('ZAM-001');
            expect(ctx.wells).toHaveLength(1);
            expect(ctx.offerData.clientName).toBe('ACME Sp. z o.o.');
        });

        it('regular user CANNOT export another user order DOCX (404)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(otherUserOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-other/export-offer-docx')
                .send(validPayload);

            expect(res.statusCode).toBe(404);
            expect(generateStudnieDOCXFromContext).not.toHaveBeenCalled();
        });

        it('rejects empty items array (400)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-docx')
                .send({ ...validPayload, items: [] });

            expect(res.statusCode).toBe(400);
        });

        it('does NOT mutate prisma on validation error', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            await request(app)
                .post('/api/orders-studnie/ord-1/export-offer-docx')
                .send({ ...validPayload, items: [] });

            expect(prisma.orders_studnie_rel.update).not.toHaveBeenCalled();
            expect(prisma.orders_studnie_rel.upsert).not.toHaveBeenCalled();
        });

        it('does NOT call generateStudnieDOCXFromContext on auth/validation failure', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(otherUserOrder);

            await request(app)
                .post('/api/orders-studnie/ord-other/export-offer-docx')
                .send(validPayload);

            expect(generateStudnieDOCXFromContext).not.toHaveBeenCalled();
        });
    });

    describe('Regression — existing endpoints still work', () => {
        it('GET /:id/export-karta-pdf still works (karta budowy)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);
            (generateKartaBudowyPDF as jest.Mock).mockResolvedValue(Buffer.from('KARTA'));

            const res = await request(app).get('/api/orders-studnie/ord-1/export-karta-pdf');
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/application\/pdf/);
        });

        it('GET /:id/export-karta-docx still works (karta budowy)', async () => {
            (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);
            (generateKartaBudowyDOCX as jest.Mock).mockResolvedValue(Buffer.from('KARTA-DOCX'));

            const res = await request(app).get('/api/orders-studnie/ord-1/export-karta-docx');
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/wordprocessingml\.document/);
        });
    });
});

/* ============================================================
   VM behavioral tests — frontend exportStudnieOrderAsOffer_action
   ============================================================ */
describe('Studnie Order As Offer — frontend exportStudnieOrderAsOffer_action (vm)', () => {
    const PROJECT_ROOT = path.resolve(__dirname, '..');
    const FILE_PATH = path.join(PROJECT_ROOT, 'public', 'js', 'studnie', 'offerPrintManager.js');

    function loadStudniePrintManager(): { context: any; source: string } {
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        const mockFetch = jest.fn();
        const sandbox: Record<string, unknown> = {
            URL: {
                createObjectURL: jest.fn(() => 'blob:mock-url'),
                revokeObjectURL: jest.fn()
            },
            window: {} as any,
            document: {
                getElementById: jest.fn((id: string) => {
                    if (id === 'client-name') return { value: 'ACME Sp. z o.o.' };
                    if (id === 'client-nip') return { value: '1234567890' };
                    if (id === 'client-address') return { value: 'ul. Testowa 1' };
                    if (id === 'client-contact') return { value: '+48 600 000 000' };
                    if (id === 'invest-name') return { value: 'Inwestor X' };
                    if (id === 'invest-address') return { value: 'ul. Inwestorska 2' };
                    if (id === 'offer-notes') return { value: 'Notatka' };
                    if (id === 'offer-payment-terms') return { value: 'przelew 30 dni' };
                    if (id === 'offer-validity') return { value: '14 dni' };
                    if (id === 'offer-date') return { value: '2026-06-06' };
                    if (id === 'transport-km') return { value: '50' };
                    if (id === 'transport-rate') return { value: '5' };
                    if (id === 'offer-number') return { value: 'OFR-001' };
                    return null;
                }),
                createElement: jest.fn((tag: string) => {
                    if (tag === 'a') {
                        return { href: '', download: '', click: jest.fn() };
                    }
                    return {};
                }),
                body: { appendChild: jest.fn(), removeChild: jest.fn() }
            },
            fetch: mockFetch,
            showToast: jest.fn(),
            logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
            lucide: { createIcons: jest.fn() },
            // studnieProducts — potrzebne dla getWellZwienczenieName (real fn w pliku)
            studnieProducts: [
                { id: 'P1', componentType: 'plyta_najazdowa', name: 'Płyta najazdowa' },
                { id: 'P2', componentType: 'konus', name: 'Konus' },
                { id: 'P3', componentType: 'plyta_din', name: 'Płyta DIN' },
                { id: 'STUD-1', componentType: 'plyta_najazdowa', name: 'Płyta DIN DN1000' }
            ],
            calcWellStats: (well: any) => ({
                price: well._mockPrice ?? 1500,
                weight: well._mockWeight ?? 5000,
                height: well._mockHeight ?? 2000
            }),
            getCurrentOfferOrder: () => null,
            console,
            setTimeout: setTimeout,
            setImmediate: setImmediate
        };
        (sandbox.window as any) = sandbox;
        const context = vm.createContext(sandbox);
        return { context, source };
    }

    it('action is exported on window', () => {
        const { context } = loadStudniePrintManager();
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });
        expect(typeof context.exportStudnieOrderAsOffer_action).toBe('function');
    });

    it('rejects empty orderId (toast error)', async () => {
        const { context } = loadStudniePrintManager();
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });
        await context.exportStudnieOrderAsOffer_action('', 'pdf');
        expect(context.showToast).toHaveBeenCalledWith('Brak ID zamówienia do eksportu', 'error');
    });

    it('rejects invalid format (toast error)', async () => {
        const { context } = loadStudniePrintManager();
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });
        await context.exportStudnieOrderAsOffer_action('ord-1', 'txt' as any);
        expect(context.showToast).toHaveBeenCalledWith('Nieobsługiwany format eksportu', 'error');
    });

    it('warns when wells is empty (toast warning)', async () => {
        const { context } = loadStudniePrintManager();
        context.wells = [];
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });
        await context.exportStudnieOrderAsOffer_action('ord-1', 'pdf');
        expect(context.showToast).toHaveBeenCalledWith(
            'Brak pozycji w bieżącym zamówieniu',
            'warning'
        );
    });

    it('sends POST to /api/orders-studnie/:id/export-offer-pdf with valid payload', async () => {
        const { context } = loadStudniePrintManager();
        context.wells = [
            {
                id: 'well-1',
                name: 'Studnia betonowa DN1000',
                dn: '1000',
                config: [{ productId: 'P1', quantity: 1 }],
                _mockPrice: 1500,
                _mockHeight: 2000
            }
        ];
        (context.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            blob: async () => Buffer.from('PDF-X')
        });
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });

        await context.exportStudnieOrderAsOffer_action('ord-1', 'pdf');

        expect(context.fetch).toHaveBeenCalledWith(
            '/api/orders-studnie/ord-1/export-offer-pdf',
            expect.objectContaining({ method: 'POST' })
        );
        const call = (context.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(call[1].body);
        expect(body.clientName).toBe('ACME Sp. z o.o.');
        expect(body.transportKm).toBe(50);
        expect(body.transportRate).toBe(5);
        // Mapped from raw well to schema-items shape
        expect(body.items[0].productName).toBe('Studnia betonowa DN1000');
        expect(body.items[0].price).toBe(1500);
        expect(body.items[0].DN).toBe('1000');
        expect(body.items[0].height).toBe(2000);
        expect(body.items[0].quantity).toBe(1);
        expect(body.items[0].zwienczenie).toBe('Płyta najazdowa');
    });

    it('uses /export-offer-docx endpoint for docx format', async () => {
        const { context } = loadStudniePrintManager();
        context.wells = [
            {
                id: 'well-1',
                name: 'Test',
                dn: '1000',
                config: [{ productId: 'STUD-1', quantity: 1 }],
                _mockPrice: 100,
                _mockHeight: 1500
            }
        ];
        (context.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            blob: async () => Buffer.from('DOCX-X')
        });
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });

        await context.exportStudnieOrderAsOffer_action('ord-1', 'docx');

        expect(context.fetch).toHaveBeenCalledWith(
            '/api/orders-studnie/ord-1/export-offer-docx',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('shows error toast on non-ok response with details', async () => {
        const { context } = loadStudniePrintManager();
        context.wells = [
            {
                id: 'well-1',
                name: 'Test',
                dn: '1000',
                config: [{ productId: 'STUD-1', quantity: 1 }],
                _mockPrice: 100
            }
        ];
        (context.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({
                error: 'Nieprawidłowe dane',
                details: ['items: Wymagana co najmniej jedna studnia']
            })
        });
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });

        await context.exportStudnieOrderAsOffer_action('ord-1', 'pdf');

        expect(context.showToast).toHaveBeenCalledWith(
            expect.stringContaining('Nieprawidłowe dane'),
            'error'
        );
    });

    it('does not throw on 404 with empty details', async () => {
        const { context } = loadStudniePrintManager();
        context.wells = [
            {
                id: 'well-1',
                name: 'Test',
                dn: '1000',
                config: [{ productId: 'STUD-1', quantity: 1 }],
                _mockPrice: 100
            }
        ];
        (context.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ error: 'Zamówienie studni nie znalezione' })
        });
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });

        await expect(
            context.exportStudnieOrderAsOffer_action('ord-1', 'pdf')
        ).resolves.toBeUndefined();
        expect(context.showToast).toHaveBeenCalledWith(
            expect.stringContaining('Zamówienie studni nie znalezione'),
            'error'
        );
    });

    it('maps multiple raw wells to schema-compliant items (regression for the original bug)', async () => {
        const { context } = loadStudniePrintManager();
        context.wells = [
            {
                id: 'w1',
                name: 'Studnia A',
                dn: '1000',
                config: [{ productId: 'P1', quantity: 1 }],
                _mockPrice: 1500,
                _mockHeight: 2000
            },
            {
                id: 'w2',
                name: 'Studnia B',
                dn: '1200',
                config: [{ productId: 'P2', quantity: 1 }],
                _mockPrice: 2200,
                _mockHeight: 2500
            },
            {
                id: 'w3',
                name: 'Studnia C',
                dn: '1500',
                config: [{ productId: 'P3', quantity: 1 }],
                _mockPrice: 3000,
                _mockHeight: 3000
            }
        ];
        (context.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            blob: async () => Buffer.from('PDF-X')
        });
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });

        await context.exportStudnieOrderAsOffer_action('ord-1', 'pdf');

        const call = (context.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(call[1].body);
        expect(body.items).toHaveLength(3);

        // Each item must have all required schema fields (the original bug)
        body.items.forEach((item: any) => {
            expect(typeof item.productName).toBe('string');
            expect(item.productName.length).toBeGreaterThan(0);
            expect(typeof item.quantity).toBe('number');
            expect(typeof item.price).toBe('number');
        });

        expect(body.items[0]).toMatchObject({
            productName: 'Studnia A',
            quantity: 1,
            price: 1500,
            DN: '1000',
            height: 2000,
            zwienczenie: 'Płyta najazdowa'
        });
        expect(body.items[1]).toMatchObject({
            productName: 'Studnia B',
            DN: '1200',
            price: 2200
        });
        expect(body.items[2]).toMatchObject({
            productName: 'Studnia C',
            DN: '1500',
            price: 3000
        });
    });

    it('falls back to "Studnia DN{dn}" when well.name missing', async () => {
        const { context } = loadStudniePrintManager();
        context.wells = [
            {
                id: 'w-anon',
                dn: '1000',
                config: [{ productId: 'NONEXISTENT', quantity: 1 }],
                _mockPrice: 1500
            }
        ];
        (context.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            blob: async () => Buffer.from('PDF-X')
        });
        const source = fs.readFileSync(FILE_PATH, 'utf8');
        vm.runInContext(source, context, { filename: 'offerPrintManager.js' });

        await context.exportStudnieOrderAsOffer_action('ord-1', 'pdf');

        const call = (context.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(call[1].body);
        expect(body.items[0].productName).toBe('Studnia DN1000');
    });
});
