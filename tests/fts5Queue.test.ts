/**
 * B1: indeks GIN PostgreSQL — wpisy zmieniają się atomowo wraz z ofertą.
 * - enqueue/drain zachowuje stan indeksu;
 * - usunięcie oferty usuwa ją również z indeksu;
 * - reconcile potwierdza brak utraconej kolejki;
 * - metryki queued/done pozostają widoczne.
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

describe('B1 PostgreSQL search index queue compatibility', () => {
    test('enqueue sync → drain → indeks GIN pozostaje gotowy', async () => {
        const id = oid('a');
        await prisma.offers_rel.create({ data: { id, clientName: 'QueueTestowie' } });
        enqueueFtsSync('rury', {
            id,
            offer_number: null,
            clientName: 'QueueTestowie',
            investName: null
        });
        expect(await drainFtsQueue()).toBe(true);
        const status = await ftsSyncStatus();
        expect(status.inSync).toBe(true);
        expect(status.tables.rury.offers).toBeGreaterThanOrEqual(1);
        const m = getFtsQueueMetrics();
        expect(m.done).toBeGreaterThanOrEqual(1);
    });

    test('usunięcie oferty po drain usuwa ją atomowo z indeksu GIN', async () => {
        const id = oid('b');
        await prisma.offers_rel.create({ data: { id, clientName: 'RemoveMe' } });
        enqueueFtsSync('rury', {
            id,
            offer_number: null,
            clientName: 'RemoveMe',
            investName: null
        });
        expect(await drainFtsQueue()).toBe(true);
        await prisma.offers_rel.delete({ where: { id } });
        enqueueFtsRemove('rury', id);
        expect(await drainFtsQueue()).toBe(true);
        expect(await prisma.offers_rel.findUnique({ where: { id } })).toBeNull();
        expect((await ftsSyncStatus()).inSync).toBe(true);
    });

    test('GIN indeksuje nową ofertę transakcyjnie, reconcile nie wymaga odbudowy', async () => {
        const id = oid('c');
        await prisma.offers_rel.create({ data: { id, clientName: 'CrashSim' } });
        // Bez enqueue — PostgreSQL GIN musi już zawierać ofertę po INSERT.
        const fixed = await reconcileFts5();
        expect(fixed).toBe(0);
        const status = await ftsSyncStatus();
        expect(status.missingIds.find((x) => x.id === id)).toBeUndefined();
    });
});
