import { createPrismaClient } from '../src/prismaClient';

describe('Prisma 7 PostgreSQL driver adapter', () => {
    it('shares at most two PostgreSQL sessions across concurrent queries in Jest', async () => {
        const prisma = createPrismaClient();

        try {
            const queries = Array.from(
                { length: 5 },
                () =>
                    prisma.$queryRaw<Array<{ pid: number }>>`
                    SELECT pg_backend_pid() AS pid FROM pg_sleep(0.1)
                `
            );
            const rows = (await Promise.all(queries)).flat();

            expect(rows).toHaveLength(5);
            expect(new Set(rows.map(({ pid }) => pid)).size).toBe(2);
        } finally {
            await prisma.$disconnect();
        }
    });

    it('executes Prisma queries in the worker schema and emits query events', async () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl?.startsWith('postgresql://') && !databaseUrl?.startsWith('postgres://')) {
            throw new Error('PostgreSQL test setup must provide DATABASE_URL');
        }
        const prisma = createPrismaClient(databaseUrl);
        const expectedSchema = new URL(databaseUrl).searchParams.get('schema');
        if (!expectedSchema) {
            throw new Error('PostgreSQL test setup must provide a schema-scoped DATABASE_URL');
        }
        const queryEvents: string[] = [];
        const queryAware = prisma as unknown as {
            $on: (event: 'query', callback: (event: { query: string }) => void) => void;
        };
        queryAware.$on('query', (event) => queryEvents.push(event.query));

        try {
            const rows = await prisma.$queryRaw<Array<{ value: bigint; schema: string }>>`
                SELECT 1 AS value, current_schema() AS schema
            `;

            expect(Number(rows[0]?.value)).toBe(1);
            expect(rows[0]?.schema).toBe(expectedSchema);
            expect(queryEvents).toHaveLength(1);
        } finally {
            await prisma.$disconnect();
        }
    });
});
