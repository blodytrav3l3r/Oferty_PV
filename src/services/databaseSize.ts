import prisma from '../prismaClient';
import { logger } from '../utils/logger';

const SAMPLE_INTERVAL_MS = 60_000;
const QUERY_TIMEOUT_MS = 1_000;

interface DatabaseSize {
    dbBytes: number | null;
    dbSizeStatus: 'ok' | 'unavailable';
}

let sample: { value: DatabaseSize; expiresAt: number } | undefined;
let pending: Promise<DatabaseSize> | undefined;

async function measureDatabaseSize(): Promise<DatabaseSize> {
    try {
        const [row] = await prisma.$transaction(
            async (tx) => {
                await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(QUERY_TIMEOUT_MS)}, true)`;
                return tx.$queryRaw<Array<{ bytes: bigint }>>`
                    SELECT pg_catalog.pg_database_size(current_database()) AS bytes`;
            },
            { maxWait: QUERY_TIMEOUT_MS, timeout: 2 * QUERY_TIMEOUT_MS }
        );
        const dbBytes = typeof row?.bytes === 'bigint' ? Number(row.bytes) : NaN;
        if (!Number.isSafeInteger(dbBytes) || dbBytes <= 0) {
            throw new Error('Nieprawidłowy wynik pomiaru rozmiaru bazy');
        }
        return { dbBytes, dbSizeStatus: 'ok' };
    } catch (error) {
        logger.warn(
            'Metrics',
            'Pomiar rozmiaru PostgreSQL niedostępny',
            error instanceof Error ? error.name : 'UnknownError'
        );
        return { dbBytes: null, dbSizeStatus: 'unavailable' };
    }
}

export async function getDatabaseSize(): Promise<DatabaseSize> {
    if (sample && sample.expiresAt > Date.now()) return sample.value;

    pending ??= measureDatabaseSize().then((value) => {
        sample = { value, expiresAt: Date.now() + SAMPLE_INTERVAL_MS };
        pending = undefined;
        return value;
    });
    return pending;
}
