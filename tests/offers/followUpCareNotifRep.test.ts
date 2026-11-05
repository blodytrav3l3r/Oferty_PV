/* Rep-owner preview does not mutate viewer notification mailbox. */
import prisma from '../../src/prismaClient';
import {
    syncCareNotifications,
    listCareNotifications,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const testId = `care-notif-rep-${process.pid}-${Date.now()}`;
const viewerId = `${testId}-viewer`;
const repId = `${testId}-rep`;
const offerId = `${testId}-offer`;
const PRO: CareUser = { id: viewerId, role: 'pro', subUsers: [repId] };
const SLA = { firstContactH: 24, staleD: 7, escalationH: 72 };

describe('A+C preview repa bez zapisów (PostgreSQL)', () => {
    beforeEach(async () => {
        await prisma.offers_rel.create({
            data: { id: offerId, userId: repId, createdAt: '2026-09-01T00:00:00.000Z' }
        });
    });

    afterEach(async () => {
        await prisma.care_notifications.deleteMany({
            where: {
                OR: [
                    { id: { startsWith: testId } },
                    { userId: { in: [viewerId, repId] } },
                    { offerId: { startsWith: testId } }
                ]
            }
        });
        await prisma.offers_rel.deleteMany({ where: { id: offerId } });
    });

    it('T1 sync z repOwner nie dopisuje do skrzynki viewera', async () => {
        const result = await syncCareNotifications(prisma, PRO, 'team', NOW, SLA, {
            repOwner: repId
        });
        expect(result.inserted).toBe(0);
        expect(await prisma.care_notifications.count({ where: { userId: viewerId } })).toBe(0);
    });

    it('T2 kotwica: pełny sync bez repOwner nadal dopisuje', async () => {
        const result = await syncCareNotifications(prisma, PRO, 'team', NOW, SLA);
        expect(result.inserted).toBe(1);
        expect(await prisma.care_notifications.count({ where: { userId: viewerId } })).toBe(1);
    });

    it('T3 retencja przy preview nie kasuje wierszy viewera', async () => {
        await prisma.care_notifications.create({
            data: {
                id: `${testId}-old`,
                userId: viewerId,
                offerKind: 'rury',
                offerId: `${testId}-old-offer`,
                type: 'CALLBACK_DUE',
                readAt: '2026-01-01T00:00:00.000Z',
                createdAt: NOW
            }
        });
        await syncCareNotifications(prisma, PRO, 'team', NOW, SLA, { repOwner: repId });
        await expect(
            prisma.care_notifications.findUnique({ where: { id: `${testId}-old` } })
        ).resolves.toMatchObject({ id: `${testId}-old` });
    });

    it('T4 kotwica: lista zawsze self-only', async () => {
        await prisma.care_notifications.createMany({
            data: [
                {
                    id: `${testId}-self`,
                    userId: viewerId,
                    offerKind: 'rury',
                    offerId,
                    type: 'SLA_BREACH',
                    readAt: null,
                    createdAt: NOW
                },
                {
                    id: `${testId}-other`,
                    userId: repId,
                    offerKind: 'rury',
                    offerId,
                    type: 'SLA_BREACH',
                    readAt: null,
                    createdAt: NOW
                }
            ]
        });
        const { items } = await listCareNotifications(prisma, viewerId, {
            unreadOnly: false,
            limit: 50
        });
        expect(items.map((item) => item.id)).toEqual([`${testId}-self`]);
    });
});
