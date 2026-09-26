import request from 'supertest';
import express from 'express';
import locksRouter from '../src/routes/locks';
import prisma from '../src/prismaClient';
import { assertDocLockForWrite } from '../src/utils/docLocks';
import { canReadWithShare } from '../src/utils/ownership';

let currentUser: any = { id: 'user-a', username: 'adam', role: 'user', subUsers: [] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        const testId = req.headers['x-test-user'] as string | undefined;
        req.user = testId
            ? {
                  id: testId,
                  username: testId,
                  role: testId === 'admin-1' ? 'admin' : 'user',
                  subUsers: []
              }
            : { ...currentUser };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (req.user?.role === 'admin') next();
        else res.status(403).json({ error: 'Forbidden' });
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    // READ_LIMITER prawdziwy — test 429 ponizej sprawdza rzeczywista blokade.
    READ_LIMITER: jest.requireActual('../src/middleware/rateLimiters').READ_LIMITER
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// P1.5: guard read-access — domyslnie prawda (stare testy bez zmian),
// pojedyncze testy nadpisuja przez mockResolvedValueOnce(false).
jest.mock('../src/utils/ownership', () => ({
    __esModule: true,
    canReadWithShare: jest.fn(async () => true)
}));

// In-memory doc_locks z wierna semantyka predykatow (jak SQLite).
const store = new Map<string, any>();
const keyOf = (t: string, i: string) => `${t}:${i}`;

function matchOr(lock: any, or: any[]): boolean {
    return or.some((cond) => {
        if (cond.userId !== undefined && lock.userId !== cond.userId) return false;
        if (cond.heartbeatAt?.lt !== undefined && !(lock.heartbeatAt < cond.heartbeatAt.lt))
            return false;
        return true;
    });
}

// P1.5: wlasciciele dokumentow do guardu read-access (wlasciciel user-a;
// docId od 'missing-' = dokument nie istnieje -> 404).
const ownerOf = ({ where }: any) =>
    String(where.id).startsWith('missing-') ? null : { id: where.id, userId: 'user-a' };

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        doc_locks: {
            findUnique: jest.fn(async ({ where }: any) => {
                const k = where.docType_docId
                    ? keyOf(where.docType_docId.docType, where.docType_docId.docId)
                    : keyOf(where.docType, where.docId);
                return store.get(k) ?? null;
            }),
            updateMany: jest.fn(async ({ where, data }: any) => {
                const k = keyOf(where.docType, where.docId);
                const lock = store.get(k);
                if (!lock) return { count: 0 };
                if (where.userId !== undefined && lock.userId !== where.userId) return { count: 0 };
                if (where.OR && !matchOr(lock, where.OR)) return { count: 0 };
                store.set(k, { ...lock, ...data });
                return { count: 1 };
            }),
            create: jest.fn(async ({ data }: any) => {
                const k = keyOf(data.docType, data.docId);
                if (store.has(k)) throw { code: 'P2002' };
                store.set(k, { ...data });
                return store.get(k);
            }),
            upsert: jest.fn(async ({ where, update, create }: any) => {
                const k = keyOf(where.docType_docId.docType, where.docType_docId.docId);
                if (store.has(k)) store.set(k, { ...store.get(k), ...update });
                else store.set(k, { ...create });
                return store.get(k);
            }),
            deleteMany: jest.fn(async ({ where }: any) => {
                const k = keyOf(where.docType, where.docId);
                const lock = store.get(k);
                if (!lock) return { count: 0 };
                if (where.OR && !matchOr(lock, where.OR)) return { count: 0 };
                if (
                    where.heartbeatAt?.lt !== undefined &&
                    !(lock.heartbeatAt < where.heartbeatAt.lt)
                )
                    return { count: 0 };
                store.delete(k);
                return { count: 1 };
            })
        },
        // P1.5: tabele wlascicieli do guardu read-access w acquire.
        offers_rel: { findUnique: jest.fn(async (args: any) => ownerOf(args)) },
        offers_studnie_rel: { findUnique: jest.fn(async (args: any) => ownerOf(args)) },
        orders_rury_rel: { findUnique: jest.fn(async (args: any) => ownerOf(args)) },
        orders_studnie_rel: { findUnique: jest.fn(async (args: any) => ownerOf(args)) }
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/locks', locksRouter);
    return app;
}

const asUser = (u: any) => {
    currentUser = u;
};
const userA = { id: 'user-a', username: 'adam', role: 'user', subUsers: [] };
const userB = { id: 'user-b', username: 'ewa', role: 'user', subUsers: [] };
const admin = { id: 'admin-1', username: 'admin', role: 'admin', subUsers: [] };

beforeEach(() => {
    store.clear();
    asUser(userA);
    (canReadWithShare as jest.Mock).mockResolvedValue(true);
});

describe('Twarda blokada edycji (doc_locks)', () => {
    test('acquire na wolnym dokumencie → 200 + holder', async () => {
        const res = await request(createApp())
            .post('/api/locks/acquire')
            .send({ docType: 'offer', docId: 'o1' });
        expect(res.status).toBe(200);
        expect(res.body.lock.userId).toBe('user-a');
    });

    test('dwa ROWNOLEGLE acquire roznych uzytkownikow → dokładnie jeden 200, drugi 423', async () => {
        const app = createApp();
        const [r1, r2] = await Promise.all([
            request(app)
                .post('/api/locks/acquire')
                .set('x-test-user', 'user-a')
                .send({ docType: 'offer', docId: 'o1' }),
            request(app)
                .post('/api/locks/acquire')
                .set('x-test-user', 'user-b')
                .send({ docType: 'offer', docId: 'o1' })
        ]);
        const statuses = [r1.status, r2.status].sort();
        expect(statuses).toEqual([200, 423]);
        const loser = r1.status === 423 ? r1 : r2;
        expect(loser.body.code).toBe('DOC_LOCKED');
        expect(loser.body.holder.userId).toMatch(/user-[ab]/);
    });

    test('ten sam user w dwoch kartach = re-entrancy (200/200, swiadome)', async () => {
        const app = createApp();
        const [r1, r2] = await Promise.all([
            request(app)
                .post('/api/locks/acquire')
                .set('x-test-user', 'user-a')
                .send({ docType: 'offer', docId: 'o1' }),
            request(app)
                .post('/api/locks/acquire')
                .set('x-test-user', 'user-a')
                .send({ docType: 'offer', docId: 'o1' })
        ]);
        expect([r1.status, r2.status].sort()).toEqual([200, 200]);
        asUser(userB);
        const rb = await request(app)
            .post('/api/locks/acquire')
            .send({ docType: 'offer', docId: 'o1' });
        expect(rb.status).toBe(423);
        expect(rb.body.holder.userId).toBe('user-a');
    });

    test('wygasly lock (heartbeat > TTL) → przejecie 200', async () => {
        await request(createApp())
            .post('/api/locks/acquire')
            .send({ docType: 'offer', docId: 'o1' });
        const k = keyOf('offer', 'o1');
        store.set(k, {
            ...store.get(k),
            heartbeatAt: new Date(Date.now() - 200000).toISOString()
        });
        asUser(userB);
        const res = await request(createApp())
            .post('/api/locks/acquire')
            .send({ docType: 'offer', docId: 'o1' });
        expect(res.status).toBe(200);
        expect(res.body.lock.userId).toBe('user-b');
    });

    test('heartbeat wlasciciela → 200; heartbeat obcego → 423', async () => {
        const app = createApp();
        await request(app).post('/api/locks/acquire').send({ docType: 'offer', docId: 'o1' });
        const ok = await request(app)
            .post('/api/locks/heartbeat')
            .send({ docType: 'offer', docId: 'o1' });
        expect(ok.status).toBe(200);
        asUser(userB);
        const denied = await request(app)
            .post('/api/locks/heartbeat')
            .send({ docType: 'offer', docId: 'o1' });
        expect(denied.status).toBe(423);
    });

    test('release wlasciciela zwalnia; force admina zastapia jednym upsertem', async () => {
        const app = createApp();
        await request(app).post('/api/locks/acquire').send({ docType: 'offer', docId: 'o1' });
        asUser(userB);
        const denied = await request(app)
            .post('/api/locks/release')
            .send({ docType: 'offer', docId: 'o1' });
        expect(denied.body.released).toBe(false);
        asUser(admin);
        const forced = await request(app)
            .post('/api/locks/force')
            .send({ docType: 'offer', docId: 'o1' });
        expect(forced.status).toBe(200);
        expect(forced.body.lock.userId).toBe('admin-1');
        asUser(userB);
        const afterForce = await request(app)
            .post('/api/locks/acquire')
            .send({ docType: 'offer', docId: 'o1' });
        expect(afterForce.status).toBe(423);
        expect(afterForce.body.holder.userId).toBe('admin-1');
    });

    test('force nie-admina → 403', async () => {
        asUser(userB);
        const res = await request(createApp())
            .post('/api/locks/force')
            .send({ docType: 'offer', docId: 'o1' });
        expect(res.status).toBe(403);
    });

    test('bledny docType → 400', async () => {
        const res = await request(createApp())
            .post('/api/locks/acquire')
            .send({ docType: 'invoice', docId: 'o1' });
        expect(res.status).toBe(400);
    });

    test('assertDocLockForWrite: brak wiersza przepuszcza (stare sesje, chroni 409)', async () => {
        await expect(
            assertDocLockForWrite(prisma as any, {
                docType: 'offer',
                docId: 'nope',
                user: { id: 'user-a' }
            })
        ).resolves.toBeUndefined();
    });

    test('assertDocLockForWrite: cudzy swiezy → throw 423; wlasny/wygasly → pass', async () => {
        const app = createApp();
        await request(app).post('/api/locks/acquire').send({ docType: 'order_rury', docId: 'r1' });
        await expect(
            assertDocLockForWrite(prisma as any, {
                docType: 'order_rury',
                docId: 'r1',
                user: { id: 'user-b' }
            })
        ).rejects.toMatchObject({ status: 423, code: 'DOC_LOCKED' });
        await expect(
            assertDocLockForWrite(prisma as any, {
                docType: 'order_rury',
                docId: 'r1',
                user: { id: 'user-a' }
            })
        ).resolves.toBeUndefined();
        const k = keyOf('order_rury', 'r1');
        store.set(k, { ...store.get(k), heartbeatAt: new Date(Date.now() - 200000).toISOString() });
        await expect(
            assertDocLockForWrite(prisma as any, {
                docType: 'order_rury',
                docId: 'r1',
                user: { id: 'user-b' }
            })
        ).resolves.toBeUndefined();
    });

    test('P1.5: GET wygaslego locka → locked:false + leniwe czyszczenie wiersza', async () => {
        const app = createApp();
        await request(app).post('/api/locks/acquire').send({ docType: 'offer', docId: 'o1' });
        const k = keyOf('offer', 'o1');
        store.set(k, {
            ...store.get(k),
            heartbeatAt: new Date(Date.now() - 200000).toISOString()
        });
        const res = await request(app).get('/api/locks/offer/o1');
        expect(res.status).toBe(200);
        expect(res.body.locked).toBe(false);
        expect(store.has(k)).toBe(false);
    });

    test('P1.5: GET swiezego locka → locked:true (bez zmian)', async () => {
        const app = createApp();
        await request(app).post('/api/locks/acquire').send({ docType: 'offer', docId: 'o1' });
        const res = await request(app).get('/api/locks/offer/o1');
        expect(res.status).toBe(200);
        expect(res.body.locked).toBe(true);
        expect(res.body.lock.userId).toBe('user-a');
    });

    test('P1.5: acquire bez read-access → 404 + brak wiersza (brak lock-squattingu)', async () => {
        asUser(userB);
        (canReadWithShare as jest.Mock).mockResolvedValueOnce(false);
        const res = await request(createApp())
            .post('/api/locks/acquire')
            .send({ docType: 'offer', docId: 'o1' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Dokument nie znaleziony');
        expect(store.has(keyOf('offer', 'o1'))).toBe(false);
    });

    test('P1.5: acquire nieistniejacego dokumentu → 404', async () => {
        const res = await request(createApp())
            .post('/api/locks/acquire')
            .send({ docType: 'offer', docId: 'missing-x' });
        expect(res.status).toBe(404);
        expect(store.has(keyOf('offer', 'missing-x'))).toBe(false);
    });

    test('P1.5: acquire z read-access → 200 jak dotad', async () => {
        asUser(userB);
        (canReadWithShare as jest.Mock).mockResolvedValueOnce(true);
        const res = await request(createApp())
            .post('/api/locks/acquire')
            .send({ docType: 'order_rury', docId: 'r9' });
        expect(res.status).toBe(200);
        expect(res.body.lock.userId).toBe('user-b');
    });

    test('P1.5: GET holdera obcego locka → 404 (oracle zamknięty jak acquire)', async () => {
        const app = createApp();
        await request(app).post('/api/locks/acquire').send({ docType: 'offer', docId: 'o1' });
        asUser(userB);
        (canReadWithShare as jest.Mock).mockResolvedValueOnce(false);
        const res = await request(createApp()).get('/api/locks/offer/o1');
        expect(res.status).toBe(404);
        expect(res.body.lock).toBeUndefined();
    });

    test('P1.5: heartbeat obcego na wygaslym locku → 404 (nie 423)', async () => {
        const app = createApp();
        await request(app).post('/api/locks/acquire').send({ docType: 'offer', docId: 'o1' });
        const k = keyOf('offer', 'o1');
        store.set(k, {
            ...store.get(k),
            heartbeatAt: new Date(Date.now() - 200000).toISOString()
        });
        asUser(userB);
        const res = await request(app)
            .post('/api/locks/heartbeat')
            .send({ docType: 'offer', docId: 'o1' });
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('DOC_LOCK_MISSING');
    });

    test('GET status: 600/min przechodzi, 601. dostaje prawdziwe 429', async () => {
        const app = createApp();
        // P1.5: 3 GET-y z testow powyzej zuzywaja budzet okna — petla 597, by suma dala 600.
        for (let i = 0; i < 597; i++) {
            const r = await request(app).get('/api/locks/offer/rate-probe');
            expect(r.status).toBe(200);
        }
        const blocked = await request(app).get('/api/locks/offer/rate-probe');
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toContain('Zbyt wiele');
    }, 120000);
});
