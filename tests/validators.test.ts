import {
    loginSchema,
    changePasswordSchema,
    registerSchema,
    validateData
} from '../src/validators/authSchema';
import express from 'express';
import request from 'supertest';

// ─── loginSchema ────────────────────────────────────────────────────

describe('loginSchema', () => {
    it('powinien akceptować prawidłowe dane logowania', () => {
        const result = loginSchema.safeParse({ username: 'admin', password: 'admin123' });
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać brakujący login', () => {
        const result = loginSchema.safeParse({ password: 'admin123' });
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać brakujące hasło', () => {
        const result = loginSchema.safeParse({ username: 'admin' });
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać pusty body', () => {
        const result = loginSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać login krótszy niż 3 znaki', () => {
        const result = loginSchema.safeParse({ username: 'ab', password: 'test123' });
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać hasło krótsze niż 4 znaki', () => {
        const result = loginSchema.safeParse({ username: 'admin', password: 'abc' });
        expect(result.success).toBe(false);
    });

    it('powinien akceptować dane o dokładnie minimalnej wymaganej długości', () => {
        const result = loginSchema.safeParse({ username: 'abc', password: 'abcd' });
        expect(result.success).toBe(true);
    });
});

// ─── changePasswordSchema ───────────────────────────────────────────

describe('changePasswordSchema', () => {
    it('powinien akceptować prawidłowe dane zmiany hasła', () => {
        const result = changePasswordSchema.safeParse({
            oldPassword: 'old123',
            newPassword: 'newPass123'
        });
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać brakujące stare hasło', () => {
        const result = changePasswordSchema.safeParse({ newPassword: 'newPass123' });
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać brakujące nowe hasło', () => {
        const result = changePasswordSchema.safeParse({ oldPassword: 'old123' });
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać nowe hasło krótsze niż 6 znaków', () => {
        const result = changePasswordSchema.safeParse({
            oldPassword: 'old123',
            newPassword: '12345'
        });
        expect(result.success).toBe(false);
    });
});

// ─── registerSchema ─────────────────────────────────────────────────

describe('registerSchema', () => {
    it('powinien akceptować pełną prawidłową rejestrację', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            role: 'user',
            firstName: 'Jan',
            lastName: 'Kowalski',
            email: 'jan@example.com',
            phone: '123456789',
            symbol: 'JK'
        });
        expect(result.success).toBe(true);
    });

    it('powinien akceptować minimalną rejestrację (tylko login i hasło)', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123'
        });
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać nieprawidłową rolę', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            role: 'superadmin'
        });
        expect(result.success).toBe(false);
    });

    it('powinien akceptować wszystkie prawidłowe role', () => {
        for (const role of ['admin', 'user', 'pro']) {
            const result = registerSchema.safeParse({
                username: 'testuser',
                password: 'secret123',
                role
            });
            expect(result.success).toBe(true);
        }
    });

    it('powinien odrzucać nieprawidłowy format email', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            email: 'not-an-email'
        });
        expect(result.success).toBe(false);
    });

    it('powinien akceptować pusty ciąg jako email', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            email: ''
        });
        expect(result.success).toBe(true);
    });

    it('powinien akceptować tablicę subUsers', () => {
        const result = registerSchema.safeParse({
            username: 'prouser',
            password: 'secret123',
            subUsers: ['user1', 'user2']
        });
        expect(result.success).toBe(true);
    });

    it('powinien akceptować liczbowy orderStartNumber', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            orderStartNumber: 100
        });
        expect(result.success).toBe(true);
    });

    it('powinien akceptować ciąg znaków jako orderStartNumber', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            orderStartNumber: '100'
        });
        expect(result.success).toBe(true);
    });
});

// ─── validateData middleware ────────────────────────────────────────

describe('validateData middleware', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.post('/test', validateData(loginSchema), (_req, res) => {
            res.json({ ok: true });
        });
    });

    it('powinien przepuszczać prawidłowe dane', async () => {
        const res = await request(app)
            .post('/test')
            .send({ username: 'admin', password: 'admin123' });

        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('powinien zwracać 400 dla nieprawidłowych danych', async () => {
        const res = await request(app).post('/test').send({ username: 'a' });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBeDefined();
        expect(res.body.details).toBeDefined();
        expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('powinien zwracać 400 dla pustego body', async () => {
        const res = await request(app).post('/test').send({});

        expect(res.statusCode).toBe(400);
    });
});
