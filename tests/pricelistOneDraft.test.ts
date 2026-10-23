/**
 * Naprawy A2/A3: jeden DRAFT na typ (indeks częściowy w migracji) + parser
 * `If-Match` używany przez PUT /:id i PUT siatek.
 */
import fs from 'fs';
import path from 'path';
import { parseIfMatch } from '../src/services/pricelist/writeTarget';

const MIGRATION = path.join(
    process.cwd(),
    'prisma',
    'migrations',
    '20261023000000_pricelist_one_draft',
    'migration.sql'
);

describe('migracja: jeden DRAFT na typ', () => {
    it('tworzy unikalny indeks częściowy na (type) WHERE status = DRAFT', () => {
        const sql = fs.readFileSync(MIGRATION, 'utf-8');
        expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "ux_pricelist_version_one_draft"');
        expect(sql).toContain('ON "PricelistVersion"("type")');
        expect(sql).toContain(`WHERE "status" = 'DRAFT'`);
    });

    it('nie kasuje duplikatów po cichu (FK Restrict — utrata historii)', () => {
        const sql = fs.readFileSync(MIGRATION, 'utf-8');
        expect(sql).not.toMatch(/DELETE\s+FROM/i);
        expect(sql).not.toMatch(/DROP\s+TABLE/i);
    });
});

describe('parseIfMatch', () => {
    it('czyta mocny i słaby walidator, ignoruje cudzysłowy', () => {
        expect(parseIfMatch('"abc123"')).toBe('abc123');
        expect(parseIfMatch('W/"abc123"')).toBe('abc123');
        expect(parseIfMatch('abc123')).toBe('abc123');
    });

    it('brak nagłówka / gwiazdka / pusto = brak kontroli', () => {
        expect(parseIfMatch(undefined)).toBeUndefined();
        expect(parseIfMatch('')).toBeUndefined();
        expect(parseIfMatch('*')).toBeUndefined();
        expect(parseIfMatch('""')).toBeUndefined();
    });
});
