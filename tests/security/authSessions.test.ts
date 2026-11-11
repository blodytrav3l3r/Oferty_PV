import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

const findUser = jest.fn();
const updateUser = jest.fn();
const createUser = jest.fn();
const createPreference = jest.fn();
const findPreference = jest.fn();
const createSession = jest.fn();
const deleteSession = jest.fn();
const deleteUserSessions = jest.fn();
const authState: { user: Record<string, unknown> | null } = { user: null };

jest.mock('../../src/prismaClient', () => {
    const tx = {
        users: { create: (...args: unknown[]) => createUser(...args) },
        user_preferences: { create: (...args: unknown[]) => createPreference(...args) }
    };
    return {
        __esModule: true,
        default: {
            users: {
                findUnique: (...args: unknown[]) => findUser(...args),
                update: (...args: unknown[]) => updateUser(...args)
            },
            user_preferences: { findUnique: (...args: unknown[]) => findPreference(...args) },
            $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx))
        }
    };
});

jest.mock('../../src/middleware/auth', () => ({
    createSession: (...args: unknown[]) => createSession(...args),
    deleteSession: (...args: unknown[]) => deleteSession(...args),
    deleteUserSessions: (...args: unknown[]) => deleteUserSessions(...args),
    requireAuth: (req: any, _res: any, next: any) => {
        if (authState.user) req.user = authState.user;
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next(),
    SESSION_MAX_AGE_MS: 3600000
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    CHANGE_PASSWORD_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

import authRouter from '../../src/routes/auth';
import { logger } from '../../src/utils/logger';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

const PASSWORD = 'tajne-haslo';
let passwordHash: string;

const USER_ROW = {
    id: 'u1',
    username: 'jkowalski',
    password: '',
    role: 'user',
    firstName: 'Jan',
    lastName: 'Kowalski',
    phone: '+48 600 100 200',
    email: 'jan@example.com',
    symbol: 'JK',
    subUsers: '["u2","u3"]'
};

function cookies(res: request.Response): string[] {
    const raw = res.headers['set-cookie'];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
}

beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);
    USER_ROW.password = passwordHash;
});

beforeEach(() => {
    jest.clearAllMocks();
    authState.user = { id: 'u1', username: 'jkowalski', role: 'user', subUsers: [] };
    findUser.mockResolvedValue(USER_ROW);
    createSession.mockResolvedValue('nowy-token');
    deleteSession.mockResolvedValue(undefined);
    deleteUserSessions.mockResolvedValue(2);
    updateUser.mockResolvedValue({});
    createUser.mockResolvedValue({});
    createPreference.mockResolvedValue({});
    findPreference.mockResolvedValue({ value: 'WL_WLOCLAWEK' });
});

describe('POST /api/auth/login', () => {
    it('400 przy niepoprawnym body (walidacja Zod bez zapytań do bazy)', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: 'ab' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Login musi mieć conajmniej 3 znaki');
        expect(findUser).not.toHaveBeenCalled();
    });

    it('401 dla nieznanego użytkownika', async () => {
        findUser.mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'nieznany', password: PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Nieprawidłowy login lub hasło' });
        expect(createSession).not.toHaveBeenCalled();
    });

    it('401 dla użytkownika bez hasła i dla złego hasła', async () => {
        findUser.mockResolvedValueOnce({ ...USER_ROW, password: null });

        const noPassword = await request(app)
            .post('/api/auth/login')
            .send({ username: USER_ROW.username, password: PASSWORD });
        expect(noPassword.status).toBe(401);

        findUser.mockResolvedValueOnce(USER_ROW);
        const wrong = await request(app)
            .post('/api/auth/login')
            .send({ username: USER_ROW.username, password: 'zle-haslo' });
        expect(wrong.status).toBe(401);
        expect(createSession).not.toHaveBeenCalled();
    });

    it('200 ustawia httpOnly cookie i nie zwraca tokenu w body', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: USER_ROW.username, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.user).toEqual({
            id: 'u1',
            username: 'jkowalski',
            role: 'user',
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '+48 600 100 200',
            email: 'jan@example.com',
            symbol: 'JK',
            subUsers: ['u2', 'u3']
        });
        expect(res.body.token).toBeUndefined();

        const cookie = cookies(res).find((c) => c.startsWith('authToken='));
        expect(cookie).toBeDefined();
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
        expect(cookie).toContain('Path=/');
        expect(deleteSession).not.toHaveBeenCalled();
    });

    it('ponowne logowanie kasuje sesję z cookie nadawcy', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('Cookie', ['authToken=stary-token'])
            .send({ username: USER_ROW.username, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(deleteSession).toHaveBeenCalledWith('stary-token');
        expect(createSession).toHaveBeenCalledWith('u1');
    });

    it('uszkodzony JSON subUsers daje pustą listę', async () => {
        findUser.mockResolvedValueOnce({ ...USER_ROW, subUsers: '{nie-json' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: USER_ROW.username, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.user.subUsers).toEqual([]);
    });

    it('COOKIE_SECURE=true wymusza flagę Secure', async () => {
        const previous = process.env.COOKIE_SECURE;
        process.env.COOKIE_SECURE = 'true';

        try {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: USER_ROW.username, password: PASSWORD });

            const cookie = cookies(res).find((c) => c.startsWith('authToken='));
            expect(cookie).toContain('Secure');
        } finally {
            if (previous === undefined) delete process.env.COOKIE_SECURE;
            else process.env.COOKIE_SECURE = previous;
        }
    });

    it('500 gdy baza zawiedzie — komunikat bez detali, błąd w logu', async () => {
        findUser.mockRejectedValueOnce(new Error('pg down'));

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: USER_ROW.username, password: PASSWORD });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Błąd serwera bazy danych' });
        expect(logger.error).toHaveBeenCalledWith('Auth', 'Błąd logowania', 'pg down');
    });
});

describe('POST /api/auth/register', () => {
    const body = { username: 'nowy', password: 'dlugie-haslo', role: 'pro' };

    it('409 gdy login już istnieje', async () => {
        const res = await request(app).post('/api/auth/register').send(body);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Użytkownik o takim loginie już istnieje' });
        expect(createUser).not.toHaveBeenCalled();
    });

    it('400 gdy hasło jest za krótkie', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'nowy', password: 'krótkie' });

        expect(res.status).toBe(400);
        expect(findUser).not.toHaveBeenCalled();
    });

    it('200 tworzy użytkownika z domyślnymi wartościami', async () => {
        findUser.mockResolvedValueOnce(null);

        const res = await request(app).post('/api/auth/register').send(body);

        expect(res.status).toBe(200);
        expect(createUser).toHaveBeenCalledWith({
            data: expect.objectContaining({
                username: 'nowy',
                role: 'pro',
                firstName: '',
                lastName: '',
                subUsers: '[]',
                orderStartNumber: 1,
                productionOrderStartNumber: 1
            })
        });
        const hash = (createUser.mock.calls[0][0] as { data: { password: string } }).data.password;
        expect(await bcrypt.compare('dlugie-haslo', hash)).toBe(true);
        expect(createPreference).not.toHaveBeenCalled();
        expect(res.body.user).toEqual(
            expect.objectContaining({
                username: 'nowy',
                role: 'pro',
                defaultOrganizationUnit: null
            })
        );
    });

    it('200 zapisuje jednostkę organizacyjną i subUsers', async () => {
        findUser.mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                ...body,
                subUsers: ['u2'],
                defaultOrganizationUnit: 'ASM_KLUCZBORK',
                orderStartNumber: '77',
                productionOrderStartNumber: '88'
            });

        expect(res.status).toBe(200);
        expect(createPreference).toHaveBeenCalledWith({
            data: {
                userId: expect.stringMatching(/^user_/),
                key: 'defaultOrganizationUnit',
                value: 'ASM_KLUCZBORK'
            }
        });
        expect(createUser).toHaveBeenCalledWith({
            data: expect.objectContaining({
                subUsers: '["u2"]',
                orderStartNumber: 77,
                productionOrderStartNumber: 88
            })
        });
        expect(res.body.user.defaultOrganizationUnit).toBe('ASM_KLUCZBORK');
        expect(res.body.user.subUsers).toEqual(['u2']);
    });

    it('500 gdy transakcja się nie powiedzie', async () => {
        findUser.mockResolvedValueOnce(null);
        createUser.mockRejectedValueOnce(new Error('constraint'));

        const res = await request(app).post('/api/auth/register').send(body);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Błąd serwera podczas rejestracji' });
        expect(logger.error).toHaveBeenCalledWith('auth', 'Błąd rejestracji:', 'constraint');
    });
});

describe('POST /api/auth/logout', () => {
    it('kasuje sesję i czyści cookie', async () => {
        const res = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', ['authToken=token-1']);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(deleteSession).toHaveBeenCalledWith('token-1');
        const cookie = cookies(res).find((c) => c.startsWith('authToken='));
        expect(cookie).toContain('authToken=;');
    });

    it('bez cookie nie woła bazy', async () => {
        const res = await request(app).post('/api/auth/logout');

        expect(res.status).toBe(200);
        expect(deleteSession).not.toHaveBeenCalled();
    });

    it('500 gdy usunięcie sesji zawiedzie', async () => {
        deleteSession.mockRejectedValueOnce(new Error('db'));

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', ['authToken=token-1']);

        expect(res.status).toBe(500);
        expect(logger.error).toHaveBeenCalledWith('Auth', 'Błąd wylogowania', 'db');
    });
});

describe('GET /api/auth/me', () => {
    it('zwraca użytkownika i jednostkę organizacyjną, blokuje cache', async () => {
        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(200);
        expect(res.body.user).toEqual(
            expect.objectContaining({ id: 'u1', defaultOrganizationUnit: 'WL_WLOCLAWEK' })
        );
        expect(res.headers['cache-control']).toBe('no-store');
        expect(findPreference).toHaveBeenCalledWith({
            where: { userId_key: { userId: 'u1', key: 'defaultOrganizationUnit' } },
            select: { value: true }
        });
    });

    it('nieznana jednostka daje null', async () => {
        findPreference.mockResolvedValueOnce({ value: 'NIEZNANA' });

        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(200);
        expect(res.body.user.defaultOrganizationUnit).toBeNull();
    });

    it('500 gdy odczyt preferencji zawiedzie', async () => {
        findPreference.mockRejectedValueOnce(new Error('prefs'));

        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Błąd serwera bazy danych' });
        expect(logger.error).toHaveBeenCalledWith(
            'Auth',
            'Błąd odczytu preferencji użytkownika',
            'prefs'
        );
    });
});

describe('POST /api/auth/change-password', () => {
    const body = { oldPassword: PASSWORD, newPassword: 'nowe-haslo-123' };

    it('401 gdy stare hasło jest błędne', async () => {
        const res = await request(app)
            .post('/api/auth/change-password')
            .send({ oldPassword: 'zle-haslo', newPassword: 'nowe-haslo-123' });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Nieprawidłowe stare hasło' });
        expect(updateUser).not.toHaveBeenCalled();
    });

    it('401 gdy użytkownik nie istnieje', async () => {
        findUser.mockResolvedValueOnce(null);

        const res = await request(app).post('/api/auth/change-password').send(body);

        expect(res.status).toBe(401);
    });

    it('200 zmienia hasło i unieważnia pozostałe sesje', async () => {
        const res = await request(app)
            .post('/api/auth/change-password')
            .set('Cookie', ['authToken=biezacy'])
            .send(body);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, sessionsRevoked: 2 });
        const saved = (updateUser.mock.calls[0][0] as { data: { password: string } }).data.password;
        expect(await bcrypt.compare('nowe-haslo-123', saved)).toBe(true);
        expect(deleteUserSessions).toHaveBeenCalledWith('u1', 'biezacy');
    });

    it('400 gdy nowe hasło jest za krótkie', async () => {
        const res = await request(app)
            .post('/api/auth/change-password')
            .send({ oldPassword: PASSWORD, newPassword: 'krotkie' });

        expect(res.status).toBe(400);
        expect(findUser).not.toHaveBeenCalled();
    });

    it('500 gdy zapis hasła zawiedzie', async () => {
        updateUser.mockRejectedValueOnce(new Error('write'));

        const res = await request(app).post('/api/auth/change-password').send(body);

        expect(res.status).toBe(500);
        expect(logger.error).toHaveBeenCalledWith('auth', 'Błąd zmiany hasła:', 'write');
    });
});
