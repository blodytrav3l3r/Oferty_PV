import prisma from '../prismaClient';
import { Prisma } from '../../generated/prisma-postgres/client';

const SEARCH_INDEXES = {
    rury: 'offers_rel_search_tsv_gin_idx',
    studnie: 'offers_studnie_rel_search_tsv_gin_idx'
} as const;

async function readValidIndexNames(): Promise<Set<string>> {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT index_relation.relname AS name
        FROM pg_catalog.pg_index AS search_index
        JOIN pg_catalog.pg_class AS index_relation
          ON index_relation.oid = search_index.indexrelid
        JOIN pg_catalog.pg_namespace AS index_schema
          ON index_schema.oid = index_relation.relnamespace
        WHERE index_schema.nspname = current_schema()
          AND search_index.indisready
          AND search_index.indisvalid
          AND index_relation.relname IN (${Prisma.join(Object.values(SEARCH_INDEXES))})
    `;
    return new Set(rows.map(({ name }) => name));
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
    const [rury, studnie, validIndexes] = await Promise.all([
        prisma.offers_rel.count(),
        prisma.offers_studnie_rel.count(),
        readValidIndexNames()
    ]);
    const ruryReady = validIndexes.has(SEARCH_INDEXES.rury);
    const studnieReady = validIndexes.has(SEARCH_INDEXES.studnie);
    return {
        inSync: ruryReady && studnieReady,
        tables: {
            rury: { offers: rury, fts: ruryReady ? rury : 0 },
            studnie: { offers: studnie, fts: studnieReady ? studnie : 0 }
        },
        missingIds: []
    };
}
