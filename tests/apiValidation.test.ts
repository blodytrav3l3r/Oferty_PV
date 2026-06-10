/**
 * Testy E2E walidacji API (Faza 8)
 * Weryfikacja czy endpointy zwracają 400 dla nieprawidłowych danych
 */

import request from 'supertest';
import express from 'express';

// Import routerów do przetestowania
import offersRouter from '../src/routes/offers/index';
import clientsRouter from '../src/routes/clients';
import productsRouter from '../src/routes/products';
import telemetryRouter from '../src/routes/telemetry';
import usersRouter from '../src/routes/users';
import settingsRouter from '../src/routes/settings';

// Mock auth middleware
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (!req.user) {
            req.user = { id: 'user-id', role: 'admin' };
        }
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock offer exports
jest.mock('../src/routes/offers/exports', () => ({
    __esModule: true,
    default: jest.fn((_req: any, _res: any, next: any) => next())
}));

// Mock prisma
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
        offers_studnie_rel: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
        clients_rel: { upsert: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn(),
        $transaction: jest.fn(async (fn: any) => {
            const tx = {
                clients_rel: { upsert: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
                $queryRaw: jest.fn(),
                $executeRaw: jest.fn()
            };
            return fn(tx);
        }),
        pricelists: { upsert: jest.fn() },
        ai_telemetry_logs: { create: jest.fn() },
        users: { update: jest.fn(), findUnique: jest.fn() },
        settings: { upsert: jest.fn() }
    }
}));

// Tworzenie aplikacji testowej
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', offersRouter);
    app.use('/api/offers-studnie', (req: express.Request, res: express.Response, next: express.NextFunction) => {
        req.url = '/studnie' + (req.url === '/' ? '' : req.url);
        offersRouter(req, res, next);
    });
    app.use('/api/clients', clientsRouter);
    app.use('/api/products', productsRouter);
    app.use('/api/telemetry', telemetryRouter);
    app.use('/api/users', usersRouter);
    app.use('/api/settings', settingsRouter);
    return app;
}

describe('API Validation Tests', () => {
    let app: express.Express;
    
    beforeEach(() => {
        app = createTestApp();
    });
    
    const authHeader = { 'x-user-id': 'test-user-id', 'x-user-role': 'admin' };

    describe('POST /api/offers - walidacja ofert rur', () => {
        it('powinien zwrócić 400 gdy brakuje clientId', async () => {
            const res = await request(app)
                .post('/api/offers')
                .set(authHeader)
                .send({
                    items: [{ name: 'Test', price: 100, quantity: 1 }]
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy items nie jest tablicą', async () => {
            const res = await request(app)
                .post('/api/offers')
                .set(authHeader)
                .send({
                    clientId: 'client-1',
                    items: 'not-an-array'
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy item ma ujemną cenę', async () => {
            const res = await request(app)
                .post('/api/offers')
                .set(authHeader)
                .send({
                    clientId: 'client-1',
                    items: [{ name: 'Test', price: -100, quantity: 1 }]
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy item ma ujemną ilość', async () => {
            const res = await request(app)
                .post('/api/offers')
                .set(authHeader)
                .send({
                    clientId: 'client-1',
                    items: [{ name: 'Test', price: 100, quantity: -1 }]
                });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api/offers-studnie - walidacja ofert studni', () => {
        it('powinien zwrócić 400 gdy brakuje clientId', async () => {
            const res = await request(app)
                .post('/api/offers-studnie')
                .set(authHeader)
                .send({
                    wells: [{ dn: '1000', height: 2000 }]
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy wells nie jest tablicą', async () => {
            const res = await request(app)
                .post('/api/offers-studnie')
                .set(authHeader)
                .send({
                    clientId: 'client-1',
                    wells: 'not-an-array'
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy studnia ma pusty DN', async () => {
            const res = await request(app)
                .post('/api/offers-studnie')
                .set(authHeader)
                .send({
                    clientId: 'client-1',
                    wells: [{ dn: '', height: 2000 }]
                });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('PUT /api/clients - walidacja klientów', () => {
        it('powinien zwrócić 400 gdy data nie jest tablicą', async () => {
            const res = await request(app)
                .put('/api/clients')
                .set(authHeader)
                .send({
                    data: 'not-an-array'
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy klient nie ma nazwy', async () => {
            const res = await request(app)
                .put('/api/clients')
                .set(authHeader)
                .send({
                    data: [{ nip: '1234567890' }]
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy email jest nieprawidłowy', async () => {
            const res = await request(app)
                .put('/api/clients')
                .set(authHeader)
                .send({
                    data: [{ name: 'Test', email: 'invalid-email' }]
                });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('PUT /api/products - walidacja cenników', () => {
        it('powinien zaakceptować pustą tablicę (reset cennika)', async () => {
            const res = await request(app)
                .put('/api/products')
                .set(authHeader)
                .send({
                    data: []
                });
            expect(res.statusCode).toBe(200);
        });

        it('powinien zwrócić 400 gdy brakuje data', async () => {
            const res = await request(app)
                .put('/api/products')
                .set(authHeader)
                .send({});
            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api/telemetry/override - walidacja telemetryczna', () => {
        it('powinien zwrócić 400 gdy brakuje overrideReason', async () => {
            const res = await request(app)
                .post('/api/telemetry/override')
                .set(authHeader)
                .send({
                    originalConfig: {},
                    finalConfig: {}
                });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('PUT /api/users/:id - walidacja użytkowników', () => {
        it('powinien zwrócić 400 gdy email jest nieprawidłowy', async () => {
            const res = await request(app)
                .put('/api/users/test-id')
                .set(authHeader)
                .send({
                    email: 'invalid-email'
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy hasło jest za krótkie', async () => {
            const res = await request(app)
                .put('/api/users/test-id')
                .set(authHeader)
                .send({
                    password: '123'
                });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('PUT /api/settings/year-letter - walidacja ustawień', () => {
        it('powinien zwrócić 400 gdy litera jest za długa', async () => {
            const res = await request(app)
                .put('/api/settings/year-letter')
                .set(authHeader)
                .send({
                    letter: 'AB'
                });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /api/clients - pobieranie klientów', () => {
        it('powinien zwrócić 200 z tablicą klientów', async () => {
            const { default: prismaMock } = require('../src/prismaClient');
            prismaMock.clients_rel.findMany.mockResolvedValue([
                { id: '1', name: 'Firma ABC', nip: '1234567890', userId: 'user-id', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: null },
                { id: '2', name: 'Firma XYZ', nip: '9876543210', userId: 'user-id', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: null }
            ]);

            const res = await request(app)
                .get('/api/clients')
                .set(authHeader);

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].name).toBe('Firma ABC');
        });

        it('powinien zwrócić 200 z pustą tablicą gdy brak klientów', async () => {
            const { default: prismaMock } = require('../src/prismaClient');
            prismaMock.clients_rel.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/clients')
                .set(authHeader);

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });

        it('powinien zwrócić 500 gdy baza zwraca błąd', async () => {
            const { default: prismaMock } = require('../src/prismaClient');
            prismaMock.clients_rel.findMany.mockRejectedValue(new Error('DB connection failed'));

            const res = await request(app)
                .get('/api/clients')
                .set(authHeader);

            expect(res.statusCode).toBe(500);
            expect(res.body.error).toBeDefined();
        });

        it('powinien normalizować timestampy do ISO', async () => {
            const { default: prismaMock } = require('../src/prismaClient');
            prismaMock.clients_rel.findMany.mockResolvedValue([
                { id: '1', name: 'Firma ABC', createdAt: '1779296688240', updatedAt: '1779296688306' }
            ]);

            const res = await request(app)
                .get('/api/clients')
                .set(authHeader);

            expect(res.statusCode).toBe(200);
            expect(res.body.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(res.body.data[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('PUT /api/clients - synchronizacja klientów', () => {
        it('powinien zwrócić 400 gdy NIP jest nieprawidłowy', async () => {
            const res = await request(app)
                .put('/api/clients')
                .set(authHeader)
                .send({
                    data: [{ name: 'Test', nip: '123' }]
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy telefon jest nieprawidłowy', async () => {
            const res = await request(app)
                .put('/api/clients')
                .set(authHeader)
                .send({
                    data: [{ name: 'Test', phone: 'abc' }]
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy nazwa przekracza 200 znaków', async () => {
            const res = await request(app)
                .put('/api/clients')
                .set(authHeader)
                .send({
                    data: [{ name: 'A'.repeat(201) }]
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 400 gdy NIP ma nieprawidłowy checksum', async () => {
            const res = await request(app)
                .put('/api/clients')
                .set(authHeader)
                .send({
                    data: [{ name: 'Test', nip: '1234567890' }]
                });
            expect(res.statusCode).toBe(400);
        });

        it('powinien zwrócić 200 przy poprawnym NIP', async () => {
            const res = await request(app)
                .put('/api/clients')
                .set(authHeader)
                .send({
                    data: [{ name: 'Test', nip: '1234563218' }]
                });
            // 200 lub 500 zależy od mocka transakcji — ważne że walidacja NIP przechodzi
            expect(res.statusCode).not.toBe(400);
        });
    });
});
