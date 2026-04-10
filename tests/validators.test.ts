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
    it('should accept valid login data', () => {
        const result = loginSchema.safeParse({ username: 'admin', password: 'admin123' });
        expect(result.success).toBe(true);
    });

    it('should reject missing username', () => {
        const result = loginSchema.safeParse({ password: 'admin123' });
        expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
        const result = loginSchema.safeParse({ username: 'admin' });
        expect(result.success).toBe(false);
    });

    it('should reject empty body', () => {
        const result = loginSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('should reject username shorter than 3 chars', () => {
        const result = loginSchema.safeParse({ username: 'ab', password: 'test123' });
        expect(result.success).toBe(false);
    });

    it('should reject password shorter than 4 chars', () => {
        const result = loginSchema.safeParse({ username: 'admin', password: 'abc' });
        expect(result.success).toBe(false);
    });

    it('should accept exact minimum lengths', () => {
        const result = loginSchema.safeParse({ username: 'abc', password: 'abcd' });
        expect(result.success).toBe(true);
    });
});

// ─── changePasswordSchema ───────────────────────────────────────────

describe('changePasswordSchema', () => {
    it('should accept valid password change data', () => {
        const result = changePasswordSchema.safeParse({
            oldPassword: 'old123',
            newPassword: 'newPass123'
        });
        expect(result.success).toBe(true);
    });

    it('should reject missing oldPassword', () => {
        const result = changePasswordSchema.safeParse({ newPassword: 'newPass123' });
        expect(result.success).toBe(false);
    });

    it('should reject missing newPassword', () => {
        const result = changePasswordSchema.safeParse({ oldPassword: 'old123' });
        expect(result.success).toBe(false);
    });

    it('should reject newPassword shorter than 6 chars', () => {
        const result = changePasswordSchema.safeParse({
            oldPassword: 'old123',
            newPassword: '12345'
        });
        expect(result.success).toBe(false);
    });
});

// ─── registerSchema ─────────────────────────────────────────────────

describe('registerSchema', () => {
    it('should accept full valid registration', () => {
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

    it('should accept minimal registration (only username + password)', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123'
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            role: 'superadmin'
        });
        expect(result.success).toBe(false);
    });

    it('should accept all valid roles', () => {
        for (const role of ['admin', 'user', 'pro']) {
            const result = registerSchema.safeParse({
                username: 'testuser',
                password: 'secret123',
                role
            });
            expect(result.success).toBe(true);
        }
    });

    it('should reject invalid email format', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            email: 'not-an-email'
        });
        expect(result.success).toBe(false);
    });

    it('should accept empty string as email', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            email: ''
        });
        expect(result.success).toBe(true);
    });

    it('should accept subUsers array', () => {
        const result = registerSchema.safeParse({
            username: 'prouser',
            password: 'secret123',
            subUsers: ['user1', 'user2']
        });
        expect(result.success).toBe(true);
    });

    it('should accept numeric orderStartNumber', () => {
        const result = registerSchema.safeParse({
            username: 'newuser',
            password: 'secret123',
            orderStartNumber: 100
        });
        expect(result.success).toBe(true);
    });

    it('should accept string orderStartNumber', () => {
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

    it('should pass valid data through', async () => {
        const res = await request(app)
            .post('/test')
            .send({ username: 'admin', password: 'admin123' });

        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('should return 400 for invalid data', async () => {
        const res = await request(app).post('/test').send({ username: 'a' });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Błąd walidacji danych wejściowych');
        expect(res.body.details).toBeDefined();
        expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should return 400 for empty body', async () => {
        const res = await request(app).post('/test').send({});

        expect(res.statusCode).toBe(400);
    });
});
