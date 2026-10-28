/**
 * L2: trasy serwerowego draftu — kontrakt HTTP i CAS.
 *
 * Kluczowe zachowania (każde musi paść, gdy reguła zniknie):
 * - brak If-Match nad istniejącym draftem → 412 (żadnego cichego nadpisania),
 * - If-Match nieaktualny → 409 z `serverVersion` (klient wie, co porównać),
 * - limit 256 KB → 413 i POPRZEDNI draft nietknięty,
 * - izolacja per-user: cudzy draft = 404, bez ujawniania istnienia,
 * - limit liczby draftów nie usuwa żadnego wiersza.
 */
import request from 'supertest';
import express from 'express';
import prisma from '../../src/prismaClient';
import draftRouter from '../../src/routes/drafts';
import { sweepExpiredDrafts } from '../../src/services/drafts/draftService';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        const id = (req.headers['x-test-user'] as string) || 'user-a';
        req.user = { id, username: id, role: 'user', subUsers: [] };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const USER = 'user-a';
const OTHER = 'user-b';

function makeApp() {
    const app = express();
    app.use(express.json({ limit: '320kb' }));
    app.use('/api/drafts', draftRouter);
    return app;
}

const app = makeApp();
const url = (kind: string, docId: string) => `/api/drafts/${kind}/${docId}`;

function payload(tag: string, size = 0) {
    return { fields: { tag, filler: size ? 'x'.repeat(size) : '' } };
}

async function cleanup() {
    await prisma.drafts.deleteMany({ where: { userId: { in: [USER, OTHER] } } });
}

beforeEach(async () => {
    await cleanup();
});

afterAll(async () => {
    await cleanup();
});

describe('L2 drafty — zapis i CAS', () => {
    test('pierwszy zapis bez If-Match → 200, wersja 1, ETag', async () => {
        const res = await request(app)
            .put(url('offer_rury', 'o1'))
            .set('x-test-user', USER)
            .send({ payload: payload('A'), baseVersion: 3 });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ version: 1, bytes: expect.any(Number) });
        expect(res.headers.etag).toBe('"1"');

        const row = await prisma.drafts.findUnique({
            where: { userId_kind_docId: { userId: USER, kind: 'offer_rury', docId: 'o1' } }
        });
        expect(row?.version).toBe(1);
        expect(row?.baseVersion).toBe(3);
    });

    test('nadpisanie bez If-Match → 428, poprzednia treść nietknięta', async () => {
        await request(app)
            .put(url('offer_rury', 'o2'))
            .set('x-test-user', USER)
            .send({ payload: payload('stary') })
            .expect(200);
        const res = await request(app)
            .put(url('offer_rury', 'o2'))
            .set('x-test-user', USER)
            .send({ payload: payload('nowy') });
        // 428 (RFC 6585) = brak warunku wstępnego; 412 byłby „warunek nie zaszedł”.
        expect(res.status).toBe(428);
        expect(res.body.code).toBe('DRAFT_PRECONDITION_REQUIRED');
        expect(res.body.serverVersion).toBe(1);

        const got = await request(app).get(url('offer_rury', 'o2')).set('x-test-user', USER);
        expect(got.body.data.payload.fields.tag).toBe('stary');
    });

    test('If-Match zgodny → 200, wersja +1', async () => {
        await request(app)
            .put(url('offer_studnie', 's1'))
            .set('x-test-user', USER)
            .send({ payload: payload('v1') })
            .expect(200);
        const res = await request(app)
            .put(url('offer_studnie', 's1'))
            .set('x-test-user', USER)
            .set('If-Match', '"1"')
            .send({ payload: payload('v2') });
        expect(res.status).toBe(200);
        expect(res.body.version).toBe(2);
        expect(res.headers.etag).toBe('"2"');
    });

    test('If-Match nieaktualny → 409 DRAFT_CONFLICT z serverVersion', async () => {
        await request(app)
            .put(url('order_rury', 'r1'))
            .set('x-test-user', USER)
            .send({ payload: payload('v1') })
            .expect(200);
        await request(app)
            .put(url('order_rury', 'r1'))
            .set('x-test-user', USER)
            .set('If-Match', '1')
            .send({ payload: payload('v2') })
            .expect(200);
        const res = await request(app)
            .put(url('order_rury', 'r1'))
            .set('x-test-user', USER)
            .set('If-Match', '1')
            .send({ payload: payload('v3') });
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'DRAFT_CONFLICT', serverVersion: 2 });
        expect(res.body.serverUpdatedAt).toEqual(expect.any(String));
    });

    test('If-Match na nieistniejący draft → 404', async () => {
        const res = await request(app)
            .put(url('offer_rury', 'brak'))
            .set('x-test-user', USER)
            .set('If-Match', '5')
            .send({ payload: payload('x') });
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('DRAFT_NOT_FOUND');
    });

    test('If-Match niepoprawny → 400 (nie ciche pominięcie)', async () => {
        const res = await request(app)
            .put(url('offer_rury', 'o3'))
            .set('x-test-user', USER)
            .set('If-Match', 'abc')
            .send({ payload: payload('x') });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_IF_MATCH');
    });

    test('payload nie-obiekt (tablica) → 400', async () => {
        const res = await request(app)
            .put(url('offer_rury', 'o4'))
            .set('x-test-user', USER)
            .send({ payload: [1, 2, 3] });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DRAFT_INVALID_PAYLOAD');
    });
});

describe('L2 drafty — limity', () => {
    test('payload > 256 KB → 413, poprzedni draft nietknięty', async () => {
        await request(app)
            .put(url('offer_rury', 'big'))
            .set('x-test-user', USER)
            .send({ payload: payload('maly') })
            .expect(200);
        const res = await request(app)
            .put(url('offer_rury', 'big'))
            .set('x-test-user', USER)
            .set('If-Match', '1')
            .send({ payload: payload('za-duzy', 257 * 1024) });
        expect(res.status).toBe(413);
        expect(res.body.code).toBe('DRAFT_TOO_LARGE');
        expect(res.body.limit).toBe(256 * 1024);
        expect(res.body.bytes).toBeGreaterThan(256 * 1024);

        const got = await request(app).get(url('offer_rury', 'big')).set('x-test-user', USER);
        expect(got.body.data.payload.fields.tag).toBe('maly');
        expect(got.body.data.version).toBe(1);
    });

    test('51. draft → 409 DRAFT_LIMIT, żaden wiersz nie znika', async () => {
        const rows = Array.from({ length: 50 }, (_, i) => ({
            userId: USER,
            kind: 'offer_rury',
            docId: `d${i}`,
            baseVersion: null,
            payload: '{}',
            bytes: 2,
            version: 1,
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString()
        }));
        await prisma.drafts.createMany({ data: rows });
        const res = await request(app)
            .put(url('offer_rury', 'nowy'))
            .set('x-test-user', USER)
            .send({ payload: payload('x') });
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'DRAFT_LIMIT', count: 50, limit: 50 });
        expect(await prisma.drafts.count({ where: { userId: USER } })).toBe(50);
    });

    test('nieprawidłowy kind / docId → 400', async () => {
        await request(app)
            .put(url('offer_rury', 'zły id!'))
            .set('x-test-user', USER)
            .send({ payload: payload('x') })
            .expect(400);
        await request(app)
            .put(url('cennik', 'o1'))
            .set('x-test-user', USER)
            .send({ payload: payload('x') })
            .expect(400);
    });
});

describe('L2 drafty — izolacja i cykl życia', () => {
    test('cudzy draft → 404 po obu stronach (brak ujawnienia istnienia)', async () => {
        await request(app)
            .put(url('offer_rury', 'wspolny-id'))
            .set('x-test-user', OTHER)
            .send({ payload: payload('cudzy') })
            .expect(200);

        const get = await request(app)
            .get(url('offer_rury', 'wspolny-id'))
            .set('x-test-user', USER);
        expect(get.status).toBe(404);

        const del = await request(app)
            .delete(url('offer_rury', 'wspolny-id'))
            .set('x-test-user', USER);
        expect(del.status).toBe(404);

        // Wiersz drugiego użytkownika nadal istnieje.
        expect(await prisma.drafts.count({ where: { userId: OTHER } })).toBe(1);
    });

    test('lista zwraca tylko własne drafty i nie zawiera payloadu', async () => {
        await request(app)
            .put(url('offer_rury', 'moj'))
            .set('x-test-user', USER)
            .send({ payload: payload('a') })
            .expect(200);
        await request(app)
            .put(url('offer_rury', 'cudzy'))
            .set('x-test-user', OTHER)
            .send({ payload: payload('b') })
            .expect(200);

        const res = await request(app).get('/api/drafts').set('x-test-user', USER);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].docId).toBe('moj');
        expect(res.body.data[0]).not.toHaveProperty('payload');
    });

    test('DELETE → 204, potem GET 404', async () => {
        await request(app)
            .put(url('offer_studnie', 'del1'))
            .set('x-test-user', USER)
            .send({ payload: payload('x') })
            .expect(200);
        await request(app)
            .delete(url('offer_studnie', 'del1'))
            .set('x-test-user', USER)
            .expect(204);
        await request(app).get(url('offer_studnie', 'del1')).set('x-test-user', USER).expect(404);
    });

    test('wygasły draft → 404 i wiersz usunięty (leniwe TTL)', async () => {
        await prisma.drafts.create({
            data: {
                userId: USER,
                kind: 'offer_rury',
                docId: 'stary',
                baseVersion: null,
                payload: '{"fields":{}}',
                bytes: 14,
                version: 1,
                updatedAt: new Date(Date.now() - 1000).toISOString(),
                expiresAt: new Date(Date.now() - 500).toISOString()
            }
        });
        await request(app).get(url('offer_rury', 'stary')).set('x-test-user', USER).expect(404);
        expect(await prisma.drafts.count({ where: { userId: USER } })).toBe(0);
    });

    test('sweepExpiredDrafts usuwa tylko wygasłe', async () => {
        const now = Date.now();
        await prisma.drafts.createMany({
            data: [
                {
                    userId: USER,
                    kind: 'offer_rury',
                    docId: 'wygasly',
                    baseVersion: null,
                    payload: '{}',
                    bytes: 2,
                    version: 1,
                    updatedAt: new Date(now - 1000).toISOString(),
                    expiresAt: new Date(now - 500).toISOString()
                },
                {
                    userId: USER,
                    kind: 'offer_rury',
                    docId: 'swiezy',
                    baseVersion: null,
                    payload: '{}',
                    bytes: 2,
                    version: 1,
                    updatedAt: new Date(now).toISOString(),
                    expiresAt: new Date(now + 86400000).toISOString()
                }
            ]
        });
        const removed = await sweepExpiredDrafts();
        expect(removed).toBeGreaterThanOrEqual(1);
        const left = await prisma.drafts.findMany({ where: { userId: USER } });
        expect(left.map((d) => d.docId)).toEqual(['swiezy']);
    });
});
