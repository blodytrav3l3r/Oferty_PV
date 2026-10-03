/**
 * A2: Idempotency-Key HTTP na realnej izolowanej DB (worker sqlite).
 * - claim ×2 tym samym kluczem + body → IDENTYCZNE numery (replay, licznik +3 raz);
 * - ten sam klucz + inny body → 409 IDEMPOTENCY_KEY_REUSE;
 * - PUT bulk ×2 tym samym payloadem (stabilne client-id) → 3 wiersze, zero dubli
 *   (upsert po id w all-or-nothing Tx — retry bezpieczny bez klucza).
 */
import request from 'supertest';
import express from 'express';
import numberingRouter from '../../src/routes/orders/numbering';
import productionRouter from '../../src/routes/orders/production';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'admin-1', role: 'admin', username: 'admin', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/orders-studnie', numberingRouter);
    a.use('/api/orders-studnie/production', productionRouter);
    return a;
}

beforeAll(async () => {
    await prisma.users.upsert({
        where: { id: 'admin-1' },
        update: { symbol: 'TT', productionOrderStartNumber: 1 },
        create: {
            id: 'admin-1',
            username: 'idem-admin',
            password: 'x',
            role: 'admin',
            symbol: 'TT',
            productionOrderStartNumber: 1
        }
    });
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('A2 claim/PUT idempotency (HTTP, real DB)', () => {
    test('claim retry tym samym kluczem → te same numery, licznik +3 raz', async () => {
        const a = app();
        const r1 = await request(a)
            .post('/api/orders-studnie/claim-production-numbers/admin-1')
            .set('Idempotency-Key', 'bulk-a2-t1')
            .send({ count: 3 });
        expect(r1.status).toBe(200);
        expect(r1.body.seqs).toHaveLength(3);

        const r2 = await request(a)
            .post('/api/orders-studnie/claim-production-numbers/admin-1')
            .set('Idempotency-Key', 'bulk-a2-t1')
            .send({ count: 3 });
        expect(r2.status).toBe(200);
        expect(r2.body).toEqual(r1.body);

        // Licznik ruszył raz: kolejny zakres zaczyna się po pierwszym.
        const r3 = await request(a)
            .post('/api/orders-studnie/claim-production-numbers/admin-1')
            .set('Idempotency-Key', 'bulk-a2-t2')
            .send({ count: 3 });
        expect(r3.status).toBe(200);
        const maxFirst = Math.max(...r1.body.seqs);
        for (const s of r3.body.seqs) expect(s).toBeGreaterThan(maxFirst);
        expect(new Set([...r1.body.seqs, ...r3.body.seqs]).size).toBe(6);
    });

    test('ten sam klucz + inny payload → 409 REUSE (brak nowego zakresu)', async () => {
        const a = app();
        const r1 = await request(a)
            .post('/api/orders-studnie/claim-production-numbers/admin-1')
            .set('Idempotency-Key', 'bulk-a2-reuse')
            .send({ count: 2 });
        expect(r1.status).toBe(200);
        const r2 = await request(a)
            .post('/api/orders-studnie/claim-production-numbers/admin-1')
            .set('Idempotency-Key', 'bulk-a2-reuse')
            .send({ count: 5 });
        expect(r2.status).toBe(409);
        expect(r2.body.code).toBe('IDEMPOTENCY_KEY_REUSE');
    });

    test('PUT bulk ×2 tym samym payloadem → 3 wiersze, zero dubli', async () => {
        const a = app();
        // Numery unikalne per run (worker-DB współdzielona między runami pliku).
        const stamp = String(Date.now() % 100000).padStart(5, '0');
        const items = [1, 2, 3].map((i) => ({
            id: `idem-put-${Date.now()}-${i}`,
            userId: 'admin-1',
            wellId: 'w1',
            elementIndex: i,
            productionOrderNumber: `TT/?/${stamp}${i}/26`
        }));
        const r1 = await request(a).put('/api/orders-studnie/production').send({ data: items });
        expect(r1.status).toBe(200);
        expect(r1.body.saved).toHaveLength(3);
        const r2 = await request(a).put('/api/orders-studnie/production').send({ data: items });
        expect(r2.status).toBe(200);
        expect(r2.body.saved).toHaveLength(3);
        const rows = await prisma.production_orders_rel.findMany({
            where: { id: { in: items.map((x) => x.id) } }
        });
        expect(rows).toHaveLength(3);
    });

    test('D-008 single retry tym samym kluczem → ten sam numer, licznik +1 raz', async () => {
        const a = app();
        const r1 = await request(a)
            .post('/api/orders-studnie/claim-production-number/admin-1')
            .set('Idempotency-Key', 'single-d008-r1')
            .send({});
        expect(r1.status).toBe(200);
        expect(r1.body.number).toBeTruthy();

        const r2 = await request(a)
            .post('/api/orders-studnie/claim-production-number/admin-1')
            .set('Idempotency-Key', 'single-d008-r1')
            .send({});
        expect(r2.status).toBe(200);
        expect(r2.body).toEqual(r1.body);

        // Licznik ruszył raz: świeży klucz daje wyższy seq.
        const r3 = await request(a)
            .post('/api/orders-studnie/claim-production-number/admin-1')
            .set('Idempotency-Key', 'single-d008-r2')
            .send({});
        expect(r3.status).toBe(200);
        expect(r3.body.nextSeq).toBeGreaterThan(r1.body.nextSeq);
    });

    test('D-008 single ten sam klucz + inny payload → 409 REUSE (kontrakt serwera)', async () => {
        const a = app();
        const r1 = await request(a)
            .post('/api/orders-studnie/claim-production-number/admin-1')
            .set('Idempotency-Key', 'single-d008-reuse')
            .send({});
        expect(r1.status).toBe(200);
        const r2 = await request(a)
            .post('/api/orders-studnie/claim-production-number/admin-1')
            .set('Idempotency-Key', 'single-d008-reuse')
            .send({ other: 'payload' });
        expect(r2.status).toBe(409);
        expect(r2.body.code).toBe('IDEMPOTENCY_KEY_REUSE');
    });
});
