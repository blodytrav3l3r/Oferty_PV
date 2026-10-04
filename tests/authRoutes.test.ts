/**
 * auth — kontrakt loginu/wylogowania (mock Prisma; bez DB).
 * 401 na obcego/złe hasło, token NIGDY w body, 400 na zły payload.
 */
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRouter from '../src/routes/auth';

jest.mock('../src/middleware/rateLimiters', () => ({
    LOGIN_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next(),
    CHANGE_PASSWORD_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const prismaMock = {
    users: { findUnique: jest.fn() },
    sessions: {
        findUnique: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(async () => ({ count: 0 })),
        delete: jest.fn()
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        get users() {
            return prismaMock.users;
        },
        get sessions() {
            return prismaMock.sessions;
        }
    }
}));

function app() {
    const a = express();
    a.use(cookieParser());
    a.use(express.json());
    a.use('/', authRouter);
    return a;
}

const storedHash = bcrypt.hashSync('secret123', 10);

beforeEach(() => jest.clearAllMocks());

describe('auth', () => {
    it('nieznany login → 401 bez tokenu w body', async () => {
        prismaMock.users.findUnique.mockResolvedValue(null);
        const res = await request(app())
            .post('/login')
            .send({ username: 'duch', password: 'secret123' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Nieprawidłowy login lub hasło');
        expect('token' in res.body).toBe(false);
    });

    it('złe hasło → 401 bez tokenu w body', async () => {
        prismaMock.users.findUnique.mockResolvedValue({
            id: 'u1',
            username: 'jan',
            password: storedHash,
            role: 'user',
            subUsers: '[]'
        });
        const res = await request(app())
            .post('/login')
            .send({ username: 'jan', password: 'zle-haslo' });
        expect(res.status).toBe(401);
        expect('token' in res.body).toBe(false);
    });

    it('brak pól → 400 z kontraktu zod (nie 422)', async () => {
        const res = await request(app()).post('/login').send({ username: 'ab' });
        expect(res.status).toBe(400);
        expect(typeof res.body.error).toBe('string');
    });

    it('logout bez ciastka → ok bez błędu', async () => {
        const res = await request(app()).post('/logout');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });
});
