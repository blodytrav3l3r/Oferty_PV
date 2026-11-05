import prisma from '../prismaClient';
import { Prisma } from '../../generated/prisma-postgres/client';

export interface OfferFts5Data {
    id: string;
    offer_number: string | null;
    clientName: string | null;
    investName: string | null;
    clientNumber?: string | null;
}

const SEARCH_INDEXES = {
    rury: 'offers_rel_search_tsv_gin_idx',
    studnie: 'offers_studnie_rel_search_tsv_gin_idx'
} as const;

export function buildFts5Query(input: string): string {
    return input
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

/** PostgreSQL maintains GIN expression indexes transactionally with each row write. */
export async function syncFts5(_type: 'rury' | 'studnie', _data: OfferFts5Data): Promise<boolean> {
    return true;
}

/** PostgreSQL removes the indexed document in the same transaction as the source row. */
export async function removeFts5(_type: 'rury' | 'studnie', _id: string): Promise<void> {}

export async function fts5Exists(): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname IN (${Prisma.join(Object.values(SEARCH_INDEXES))})
    `;
    return rows.length === Object.keys(SEARCH_INDEXES).length;
}

export interface FtsSyncStatus {
    inSync: boolean;
    tables: {
        rury: { offers: number; fts: number };
        studnie: { offers: number; fts: number };
    };
    missingIds: Array<{ id: string; type: 'rury' | 'studnie' }>;
}

export async function ftsSyncStatus(): Promise<FtsSyncStatus> {
    const [rury, studnie, indexesExist] = await Promise.all([
        prisma.offers_rel.count(),
        prisma.offers_studnie_rel.count(),
        fts5Exists()
    ]);
    return {
        inSync: indexesExist,
        tables: {
            rury: { offers: rury, fts: indexesExist ? rury : 0 },
            studnie: { offers: studnie, fts: indexesExist ? studnie : 0 }
        },
        missingIds: []
    };
}

export async function rebuildFts5(onProgress?: (done: number) => void): Promise<number> {
    for (const indexName of Object.values(SEARCH_INDEXES)) {
        await prisma.$executeRaw(Prisma.sql`REINDEX INDEX CONCURRENTLY ${Prisma.raw(indexName)}`);
    }
    const [rury, studnie] = await Promise.all([
        prisma.offers_rel.count(),
        prisma.offers_studnie_rel.count()
    ]);
    const total = rury + studnie;
    onProgress?.(total);
    return total;
}

/** Validate the indexes installed by migrations; runtime never creates DDL. */
export async function ensureFts5Schema(): Promise<void> {
    if (!(await fts5Exists())) {
        throw new Error('Wymagane indeksy GIN PostgreSQL nie istnieją; zastosuj migracje Prisma.');
    }
}
