import express from 'express';
import request from 'supertest';
import prisma from '../../src/prismaClient';
import searchRoutes from '../../src/routes/offers/search';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: import('express').Request, _res: unknown, next: () => void) => {
        Object.assign(req, { user: { id: 'cursor-test-user', role: 'admin' } });
        next();
    }
}));

const app = express();
app.use('/api/offers/search', searchRoutes);
const marker = 'cursorregression';

beforeAll(async () => {
    await prisma.offers_rel.createMany({
        data: [
            { id: 'cursor-a', createdAt: '2026-11-03T00:00:00Z', offer_number: 'A' },
            { id: 'cursor-b', createdAt: '1793491200000', offer_number: 'B' },
            { id: 'cursor-tie', createdAt: '2026-11-02T00:00:00Z', offer_number: 'C' },
            { id: 'cursor-empty', createdAt: '2026-02-31', offer_number: null }
        ].map((row) => ({ ...row, clientName: marker, data: '{}' }))
    });
    await prisma.offers_studnie_rel.create({
        data: {
            id: 'cursor-tie',
            createdAt: '2026-11-02T00:00:00Z',
            offer_number: 'C',
            clientName: marker,
            data: '{}'
        }
    });
});

afterAll(async () => {
    await prisma.offers_rel.deleteMany({ where: { clientName: marker } });
    await prisma.offers_studnie_rel.deleteMany({ where: { clientName: marker } });
    await prisma.$disconnect();
});

async function walkPages(sort: string, order: string): Promise<string[]> {
    const result: string[] = [];
    let cursor = {};
    for (let page = 0; page < 6; page++) {
        const response = await request(app)
            .get('/api/offers/search')
            .query({
                q: marker,
                sort,
                order,
                limit: 1,
                ...cursor
            });
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        result.push(`${response.body.nextCursorType ?? 'last'}/${response.body.data[0].id}`);
        if (!response.body.hasMore) return result;
        cursor = {
            cursor: response.body.nextCursor,
            cursorId: response.body.nextCursorId,
            cursorType: response.body.nextCursorType
        };
    }
    throw new Error('Search did not reach the end of its cursor pages');
}

test('paginates PostgreSQL by offer number, including null and identical cross-table keys', async () => {
    expect(await walkPages('offer_number', 'asc')).toEqual([
        'rury/cursor-empty',
        'rury/cursor-a',
        'rury/cursor-b',
        'rury/cursor-tie',
        'last/cursor-tie'
    ]);
    expect(await walkPages('offer_number', 'desc')).toEqual([
        'studnie/cursor-tie',
        'rury/cursor-tie',
        'rury/cursor-b',
        'rury/cursor-a',
        'last/cursor-empty'
    ]);
});

test('normalizes epoch dates and keeps malformed historical dates out of date filters', async () => {
    expect(await walkPages('createdAt', 'desc')).toEqual([
        'rury/cursor-a',
        'studnie/cursor-tie',
        'rury/cursor-tie',
        'rury/cursor-b',
        'last/cursor-empty'
    ]);
    const response = await request(app).get('/api/offers/search').query({
        q: marker,
        dateFrom: '2026-01-01'
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(4);
});
