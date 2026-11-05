/* P1: stan pilnowania (snooze/done rozłączne) + SLA default/upsert. */
import prisma from '../../src/prismaClient';
import {
    getCareState,
    setCareState,
    clearCareState,
    getSlaConfig,
    setSlaConfig,
    DEFAULT_SLA
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const testId = `care-state-${process.pid}-${Date.now()}`;
const offerId = (suffix: string) => `${testId}-${suffix}`;

describe('P1 care state (PostgreSQL)', () => {
    afterAll(async () => {
        await prisma.care_states.deleteMany({ where: { offerId: { startsWith: testId } } });
        await prisma.care_sla_config.deleteMany({ where: { id: 'global' } });
    });

    it('snooze i done rozłączne (upsert czyści drugie)', async () => {
        const id = offerId('exclusive');
        await setCareState(prisma, {
            offerKind: 'rury',
            offerId: id,
            snoozedUntil: '2026-10-12T00:00:00.000Z',
            doneAt: null,
            updatedBy: 'u1',
            nowIso: NOW
        });
        let state = await getCareState(prisma, 'rury', id);
        expect(state?.snoozedUntil).toBe('2026-10-12T00:00:00.000Z');
        expect(state?.doneAt).toBeNull();

        await setCareState(prisma, {
            offerKind: 'rury',
            offerId: id,
            snoozedUntil: null,
            doneAt: NOW,
            updatedBy: 'u1',
            nowIso: NOW
        });
        state = await getCareState(prisma, 'rury', id);
        expect(state?.doneAt).toBe(NOW);
        expect(state?.snoozedUntil).toBeNull();
        await clearCareState(prisma, 'rury', id);
        expect(await getCareState(prisma, 'rury', id)).toBeNull();
    });

    it('opt-lock: nieaktualne expectedUpdatedAt → 409, świeże przechodzi', async () => {
        const id = offerId('lock');
        const first = await setCareState(prisma, {
            offerKind: 'rury',
            offerId: id,
            snoozedUntil: '2026-10-12T00:00:00.000Z',
            doneAt: null,
            updatedBy: 'u1',
            nowIso: NOW
        });
        await expect(
            setCareState(prisma, {
                offerKind: 'rury',
                offerId: id,
                snoozedUntil: null,
                doneAt: NOW,
                updatedBy: 'u2',
                nowIso: NOW,
                expectedUpdatedAt: '2000-01-01T00:00:00.000Z'
            })
        ).rejects.toMatchObject({ status: 409 });
        expect((await getCareState(prisma, 'rury', id))?.updatedBy).toBe('u1');

        const updated = await setCareState(prisma, {
            offerKind: 'rury',
            offerId: id,
            snoozedUntil: null,
            doneAt: NOW,
            updatedBy: 'u2',
            nowIso: NOW,
            expectedUpdatedAt: first.updatedAt
        });
        expect(updated.doneAt).toBe(NOW);
    });

    it('opt-lock na nieistniejący wiersz daje 409, zwykły pierwszy zapis działa', async () => {
        const id = offerId('missing-lock');
        await expect(
            setCareState(prisma, {
                offerKind: 'rury',
                offerId: id,
                snoozedUntil: '2026-10-12T00:00:00.000Z',
                doneAt: null,
                updatedBy: 'u1',
                nowIso: NOW,
                expectedUpdatedAt: '2026-10-09T00:00:00.000Z'
            })
        ).rejects.toMatchObject({ status: 409, code: 'CARE_STATE_CONFLICT' });
        expect(await getCareState(prisma, 'rury', id)).toBeNull();
        await setCareState(prisma, {
            offerKind: 'rury',
            offerId: id,
            snoozedUntil: '2026-10-12T00:00:00.000Z',
            doneAt: null,
            updatedBy: 'u1',
            nowIso: NOW
        });
        expect((await getCareState(prisma, 'rury', id))?.updatedBy).toBe('u1');
    });

    it('SLA: default bez wiersza, upsert zapisuje', async () => {
        await prisma.care_sla_config.deleteMany({ where: { id: 'global' } });
        expect(await getSlaConfig(prisma)).toEqual(DEFAULT_SLA);
        await setSlaConfig(prisma, {
            firstContactH: 48,
            staleD: 10,
            escalationH: 96,
            updatedBy: 'admin',
            nowIso: NOW
        });
        expect(await getSlaConfig(prisma)).toEqual({
            firstContactH: 48,
            staleD: 10,
            escalationH: 96
        });
    });

    it('reopen lock: niezgodny expected → 409, zgodny kasuje', async () => {
        const id = offerId('reopen');
        await setCareState(prisma, {
            offerKind: 'rury',
            offerId: id,
            snoozedUntil: '2026-10-12T00:00:00.000Z',
            doneAt: null,
            updatedBy: 'u1',
            nowIso: NOW
        });
        await expect(
            clearCareState(prisma, 'rury', id, '2000-01-01T00:00:00.000Z')
        ).rejects.toMatchObject({ status: 409, code: 'CARE_STATE_CONFLICT' });
        expect(await getCareState(prisma, 'rury', id)).not.toBeNull();
        await clearCareState(prisma, 'rury', id, NOW);
        expect(await getCareState(prisma, 'rury', id)).toBeNull();
        await clearCareState(prisma, 'rury', id);
    });
});
