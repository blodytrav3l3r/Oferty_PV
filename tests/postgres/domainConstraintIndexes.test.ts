import { randomUUID } from 'node:crypto';
import prisma from '../../src/prismaClient';

interface IndexRow {
    indexname: string;
    indexdef: string;
}

async function expectUniqueViolation(operation: Promise<number>, indexName: string): Promise<void> {
    let failure: unknown;
    try {
        await operation;
    } catch (error) {
        failure = error;
    }

    expect(failure).toBeDefined();
    expect(String(failure)).toContain(indexName);
}

describe('PostgreSQL partial unique domain indexes', () => {
    it('installs terminal-per-cycle and active-pricelist indexes in the worker schema', async () => {
        const rows = await prisma.$queryRaw<IndexRow[]>`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND indexname IN (
                'uq_fu_terminal_per_cycle',
                'uq_pricelist_version_approved',
                'ux_pricelist_version_one_draft',
                'uq_reward_well_action',
                'uq_carenotif_unread_per_offer'
              )
            ORDER BY indexname
        `;

        expect(rows.map((row) => row.indexname)).toEqual([
            'uq_carenotif_unread_per_offer',
            'uq_fu_terminal_per_cycle',
            'uq_pricelist_version_approved',
            'uq_reward_well_action',
            'ux_pricelist_version_one_draft'
        ]);
        expect(
            rows
                .filter((row) => row.indexname !== 'uq_reward_well_action')
                .every((row) => row.indexdef.includes('WHERE'))
        ).toBe(true);
    });

    it('allows multiple open follow-ups but rejects duplicate terminal outcomes per cycle', async () => {
        const prefix = randomUUID();
        const offerId = `migration-test-${prefix}`;
        const ids = [
            `${prefix}-open-1`,
            `${prefix}-open-2`,
            `${prefix}-won`,
            `${prefix}-lost`,
            `${prefix}-next-cycle`
        ];

        try {
            const insert = (id: string, outcome: 'OPEN' | 'WON' | 'LOST_OTHER', cycle = 0) =>
                prisma.$executeRaw`
                    INSERT INTO "offer_follow_ups"
                        ("id", "offerKind", "offerId", "cycle", "createdByUserId", "contactedAt", "channel", "result", "outcome")
                    VALUES
                        (${id}, 'rury', ${offerId}, ${cycle}, 'migration-test', '2026-10-01T00:00:00.000Z', 'PHONE', 'CONTACTED', ${outcome}::"OfferFollowUpOutcome")
                `;

            await insert(ids[0], 'OPEN');
            await insert(ids[1], 'OPEN');
            await insert(ids[2], 'WON');
            await expectUniqueViolation(insert(ids[3], 'LOST_OTHER'), 'uq_fu_terminal_per_cycle');
            await insert(ids[4], 'LOST_OTHER', 1);
        } finally {
            await prisma.$executeRaw`DELETE FROM "offer_follow_ups" WHERE "id" IN (${ids[0]}, ${ids[1]}, ${ids[2]}, ${ids[3]}, ${ids[4]})`;
        }
    });

    it('enforces one reward per well and action', async () => {
        const prefix = randomUUID();
        const ids = [`${prefix}-first`, `${prefix}-duplicate`];

        try {
            const insert = (id: string) =>
                prisma.$executeRaw`
                    INSERT INTO "aiRewardLog" ("id", "userId", "wellId", "dn", "action", "reward", "createdAt")
                    VALUES (${id}, 'migration-test', ${prefix}, 600, 'ACCEPT', 0.5, '2026-10-01T00:00:00.000Z')
                `;

            await insert(ids[0]);
            await expectUniqueViolation(insert(ids[1]), 'uq_reward_well_action');
        } finally {
            await prisma.$executeRaw`DELETE FROM "aiRewardLog" WHERE "id" IN (${ids[0]}, ${ids[1]})`;
        }
    });

    it('keeps one care state per offer and one unread notification per recipient and offer', async () => {
        const prefix = randomUUID();
        const state = { offerKind: 'rury', offerId: `care-${prefix}` };
        const notificationIds = [`${prefix}-unread-1`, `${prefix}-unread-2`, `${prefix}-read`];
        const userId = `care-user-${prefix}`;

        try {
            await prisma.$executeRaw`
                INSERT INTO "care_states" ("offerKind", "offerId", "updatedAt")
                VALUES (${state.offerKind}, ${state.offerId}, ${new Date().toISOString()})
            `;
            const duplicateState = await prisma.$executeRaw`
                INSERT INTO "care_states" ("offerKind", "offerId", "updatedAt")
                VALUES (${state.offerKind}, ${state.offerId}, ${new Date().toISOString()})
                ON CONFLICT ("offerKind", "offerId") DO NOTHING
            `;
            expect(duplicateState).toBe(0);

            const insertNotification = (id: string, readAt: string | null) =>
                prisma.$executeRaw`
                    INSERT INTO "care_notifications"
                        ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt")
                    VALUES
                        (${id}, ${userId}, ${state.offerKind}, ${state.offerId}, 'followup_due', ${readAt}, ${new Date().toISOString()})
                `;
            await insertNotification(notificationIds[0], null);
            await expectUniqueViolation(
                insertNotification(notificationIds[1], null),
                'uq_carenotif_unread_per_offer'
            );
            await expect(
                insertNotification(notificationIds[2], new Date().toISOString())
            ).resolves.toBe(1);
        } finally {
            await prisma.care_notifications.deleteMany({ where: { id: { in: notificationIds } } });
            await prisma.care_states.deleteMany({ where: state });
        }
    });

    it('allows one approved version and one draft, but enforces each partial uniqueness rule', async () => {
        const prefix = randomUUID();
        const type = `test-${prefix}`;
        const effectiveFrom = '2026-10-01T00:00:00.000Z';
        const ids = [
            `${prefix}-approved-1`,
            `${prefix}-approved-2`,
            `${prefix}-draft-1`,
            `${prefix}-draft-2`
        ];

        try {
            const insert = (id: string, seq: number, status: 'APPROVED' | 'DRAFT') =>
                prisma.$executeRaw`
                    INSERT INTO "PricelistVersion" ("id", "type", "seq", "version", "status", "effectiveFrom", "sha256")
                    VALUES (${id}, ${type}, ${seq}, ${`${prefix}-${seq}`}, ${status}, ${effectiveFrom}, ${'a'.repeat(64)})
                `;

            await insert(ids[0], 1, 'APPROVED');
            await expectUniqueViolation(
                insert(ids[1], 2, 'APPROVED'),
                'uq_pricelist_version_approved'
            );
            await insert(ids[2], 3, 'DRAFT');
            await expectUniqueViolation(
                insert(ids[3], 4, 'DRAFT'),
                'ux_pricelist_version_one_draft'
            );
        } finally {
            for (const id of ids) {
                await prisma.$executeRaw`DELETE FROM "PricelistVersion" WHERE "id" = ${id}`;
            }
        }
    });
});
