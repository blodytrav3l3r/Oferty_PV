import { Prisma } from '../../generated/prisma-postgres/client';
import prisma from '../../src/prismaClient';
import { buildLatestCte, buildPerRepSql } from '../../src/routes/offers/followUpStats';

describe('P5.2 perRep.wins z latest', () => {
    const testId = `pg-wins-${process.pid}-${Date.now()}`;

    afterAll(async () => {
        await prisma.offer_follow_ups.deleteMany({ where: { offerId: { startsWith: testId } } });
    });

    it('multi-WON: wygrywa autor latest, nie każdy WON', async () => {
        const records = [
            ['w1', 'o-x', 'rep-a', '2026-10-01T10:00:00.000Z', 'WON', 0],
            ['w2', 'o-x', 'rep-b', '2026-10-02T10:00:00.000Z', 'WON', 1],
            ['w3', 'o-y', 'rep-a', '2026-10-03T10:00:00.000Z', 'WON', 0],
            ['w4', 'o-y', 'rep-a', '2026-10-01T09:00:00.000Z', 'OPEN', 0]
        ] as const;
        for (const [id, offerSuffix, author, contactedAt, outcome, cycle] of records) {
            await prisma.$executeRaw`
                INSERT INTO "offer_follow_ups" ("id", "offerKind", "offerId", "createdByUserId", "contactedAt", "channel", "result", "outcome", "cycle")
                VALUES (${`${testId}-${id}`}, 'rury', ${`${testId}-${offerSuffix}`}, ${author}, ${contactedAt}, 'PHONE', 'CONTACTED', ${outcome}, ${cycle})
            `;
        }

        const scope = Prisma.sql`1=1`;
        const rows = await prisma.$queryRaw<
            Array<{
                u: string;
                contacts: bigint | number;
                offers: bigint | number;
                wins: bigint | number;
            }>
        >(buildPerRepSql(scope, buildLatestCte(scope)));
        const byUser = Object.fromEntries(
            rows.map((row) => [
                row.u,
                {
                    contacts: Number(row.contacts),
                    offers: Number(row.offers),
                    wins: Number(row.wins)
                }
            ])
        );
        expect(byUser['rep-a']).toEqual({ contacts: 3, offers: 2, wins: 1 });
        expect(byUser['rep-b']).toEqual({ contacts: 1, offers: 1, wins: 1 });
    });
});
