/* P4 (ADR-016): scoped SLA fallback and optimistic locking on PostgreSQL. */
import prisma from '../../src/prismaClient';
import {
    getEffectiveSla,
    setScopedSla,
    setSlaConfig,
    getSlaUpdatedAt,
    getCareEtagInput,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const testId = `care-sla-scopes-${process.pid}-${Date.now()}`;
const teamId = `${testId}-team`;
const memberId = `${testId}-member`;
const PRO: CareUser = { id: teamId, role: 'pro', subUsers: [memberId] };
const U1: CareUser = { id: memberId, role: 'user', subUsers: [] };

const globalSla = {
    firstContactH: 24,
    staleD: 7,
    escalationH: 72,
    source: 'global'
};

async function cleanTestRows(): Promise<void> {
    await prisma.care_sla_scopes.deleteMany({ where: { scopeId: { startsWith: testId } } });
    await prisma.care_sla_config.deleteMany({ where: { id: 'global' } });
}

describe('P4 SLA per zespół/user (PostgreSQL)', () => {
    beforeEach(cleanTestRows);
    afterEach(cleanTestRows);

    it('fallback do globalnych bez wierszy zakresowych', async () => {
        expect(await getEffectiveSla(prisma, PRO, 'team')).toEqual(globalSla);
        expect((await getEffectiveSla(prisma, U1, 'mine')).source).toBe('global');
    });

    it('team wygrywa dla scope=team, mine go ignoruje; izolacja zespołów', async () => {
        await setScopedSla(prisma, {
            scopeType: 'team',
            scopeId: teamId,
            firstContactH: 12,
            staleD: 3,
            escalationH: 36,
            updatedBy: teamId,
            nowIso: NOW
        });
        expect(await getEffectiveSla(prisma, PRO, 'team')).toEqual({
            firstContactH: 12,
            staleD: 3,
            escalationH: 36,
            source: 'team'
        });
        expect((await getEffectiveSla(prisma, PRO, 'mine')).source).toBe('global');
        const other: CareUser = { id: `${testId}-other-team`, role: 'pro', subUsers: [] };
        expect((await getEffectiveSla(prisma, other, 'team')).source).toBe('global');
    });

    it('user overwrites dla mine + upsert nadpisuje', async () => {
        await setScopedSla(prisma, {
            scopeType: 'user',
            scopeId: memberId,
            firstContactH: 6,
            staleD: 2,
            escalationH: 24,
            updatedBy: memberId,
            nowIso: NOW
        });
        expect(await getEffectiveSla(prisma, U1, 'mine')).toEqual({
            firstContactH: 6,
            staleD: 2,
            escalationH: 24,
            source: 'user'
        });
        await setScopedSla(prisma, {
            scopeType: 'user',
            scopeId: memberId,
            firstContactH: 8,
            staleD: 2,
            escalationH: 24,
            updatedBy: memberId,
            nowIso: '2026-10-11T00:00:00.000Z'
        });
        expect((await getEffectiveSla(prisma, U1, 'mine')).firstContactH).toBe(8);
    });

    it('etag obejmuje tabelę zakresów', async () => {
        const before = await getCareEtagInput(prisma, memberId);
        await setScopedSla(prisma, {
            scopeType: 'team',
            scopeId: teamId,
            firstContactH: 12,
            staleD: 3,
            escalationH: 36,
            updatedBy: teamId,
            nowIso: '2099-10-10T12:00:00.000Z'
        });
        const after = await getCareEtagInput(prisma, memberId);
        expect(after).not.toEqual(before);
        expect(after[8]).toBe('2099-10-10T12:00:00.000Z');
    });
});

describe('P4 fallback user+team i szczelność team-row (PostgreSQL)', () => {
    beforeEach(cleanTestRows);
    afterEach(cleanTestRows);

    it('user ze scope team -> global 24/7/72 (team tylko pro/admin)', async () => {
        expect(await getEffectiveSla(prisma, U1, 'team')).toEqual(globalSla);
    });

    it('team-row nie wycieka do członka zespołu ani obcego pro', async () => {
        await setScopedSla(prisma, {
            scopeType: 'team',
            scopeId: teamId,
            firstContactH: 12,
            staleD: 3,
            escalationH: 36,
            updatedBy: teamId,
            nowIso: NOW
        });
        expect(await getEffectiveSla(prisma, U1, 'team')).toEqual(globalSla);
        const other: CareUser = { id: `${testId}-other-team`, role: 'pro', subUsers: [] };
        expect(await getEffectiveSla(prisma, other, 'team')).toEqual(globalSla);
    });

    it('opt-lock: przestarzały expectedUpdatedAt daje 409, świeży przechodzi', async () => {
        await setScopedSla(prisma, {
            scopeType: 'team',
            scopeId: teamId,
            firstContactH: 12,
            staleD: 3,
            escalationH: 36,
            updatedBy: teamId,
            nowIso: NOW
        });
        const version = await getSlaUpdatedAt(prisma, PRO, 'team');
        expect(version).toBe(NOW);
        await prisma.care_sla_scopes.update({
            where: { scopeType_scopeId: { scopeType: 'team', scopeId: teamId } },
            data: { firstContactH: 10, updatedAt: '2026-10-11T00:00:00.000Z' }
        });
        await expect(
            setScopedSla(prisma, {
                scopeType: 'team',
                scopeId: teamId,
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                updatedBy: teamId,
                nowIso: '2026-10-12T00:00:00.000Z',
                expectedUpdatedAt: version
            })
        ).rejects.toMatchObject({ status: 409, code: 'CARE_STATE_CONFLICT' });
        const next = await setScopedSla(prisma, {
            scopeType: 'team',
            scopeId: teamId,
            firstContactH: 9,
            staleD: 3,
            escalationH: 36,
            updatedBy: teamId,
            nowIso: '2026-10-12T00:00:00.000Z',
            expectedUpdatedAt: '2026-10-11T00:00:00.000Z'
        });
        expect(next.firstContactH).toBe(9);
        expect(await getSlaUpdatedAt(prisma, PRO, 'team')).toBe('2026-10-12T00:00:00.000Z');
    });

    it('opt-lock: blind create bez wiersza przechodzi, z expected daje 409', async () => {
        expect(await getSlaUpdatedAt(prisma, U1, 'mine')).toBeNull();
        await expect(
            setScopedSla(prisma, {
                scopeType: 'user',
                scopeId: memberId,
                firstContactH: 6,
                staleD: 2,
                escalationH: 24,
                updatedBy: memberId,
                nowIso: NOW,
                expectedUpdatedAt: NOW
            })
        ).rejects.toMatchObject({ status: 409 });
        const created = await setScopedSla(prisma, {
            scopeType: 'user',
            scopeId: memberId,
            firstContactH: 6,
            staleD: 2,
            escalationH: 24,
            updatedBy: memberId,
            nowIso: NOW
        });
        expect(created.firstContactH).toBe(6);
    });

    it('opt-lock global: stale → 409 (setSlaConfig)', async () => {
        await setSlaConfig(prisma, {
            firstContactH: 24,
            staleD: 7,
            escalationH: 72,
            updatedBy: 'a',
            nowIso: NOW
        });
        await expect(
            setSlaConfig(prisma, {
                firstContactH: 20,
                staleD: 7,
                escalationH: 72,
                updatedBy: 'a',
                nowIso: '2026-10-12T00:00:00.000Z',
                expectedUpdatedAt: '2000-01-01T00:00:00.000Z'
            })
        ).rejects.toMatchObject({ status: 409, code: 'CARE_STATE_CONFLICT' });
    });
});
