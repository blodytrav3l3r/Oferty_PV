/**
 * D-FIX-1: admin PUT /users/:id unieważnia sesje/cache (efekt bezpieczeństwa).
 * REAL auth middleware + REAL users router; granica mocka to wyłącznie
 * prismaClient (in-memory mini-DB: users + sessions). Bez mocka modułu auth —
 * test dowodzi kontraktu: stara sesja nie honoruje starych uprawnień.
 */
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => {
    const actual = jest.requireActual('bcryptjs');
    return { ...actual };
});

import authRoutes from '../src/routes/auth';
import usersRoutes from '../src/routes/users';
import { requireAuth, requireAdmin } from '../src/middleware/auth';

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
type SessionRow = { token: string; userId: string; createdAt: number };

const users = new Map<string, UserRow>();
const sessions = new Map<string, SessionRow>();

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
            update: jest.fn(async ({ where, data }: any) => {
                const cur = sessions.get(where.token);
                if (!cur) throw new Error('not found');
                const next = { ...cur, ...data };
                sessions.set(where.token, next);
                return next;
            }),
            findMany: jest.fn(async ({ where }: any) =>
                [...sessions.values()]
                    .filter((s) => (where.userId ? s.userId === where.userId : true))
                    .map((s) => ({ token: s.token }))
            ),
            delete: jest.fn(async ({ where }: any) => {
                sessions.delete(where.token);
                return where;
            }),
            deleteMany: jest.fn(async ({ where }: any) => {
                let n = 0;
                if (where.token?.in) {
                    for (const t of where.token.in) if (sessions.delete(t)) n++;
                } else if (where.userId) {
                    for (const [t, s] of sessions)
                        if (s.userId === where.userId) {
                            sessions.delete(t);
                            n++;
                        }
                }
                return { count: n };
            })
        }
    }
}));

function buildApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRoutes);
    app.use('/api/users', usersRoutes);
    app.get('/probe-auth', requireAuth, (_req, res) => res.json({ ok: true }));
    app.get('/probe-admin', requireAuth, requireAdmin, (_req, res) => res.json({ ok: true }));
    return app;
}

async function loginAs(
    app: express.Application,
    username: string,
    password: string
): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    return String(setCookie[0]).split(';')[0];
}

describe('D-FIX-1 admin user security changes invalidate sessions', () => {
    let app: express.Application;

    beforeEach(() => {
        users.clear();
        sessions.clear();
        seedUser({ id: 'a', username: 'admin', role: 'admin' });
        seedUser({ id: 'v', username: 'vict', role: 'admin' });
        app = buildApp();
    });

    test('demoted admin traci uprawnienia natychmiast (stara sesja -> 401)', async () => {
        const victimCookie = await loginAs(app, 'vict', 'start-pass');
        const adminCookie = await loginAs(app, 'admin', 'start-pass');

        // sanity: ofiara jest adminem (grzeje też auth cache rolą admin)
        const pre = await request(app).get('/probe-admin').set('Cookie', victimCookie);
        expect(pre.status).toBe(200);

        const put = await request(app)
            .put('/api/users/v')
            .set('Cookie', adminCookie)
            .send({ role: 'user' });
        expect(put.status).toBe(200);

        // Kontrakt D-FIX-1: zmiana roli purge'uje sesje ofiary, więc stara
        // cookie jest martwa (401). BEZ fixa: sesja żyła + cache (30 s) oddawał
        // starą rolę admin -> 200 na probe-admin.
        const post = await request(app).get('/probe-admin').set('Cookie', victimCookie);
        expect(post.status).toBe(401);
        const postAuth = await request(app).get('/probe-auth').set('Cookie', victimCookie);
        expect(postAuth.status).toBe(401);
    });

    test('admin password reset unieważnia starą sesję (stara cookie -> 401)', async () => {
        const victimCookie = await loginAs(app, 'vict', 'start-pass');
        const adminCookie = await loginAs(app, 'admin', 'start-pass');

        const pre = await request(app).get('/probe-auth').set('Cookie', victimCookie);
        expect(pre.status).toBe(200);

        const put = await request(app)
            .put('/api/users/v')
            .set('Cookie', adminCookie)
            .send({ password: 'newpass12' });
        expect(put.status).toBe(200);

        // BEZ fixa: sesja w DB przetrwałaby -> 200. Z fixem: purge -> 401.
        const post = await request(app).get('/probe-auth').set('Cookie', victimCookie);
        expect(post.status).toBe(401);

        // nowe hasło działa
        const relogin = await request(app)
            .post('/api/auth/login')
            .send({ username: 'vict', password: 'newpass12' });
        expect(relogin.status).toBe(200);
    });

    test('zmiana nie-bezpieczeństwa nie wylogowuje; self-edit zachowuje sesję', async () => {
        const victimCookie = await loginAs(app, 'vict', 'start-pass');
        const adminCookie = await loginAs(app, 'admin', 'start-pass');

        const put = await request(app)
            .put('/api/users/v')
            .set('Cookie', adminCookie)
            .send({ firstName: 'Nowa' });
        expect(put.status).toBe(200);
        const stillIn = await request(app).get('/probe-auth').set('Cookie', victimCookie);
        expect(stillIn.status).toBe(200);

        const selfEdit = await request(app)
            .put('/api/users/a')
            .set('Cookie', adminCookie)
            .send({ firstName: 'Szef' });
        expect(selfEdit.status).toBe(200);
        const adminStillIn = await request(app).get('/probe-admin').set('Cookie', adminCookie);
        expect(adminStillIn.status).toBe(200);
    });
});
