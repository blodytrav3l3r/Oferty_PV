/* Set-based care notification sync load, idempotence and concurrency on PostgreSQL. */
import prisma from '../../src/prismaClient';
import {
    syncCareNotifications,
    resetCareSyncThrottleForTests,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const NOW2 = '2026-10-10T12:01:00.000Z';
const NOW3 = '2026-10-10T12:02:00.000Z';
const testId = `care-sync-load-${process.pid}-${Date.now()}`;
const userId = `${testId}-user`;
const U1: CareUser = { id: userId, role: 'user', subUsers: [] };
const SLA = { firstContactH: 24, staleD: 7, escalationH: 72 };
const N = 400;

async function seed(): Promise<void> {
    await prisma.offers_rel.createMany({
        data: Array.from({ length: N }, (_, index) => ({
            id: `${testId}-offer-${index}`,
            userId,
            createdAt: '2026-09-01T00:00:00.000Z'
        }))
    });
    await prisma.offer_follow_ups.createMany({
        data: Array.from({ length: N / 2 }, (_, index) => {
            const offerIndex = index * 2;
            return {
                id: `${testId}-followup-${offerIndex}`,
                offerKind: 'rury',
                offerId: `${testId}-offer-${offerIndex}`,
                createdByUserId: userId,
                contactedAt: '2026-09-30T10:00:00.000Z',
                createdAt: '2026-09-30T10:00:00.000Z',
                outcome: 'OPEN',
                channel: 'PHONE' as const,
                result: 'CONTACTED' as const,
                nextContactAt: '2026-09-30T10:00:00.000Z'
            };
        })
    });
}

async function cleanup(): Promise<void> {
    await prisma.care_notifications.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.offer_follow_ups.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.offers_rel.deleteMany({ where: { id: { startsWith: testId } } });
}

function countedDb(counter: { statements: number }) {
    return {
        $queryRaw: <T>(query: Parameters<typeof prisma.$queryRaw>[0]) => {
            counter.statements += 1;
            return prisma.$queryRaw<T>(query);
        }
    };
}

beforeEach(() => resetCareSyncThrottleForTests());
afterEach(cleanup);

describe('P0+P1: sync 400 ofert set-based (PostgreSQL)', () => {
    it('inserted=N, rerun=0, stała liczba statementów', async () => {
        await seed();
        const counter = { statements: 0 };
        const db = countedDb(counter);
        const first = await syncCareNotifications(db, U1, 'mine', NOW, SLA);
        expect(first.inserted).toBe(N);
        expect(counter.statements).toBeLessThanOrEqual(8);

        const beforeRerun = counter.statements;
        const second = await syncCareNotifications(db, U1, 'mine', NOW2, SLA);
        expect(second.inserted).toBe(0);
        expect(counter.statements - beforeRerun).toBeLessThanOrEqual(8);
    }, 120000);

    it('wyścig dwóch synców: suma inserted=N, brak błędów i duplikatów', async () => {
        await seed();
        const db = {
            $queryRaw: <T>(query: Parameters<typeof prisma.$queryRaw>[0]) =>
                prisma.$queryRaw<T>(query)
        };
        const [first, second] = await Promise.all([
            syncCareNotifications(db, U1, 'mine', NOW2, SLA),
            syncCareNotifications(db, U1, 'mine', NOW3, SLA)
        ]);
        expect(first.inserted + second.inserted).toBe(N);
        expect(
            await prisma.care_notifications.count({
                where: { userId, readAt: null, offerId: { startsWith: testId } }
            })
        ).toBe(N);
    }, 120000);
});

describe('P0.3: throttle syncu per skrzynka (PostgreSQL)', () => {
    it('natychmiastowy rerun: skip bez statementów (throttled)', async () => {
        await seed();
        const counter = { statements: 0 };
        const db = countedDb(counter);
        const first = await syncCareNotifications(db, U1, 'mine', NOW, SLA);
        expect(first.inserted).toBe(N);
        expect(first.skipped).toBeUndefined();
        const beforeRerun = counter.statements;
        const second = await syncCareNotifications(db, U1, 'mine', NOW2, SLA);
        expect(second.inserted).toBe(0);
        expect(second.skipped).toBe('throttled');
        expect(counter.statements - beforeRerun).toBe(0);
    }, 120000);

    it('degraded run (błędy wewnątrz) też stempluje: rerun to skip', async () => {
        await seed();
        const counter = { statements: 0 };
        const db = {
            $queryRaw: <T>(query: Parameters<typeof prisma.$queryRaw>[0]) => {
                counter.statements += 1;
                if (counter.statements === 1) return Promise.reject(new Error('boom'));
                return prisma.$queryRaw<T>(query);
            }
        };
        const first = await syncCareNotifications(db, U1, 'mine', NOW, SLA);
        expect(first.inserted).toBe(0);
        expect(first.skipped).toBeUndefined();
        const beforeRerun = counter.statements;
        const second = await syncCareNotifications(db, U1, 'mine', NOW2, SLA);
        expect(second.skipped).toBe('throttled');
        expect(counter.statements - beforeRerun).toBe(0);
    }, 120000);

    it('współbieżne synci: drugi czeka i dostaje skip, suma inserted=N', async () => {
        await seed();
        const db = {
            $queryRaw: <T>(query: Parameters<typeof prisma.$queryRaw>[0]) =>
                prisma.$queryRaw<T>(query)
        };
        const [first, second] = await Promise.all([
            syncCareNotifications(db, U1, 'mine', NOW2, SLA),
            syncCareNotifications(db, U1, 'mine', NOW3, SLA)
        ]);
        expect(first.inserted + second.inserted).toBe(N);
        expect(
            await prisma.care_notifications.count({
                where: { userId, readAt: null, offerId: { startsWith: testId } }
            })
        ).toBe(N);
    }, 120000);
});
