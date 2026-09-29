import request from 'supertest';
import app from '../../src/app';

/**
 * P1-3: kontrakt bledow API.
 * Hierarchia zrodel prawdy (decyzja): business invariant -> implementation + Zod
 * -> contract tests -> OpenAPI/docs. OpenAPI NIE jest zrodlem prawdy (szkielet).
 * Ten test blokuje dryfujacy kontrakt: kazdy blad API to { error: string },
 * bez diagnostyki, bez HTML, bez pustego body.
 */
describe('P1-3 kontrakt bledow API', () => {
    it('anonimowe wywolania biznesowe zwracaja 401 + { error }', async () => {
        for (const path of [
            '/api/offers-rury/cokolwiek',
            '/api/admin/system-info',
            '/api/shares',
            '/api/locks/offer/xyz'
        ]) {
            const res = await request(app).get(path);
            expect(res.status).toBe(401);
            expect(typeof res.body.error).toBe('string');
            expect(res.body.error.length).toBeGreaterThan(0);
        }
    });

    it('anonimowy POST tez 401 + { error } (przed walidacja i baza)', async () => {
        const res = await request(app).post('/api/shares').send({});
        expect(res.status).toBe(401);
        expect(typeof res.body.error).toBe('string');
    });

    it('kontrola pozytywna: /health to nie blad i nie ma klucza error', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('error');
    });

    it('/api/docs.json istnieje i ma szkielet OpenAPI', async () => {
        const res = await request(app).get('/api/docs.json');
        expect(res.status).toBe(200);
        expect(res.body.openapi).toMatch(/^3\./);
        expect(typeof res.body.paths).toBe('object');
    });
});
