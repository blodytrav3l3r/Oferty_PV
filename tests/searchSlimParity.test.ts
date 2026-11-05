import { Prisma } from '../generated/prisma-postgres/client';
import prisma from '../src/prismaClient';
import { mapOfferRow, RawOfferRow } from '../src/utils/searchUtils';

function fixtureBlob() {
    const wells = Array.from({ length: 3 }, (_, i) => ({ id: `w${i}`, totalPrice: 100 + i }));
    return {
        clientName: '',
        investName: '',
        investAddress: 'ul. Testowa 1',
        clientNip: '1234567890',
        totalNetto: 111.5,
        totalBrutto: 137.25,
        summary: { totalValue: 999.99, totalNetto: 888.88, totalBrutto: 1077.77, extra: 'drop me' },
        costSummary: { totalValue: 555.55, extra: 'drop me' },
        wells: Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, config: [{ a: 1 }] })),
        wellsExport: wells,
        items: [{ productId: 'p1' }, { productId: 'p2' }],
        userName: 'Jan',
        creatorName: 'Ewa',
        createdByUserName: 'Ewa K',
        budowa: 'B17',
        number: 'N/1',
        offerNumber: 'O/1',
        huge: 'z'.repeat(50000)
    };
}

function priceOf(offer: any): number {
    const preSum = offer.wellsExportTotal ?? offer.data?.wellsExportTotal;
    if (typeof preSum === 'number') return preSum;
    if (offer.type === 'studnia_oferta') {
        const exp = offer.wellsExport || (offer.data && offer.data.wellsExport);
        if (exp) return exp.reduce((s: number, w: any) => s + (w.totalPrice || 0), 0);
    }
    let v = offer.totalNetto || offer.totalBrutto || 0;
    if (!v && offer.data) {
        if (offer.data.summary)
            v =
                offer.data.summary.totalValue ||
                offer.data.summary.totalNetto ||
                offer.data.summary.totalBrutto ||
                0;
        else if (offer.data.costSummary) v = offer.data.costSummary.totalValue || 0;
        else v = offer.data.totalNetto || offer.data.totalBrutto || 0;
    }
    if (!v && offer.price) v = offer.price;
    return v || 0;
}

const PROJECTION_SQL = `
    data::jsonb ->> 'clientName' AS "d_clientName",
    data::jsonb ->> 'investName' AS "d_investName",
    data::jsonb ->> 'investAddress' AS "d_investAddress",
    data::jsonb ->> 'clientNip' AS "d_clientNip",
    data::jsonb ->> 'clientNumber' AS "d_clientNumber",
    data::jsonb ->> 'totalNetto' AS "d_totalNetto",
    data::jsonb ->> 'totalBrutto' AS "d_totalBrutto",
    (data::jsonb -> 'summary')::text AS "d_summary",
    (data::jsonb -> 'costSummary')::text AS "d_costSummary",
    CASE WHEN jsonb_typeof(data::jsonb -> 'wellsExport') = 'array' THEN (
        SELECT ROUND(COALESCE(SUM(CASE
            WHEN (well.value ->> 'totalPrice') ~ '^-?[0-9]+([.][0-9]+)?$'
            THEN (well.value ->> 'totalPrice')::numeric END), 0), 2)::double precision
        FROM jsonb_array_elements(data::jsonb -> 'wellsExport') AS well(value)
    ) ELSE NULL END AS "d_wellsExportTotal",
    CASE WHEN jsonb_typeof(data::jsonb -> 'wells') = 'array'
        THEN jsonb_array_length(data::jsonb -> 'wells') ELSE NULL END AS "d_wellsCount",
    CASE WHEN jsonb_typeof(data::jsonb -> 'items') = 'array'
        THEN jsonb_array_length(data::jsonb -> 'items') ELSE NULL END AS "d_itemsCount",
    data::jsonb ->> 'userName' AS "d_userName",
    data::jsonb ->> 'creatorName' AS "d_creatorName",
    data::jsonb ->> 'createdByUserName' AS "d_createdByUserName",
    data::jsonb ->> 'budowa' AS "d_budowa",
    data::jsonb ->> 'number' AS "d_number",
    data::jsonb ->> 'offerNumber' AS "d_offerNumber"`;

async function project(data: unknown, history: unknown = []): Promise<Record<string, unknown>> {
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        WITH fixture AS (
            SELECT ${JSON.stringify(data)}::jsonb AS data,
                   ${JSON.stringify(history)}::jsonb AS history
        )
        SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object(
                   'updatedAt', h.value->'updatedAt', 'timestamp', h.value->'timestamp',
                   'state', h.value->'state', 'totalBrutto', h.value->'totalBrutto',
                   'lastEditedBy', h.value->'lastEditedBy', 'userName', h.value->'userName',
                   'itemsCount', CASE WHEN jsonb_typeof(h.value->'items') = 'array'
                       THEN jsonb_array_length(h.value->'items') ELSE NULL END
               ) ORDER BY h.ordinality)::text
               FROM jsonb_array_elements(history) WITH ORDINALITY AS h(value, ordinality)), '[]') AS history,
               ${Prisma.raw(PROJECTION_SQL)}
        FROM fixture
    `);
    const row = rows[0];
    if (!row) throw new Error('PostgreSQL projection returned no row');
    return row;
}

function baseRow(overrides: Partial<RawOfferRow> = {}): RawOfferRow {
    return {
        id: 'o1',
        userId: 'u1',
        clientId: null,
        state: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
        offer_number: 'O/1',
        pricelistVersionId: null,
        history: '[]',
        clientName: '',
        investName: '',
        clientNip: '',
        clientNumber: '',
        _type: 'studnie',
        transportCost: 0,
        _orderCount: 0,
        _fu_outcome: null,
        _fu_next: null,
        _fu_last: null,
        d_clientName: null,
        d_investName: null,
        d_investAddress: null,
        d_clientNip: null,
        d_clientNumber: null,
        d_totalNetto: null,
        d_totalBrutto: null,
        d_summary: null,
        d_costSummary: null,
        d_wellsExportTotal: null,
        d_wellsCount: null,
        d_itemsCount: null,
        d_userName: null,
        d_creatorName: null,
        d_createdByUserName: null,
        d_budowa: null,
        d_number: null,
        d_offerNumber: null,
        ...overrides
    };
}

describe('PostgreSQL slim offer-list projection parity', () => {
    test('slim card values match values from the full JSON payload', async () => {
        const data = fixtureBlob();
        const history = [{ updatedAt: '2026-01-01', state: 'draft', items: [{ productId: 'p1' }] }];
        const slim = await project(data, history);
        const mapped = mapOfferRow(
            baseRow({
                history: String(slim.history),
                d_clientName: slim.d_clientName as string | null,
                d_investName: slim.d_investName as string | null,
                d_investAddress: slim.d_investAddress as string | null,
                d_clientNip: slim.d_clientNip as string | null,
                d_clientNumber: slim.d_clientNumber as string | null,
                d_totalNetto: slim.d_totalNetto as string | null,
                d_totalBrutto: slim.d_totalBrutto as string | null,
                d_summary: slim.d_summary as string | null,
                d_costSummary: slim.d_costSummary as string | null,
                d_wellsExportTotal: slim.d_wellsExportTotal as number | null,
                d_wellsCount: slim.d_wellsCount as number | null,
                d_itemsCount: slim.d_itemsCount as number | null,
                d_userName: slim.d_userName as string | null,
                d_creatorName: slim.d_creatorName as string | null,
                d_createdByUserName: slim.d_createdByUserName as string | null,
                d_budowa: slim.d_budowa as string | null,
                d_number: slim.d_number as string | null,
                d_offerNumber: slim.d_offerNumber as string | null
            })
        );

        expect(priceOf(mapped)).toBe(303);
        expect(mapped.data.wellsCount).toBe(data.wells.length);
        expect(mapped.data.itemsCount).toBe(data.items.length);
        expect(mapped.data.investAddress).toBe(data.investAddress);
        expect(mapped.data.clientNip).toBe(data.clientNip);
        expect(mapped.data.userName).toBe(data.userName);
        expect(mapped.data.summary).toEqual({
            totalValue: 999.99,
            totalNetto: 888.88,
            totalBrutto: 1077.77
        });
        expect(mapped.history).toEqual([
            {
                updatedAt: '2026-01-01',
                timestamp: null,
                state: 'draft',
                totalBrutto: null,
                lastEditedBy: null,
                userName: null,
                itemsCount: 1
            }
        ]);
        expect(JSON.stringify(mapped)).not.toContain('drop me');
        expect(JSON.stringify(mapped)).not.toContain('z'.repeat(100));
    });

    test('well export totals preserve decimal values and missing arrays remain null', async () => {
        const [withExport, withoutExport] = await Promise.all([
            project({
                totalNetto: 50,
                wellsExport: [{ totalPrice: 100.25 }, { totalPrice: '200.25' }]
            }),
            project({ totalNetto: 50 })
        ]);
        expect(Number(withExport.d_wellsExportTotal)).toBe(300.5);
        expect(withoutExport.d_wellsExportTotal).toBeNull();
    });

    test('history preserves order and scalar types while dropping full items', async () => {
        const history = [
            {
                updatedAt: '2026-01-01',
                state: 'draft',
                totalBrutto: 100,
                lastEditedBy: 'Ewa',
                userName: 'Jan',
                items: Array.from({ length: 50 }, (_, i) => ({
                    productId: `p${i}`,
                    secret: 'x'.repeat(1000)
                }))
            },
            { updatedAt: '2026-01-02', state: 'final', totalBrutto: 200 }
        ];
        const row = await project({}, history);
        const slim = JSON.parse(String(row.history)) as Record<string, unknown>[];
        expect(slim).toHaveLength(2);
        expect(slim[0]).toMatchObject({
            updatedAt: '2026-01-01',
            totalBrutto: 100,
            lastEditedBy: 'Ewa',
            itemsCount: 50
        });
        expect(slim[0].items).toBeUndefined();
        expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(history).length / 10);
    });

    test('mapper normalizes bigint counts before JSON serialization', () => {
        const mapped = mapOfferRow(
            baseRow({ d_wellsCount: 2317n, d_itemsCount: null, d_wellsExportTotal: 0n })
        );
        expect(mapped.data.wellsCount).toBe(2317);
        expect(mapped.data.itemsCount).toBeUndefined();
        expect(() => JSON.stringify(mapped)).not.toThrow();
    });

    test('relational item count wins over blob count and blob is fallback', async () => {
        const rows = await prisma.$queryRaw<
            { id: string; d_itemsCount: bigint | number | null }[]
        >(Prisma.sql`
            WITH offers(id, data) AS (
                VALUES ('wiped', ${JSON.stringify({ totalNetto: 5850 })}),
                       ('legacy', ${JSON.stringify({ items: [{ productId: 'p1' }, { productId: 'p2' }] })}),
                       ('both', ${JSON.stringify({ items: [{ productId: 'p1' }] })})
            ), item_rows("offerId") AS (
                VALUES ('wiped'), ('wiped'), ('wiped'), ('wiped'),
                       ('both'), ('both'), ('both'), ('both')
            ), counts AS (
                SELECT "offerId", COUNT(*) AS item_count FROM item_rows GROUP BY "offerId"
            )
            SELECT offers.id,
                   COALESCE(counts.item_count, CASE WHEN jsonb_typeof(offers.data::jsonb -> 'items') = 'array'
                       THEN jsonb_array_length(offers.data::jsonb -> 'items') ELSE NULL END) AS "d_itemsCount"
            FROM offers LEFT JOIN counts ON counts."offerId" = offers.id
        `);
        const byId = Object.fromEntries(rows.map((row) => [row.id, Number(row.d_itemsCount)]));
        expect(byId).toEqual({ wiped: 4, legacy: 2, both: 4 });
    });

    test('wellCount column wins and JSON array is fallback', async () => {
        const rows = await prisma.$queryRaw<
            { id: string; d_wellsCount: number | null }[]
        >(Prisma.sql`
            WITH studnie(id, "wellCount", data) AS (
                VALUES ('col', 4, ${JSON.stringify({ wells: [{ id: 'w1' }] })}),
                       ('legacy', NULL, ${JSON.stringify({ wells: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }] })})
            )
            SELECT id, CASE WHEN "wellCount" IS NULL OR "wellCount" = 0
                THEN CASE WHEN jsonb_typeof(data::jsonb -> 'wells') = 'array'
                    THEN jsonb_array_length(data::jsonb -> 'wells') ELSE NULL END
                ELSE "wellCount" END AS "d_wellsCount"
            FROM studnie
        `);
        const byId = Object.fromEntries(rows.map((row) => [row.id, Number(row.d_wellsCount)]));
        expect(byId).toEqual({ col: 4, legacy: 3 });
    });
});
