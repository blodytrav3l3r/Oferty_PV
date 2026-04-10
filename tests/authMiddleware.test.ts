// Mock prisma BEFORE any imports that use it
const mockPrisma = {
    sessions: {
        findUnique: jest.fn(),
        create: jest.fn(),
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
import request from 'supertest';
import { requireAuth, requireAdmin, getSession, SESSION_MAX_AGE_MS } from '../src/middleware/auth';

// ─── getSession ─────────────────────────────────────────────────────

describe('getSession', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return null for undefined token', async () => {
        const result = await getSession(undefined);
        expect(result).toBeNull();
    });

    it('should return null when session not found in DB', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue(null);
        const result = await getSession('nonexistent-token');
        expect(result).toBeNull();
    });

    it('should return session for valid token', async () => {
        const mockSession = {
            token: 'valid-token',
            userId: 'user1',
            createdAt: BigInt(Date.now())
        };
        mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);

        const result = await getSession('valid-token');
        expect(result).not.toBeNull();
        expect(result?.userId).toBe('user1');
    });

    it('should delete expired session and return null', async () => {
        const expiredTime = BigInt(Date.now() - SESSION_MAX_AGE_MS - 1000);
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: 'expired-token',
            userId: 'user1',
            createdAt: expiredTime
        });
        mockPrisma.sessions.delete.mockResolvedValue({});

        const result = await getSession('expired-token');
        expect(result).toBeNull();
        expect(mockPrisma.sessions.delete).toHaveBeenCalledWith({
            where: { token: 'expired-token' }
        });
    });

    it('should handle DB errors gracefully', async () => {
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

    it('should return 401 when no token provided', async () => {
        const app = express();
        app.use(express.json());
        app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/protected');
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toContain('Nieautoryzowany');
    });

    it('should return 401 when token is invalid', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue(null);

        const app = express();
        app.use(express.json());
        app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

        const res = await request(app)
            .get('/protected')
            .set('x-auth-token', 'invalid-token');

        expect(res.statusCode).toBe(401);
    });

    it('should attach user object when session valid', async () => {
        const now = BigInt(Date.now());
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: 'valid-token',
            userId: 'user1',
            createdAt: now
        });
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
        app.use(express.json());
        app.get('/protected', requireAuth, (req, res) => {
            res.json({ user: req.user });
        });

        const res = await request(app)
            .get('/protected')
            .set('x-auth-token', 'valid-token');

        expect(res.statusCode).toBe(200);
        expect(res.body.user.username).toBe('testuser');
        expect(res.body.user).not.toHaveProperty('password');
    });

    it('should return 401 if user not found in DB', async () => {
        const now = BigInt(Date.now());
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: 'valid-token',
            userId: 'deleted-user',
            createdAt: now
        });
        mockPrisma.users.findUnique.mockResolvedValue(null);

        const app = express();
        app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

        const res = await request(app)
            .get('/protected')
            .set('x-auth-token', 'valid-token');

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toContain('Użytkownik nie istnieje');
    });
});

// ─── requireAdmin middleware ─────────────────────────────────────────

describe('requireAdmin', () => {
    it('should return 403 when user is not admin', async () => {
        const app = express();
        app.get('/admin', (req, _res, next) => {
            req.user = { id: '1', username: 'user', role: 'user', subUsers: [] };
            next();
        }, requireAdmin, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(403);
    });

    it('should pass through when user is admin', async () => {
        const app = express();
        app.get('/admin', (req, _res, next) => {
            req.user = { id: '1', username: 'admin', role: 'admin', subUsers: [] };
            next();
        }, requireAdmin, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('should return 403 when no user attached', async () => {
        const app = express();
        app.get('/admin', requireAdmin, (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(403);
    });
});
