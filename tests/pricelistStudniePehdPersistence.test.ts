import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Client } from 'pg';
import request from 'supertest';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'pehd-persistence-test', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    PRICELIST_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

describe('zapis dopłaty PEHD w cenniku studni', () => {
    let app: express.Application;
    let prisma: typeof import('../src/prismaClient').default;
    let testSchema: string;
    let baseDatabaseUrl: URL;

    beforeAll(async () => {
        baseDatabaseUrl = new URL(process.env.DATABASE_URL ?? '');
        testSchema = `sok_pehd_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;

        const db = new Client({ connectionString: baseDatabaseUrl.toString() });
        await db.connect();
        try {
            await db.query(`CREATE SCHEMA "${testSchema}"`);
        } finally {
            await db.end();
        }

        const isolatedDatabaseUrl = new URL(baseDatabaseUrl);
        isolatedDatabaseUrl.searchParams.set('schema', testSchema);
        process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
        execFileSync(
            process.execPath,
            [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
            {
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    DATABASE_URL: isolatedDatabaseUrl.toString(),
                    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1'
                },
                stdio: 'inherit',
                timeout: 120_000
            }
        );

        prisma = (await import('../src/prismaClient')).default;
        const { default: studnieRouter } = await import('../src/routes/productsStudnieV2');
        app = express();
        app.use(express.json());
        app.use('/api/products-studnie', studnieRouter);
    });

    afterAll(async () => {
        if (prisma) await prisma.$disconnect();
        if (!testSchema || !baseDatabaseUrl) return;

        const db = new Client({ connectionString: baseDatabaseUrl.toString() });
        await db.connect();
        try {
            await db.query(`DROP SCHEMA "${testSchema}" CASCADE`);
        } finally {
            await db.end();
        }
    });

    it('odczytuje po ponownym GET kwotę PEHD zapisaną przez PUT', async () => {
        const putResponse = await request(app)
            .put('/api/products-studnie')
            .send({
                pehdPricePerM2: 300,
                data: [
                    {
                        id: 'pehd-persistence-roundtrip',
                        name: 'Testowa wkładka PEHD',
                        category: 'Test',
                        componentType: 'krag',
                        price: 100,
                        area: 1.25,
                        doplataPEHD: 510
                    }
                ]
            });

        expect(putResponse.status).toBe(200);
        expect(putResponse.body).toMatchObject({ ok: true, target: 'draft' });

        const getResponse = await request(app).get('/api/products-studnie');

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.pehdPricePerM2).toBe(300);
        expect(getResponse.body.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'pehd-persistence-roundtrip',
                    area: 1.25,
                    doplataPEHD: 510
                })
            ])
        );
    });

    it('zapisuje dokładną stawkę przy edycji zatwierdzonej wersji', async () => {
        const versionId = 'pehd-approved-version';
        const sha256 = 'a'.repeat(64);
        const now = new Date().toISOString();
        await prisma.pricelistVersion.create({
            data: {
                id: versionId,
                type: 'studnie',
                seq: 2,
                version: 'Sv2-pehd-test',
                status: 'APPROVED',
                effectiveFrom: now,
                sha256,
                createdAt: now,
                updatedAt: now
            }
        });

        const putResponse = await request(app)
            .put('/api/products-studnie')
            .set('X-Pricelist-Version-Id', versionId)
            .set('If-Match', `"${sha256}"`)
            .send({
                pehdPricePerM2: 300,
                data: [
                    {
                        id: 'pehd-approved-roundtrip',
                        name: 'Testowa wkładka PEHD',
                        category: 'Test',
                        componentType: 'krag',
                        price: 100,
                        area: 1.25,
                        doplataPEHD: 375
                    }
                ]
            });

        expect(putResponse.status).toBe(200);
        expect(putResponse.body).toMatchObject({ target: 'version', pehdPricePerM2: 300 });

        const getResponse = await request(app).get('/api/products-studnie?source=active');

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.pehdPricePerM2).toBe(300);
    });
});
