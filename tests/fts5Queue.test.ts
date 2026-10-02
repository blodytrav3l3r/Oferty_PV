/**
 * B1: kolejka FTS w tle — eventual consistency na realnej izolowanej DB.
 * - enqueue sync → drain → wpis w FTS (inSync);
 * - enqueue remove → drain → wpis znika;
 * - crash (wiersz bez wpisu = utracona kolejka) → reconcile dobudowuje;
 * - metryki queued/done.
 */
import {
    enqueueFtsSync,
    enqueueFtsRemove,
    drainFtsQueue,
    reconcileFts5,
    getFtsQueueMetrics
} from '../src/utils/fts5Queue';
import { ensureFts5Schema, ftsSyncStatus } from '../src/utils/fts5Sync';
import prisma from '../src/prismaClient';

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const oid = (s: string) => `fts_q_${Date.now()}_${s}`;

beforeAll(async () => {
    await ensureFts5Schema();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('B1 fts5Queue', () => {
    test('enqueue sync → drain → inSync', async () => {
        const id = oid('a');
        await prisma.offers_rel.create({ data: { id, clientName: 'QueueTestowie' } });
        enqueueFtsSync('rury', {
            id,
            offer_number: null,
            clientName: 'QueueTestowie',
            investName: null
        });
        expect(await drainFtsQueue()).toBe(true);
        const rows = (await prisma.$queryRawUnsafe(
            'SELECT id FROM offers_search_fts WHERE id = ?',
            id
        )) as Array<{ id: string }>;
        expect(rows.map((r) => r.id)).toContain(id);
        const m = getFtsQueueMetrics();
        expect(m.done).toBeGreaterThanOrEqual(1);
    });

    test('enqueue remove → drain → wpis znika (LIKE-fallback nadal widzi ofertę)', async () => {
        const id = oid('b');
        await prisma.offers_rel.create({ data: { id, clientName: 'RemoveMe' } });
        enqueueFtsSync('rury', {
            id,
            offer_number: null,
            clientName: 'RemoveMe',
            investName: null
        });
        expect(await drainFtsQueue()).toBe(true);
        enqueueFtsRemove('rury', id);
        expect(await drainFtsQueue()).toBe(true);
        const rows = (await prisma.$queryRawUnsafe(
            'SELECT id FROM offers_search_fts WHERE id = ?',
            id
        )) as Array<{ id: string }>;
        expect(rows).toHaveLength(0);
        // Wiersz biznesowy nietknięty — search LIKE go znajdzie.
        expect(await prisma.offers_rel.findUnique({ where: { id } })).not.toBeNull();
    });

    test('crash: wiersz bez wpisu → reconcile dobudowuje (restart recovery)', async () => {
        const id = oid('c');
        await prisma.offers_rel.create({ data: { id, clientName: 'CrashSim' } });
        // Bez enqueue — symulacja utraconej kolejki in-memory.
        const fixed = await reconcileFts5();
        expect(fixed).toBeGreaterThanOrEqual(1);
        const status = await ftsSyncStatus();
        expect(status.missingIds.find((x) => x.id === id)).toBeUndefined();
    });
});
