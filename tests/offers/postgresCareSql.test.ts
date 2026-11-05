import type { Prisma } from '../../generated/prisma-postgres/client';

jest.mock('../../src/prismaClient', () => ({ __esModule: true, default: {} }));

import { buildCareEnrichQuery, getCareEtagInput } from '../../src/services/careService';

function sqlText(query: Prisma.Sql | null): string {
    return query?.sql ?? '';
}

describe('PostgreSQL care SQL', () => {
    test('uses PostgreSQL JSONB extraction and safely sums wellsExport arrays', () => {
        const query = buildCareEnrichQuery(['offer-1'], ['well-offer-1']);
        const sql = sqlText(query);

        expect(sql).toContain('::jsonb #>>');
        expect(sql).toContain("'{clientContacts,0,phone}'");
        expect(sql).toContain('jsonb_array_elements');
        expect(sql).toContain('::numeric');
        expect(sql).not.toMatch(/json_extract|json_each|CAST\([^)]* AS REAL\)/i);
    });

    test('ETag share marker is recipient-scoped and covers row replacement/update', async () => {
        const statements: string[] = [];
        const db = {
            $queryRaw: async <T>(query: Prisma.Sql): Promise<T> => {
                statements.push(query.sql);
                return (statements.length === 1 ? [{ l: 'abc' }] : [{ m: null }]) as T;
            }
        };

        const etag = await getCareEtagInput(db, 'user-1');

        expect(etag[11]).toBe('abc');
        expect(statements[0]).toContain('md5(COALESCE(string_agg(to_jsonb(ds)::text');
        expect(statements[0]).toContain('ORDER BY ds."id"');
        expect(statements[0]).toContain('ds."sharedWithUserId" =');
        expect(statements[0]).not.toMatch(/rowid|sqlite_master/i);
    });
});
