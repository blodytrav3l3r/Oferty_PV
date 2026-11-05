/* P0.2 ETag invalidation matrix, executed against PostgreSQL. */
import prisma from '../../src/prismaClient';
import { getCareEtagInput } from '../../src/services/careService';

const T0 = '2026-10-01T00:00:00.000Z';
const T1 = '2027-01-01T00:00:00.000Z';
const testId = `care-etag-${process.pid}-${Date.now()}`;
const userId = `${testId}-user`;
const ruryId = `${testId}-rury`;
const studnieId = `${testId}-studnie`;

async function seed(): Promise<void> {
    await prisma.offers_rel.create({ data: { id: ruryId, userId, createdAt: T0, updatedAt: T0 } });
    await prisma.offers_studnie_rel.create({
        data: { id: studnieId, userId, createdAt: T0, updatedAt: T0 }
    });
    await prisma.offer_follow_ups.create({
        data: {
            id: `${testId}-fu1`,
            offerKind: 'rury',
            offerId: ruryId,
            createdByUserId: userId,
            contactedAt: T0,
            createdAt: T0,
            updatedAt: T0,
            channel: 'PHONE',
            result: 'CONTACTED'
        }
    });
    await prisma.care_sla_config.upsert({
        where: { id: 'global' },
        create: { id: 'global', updatedAt: T0 },
        update: { updatedAt: T0 }
    });
}

async function cleanup(): Promise<void> {
    await prisma.document_shares.deleteMany({ where: { id: { startsWith: testId } } });
    await prisma.care_notifications.deleteMany({ where: { id: { startsWith: testId } } });
    await prisma.care_states.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.offer_follow_ups.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.offers_rel.deleteMany({ where: { id: { startsWith: testId } } });
    await prisma.offers_studnie_rel.deleteMany({ where: { id: { startsWith: testId } } });
    await prisma.care_sla_config.deleteMany({ where: { id: 'global' } });
}

describe('P0.2: macierz unieważnień ETag (PostgreSQL)', () => {
    beforeEach(seed);
    afterEach(cleanup);

    it('nowy follow-up rusza a/b/m, reszta stoi', async () => {
        const before = await getCareEtagInput(prisma, userId);
        await prisma.offer_follow_ups.create({
            data: {
                id: `${testId}-fu2`,
                offerKind: 'rury',
                offerId: ruryId,
                createdByUserId: userId,
                contactedAt: T1,
                createdAt: T1,
                updatedAt: T1,
                channel: 'PHONE',
                result: 'CONTACTED'
            }
        });
        const after = await getCareEtagInput(prisma, userId);
        expect(after[0]).not.toBe(before[0]);
        expect(after[1]).not.toBe(before[1]);
        expect(after[12]).not.toBe(before[12]);
        for (const index of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
            expect(after[index]).toBe(before[index]);
    });

    it('snooze/done (care_states) rusza tylko c', async () => {
        const before = await getCareEtagInput(prisma, userId);
        await prisma.care_states.create({
            data: { offerKind: 'rury', offerId: ruryId, updatedAt: T1 }
        });
        const after = await getCareEtagInput(prisma, userId);
        expect(after[2]).not.toBe(before[2]);
        for (const index of [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
            expect(after[index]).toBe(before[index]);
    });

    it('sync insert (d) i odczyt (e) ruszają markery skrzynki', async () => {
        const before = await getCareEtagInput(prisma, userId);
        await prisma.care_notifications.create({
            data: {
                id: `${testId}-n1`,
                userId,
                offerKind: 'rury',
                offerId: ruryId,
                type: 'SLA_BREACH',
                createdAt: T1
            }
        });
        const mid = await getCareEtagInput(prisma, userId);
        expect(mid[3]).not.toBe(before[3]);
        await prisma.care_notifications.update({
            where: { id: `${testId}-n1` },
            data: { readAt: '2027-01-02T00:00:00.000Z' }
        });
        const after = await getCareEtagInput(prisma, userId);
        expect(after[4]).not.toBe(mid[4]);
    });

    it('cudzy odczyt nie rusza mojego e', async () => {
        const otherUserId = `${testId}-other`;
        await prisma.care_notifications.create({
            data: {
                id: `${testId}-n9`,
                userId: otherUserId,
                offerKind: 'rury',
                offerId: ruryId,
                type: 'SLA_BREACH',
                createdAt: T1
            }
        });
        const before = await getCareEtagInput(prisma, userId);
        await prisma.care_notifications.update({
            where: { id: `${testId}-n9` },
            data: { readAt: '2027-01-02T00:00:00.000Z' }
        });
        const after = await getCareEtagInput(prisma, userId);
        expect(after[4]).toBe(before[4]);
    });

    it('nowa oferta (f), edycja oferty (j), share (l), SLA (h) ruszają swoje markery', async () => {
        const before = await getCareEtagInput(prisma, userId);
        await prisma.offers_rel.create({
            data: { id: `${testId}-new`, createdAt: T1, updatedAt: T1 }
        });
        await prisma.offers_rel.update({ where: { id: ruryId }, data: { updatedAt: T1 } });
        await prisma.document_shares.create({
            data: {
                id: `${testId}-share`,
                documentType: 'offer',
                documentId: ruryId,
                ownerId: userId,
                sharedWithUserId: userId,
                createdAt: T1,
                createdBy: userId
            }
        });
        await prisma.care_sla_config.update({ where: { id: 'global' }, data: { updatedAt: T1 } });
        const after = await getCareEtagInput(prisma, userId);
        expect(after[5]).not.toBe(before[5]);
        expect(after[9]).not.toBe(before[9]);
        expect(after[11]).not.toBe(before[11]);
        expect(after[7]).not.toBe(before[7]);
    });
});
