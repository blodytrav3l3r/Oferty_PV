// Mock prisma BEFORE any imports that use it
const mockPrisma = {
    sessions: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    users: {
        findUnique: jest.fn()
    },
    audit_logs: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: mockPrisma
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { requireAuth, requireAdmin, getSession, SESSION_MAX_AGE_MS } from '../src/middleware/auth';

// ─── getSession ─────────────────────────────────────────────────────

describe('getSession', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('powinien zwrócić null dla niezdefiniowanego tokenu', async () => {
        const result = await getSession(undefined);
        expect(result).toBeNull();
    });

    it('powinien zwrócić null, gdy sesja nie została znaleziona w bazie danych', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue(null);
        const result = await getSession('nonexistent-token');
        expect(result).toBeNull();
    });

    it('powinien zwrócić sesję dla prawidłowego tokenu', async () => {
        const mockSession = {
            token: 'valid-token',
            userId: 'user1',
            createdAt: BigInt(Date.now()),
            lastUsedAt: BigInt(Date.now()),
            expiresAt: BigInt(Date.now() + SESSION_MAX_AGE_MS),
            revokedAt: null
        };
        mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);

        const result = await getSession('valid-token');
        expect(result).not.toBeNull();
        expect(result?.userId).toBe('user1');
    });

    it('powinien odrzucić wygasłą sesję i zwrócić null', async () => {
        const expiredTime = BigInt(Date.now() - SESSION_MAX_AGE_MS - 1000);
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: 'expired-token',
            userId: 'user1',
            createdAt: expiredTime,
            lastUsedAt: expiredTime,
            expiresAt: BigInt(Date.now() - 1), // expired
            revokedAt: null
        });

        const result = await getSession('expired-token');
        expect(result).toBeNull();
        // Nie wywołuje delete — zwraca null, sesja zostaje w bazie (z expiresAt)
    });

    it('powinien odrzucić revoked sesję i zwrócić null', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: 'revoked-token',
            userId: 'user1',
            createdAt: BigInt(Date.now()),
            lastUsedAt: BigInt(Date.now()),
            expiresAt: BigInt(Date.now() + SESSION_MAX_AGE_MS),
            revokedAt: BigInt(Date.now())
        });

        const result = await getSession('revoked-token');
        expect(result).toBeNull();
    });

    it('powinien łagodnie obsługiwać błędy bazy danych', async () => {
        mockPrisma.sessions.findUnique.mockRejectedValue(new Error('DB down'));
        const result = await getSession('some-token');
        expect(result).toBeNull();
    });
});

// ─── requireAuth middleware ──────────────────────────────────────────

describe('requireAuth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('powinien zwrócić 401, gdy nie podano tokenu', async () => {
        const app = express();
        app.use(express.json());
        app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/protected');
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toContain('Nieautoryzowany');
    });

    it('powinien zwrócić 401, gdy token jest nieprawidłowy', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue(null);

        const app = express();
        app.use(cookieParser());
        app.use(express.json());
        app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/protected').set('Cookie', 'authToken=invalid-token');

        expect(res.statusCode).toBe(401);
    });

    it('powinien dołączyć obiekt użytkownika, gdy sesja jest prawidłowa', async () => {
        const now = BigInt(Date.now());
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: 'valid-token',
            userId: 'user1',
            createdAt: now,
            lastUsedAt: now,
            expiresAt: BigInt(Date.now() + SESSION_MAX_AGE_MS),
            revokedAt: null
        });
        mockPrisma.sessions.update.mockResolvedValue({});
        mockPrisma.users.findUnique.mockResolvedValue({
            id: 'user1',
            username: 'testuser',
            password: 'hashed',
            role: 'user',
            firstName: 'Test',
            lastName: 'User',
            subUsers: null
        });

        const app = express();
        app.use(cookieParser());
        app.use(express.json());
        app.get('/protected', requireAuth, (req, res) => {
            res.json({ user: req.user });
        });

        const res = await request(app).get('/protected').set('Cookie', 'authToken=valid-token');

        expect(res.statusCode).toBe(200);
        expect(res.body.user.username).toBe('testuser');
        expect(res.body.user).not.toHaveProperty('password');
    });

    it('powinien zwrócić 401, jeśli użytkownik nie został znaleziony w bazie danych', async () => {
        const now = BigInt(Date.now());
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: 'valid-token',
            userId: 'deleted-user',
            createdAt: now,
            lastUsedAt: now,
            expiresAt: BigInt(Date.now() + SESSION_MAX_AGE_MS),
            revokedAt: null
        });
        mockPrisma.users.findUnique.mockResolvedValue(null);

        const app = express();
        app.use(cookieParser());
        app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/protected').set('Cookie', 'authToken=valid-token');

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toContain('Użytkownik nie istnieje');
    });

    it('powinien ignorować X-Auth-Token header (czyta tylko cookie)', async () => {
        const now = BigInt(Date.now());
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: 'header-token',
            userId: 'user1',
            createdAt: now,
            lastUsedAt: now,
            expiresAt: BigInt(Date.now() + SESSION_MAX_AGE_MS),
            revokedAt: null
        });
        // Zwraca 401 mimo że X-Auth-Token jest ustawiony, bo middleware czyta tylko cookie
        const app = express();
        app.use(cookieParser());
        app.use(express.json());
        app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/protected').set('x-auth-token', 'header-token');

        // Nie ma cookie → 401, X-Auth-Token jest ignorowany
        expect(res.statusCode).toBe(401);
        expect(mockPrisma.sessions.findUnique).not.toHaveBeenCalled();
    });
});

// ─── requireAdmin middleware ─────────────────────────────────────────

describe('requireAdmin', () => {
    it('powinien zwrócić 403, gdy użytkownik nie jest administratorem', async () => {
        const app = express();
        app.get(
            '/admin',
            (req, _res, next) => {
                req.user = { id: '1', username: 'user', role: 'user', subUsers: [] };
                next();
            },
            requireAdmin,
            (_req, res) => res.json({ ok: true })
        );

        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(403);
    });

    it('powinien przepuścić, gdy użytkownik jest administratorem', async () => {
        const app = express();
        app.get(
            '/admin',
            (req, _res, next) => {
                req.user = { id: '1', username: 'admin', role: 'admin', subUsers: [] };
                next();
            },
            requireAdmin,
            (_req, res) => res.json({ ok: true })
        );

        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('powinien zwrócić 403, gdy nie dołączono użytkownika', async () => {
        const app = express();
        app.get('/admin', requireAdmin, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(403);
    });
});
