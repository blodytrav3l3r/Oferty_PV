/* P2 notification sync, retention, partial uniqueness and inbox behavior on PostgreSQL. */
import prisma from '../../src/prismaClient';
import {
    syncCareNotifications,
    listCareNotifications,
    markCareNotificationRead,
    markCareNotificationUnread,
    markCareNotificationsRead,
    resetCareSyncThrottleForTests,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const testId = `care-notif-${process.pid}-${Date.now()}`;
const userId = `${testId}-user`;
const user: CareUser = { id: userId, role: 'user', subUsers: [] };
const admin: CareUser = { id: `${testId}-admin`, role: 'admin', subUsers: [] };
const SLA = { firstContactH: 24, staleD: 7, escalationH: 72 };

async function seedBase(): Promise<void> {
    await prisma.offers_rel.createMany({
        data: [
            { id: `${testId}-o1`, userId, createdAt: '2026-09-01T00:00:00.000Z' },
            { id: `${testId}-o2`, userId, createdAt: '2026-10-09T00:00:00.000Z' },
            { id: `${testId}-o3`, userId, createdAt: '2026-10-10T00:00:00.000Z' },
            { id: `${testId}-o4`, userId, createdAt: '2026-10-09T00:00:00.000Z' },
            { id: `${testId}-o5`, userId, createdAt: '2026-10-09T00:00:00.000Z' },
            { id: `${testId}-o6`, userId, createdAt: '2026-09-01T00:00:00.000Z' }
        ]
    });
    await prisma.offer_follow_ups.createMany({
        data: [
            {
                id: `${testId}-f1`,
                offerKind: 'rury',
                offerId: `${testId}-o1`,
                createdByUserId: userId,
                contactedAt: '2026-09-30T10:00:00.000Z',
                createdAt: '2026-09-30T10:00:00.000Z',
                channel: 'PHONE',
                result: 'CONTACTED',
                outcome: 'OPEN',
                nextContactAt: '2026-09-30T10:00:00.000Z'
            },
            {
                id: `${testId}-f2`,
                offerKind: 'rury',
                offerId: `${testId}-o2`,
                createdByUserId: userId,
                contactedAt: '2026-10-09T10:00:00.000Z',
                createdAt: '2026-10-09T10:00:00.000Z',
                channel: 'PHONE',
                result: 'CONTACTED',
                outcome: 'OPEN',
                nextContactAt: '2026-10-10T14:00:00.000Z'
            },
            {
                id: `${testId}-f4`,
                offerKind: 'rury',
                offerId: `${testId}-o4`,
                createdByUserId: userId,
                contactedAt: '2026-10-09T10:00:00.000Z',
                createdAt: '2026-10-09T10:00:00.000Z',
                channel: 'PHONE',
                result: 'CONTACTED',
                outcome: 'WON'
            },
            {
                id: `${testId}-f5`,
                offerKind: 'rury',
                offerId: `${testId}-o5`,
                createdByUserId: userId,
                contactedAt: '2026-09-30T10:00:00.000Z',
                createdAt: '2026-09-30T10:00:00.000Z',
                channel: 'PHONE',
                result: 'CONTACTED',
                outcome: 'OPEN',
                nextContactAt: '2026-09-30T10:00:00.000Z'
            },
            {
                id: `${testId}-f6`,
                offerKind: 'rury',
                offerId: `${testId}-o6`,
                createdByUserId: userId,
                contactedAt: '2026-09-30T10:00:00.000Z',
                createdAt: '2026-09-30T10:00:00.000Z',
                channel: 'PHONE',
                result: 'CONTACTED',
                outcome: 'OPEN',
                nextContactAt: '2026-09-30T10:00:00.000Z'
            }
        ]
    });
    await prisma.care_states.createMany({
        data: [
            {
                offerKind: 'rury',
                offerId: `${testId}-o5`,
                snoozedUntil: '2026-10-12T00:00:00.000Z',
                updatedBy: userId,
                updatedAt: NOW
            },
            {
                offerKind: 'rury',
                offerId: `${testId}-o6`,
                snoozedUntil: '2026-10-09T10:00:00.000Z',
                updatedBy: userId,
                updatedAt: NOW
            }
        ]
    });
}

async function cleanup(): Promise<void> {
    await prisma.care_notifications.deleteMany({ where: { id: { startsWith: testId } } });
    await prisma.care_states.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.offer_follow_ups.deleteMany({ where: { offerId: { startsWith: testId } } });
    await prisma.offers_rel.deleteMany({ where: { id: { startsWith: testId } } });
    await prisma.users.deleteMany({ where: { id: { startsWith: testId } } });
}

beforeEach(() => resetCareSyncThrottleForTests());
afterEach(cleanup);

describe('P2 sync powiadomień (PostgreSQL)', () => {
    it('tworzy typy, respektuje pauzę i terminal, rerun nie dubluje', async () => {
        await seedBase();
        const first = await syncCareNotifications(prisma, user, 'mine', NOW, SLA);
        expect(first.inserted).toBe(4);
        const items = (
            await listCareNotifications(prisma, userId, { unreadOnly: false, limit: 50 })
        ).items;
        expect(items.find((item) => item.offerId === `${testId}-o1`)?.type).toBe('SLA_BREACH');
        expect(items.find((item) => item.offerId === `${testId}-o2`)?.type).toBe('CALLBACK_DUE');
        expect(items.find((item) => item.offerId === `${testId}-o3`)?.type).toBe('CALLBACK_DUE');
        expect(items.find((item) => item.offerId === `${testId}-o4`)).toBeUndefined();
        expect(items.find((item) => item.offerId === `${testId}-o5`)).toBeUndefined();
        expect(items.find((item) => item.offerId === `${testId}-o6`)?.type).toBe('SLA_BREACH');

        await prisma.offers_rel.update({
            where: { id: `${testId}-o1` },
            data: { clientName: 'Budimex', offer_number: 'OF-1' }
        });
        const enriched = (
            await listCareNotifications(prisma, userId, { unreadOnly: false, limit: 50 })
        ).items;
        expect(enriched.find((item) => item.offerId === `${testId}-o1`)).toMatchObject({
            clientName: 'Budimex',
            number: 'OF-1'
        });
        const second = await syncCareNotifications(
            prisma,
            user,
            'mine',
            '2026-10-10T12:01:00.000Z',
            SLA
        );
        expect(second.inserted).toBe(0);
    });

    it('partial unique constraint odrzuca duplikat unread, po read pozwala na nowy', async () => {
        const data = {
            userId,
            offerKind: 'rury',
            offerId: `${testId}-constraint-offer`,
            type: 'SLA_BREACH',
            readAt: null,
            createdAt: NOW
        };
        await prisma.care_notifications.create({ data: { id: `${testId}-a`, ...data } });
        await expect(
            prisma.care_notifications.create({ data: { id: `${testId}-b`, ...data } })
        ).rejects.toMatchObject({ code: 'P2002' });
        await prisma.care_notifications.update({
            where: { id: `${testId}-a` },
            data: { readAt: NOW }
        });
        await expect(
            prisma.care_notifications.create({ data: { id: `${testId}-c`, ...data } })
        ).resolves.toMatchObject({ id: `${testId}-c` });
    });

    it('retencja usuwa stare read i przycina najstarsze read do limitu', async () => {
        await seedBase();
        const readRows = Array.from({ length: 505 }, (_, index) => ({
            id: `${testId}-read-${index}`,
            userId,
            offerKind: 'rury',
            offerId: `${testId}-read-offer-${index}`,
            type: 'CALLBACK_DUE',
            readAt: NOW,
            createdAt: new Date(Date.parse('2026-10-01T00:00:00.000Z') + index * 1000).toISOString()
        }));
        await prisma.care_notifications.create({
            data: {
                id: `${testId}-old`,
                userId,
                offerKind: 'rury',
                offerId: `${testId}-old-offer`,
                type: 'SLA_BREACH',
                readAt: '2026-01-01T00:00:00.000Z',
                createdAt: '2026-01-01T00:00:00.000Z'
            }
        });
        await prisma.care_notifications.createMany({ data: readRows });
        await syncCareNotifications(prisma, user, 'mine', NOW, SLA);
        expect(await prisma.care_notifications.count({ where: { id: `${testId}-old` } })).toBe(0);
        expect(await prisma.care_notifications.count({ where: { id: `${testId}-read-0` } })).toBe(
            0
        );
        expect(await prisma.care_notifications.count({ where: { id: `${testId}-read-499` } })).toBe(
            1
        );
    });

    it('lista unread + odczyt własnego, cudze 0', async () => {
        await seedBase();
        await syncCareNotifications(prisma, user, 'mine', NOW, SLA);
        expect(
            (await listCareNotifications(prisma, userId, { unreadOnly: true, limit: 50 }))
                .unreadCount
        ).toBe(4);
        const first = (await listCareNotifications(prisma, userId, { unreadOnly: true, limit: 1 }))
            .items[0];
        expect(await markCareNotificationRead(prisma, userId, first.id, NOW)).toBe(1);
        expect(await markCareNotificationRead(prisma, `${testId}-intruder`, first.id, NOW)).toBe(0);
        expect(
            (await listCareNotifications(prisma, userId, { unreadOnly: true, limit: 50 }))
                .unreadCount
        ).toBe(3);
    });

    it('zbiorczy odczyt zamyka tylko własne i puste wejście daje 0', async () => {
        await seedBase();
        await syncCareNotifications(prisma, user, 'mine', NOW, SLA);
        const all = (await listCareNotifications(prisma, userId, { unreadOnly: true, limit: 50 }))
            .items;
        expect(all).toHaveLength(4);
        await prisma.care_notifications.create({
            data: {
                id: `${testId}-alien`,
                userId: `${testId}-intruder`,
                offerKind: 'rury',
                offerId: `${testId}-o1`,
                type: 'SLA_BREACH',
                readAt: null,
                createdAt: NOW
            }
        });
        expect(
            await markCareNotificationsRead(
                prisma,
                userId,
                [all[0].id, all[1].id, `${testId}-alien`, `${testId}-missing`],
                NOW
            )
        ).toBe(2);
        expect(
            (await listCareNotifications(prisma, userId, { unreadOnly: true, limit: 50 }))
                .unreadCount
        ).toBe(2);
        expect(await markCareNotificationsRead(prisma, userId, [], NOW)).toBe(0);
    });

    it('ISO-UTC createdAt przechodzi verbatim jako String', async () => {
        await seedBase();
        await syncCareNotifications(prisma, user, 'mine', NOW, SLA);
        const rows = await prisma.care_notifications.findMany({
            where: { userId },
            distinct: ['createdAt'],
            select: { createdAt: true }
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].createdAt).toBe(NOW);
    });

    it('repOwner preview nie zamyka powiadomienia spoza filtra', async () => {
        const past = '2026-09-30T10:00:00.000Z';
        const offerA = `${testId}-rep-a`;
        const offerB = `${testId}-rep-b`;
        await prisma.offers_rel.createMany({
            data: [
                { id: offerA, userId, createdAt: past },
                { id: offerB, userId: `${testId}-other`, createdAt: past }
            ]
        });
        await prisma.offer_follow_ups.createMany({
            data: [offerA, offerB].map((offerId, index) => ({
                id: `${testId}-rep-f${index}`,
                offerKind: 'rury',
                offerId,
                createdByUserId: userId,
                contactedAt: past,
                createdAt: past,
                channel: 'PHONE' as const,
                result: 'CONTACTED' as const,
                outcome: 'OPEN',
                nextContactAt: past
            }))
        });
        await prisma.care_states.create({
            data: {
                offerKind: 'rury',
                offerId: offerB,
                doneAt: NOW,
                updatedBy: userId,
                updatedAt: NOW
            }
        });
        await prisma.care_notifications.createMany({
            data: [offerA, offerB].map((offerId, index) => ({
                id: `${testId}-rep-n${index}`,
                userId: admin.id,
                offerKind: 'rury',
                offerId,
                type: 'CALLBACK_DUE',
                readAt: null,
                createdAt: '2026-10-09T00:00:00.000Z'
            }))
        });
        await syncCareNotifications(prisma, admin, 'all', NOW, SLA, { repOwner: userId });
        const afterPreview = (
            await listCareNotifications(prisma, admin.id, { unreadOnly: true, limit: 50 })
        ).items;
        expect(afterPreview.map((item) => item.offerId)).toEqual(
            expect.arrayContaining([offerA, offerB])
        );
        await syncCareNotifications(prisma, admin, 'all', '2026-10-10T13:00:00.000Z', SLA);
        const afterFull = (
            await listCareNotifications(prisma, admin.id, { unreadOnly: true, limit: 50 })
        ).items;
        expect(afterFull.map((item) => item.offerId)).toContain(offerA);
        expect(afterFull.map((item) => item.offerId)).not.toContain(offerB);
    });

    it('cap 500 zachowuje wszystkie 502 nieprzeczytane i capped badge na 101', async () => {
        const offers = Array.from({ length: 502 }, (_, index) => `${testId}-cap-offer-${index}`);
        await prisma.offers_rel.createMany({
            data: offers.map((id) => ({
                id,
                userId,
                createdAt: '2026-09-30T10:00:00.000Z'
            }))
        });
        await prisma.offer_follow_ups.createMany({
            data: offers.map((offerId, index) => ({
                id: `${testId}-cap-f${index}`,
                offerKind: 'rury',
                offerId,
                createdByUserId: userId,
                contactedAt: '2026-09-30T10:00:00.000Z',
                createdAt: '2026-09-30T10:00:00.000Z',
                channel: 'PHONE' as const,
                result: 'CONTACTED' as const,
                outcome: 'OPEN',
                nextContactAt: '2026-09-30T10:00:00.000Z'
            }))
        });
        await prisma.care_notifications.createMany({
            data: offers.map((offerId, index) => ({
                id: `${testId}-cap-n${index}`,
                userId,
                offerKind: 'rury',
                offerId,
                type: 'SLA_BREACH',
                readAt: null,
                createdAt: '2026-10-09T00:00:00.000Z'
            }))
        });
        expect((await syncCareNotifications(prisma, user, 'mine', NOW, SLA)).inserted).toBe(0);
        expect(
            (await listCareNotifications(prisma, userId, { unreadOnly: true, limit: 100 }))
                .unreadCount
        ).toBe(101);
        expect(await prisma.care_notifications.count({ where: { userId, readAt: null } })).toBe(
            502
        );
    });

    it('badge count boundaries: 0, 100 and capped 101', async () => {
        const count = async () =>
            (
                await listCareNotifications(prisma, userId, {
                    unreadOnly: true,
                    limit: 100
                })
            ).unreadCount;
        expect(await count()).toBe(0);
        await prisma.care_notifications.createMany({
            data: Array.from({ length: 100 }, (_, index) => ({
                id: `${testId}-boundary-${index}`,
                userId,
                offerKind: 'rury',
                offerId: `${testId}-boundary-offer-${index}`,
                type: 'CALLBACK_DUE',
                readAt: null,
                createdAt: NOW
            }))
        });
        expect(await count()).toBe(100);
        await prisma.care_notifications.create({
            data: {
                id: `${testId}-boundary-100`,
                userId,
                offerKind: 'rury',
                offerId: `${testId}-boundary-offer-100`,
                type: 'CALLBACK_DUE',
                readAt: null,
                createdAt: NOW
            }
        });
        expect(await count()).toBe(101);
    });

    it('lista niesie obiekt i kontakt z oferty (kolumna + blob)', async () => {
        await prisma.users.create({
            data: {
                id: userId,
                username: userId,
                password: 'test-only',
                role: 'user',
                firstName: 'Adam',
                lastName: 'Klos'
            }
        });
        const offerId = `${testId}-enriched`;
        await prisma.offers_rel.create({
            data: {
                id: offerId,
                userId,
                createdAt: '2026-10-01T00:00:00.000Z',
                clientName: 'Klient SA',
                clientNumber: 'K-7',
                investName: 'Obiekt Kolumna',
                data: JSON.stringify({
                    totalBrutto: 18469.68,
                    investAddress: 'ul. Testowa 1',
                    contactPerson: 'Jan Kowalski',
                    clientPhone: '601000111',
                    clientEmail: 'jan@example.com'
                })
            }
        });
        await prisma.care_notifications.create({
            data: {
                id: `${testId}-enriched-n`,
                userId,
                offerKind: 'rury',
                offerId,
                type: 'CALLBACK_DUE',
                readAt: null,
                createdAt: NOW
            }
        });
        const { items } = await listCareNotifications(prisma, userId, {
            unreadOnly: true,
            limit: 50
        });
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            ownerName: 'Adam Klos',
            clientName: 'Klient SA',
            clientNumber: 'K-7',
            investName: 'Obiekt Kolumna',
            investAddress: 'ul. Testowa 1',
            contactPerson: 'Jan Kowalski',
            phone: '601000111',
            email: 'jan@example.com'
        });
        expect(items[0].value).toBeCloseTo(18469.68, 2);
    });

    it('unread cofa odczyt własny, cudzy i brakujący wiersz dają 0', async () => {
        const notificationId = `${testId}-unread`;
        await prisma.care_notifications.create({
            data: {
                id: notificationId,
                userId,
                offerKind: 'rury',
                offerId: `${testId}-unread-offer`,
                type: 'CALLBACK_DUE',
                readAt: NOW,
                createdAt: NOW
            }
        });
        expect(await markCareNotificationUnread(prisma, userId, notificationId)).toBe(1);
        expect(await markCareNotificationUnread(prisma, userId, notificationId)).toBe(0);
        expect(await markCareNotificationUnread(prisma, `${testId}-intruder`, notificationId)).toBe(
            0
        );
        expect(await markCareNotificationUnread(prisma, userId, `${testId}-missing`)).toBe(0);
        expect(
            (await listCareNotifications(prisma, userId, { unreadOnly: true, limit: 50 }))
                .unreadCount
        ).toBe(1);
    });
});
