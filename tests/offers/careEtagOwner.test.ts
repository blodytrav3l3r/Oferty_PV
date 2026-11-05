/* Owner changes, shares and in-place edits invalidate PostgreSQL care snapshots. */
import prisma from '../../src/prismaClient';
import { Prisma } from '../../generated/prisma-postgres/client';
import {
    buildCareQueueQueries,
    getCareEtagInput,
    getCareQueue,
    getCareSummary,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T00:00:00.000Z';
const T0 = '2026-10-01T00:00:00.000Z';
const T1 = '2099-10-11T00:00:00.000Z';
const testId = `care-owner-${process.pid}-${Date.now()}`;
const user1 = `${testId}-u1`;
const user2 = `${testId}-u2`;
const adminId = `${testId}-admin`;
const offer1 = `${testId}-o1`;
const U1: CareUser = { id: user1, role: 'user', subUsers: [] };
const U2: CareUser = { id: user2, role: 'user', subUsers: [] };
const ADMIN: CareUser = { id: adminId, role: 'admin', subUsers: [] };

async function seed(): Promise<void> {
    await prisma.offers_rel.create({
        data: { id: offer1, userId: user1, createdAt: T0, updatedAt: T0 }
    });
    await prisma.offer_follow_ups.create({
        data: {
            id: `${testId}-f1`,
            offerKind: 'rury',
            offerId: offer1,
            createdByUserId: user1,
            contactedAt: T0,
            createdAt: T0,
            updatedAt: T0,
            channel: 'PHONE',
            result: 'CONTACTED',
            outcome: 'OPEN'
        }
    });
}

async function cleanup(): Promise<void> {
    await prisma.document_shares.deleteMany({ where: { id: { startsWith: testId } } });
    await prisma.care_states.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.care_notifications.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.offer_follow_ups.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.offers_rel.deleteMany({ where: { id: { startsWith: testId } } });
}

async function queueIds(user: CareUser): Promise<string[]> {
    const result = await getCareQueue(prisma, user, { nowIso: NOW });
    return result.items.map((item) => `${item.offerKind}:${item.offerId}`);
}

describe('ETag panelu a zmiana opiekuna (PostgreSQL)', () => {
    beforeEach(seed);
    afterEach(cleanup);

    it('widoczność idzie za właścicielem po userId, nie po autorze', async () => {
        expect(await queueIds(U1)).toEqual([`rury:${offer1}`]);
        expect(await queueIds(U2)).toEqual([]);
        await prisma.offers_rel.update({
            where: { id: offer1 },
            data: { userId: user2, updatedAt: T1 }
        });
        expect(await queueIds(U2)).toEqual([`rury:${offer1}`]);
        expect(await queueIds(U1)).toEqual([]);
    });

    it('assign zmienia wejście ETag (brak wiecznego 304)', async () => {
        const before = await getCareEtagInput(prisma, user1);
        await prisma.offers_rel.update({
            where: { id: offer1 },
            data: { userId: user2, updatedAt: T1 }
        });
        const after = await getCareEtagInput(prisma, user1);
        expect(after).not.toEqual(before);
    });

    it('nadanie i cofnięcie shares zmienia wejście ETag i widoczność', async () => {
        const before = await getCareEtagInput(prisma, user2);
        await prisma.document_shares.create({
            data: {
                id: `${testId}-share`,
                documentType: 'offer',
                documentId: offer1,
                ownerId: user1,
                sharedWithUserId: user2,
                createdAt: T1,
                createdBy: user1
            }
        });
        const after = await getCareEtagInput(prisma, user2);
        expect(after).not.toEqual(before);
        expect(await queueIds(U2)).toEqual([`rury:${offer1}`]);
        await prisma.document_shares.delete({ where: { id: `${testId}-share` } });
        expect(await getCareEtagInput(prisma, user2)).not.toEqual(after);
        expect(await queueIds(U2)).toEqual([]);
    });

    it('scope=all + repOwner filtruje do ofert repa', async () => {
        const otherOffer = `${testId}-o2`;
        await prisma.offers_rel.create({ data: { id: otherOffer, userId: user2, createdAt: T0 } });
        await prisma.offer_follow_ups.create({
            data: {
                id: `${testId}-f2`,
                offerKind: 'rury',
                offerId: otherOffer,
                createdByUserId: user2,
                contactedAt: T0,
                createdAt: T0,
                channel: 'PHONE',
                result: 'CONTACTED',
                outcome: 'OPEN'
            }
        });
        const { data } = buildCareQueueQueries(ADMIN, {
            nowIso: NOW,
            scope: 'all',
            repOwner: user1
        });
        const rows = await prisma.$queryRaw<Array<{ offerId: string }>>(data as Prisma.Sql);
        expect(rows.map((row) => row.offerId)).toEqual([offer1]);
    });

    it('hidePaused ma zgodne liczniki w summary i kolejce', async () => {
        await prisma.care_states.create({
            data: {
                offerKind: 'rury',
                offerId: offer1,
                doneAt: NOW,
                updatedBy: user1,
                updatedAt: NOW
            }
        });
        const summary = await getCareSummary(prisma, U1, 'mine', NOW, {});
        const queue = await getCareQueue(prisma, U1, { nowIso: NOW });
        expect(summary.totalCount).toBe(1);
        expect(queue.totalCount).toBe(1);
        const hiddenSummary = await getCareSummary(prisma, U1, 'mine', NOW, { hidePaused: true });
        const hiddenQueue = await getCareQueue(prisma, U1, { nowIso: NOW, hidePaused: true });
        expect(hiddenSummary.totalCount).toBe(0);
        expect(hiddenQueue.totalCount).toBe(0);
    });

    it('edycja w miejscu zmienia ETag przez marker updatedAt', async () => {
        const before = await getCareEtagInput(prisma, user1);
        expect(await getCareEtagInput(prisma, user1)).toEqual(before);
        await prisma.offer_follow_ups.update({
            where: { id: `${testId}-f1` },
            data: { note: 'poprawiona notatka', outcome: 'WON', updatedAt: T1 }
        });
        const after = await getCareEtagInput(prisma, user1);
        expect(after).not.toEqual(before);
        expect(after[after.length - 1]).toBe(T1);
    });
});
