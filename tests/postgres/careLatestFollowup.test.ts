import prisma from '../../src/prismaClient';

describe('PostgreSQL latest follow-up trigger', () => {
    const offerId = `pg-care-${process.pid}-${Date.now()}`;
    const olderId = `${offerId}-a`;
    const newerId = `${offerId}-b`;

    afterAll(async () => {
        await prisma.offer_follow_ups.deleteMany({ where: { offerId: { startsWith: offerId } } });
    });

    test('selects latest row and restores the previous row after delete', async () => {
        await prisma.$executeRaw`
            INSERT INTO "offer_follow_ups" ("id", "offerKind", "offerId", "createdByUserId", "contactedAt", "channel", "result")
            VALUES (${olderId}, 'rury', ${offerId}, 'pg-test', '2026-01-01T10:00:00.000Z', 'PHONE', 'CONTACTED')
        `;
        await prisma.$executeRaw`
            INSERT INTO "offer_follow_ups" ("id", "offerKind", "offerId", "createdByUserId", "contactedAt", "channel", "result")
            VALUES (${newerId}, 'rury', ${offerId}, 'pg-test', '2026-01-02T10:00:00.000Z', 'PHONE', 'CONTACTED')
        `;

        const latest = await prisma.latest_followup.findUnique({
            where: { offerKind_offerId: { offerKind: 'rury', offerId } }
        });
        expect(latest?.followupId).toBe(newerId);

        await prisma.offer_follow_ups.delete({ where: { id: newerId } });
        const restored = await prisma.latest_followup.findUnique({
            where: { offerKind_offerId: { offerKind: 'rury', offerId } }
        });
        expect(restored?.followupId).toBe(olderId);
    });

    test('uses contactedAt, createdAt and id as ordered tie breakers', async () => {
        const tieOfferId = `${offerId}-ties`;
        const insert = (id: string, contactedAt: string, createdAt: string) =>
            prisma.$executeRaw`
                INSERT INTO "offer_follow_ups" ("id", "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", "channel", "result")
                VALUES (${id}, 'rury', ${tieOfferId}, 'pg-test', ${contactedAt}, ${createdAt}, 'PHONE', 'CONTACTED')
            `;

        await insert(
            `${tieOfferId}-older-contact`,
            '2026-01-01T10:00:00.000Z',
            '2026-01-03T10:00:00.000Z'
        );
        await insert(
            `${tieOfferId}-older-create`,
            '2026-01-02T10:00:00.000Z',
            '2026-01-02T10:00:00.000Z'
        );
        await insert(
            `${tieOfferId}-id-tie-m`,
            '2026-01-02T10:00:00.000Z',
            '2026-01-03T10:00:00.000Z'
        );
        await insert(
            `${tieOfferId}-id-tie-a`,
            '2026-01-02T10:00:00.000Z',
            '2026-01-03T10:00:00.000Z'
        );
        await insert(
            `${tieOfferId}-id-tie-z`,
            '2026-01-02T10:00:00.000Z',
            '2026-01-03T10:00:00.000Z'
        );

        const latest = await prisma.latest_followup.findUnique({
            where: { offerKind_offerId: { offerKind: 'rury', offerId: tieOfferId } }
        });
        expect(latest?.followupId).toBe(`${tieOfferId}-id-tie-z`);
    });

    test('matches the independent latest-row rule across offer kinds and backdated inserts', async () => {
        const rows = [
            {
                id: `${offerId}-r-old`,
                kind: 'rury',
                offer: `${offerId}-r`,
                contacted: '2026-01-01',
                created: '2026-01-01'
            },
            {
                id: `${offerId}-r-backdated`,
                kind: 'rury',
                offer: `${offerId}-r`,
                contacted: '2025-12-01',
                created: '2026-01-05'
            },
            {
                id: `${offerId}-s-tie-a`,
                kind: 'studnie',
                offer: `${offerId}-s`,
                contacted: '2026-01-02',
                created: '2026-01-02'
            },
            {
                id: `${offerId}-s-tie-z`,
                kind: 'studnie',
                offer: `${offerId}-s`,
                contacted: '2026-01-02',
                created: '2026-01-02'
            }
        ];
        for (const row of rows) {
            await prisma.$executeRaw`
                INSERT INTO "offer_follow_ups" ("id", "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", "channel", "result")
                VALUES (${row.id}, ${row.kind}, ${row.offer}, 'pg-test', ${row.contacted}, ${row.created}, 'PHONE', 'CONTACTED')
            `;
        }

        const actual = await prisma.latest_followup.findMany({
            where: { offerId: { in: rows.map((row) => row.offer) } },
            select: { offerKind: true, offerId: true, followupId: true }
        });
        const expected = new Map([
            [`rury:${offerId}-r`, `${offerId}-r-old`],
            [`studnie:${offerId}-s`, `${offerId}-s-tie-z`]
        ]);
        expect(
            new Map(actual.map((row) => [`${row.offerKind}:${row.offerId}`, row.followupId]))
        ).toEqual(expected);
    });

    test('LIMIT and ROW_NUMBER queries agree on timestamp ties in PostgreSQL', async () => {
        const tieOfferId = `${offerId}-query-ties`;
        for (const [id, outcome] of [
            [`${tieOfferId}-a`, 'OPEN'],
            [`${tieOfferId}-z`, 'WON']
        ]) {
            await prisma.$executeRaw`
                INSERT INTO "offer_follow_ups" ("id", "offerKind", "offerId", "createdByUserId", "contactedAt", "createdAt", "channel", "result", "outcome")
                VALUES (${id}, 'rury', ${tieOfferId}, 'pg-test', '2026-10-08T10:00:00.000Z', '2026-10-08T10:00:00.000Z', 'PHONE', 'CONTACTED', ${outcome})
            `;
        }
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const [ordered] = await prisma.$queryRaw<Array<{ outcome: string }>>`
                SELECT "outcome" FROM "offer_follow_ups"
                WHERE "offerKind" = 'rury' AND "offerId" = ${tieOfferId}
                ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC LIMIT 1
            `;
            const [ranked] = await prisma.$queryRaw<Array<{ outcome: string }>>`
                WITH latest AS (
                    SELECT "offerKind", "offerId", "outcome",
                        ROW_NUMBER() OVER (PARTITION BY "offerKind", "offerId"
                            ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC) AS rn
                    FROM "offer_follow_ups"
                ) SELECT "outcome" FROM latest WHERE "offerKind" = 'rury' AND "offerId" = ${tieOfferId} AND rn = 1
            `;
            expect(ordered?.outcome).toBe('WON');
            expect(ranked?.outcome).toBe(ordered?.outcome);
        }
    });

    test('concurrent inserts keep the newest projection even if an older trigger commits last', async () => {
        const concurrentOfferId = `${offerId}-concurrent`;
        const insert = (id: string, contactedAt: string) =>
            prisma.$executeRaw`
                INSERT INTO "offer_follow_ups" ("id", "offerKind", "offerId", "createdByUserId", "contactedAt", "channel", "result")
                VALUES (${id}, 'rury', ${concurrentOfferId}, 'pg-test', ${contactedAt}, 'PHONE', 'CONTACTED')
            `;
        await Promise.all([
            insert(`${concurrentOfferId}-old`, '2026-01-01T10:00:00.000Z'),
            insert(`${concurrentOfferId}-new`, '2026-01-02T10:00:00.000Z')
        ]);

        const latest = await prisma.latest_followup.findUnique({
            where: { offerKind_offerId: { offerKind: 'rury', offerId: concurrentOfferId } }
        });
        expect(latest?.followupId).toBe(`${concurrentOfferId}-new`);
    });
});
