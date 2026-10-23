/**
 * Panel admina: lista aktywnych sesji + wymuszone wylogowanie.
 * REAL auth middleware + REAL admin router; granica mocka to wyłącznie
 * prismaClient (mini-DB: users + sessions + audit_logs).
 *
 * Kontrakty, które ten plik chroni:
 * - lista używa TEJ SAMEJ reguły wygaśnięcia co requireAuth (isSessionActive),
 * - revoke faktycznie unieważnia cookie ofiary (następny request = 401),
 * - revoke nie dotyka sesji innych użytkowników,
 * - `0` z revoke oznacza „brak sesji", a błąd DB to 500 (nie fałszywe 200),
 * - odpowiedź nigdy nie zawiera tokenu/hasha.
 */
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

import authRoutes from '../src/routes/auth';
import adminRoutes from '../src/routes/admin';
import prisma from '../src/prismaClient';
import { requireAuth, revokeUserSessions, deleteUserSessions } from '../src/middleware/auth';

/** Mock Prisma ma metody jest.* — typ produkcyjny ich nie zna. */
const prismaMock = prisma as unknown as { sessions: { findMany: jest.Mock } };

type UserRow = {
    id: string;
    username: string;
    password: string;
    role: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    symbol: string | null;
    subUsers: string;
    orderStartNumber: number;
    productionOrderStartNumber: number;
};
type SessionRow = { token: string; userId: string; createdAt: number; lastActivity: number };
type AuditRow = {
    entityType: unknown;
    entityId: unknown;
    userId: unknown;
    action: unknown;
    newData: unknown;
};

const users = new Map<string, UserRow>();
const sessions = new Map<string, SessionRow>();
const auditRows: AuditRow[] = [];

function seedUser(u: Partial<UserRow> & { id: string; username: string }): UserRow {
    const row: UserRow = {
        password: bcrypt.hashSync('start-pass', 4),
        role: 'user',
        firstName: null,
        lastName: null,
        phone: null,
        email: null,
        symbol: null,
        subUsers: '[]',
        orderStartNumber: 1,
        productionOrderStartNumber: 1,
        ...u
    };
    users.set(row.id, row);
    return row;
}

function seedSession(userId: string, ageMs: number, token = 'seed-' + Math.random()): SessionRow {
    const now = Date.now();
    const row: SessionRow = {
        token,
        userId,
        createdAt: now - ageMs,
        lastActivity: now - ageMs
    };
    sessions.set(token, row);
    return row;
}

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: {
            findUnique: jest.fn(async ({ where }: any) => {
                if (where.id) return users.get(where.id) ?? null;
                if (where.username) {
                    for (const u of users.values()) if (u.username === where.username) return u;
                    return null;
                }
                return null;
            }),
            update: jest.fn(async ({ where, data }: any) => {
                const cur = users.get(where.id);
                if (!cur) throw new Error('not found');
                const next = { ...cur, ...data };
                users.set(where.id, next);
                return next;
            })
        },
        sessions: {
            create: jest.fn(async ({ data }: any) => {
                sessions.set(data.token, { ...data });
                return data;
            }),
            findUnique: jest.fn(async ({ where }: any) => sessions.get(where.token) ?? null),
            findMany: jest.fn(async ({ where }: any) =>
                [...sessions.values()].filter((s) =>
                    where?.userId ? s.userId === where.userId : true
                )
            ),
            update: jest.fn(async ({ where, data }: any) => {
                const cur = sessions.get(where.token);
                if (!cur) throw new Error('not found');
                const next = { ...cur, ...data };
                sessions.set(where.token, next);
                return next;
            }),
            delete: jest.fn(async ({ where }: any) => {
                sessions.delete(where.token);
                return where;
            }),
            deleteMany: jest.fn(async ({ where }: any) => {
                let n = 0;
                if (where?.token?.in) {
                    for (const t of where.token.in) if (sessions.delete(t)) n++;
                } else if (where?.userId) {
                    for (const [t, s] of sessions)
                        if (s.userId === where.userId) {
                            sessions.delete(t);
                            n++;
                        }
                }
                return { count: n };
            })
        },
        $executeRaw: jest.fn(async (_strings: any, ...values: any[]) => {
            auditRows.push({
                entityType: values[1],
                entityId: values[2],
                userId: values[3],
                action: values[4],
                newData: values[6]
            });
            return 1;
        })
    }
}));

function buildApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRoutes);
    app.use('/api/admin', adminRoutes);
    app.get('/probe-auth', requireAuth, (_req, res) => res.json({ ok: true }));
    return app;
}

async function loginAs(
    app: express.Application,
    username: string,
    password = 'start-pass'
): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(200);
    return String(res.headers['set-cookie'][0]).split(';')[0];
}

const ONE_MIN = 60 * 1000;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;

describe('admin: lista i revoke sesji', () => {
    let app: express.Application;

    beforeEach(() => {
        users.clear();
        sessions.clear();
        auditRows.length = 0;
        seedUser({ id: 'a', username: 'admin', role: 'admin' });
        seedUser({ id: 'v', username: 'vict' });
        seedUser({ id: 'w', username: 'other' });
        app = buildApp();
    });

    test('GET /sessions: 403 dla nie-admina', async () => {
        const victimCookie = await loginAs(app, 'vict');
        const res = await request(app).get('/api/admin/sessions').set('Cookie', victimCookie);
        expect(res.status).toBe(403);
    });

    test('GET /sessions: agregacja per user, wygasłe pominięte, zero tokenów', async () => {
        seedSession('v', 2 * ONE_MIN, 'v-active-1');
        seedSession('v', 5 * ONE_MIN, 'v-active-2');
        seedSession('w', ONE_HOUR + 5000, 'w-idle');
        const adminCookie = await loginAs(app, 'admin');

        const res = await request(app).get('/api/admin/sessions').set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const byUser = new Map(res.body.data.map((r: any) => [r.userId, r]));
        expect(byUser.get('v')).toMatchObject({ sessionCount: 2 });
        expect(byUser.has('w')).toBe(false); // idle > 1h
        expect(byUser.get('a')).toMatchObject({ sessionCount: 1 });

        expect(res.body.summary.activeUsers).toBe(2);
        expect(res.body.summary.activeSessions).toBe(3);
        expect(res.body.summary.lastActivityAt).toBeGreaterThan(0);
        expect(JSON.stringify(res.body)).not.toContain('token');
    });

    test('granica idle: 1h - 1ms aktywne, 1h + 1ms wygasłe', async () => {
        seedSession('v', ONE_HOUR - 1000, 'v-edge-in');
        seedSession('w', ONE_HOUR + 1000, 'w-edge-out');
        const adminCookie = await loginAs(app, 'admin');

        const res = await request(app).get('/api/admin/sessions').set('Cookie', adminCookie);
        const ids = res.body.data.map((r: any) => r.userId);
        expect(ids).toContain('v');
        expect(ids).not.toContain('w');
    });

    test('granica absolute: sesja starsza niż 7 dni jest wygasła', async () => {
        const old = seedSession('v', 0, 'v-old');
        old.createdAt = Date.now() - 7 * ONE_DAY - 1000;
        old.lastActivity = Date.now(); // aktywna przed chwilą, ale absolute przekroczone
        const adminCookie = await loginAs(app, 'admin');

        const res = await request(app).get('/api/admin/sessions').set('Cookie', adminCookie);
        const ids = res.body.data.map((r: any) => r.userId);
        expect(ids).not.toContain('v');
    });

    test('DELETE /sessions/:id: 403 dla nie-admina', async () => {
        const victimCookie = await loginAs(app, 'vict');
        const res = await request(app).delete('/api/admin/sessions/w').set('Cookie', victimCookie);
        expect(res.status).toBe(403);
    });

    test('DELETE: revoke ofiary → jej następny request 401, inni zostają', async () => {
        const victimCookie = await loginAs(app, 'vict');
        const otherCookie = await loginAs(app, 'other');
        const adminCookie = await loginAs(app, 'admin');

        const res = await request(app).delete('/api/admin/sessions/v').set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ok: true, revoked: 1 });

        expect((await request(app).get('/probe-auth').set('Cookie', victimCookie)).status).toBe(
            401
        );
        expect((await request(app).get('/probe-auth').set('Cookie', otherCookie)).status).toBe(200);
        expect((await request(app).get('/probe-auth').set('Cookie', adminCookie)).status).toBe(200);
    });

    test('DELETE: wpis audytu (aktor, cel, liczba sesji)', async () => {
        await loginAs(app, 'vict');
        const adminCookie = await loginAs(app, 'admin');

        await request(app).delete('/api/admin/sessions/v').set('Cookie', adminCookie);

        expect(auditRows).toHaveLength(1);
        expect(auditRows[0]).toMatchObject({
            entityType: 'session',
            entityId: 'v',
            userId: 'a',
            action: 'delete'
        });
        expect(String(auditRows[0].newData)).toContain('admin_revoke');
        expect(String(auditRows[0].newData)).toContain('"revoked":1');
    });

    test('DELETE: self-revoke zablokowane (400), sesja admina żyje', async () => {
        const adminCookie = await loginAs(app, 'admin');
        const res = await request(app).delete('/api/admin/sessions/a').set('Cookie', adminCookie);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SELF_REVOKE_BLOCKED');
        expect((await request(app).get('/probe-auth').set('Cookie', adminCookie)).status).toBe(200);
    });

    test('DELETE: nieznany user → 404, bez wpisu audytu', async () => {
        const adminCookie = await loginAs(app, 'admin');
        const res = await request(app)
            .delete('/api/admin/sessions/nope')
            .set('Cookie', adminCookie);
        expect(res.status).toBe(404);
        expect(auditRows).toHaveLength(0);
    });

    test('DELETE: idempotentne — brak sesji → 200 revoked 0 + audyt', async () => {
        const adminCookie = await loginAs(app, 'admin');
        const res = await request(app).delete('/api/admin/sessions/v').set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.revoked).toBe(0);
        expect(auditRows).toHaveLength(1);
    });

    test('DELETE: błąd DB → 500, nie fałszywe 200 (kontrakt 0 vs błąd)', async () => {
        const adminCookie = await loginAs(app, 'admin');
        prismaMock.sessions.findMany.mockRejectedValueOnce(new Error('db down'));

        const res = await request(app).delete('/api/admin/sessions/v').set('Cookie', adminCookie);
        expect(res.status).toBe(500);
        expect(auditRows).toHaveLength(0);
    });

    test('revokeUserSessions rzuca, deleteUserSessions zachowuje stary kontrakt (0)', async () => {
        prismaMock.sessions.findMany.mockRejectedValueOnce(new Error('db down'));
        await expect(revokeUserSessions('v')).rejects.toThrow('db down');

        prismaMock.sessions.findMany.mockRejectedValueOnce(new Error('db down'));
        await expect(deleteUserSessions('v')).resolves.toBe(0);
    });
});
