/**
 * Singleton klienta Prisma - zapewnia jedno połączenie z bazą danych w całej aplikacji
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma-postgres/client';
import { countDbQuery } from './utils/dbQueryCounter';
import { requirePostgresDatabaseUrl } from './utils/databaseUrl';
import { recordDbQuery } from './utils/metrics';

export function createPrismaClient(rawUrl = process.env.DATABASE_URL): PrismaClient {
    const connectionString = requirePostgresDatabaseUrl(rawUrl);
    const parsedUrl = new URL(connectionString);
    const schema = parsedUrl.searchParams.get('schema') ?? undefined;
    if (schema && !/^[a-z_][a-z0-9_]*$/.test(schema)) {
        throw new Error('DATABASE_URL schema must be a valid PostgreSQL identifier');
    }
    parsedUrl.searchParams.delete('schema');
    const adapter = new PrismaPg(
        {
            connectionString: parsedUrl.toString(),
            max: 10,
            connectionTimeoutMillis: 10_000,
            idleTimeoutMillis: 30_000,
            ...(schema ? { options: `-c search_path=${schema}` } : {})
        },
        schema ? { schema } : undefined
    );

    return new PrismaClient({
        adapter,
        // M: query events do metryk (stdout dla warn/error bez zmian).
        log: [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
            { emit: 'event', level: 'query' }
        ]
    });
}

export const prisma = createPrismaClient();

interface QueryEvent {
    duration: number;
}

{
    const queryAware = prisma as unknown as {
        $on: (event: 'query', cb: (e: QueryEvent) => void) => void;
    };
    // M: globalny czas DB do /metrics (lekki licznik, bez PII/zapytań).
    queryAware.$on('query', (e) => {
        recordDbQuery(typeof e?.duration === 'number' ? e.duration : 0);
    });
}

if (process.env.NODE_ENV !== 'production') {
    const queryAware = prisma as unknown as {
        $on: (event: 'query', cb: () => void) => void;
    };
    queryAware.$on('query', () => {
        countDbQuery();
    });
}

export { Prisma };
export default prisma;
