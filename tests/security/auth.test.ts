import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { requireAuth, hashToken, SESSION_MAX_AGE_MS } from '../../src/middleware/auth';

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: { sessions: { findUnique: jest.fn() }, users: { findUnique: jest.fn() } }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const prismaMock = require('../../src/prismaClient').default;

const USER_ROW = {
    id: 'u1',
    username: 'jan',
    role: 'user',
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: null,
    subUsers: '[]'
};

function buildApp() {
    const app = express();
    app.use(cookieParser());
    app.get('/protected', requireAuth, (req, res) => res.status(200).json({ user: req.user?.id }));
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
});

/**
 * P0.6: kontrakt auth — cookie-only, sesja w DB, sunset x-auth-token.
 */
describe('P0.6 auth matrix', () => {
    it('brak cookie -> 401', async () => {
        const res = await request(buildApp()).get('/protected');
        expect(res.status).toBe(401);
    });

    it('nieznany token -> 401', async () => {
        prismaMock.sessions.findUnique.mockResolvedValueOnce(null);
        const res = await request(buildApp()).get('/protected').set('Cookie', 'authToken=nope');
        expect(res.status).toBe(401);
    });

    it('przeterminowana sesja -> 401', async () => {
        prismaMock.sessions.findUnique.mockResolvedValueOnce({
            token: hashToken('old'),
            userId: 'u1',
            createdAt: BigInt(Date.now() - SESSION_MAX_AGE_MS - 1000)
        });
        const res = await request(buildApp()).get('/protected').set('Cookie', 'authToken=old');
        expect(res.status).toBe(401);
    });

    it('ważna sesja -> next + req.user', async () => {
        prismaMock.sessions.findUnique.mockResolvedValueOnce({
            token: hashToken('good'),
            userId: 'u1',
            createdAt: BigInt(Date.now())
        });
        prismaMock.users.findUnique.mockResolvedValueOnce(USER_ROW);
        const res = await request(buildApp()).get('/protected').set('Cookie', 'authToken=good');
        expect(res.status).toBe(200);
        expect(res.body.user).toBe('u1');
    });

    it('sam nagłówek x-auth-token bez cookie -> 401 (sunset shim)', async () => {
        const res = await request(buildApp()).get('/protected').set('x-auth-token', 'good');
        expect(res.status).toBe(401);
        expect(prismaMock.sessions.findUnique).not.toHaveBeenCalled();
    });
});
