import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';
import learningRoutes from '../src/routes/learningRoutes';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'test_user_id', role: 'admin' };
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const app = express();
app.use(express.json());
app.use('/api/learning', learningRoutes);

function makeDn(): number {
    return 9000 + Math.floor(Math.random() * 999);
}

describe('learningRoutes — POST /api/learning/cases', () => {
    const testDn = makeDn();

    afterEach(async () => {
        await prisma.ai_well_cases.deleteMany({ where: { dn: testDn } });
    });

    it('tworzy nowy przypadek', async () => {
        const res = await request(app)
            .post('/api/learning/cases')
            .send({ dn: testDn, totalHeightMm: 3000, wellType: 'kanalizacyjna', componentSeq: [] });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.caseId).toBe('string');
    });

    it('wymaga dn (number)', async () => {
        const res = await request(app)
            .post('/api/learning/cases')
            .send({ dn: '1200', totalHeightMm: 3000, wellType: 'test' });
        expect(res.status).toBe(400);
    });

    it('wymaga totalHeightMm (number)', async () => {
        const res = await request(app)
            .post('/api/learning/cases')
            .send({ dn: testDn, totalHeightMm: '3000', wellType: 'test' });
        expect(res.status).toBe(400);
    });

    it('wymaga wellType', async () => {
        const res = await request(app)
            .post('/api/learning/cases')
            .send({ dn: testDn, totalHeightMm: 3000 });
        expect(res.status).toBe(400);
    });
});

describe('learningRoutes — GET /api/learning/preferences', () => {
    it('zwraca PreferenceWeights dla DN', async () => {
        const res = await request(app)
            .get('/api/learning/preferences?dn=1200');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('confidence');
        expect(res.body).toHaveProperty('ringHeightBonus');
        expect(res.body).toHaveProperty('konusBonus');
        expect(res.body).toHaveProperty('profileBonuses');
        expect(res.body).toHaveProperty('avoidProductIds');
        expect(res.body).toHaveProperty('preferProductIds');
        expect(res.body).toHaveProperty('warnings');
    });

    it('wymaga dn', async () => {
        const res = await request(app)
            .get('/api/learning/preferences');
        expect(res.status).toBe(400);
    });
});

describe('learningRoutes — GET /api/learning/similar-cases', () => {
    it('zwraca tablicę items', async () => {
        const res = await request(app)
            .get('/api/learning/similar-cases?dn=1200&height=3000&wellType=kanalizacyjna');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(typeof res.body.total).toBe('number');
    });

    it('wymaga dn', async () => {
        const res = await request(app)
            .get('/api/learning/similar-cases?height=3000');
        expect(res.status).toBe(400);
    });

    it('wymaga height', async () => {
        const res = await request(app)
            .get('/api/learning/similar-cases?dn=1200');
        expect(res.status).toBe(400);
    });
});

describe('learningRoutes — GET /api/learning/patterns', () => {
    it('zwraca pattern dla DN', async () => {
        const res = await request(app)
            .get('/api/learning/patterns?dn=1200');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('totalCases');
        expect(res.body).toHaveProperty('commonProfiles');
        expect(res.body).toHaveProperty('commonTransitions');
    });

    it('wymaga dn', async () => {
        const res = await request(app)
            .get('/api/learning/patterns');
        expect(res.status).toBe(400);
    });
});
