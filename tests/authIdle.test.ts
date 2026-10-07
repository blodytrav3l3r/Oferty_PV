// Mock prisma BEFORE any imports that use it
const mockPrisma = {
    sessions: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({})
    },
    users: {
        findUnique: jest.fn(),
        create: jest.fn()
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
import {
    requireAuth,
    getSession,
    getSessionWithStatus,
    touchSession,
    SESSION_IDLE_TIMEOUT_MS,
    SESSION_ABSOLUTE_MAX_MS,
    SESSION_TOUCH_THROTTLE_MS,
    hashToken
} from '../src/middleware/auth';

const HOUR = 60 * 60 * 1000;

function sessionRow(ageMs: number, opts: { absoluteAgeMs?: number } = {}) {
    const now = Date.now();
    return {
        token: hashToken('tok'),
        userId: 'user1',
        createdAt: BigInt(now - (opts.absoluteAgeMs ?? 1000)),
        lastActivity: BigInt(now - ageMs)
    };
}

describe('P1-idle: timeout 1h bezczynnosci / absolute 7d', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.sessions.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.sessions.update.mockResolvedValue({});
    });

    it('stałe czasowe: idle 1h, absolute 7d, throttle 5min', () => {
        expect(SESSION_IDLE_TIMEOUT_MS).toBe(HOUR);
        expect(SESSION_ABSOLUTE_MAX_MS).toBe(7 * 24 * HOUR);
        expect(SESSION_TOUCH_THROTTLE_MS).toBe(5 * 60 * 1000);
    });

    it('aktywna sesja (lastActivity teraz) przechodzi', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue(sessionRow(1000));
        const result = await getSession('tok');
        expect(result?.userId).toBe('user1');
    });

    it('idle >1h: getSession null + kasowanie + reason idle', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue(sessionRow(HOUR + 1000));
        mockPrisma.sessions.delete.mockResolvedValue({});
        const { session, reason } = await getSessionWithStatus('tok');
        expect(session).toBeNull();
        expect(reason).toBe('idle');
        expect(mockPrisma.sessions.delete).toHaveBeenCalledWith({
            where: { token: hashToken('tok') }
        });
    });

    it('legacy wiersz bez lastActivity: fallback do createdAt (61 min → idle)', async () => {
        const now = Date.now();
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: hashToken('tok'),
            userId: 'user1',
            createdAt: BigInt(now - HOUR - 1000)
        });
        mockPrisma.sessions.delete.mockResolvedValue({});
        const { session, reason } = await getSessionWithStatus('tok');
        expect(session).toBeNull();
        expect(reason).toBe('idle');
    });

    it('absolute wygrywa: createdAt 8d temu mimo swiezej aktywnosci', async () => {
        const now = Date.now();
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: hashToken('tok'),
            userId: 'user1',
            createdAt: BigInt(now - 8 * 24 * HOUR),
            lastActivity: BigInt(now)
        });
        mockPrisma.sessions.delete.mockResolvedValue({});
        const { session, reason } = await getSessionWithStatus('tok');
        expect(session).toBeNull();
        expect(reason).toBe('absolute');
    });

    it('requireAuth: idle → 401 z kodem SESSION_IDLE_EXPIRED', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue(sessionRow(HOUR + 1000));
        mockPrisma.sessions.delete.mockResolvedValue({});
        const app = express();
        app.use(cookieParser());
        app.get('/p', requireAuth, (_req, res) => res.json({ ok: true }));
        const res = await request(app).get('/p').set('Cookie', 'authToken=tok');
        expect(res.statusCode).toBe(401);
        expect(res.body.code).toBe('SESSION_IDLE_EXPIRED');
    });

    it('requireAuth: absolute → 401 z kodem SESSION_EXPIRED', async () => {
        const now = Date.now();
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: hashToken('tok'),
            userId: 'user1',
            createdAt: BigInt(now - 8 * 24 * HOUR),
            lastActivity: BigInt(now)
        });
        mockPrisma.sessions.delete.mockResolvedValue({});
        const app = express();
        app.use(cookieParser());
        app.get('/p', requireAuth, (_req, res) => res.json({ ok: true }));
        const res = await request(app).get('/p').set('Cookie', 'authToken=tok');
        expect(res.statusCode).toBe(401);
        expect(res.body.code).toBe('SESSION_EXPIRED');
    });

    it('touch: brak zapisu gdy aktywnosc swieza (throttle)', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: hashToken('tok'),
            userId: 'u1',
            createdAt: BigInt(Date.now()),
            lastActivity: BigInt(Date.now() - 60 * 1000)
        });
        await touchSession('tok');
        expect(mockPrisma.sessions.update).not.toHaveBeenCalled();
    });

    it('touch: zapis gdy aktywnosc starsza niz throttle', async () => {
        mockPrisma.sessions.findUnique.mockResolvedValue({
            token: hashToken('tok'),
            userId: 'u1',
            createdAt: BigInt(Date.now()),
            lastActivity: BigInt(Date.now() - 6 * 60 * 1000)
        });
        await touchSession('tok');
        expect(mockPrisma.sessions.update).toHaveBeenCalledWith({
            where: { token: hashToken('tok') },
            data: { lastActivity: expect.any(Number) }
        });
    });
});
